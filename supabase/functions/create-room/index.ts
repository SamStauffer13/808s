import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { name, theme, title, songs_per_player } = await req.json()

    const { data: account } = await admin().from('spotify_accounts').select('user_id').eq('user_id', user.id).maybeSingle()
    if (!account) throw new HttpError(400, 'connect your Spotify account first')
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
    return { room: data }
  }),
)
