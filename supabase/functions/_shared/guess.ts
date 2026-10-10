import { HttpError, type admin } from './http.ts'
import { spotify, userToken } from './spotify.ts'

// The playlist is built only now, all at once and shuffled, so nobody can learn who added
// what by watching songs appear in it during the submit phase. It goes into the host's Spotify
// account, whoever asked for it.
export async function beginGuess(db: ReturnType<typeof admin>, room: { id: string; host_user_id: string; title: string | null; theme: string }) {
  const { data: songs } = await db.from('songs').select('id, spotify_id').eq('room_id', room.id)
  if (!songs || songs.length < 2) throw new HttpError(400, 'need at least 2 tracks')

  for (let i = songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[songs[i], songs[j]] = [songs[j], songs[i]]
  }

  const token = await userToken(room.host_user_id)
  const playlist = await spotify(token, '/me/playlists', {
    method: 'POST',
    body: JSON.stringify({
      name: (room.title ?? `808s: ${room.theme}`).slice(0, 100),
      description: `${room.theme}. A social experiment: who added what? Guess in the 808s app.`.slice(0, 300),
      public: true,
    }),
  })
  for (let i = 0; i < songs.length; i += 100) {
    await spotify(token, `/playlists/${playlist.id}/items`, {
      method: 'POST',
      body: JSON.stringify({ uris: songs.slice(i, i + 100).map((s) => `spotify:track:${s.spotify_id}`) }),
    })
  }

  const { error } = await db.rpc('begin_guess', {
    p_room: room.id,
    p_playlist_id: playlist.id,
    p_playlist_url: playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`,
    p_order: songs.map((s) => s.id),
  })
  if (error) throw new HttpError(400, error.message)
  return playlist.id as string
}
