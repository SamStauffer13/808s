import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { feed, touch } from '../_shared/hijack.ts'

// The host's open app calls this every few seconds to keep the music fed (see _shared/hijack.ts). The server timer
// (hijack-tick) does the same, so a hijack keeps going when no one has the host screen open.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { code } = await req.json()

    const db = admin()
    const { data: room } = await db.from('rooms').select('*').eq('code', String(code ?? '').trim().toUpperCase()).maybeSingle()
    if (!room) throw new HttpError(404, 'no room with that code')
    if (room.mode !== 'hijack') throw new HttpError(400, 'this is not a hijack')
    if (room.host_user_id !== user.id) throw new HttpError(403, 'only the host can run the music')

    await touch(db, room.id)
    return await feed(db, room)
  }),
)
