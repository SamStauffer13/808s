-- Speed: the indexes the hijack's hot queries need, and a look gap the caller chooses.

-- every phone's reload and every look at the player filter tracks by room and status; votes by room
create index hijack_tracks_room_status on hijack_tracks (room_id, status);
create index hijack_vetoes_room on hijack_vetoes (room_id);

-- true when this caller gets to look at the player now: nobody has in the last p_gap_ms milliseconds
-- (a host's app and the server timer can both be due at once; the gap is short so a close look near the song change is not held back)
drop function hijack_claim_feed(uuid);
create function hijack_claim_feed(p_room uuid, p_gap_ms int) returns boolean
language plpgsql security definer set search_path = public as $$
declare ok boolean;
begin
  insert into hijack_feed (room_id) values (p_room)
  on conflict (room_id) do update set fed_at = now() where hijack_feed.fed_at < now() - make_interval(secs => p_gap_ms / 1000.0)
  returning true into ok;
  return coalesce(ok, false);
end $$;

revoke execute on function hijack_claim_feed(uuid, int) from public, anon, authenticated;
grant execute on function hijack_claim_feed(uuid, int) to service_role;
