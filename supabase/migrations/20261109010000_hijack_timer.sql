-- The server timer for hijacks: every minute the database calls the hijack-tick Edge Function, which keeps the music
-- fed in every hijack in use (so it keeps going when no one has the host's screen open).
--
-- The two secrets it needs are kept in Vault, not in this file. Set them once per project (see the README):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<the same value as the HIJACK_TICK_KEY Edge Function secret>', 'hijack_tick_key');
-- Until both exist the job does nothing, so applying this is always safe.
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'hijack-tick',
  '* * * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/hijack-tick',
    headers := jsonb_build_object('x-tick-key', (select decrypted_secret from vault.decrypted_secrets where name = 'hijack_tick_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 65000
  )
  where exists (select 1 from vault.decrypted_secrets where name = 'project_url')
    and exists (select 1 from vault.decrypted_secrets where name = 'hijack_tick_key')
  $job$
);
