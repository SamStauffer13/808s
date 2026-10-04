// One-time helper: logs in as the host Spotify account and stores the long-lived refresh
// token in Supabase secrets. The client secret is typed here (hidden) and never printed.
//
//   node scripts/spotify-auth.mjs <spotify-client-id>
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import readline from 'node:readline'
import { exec, spawnSync } from 'node:child_process'

const clientId = process.argv[2] ?? process.env.SPOTIFY_CLIENT_ID
if (!clientId) {
  console.error('usage: node scripts/spotify-auth.mjs <spotify-client-id>')
  process.exit(1)
}
const redirect = 'http://127.0.0.1:8888/callback'
const scope = 'playlist-modify-public playlist-modify-private'

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer.trim())
    })
    rl._writeToOutput = (s) => {
      if (s.includes('\n') || s.includes('\r')) rl.output.write(s)
    }
  })
}

const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || (await askHidden('Spotify Client Secret (hidden): '))
if (!clientSecret) process.exit(1)

const state = crypto.randomBytes(12).toString('hex')
const authUrl =
  'https://accounts.spotify.com/authorize?' +
  new URLSearchParams({ response_type: 'code', client_id: clientId, scope, redirect_uri: redirect, state })

const code = await new Promise((resolve, reject) => {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1:8888')
    if (url.pathname !== '/callback') return res.end()
    const ok = url.searchParams.get('state') === state && url.searchParams.get('code')
    res.end(ok ? 'All set. You can close this tab and return to the terminal.' : 'Login failed. Check the terminal.')
    server.close()
    ok ? resolve(url.searchParams.get('code')) : reject(new Error(url.searchParams.get('error') ?? 'state mismatch'))
  })
  server.listen(8888, '127.0.0.1', () => {
    console.log('Opening Spotify login in your browser...')
    console.log('If it does not open, visit:\n' + authUrl + '\n')
    exec(`start "" "${authUrl}"`)
  })
})

const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
  method: 'POST',
  headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirect }),
})
if (!tokenRes.ok) {
  console.error('Token exchange failed:', tokenRes.status, await tokenRes.text())
  process.exit(1)
}
const tokens = await tokenRes.json()

const me = await (await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${tokens.access_token}` } })).json()
console.log(`Logged in as ${me.display_name ?? me.id} (${me.product ?? 'unknown plan'})`)

const envFile = path.join(os.tmpdir(), `808s-spotify-${crypto.randomBytes(4).toString('hex')}.env`)
fs.writeFileSync(
  envFile,
  `SPOTIFY_CLIENT_ID=${clientId}\nSPOTIFY_CLIENT_SECRET=${clientSecret}\nSPOTIFY_REFRESH_TOKEN=${tokens.refresh_token}\n`,
)
try {
  const run = spawnSync('npx', ['supabase', 'secrets', 'set', '--env-file', envFile], { stdio: 'inherit', shell: true })
  if (run.status !== 0) process.exit(run.status ?? 1)
} finally {
  fs.rmSync(envFile, { force: true })
}
console.log('Done. Spotify secrets are stored in Supabase.')
