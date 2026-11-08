import { practice } from './practice.svelte'
import type { Source } from './source-ids'
import { call, rpc, signIn, supabase } from './supabase'

export type Room = {
  id: string
  code: string
  host_user_id: string
  theme: string
  songs_per_player: number
  phase: 'submit' | 'guess' | 'reveal' | 'done'
  source: Source
  playlist_id: string | null
  playlist_url: string | null
  next_room_id?: string | null // set once the host starts the next experiment with this crew
  mode: 'game' | 'hijack' // a hijack party has no guessing: guests line songs up for the host's speaker
  now_item_id?: string | null // hijack party: what the host's speaker is playing
  now_title?: string | null
  now_artist?: string | null
  now_art?: string | null
  now_ends_at?: string | null
  now_duration_ms?: number | null
  host_offline?: boolean // hijack party: nothing is playing, or the host's Spotify has no active device
  suggestions_paused?: boolean
  block_explicit?: boolean // explicit tracks are not allowed in
}
export type HijackTrack = { id: string; item_id: string; title: string; artist: string; art: string | null; suggested_by: string | null; status: 'pending' | 'queued' | 'playing' | 'played' | 'vetoed'; sort_at: string }
export type HijackVeto = { track_id: string; player_id: string }
export type Player = { id: string; user_id: string; name: string }
export type Song = { id: string; pack: string | null; source: Source; item_id: string; title: string; artist: string; art_url: string | null; genres: string[] }
export type Item = { id: string; title: string; artist: string; art: string | null; blocked: boolean }
export type Guess = { song_id: string; guesser_id: string; guessed_player_id: string }
export type Pack = { id: string; songs: Song[] }

export const game = $state({
  userId: '',
  room: null as Room | null,
  players: [] as Player[],
  songs: [] as Song[],
  owners: {} as Record<string, string>, // song id -> player id; only what RLS lets this player see
  guesses: [] as Guess[],
  counts: {} as Record<string, number>, // songs locked in per player
  hijack: { tracks: [] as HijackTrack[], vetoes: [] as HijackVeto[] }, // hijack party: the line of songs and who voted against what
})

// A notice belongs to one spot on a screen (its scope), so it shows next to the control that caused it.
export const ui = $state({ notice: undefined as { scope: string; message: string } | undefined })

let dismiss: ReturnType<typeof setTimeout>

export function notify(scope: string, message: string) {
  ui.notice = { scope, message }
  clearTimeout(dismiss)
  dismiss = setTimeout(() => (ui.notice = undefined), 5000)
}

export function clearNotice(scope: string) {
  if (ui.notice?.scope === scope) ui.notice = undefined
}

export async function attempt<T>(scope: string, fn: () => Promise<T>) {
  clearNotice(scope)
  try {
    return await fn()
  } catch (e) {
    notify(scope, (e as Error).message)
  }
}

// ignores a repeat call while the first is still running
export function once<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  let busy = false
  return async (...args: A) => {
    if (busy) return
    busy = true
    try {
      await fn(...args)
    } finally {
      busy = false
    }
  }
}

export const savedName = () => {
  try {
    return localStorage.getItem('808s-name') ?? ''
  } catch {
    return ''
  }
}
export const saveName = (name: string) => {
  try {
    localStorage.setItem('808s-name', name.trim())
  } catch {}
}

// returns the room code once joined
export const joinGame = (code: string, name: string) =>
  attempt('join', async () => {
    const room = await rpc('join_room', { p_code: code, p_name: name })
    saveName(name)
    return room.code as string
  })

// Play again: the host starts the next experiment from a finished one, and everyone else joins it from their own
// results screen. Both land in the new room. Joining takes the name each person already had.
export const playAgain = (from: string, theme: string, title: string) =>
  attempt('again', async () => {
    const { room } = await call<{ room: { code: string } }>('create-room', { from_room: from, theme, title })
    location.hash = `/${room.code}`
  })

export const joinNext = (old: string) =>
  attempt('again', async () => {
    const room = await rpc('join_next_room', { p_old: old })
    location.hash = `/${room.code}`
  })

// one pack per person: the songs they added, in playlist order
export function packsOf(songs: Song[]): Pack[] {
  const packs = new Map<string, Song[]>()
  for (const s of songs) packs.set(s.pack!, [...(packs.get(s.pack!) ?? []), s])
  return [...packs].map(([id, list]) => ({ id, songs: list }))
}

export const me = () => game.players.find((p) => p.user_id === game.userId)
export const isHost = () => game.room?.host_user_id === game.userId
export const nameOf = (playerId?: string) => game.players.find((p) => p.id === playerId)?.name ?? '?'

const countsOf = (rows: { player_id: string; n: number }[]) => Object.fromEntries(rows.map((c) => [c.player_id, c.n]))

// Other players' songs are hidden until the guess phase, so their adds never arrive through realtime.
// While songs are being added, the screen asks for the counts on a timer instead.
export async function refreshCounts() {
  if (practice.on) return
  const { data } = await supabase.rpc('submission_counts', { p_room: game.room!.id })
  game.counts = countsOf(data ?? [])
}

async function refresh() {
  if (practice.on) return // practice has no server to reload from
  const id = game.room!.id
  const submitting = game.room!.phase === 'submit' && game.room!.mode !== 'hijack' // a hijack never counts songs
  const hijack = game.room!.mode === 'hijack'
  const [room, players, songs, owners, guesses, counts, tracks, vetoes] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).single(),
    supabase.from('players').select('id, user_id, name').eq('room_id', id).order('joined_at'),
    // a hijack has no songs, owners or guesses to load
    hijack ? { data: [] } : supabase.from('songs').select('id, pack, source, item_id, title, artist, art_url, genres').eq('room_id', id).order('position'),
    hijack ? { data: [] } : supabase.from('song_owners').select('song_id, player_id').eq('room_id', id),
    hijack ? { data: [] } : supabase.from('guesses').select('song_id, guesser_id, guessed_player_id').eq('room_id', id),
    submitting ? supabase.rpc('submission_counts', { p_room: id }) : { data: [] },
    // only what is still going on: finished tracks pile up all night, and a phone reloads this on every change
    hijack ? supabase.from('hijack_tracks').select('id, item_id, title, artist, art, suggested_by, status, sort_at').eq('room_id', id).in('status', ['pending', 'queued', 'playing']).order('sort_at') : { data: [] },
    hijack ? supabase.from('hijack_vetoes').select('track_id, player_id, hijack_tracks!inner(status)').eq('room_id', id).eq('hijack_tracks.status', 'pending') : { data: [] },
  ])
  if (room.error?.code === 'PGRST116') return location.reload() // this seat was taken over elsewhere
  game.room = room.data
  game.players = players.data ?? []
  game.songs = songs.data ?? []
  game.owners = Object.fromEntries((owners.data ?? []).map((o) => [o.song_id, o.player_id]))
  game.guesses = guesses.data ?? []
  game.counts = countsOf(counts.data ?? [])
  game.hijack = { tracks: (tracks.data ?? []) as HijackTrack[], vetoes: (vetoes.data ?? []) as HijackVeto[] }
}

// Several changes often land together, and a player's own write is followed by its realtime echo,
// so reload once for the burst. Realtime cannot report deletes for filtered tables, so writes
// call this too instead of relying on it.
let refreshTimer: ReturnType<typeof setTimeout>
export function refreshSoon() {
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(refresh, 150)
}

// Loads the room, keeps it fresh through realtime, and returns a cleanup. Null if this
// browser is not a member of the room.
export async function open(code: string) {
  if (practice.on) return (await import('../practice/seed')).seed(practice.stage)
  game.userId = (await signIn()).id
  game.room = null
  const { data } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
  if (!data) return null
  game.room = data
  await refresh()

  const channel = supabase.channel(`room-${data.id}`)
  for (const table of data.mode === 'hijack' ? ['rooms', 'players', 'hijack_tracks', 'hijack_vetoes'] : ['rooms', 'players', 'songs', 'guesses']) {
    const filter = table === 'rooms' ? `id=eq.${data.id}` : `room_id=eq.${data.id}`
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, refreshSoon)
  }
  channel.subscribe()

  // a phone suspends a backgrounded tab and its realtime connection, so catch up as soon as the player is back
  const comeBack = () => document.hidden || refreshSoon()
  document.addEventListener('visibilitychange', comeBack)
  window.addEventListener('pageshow', comeBack)
  return () => {
    document.removeEventListener('visibilitychange', comeBack)
    window.removeEventListener('pageshow', comeBack)
    clearTimeout(refreshTimer)
    supabase.removeChannel(channel)
  }
}
