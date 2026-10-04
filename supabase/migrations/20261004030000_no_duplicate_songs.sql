-- One song per game, even when Spotify lists it as several versions ("Song", "Song (2022 Remaster)",
-- "Song - Remastered 2011"): a song's key is its title minus bracketed or dashed suffixes, plus its first artist.
alter table songs add column song_key text generated always as (
  coalesce(
    nullif(trim(regexp_replace(regexp_replace(lower(title), '\s*[(\[][^)\]]*[)\]]', '', 'g'), '\s+-\s+.*$', '')), ''),
    lower(title)
  ) || '|' || lower(split_part(artist, ', ', 1))
) stored;

delete from songs a using songs b where a.room_id = b.room_id and a.song_key = b.song_key and a.ctid > b.ctid;

alter table songs drop constraint songs_room_id_spotify_id_key;
alter table songs add constraint songs_room_id_song_key_key unique (room_id, song_key);

create or replace function add_song(p_user uuid, p_room uuid, p_spotify_id text, p_title text, p_artist text, p_art text)
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
    raise exception 'that song is already in this game';
  end;
  insert into song_owners (song_id, room_id, player_id) values (s.id, p_room, me);
  return s;
end $$;
