import { admin, HttpError } from './http.ts'
import { planFeed, type Plan, type Playback, type Track } from './feed-plan.ts'
import { LOCK_MS, STALE_QUEUE_MS } from './rules.ts'
import { getPlayback, queueTrack, SpotifyError, toItem, userToken } from './spotify.ts'

type Db = ReturnType<typeof admin>
// deno-lint-ignore no-explicit-any
type Room = Record<string, any>

// Marks a hijack as in use right now, so the server timer keeps looking after it (see hijack-tick).
export const touch = (db: Db, roomId: string) => db.rpc('hijack_touch', { p_room: roomId })

const backOff = (e: SpotifyError) => ({ state: 'rate_limited', retryAfter: e.retryAfter ?? 5 })

// One look at the host's player: keep the room's "now playing" right and queue the next track when the song is nearly
// over. Safe to call from several places at once: only one caller gets a turn every few seconds, and a track is
// claimed before it is queued. What to do is decided in feed-plan.ts; this applies it.
export async function feed(db: Db, room: Room) {
  const { data: turn } = await db.rpc('hijack_claim_feed', { p_room: room.id })
  if (!turn) return { state: 'busy' }

  const token = await userToken(room.host_user_id, 'user-modify-playback-state')
  let playback: Playback
  try {
    playback = await getPlayback(token)
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 429) return backOff(e)
    if (e instanceof SpotifyError && (e.status === 401 || e.status === 403)) throw new HttpError(400, 'reconnect Spotify so the hijack can control your music')
    throw e
  }

  const { data: tracks } = await db.from('hijack_tracks').select('id, item_id, status, sort_at, queued_at').eq('room_id', room.id).in('status', ['pending', 'queued', 'playing'])
  const plan = planFeed({ now: Date.now(), lockMs: LOCK_MS, staleMs: STALE_QUEUE_MS, driftMs: 3000, room, playback, tracks: (tracks ?? []) as Track[] })

  await syncNowPlaying(db, room, playback, plan)
  return plan.queue ? await queueNext(db, token, plan) : { state: plan.state, remaining: plan.remaining }
}

// A write to rooms is a realtime event every phone reloads for, so only what changed is written.
async function syncNowPlaying(db: Db, room: Room, playback: Playback, plan: Plan) {
  if (plan.writeRoom) {
    const shown = playback?.item ? toItem(playback.item) : null
    await db
      .from('rooms')
      .update({
        host_offline: !plan.now,
        now_item_id: plan.now?.item_id ?? null,
        now_ends_at: plan.now?.ends_at ? new Date(plan.now.ends_at).toISOString() : null,
        now_title: shown?.title ?? null,
        now_artist: shown?.artist ?? null,
        now_art: shown?.art ?? null,
        now_duration_ms: plan.now?.duration_ms ?? null,
      })
      .eq('id', room.id)
  }
  if (plan.stale.length) await db.from('hijack_tracks').update({ status: 'played' }).in('id', plan.stale)
  // a new song is on: the queued track that started becomes "playing", whatever played before it is done
  if (plan.newSong && plan.now) {
    await db.from('hijack_tracks').update({ status: 'played' }).eq('room_id', room.id).eq('status', 'playing').neq('item_id', plan.now.item_id)
    await db.from('hijack_tracks').update({ status: 'playing' }).eq('room_id', room.id).eq('status', 'queued').eq('item_id', plan.now.item_id)
  }
}

async function queueNext(db: Db, token: string, plan: Plan) {
  const next = plan.queue!
  // claim it first, so two overlapping calls cannot queue the same track twice
  const { data: claimed } = await db.from('hijack_tracks').update({ status: 'queued', queued_at: new Date().toISOString() }).eq('id', next.id).eq('status', 'pending').select('id')
  if (!claimed?.length) return { state: 'queued', remaining: plan.remaining }

  try {
    await queueTrack(token, next.item_id)
  } catch (e) {
    // Spotify said no: the track goes back to waiting. Anything else (a timeout) might still have been queued, so it
    // stays claimed rather than risking it playing twice; if it never starts it goes stale on its own.
    if (e instanceof SpotifyError) {
      await db.from('hijack_tracks').update({ status: 'pending', queued_at: null }).eq('id', next.id)
      if (e.status === 429) return backOff(e)
    }
    throw e
  }
  return { state: 'queued', remaining: plan.remaining, item_id: next.item_id }
}
