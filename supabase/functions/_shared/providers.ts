import { HttpError, type admin } from './http.ts'
import { spotifyProvider } from './spotify.ts'
import { youtubeProvider } from './youtube.ts'

// Everything that differs between what people can add lives behind this one shape, one provider per source, each in
// its own file (spotify.ts, youtube.ts). A room has a source, and search, add-song, create-room and the start of
// guessing just ask that source: nothing else knows what a Spotify song or a YouTube video is. A new source is a
// provider file and one entry below, plus the matching entry in src/lib/sources.ts and a row in the `sources` table.
export type Source = 'spotify' | 'youtube'
export type Item = { id: string; title: string; artist: string; art: string | null; blocked: boolean }
export type Room = { id: string; host_user_id: string; title: string | null; theme: string }
export type Db = ReturnType<typeof admin>

export type Provider = {
  // the host connects an account to make the experiment's list in; without one they cannot start a room
  needsHostAccount: boolean
  // the most items one player may add; a room asks for up to this many each
  maxPicks: number
  isId(id: string): boolean
  search(q: string): Promise<Item[]>
  // re-reads an item from its source so a client cannot make up titles; null when it does not exist
  lookup(id: string): Promise<(Item & { genres: string[] }) | null>
  // makes a shuffled list outside the app when the source has one, and says where it is. `askedBy` is whoever is
  // starting the experiment: the host, or the owner's override.
  publish(db: Db, room: Room, ids: string[], askedBy: string): Promise<{ id: string; url: string } | null>
}

export const providers: Record<Source, Provider> = { spotify: spotifyProvider, youtube: youtubeProvider }

export function providerFor(source: unknown): Provider {
  const provider = providers[source as Source]
  if (!provider) throw new HttpError(400, 'unknown source')
  return provider
}

// the provider for an experiment, which is how search and add-song find out what they are working with
export async function providerForRoom(db: Db, roomId: string): Promise<Provider> {
  const { data: room } = await db.from('rooms').select('source').eq('id', roomId).maybeSingle()
  if (!room) throw new HttpError(404, 'experiment not found')
  return providerFor(room.source)
}
