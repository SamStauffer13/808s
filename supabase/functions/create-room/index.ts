import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { providerFor } from '../_shared/providers.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { name, theme, title, songs_per_player, source = 'spotify' } = await req.json()
    const provider = providerFor(source)

    // a source that makes a list (a Spotify playlist) needs the host's account to make it in
    if (provider.needsHostAccount) {
      const { data: account } = await admin().from('spotify_accounts').select('user_id').eq('user_id', user.id).maybeSingle()
      if (!account) throw new HttpError(400, 'connect your Spotify account first')
    }
    if (!String(name ?? '').trim()) throw new HttpError(400, 'pick a name')
    if (!String(theme ?? '').trim()) throw new HttpError(400, 'pick a vibe')

    const { data, error } = await admin().rpc('create_room', {
      p_user: user.id,
      p_name: name,
      p_theme: theme,
      p_title: title,
      p_songs: Math.min(Number(songs_per_player) || 3, provider.maxPicks),
      p_max: 20,
      p_source: source,
    })
    if (error) throw new HttpError(400, error.message)
    return { room: data }
  }),
)
