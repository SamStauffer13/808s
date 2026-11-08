-- The hijack's experience: how long each track is (so a guest can be told when theirs will play), whether the server
-- timer is running (so the host knows if it is safe to lock their phone), and what the invite page can show a stranger.

alter table hijack_tracks add column duration_ms int;
alter table hijack_feed add column ticked_at timestamptz; -- when the server timer last looked after this hijack

-- hijack_suggest now also takes the track's length
drop function hijack_suggest(uuid, uuid, text, text, text, text, int, int);
create function hijack_suggest(p_user uuid, p_room uuid, p_item_id text, p_title text, p_artist text, p_art text, p_duration_ms int, p_repeat_minutes int, p_cooldown_minutes int)
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
    insert into hijack_tracks (room_id, item_id, title, artist, art, duration_ms, suggested_by)
    values (p_room, p_item_id, p_title, p_artist, p_art, p_duration_ms, me)
    returning * into t;
  exception when unique_violation then
    raise exception 'that one is already in staging';
  end;
  return t;
end $$;

revoke execute on function hijack_suggest(uuid, uuid, text, text, text, text, int, int, int) from public, anon, authenticated;
grant execute on function hijack_suggest(uuid, uuid, text, text, text, text, int, int, int) to service_role;

-- the invite page also shows what is playing right now, so a stranger can see it is live before joining
drop function room_preview(text);
create function room_preview(p_code text) returns table (theme text, phase text, source text, mode text, now_title text, now_artist text)
language sql stable security definer set search_path = public as $$
  select theme, phase, source, mode, now_title, now_artist from rooms where code = upper(trim(p_code))
$$;
