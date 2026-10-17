-- Who still has sets to match, so the guess screen can say "waiting on Dalton, Matt".
-- Only whether someone has finished, never what they guessed.
create function guess_waiting(p_room uuid) returns table (player_id uuid)
language sql stable security definer set search_path = public as $$
  select player_id
  from guess_status(p_room)
  where not finished
    and is_room_member(p_room)
    and room_phase(p_room) = 'guess'
$$;
