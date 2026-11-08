import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { providerForRoom } from '../_shared/providers.ts'

// A guest puts a song in line. Like add-song, the title and artist are read back from Spotify, never taken from the client.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id, item_id } = await req.json()

    const db = admin()
    const provider = await providerForRoom(db, room_id)
    if (!provider.isId(String(item_id ?? ''))) throw new HttpError(400, 'bad id')

    const item = await provider.lookup(item_id)
    if (!item) throw new HttpError(400, 'could not find that one')
    if (item.blocked) throw new HttpError(400, "don't be boring/basic")

    // a bar can keep explicit tracks off the speaker
    const { data: room } = await db.from('rooms').select('block_explicit').eq('id', room_id).maybeSingle()
    if (room?.block_explicit && item.explicit) throw new HttpError(400, "that one is explicit and this hijack doesn't allow those")

    const { data, error } = await db.rpc('dj_suggest', {
      p_user: user.id,
      p_room: room_id,
      p_item_id: item.id,
      p_title: item.title,
      p_artist: item.artist,
      p_art: item.art,
    })
    if (error) throw new HttpError(400, error.message)
    return { track: data }
  }),
)
