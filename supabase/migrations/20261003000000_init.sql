-- 808s: anonymous song-guessing game.
-- Who submitted what lives in song_owners. Row Level Security hides it from everyone but the
-- owner until the room reaches the reveal phase. Clients never write songs or owners directly.

create table rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  host_user_id uuid not null,
  theme text not null check (char_length(theme) between 1 and 60),
  songs_per_player int not null default 3 check (songs_per_player between 1 and 10),
  max_players int not null default 8 check (max_players between 2 and 20),
  phase text not null default 'lobby' check (phase in ('lobby', 'submit', 'guess', 'reveal', 'done')),
  playlist_id text,
  playlist_url text,
  reveal_index int not null default 0,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  user_id uuid not null,
  name text not null check (char_length(name) between 1 and 16),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, name)
);

-- No created_at here on purpose: insert order would hint at who submitted what.
create table songs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  spotify_id text not null,
  title text not null,
  artist text not null,
  art_url text,
  position int,
  unique (room_id, spotify_id)
);

create table song_owners (
  song_id uuid primary key references songs on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  player_id uuid not null references players on delete cascade
);

create table guesses (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  song_id uuid not null references songs on delete cascade,
  guesser_id uuid not null references players on delete cascade,
  guessed_player_id uuid not null references players on delete cascade,
  unique (song_id, guesser_id)
);

create index on players (room_id);
create index on songs (room_id);
create index on song_owners (room_id, player_id);
create index on guesses (room_id, guesser_id);

-- helpers used by the policies --------------------------------------------------------------

create function is_room_member(p_room uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from players where room_id = p_room and user_id = auth.uid())
$$;

create function room_phase(p_room uuid) returns text
language sql stable security definer set search_path = public as $$
  select phase from rooms where id = p_room
$$;

create function my_player_id(p_room uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from players where room_id = p_room and user_id = auth.uid()
$$;

-- row level security -----------------------------------------------------------------------

alter table rooms enable row level security;
alter table players enable row level security;
alter table songs enable row level security;
alter table song_owners enable row level security;
alter table guesses enable row level security;

create policy rooms_read on rooms for select to authenticated
  using (is_room_member(id));

create policy players_read on players for select to authenticated
  using (is_room_member(room_id));

-- the song pool is visible once guessing starts; before that you only see your own picks
create policy songs_read on songs for select to authenticated
  using (
    is_room_member(room_id)
    and (
      room_phase(room_id) in ('guess', 'reveal', 'done')
      or exists (select 1 from song_owners o where o.song_id = songs.id and o.player_id = my_player_id(room_id))
    )
  );

-- the secret: only the owner sees a song's owner, until the reveal
create policy song_owners_read on song_owners for select to authenticated
  using (
    player_id = my_player_id(room_id)
    or room_phase(room_id) in ('reveal', 'done')
  );

-- your own guesses always; everyone's once revealed
create policy guesses_read on guesses for select to authenticated
  using (
    guesser_id = my_player_id(room_id)
    or room_phase(room_id) in ('reveal', 'done')
  );

-- player-facing functions -----------------------------------------------------------------

create function join_room(p_code text, p_name text) returns rooms
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'room not found'; end if;
  if exists (select 1 from players where room_id = r.id and user_id = uid) then return r; end if;
  if r.phase <> 'lobby' then raise exception 'round already started'; end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'room is full';
  end if;
  insert into players (room_id, user_id, name) values (r.id, uid, left(trim(p_name), 16));
  return r;
end $$;

-- how many songs each player has locked in, without saying which songs
create function submission_counts(p_room uuid) returns table (player_id uuid, n int)
language sql stable security definer set search_path = public as $$
  select p.id, count(o.song_id)::int
  from players p
  left join song_owners o on o.player_id = p.id
  where p.room_id = p_room and is_room_member(p_room)
  group by p.id
$$;

create function remove_song(p_song uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o song_owners;
begin
  select * into o from song_owners where song_id = p_song;
  if not found or o.player_id is distinct from my_player_id(o.room_id) then
    raise exception 'not your song';
  end if;
  if room_phase(o.room_id) <> 'submit' then raise exception 'submissions are closed'; end if;
  delete from songs where id = p_song;
end $$;

create function submit_guess(p_song uuid, p_guessed uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  s songs;
  me uuid;
begin
  select * into s from songs where id = p_song;
  if not found then raise exception 'song not found'; end if;
  if room_phase(s.room_id) <> 'guess' then raise exception 'guessing is closed'; end if;
  me := my_player_id(s.room_id);
  if me is null then raise exception 'not in this room'; end if;
  if exists (select 1 from song_owners where song_id = p_song and player_id = me) then
    raise exception 'that one is yours';
  end if;
  if p_guessed = me then raise exception 'you did not add this song'; end if;
  if not exists (select 1 from players where id = p_guessed and room_id = s.room_id) then
    raise exception 'unknown player';
  end if;
  insert into guesses (room_id, song_id, guesser_id, guessed_player_id)
  values (s.room_id, p_song, me, p_guessed)
  on conflict (song_id, guesser_id) do update set guessed_player_id = excluded.guessed_player_id;
end $$;

create function host_set_phase(p_room uuid, p_phase text) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where id = p_room and host_user_id = auth.uid();
  if not found then raise exception 'host only'; end if;
  if not (
    (r.phase = 'lobby' and p_phase = 'submit')
    or (r.phase = 'guess' and p_phase = 'reveal')
    or (r.phase = 'reveal' and p_phase = 'done')
  ) then
    raise exception 'invalid phase change';
  end if;
  if p_phase = 'submit' and (select count(*) from players where room_id = p_room) < 2 then
    raise exception 'need at least 2 players';
  end if;
  update rooms set phase = p_phase, reveal_index = 0 where id = p_room;
end $$;

create function host_set_reveal_index(p_room uuid, p_index int) returns void
language plpgsql security definer set search_path = public as $$
begin
  update rooms set reveal_index = greatest(p_index, 0)
  where id = p_room and host_user_id = auth.uid() and phase = 'reveal';
  if not found then raise exception 'host only'; end if;
end $$;

-- scores, only once revealed. Ties break on fewest guesses made.
create function room_scores(p_room uuid) returns table (player_id uuid, name text, correct int, total int)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.name,
    (count(*) filter (where g.guessed_player_id = so.player_id))::int,
    (select count(*) from songs s2 join song_owners o2 on o2.song_id = s2.id
       where s2.room_id = p_room and o2.player_id <> p.id)::int
  from players p
  left join guesses g on g.guesser_id = p.id
  left join song_owners so on so.song_id = g.song_id
  where p.room_id = p_room
    and is_room_member(p_room)
    and room_phase(p_room) in ('reveal', 'done')
  group by p.id, p.name
  order by 3 desc, count(g.id) asc, p.name
$$;

-- service-role-only functions, called from Edge Functions ---------------------------------

create function gen_room_code() returns text
language plpgsql as $$
declare c text;
begin
  loop
    c := chr(65 + floor(random() * 26)::int) || chr(65 + floor(random() * 26)::int)
         || '-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from rooms where code = c);
  end loop;
  return c;
end $$;

create function create_room(p_user uuid, p_name text, p_theme text, p_songs int, p_max int)
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  insert into rooms (code, host_user_id, theme, songs_per_player, max_players)
  values (gen_room_code(), p_user, left(trim(p_theme), 60), p_songs, p_max)
  returning * into r;
  insert into players (room_id, user_id, name) values (r.id, p_user, left(trim(p_name), 16));
  return r;
end $$;

create function add_song(p_user uuid, p_room uuid, p_spotify_id text, p_title text, p_artist text, p_art text)
returns songs
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  me uuid;
  s songs;
begin
  select * into r from rooms where id = p_room;
  if not found or r.phase <> 'submit' then raise exception 'submissions are closed'; end if;
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'not in this room'; end if;
  if (select count(*) from song_owners where room_id = p_room and player_id = me) >= r.songs_per_player then
    raise exception 'you have used all your picks';
  end if;
  begin
    insert into songs (room_id, spotify_id, title, artist, art_url)
    values (p_room, p_spotify_id, p_title, p_artist, p_art)
    returning * into s;
  exception when unique_violation then
    raise exception 'someone already added that song';
  end;
  insert into song_owners (song_id, room_id, player_id) values (s.id, p_room, me);
  return s;
end $$;

create function begin_guess(p_room uuid, p_playlist_id text, p_playlist_url text, p_order uuid[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select phase from rooms where id = p_room) <> 'submit' then
    raise exception 'not in the submit phase';
  end if;
  update songs s set position = o.ord
  from unnest(p_order) with ordinality as o(song_id, ord)
  where s.id = o.song_id and s.room_id = p_room;
  update rooms set phase = 'guess', playlist_id = p_playlist_id, playlist_url = p_playlist_url, reveal_index = 0
  where id = p_room;
end $$;

revoke execute on function gen_room_code() from public, anon, authenticated;
revoke execute on function create_room(uuid, text, text, int, int) from public, anon, authenticated;
revoke execute on function add_song(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function begin_guess(uuid, text, text, uuid[]) from public, anon, authenticated;
grant execute on function gen_room_code() to service_role;
grant execute on function create_room(uuid, text, text, int, int) to service_role;
grant execute on function add_song(uuid, uuid, text, text, text, text) to service_role;
grant execute on function begin_guess(uuid, text, text, uuid[]) to service_role;

-- realtime: song_owners is deliberately left out
alter publication supabase_realtime add table rooms, players, songs, guesses;
