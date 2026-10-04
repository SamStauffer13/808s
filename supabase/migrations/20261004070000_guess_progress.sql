-- How many players have matched every set they can, without saying who or which sets.
-- A player who added songs has one set they skip; everyone else matches them all.
create function guess_progress(p_room uuid) returns table (finished int, total int)
language sql stable security definer set search_path = public as $$
  with sets as (select count(distinct pack) as n from songs where room_id = p_room),
  matched as (
    select g.guesser_id, count(distinct s.pack) as n
    from guesses g join songs s on s.id = g.song_id
    where g.room_id = p_room
    group by g.guesser_id
  )
  select
    (count(*) filter (
      where coalesce(m.n, 0) >= sets.n - (case when exists (select 1 from song_owners o where o.player_id = p.id) then 1 else 0 end)
    ))::int,
    count(*)::int
  from players p
  cross join sets
  left join matched m on m.guesser_id = p.id
  where p.room_id = p_room
    and is_room_member(p_room)
    and room_phase(p_room) in ('guess', 'reveal', 'done')
  group by sets.n
$$;

-- scores count sets, not songs: one point for each friend's set you matched
create or replace function room_scores(p_room uuid) returns table (player_id uuid, name text, correct int, total int)
language sql stable security definer set search_path = public as $$
  select
    p.id,
    p.name,
    (count(distinct s.pack) filter (where g.guessed_player_id = so.player_id))::int,
    (select count(distinct s2.pack) from songs s2 join song_owners o2 on o2.song_id = s2.id
       where s2.room_id = p_room and o2.player_id <> p.id)::int
  from players p
  left join guesses g on g.guesser_id = p.id
  left join songs s on s.id = g.song_id
  left join song_owners so on so.song_id = g.song_id
  where p.room_id = p_room
    and is_room_member(p_room)
    and room_phase(p_room) in ('reveal', 'done')
  group by p.id, p.name
  order by 3 desc, count(distinct s.pack) asc, p.name
$$;
