import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'

// Starts (or finds again) a hijack with a fixed link, for NFC tags and QR codes. One path for every hijack: a party and a bar start theirs the same way.
// The host has to be logged in to Spotify, since that is the speaker the guests steer.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { name, title, slug } = await req.json()

    const code = String(slug ?? '').trim().toUpperCase()
    if (!/^[A-Z0-9]{3,12}$/.test(code) || code === 'SETUP') throw new HttpError(400, 'the link name needs 3 to 12 letters or numbers')

    const db = admin()
    const { data: mine } = await db.from('spotify_accounts').select('spotify_id, scopes').eq('user_id', user.id).maybeSingle()
    if (!mine?.scopes.includes('user-modify-playback-state')) throw new HttpError(400, 'connect Spotify first so the hijack can control your music')

    const { data: existing } = await db.from('rooms').select('*').eq('code', code).maybeSingle()
    if (existing) {
      if (existing.mode !== 'dj') throw new HttpError(400, 'that link name is taken')
      if (existing.host_user_id === user.id) return { room: existing }

      // Someone else's seat: it is only yours when it is the same Spotify account (lost browser, new phone).
      const { data: theirs } = await db.from('spotify_accounts').select('spotify_id').eq('user_id', existing.host_user_id).maybeSingle()
      if (!theirs || theirs.spotify_id !== mine.spotify_id) throw new HttpError(400, 'that link name is taken')
      await db.from('players').update({ user_id: user.id }).eq('room_id', existing.id).eq('user_id', existing.host_user_id)
      const { data: room } = await db.from('rooms').update({ host_user_id: user.id }).eq('id', existing.id).select('*').single()
      await db.from('spotify_accounts').delete().eq('user_id', existing.host_user_id)
      return { room }
    }

    if (!String(name ?? '').trim()) throw new HttpError(400, 'enter your name')
    if (!String(title ?? '').trim()) throw new HttpError(400, 'give your hijack a name')
    const { data: made, error } = await db.rpc('create_room', {
      p_user: user.id,
      p_name: name,
      p_theme: title,
      p_title: null,
      p_songs: 1,
      p_max: 500,
      p_source: 'spotify',
      p_mode: 'dj',
    })
    if (error) throw new HttpError(400, error.message)

    // the fixed link: a code the bar picked, instead of a random one
    const { data: room, error: taken } = await db.from('rooms').update({ code }).eq('id', made.id).select('*').single()
    if (taken) {
      await db.from('rooms').delete().eq('id', made.id)
      throw new HttpError(400, 'that link name is taken')
    }
    return { room }
  }),
)
