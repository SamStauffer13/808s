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

    // everyone has to be in and done adding songs; only the admin override (admin-advance) skips this
    const [{ data: players }, { data: owners }] = await Promise.all([
      db.from('players').select('id').eq('room_id', room_id),
      db.from('song_owners').select('player_id').eq('room_id', room_id),
    ])
    const added = (id: string) => (owners ?? []).filter((o) => o.player_id === id).length
    if ((players?.length ?? 0) < 2) throw new HttpError(400, 'wait for friends to join')
    if (players!.some((p) => added(p.id) < room.songs_per_player)) throw new HttpError(400, 'wait for everyone to add their songs')

    return { playlist_id: await beginGuess(db, room) }
  }),
)
