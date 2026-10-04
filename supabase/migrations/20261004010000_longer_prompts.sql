-- The theme is a free-text prompt now ("drop songs that remind you of the ocean").
alter table rooms drop constraint rooms_theme_check;
alter table rooms add constraint rooms_theme_check check (char_length(theme) between 1 and 140);

create or replace function create_room(p_user uuid, p_name text, p_theme text, p_songs int, p_max int)
returns rooms
language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  insert into rooms (code, host_user_id, theme, songs_per_player, max_players)
  values (gen_room_code(), p_user, left(trim(p_theme), 140), p_songs, p_max)
  returning * into r;
  insert into players (room_id, user_id, name) values (r.id, p_user, left(trim(p_name), 16));
  return r;
end $$;
