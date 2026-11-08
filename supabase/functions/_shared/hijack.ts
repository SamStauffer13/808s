import { admin, HttpError } from './http.ts'
import { planFeed, type Plan, type Playback, type Track } from './feed-plan.ts'
import { LOCK_MS, STALE_QUEUE_MS } from './rules.ts'
import { getPlayback, queueTrack, skipTrack, SpotifyError, toItem, userToken } from './spotify.ts'

type Db = ReturnType<typeof admin>
// deno-lint-ignore no-explicit-any
type Room = Record<string, any>

// Marks a hijack as in use right now, so the server timer keeps looking after it (see hijack-tick).
export async function touch(db: Db, roomId: string) {
  try {
    await db.rpc('hijack_touch', { p_room: roomId })
  } catch {} // best effort: the timer just looks a little late if this misses
}

// the shortest time between two looks at one player (a host's app and the server timer can both be due at once)
const MIN_GAP_MS = 800

// Spotify's refusals, in words the host can act on
function problemWith(e: unknown) {
  if (e instanceof SpotifyError && e.status === 404) return new HttpError(400, 'nothing is playing on your Spotify right now')
  if (e instanceof SpotifyError && e.status === 403) return new HttpError(400, 'Spotify would not allow that: controlling playback needs Premium')
  return e
}

const backOff = (e: SpotifyError) => ({ state: 'rate_limited', retryAfter: e.retryAfter ?? 5, nextMs: (e.retryAfter ?? 5) * 1000 })

// One look at the host's player: keep the room's "now playing" right and queue the next track when the song is nearly
// over. Safe to call from several places at once: only one caller gets a turn every few seconds, and a track is
// claimed before it is queued. What to do is decided in feed-plan.ts; this applies it.
export async function feed(db: Db, room: Room) {
  const { data: turn } = await db.rpc('hijack_claim_feed', { p_room: room.id, p_gap_ms: MIN_GAP_MS })
  if (!turn) return { state: 'busy', nextMs: MIN_GAP_MS }

  const token = await userToken(room.host_user_id, 'user-modify-playback-state')
  let playback: Playback
  try {
    playback = await getPlayback(token)
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 429) return backOff(e)
    if (e instanceof SpotifyError && (e.status === 401 || e.status === 403)) throw new HttpError(400, 'reconnect Spotify so the hijack can control your music')
    throw e
  }

  // The tracks only matter around a song change and the lock-in, so the middle of a song skips that query.
  const item = playback?.item
  const needTracks = !!item && (room.now_item_id !== item.id || item.duration_ms - playback!.progress_ms <= LOCK_MS)
  const { data: tracks } = needTracks ? await db.from('hijack_tracks').select('id, item_id, status, sort_at, queued_at').eq('room_id', room.id).in('status', ['pending', 'queued', 'playing']) : { data: [] }
  const plan = planFeed({ now: Date.now(), lockMs: LOCK_MS, staleMs: STALE_QUEUE_MS, driftMs: 3000, room, playback, tracks: (tracks ?? []) as Track[] })

  await syncNowPlaying(db, room, playback, plan)
  return plan.queue ? await queueNext(db, token, plan) : { state: plan.state, remaining: plan.remaining, nextMs: plan.nextMs }
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
  if (!claimed?.length) return { state: 'queued', remaining: plan.remaining, nextMs: plan.nextMs }

  try {
    await queueTrack(token, next.item_id)
  } catch (e) {
    // Spotify said no: the track goes back to waiting. Anything else (a timeout) might still have been queued, so it
    // stays claimed rather than risking it playing twice; if it never starts it goes stale on its own.
    if (e instanceof SpotifyError) {
      await db.from('hijack_tracks').update({ status: 'pending', queued_at: null }).eq('id', next.id)
      if (e.status === 429) return backOff(e)
    }
    throw problemWith(e)
  }
  return { state: 'queued', remaining: plan.remaining, nextMs: plan.nextMs, item_id: next.item_id }
}

// The host's two ways of cutting in: skip the song that is playing, or play a waiting track right now. Spotify's queue
// cannot be reordered, so "play now" queues the track and then skips to it, which only works while nothing else is
// locked in ahead of it (that one plays first).
export async function steer(db: Db, userId: string, roomId: string, action: 'skip' | 'play_now', trackId?: string) {
  const { data: room } = await db.from('rooms').select('id, host_user_id').eq('id', roomId).eq('mode', 'hijack').maybeSingle()
  if (!room || room.host_user_id !== userId) throw new HttpError(403, 'only the host can do that')
  const token = await userToken(room.host_user_id, 'user-modify-playback-state')

  // The queue cannot be edited, so a cut-in only lands on a guest's track if it is in the queue first: a track already
  // locked in is what plays next; otherwise the one asked for (play now) or the first in line (skip) is locked in now.
  const { data: locked } = await db.from('hijack_tracks').select('id').eq('room_id', roomId).eq('status', 'queued').limit(1)
  if (action === 'play_now' && locked?.length) throw new HttpError(400, 'a track is already locked in, so it plays first')
  let pick = trackId
  if (action === 'skip' && !locked?.length) {
    const { data: first } = await db.from('hijack_tracks').select('id').eq('room_id', roomId).eq('status', 'pending').order('sort_at').limit(1)
    pick = first?.[0]?.id
  }
  if (pick && !locked?.length) {
    const { data: claimed } = await db.from('hijack_tracks').update({ status: 'queued', queued_at: new Date().toISOString() }).eq('id', pick).eq('room_id', roomId).eq('status', 'pending').select('item_id')
    if (!claimed?.length && action === 'play_now') throw new HttpError(400, 'that track is not waiting any more')
    if (claimed?.length) {
      try {
        await queueTrack(token, claimed[0].item_id)
      } catch (e) {
        await db.from('hijack_tracks').update({ status: 'pending', queued_at: null }).eq('id', pick)
        throw problemWith(e)
      }
    }
  }
  try {
    await skipTrack(token)
  } catch (e) {
    throw problemWith(e)
  }
}