# 808s

A themed music guessing game. A host sets a playlist vibe, friends add songs, everyone listens and traces
each set of songs back to its source. Live at https://samstauffer.net/808s/

## Where things live

| Part | Where |
|---|---|
| Website | GitHub Pages, repo `SamStauffer13/808s`. A push to `main` builds and deploys it. |
| Backend | Supabase project `808s` (ref `yvvcqkuszlcxyvpimavs`): Postgres, realtime, anonymous auth, 4 Edge Functions |
| Spotify | Developer dashboard app `808s` (owner needs Premium). Players never log in to Spotify. |
| Frontend | Svelte 5 + Vite + TypeScript. Only `svelte` and `@supabase/supabase-js` at runtime. |

Secrets live only in Supabase (`npx supabase secrets list`): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`,
`SPOTIFY_REFRESH_TOKEN`, `HOST_PASSPHRASE`. `.env` holds the Supabase URL and publishable key, which are public.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run check      # types
```

If the build says "Cannot find native binding" on Windows: `npm install --no-save @rolldown/binding-win32-x64-msvc`.

## Change it and ship it

- **Frontend:** edit, `npm run check`, commit (`feat:` or `fix:` only), push. The site deploys in about a minute.
- **Database:** add a new file in `supabase/migrations` (never edit an applied one), then
  `npx supabase db push --linked`. Needs the `SUPABASE_DB_PASSWORD` environment variable. Do this before pushing
  a site change that depends on it.
- **Edge Functions:** `npx supabase functions deploy` after changing `supabase/functions`.
- **Supabase login:** `npx supabase login` (run it in a normal PowerShell window, not through `!`).
- **Pushing:** this machine's default GitHub login is the work account, so the repo remote is
  `git@github-808s:SamStauffer13/808s.git`. The `github-808s` alias in `~/.ssh/config` uses the deploy key
  `~/.ssh/808s_deploy`, which is added to the repo with write access.

## Runs by itself

- Nightly (04:00 UTC) pg_cron job `808s-cleanup` deletes games older than 28 days and the anonymous accounts left behind.
- `keepalive.yml` pings Supabase every 3 days so the free tier does not pause. GitHub disables scheduled
  workflows after 60 days without repo activity; run it once by hand if that happens.

## When something breaks

| Symptom | Fix |
|---|---|
| Starting the listen step fails, or playlists stop appearing | The Spotify login went stale: `node scripts/spotify-auth.mjs <spotify-client-id>` (needs `npx supabase login` first) |
| Everything errors after a quiet spell | Supabase paused the project. Restore it in the dashboard. |
| Hosts cannot start a playlist | `npx supabase secrets set HOST_PASSPHRASE="..."` |
| Deploy fails with "multiple artifacts" | Never "Re-run" a deploy. Actions, Deploy to GitHub Pages, **Run workflow**. |
| First deploy returns 404 | Repo Settings, Pages, Source must be **GitHub Actions**. |

Old Spotify playlists (`808s: <vibe>`) are not cleaned up automatically; delete them in Spotify.

## Rules that keep it fair

- Who added what is hidden by row level security. `song_owners` is readable only by its owner until the room
  reaches `reveal`. Never add a timestamp or any ordering column to `songs`, and never put `song_owners` in the
  realtime publication.
- The Spotify playlist is built only when listening starts, shuffled, so nobody can read the order of additions.
- Songs added by one person share a hidden `pack` id. Guessing, the reveal, and scoring all work per pack.
- A song counts as a duplicate by title and first artist (remasters and live versions included).

## Small things to know

- Games hold up to 20 players and 1 to 5 songs each.
- Blocked artists: `tooEasyToTrace` in `supabase/functions/_shared/spotify.ts`, with the comment in `src/Slot.svelte`.
- The tagline lives at the top of `src/Home.svelte`. Colors and spacing are tokens at the top of `src/app.css`.
- Not built yet: rejoining from a different browser or device (plan: warn in built-in browsers, a friendly
  "name taken" screen, host approval).
