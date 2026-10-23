import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { providerForRoom } from '../_shared/providers.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id, item_id } = await req.json()

    const db = admin()
    const provider = await providerForRoom(db, room_id)
    if (!provider.isId(String(item_id ?? ''))) throw new HttpError(400, 'bad id')

    // re-read the item from its source so a client cannot make up titles
    const item = await provider.lookup(item_id)
    if (!item) throw new HttpError(400, 'could not find that one')
    if (item.blocked) throw new HttpError(400, "don't be boring/basic")

    const { data, error } = await db.rpc('add_song', {
      p_user: user.id,
      p_room: room_id,
      p_item_id: item.id,
      p_title: item.title,
      p_artist: item.artist,
      p_art: item.art,
      p_genres: item.genres,
    })
    if (error) throw new HttpError(400, error.message)
    return { song: data }
  }),
)
