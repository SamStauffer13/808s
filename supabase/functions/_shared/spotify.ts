import { admin, HttpError } from './http.ts'
import type { Item, Provider } from './providers.ts'

const API = 'https://api.spotify.com/v1'

// some artists are far too easy to trace back to whoever added them
const tooEasyToTrace = /taylor swift/i

let appCache: { token: string; expires: number } | null = null

async function tokenRequest(body: Record<string, string>) {
  const id = Deno.env.get('SPOTIFY_CLIENT_ID')!
  const secret = Deno.env.get('SPOTIFY_CLIENT_SECRET')!
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
  })
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`)
  return await res.json()
}

// search and track lookups need no login, so players never touch Spotify
export async function appToken() {
  if (appCache && appCache.expires > Date.now() + 30_000) return appCache.token
  const j = await tokenRequest({ grant_type: 'client_credentials' })
  appCache = { token: j.access_token, expires: Date.now() + j.expires_in * 1000 }
  return appCache.token
}

// A host's own account: their refresh token is kept by spotify-callback, and Spotify may rotate it.
// The access token is kept while the worker stays warm, and the stored login is only re-read from the database once a
// minute (not on every look at the player), so a new login (a reconnect, new permissions) is picked up within a minute.
const userCache = new Map<string, { stamp: string; token: string; scopes: string; expires: number; checked: number }>()
const RECHECK_MS = 60_000

// a login from before this permission existed has to be made again
function allowed(scopes: string, needs?: string) {
  if (needs && !scopes.includes(needs)) throw new HttpError(400, 'reconnect Spotify so the hijack can control your music')
}

export async function userToken(userId: string, needs?: string) {
  const known = userCache.get(userId)
  if (known && Date.now() - known.checked < RECHECK_MS && known.expires > Date.now() + 30_000) {
    allowed(known.scopes, needs)
    return known.token
  }

  const db = admin()
  const { data } = await db.from('spotify_accounts').select('refresh_token, updated_at, scopes').eq('user_id', userId).maybeSingle()
  if (!data) throw new HttpError(400, 'connect your Spotify account first')
  allowed(data.scopes, needs)
  const stamp = `${data.refresh_token}|${data.updated_at}`
  if (known?.stamp === stamp && known.expires > Date.now() + 30_000) {
    userCache.set(userId, { ...known, scopes: data.scopes, checked: Date.now() })
    return known.token
  }
  let j
  try {
    j = await tokenRequest({ grant_type: 'refresh_token', refresh_token: data.refresh_token })
  } catch {
    throw new HttpError(400, 'Spotify access expired: connect your account again')
  }
  let rotated = { refresh_token: data.refresh_token, updated_at: data.updated_at }
  if (j.refresh_token) {
    rotated = { refresh_token: j.refresh_token, updated_at: new Date().toISOString() }
    await db.from('spotify_accounts').update(rotated).eq('user_id', userId)
  }
  userCache.set(userId, { stamp: `${rotated.refresh_token}|${rotated.updated_at}`, token: j.access_token, scopes: data.scopes, expires: Date.now() + j.expires_in * 1000, checked: Date.now() })
  return j.access_token as string
}
// Spotify bounces the browser back to our callback with this state, so it is signed: the callback learns
// who started the login, and nobody can attach their Spotify account to someone else.
async function sign(payload: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(Deno.env.get('SPOTIFY_CLIENT_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return btoa(String.fromCharCode(...new Uint8Array(mac))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
}

export async function makeState(userId: string, returnTo: string) {
  const payload = btoa(JSON.stringify({ u: userId, r: returnTo, e: Date.now() + 10 * 60_000 }))
  return `${payload}.${await sign(payload)}`
}

export async function readState(state: string): Promise<{ userId: string; returnTo: string } | null> {
  const [payload, mac] = state.split('.')
  if (!payload || !mac || (await sign(payload)) !== mac) return null
  const { u, r, e } = JSON.parse(atob(payload))
  return e > Date.now() ? { userId: u, returnTo: r } : null
}

// make the playlist (game rooms), and read and steer the host's player (DJ rooms)
export const scopes = 'playlist-modify-public user-modify-playback-state user-read-playback-state'

const callbackUrl = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/spotify-callback`

export async function exchangeCode(code: string) {
  return await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: callbackUrl() })
}

export function authorizeUrl(state: string) {
  return (
    'https://accounts.spotify.com/authorize?' +
    new URLSearchParams({
      response_type: 'code',
      client_id: Deno.env.get('SPOTIFY_CLIENT_ID')!,
      scope: scopes,
      // a fresh consent screen, so an existing host gets a token that carries the new playback scopes
      show_dialog: 'true',
      redirect_uri: callbackUrl(),
      state,
    })
  )
}

// still an Error with the same message as before; the status and Retry-After are there for callers that need them
export class SpotifyError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) {
    super(message)
  }
}

export async function spotify(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) {
    const wait = Number(res.headers.get('Retry-After'))
    throw new SpotifyError(`Spotify ${init.method ?? 'GET'} ${path.split('?')[0]} failed (${res.status})`, res.status, wait > 0 ? wait : undefined)
  }
  const body = await res.text()
  return body ? JSON.parse(body) : null
}

// What the host's player is doing. Null when nothing is playing (Spotify answers 204 with no body).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Playing = { is_playing: boolean; progress_ms: number; item: ({ id: string; duration_ms: number } & Record<string, any>) | null }
export async function getPlayback(token: string): Promise<Playing | null> {
  return await spotify(token, '/me/player')
}

// Skips to the next track: the locked-in one if there is one, otherwise whatever the host's playlist has next.
export async function skipTrack(token: string) {
  await spotify(token, '/me/player/next', { method: 'POST' })
}

// Adds to the END of the host's queue. Spotify has no way to remove or reorder what is already there.
export async function queueTrack(token: string, id: string) {
  await spotify(token, `/me/player/queue?uri=${encodeURIComponent(`spotify:track:${id}`)}`, { method: 'POST' })
}

export function toItem(t: any): Item {
  const images = t.album?.images ?? []
  const artist = (t.artists ?? []).map((a: any) => a.name).join(', ')
  return {
    id: t.id,
    title: t.name,
    artist,
    art: (images[1] ?? images[0])?.url ?? null,
    blocked: tooEasyToTrace.test(artist),
    explicit: !!t.explicit,
    durationMs: (t.duration_ms as number | undefined) ?? null,
  }
}

// Spotify keeps genres on the artist, not the track. This is best effort: no genres is fine, so a failed lookup is not an error.
export async function genresOf(token: string, rawTrack: any): Promise<string[]> {
  const ids = (rawTrack.artists ?? []).map((a: any) => a.id).filter(Boolean).slice(0, 5)
  if (!ids.length) return []
  try {
    const { artists } = await spotify(token, `/artists?ids=${ids.join(',')}`)
    return [...new Set<string>((artists ?? []).flatMap((a: any) => a?.genres ?? []))]
  } catch {
    return []
  }
}

// The Spotify source. Search and lookups use our app token (players never log in); the host's own account is only
// for making the playlist.
export const isTrackId = (id: string) => /^[A-Za-z0-9]{22}$/.test(id)

// One track by id, with no genres (they are a second Spotify call, and only the guessing game uses them)
export async function lookupTrack(id: string) {
  return toItem(await spotify(await appToken(), `/tracks/${id}`))
}

export const spotifyProvider: Provider = {
  needsHostAccount: true,
  maxPicks: 5,
  isId: isTrackId,

  async search(q) {
    const data = await spotify(await appToken(), `/search?type=track&limit=6&q=${encodeURIComponent(q)}`)
    return (data.tracks?.items ?? []).filter(Boolean).map(toItem)
  },

  async lookup(id) {
    const token = await appToken()
    const raw = await spotify(token, `/tracks/${id}`)
    return { ...toItem(raw), genres: await genresOf(token, raw) }
  },

  // the playlist goes into the host's account, or into whoever started the experiment when the host never connected one
  async publish(db, room, ids, askedBy) {
    const { data: host } = await db.from('spotify_accounts').select('user_id').eq('user_id', room.host_user_id).maybeSingle()
    const token = await userToken(host ? room.host_user_id : askedBy)
    const playlist = await spotify(token, '/me/playlists', {
      method: 'POST',
      body: JSON.stringify({
        name: (room.title ?? `808s: ${room.theme}`).slice(0, 100),
        description: `${room.theme}. A social experiment: who added what? Guess in the 808s app.`.slice(0, 300),
        public: true,
      }),
    })
    for (let i = 0; i < ids.length; i += 100) {
      await spotify(token, `/playlists/${playlist.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ uris: ids.slice(i, i + 100).map((id) => `spotify:track:${id}`) }),
      })
    }
    return { id: playlist.id, url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}` }
  },
}
