import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { touch } from '../_shared/hijack.ts'
import { isLinkName } from '../_shared/rules.ts'

const MAX_PER_HOST = 3 // links one account can hold, so a good name cannot be hoarded
const MAX_GUESTS = 200

// Starts (or finds again) a hijack with a fixed link, for NFC tags and QR codes. One path for every hijack: a party
// and a bar start theirs the same way. The host has to be logged in to Spotify, since that is the speaker guests steer.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { name, title, slug } = await req.json()

    const code = String(slug ?? '').trim().toUpperCase()
    if (!isLinkName(code)) throw new HttpError(400, 'the link name needs 3 to 12 letters or numbers')

    const db = admin()
    const { data: mine } = await db.from('spotify_accounts').select('spotify_id, scopes').eq('user_id', user.id).maybeSingle()
    if (!mine?.scopes.includes('user-modify-playback-state')) throw new HttpError(400, 'connect Spotify first so the hijack can control your music')

    const { data: existing } = await db.from('rooms').select('*').eq('code', code).maybeSingle()
    if (existing) {
      if (existing.mode !== 'hijack') throw new HttpError(400, 'that link name is taken')
      if (existing.host_user_id === user.id) return { room: existing }

      // Someone else's seat: it is only yours when it is the same Spotify account (lost browser, new phone).
      const { data: theirs } = await db.from('spotify_accounts').select('spotify_id').eq('user_id', existing.host_user_id).maybeSingle()
      if (!theirs || theirs.spotify_id !== mine.spotify_id) throw new HttpError(400, 'that link name is taken')
      const { data: room, error } = await db.rpc('hijack_take_over', { p_room: existing.id, p_new: user.id })
      if (error) throw new HttpError(400, error.message)
      return { room }
    }

    if (!String(name ?? '').trim()) throw new HttpError(400, 'enter your name')
    if (!String(title ?? '').trim()) throw new HttpError(400, 'give your hijack a name')
    const { count } = await db.from('rooms').select('id', { count: 'exact', head: true }).eq('host_user_id', user.id).eq('mode', 'hijack')
    if ((count ?? 0) >= MAX_PER_HOST) throw new HttpError(400, `you already have ${MAX_PER_HOST} hijacks`)

    // a hijack is a room with its own mode; the game's parameters (songs each, playlist name) mean nothing to it
    const { data: made, error } = await db.rpc('create_room', { p_user: user.id, p_name: name, p_theme: title, p_title: null, p_songs: 1, p_max: MAX_GUESTS, p_source: 'spotify', p_mode: 'hijack' })
    if (error) throw new HttpError(400, error.message)

    // the fixed link: a code the host picked, instead of a random one
    const { data: room, error: taken } = await db.from('rooms').update({ code }).eq('id', made.id).select('*').single()
    if (taken) {
      await db.from('rooms').delete().eq('id', made.id)
      throw new HttpError(400, 'that link name is taken')
    }
    await touch(db, room.id)
    return { room }
  }),
)
