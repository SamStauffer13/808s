import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { beginGuess } from '../_shared/guess.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id } = await req.json()

    const db = admin()
    const { data: room } = await db.from('rooms').select('*').eq('id', room_id).maybeSingle()
    if (!room || room.host_user_id !== user.id) throw new HttpError(403, 'host only')
    if (room.phase !== 'submit') throw new HttpError(400, 'not in the submit phase')

    return { playlist_id: await beginGuess(db, room) }
  }),
)
