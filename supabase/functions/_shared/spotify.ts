const API = 'https://api.spotify.com/v1'

export type Track = { id: string; title: string; artist: string; art: string | null }

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

// playlist writes act as the host account
export async function hostToken() {
  const j = await tokenRequest({ grant_type: 'refresh_token', refresh_token: Deno.env.get('SPOTIFY_REFRESH_TOKEN')! })
  return j.access_token as string
}

export async function spotify(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  })
  if (!res.ok) throw new Error(`Spotify ${init.method ?? 'GET'} ${path.split('?')[0]} failed (${res.status})`)
  return res.status === 204 ? null : await res.json()
}

export function toTrack(t: any): Track {
  const images = t.album?.images ?? []
  return {
    id: t.id,
    title: t.name,
    artist: (t.artists ?? []).map((a: any) => a.name).join(', '),
    art: (images[1] ?? images[0])?.url ?? null,
  }
}
