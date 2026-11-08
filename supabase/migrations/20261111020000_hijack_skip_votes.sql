-- guests can vote to skip the song that is playing; enough votes (the same count as a rollback) skips it
create table hijack_skips (
  room_id uuid not null references rooms(id) on delete cascade,
  item_id text not null,
  user_id uuid not null,
  primary key (room_id, item_id, user_id)
);
alter table hijack_skips enable row level security; -- only the Edge Function touches it
