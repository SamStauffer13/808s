import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { appToken, spotify, toTrack } from '../_shared/spotify.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { room_id, spotify_id } = await req.json()
    if (!/^[A-Za-z0-9]{22}$/.test(String(spotify_id ?? ''))) throw new HttpError(400, 'bad track id')

    // re-read the track from Spotify so a client cannot make up titles
    const track = toTrack(await spotify(await appToken(), `/tracks/${spotify_id}`))
    if (track.blocked) throw new HttpError(400, 'have you tried not being boring/basic?')

    const { data, error } = await admin().rpc('add_song', {
      p_user: user.id,
      p_room: room_id,
      p_spotify_id: track.id,
      p_title: track.title,
      p_artist: track.artist,
      p_art: track.art,
    })
    if (error) throw new HttpError(400, error.message)
    return { song: data }
  }),
)
