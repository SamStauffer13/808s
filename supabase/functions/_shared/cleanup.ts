import { admin } from './http.ts'
import { hostToken, spotify } from './spotify.ts'

// Removes the Spotify playlists of games older than four weeks, then the games themselves.
// A game stays until Spotify has let go of its playlist, so a failure is retried next time.
export async function removeOldPlaylists() {
  const db = admin()
  const cutoff = new Date(Date.now() - 28 * 86_400_000).toISOString()
  const { data: old } = await db.from('rooms').select('id, playlist_id').lt('created_at', cutoff).not('playlist_id', 'is', null)
  if (!old?.length) return

  const token = await hostToken()
  for (const room of old) {
    await spotify(token, `/me/library?uris=${encodeURIComponent(`spotify:playlist:${room.playlist_id}`)}`, { method: 'DELETE' })
    await db.from('rooms').delete().eq('id', room.id)
  }
}
