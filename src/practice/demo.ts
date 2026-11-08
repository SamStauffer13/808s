// The hijack practice round plays out on its own, so someone learning it sees what a real one does: the song counts
// down, the front track locks in shortly before it ends and plays next, and other guests push and roll tracks back.
// What happens when comes from the same planFeed() the real feeder uses, so the demo cannot drift from the real thing.
import { planFeed } from '../../supabase/functions/_shared/feed-plan'
import { LOCK_MS, STALE_QUEUE_MS, threshold } from '../../supabase/functions/_shared/rules'
import { game, type HijackTrack } from '../lib/game.svelte'
import { items, players } from './data'

// A test can speed the demo up (a real song takes minutes): sessionStorage.setItem('808s-demo-speed', '20')
const speed = () => {
  try {
    return Number(sessionStorage.getItem('808s-demo-speed')) || 1
  } catch {
    return 1
  }
}

// a short song, and the first one already part way through, so the lock-in is only a few seconds away
export const firstSong = () => ({ durationMs: 75_000 / speed(), leftMs: 32_000 / speed() })

// what the practice hijack is called, on its invite page and on its own screen
export const HIJACK_NAME = 'rooftop friday'

const live = ['pending', 'queued', 'playing']

// What the host's skip and play-now buttons do to the demo (set while it runs)
export const control: { skip?: () => void; playNow?: (trackId: string) => void } = {}

export function startDemo() {
  const k = speed()
  const { durationMs, leftMs } = firstSong()
  const room = game.room!
  let current = { id: room.now_item_id!, startedAt: Date.now() - (durationMs - leftMs) }
  let shown = { title: room.now_title ?? null, artist: room.now_artist ?? null, art: room.now_art ?? null }
  const queuedAt = new Map<string, number>() // when each track was locked in (the planner wants to know)
  const used = new Set([room.now_item_id, ...game.hijack.tracks.map((t) => t.item_id)])
  let playlist = 8 // the host's own playlist: what plays when nothing is locked in
  let guest = 2 // whose turn it is to push next

  const fresh = () => items().find((t, i) => i >= 5 && !used.has(t.id))
  const push = (who: number) => {
    const t = fresh()
    if (!t) return
    used.add(t.id)
    game.hijack.tracks = [...game.hijack.tracks, { id: `crew-${t.id}`, item_id: t.id, title: t.title, artist: t.artist, art: t.art, suggested_by: players[who].id, status: 'pending', sort_at: new Date().toISOString(), duration_ms: durationMs }]
  }
  // a crew member's rollback; the track drops out as soon as it has enough, like the server decides
  const rollBack = (who: number, trackId: string) => {
    game.hijack.vetoes = [...game.hijack.vetoes, { track_id: trackId, player_id: players[who].id }]
    if (game.hijack.vetoes.filter((v) => v.track_id === trackId).length >= threshold(game.players.length)) game.hijack.tracks = game.hijack.tracks.filter((t) => t.id !== trackId)
  }

  // The song ended: what was locked in plays, otherwise the host's playlist carries on.
  const nextSong = (now: number) => {
    const locked = game.hijack.tracks.find((t) => t.status === 'queued')
    const item = items()[playlist++ % items().length]
    const song = locked ?? item
    current = { id: locked ? locked.item_id : item.id, startedAt: now }
    shown = { title: song.title, artist: song.artist, art: song.art }
  }

  const look = () => {
    const now = Date.now()
    if (now - current.startedAt >= durationMs) nextSong(now)
    const plan = planFeed({
      now,
      lockMs: LOCK_MS / k,
      staleMs: STALE_QUEUE_MS,
      driftMs: 3000,
      room: { now_item_id: game.room!.now_item_id ?? null, now_ends_at: game.room!.now_ends_at ?? null, host_offline: !!game.room!.host_offline },
      playback: { is_playing: true, progress_ms: now - current.startedAt, item: { id: current.id, duration_ms: durationMs } },
      tracks: game.hijack.tracks.filter((t) => live.includes(t.status)).map((t) => ({ id: t.id, item_id: t.item_id, status: t.status as 'pending' | 'queued' | 'playing', sort_at: t.sort_at, queued_at: queuedAt.has(t.id) ? new Date(queuedAt.get(t.id)!).toISOString() : null })),
    })
    if (plan.writeRoom && plan.now) {
      game.room = { ...game.room!, host_offline: false, now_item_id: plan.now.item_id, now_ends_at: plan.now.ends_at ? new Date(plan.now.ends_at).toISOString() : null, now_title: shown.title, now_artist: shown.artist, now_art: shown.art, now_duration_ms: plan.now.duration_ms }
    }
    // a new song is on: what was playing is done, and the locked-in track that started becomes the one playing
    if (plan.newSong && plan.now) {
      game.hijack.tracks = game.hijack.tracks
        .filter((t) => t.status !== 'playing')
        .map((t): HijackTrack => (t.status === 'queued' && t.item_id === plan.now!.item_id ? { ...t, status: 'playing' } : t))
    }
    if (plan.queue) {
      queuedAt.set(plan.queue.id, now)
      game.hijack.tracks = game.hijack.tracks.map((t): HijackTrack => (t.id === plan.queue!.id ? { ...t, status: 'queued' } : t))
    }
  }

  // a few things the crew does, so the line is never just the learner: one pushes, one rolls a track back, and the
  // line is topped up so the demo keeps going however long the walkthrough takes
  const second = game.hijack.tracks[1]
  const timers = [
    setTimeout(() => push(3), 5000 / k),
    setTimeout(() => second && rollBack(4, second.id), 11_000 / k),
    setInterval(look, 500),
    setInterval(() => game.hijack.tracks.filter((t) => t.status === 'pending').length < 3 && push((guest = (guest % 5) + 1)), 18_000 / k),
  ]
  // skipping just ends the song now; playing a track now locks it in first, so it is the one that plays next
  control.skip = () => void (current.startedAt = Date.now() - durationMs)
  control.playNow = (trackId) => {
    game.hijack.tracks = game.hijack.tracks.map((t): HijackTrack => (t.id === trackId ? { ...t, status: 'queued' } : t))
    queuedAt.set(trackId, Date.now())
    control.skip!()
  }
  look()
  return () => {
    timers.forEach((t) => (clearTimeout(t), clearInterval(t)))
    delete control.skip
    delete control.playNow
  }
}
