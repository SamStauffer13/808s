import { admin, currentUser, handler, HttpError, uuid } from '../_shared/http.ts'
import { steer, touch } from '../_shared/hijack.ts'

// The host's controls: remove a track, move one to the front, freeze or reopen new tracks, allow or block explicit ones,
// and cut in: skip the song that is playing, or play a waiting track right now.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const body = await req.json()
    const room_id = uuid(body.room_id)

    const db = admin()
    if (body.action === 'skip' || body.action === 'play_now') {
      await steer(db, user.id, room_id, body.action, body.track_id ? uuid(body.track_id) : undefined)
      await touch(db, room_id)
      return { ok: true }
    }
    const { error } = await db.rpc('hijack_host', { p_user: user.id, p_room: room_id, p_action: String(body.action), p_track: body.track_id ? uuid(body.track_id) : null })
    if (error) throw new HttpError(400, error.message)
    await touch(db, room_id)
    return { ok: true }
  }),
)
