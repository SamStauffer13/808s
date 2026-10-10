-- Nobody can end the guessing early any more: the reveal opens by itself when everyone has guessed,
-- and only the owner's admin override (the admin-advance Edge Function) can move a stuck game on.
drop function if exists host_set_phase(uuid, text);
