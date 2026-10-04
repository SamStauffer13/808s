-- games hold up to 20 players (the default was 8)
alter table rooms alter column max_players set default 20;
update rooms set max_players = 20;
