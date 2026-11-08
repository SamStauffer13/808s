import { admin, currentUser, handler, HttpError, uuid } from '../_shared/http.ts'
import { touch } from '../_shared/hijack.ts'
import { threshold } from '../_shared/rules.ts'

// A guest rolls a waiting track back, or takes their vote back. How many votes it takes comes from rules.ts, the same
// rule the app shows; the rest (3 votes each, not your own track) lives in the database.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const body = await req.json()
    const room_id = uuid(body.room_id)
    const track_id = uuid(body.track_id)

    const db = admin()
    await touch(db, room_id)
    if (body.undo) {
      const { error } = await db.rpc('hijack_unveto', { p_user: user.id, p_room: room_id, p_track: track_id })
      if (error) throw new HttpError(400, error.message)
      return { status: 'pending' }
    }
    const { count } = await db.from('players').select('id', { count: 'exact', head: true }).eq('room_id', room_id)
    const { data, error } = await db.rpc('hijack_veto', { p_user: user.id, p_room: room_id, p_track: track_id, p_needed: threshold(count ?? 1) })
    if (error) throw new HttpError(400, error.message)
    return { status: data }
  }),
)
