-- DJ party mode, phase 1 (feeder prototype): a room mode, what is playing now, and the suggestion list the feeder
-- reads from. Votes, RPCs and the guest screen come in later phases.

alter table rooms add column mode text not null default 'game' check (mode in ('game', 'dj'));
alter table rooms add column now_item_id text;
alter table rooms add column now_ends_at timestamptz;
-- what the host's speaker is playing, so guests see it without ever talking to Spotify (it may not be one of our suggestions)
alter table rooms add column now_title text;
alter table rooms add column now_artist text;
alter table rooms add column now_art text;
alter table rooms add column now_duration_ms int;
alter table rooms add column host_offline boolean not null default false;

-- which Spotify scopes the stored refresh token was granted, so we can ask the host to reconnect when it lacks one
alter table spotify_accounts add column scopes text not null default '';

create table dj_tracks (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  item_id text not null,
  title text not null,
  artist text not null,
  art text,
  suggested_by uuid references players on delete set null,
  status text not null default 'pending' check (status in ('pending', 'queued', 'playing', 'played', 'vetoed')),
  created_at timestamptz not null default now(),
  queued_at timestamptz
);

-- the same song cannot wait twice in one room
create unique index dj_tracks_one_live on dj_tracks (room_id, item_id) where status in ('pending', 'queued', 'playing');

alter table dj_tracks enable row level security;
create policy dj_tracks_read on dj_tracks for select to authenticated using (is_room_member(room_id));

alter publication supabase_realtime add table dj_tracks;
