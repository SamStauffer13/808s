-- A live session is one thing: a fixed link that is kept until the host is done with it, whether it is a bar's or a
-- party's. So the "standing" flag is gone and a session is simply a room in DJ mode.

create or replace function cleanup_old_games() returns void
language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '28 days' and playlist_id is null and mode <> 'dj';
  delete from dj_tracks where status in ('played', 'vetoed') and created_at < now() - interval '1 day';
  delete from players p using rooms r
  where p.room_id = r.id and r.mode = 'dj' and p.joined_at < now() - interval '3 days' and p.user_id <> r.host_user_id;
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '28 days'
    and not exists (select 1 from players p where p.user_id = u.id);
$$;

alter table rooms drop column standing;
