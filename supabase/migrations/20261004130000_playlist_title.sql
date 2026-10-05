-- The playlist's Spotify name is separate from the vibe that tells people what to submit.
-- With no title the playlist is named after the vibe.
alter table rooms add column title text check (char_length(title) <= 100);

drop function create_room(uuid, text, text, int, int);
create function create_room(p_user uuid, p_name text, p_theme text, p_songs int, p_max int, p_title text default null)
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  insert into rooms (code, host_user_id, theme, title, songs_per_player, max_players)
  values (gen_room_code(), p_user, left(trim(p_theme), 140), nullif(left(trim(coalesce(p_title, '')), 100), ''), p_songs, p_max)
  returning * into r;
  insert into players (room_id, user_id, name) values (r.id, p_user, left(trim(p_name), 16));
  return r;
end $$;

revoke execute on function create_room(uuid, text, text, int, int, text) from public, anon, authenticated;
grant execute on function create_room(uuid, text, text, int, int, text) to service_role;
