import { admin } from './http.ts'
import { hostToken, spotify } from './spotify.ts'

// Removes a game's Spotify playlist from the host's library, then the game itself. Only a playlist recorded
// for a game can be removed, never one named by a caller. If Spotify refuses, the game is kept.
export async function removePlaylist(roomId: string, playlistId: string, token?: string) {
  const uri = encodeURIComponent(`spotify:playlist:${playlistId}`)
  await spotify(token ?? (await hostToken()), `/me/library?uris=${uri}`, { method: 'DELETE' })
  await admin().from('rooms').delete().eq('id', roomId)
}

// the same, for every game older than four weeks
export async function removeOldPlaylists() {
  const cutoff = new Date(Date.now() - 28 * 86_400_000).toISOString()
  const { data: old } = await admin().from('rooms').select('id, playlist_id').lt('created_at', cutoff).not('playlist_id', 'is', null)
  if (!old?.length) return

  const token = await hostToken()
  for (const room of old) await removePlaylist(room.id, room.playlist_id, token)
}
