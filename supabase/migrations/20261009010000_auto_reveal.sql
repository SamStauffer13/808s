-- The reveal opens by itself once everyone has matched every set they can, and then stays open: each
-- player steps through it on their own, whenever they come back. The host no longer runs it, and keeps
-- only a way to open it early for people who never finish.

-- who has matched every set they can: a player who added songs skips their own set
create function guess_status(p_room uuid) returns table (player_id uuid, finished boolean)
language sql stable security definer set search_path = public as $$
  with sets as (select count(distinct pack) as n from songs where room_id = p_room),
  matched as (
    select g.guesser_id, count(distinct s.pack) as n
    from guesses g join songs s on s.id = g.song_id
    where g.room_id = p_room
    group by g.guesser_id
  )
  select p.id, coalesce(m.n, 0) >= sets.n - (case when exists (select 1 from song_owners o where o.player_id = p.id) then 1 else 0 end)
  from players p
  cross join sets
  left join matched m on m.guesser_id = p.id
  where p.room_id = p_room
$$;
revoke execute on function guess_status(uuid) from public, anon, authenticated;

-- same numbers as before, without saying who or which sets
create or replace function guess_progress(p_room uuid) returns table (finished int, total int)
language sql stable security definer set search_path = public as $$
  select (count(*) filter (where finished))::int, count(*)::int
  from guess_status(p_room)
  where is_room_member(p_room)
    and room_phase(p_room) in ('guess', 'reveal', 'done')
$$;

create or replace function submit_guess(p_pack uuid, p_guessed uuid) returns void
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

  -- that was the last one: open the reveal
  if not exists (select 1 from guess_status(room) where not finished) then
    update rooms set phase = 'reveal' where id = room and phase = 'guess';
  end if;
end $$;

-- the host can open the reveal early; nothing else is theirs to move
create or replace function host_set_phase(p_room uuid, p_phase text) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where id = p_room and host_user_id = auth.uid();
  if not found then raise exception 'host only'; end if;
  if not (r.phase = 'guess' and p_phase = 'reveal') then
    raise exception 'invalid phase change';
  end if;
  update rooms set phase = p_phase where id = p_room;
end $$;

-- each player keeps their own place in the reveal now
drop function host_set_reveal_index(uuid, int);
