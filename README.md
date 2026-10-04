# 808s

A themed music guessing game. A host sets a prompt, friends add songs to a shared Spotify playlist, and everyone
guesses who added what. Live at https://samstauffer.net/808s/

**Stack:** Svelte 5 + Vite + TypeScript on GitHub Pages, Supabase (Postgres, realtime, anonymous auth, Edge Functions).
Players never log in to Spotify; the playlist is created on the host account by an Edge Function.

## Develop

```
npm install
npm run dev
```

`.env` holds the Supabase URL and publishable key, both public by design. The anonymity rules live in
`supabase/migrations` as row level security; nothing client-side hides who added what.

## Supabase

```
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase functions deploy
node scripts/spotify-auth.mjs <spotify-client-id>   # one-time host Spotify login, stores secrets in Supabase
npx supabase secrets set HOST_PASSPHRASE="..."      # the phrase hosts type to start a game
```

`node --experimental-websocket --env-file=.env scripts/e2e.mjs` plays a full round against the backend
(needs `E2E_PASSPHRASE`).
