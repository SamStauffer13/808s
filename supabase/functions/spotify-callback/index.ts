import { admin } from '../_shared/http.ts'
import { exchangeCode, readState, spotify } from '../_shared/spotify.ts'

// Spotify sends the browser here after login. There is no app session on this request (it is a plain browser
// redirect), so the signed state is what says who is connecting. Always ends by sending them back to the app.
Deno.serve(async (req) => {
  const url = new URL(req.url)
  const state = await readState(url.searchParams.get('state') ?? '')
  if (!state) return new Response('This login link expired. Go back to 808s and try again.', { status: 400 })

  const back = (result: string) => {
    const to = new URL(state.returnTo)
    to.searchParams.set('spotify', result)
    return Response.redirect(to.toString(), 302)
  }

  const code = url.searchParams.get('code')
  if (!code) return back('denied')

  try {
    const tokens = await exchangeCode(code)
    const me = await spotify(tokens.access_token, '/me')
    const { error } = await admin().from('spotify_accounts').upsert({
      user_id: state.userId,
      spotify_id: me.id,
      display_name: me.display_name ?? me.id,
      refresh_token: tokens.refresh_token,
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
    return back('connected')
  } catch (e) {
    console.error('spotify login failed', e)
    return back('failed')
  }
})
