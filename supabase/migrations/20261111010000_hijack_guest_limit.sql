-- hijacks allow up to 200 guests; the old limit of 20 was for guessing games
alter table rooms drop constraint if exists rooms_max_players_check;
alter table rooms add constraint rooms_max_players_check check (max_players between 2 and 200);
