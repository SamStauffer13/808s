-- Games and the anonymous players behind them are deleted after a week. Deleting a room
-- cascades to its players, songs, owners and guesses.
create extension if not exists pg_cron with schema pg_catalog;

create function cleanup_old_games() returns void
language sql security definer set search_path = public as $$
  delete from rooms where created_at < now() - interval '7 days';
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - interval '7 days'
    and not exists (select 1 from players p where p.user_id = u.id);
$$;

revoke execute on function cleanup_old_games() from public, anon, authenticated;

select cron.schedule('808s-cleanup', '0 4 * * *', 'select public.cleanup_old_games()');
