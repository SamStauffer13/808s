// The hijack: the line of tracks, who voted what, and what guests and the host can do. The server decides everything;
// the screen updates first (optimistically) so a tap feels instant, then settles on what the server says.
import { LOCK_MS, threshold as votesNeeded } from '../../supabase/functions/_shared/rules'
import { attempt, game, me, once, refreshSoon, type HijackTrack, type Item } from './game.svelte'
import { call } from './supabase'

export { LOCK_MS } // how long before a song ends the next one is locked in (the same number the server uses)

// rollbacks it takes to drop a track (the same rule the server applies)
export const threshold = () => votesNeeded(game.players.length)

const bySort = (a: HijackTrack, b: HijackTrack) => a.sort_at.localeCompare(b.sort_at)

export const line = () => game.hijack.tracks.filter((t) => t.status === 'pending').sort(bySort)
export const locked = () => game.hijack.tracks.find((t) => t.status === 'queued')
// the track in front of the room: locked in, otherwise whoever is first in line
export const upNext = () => locked() ?? line()[0]

export const votesOn = (trackId: string) => game.hijack.vetoes.filter((v) => v.track_id === trackId).length
export const iVoted = (trackId: string) => game.hijack.vetoes.some((v) => v.track_id === trackId && v.player_id === me()?.id)
export const myWaiting = () => line().find((t) => t.suggested_by === me()?.id)
export const positionOf = (trackId: string) => line().findIndex((t) => t.id === trackId) + 1

// already in the room right now (the server also keeps a track that just played from coming straight back)
export const taken = (item: Item) => game.hijack.tracks.some((t) => t.item_id === item.id)

// puts a track in line: it shows up at once and is taken back if the server says no
export async function suggest(item: Item, scope: string) {
  if (!me()) return
  const temp: HijackTrack = { id: `temp-${item.id}`, item_id: item.id, title: item.title, artist: item.artist, art: item.art, suggested_by: me()!.id, status: 'pending', sort_at: new Date().toISOString() }
  game.hijack.tracks = [...game.hijack.tracks, temp]
  const ok = await attempt(scope, () => call('hijack-suggest', { room_id: game.room!.id, item_id: item.id }))
  if (!ok) game.hijack.tracks = game.hijack.tracks.filter((t) => t.id !== temp.id)
  refreshSoon()
  return !!ok
}

// A rollback vote against a waiting track (or taking it back). The track drops out as soon as the last vote it needs is
// in. If the server refuses, only this vote is put back, and its own reason is shown beside the list.
export async function vote(track: HijackTrack, undo = false) {
  const mine = me()
  if (!mine || track.id.startsWith('temp-')) return
  const setVote = (on: boolean) => {
    const others = game.hijack.vetoes.filter((v) => !(v.track_id === track.id && v.player_id === mine.id))
    game.hijack.vetoes = on ? [...others, { track_id: track.id, player_id: mine.id }] : others
  }
  setVote(!undo)
  const reply = await attempt('hijack', () => call<{ status: string }>('hijack-veto', { room_id: game.room!.id, track_id: track.id, undo }))
  if (!reply) setVote(undo)
  else if (reply.status === 'vetoed') game.hijack.tracks = game.hijack.tracks.map((t) => (t.id === track.id ? { ...t, status: 'vetoed' } : t))
  refreshSoon()
}

export const host = (action: 'remove' | 'top' | 'pause' | 'resume' | 'block_explicit' | 'allow_explicit', track?: HijackTrack) =>
  attempt('hijack-host', async () => (await call('hijack-host', { room_id: game.room!.id, action, track_id: track?.id }), refreshSoon()))

// The host's open app keeps the music fed too (the server timer does the same), so neither is the only thing between
// the room and silence. `reconnect` is told when the host's Spotify login needs making again. Returns a cleanup.
export function keepFed(code: string, reconnect: (needed: boolean) => void) {
  const tick = once(async () => {
    try {
      await call('hijack-feeder', { code })
      reconnect(false)
    } catch (e) {
      if (/reconnect/i.test((e as Error).message)) reconnect(true)
    }
  })
  tick()
  const timer = setInterval(() => document.hidden || tick(), 5000)
  return () => clearInterval(timer)
}
