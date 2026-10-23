-- An experiment is about one kind of thing: Spotify songs or YouTube videos. The room says which (rooms.source) and
-- every item remembers where it came from (songs.source), so a mixed room is a small step later. Guessing, packs and
-- the hidden owners do not care what an item is.
alter table rooms add column source text not null default 'spotify' check (source in ('spotify', 'youtube'));
alter table songs add column source text not null default 'spotify' check (source in ('spotify', 'youtube'));

-- the id of the item at its source (a Spotify track id, a YouTube video id)
alter table songs rename column spotify_id to item_id;

drop function room_preview(text);
create function room_preview(p_code text) returns table (theme text, phase text, source text)
language sql stable security definer set search_path = public as $$
  select theme, phase, source from rooms where code = upper(trim(p_code))
$$;

drop function create_room(uuid, text, text, int, int, text);
create function create_room(p_user uuid, p_name text, p_theme text, p_songs int, p_max int, p_title text default null, p_source text default 'spotify')
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  insert into rooms (code, host_user_id, theme, title, songs_per_player, max_players, source)
  values (gen_room_code(), p_user, left(trim(p_theme), 140), nullif(left(trim(coalesce(p_title, '')), 100), ''), p_songs, p_max, p_source)
  returning * into r;
  insert into players (room_id, user_id, name) values (r.id, p_user, left(trim(p_name), 16));
  return r;
end $$;

revoke execute on function create_room(uuid, text, text, int, int, text, text) from public, anon, authenticated;
grant execute on function create_room(uuid, text, text, int, int, text, text) to service_role;

-- the item takes its source from the room, so a client cannot say otherwise
drop function add_song(uuid, uuid, text, text, text, text, text[]);
create function add_song(p_user uuid, p_room uuid, p_item_id text, p_title text, p_artist text, p_art text, p_genres text[])
returns songs
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  me uuid;
  s songs;
begin
  select * into r from rooms where id = p_room;
  if not found or r.phase <> 'submit' then raise exception 'this experiment is closed to new tracks'; end if;
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'not in this experiment'; end if;
  if (select count(*) from song_owners where room_id = p_room and player_id = me) >= r.songs_per_player then
    raise exception 'all your tracks are loaded';
  end if;
  begin
    insert into songs (room_id, source, item_id, title, artist, art_url, genres)
    values (p_room, r.source, p_item_id, p_title, p_artist, p_art, coalesce(p_genres, '{}'))
    returning * into s;
  exception when unique_violation then
    raise exception 'that one is already in the experiment';
  end;
  insert into song_owners (song_id, room_id, player_id) values (s.id, p_room, me);
  return s;
end $$;

revoke execute on function add_song(uuid, uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function add_song(uuid, uuid, text, text, text, text, text[]) to service_role;
