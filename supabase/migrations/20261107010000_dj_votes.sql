-- DJ party mode, phase 2: votes, the rules, and making a DJ room. Like add_song, every function here is for the
-- service role only: the Edge Functions check who is asking, then call these.

alter table rooms add column suggestions_paused boolean not null default false;

create table dj_vetoes (
  track_id uuid not null references dj_tracks on delete cascade,
  player_id uuid not null references players on delete cascade,
  room_id uuid not null references rooms on delete cascade,
  created_at timestamptz not null default now(),
  primary key (track_id, player_id)
);

alter table dj_vetoes enable row level security;
create policy dj_vetoes_read on dj_vetoes for select to authenticated using (is_room_member(room_id));
alter publication supabase_realtime add table dj_vetoes;

-- how many people it takes to vote a song off: a third of the room, between 1 and 3
create function dj_threshold(p_room uuid) returns int
language sql stable set search_path = public as $$
  select greatest(1, least(3, ceil(count(*) / 3.0)::int)) from players where room_id = p_room
$$;

-- a DJ party is a room with a mode. It stays in the 'submit' phase for good, so joining works like any other room.
drop function create_room(uuid, text, text, int, int, text, text);
create function create_room(p_user uuid, p_name text, p_theme text, p_songs int, p_max int, p_title text default null, p_source text default 'spotify', p_mode text default 'game')
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  insert into rooms (code, host_user_id, theme, title, songs_per_player, max_players, source, mode)
  values (gen_room_code(), p_user, left(trim(p_theme), 140), nullif(left(trim(coalesce(p_title, '')), 100), ''), p_songs, p_max, p_source, p_mode)
  returning * into r;
  insert into players (room_id, user_id, name) values (r.id, p_user, left(trim(p_name), 16));
  return r;
end $$;

revoke execute on function create_room(uuid, text, text, int, int, text, text, text) from public, anon, authenticated;
grant execute on function create_room(uuid, text, text, int, int, text, text, text) to service_role;

-- the invite page needs to know it is a party, not a guessing game
drop function room_preview(text);
create function room_preview(p_code text) returns table (theme text, phase text, source text, mode text)
language sql stable security definer set search_path = public as $$
  select theme, phase, source, mode from rooms where code = upper(trim(p_code))
$$;

create function dj_suggest(p_user uuid, p_room uuid, p_item_id text, p_title text, p_artist text, p_art text)
returns dj_tracks
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  me uuid;
  t dj_tracks;
begin
  select * into r from rooms where id = p_room;
  if not found or r.mode <> 'dj' then raise exception 'this is not a live session'; end if;
  if r.suggestions_paused then raise exception 'code freeze: the host paused new tracks'; end if;
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'attach to the session first'; end if;
  if exists (select 1 from dj_tracks where room_id = p_room and suggested_by = me and status = 'pending') then
    raise exception 'you already have a track in staging';
  end if;
  if exists (select 1 from dj_tracks where room_id = p_room and item_id = p_item_id and status in ('played', 'playing')) then
    raise exception 'that one already played tonight';
  end if;
  begin
    insert into dj_tracks (room_id, item_id, title, artist, art, suggested_by)
    values (p_room, p_item_id, p_title, p_artist, p_art, me)
    returning * into t;
  exception when unique_violation then
    raise exception 'that one is already in line';
  end;
  return t;
end $$;

-- A vote against a song. Returns whether the song is now off the list. Only songs still waiting can be voted on:
-- once one is queued in Spotify it is locked in.
create function dj_veto(p_user uuid, p_room uuid, p_track uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  t dj_tracks;
  votes int;
begin
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'attach to the session first'; end if;
  select * into t from dj_tracks where id = p_track and room_id = p_room for update;
  if not found then raise exception 'that song is gone'; end if;
  if t.status <> 'pending' then raise exception 'too late, that one is locked in'; end if;
  if t.suggested_by = me then raise exception 'you cannot roll back your own track'; end if;
  if (select count(*) from dj_vetoes v join dj_tracks k on k.id = v.track_id where v.player_id = me and k.room_id = p_room and k.status = 'pending') >= 3 then
    raise exception 'you have 3 rollbacks out already, take one back first';
  end if;
  insert into dj_vetoes (track_id, player_id, room_id) values (p_track, me, p_room) on conflict do nothing;
  select count(*) into votes from dj_vetoes where track_id = p_track;
  if votes >= dj_threshold(p_room) then
    update dj_tracks set status = 'vetoed' where id = p_track;
    return 'vetoed';
  end if;
  return 'pending';
end $$;

create function dj_unveto(p_user uuid, p_room uuid, p_track uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'attach to the session first'; end if;
  if not exists (select 1 from dj_tracks where id = p_track and room_id = p_room and status = 'pending') then
    raise exception 'too late, that one is locked in';
  end if;
  delete from dj_vetoes where track_id = p_track and player_id = me;
end $$;

-- the host's say: drop a song, move one to the front of the line, or pause new suggestions
create function dj_host(p_user uuid, p_room uuid, p_action text, p_track uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = p_room and host_user_id = p_user and mode = 'dj') then
    raise exception 'only the host can do that';
  end if;
  if p_action = 'pause' then
    update rooms set suggestions_paused = true where id = p_room;
  elsif p_action = 'resume' then
    update rooms set suggestions_paused = false where id = p_room;
  elsif p_action = 'remove' then
    update dj_tracks set status = 'vetoed' where id = p_track and room_id = p_room and status = 'pending';
  elsif p_action = 'top' then
    update dj_tracks
    set created_at = coalesce((select min(created_at) from dj_tracks where room_id = p_room and status = 'pending'), now()) - interval '1 second'
    where id = p_track and room_id = p_room and status = 'pending';
  else
    raise exception 'unknown action';
  end if;
end $$;

revoke execute on function dj_suggest(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function dj_veto(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function dj_unveto(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function dj_host(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function dj_suggest(uuid, uuid, text, text, text, text) to service_role;
grant execute on function dj_veto(uuid, uuid, uuid) to service_role;
grant execute on function dj_unveto(uuid, uuid, uuid) to service_role;
grant execute on function dj_host(uuid, uuid, text, uuid) to service_role;
