import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'

// A guest votes a waiting song off, or takes their vote back. The rules (a third of the room, 3 votes each) live in the database.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id, track_id, undo } = await req.json()

    const db = admin()
    if (undo) {
      const { error } = await db.rpc('dj_unveto', { p_user: user.id, p_room: room_id, p_track: track_id })
      if (error) throw new HttpError(400, error.message)
      return { status: 'pending' }
    }
    const { data, error } = await db.rpc('dj_veto', { p_user: user.id, p_room: room_id, p_track: track_id })
    if (error) throw new HttpError(400, error.message)
    return { status: data }
  }),
)
