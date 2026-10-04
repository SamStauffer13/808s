-- Lets someone arriving from an invite link see which game it is before joining,
-- and lets people join while songs are still being submitted.

create function room_preview(p_code text) returns table (theme text, phase text)
language sql stable security definer set search_path = public as $$
  select theme, phase from rooms where code = upper(trim(p_code))
$$;

create or replace function join_room(p_code text, p_name text) returns rooms
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'game not found'; end if;
  if exists (select 1 from players where room_id = r.id and user_id = uid) then return r; end if;
  if r.phase not in ('lobby', 'submit') then raise exception 'this game has already started guessing'; end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'this game is full';
  end if;
  insert into players (room_id, user_id, name) values (r.id, uid, left(trim(p_name), 16));
  return r;
end $$;
