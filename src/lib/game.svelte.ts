import { rpc, signIn, supabase } from './supabase'

export type Room = {
  id: string
  code: string
  host_user_id: string
  theme: string
  songs_per_player: number
  phase: 'lobby' | 'submit' | 'guess' | 'reveal' | 'done'
  playlist_id: string | null
  playlist_url: string | null
  reveal_index: number
}
type Player ={ id: string; user_id: string; name: string }
export type Song = { id: string; pack: string | null; spotify_id: string; title: string; artist: string; art_url: string | null }
export type Track = { id: string; title: string; artist: string; art: string | null }
export type Guess ={ song_id: string; guesser_id: string; guessed_player_id: string }

export const game = $state({
  userId: '',
  room: null as Room | null,
  players: [] as Player[],
  songs: [] as Song[],
  owners: {} as Record<string, string>, // song id -> player id; only what RLS lets this player see
  guesses: [] as Guess[],
  counts: {} as Record<string, number>, // songs locked in per player
})

export const ui = $state({ error: '' })

let dismiss: ReturnType<typeof setTimeout>

export async function attempt<T>(fn: () => Promise<T>) {
  ui.error = ''
  try {
    return await fn()
  } catch (e) {
    ui.error = (e as Error).message
    clearTimeout(dismiss)
    dismiss = setTimeout(() => (ui.error = ''), 5000)
  }
}

// ignores a repeat call while the first is still running
export function once(fn: () => Promise<unknown>) {
  let busy = false
  return async () => {
    if (busy) return
    busy = true
    try {
      await fn()
    } finally {
      busy = false
    }
  }
}

export const savedName =() => localStorage.getItem('808s-name') ?? ''
export const saveName = (name: string) => localStorage.setItem('808s-name', name.trim())

// returns the game code once joined
export const joinGame = (code: string, name: string) =>
  attempt(async () => {
    const room = await rpc('join_room', { p_code: code, p_name: name })
    saveName(name)
    return room.code as string
  })

// one pack per person: the songs they added, in playlist order
export function packsOf(songs: Song[]) {
  const packs = new Map<string, Song[]>()
  for (const s of songs) packs.set(s.pack!, [...(packs.get(s.pack!) ?? []), s])
  return [...packs].map(([id, list]) => ({ id, songs: list }))
}

export const me = () => game.players.find((p) => p.user_id === game.userId)
export const isHost = () => game.room?.host_user_id === game.userId
export const nameOf = (playerId?: string) => game.players.find((p) => p.id === playerId)?.name ?? '?'

export async function refresh() {
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
  game.room = room.data
  game.players = players.data ?? []
  game.songs = songs.data ?? []
  game.owners = Object.fromEntries((owners.data ?? []).map((o) => [o.song_id, o.player_id]))
  game.guesses = guesses.data ?? []
  game.counts = Object.fromEntries((counts.data ?? []).map((c: { player_id: string; n: number }) => [c.player_id, c.n]))
}

// Loads the room, keeps it fresh through realtime, and returns a cleanup. Null if this
// browser is not a member of the room.
export async function open(code: string) {
  game.userId = (await signIn()).id
  game.room = null
  const { data } = await supabase.from('rooms').select('*').eq('code', code).maybeSingle()
  if (!data) return null
  game.room = data
  await refresh()

  // several changes often land together, so reload once for the burst
  let timer: ReturnType<typeof setTimeout>
  const queue = () => {
    clearTimeout(timer)
    timer = setTimeout(refresh, 150)
  }

  const channel = supabase.channel(`room-${data.id}`)
  for (const table of ['rooms', 'players', 'songs', 'guesses']) {
    const filter = table === 'rooms' ? `id=eq.${data.id}` : `room_id=eq.${data.id}`
    channel.on('postgres_changes', { event: '*', schema: 'public', table, filter }, queue)
  }
  channel.subscribe()
  return () => {
    clearTimeout(timer)
    supabase.removeChannel(channel)
  }
}
