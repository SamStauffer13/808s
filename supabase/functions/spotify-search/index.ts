import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { appToken, spotify, toTrack } from '../_shared/spotify.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')

    // search is for people in a playlist, so a stray script cannot spend the Spotify quota
    const { count } = await admin().from('players').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    if (!count) throw new HttpError(403, 'join an experiment first')

    const { q } = await req.json()
    const query = String(q ?? '').trim().slice(0, 80)
    if (query.length < 2) return { tracks: [] }
    const data = await spotify(await appToken(), `/search?type=track&limit=6&q=${encodeURIComponent(query)}`)
    return { tracks: (data.tracks?.items ?? []).filter(Boolean).map(toTrack) }
  }),
)
