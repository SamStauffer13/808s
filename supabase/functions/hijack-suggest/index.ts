import { admin, currentUser, handler, HttpError, uuid } from '../_shared/http.ts'
import { touch } from '../_shared/hijack.ts'
import { isTrackId, lookupTrack } from '../_shared/spotify.ts'
import { COOLDOWN_MINUTES, REPEAT_MINUTES } from '../_shared/rules.ts'

// A guest pushes a track. Who they are and what the room allows are checked before Spotify is asked anything, and the
// title and artist are read back from Spotify, never taken from the client.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const body = await req.json()
    const room_id = uuid(body.room_id)

    const db = admin()
    const { data: seat } = await db.from('players').select('id, rooms!inner(mode, block_explicit)').eq('room_id', room_id).eq('user_id', user.id).maybeSingle()
    if (!seat) throw new HttpError(403, 'join the hijack first')
    const room = seat.rooms as unknown as { mode: string; block_explicit: boolean }
    if (room.mode !== 'hijack') throw new HttpError(400, 'this is not a hijack')

    if (!isTrackId(String(body.item_id ?? ''))) throw new HttpError(400, 'bad id')
    const touched = touch(db, room_id) // alongside the Spotify lookup, not after it
    const item = await lookupTrack(body.item_id)
    if (!item) throw new HttpError(400, 'could not find that one')
    if (item.blocked) throw new HttpError(400, "don't be boring/basic")
    if (room.block_explicit && item.explicit) throw new HttpError(400, "that one is explicit and this hijack doesn't allow those")

    const { data, error } = await db.rpc('hijack_suggest', {
      p_user: user.id,
      p_room: room_id,
      p_item_id: item.id,
      p_title: item.title,
      p_artist: item.artist,
      p_art: item.art,
      p_repeat_minutes: REPEAT_MINUTES,
      p_cooldown_minutes: COOLDOWN_MINUTES,
    })
    if (error) throw new HttpError(400, error.message)
    await touched
    return { track: data }
  }),
)
