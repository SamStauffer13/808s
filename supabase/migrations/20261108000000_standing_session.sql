-- A standing session: a jukebox with a fixed link (for a bar's NFC tags and QR codes) that never expires.

alter table rooms add column standing boolean not null default false;
alter table rooms add column block_explicit boolean not null default false;

-- When the server timer last looked at a room's player, so overlapping runs (and the host's open app) do not all
-- call Spotify at once. It lives here, not on rooms, because a write to rooms is a realtime event for every phone.
create table dj_feed (
  room_id uuid primary key references rooms on delete cascade,
  fed_at timestamptz not null default now()
);
alter table dj_feed enable row level security; -- no policies: only the service role reads or writes it

-- true when this caller gets to look at the player now (nobody has in the last 3 seconds)
create function dj_claim_feed(p_room uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into dj_feed (room_id) values (p_room)
  on conflict (room_id) do update set fed_at = now() where dj_feed.fed_at < now() - interval '3 seconds'
  returning true into ok;
  return coalesce(ok, false);
end $$;

revoke execute on function dj_claim_feed(uuid) from public, anon, authenticated;
grant execute on function dj_claim_feed(uuid) to service_role;

-- Joining a DJ session with a name someone already has is refused. (In a game, the same name takes that seat back, which
-- is what a returning player wants. On a public link it would let a stranger type the host's name and become the host.)
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
  if not found then raise exception 'experiment not found'; end if;
  if exists (select 1 from players where room_id = r.id and user_id = uid) then return r; end if;

  select user_id into old from players where room_id = r.id and lower(name) = lower(nm);
  if found then
    if r.mode = 'dj' then raise exception 'that name is taken, try another'; end if;
    update players set user_id = uid where room_id = r.id and lower(name) = lower(nm);
    update rooms set host_user_id = uid where id = r.id and host_user_id = old;
    select * into r from rooms where id = r.id;
    return r;
  end if;

  if r.phase <> 'submit' then raise exception 'guessing has already started'; end if;
  if (select count(*) from players where room_id = r.id) >= r.max_players then
    raise exception 'this experiment is full';
  end if;
  insert into players (room_id, user_id, name) values (r.id, uid, nm);
  return r;
end $$;

-- a track that played a while ago can be pushed again (this used to block a repeat for good)
create or replace function dj_suggest(p_user uuid, p_room uuid, p_item_id text, p_title text, p_artist text, p_art text)
returns dj_tracks
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  me uuid;
  t dj_tracks;
begin
  select * into r from rooms where id = p_room;
  if not found or r.mode <> 'dj' then raise exception 'this is not a live session'; end if;
  if r.suggestions_paused then raise exception 'code freeze: the host paused new tracks'; end if;
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'attach to the session first'; end if;
  if exists (select 1 from dj_tracks where room_id = p_room and suggested_by = me and status = 'pending') then
    raise exception 'you already have a track in staging';
  end if;
  if exists (select 1 from dj_tracks where room_id = p_room and item_id = p_item_id and status in ('played', 'playing') and created_at > now() - interval '3 hours') then
    raise exception 'that one already played tonight';
  end if;
  begin
    insert into dj_tracks (room_id, item_id, title, artist, art, suggested_by)
    values (p_room, p_item_id, p_title, p_artist, p_art, me)
    returning * into t;
  exception when unique_violation then
    raise exception 'that one is already in line';
  end;
  return t;
end $$;

-- the host's settings: the same dj_host as before, plus blocking explicit tracks
create or replace function dj_host(p_user uuid, p_room uuid, p_action text, p_track uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = p_room and host_user_id = p_user and mode = 'dj') then
    raise exception 'only the host can do that';
  end if;
  if p_action = 'pause' then
    update rooms set suggestions_paused = true where id = p_room;
  elsif p_action = 'resume' then
    update rooms set suggestions_paused = false where id = p_room;
  elsif p_action = 'block_explicit' then
    update rooms set block_explicit = true where id = p_room;
  elsif p_action = 'allow_explicit' then
    update rooms set block_explicit = false where id = p_room;
  elsif p_action = 'remove' then
    update dj_tracks set status = 'vetoed' where id = p_track and room_id = p_room and status = 'pending';
  elsif p_action = 'top' then
    update dj_tracks
    set created_at = coalesce((select min(created_at) from dj_tracks where room_id = p_room and status = 'pending'), now()) - interval '1 second'
    where id = p_track and room_id = p_room and status = 'pending';
  else
    raise exception 'unknown action';
  end if;
end $$;

-- nightly: a standing session is kept; its finished tracks go after a day, and guests (but not the host) after three days
-- so their names are free again
create or replace function cleanup_old_games() returns void
language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '28 days' and playlist_id is null and not standing;
  delete from dj_tracks where status in ('played', 'vetoed') and created_at < now() - interval '1 day';
  delete from players p using rooms r
  where p.room_id = r.id and r.standing and p.joined_at < now() - interval '3 days' and p.user_id <> r.host_user_id;
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '28 days'
    and not exists (select 1 from players p where p.user_id = u.id);
$$;
