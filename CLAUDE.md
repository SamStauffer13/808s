
A Stop hook (`.claude/hooks/tour-gate.mjs`, registered in `.claude/settings.json`) runs the tour automatically when `src/` or
`tests/` changed since the last green run. If it fails, fix it before finishing; if it passes it asks for a look at the screenshots.
ll loads and the new pieces appear; only the screenshots show an overlap or a broken
layout. Add a check to `tests/tour.spec.ts` for each new feature. See the README for the full practice-mode rules.

Commits and PR titles use `feat:` or `fix:` only. Ship order: database (`npx supabase db push --linked`) and Edge Functions
first, then push to `main`.
