import { removeOldPlaylists } from '../_shared/cleanup.ts'
import { admin, currentUser, handler, HttpError, requireHostCode } from '../_shared/http.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { passphrase, name, theme, title, songs_per_player } = await req.json()

    requireHostCode(passphrase)
    if (!String(name ?? '').trim()) throw new HttpError(400, 'pick a name')
    if (!String(theme ?? '').trim()) throw new HttpError(400, 'pick a vibe')

    const { data, error } = await admin().rpc('create_room', {
      p_user: user.id,
      p_name: name,
      p_theme: theme,
      p_title: title,
      p_songs: Number(songs_per_player) || 3,
      p_max: 20,
    })
    if (error) throw new HttpError(400, error.message)

    // old playlists are tidied up whenever a new one starts; a failure must never block it
    await removeOldPlaylists().catch((e) => console.error('playlist cleanup failed', e))
    return { room: data }
  }),
)
