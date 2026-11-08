-- Hijack: the feature's name all the way down (it was "dj" inside), and the fixes from its review.
-- The rules that the app and the edge functions also need (how many rollbacks, how long a repeat is blocked) are no
-- longer written here too: the edge function passes them in from supabase/functions/_shared/rules.ts.

-- the names ------------------------------------------------------------------------------------------------------

alter table dj_tracks rename to hijack_tracks;
alter table dj_vetoes rename to hijack_vetoes;
alter table dj_feed rename to hijack_feed;
alter index dj_tracks_one_live rename to hijack_tracks_one_live;
alter policy dj_tracks_read on hijack_tracks rename to hijack_tracks_read;
alter policy dj_vetoes_read on hijack_vetoes rename to hijack_vetoes_read;

alter table rooms drop constraint rooms_mode_check;
update rooms set mode = 'hijack' where mode = 'dj';
alter table rooms add constraint rooms_mode_check check (mode in ('game', 'hijack'));

drop function dj_threshold(uuid);
drop function dj_claim_feed(uuid);
drop function dj_suggest(uuid, uuid, text, text, text, text);
drop function dj_veto(uuid, uuid, uuid);
drop function dj_unveto(uuid, uuid, uuid);
drop function dj_host(uuid, uuid, text, uuid);

-- ordering has its own column: moving a track to the front used to rewrite created_at, which also says how old it is
alter table hijack_tracks add column sort_at timestamptz not null default now();
update hijack_tracks set sort_at = created_at;

-- the server timer only looks after hijacks that were used recently (by a guest or the host's app)
alter table hijack_feed add column active_at timestamptz not null default now();

create function hijack_touch(p_room uuid) returns void
language sql security definer set search_path = public as $$
  insert into hijack_feed (room_id) values (p_room)
  on conflict (room_id) do update set active_at = now()
$$;

-- true when this caller gets to look at the player now (nobody has in the last 3 seconds)
create function hijack_claim_feed(p_room uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into hijack_feed (room_id) values (p_room)
  on conflict (room_id) do update set fed_at = now() where hijack_feed.fed_at < now() - interval '3 seconds'
  returning true into ok;
  return coalesce(ok, false);
end $$;

-- the rules ------------------------------------------------------------------------------------------------------

-- Joining a hijack with a name someone already has is refused. (In a game the same name takes that seat back, which is
-- what a returning player wants; on a public link it would let a stranger type the host's name and become the host.)
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
    if r.mode = 'hijack' then raise exception 'that name is taken, try another'; end if;
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

-- p_repeat_minutes: a track that played this recently cannot be pushed again; p_cooldown_minutes: nor can one that was just rolled back
create function hijack_suggest(p_user uuid, p_room uuid, p_item_id text, p_title text, p_artist text, p_art text, p_repeat_minutes int, p_cooldown_minutes int)
returns hijack_tracks
language plpgsql security definer set search_path = public as $$
declare
  r rooms;
  me uuid;
  t hijack_tracks;
begin
  select * into r from rooms where id = p_room;
  if not found or r.mode <> 'hijack' then raise exception 'this is not a hijack'; end if;
  if r.suggestions_paused then raise exception 'code freeze: the host paused new tracks'; end if;
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'join the hijack first'; end if;
  if exists (select 1 from hijack_tracks where room_id = p_room and suggested_by = me and status = 'pending') then
    raise exception 'you already have a track in staging';
  end if;
  if exists (select 1 from hijack_tracks where room_id = p_room and item_id = p_item_id and status in ('played', 'playing') and coalesce(queued_at, created_at) > now() - make_interval(mins => p_repeat_minutes)) then
    raise exception 'that one already played tonight';
  end if;
  if exists (select 1 from hijack_tracks where room_id = p_room and item_id = p_item_id and status = 'vetoed' and created_at > now() - make_interval(mins => p_cooldown_minutes)) then
    raise exception 'the room just rolled that one back, give it a while';
  end if;
  begin
    insert into hijack_tracks (room_id, item_id, title, artist, art, suggested_by)
    values (p_room, p_item_id, p_title, p_artist, p_art, me)
    returning * into t;
  exception when unique_violation then
    raise exception 'that one is already in staging';
  end;
  return t;
end $$;

-- A vote against a waiting track. p_needed is how many it takes to drop it. Returns whether it is now off the list.
-- Only waiting tracks can be voted on: once one is queued in Spotify it is locked in.
create function hijack_veto(p_user uuid, p_room uuid, p_track uuid, p_needed int) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid;
  t hijack_tracks;
  votes int;
begin
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'join the hijack first'; end if;
  select * into t from hijack_tracks where id = p_track and room_id = p_room for update;
  if not found then raise exception 'that track is gone'; end if;
  if t.status <> 'pending' then raise exception 'too late, that one is locked in'; end if;
  if t.suggested_by = me then raise exception 'you cannot roll back your own track'; end if;
  if (select count(*) from hijack_vetoes v join hijack_tracks k on k.id = v.track_id where v.player_id = me and k.room_id = p_room and k.status = 'pending') >= 3 then
    raise exception 'you have 3 rollbacks out already, take one back first';
  end if;
  insert into hijack_vetoes (track_id, player_id, room_id) values (p_track, me, p_room) on conflict do nothing;
  select count(*) into votes from hijack_vetoes where track_id = p_track;
  if votes >= p_needed then
    update hijack_tracks set status = 'vetoed' where id = p_track;
    return 'vetoed';
  end if;
  return 'pending';
end $$;

create function hijack_unveto(p_user uuid, p_room uuid, p_track uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid;
begin
  select id into me from players where room_id = p_room and user_id = p_user;
  if me is null then raise exception 'join the hijack first'; end if;
  if not exists (select 1 from hijack_tracks where id = p_track and room_id = p_room and status = 'pending') then
    raise exception 'too late, that one is locked in';
  end if;
  delete from hijack_vetoes where track_id = p_track and player_id = me;
end $$;

-- the host's say: drop a track, move one to the front, pause new ones, or keep explicit ones out
create function hijack_host(p_user uuid, p_room uuid, p_action text, p_track uuid default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from rooms where id = p_room and host_user_id = p_user and mode = 'hijack') then
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
    update hijack_tracks set status = 'vetoed' where id = p_track and room_id = p_room and status = 'pending';
  elsif p_action = 'top' then
    update hijack_tracks
    set sort_at = coalesce((select min(sort_at) from hijack_tracks where room_id = p_room and status = 'pending'), now()) - interval '1 second'
    where id = p_track and room_id = p_room and status = 'pending';
  else
    raise exception 'unknown action';
  end if;
end $$;

-- The same Spotify account getting its hijack back after losing its browser: one step, so it cannot half happen.
-- (The caller has already checked it is the same Spotify account.)
create function hijack_take_over(p_room uuid, p_new uuid) returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where id = p_room and mode = 'hijack' for update;
  if not found then raise exception 'not a hijack'; end if;
  delete from players where room_id = p_room and user_id = p_new; -- they may have joined as a guest meanwhile
  update players set user_id = p_new where room_id = p_room and user_id = r.host_user_id;
  update rooms set host_user_id = p_new where id = p_room returning * into r;
  return r;
end $$;

revoke execute on function hijack_touch(uuid) from public, anon, authenticated;
revoke execute on function hijack_claim_feed(uuid) from public, anon, authenticated;
revoke execute on function hijack_suggest(uuid, uuid, text, text, text, text, int, int) from public, anon, authenticated;
revoke execute on function hijack_veto(uuid, uuid, uuid, int) from public, anon, authenticated;
revoke execute on function hijack_unveto(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function hijack_host(uuid, uuid, text, uuid) from public, anon, authenticated;
revoke execute on function hijack_take_over(uuid, uuid) from public, anon, authenticated;
grant execute on function hijack_touch(uuid) to service_role;
grant execute on function hijack_claim_feed(uuid) to service_role;
grant execute on function hijack_suggest(uuid, uuid, text, text, text, text, int, int) to service_role;
grant execute on function hijack_veto(uuid, uuid, uuid, int) to service_role;
grant execute on function hijack_unveto(uuid, uuid, uuid) to service_role;
grant execute on function hijack_host(uuid, uuid, text, uuid) to service_role;
grant execute on function hijack_take_over(uuid, uuid) to service_role;

-- nightly cleanup -----------------------------------------------------------------------------------------------

-- A hijack is kept until it has gone unused for 90 days. Its finished tracks go after a day (waiting ones after two), and its
-- guests (not the host) after three days, so their names are free again.
create or replace function cleanup_old_games() returns void
language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '28 days' and playlist_id is null and mode <> 'hijack';
  delete from rooms r using hijack_feed f where f.room_id = r.id and r.mode = 'hijack' and f.active_at < now() - interval '90 days';
  delete from hijack_tracks where (status in ('played', 'vetoed') and created_at < now() - interval '1 day') or created_at < now() - interval '2 days';
  delete from players p using rooms r
  where p.room_id = r.id and r.mode = 'hijack' and p.joined_at < now() - interval '3 days' and p.user_id <> r.host_user_id;
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '28 days'
    and not exists (select 1 from players p where p.user_id = u.id);
$$;
