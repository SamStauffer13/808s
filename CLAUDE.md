# 808s

After any change to screens, practice mode or results logic, run `npm run tour`, then open the screenshots in
`test-results/screens/` (at least the stages you touched) and check the layout by eye before calling it done.
The tests prove the tutorial still loads and the new pieces appear; only the screenshots show an overlap or a broken
layout. Add a check to `tests/tour.spec.ts` for each new feature. See the README for the full practice-mode rules.

Commits and PR titles use `feat:` or `fix:` only. Ship order: database (`npx supabase db push --linked`) and Edge Functions
first, then push to `main`.
