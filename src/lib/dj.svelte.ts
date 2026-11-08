// DJ party: the line of songs, the vote rules, and the actions guests and the host take. The server decides
// everything; the screen just updates first (optimistically) so a tap feels instant, then settles on what the
// server says.
import { attempt, game, me, notify, refreshSoon, type DjTrack, type Item } from './game.svelte'
import { call } from './supabase'

// the same rule as dj_threshold() in the database: a third of the room, between 1 and 3 votes
export const threshold = (players = game.players.length) => Math.max(1, Math.min(3, Math.ceil(players / 3)))

// how long before a song ends the next one is locked into Spotify's queue (mirrors LEAD_MS in dj-feeder)
export const LOCK_MS = 25_000

const byTime = (a: DjTrack, b: DjTrack) => a.created_at.localeCompare(b.created_at)

export const line = () => game.dj.tracks.filter((t) => t.status === 'pending').sort(byTime)
export const locked = () => game.dj.tracks.find((t) => t.status === 'queued')
export const playing = () => game.dj.tracks.find((t) => t.status === 'playing')
// the song in front of the room: locked in, otherwise whoever is first in line
export const upNext = () => locked() ?? line()[0]

export const votesOn = (trackId: string) => game.dj.vetoes.filter((v) => v.track_id === trackId).length
export const iVoted = (trackId: string) => game.dj.vetoes.some((v) => v.track_id === trackId && v.player_id === me()?.id)
export const myWaiting = () => line().find((t) => t.suggested_by === me()?.id)
export const positionOf = (trackId: string) => line().findIndex((t) => t.id === trackId) + 1

export const taken = (item: Item) => game.dj.tracks.some((t) => t.item_id === item.id && ['pending', 'queued', 'playing', 'played'].includes(t.status))

// puts a song in line: it shows up at once and is taken back if the server says no
export async function suggest(item: Item, scope: string) {
  if (!me()) return
  const temp: DjTrack = { id: `temp-${item.id}`, item_id: item.id, title: item.title, artist: item.artist, art: item.art, suggested_by: me()!.id, status: 'pending', created_at: new Date().toISOString() }
  game.dj.tracks = [...game.dj.tracks, temp]
  const ok = await attempt(scope, () => call('dj-suggest', { room_id: game.room!.id, item_id: item.id }))
  if (!ok) game.dj.tracks = game.dj.tracks.filter((t) => t.id !== temp.id)
  refreshSoon()
  return !!ok
}

// a vote against a waiting song (or taking it back). The song drops out as soon as the last vote it needs is in.
export async function vote(track: DjTrack, undo = false) {
  const mine = me()
  if (!mine || track.id.startsWith('temp-')) return
  const before = game.dj.vetoes
  game.dj.vetoes = undo ? before.filter((v) => !(v.track_id === track.id && v.player_id === mine.id)) : [...before, { track_id: track.id, player_id: mine.id }]
  const reply = await attempt(`vote-${track.id}`, () => call<{ status: string }>('dj-veto', { room_id: game.room!.id, track_id: track.id, undo }))
  if (!reply) {
    game.dj.vetoes = before
    notify('dj', 'That vote did not go through. Try again.')
  } else if (reply.status === 'vetoed') {
    game.dj.tracks = game.dj.tracks.map((t) => (t.id === track.id ? { ...t, status: 'vetoed' } : t))
  }
  refreshSoon()
}

export const host = (action: 'remove' | 'top' | 'pause' | 'resume' | 'block_explicit' | 'allow_explicit', track?: DjTrack) =>
  attempt('dj-host', async () => (await call('dj-host', { room_id: game.room!.id, action, track_id: track?.id }), refreshSoon()))
