// The host's Spotify account, as the `spotify-account` Edge Function sees it. Only a source that makes a playlist
// needs one (see `playlist` in sources.ts); players never connect anything.
import { call } from './supabase'

const ask = (body: object) => call<{ connected?: boolean; name?: string; url?: string }>('spotify-account', body)

// who the host is connected as, or null when they are not
export const name = async () => (await ask({ action: 'status' })).name ?? null

// Spotify's login leaves the page: this is where to send the browser, and `returnTo` is where it comes back to
export const loginUrl = async (returnTo: string) => (await ask({ action: 'login', return_to: returnTo })).url!

export const disconnect = () => ask({ action: 'disconnect' })
