import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'

// The host's controls: remove a song, move one to the front, pause or resume new suggestions.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id, action, track_id } = await req.json()

    const { error } = await admin().rpc('dj_host', { p_user: user.id, p_room: room_id, p_action: action, p_track: track_id ?? null })
    if (error) throw new HttpError(400, error.message)
    return { ok: true }
  }),
)
