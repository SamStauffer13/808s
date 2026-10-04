-- player-facing messages say "tracks", matching the app
create or replace function remove_song(p_song uuid) returns void
language plpgsql security definer set search_path = public as $$
declare o song_owners;
begin
  select * into o from song_owners where song_id = p_song;
  if not found or o.player_id is distinct from my_player_id(o.room_id) then
    raise exception 'not your track';
  end if;
  if room_phase(o.room_id) <> 'submit' then raise exception 'the playlist is closed to new tracks'; end if;
  delete from songs where id = p_song;
end $$;

create or replace function add_song(p_user uuid, p_room uuid, p_spotify_id text, p_title text, p_artist text, p_art text)
returns songs
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  me uuid;
  s songs;
begin
  select * into r from rooms where id = p_room;
  if not found or r.phase <> 'submit' then raise exception 'the playlist is closed to new tracks'; end if;
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'not in this playlist'; end if;
  if (select count(*) from song_owners where room_id = p_room and player_id = me) >= r.songs_per_player then
    raise exception 'all your tracks are loaded';
  end if;
  begin
    insert into songs (room_id, spotify_id, title, artist, art_url)
    values (p_room, p_spotify_id, p_title, p_artist, p_art)
    returning * into s;
  exception when unique_violation then
    raise exception 'that track is already in the playlist';
  end;
  insert into song_owners (song_id, room_id, player_id) values (s.id, p_room, me);
  return s;
end $$;

create or replace function submit_guess(p_pack uuid, p_guessed uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  room uuid;
  me uuid;
begin
  select room_id into room from songs where pack = p_pack limit 1;
  if room is null then raise exception 'tracks not found'; end if;
  if room_phase(room) <> 'guess' then raise exception 'guessing is closed'; end if;
  me := my_player_id(room);
  if me is null then raise exception 'not in this playlist'; end if;
  if exists (select 1 from songs s join song_owners o on o.song_id = s.id where s.pack = p_pack and o.player_id = me) then
    raise exception 'those tracks are yours';
  end if;
  if p_guessed = me then raise exception 'you did not add these tracks'; end if;
  if not exists (select 1 from players where id = p_guessed and room_id = room) then
    raise exception 'unknown player';
  end if;

  delete from guesses g using songs s
  where g.song_id = s.id and g.guesser_id = me and g.guessed_player_id = p_guessed and s.pack <> p_pack;

  insert into guesses (room_id, song_id, guesser_id, guessed_player_id)
  select room, id, me, p_guessed from songs where pack = p_pack
  on conflict (song_id, guesser_id) do update set guessed_player_id = excluded.guessed_player_id;
end $$;
