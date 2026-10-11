-- The scoreboard now works the scores out from the guesses it already has, so the server function is unused.
drop function if exists room_scores(uuid);
