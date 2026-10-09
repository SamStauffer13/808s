import { admin, currentUser, handler, HttpError, origins } from '../_shared/http.ts'
import { authorizeUrl, makeState } from '../_shared/spotify.ts'

// What a host's connected Spotify account looks like to the app: who it is, a login link, or a disconnect.
// The refresh token itself never leaves the server.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { action, return_to } = await req.json()
    const db = admin()

    if (action === 'login') {
      // only our own pages may be returned to
      const to = String(return_to ?? '')
      if (!origins.some((o) => to === o || to.startsWith(`${o}/`))) throw new HttpError(400, 'bad return address')
      return { url: authorizeUrl(await makeState(user.id, to)) }
    }

    if (action === 'disconnect') {
      await db.from('spotify_accounts').delete().eq('user_id', user.id)
      return {}
    }

    const { data } = await db.from('spotify_accounts').select('display_name').eq('user_id', user.id).maybeSingle()
    return { connected: !!data, name: data?.display_name ?? null }
  }),
)
