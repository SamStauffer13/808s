-- Guessing is per person's set of songs: songs added by the same player share a "pack" id.
-- The id says which songs go together, never whose they are.
alter table songs add column pack uuid;

-- games already past the submit phase
with packs as (select player_id, gen_random_uuid() as pack from song_owners group by player_id)
update songs s set pack = packs.pack
from song_owners so join packs on packs.player_id = so.player_id
where so.song_id = s.id and s.pack is null;

create or replace function begin_guess(p_room uuid, p_playlist_id text, p_playlist_url text, p_order uuid[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if (select phase from rooms where id = p_room) <> 'submit' then
    raise exception 'not in the submit phase';
  end if;
  update songs s set position = o.ord
  from unnest(p_order) with ordinality as o(song_id, ord)
  where s.id = o.song_id and s.room_id = p_room;

  with packs as (select player_id, gen_random_uuid() as pack from song_owners where room_id = p_room group by player_id)
  update songs s set pack = packs.pack
  from song_owners so join packs on packs.player_id = so.player_id
  where so.song_id = s.id and s.room_id = p_room;

  update rooms set phase = 'guess', playlist_id = p_playlist_id, playlist_url = p_playlist_url, reveal_index = 0
  where id = p_room;
end $$;

-- one guess covers every song in the pack. A friend can match only one pack, so picking
-- someone already matched elsewhere moves them.
drop function submit_guess(uuid, uuid);
create function submit_guess(p_pack uuid, p_guessed uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  room uuid;
  me uuid;
begin
  select room_id into room from songs where pack = p_pack limit 1;
  if room is null then raise exception 'songs not found'; end if;
  if room_phase(room) <> 'guess' then raise exception 'guessing is closed'; end if;
  me := my_player_id(room);
  if me is null then raise exception 'not in this game'; end if;
  if exists (select 1 from songs s join song_owners o on o.song_id = s.id where s.pack = p_pack and o.player_id = me) then
    raise exception 'those songs are yours';
  end if;
  if p_guessed = me then raise exception 'you did not add these songs'; end if;
  if not exists (select 1 from players where id = p_guessed and room_id = room) then
    raise exception 'unknown player';
  end if;

  delete from guesses g using songs s
  where g.song_id = s.id and g.guesser_id = me and g.guessed_player_id = p_guessed and s.pack <> p_pack;

  insert into guesses (room_id, song_id, guesser_id, guessed_player_id)
  select room, id, me, p_guessed from songs where pack = p_pack
  on conflict (song_id, guesser_id) do update set guessed_player_id = excluded.guessed_player_id;
end $$;
