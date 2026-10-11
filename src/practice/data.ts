// What the practice game is made of: you and five crew members, and 12 tracks of a public Spotify playlist. Each player adds one song.
// Pure data, nothing here talks to a server.
import type { Guess, Song } from '../lib/game.svelte'

// you are the host; seed() swaps in the name the player typed
const names = ['Rookie', 'Cierra', 'Shilo', 'Dalton', 'Matt', 'Cole']
export const players = names.map((name, i) => ({ id: `p${i}`, user_id: `u${i}`, name }))
export const me = players[0]

export const theme = 'songs that sound like a road trip at 2am'
export const playlist = 'https://open.spotify.com/playlist/73MeoOPlro0bLPf2ScEvvZ'

// A one-time snapshot (titles, artists, cover art) of that playlist, so rows look like real ones.
// Set i (one song) belongs to player i and is track i; the rest are there to search for. Yours is whichever you pick.
export const tracks = [
  { id: '47oI62sCBPLsCVgcD2tr2z', title: 'Damaged Goods', artist: 'La Dispute', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a33cf1cbd5cd623a7d3c8e56' },
  { id: '31Hx0pInhn2tSq5gdhWv0d', title: 'Such Small Hands', artist: 'La Dispute', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02a33cf1cbd5cd623a7d3c8e56' },
  { id: '6p4jnIWFWyLz0zUo2RD9iu', title: "Baby, You Wouldn't Last A Minute On The Creek", artist: 'Chiodos', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02565a166b9f44fc0250f5769e' },
  { id: '6GKhlcZeyEW9Y5ZLZ37HZ3', title: 'The Words "Best Friend" Become Redefined', artist: 'Chiodos', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02565a166b9f44fc0250f5769e' },
  { id: '2D4LEUzvLRCQOLMxnajH72', title: "If I'm James Dean, You're Audrey Hepburn", artist: 'Sleeping With Sirens', art: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02032fd22bde573d0746c87352' },
  { id: '2Tc9VznHtQUmfOgE3L1RdN', title: "If You Can't Hang", artist: 'Sleeping With Sirens', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02800934f8144df91dae16b6e4' },
  { id: '6fTgbkBiMITtHUmik95ClX', title: 'MakeDamnSure', artist: 'Taking Back Sunday', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02cf43956aaef45eb4b1283e5a' },
  { id: '5wQnmLuC1W7ATsArWACrgW', title: 'Welcome to the Black Parade', artist: 'My Chemical Romance', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02663b6ce496144fa5c3670ac0' },
  { id: '23DHUWJ7iEieNPMPKvjzBV', title: 'Ohio Is For Lovers', artist: 'Hawthorne Heights', art: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e02b4b59e1dd1a9c0fa4dc27c61' },
  { id: '31hUonEmUsEVd0FMRv1s5r', title: 'Not Your Fault', artist: 'AWOLNATION', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0232f1572738340ddc9569c54b' },
  { id: '7MoHtlRxZ2cN9gfKg15eBg', title: 'Not The American Average', artist: 'Asking Alexandria', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02426885adbae74402b2faed65' },
  { id: '1XDleb5NksSab3NmUAlvz6', title: 'To Plant a Seed', artist: 'We Came As Romans', art: 'https://image-cdn-ak.spotifycdn.com/image/ab67616d00001e021a8ba9aa6ad6b8e8a15bd751' },
]

export const sets = players.map((_, i) => i)
const packId = (set: number) => `pack-${set}`
export const songId = (set: number) => `s${set}`

// the playlist order: which person's set comes up when
export const order = [3, 0, 5, 2, 1, 4]

// the track you added in the practice round, so the reveal shows your song and not a made-up one
const chosenKey = '808s-practice-song'
export const chosen = {
  get: () => sessionStorage.getItem(chosenKey),
  set: (id: string) => sessionStorage.setItem(chosenKey, id),
}
// the songs a search may offer: everything except what your crew already added
export const searchable = () => tracks.filter((t, i) => i === 0 || i >= sets.length)

const trackOf = (set: number) => (set === 0 && tracks.find((t) => t.id === chosen.get())) || tracks[set]

export const setSongs = (set: number): Song[] => {
  const t = trackOf(set)
  return [{ id: songId(set), pack: packId(set), spotify_id: t.id, title: t.title, artist: t.artist, art_url: t.art }]
}

// What each guesser got wrong, as pairs of sets they swapped (a swap makes both sets wrong, and keeps every
// guesser's picks valid: a crew member can only be matched to one set). Everything else is guessed correctly.
// This spread gives the reveal a MARKED set (0), an ANONYMOUS one (5) and a PROXIED one (3), a last place tied between
// two players (N00B) and Cole as the person everyone blamed (HONEYPOT).
const swaps: [number, number][][] = [
  [[5, 3]], // you
  [[5, 3]], // Cierra
  [[5, 3]], // Shilo
  [[5, 1], [2, 4]], // Dalton: only 1 right, so he and Matt tie for last
  [[5, 2], [1, 3]], // Matt
  [], // Cole: a perfect ear, so there is one clear winner
]

// who guesser g says made set s
function pick(g: number, s: number) {
  const pair = swaps[g].find((p) => p.includes(s))
  return pair ? pair[0] + pair[1] - s : s
}

// guesser g's guesses for the given sets (never their own)
export const guessesBy = (g: number, among: number[]): Guess[] =>
  among
    .filter((set) => set !== g)
    .map((set) => ({ song_id: songId(set), guesser_id: players[g].id, guessed_player_id: players[pick(g, set)].id }))

// like the real room_scores: a point for each set matched. Everyone guesses the same number of sets here,
// so there is no fewest-guesses tie-break; ties fall back to name.
export function scores() {
  return players
    .map((p, g) => {
      const guessed = sets.filter((set) => set !== g)
      return { player_id: p.id, name: p.name, correct: guessed.filter((set) => pick(g, set) === set).length, total: guessed.length }
    })
    .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name))
}

// a swap table that matches someone twice would make an impossible game: catch it here, not on screen
players.forEach((_, g) => {
  const picked = new Set(sets.filter((set) => set !== g).map((set) => pick(g, set)))
  if (picked.size !== names.length - 1 || picked.has(g)) throw new Error(`practice guesses for ${names[g]} match someone twice`)
})
