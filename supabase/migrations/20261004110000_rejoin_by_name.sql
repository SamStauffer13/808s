-- Typing a name that is already in the playlist takes that seat back, in any phase. The host's
-- powers follow the seat. Names are the same regardless of case.
alter table players drop constraint players_room_id_name_key;
create unique index players_room_name on players (room_id, lower(name));

create or replace function join_room(p_code text, p_name text) returns rooms
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  uid uuid := auth.uid();
  nm text := left(trim(p_name), 16);
  old uuid;
begin
  if uid is null then raise exception 'not signed in'; end if;
  select * into r from rooms where code = upper(trim(p_code));
  if not found then raise exception 'playlist not found'; end if;
  if exists (select 1 from players where room_id = r.id and user_id = uid) then return r; end if;

  select user_id into old from players where room_id = r.id and lower(name) = lower(nm);
  if found then
    update players set user_id = uid where room_id = r.id and lower(name) = lower(nm);
    update rooms set host_user_id = uid where id = r.id and host_user_id = old;
    select * into r from rooms where id = r.id;
    return r;
  end if;

  if r.phase <> 'submit' then raise exception 'guessing has already started'; end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'this playlist is full';
  end if;
  insert into players (room_id, user_id, name) values (r.id, uid, nm);
  return r;
end $$;
