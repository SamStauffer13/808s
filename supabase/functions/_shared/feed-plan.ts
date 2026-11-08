// What the feeder should do about one look at the host's player. Only decisions, no network and no database, so the
// cases that matter (a skipped song, a cleared queue, a speaker that went quiet) can be tested one by one.
// The caller applies the plan (see hijack.ts).

export type Playback = { is_playing: boolean; progress_ms: number; item: { id: string; duration_ms: number } | null } | null
export type Track = { id: string; item_id: string; status: 'pending' | 'queued' | 'playing'; sort_at: string; queued_at: string | null }

export type Plan = {
  state: 'offline' | 'waiting' | 'queued' | 'empty' | 'queue'
  now: { item_id: string; ends_at: number | null; duration_ms: number } | null // what is playing, when there is something
  writeRoom: boolean // the room's now-playing is out of date, so write it (a write wakes every phone, so only when it changed)
  newSong: boolean // a different song started since the last look
  stale: string[] // queued tracks that never started: done
  queue: Track | null // the pending track to put in Spotify's queue now
  nextMs: number // when to look again: soon around a song change, later in the middle of a song
  remaining?: number
}

type Input = {
  now: number
  lockMs: number
  staleMs: number
  driftMs: number // how far the end time may move before it is worth writing (it wobbles a little every look)
  room: { now_item_id: string | null; now_ends_at: string | null; host_offline: boolean }
  playback: Playback
  tracks: Track[]
}

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n))

export function planFeed({ now, lockMs, staleMs, driftMs, room, playback, tracks }: Input): Plan {
  const none = { writeRoom: false, newSong: false, stale: [], queue: null, nextMs: 15_000 }
  if (!playback?.item) return { ...none, state: 'offline', now: null, writeRoom: !room.host_offline }

  const { item, progress_ms, is_playing } = playback
  const remaining = item.duration_ms - progress_ms
  const endsAt = is_playing ? now + remaining : null
  const was = room.now_ends_at ? Date.parse(room.now_ends_at) : null
  const moved = (was === null) !== (endsAt === null) || (was !== null && Math.abs(was - endsAt!) > driftMs)
  const newSong = room.now_item_id !== item.id
  const current = { item_id: item.id, ends_at: endsAt, duration_ms: item.duration_ms }
  // Look closely when something is about to happen (the lock-in, then the song change) and rarely when nothing is.
  const nextMs = !is_playing ? 5000 : remaining <= lockMs ? clamp(remaining + 700, 1000, 5000) : clamp(remaining - lockMs - 1000, 1000, 10_000)
  const base = { ...none, now: current, newSong, writeRoom: newSong || room.host_offline || moved, remaining, nextMs }

  const stale = tracks.filter((t) => t.status === 'queued' && t.item_id !== item.id && t.queued_at && now - Date.parse(t.queued_at) > staleMs).map((t) => t.id)
  if (!is_playing || remaining > lockMs) return { ...base, stale, state: 'waiting' }

  // one track waits in Spotify's queue at a time: one that is still on its way blocks, one that has started or gone stale does not
  const waiting = tracks.some((t) => t.status === 'queued' && t.item_id !== item.id && !stale.includes(t.id))
  if (waiting) return { ...base, stale, state: 'queued' }

  const next = tracks.filter((t) => t.status === 'pending').sort((a, b) => a.sort_at.localeCompare(b.sort_at))[0]
  return next ? { ...base, stale, state: 'queue', queue: next } : { ...base, stale, state: 'empty' } // empty: the host's own playlist carries on
}
