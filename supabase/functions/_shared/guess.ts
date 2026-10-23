import { HttpError, type admin } from './http.ts'
import { providerFor, type Room } from './providers.ts'

// The shuffled list is made only now, all at once, so nobody can learn who added what by watching items appear
// in it during the submit phase. `askedBy` is whoever is starting the experiment (the host, or the owner's
// override); a source that makes a list uses it, and one that does not just starts guessing.
export async function beginGuess(db: ReturnType<typeof admin>, room: Room & { source: string }, askedBy = room.host_user_id) {
  const { data: songs } = await db.from('songs').select('id, item_id').eq('room_id', room.id)
  if (!songs || songs.length < 2) throw new HttpError(400, 'add at least 2 before starting')

  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[songs[i], songs[j]] = [songs[j], songs[i]]
  }

  const list = await providerFor(room.source).publish(db, room, songs.map((s) => s.item_id), askedBy)

  const { error } = await db.rpc('begin_guess', {
    p_room: room.id,
    p_playlist_id: list?.id ?? null,
    p_playlist_url: list?.url ?? null,
    p_order: songs.map((s) => s.id),
  })
  if (error) throw new HttpError(400, error.message)
}
