import { admin, currentUser, handler, HttpError, uuid } from '../_shared/http.ts'
import { steer, touch } from '../_shared/hijack.ts'
import { threshold } from '../_shared/rules.ts'

// A guest votes to skip the song that is playing. When as many guests have voted as it takes to roll a track back
// (rules.ts), the song is skipped. Votes belong to one song, so they never carry over to the next.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const room_id = uuid((await req.json()).room_id)

    const db = admin()
    const [{ data: room }, { data: player }, { count }] = await Promise.all([
      db.from('rooms').select('host_user_id, now_item_id').eq('id', room_id).eq('mode', 'hijack').maybeSingle(),
      db.from('players').select('id').eq('room_id', room_id).eq('user_id', user.id).maybeSingle(),
      db.from('players').select('id', { count: 'exact', head: true }).eq('room_id', room_id),
    ])
    if (!room || !player) throw new HttpError(403, 'join this hijack first')
    if (!room.now_item_id) throw new HttpError(400, 'nothing is playing right now')

    await touch(db, room_id)
    await db.from('hijack_skips').delete().eq('room_id', room_id).neq('item_id', room.now_item_id) // votes on earlier songs
    await db.from('hijack_skips').upsert({ room_id, item_id: room.now_item_id, user_id: user.id }, { ignoreDuplicates: true })
    const { count: votes } = await db.from('hijack_skips').select('user_id', { count: 'exact', head: true }).eq('room_id', room_id).eq('item_id', room.now_item_id)

    const needed = threshold(count ?? 1)
    if ((votes ?? 0) < needed) return { skipped: false, votes: votes ?? 0, needed }
    await db.from('hijack_skips').delete().eq('room_id', room_id)
    await steer(db, room.host_user_id, room_id, 'skip') // the crew decided, so this is not the host asking
    return { skipped: true, votes: votes ?? 0, needed }
  }),
)
