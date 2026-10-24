-- Play again with the same crew. When the host starts the next experiment, the finished one points at it
-- (rooms.next_room_id). Everyone in the old room already hears about changes to it through realtime, so a pointer there
-- is how their results screen learns the next one is ready. Nobody is moved: each person taps to join.
alter table rooms add column next_room_id uuid references rooms(id) on delete set null;

-- Starts the next experiment for the host of a finished one. It keeps the source, how many each and the host's name,
-- and takes a new vibe. The old row is locked first, so a double tap makes one room and the second tap is told so.
create function create_next_room(p_user uuid, p_old uuid, p_theme text, p_title text default null)
returns rooms
language plpgsql security definer set search_path = public as $$
declare
  o rooms;
  r rooms;
  host_name text;
begin
  select * into o from rooms where id = p_old for update;
  if not found then raise exception 'experiment not found'; end if;
  if o.host_user_id <> p_user then raise exception 'only the host can play again'; end if;
  if o.phase not in ('reveal', 'done') then raise exception 'this experiment is not finished yet'; end if;
  if o.next_room_id is not null then raise exception 'the next experiment has already started'; end if;
  select name into host_name from players where room_id = o.id and user_id = p_user;
  select * into r from create_room(p_user, host_name, p_theme, o.songs_per_player, o.max_players, p_title, o.source);
  update rooms set next_room_id = r.id where id = o.id;
  return r;
end $$;

revoke execute on function create_next_room(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function create_next_room(uuid, uuid, text, text) to service_role;

-- Seats the caller in the experiment after the one they were in, under the name they had there. It checks the old seat
-- instead of matching names, so it cannot take anyone's seat.
create function join_next_room(p_old uuid) returns rooms
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o rooms;
  r rooms;
  nm text;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into o from rooms where id = p_old;
  if not found or o.next_room_id is null then raise exception 'the next experiment is not ready yet'; end if;
  select name into nm from players where room_id = o.id and user_id = uid;
  if nm is null then raise exception 'you were not in that experiment'; end if;
  select * into r from rooms where id = o.next_room_id;
  if exists (select 1 from players where room_id = r.id and user_id = uid) then return r; end if;
  if r.phase <> 'submit' then raise exception 'guessing has already started'; end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'this experiment is full';
  end if;
  begin
    insert into players (room_id, user_id, name) values (r.id, uid, nm) on conflict (room_id, user_id) do nothing;
  exception when unique_violation then
    raise exception 'someone in the next experiment already has your name';
  end;
  return r;
end $$;

revoke execute on function join_next_room(uuid) from public, anon;
grant execute on function join_next_room(uuid) to authenticated;
