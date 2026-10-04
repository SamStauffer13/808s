-- Games that made a Spotify playlist are removed by the create-room function once Spotify has
-- released the playlist, so the nightly cleanup leaves them alone.
create or replace function cleanup_old_games() returns void
language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '28 days' and playlist_id is null;
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '28 days'
    and not exists (select 1 from players p where p.user_id = u.id);
$$;
