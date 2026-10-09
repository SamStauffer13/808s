-- Hosts can connect their own Spotify account so the playlist is made in their library.
-- The refresh token is a credential: only Edge Functions (service role) can touch this table.
create table spotify_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  spotify_id text not null,
  display_name text,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table spotify_accounts enable row level security;
revoke all on spotify_accounts from anon, authenticated;
