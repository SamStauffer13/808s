import { currentUser, handler, HttpError } from '../_shared/http.ts'
import { appToken, spotify, toTrack } from '../_shared/spotify.ts'

Deno.serve(
  handler(async (req) => {
    if (!(await currentUser(req))) throw new HttpError(401, 'sign in first')
    const { q } = await req.json()
    const query = String(q ?? '').trim().slice(0, 80)
    if (query.length < 2) return { tracks: [] }
    const data = await spotify(await appToken(), `/search?type=track&limit=6&q=${encodeURIComponent(query)}`)
    return { tracks: (data.tracks?.items ?? []).filter(Boolean).map(toTrack) }
  }),
)
