// The hijack: the line of tracks, who voted what, and what guests and the host can do. The server decides everything;
// the screen updates first (optimistically) so a tap feels instant, then settles on what the server says.
import { LOCK_MS, threshold as votesNeeded } from '../../supabase/functions/_shared/rules'
import { attempt, game, me, notify, type HijackTrack, type Item } from './game.svelte'
import { practice } from './practice.svelte'
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

// Roughly when a waiting track will play: what is left of the song on now, plus the locked-in and waiting tracks ahead of it.
// (The host's own playlist never gets in the way, since a pushed track plays before it resumes.) Null if it is not in line.
const AVERAGE_TRACK_MS = 3.5 * 60_000
export function etaMs(trackId: string, now: number) {
  const ends = game.room?.now_ends_at ? Date.parse(game.room.now_ends_at) : null
  let wait = ends ? Math.max(0, ends - now) : 0
  for (const t of [...(locked() ? [locked()!] : []), ...line()]) {
    if (t.id === trackId) return wait
    wait += t.duration_ms ?? AVERAGE_TRACK_MS
  }
  return null
}
export const aboutMinutes = (ms: number) => (ms < 60_000 ? 'UNDER A MINUTE' : `ABOUT ${Math.round(ms / 60_000)} MIN`)

// already in the room right now (the server also keeps a track that just played from coming straight back)
export const taken = (item: Item) => game.hijack.tracks.some((t) => t.item_id === item.id)

// puts a track in line: it shows up at once and is taken back if the server says no
export async function suggest(item: Item, scope: string) {
  if (!me()) return
  const temp: HijackTrack = { id: `temp-${item.id}`, item_id: item.id, title: item.title, artist: item.artist, art: item.art, suggested_by: me()!.id, status: 'pending', sort_at: new Date().toISOString(), duration_ms: item.durationMs ?? null }
  game.hijack.tracks = [...game.hijack.tracks, temp]
  const ok = await attempt(scope, () => call('hijack-suggest', { room_id: game.room!.id, item_id: item.id }))
  if (!ok) game.hijack.tracks = game.hijack.tracks.filter((t) => t.id !== temp.id)
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
}

// A guest votes to skip the song on. It is skipped once as many have voted as it takes to roll a track back.
export async function voteSkip() {
  const reply = await attempt('hijack', () => call<{ skipped: boolean; votes: number; needed: number }>('hijack-skip', { room_id: game.room!.id }))
  if (!reply) return
  if (!reply.skipped) notify('hijack', `${reply.votes} OF ${reply.needed} VOTES TO SKIP`)
}

type HostAction = 'remove' | 'top' | 'pause' | 'resume' | 'block_explicit' | 'allow_explicit' | 'skip' | 'play_now'
export async function host(action: HostAction, track?: HijackTrack) {
  const ok = await attempt('hijack-host', () => call('hijack-host', { room_id: game.room!.id, action, track_id: track?.id }))
  // cutting in changes what is playing, so look at the player a moment later instead of waiting for the next look
  if (ok && (action === 'skip' || action === 'play_now') && !practice.on) setTimeout(() => call('hijack-feeder', { code: game.room!.code }).catch(() => {}), 900)
}

// The host's open app keeps the music fed too (the server timer does the same), so neither is the only thing between
// the room and silence. Each answer says when the next look is worth making (soon around a song change, later in the
// middle of one). `report` is told whether the host's Spotify login needs making again, and how long ago the server timer
// last looked after this hijack (null: never), so the host knows whether it is safe to close this screen. Returns a cleanup.
export function keepFed(code: string, report: (status: { reconnect: boolean; timerAgoMs: number | null; problem?: string }) => void) {
  let timer: ReturnType<typeof setTimeout>
  let stopped = false
  const look = async () => {
    let wait = 5000
    if (!document.hidden) {
      try {
        const { nextMs, timerAgoMs } = await call<{ nextMs?: number; timerAgoMs?: number | null }>('hijack-feeder', { code })
        report({ reconnect: false, timerAgoMs: timerAgoMs ?? null })
        wait = nextMs ?? wait
      } catch (e) {
        const message = (e as Error).message
        if (/reconnect/i.test(message)) report({ reconnect: true, timerAgoMs: null })
        else if (/spotify|premium|playing/i.test(message)) report({ reconnect: false, timerAgoMs: null, problem: message }) // not a dropped connection: something the host can fix
      }
    }
    if (!stopped) timer = setTimeout(look, wait)
  }
  look()
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}