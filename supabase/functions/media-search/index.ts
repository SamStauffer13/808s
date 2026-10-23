import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { providerForRoom } from '../_shared/providers.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id, q } = await req.json()

    // search is for people in an experiment, so a stray script cannot spend the Spotify or YouTube quota
    const db = admin()
    const { data: player } = await db.from('players').select('id').eq('room_id', room_id).eq('user_id', user.id).maybeSingle()
    if (!player) throw new HttpError(403, 'join an experiment first')

    const query = String(q ?? '').trim().slice(0, 80)
    if (query.length < 2) return { items: [] }
    return { items: await (await providerForRoom(db, room_id)).search(query) }
  }),
)
