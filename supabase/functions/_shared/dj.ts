import { admin, HttpError } from './http.ts'
import { getPlayback, queueTrack, SpotifyError, toItem, userToken } from './spotify.ts'

type Db = ReturnType<typeof admin>
// deno-lint-ignore no-explicit-any
type Room = Record<string, any>

// How close to the end of a song the next one is queued. Spotify's queue cannot be edited, so this is also the
// moment votes lock: late enough that the room has had its say, early enough that the speaker never goes quiet.
const LEAD_MS = 25_000

// Looks at what the host's player is doing, keeps the room's "now playing" up to date, and queues the top suggestion
// when the current song is nearly over. Safe to call as often as you like, and from several places at once: only one
// caller gets a turn every few seconds, and a track is claimed before it is queued.
export async function feed(db: Db, room: Room) {
  const { data: turn } = await db.rpc('dj_claim_feed', { p_room: room.id })
  if (!turn) return { state: 'busy' }

  const { data: account } = await db.from('spotify_accounts').select('scopes').eq('user_id', room.host_user_id).maybeSingle()
  if (!account?.scopes.includes('user-modify-playback-state')) throw new HttpError(400, 'reconnect Spotify so the session can control your music')

  const token = await userToken(room.host_user_id)

  let playback
  try {
    playback = await getPlayback(token)
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 429) return { state: 'rate_limited', retryAfter: e.retryAfter ?? 5 }
    if (e instanceof SpotifyError && (e.status === 401 || e.status === 403)) throw new HttpError(400, 'reconnect Spotify so the session can control your music')
    throw e
  }

  // A write is a realtime event that every phone in the room reloads for, so only what changed is written.
  // Nothing playing, or no active device: tell the room so the host sees a clear "start Spotify" prompt.
  if (!playback?.item) {
    if (!room.host_offline) {
      await db
        .from('rooms')
        .update({ host_offline: true, now_item_id: null, now_ends_at: null, now_title: null, now_artist: null, now_art: null, now_duration_ms: null })
        .eq('id', room.id)
    }
    return { state: 'offline' }
  }

  const { item, progress_ms, is_playing } = playback
  const remaining = item.duration_ms - progress_ms
  const endsAt = is_playing ? Date.now() + remaining : null
  const was = room.now_ends_at ? new Date(room.now_ends_at).getTime() : null
  const timeMoved = (was === null) !== (endsAt === null) || (was !== null && Math.abs(was - endsAt!) > 3000) // it drifts a moment each poll
  const newSong = room.now_item_id !== item.id

  if (newSong || room.host_offline || timeMoved) {
    const shown = toItem(item)
    await db
      .from('rooms')
      .update({
        host_offline: false,
        now_item_id: item.id,
        now_ends_at: endsAt && new Date(endsAt).toISOString(),
        now_title: shown.title,
        now_artist: shown.artist,
        now_art: shown.art,
        now_duration_ms: item.duration_ms,
      })
      .eq('id', room.id)
  }

  // a new song is on: the queued track that started becomes "playing", whatever played before it is done
  if (newSong) {
    await db.from('dj_tracks').update({ status: 'played' }).eq('room_id', room.id).eq('status', 'playing').neq('item_id', item.id)
    await db.from('dj_tracks').update({ status: 'playing' }).eq('room_id', room.id).eq('status', 'queued').eq('item_id', item.id)
  }

  if (!is_playing || remaining > LEAD_MS) return { state: 'waiting', remaining }

  // one song waits in Spotify's queue at a time
  const { data: queued } = await db.from('dj_tracks').select('id').eq('room_id', room.id).eq('status', 'queued').limit(1)
  if (queued?.length) return { state: 'queued', remaining }

  const { data: next } = await db.from('dj_tracks').select('id, item_id').eq('room_id', room.id).eq('status', 'pending').order('created_at').limit(1)
  if (!next?.length) return { state: 'empty', remaining } // the host's own playlist carries on

  // claim it first, so two overlapping calls cannot queue the same song twice
  const { data: claimed } = await db
    .from('dj_tracks')
    .update({ status: 'queued', queued_at: new Date().toISOString() })
    .eq('id', next[0].id)
    .eq('status', 'pending')
    .select('id')
  if (!claimed?.length) return { state: 'queued', remaining }

  try {
    await queueTrack(token, next[0].item_id)
  } catch (e) {
    await db.from('dj_tracks').update({ status: 'pending', queued_at: null }).eq('id', next[0].id)
    if (e instanceof SpotifyError && e.status === 429) return { state: 'rate_limited', retryAfter: e.retryAfter ?? 5 }
    throw e
  }
  return { state: 'queued', remaining, item_id: next[0].item_id }
}
