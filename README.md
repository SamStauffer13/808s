# 808s

A themed music guessing game. A host sets a playlist vibe, friends add songs, everyone listens and cracks
each set of songs: who added it? Live at https://samstauffer.net/808s/

## Where things live

| Part | Where |
|---|---|
| Website | GitHub Pages, repo `SamStauffer13/808s`. A push to `main` builds and deploys it. |
| Backend | Supabase project `808s` (ref `yvvcqkuszlcxyvpimavs`): Postgres, realtime, anonymous auth, Edge Functions |
| Spotify | Developer dashboard app `808s`. Only the host logs in to Spotify (their playlist is made in their own account); players never do. |
| Frontend | Svelte 5 + Vite + TypeScript. Only `svelte` and `@supabase/supabase-js` at runtime. |

Secrets live only in Supabase (`npx supabase secrets list`): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `ADMIN_KEY`,
(`SPOTIFY_REFRESH_TOKEN` is no longer used and can be removed.) `.env` holds the Supabase URL and publishable key, which are public.

## Run it

```
npm install
npm run dev        # http://localhost:5173
npm run check      # types
```

## Demo: play a whole game with fake players

`/808s/demo` (or `/demo` in dev) is the practice round for new players, linked from Home and the invite page. It runs the
real screens against a fake 8-player game and a fake server (`src/demo/`), so you can see every stage without players.
The bar at the top explains each step in a caption, steps with BACK and NEXT STEP, and jumps between stages: Home,
Invite, Submit, Guess, Reveal, Results. Search, adding songs and guessing all work, and the last guess opens the reveal like the real game.
A stage can also be opened directly, for example `/808s/#/DEMO-RESULTS`.

Keep it in step when the game data, the screens or the server calls they make change: `npm run check` catches a
changed type, a new call needs a handler in `src/demo/backend.ts`, and the demo fails to load if a stamp in
`src/lib/stamps.ts` is never earned by a demo set.

The demo checks the screens, not the server: a broken Edge Function or permission rule will not show up in it. Before
a big release, play one real game with two browsers (normal and incognito) as two players, one connected to Spotify as
host: create a room, join from the invite link, add songs in both, begin the experiment, guess in both, and check the
reveal opens by itself and the results and playlist look right. Also try `FORCE NEXT PHASE` (see below) on a
throwaway room.

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

## Admin override: moving a stuck game along

When the host is away, the owner can move any room to its next phase. In the room (or on the invite page, or Home
with a room code), tap the small 808s logo five times, enter the key once (it is kept on that device only), then press
`FORCE NEXT PHASE`. The `admin-advance` Edge Function checks the key against the `ADMIN_KEY` secret every time:
`npx supabase secrets set ADMIN_KEY=...`. Change it before a wide release.

Submit to guess builds the playlist in the host's Spotify; if the host never connected one, it uses the admin's, and
the panel offers a `CONNECT SPOTIFY` button that returns to the room and carries on. Guess to reveal needs nothing.

## How a game flows

In the app the guessing round is called "the Experiment", and the host begins it.

1. **Create:** the host connects Spotify and sets a vibe.
2. **Submit:** friends join by link and add songs. Who added what stays hidden.
3. **Experiment:** the host presses `BEGIN THE EXPERIMENT`, which builds a shuffled playlist in their Spotify.
4. **Guess:** each player matches every other player's songs to whoever added them.
5. **Reveal:** it opens by itself when the last guess is in (only the admin override can open it early). After that each player steps
   through it at their own pace, any time; their place is saved on their device.

Each revealed set can get a stamp (`DOXXED`, `UNCRACKABLE`, `PROXIED`). The rules are one short table in `src/lib/stamps.ts`.

## Runs by itself

- Nightly (04:00 UTC) pg_cron job `808s-cleanup` deletes games older than 28 days that never made a playlist, and
  the anonymous accounts left behind.
- `keepalive.yml` pings Supabase every 3 days so the free tier does not pause. GitHub disables scheduled
  workflows after 60 days without repo activity; run it once by hand if that happens.

## When something breaks

| Symptom | Fix |
|---|---|
| Starting the listen step fails | The host's Spotify connection went stale: they press `NOT YOU? DISCONNECT`, then connect again |
| Everything errors after a quiet spell | Supabase paused the project. Restore it in the dashboard. |
| Host login fails with "INVALID_CLIENT" or a 403 | Their Spotify email is not under User management in the Spotify app (development mode allows only 5 people, and extended quota needs a business with 250k monthly users) |
| Deploy fails with "multiple artifacts" | Never "Re-run" a deploy. Actions, Deploy to GitHub Pages, **Run workflow**. |
| First deploy returns 404 | Repo Settings, Pages, Source must be **GitHub Actions**. |

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
- The vibe tells people what to submit and becomes the Spotify playlist's description. The optional playlist name
  (`rooms.title`) is the Spotify playlist's name; with none, it is `808s: <vibe>`.
- Notices show next to the control that caused them: `attempt(scope, fn)` stores the error under a scope and a
  `<Notice scope="...">` placed beside the button displays it. There is no global toast.
- Rejoin: typing a name that is already in the playlist takes that seat, in any phase, host included. It trusts
  the crew, so anyone with the invite link could take a friend's seat. If that ever matters, require host approval.

- Host login: the home screen's `CONNECT SPOTIFY` sends the host through Spotify's login (`spotify-account` builds the
  link, `spotify-callback` receives the result and stores their refresh token in `spotify_accounts`, which only Edge Functions can read).
  The Spotify app's redirect URI must be exactly `https://yvvcqkuszlcxyvpimavs.supabase.co/functions/v1/spotify-callback`.
  Only the `playlist-modify-public` permission is requested. Playlists belong to their hosts; the app never deletes them.

## Ideas not built

- Optional deadline line on the add-songs screen (informational, e.g. "submissions close Friday").
- Sound effects, a guess countdown, glitch transitions between screens.
