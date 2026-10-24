import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { providerFor } from '../_shared/providers.ts'

Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { name, theme, title, songs_per_player, from_room, ...rest } = await req.json()

    // Play again: the host of a finished experiment starts the next one. It keeps that experiment's source, how many
    // each and the host's name, so only a new vibe comes from the client.
    let source = rest.source ?? 'spotify'
    let old: { id: string } | null = null
    if (from_room) {
      const { data } = await admin().from('rooms').select('id, source').eq('code', String(from_room).toUpperCase()).maybeSingle()
      if (!data) throw new HttpError(404, 'experiment not found')
      old = data
      source = data.source
    }
    const provider = providerFor(source)

    // a source that makes a list (a Spotify playlist) needs the host's account to make it in
    if (provider.needsHostAccount) {
      const { data: account } = await admin().from('spotify_accounts').select('user_id').eq('user_id', user.id).maybeSingle()
      if (!account) throw new HttpError(400, 'connect your Spotify account first')
    }
    if (!old && !String(name ?? '').trim()) throw new HttpError(400, 'pick a name')
    if (!String(theme ?? '').trim()) throw new HttpError(400, 'pick a vibe')

    const { data, error } = old
      ? await admin().rpc('create_next_room', { p_user: user.id, p_old: old.id, p_theme: theme, p_title: title })
      : await admin().rpc('create_room', {
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
