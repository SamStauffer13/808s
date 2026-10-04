-- Keep games for four weeks before cleaning up.
create or replace function cleanup_old_games() returns void
language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '28 days';
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '28 days'
    and not exists (select 1 from players p where p.user_id = u.id);
$$;
