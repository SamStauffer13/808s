-- Games open straight into song picking: there is no lobby phase any more.
update rooms set phase = 'submit' where phase = 'lobby';
alter table rooms drop constraint rooms_phase_check;
alter table rooms add constraint rooms_phase_check check (phase in ('submit', 'guess', 'reveal', 'done'));
alter table rooms alter column phase set default 'submit';

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
  if r.phase <> 'submit' then raise exception 'this game has already started guessing'; end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'this game is full';
  end if;
  insert into players (room_id, user_id, name) values (r.id, uid, left(trim(p_name), 16));
  return r;
end $$;

create or replace function host_set_phase(p_room uuid, p_phase text) returns void
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where id = p_room and host_user_id = auth.uid();
  if not found then raise exception 'host only'; end if;
  if not (
    (r.phase = 'guess' and p_phase = 'reveal')
    or (r.phase = 'reveal' and p_phase = 'done')
  ) then
    raise exception 'invalid phase change';
  end if;
  update rooms set phase = p_phase, reveal_index = 0 where id = p_room;
end $$;
