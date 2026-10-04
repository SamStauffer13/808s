import { removePlaylist } from '../_shared/cleanup.ts'
import { admin, handler, HttpError, requireHostCode } from '../_shared/http.ts'

Deno.serve(
  handler(async (req) => {
    const { passphrase, action, room_id } = await req.json()
    requireHostCode(passphrase)
    const db = admin()

    if (action === 'delete') {
      const { data: room } = await db.from('rooms').select('id, playlist_id').eq('id', room_id).not('playlist_id', 'is', null).maybeSingle()
      if (!room) throw new HttpError(404, 'playlist not found')
      await removePlaylist(room.id, room.playlist_id)
      return {}
    }

    // finished playlists, and any left over for a day, so one in progress is never listed
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()
    const { data } = await db
      .from('rooms')
      .select('id, theme, created_at, players(count)')
      .not('playlist_id', 'is', null)
      .or(`phase.eq.done,created_at.lt.${dayAgo}`)
      .order('created_at', { ascending: false })
    return { playlists: (data ?? []).map((r) => ({ id: r.id, theme: r.theme, created_at: r.created_at, players: r.players[0].count })) }
  }),
)
