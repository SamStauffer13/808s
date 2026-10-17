-- The genres Spotify lists for a song's artists, kept with the song so the reveal can show each person's vibe.
-- add-song fills it in; an artist with no genres (or a Spotify hiccup) just leaves it empty.
alter table songs add column genres text[] not null default '{}';

drop function add_song(uuid, uuid, text, text, text, text);

create function add_song(p_user uuid, p_room uuid, p_spotify_id text, p_title text, p_artist text, p_art text, p_genres text[])
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
    insert into songs (room_id, spotify_id, title, artist, art_url, genres)
    values (p_room, p_spotify_id, p_title, p_artist, p_art, coalesce(p_genres, '{}'))
    returning * into s;
  exception when unique_violation then
    raise exception 'that track is already in the playlist';
  end;
  insert into song_owners (song_id, room_id, player_id) values (s.id, p_room, me);
  return s;
end $$;

revoke execute on function add_song(uuid, uuid, text, text, text, text, text[]) from public, anon, authenticated;
grant execute on function add_song(uuid, uuid, text, text, text, text, text[]) to service_role;
