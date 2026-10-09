import { rpc, signIn, supabase } from './supabase'

export type Room = {
  id: string
  code: string
  host_user_id: string
  theme: string
  songs_per_player: number
  phase: 'submit' | 'guess' | 'reveal' | 'done'
  playlist_id: string | null
  playlist_url: string | null
}
type Player = { id: string; user_id: string; name: string }
export type Song = { id: string; pack: string | null; spotify_id: string; title: string; artist: string; art_url: string | null }
export type Track = { id: string; title: string; artist: string; art: string | null; blocked: boolean }
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

export const savedName = () => localStorage.getItem('808s-name') ?? ''
export const saveName = (name: string) => localStorage.setItem('808s-name', name.trim())

// returns the room code once joined
export const joinGame = (code: string, name: string) =>
  attempt('join', async () => {
    const room = await rpc('join_room', { p_code: code, p_name: name })
    saveName(name)
    return room.code as string
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

// #/DEMO and #/DEMO-<STAGE> open the demo (src/demo): the real screens on a fake game and a fake server.
// Real room codes look like AB-1234, so they can never match.
export const isDemo = (code: string) => code === 'DEMO' || code.startsWith('DEMO-')

export async function refresh() {
  if (isDemo(game.room!.code)) return // the demo has no server to reload from
  const id = game.room!.id
  const submitting = game.room!.phase === 'submit'
  const [room, players, songs, owners, guesses, counts] = await Promise.all([
    supabase.from('rooms').select('*').eq('id', id).single(),
    supabase.from('players').select('id, user_id, name').eq('room_id', id).order('joined_at'),
    supabase.from('songs').select('id, pack, spotify_id, title, artist, art_url').eq('room_id', id).order('position'),
    supabase.from('song_owners').select('song_id, player_id').eq('room_id', id),
    supabase.from('guesses').select('song_id, guesser_id, guessed_player_id').eq('room_id', id),
    submitting ? supabase.rpc('submission_counts', { p_room: id }) : { data: [] },
  ])
  if (room.error?.code === 'PGRST116') return location.reload() // this seat was taken over elsewhere
  game.room = room.data
  game.players = players.data ?? []
  game.songs = songs.data ?? []
  game.owners = Object.fromEntries((owners.data ?? []).map((o) => [o.song_id, o.player_id]))
  game.guesses = guesses.data ?? []
  game.counts = Object.fromEntries((counts.data ?? []).map((c: { player_id: string; n: number }) => [c.player_id, c.n]))
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
  if (isDemo(code)) {
    const { seed, stageOf } = await import('../demo/stages')
    return seed(stageOf(code))
  }
  game.userId = (await signIn()).id
  game.room = null
  const { data } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
  if (!data) return null
  game.room = data
  await refresh()

  const channel = supabase.channel(`room-${data.id}`)
  for (const table of ['rooms', 'players', 'songs', 'guesses']) {
    const filter = table === 'rooms' ? `id=eq.${data.id}` : `room_id=eq.${data.id}`
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, refreshSoon)
  }
  channel.subscribe()
  return () => {
    clearTimeout(refreshTimer)
    supabase.removeChannel(channel)
  }
}
