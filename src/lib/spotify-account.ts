// The host's Spotify account, as the `spotify-account` Edge Function sees it. Only a source that makes a playlist
// needs one (see `playlist` in sources.ts); players never connect anything.
import { notify } from './game.svelte'
import { call } from './supabase'

const ask = (body: object) => call<{ connected?: boolean; name?: string; url?: string; canHijack?: boolean }>('spotify-account', body)

// who the host is connected as (null when they are not), and whether that login can steer their player (a hijack needs that)
export const status = async () => {
  const s = await ask({ action: 'status' })
  return { name: s.name ?? null, canHijack: !!s.canHijack }
}

// Spotify's login leaves the page: this is where to send the browser, and `returnTo` is where it comes back to
export const loginUrl = async (returnTo: string) => (await ask({ action: 'login', return_to: returnTo })).url!

export const disconnect = () => ask({ action: 'disconnect' })

// Spotify's login sends the browser back with ?spotify=<result>. Tidies the address and says what went wrong, beside
// the form that asked for the login (`scope`); a good login says nothing.
export function reportLogin(scope: string) {
  const params = new URLSearchParams(location.search)
  const result = params.get('spotify')
  if (!result) return
  const why = params.get('why')
  history.replaceState(null, '', location.pathname + location.hash)
  if (result === 'notallowed') notify(scope, 'This Spotify account is not on the guest list yet. Ask the host of 808s to add your Spotify email, then try again.')
  else if (result !== 'connected') notify(scope, (result === 'denied' ? 'Spotify login was cancelled' : 'Spotify login failed, try again') + (why ? ` (${why})` : ''))
}
