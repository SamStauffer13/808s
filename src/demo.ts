// A made-up finished 8-player game, so the reveal and results can be seen without real players or a server.
// Open #/DEMO (the whole reveal) or #/DEMO-RESULTS (straight to the results), on the live site or in dev.
// Only fetched when one of those two codes is opened.
import { game, type Guess, type Song } from './lib/game.svelte'
import { stampFor, stamps, statsOf } from './lib/stamps'
import { fake } from './lib/supabase'

const names = ['DRE', 'DILLA', 'PHARRELL', 'TIMBALAND', 'METRO', 'MADLIB', 'KAYTRANADA', 'RZA']
const players = names.map((name, i) => ({ id: `p${i}`, user_id: `u${i}`, name }))

// A snapshot of 16 tracks from a public Spotify playlist (titles, artists, cover art), so the rows look like
// real ones. Two songs per person; set i belongs to player i.
const playlist = 'https://open.spotify.com/playlist/73MeoOPlro0bLPf2ScEvvZ'
const tracks = [
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
  { id: '4bPQs0PHn4xbipzdPfn6du', title: 'I Write Sins Not Tragedies', artist: 'Panic! At The Disco', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e023ab3ff3559d2664560e1fdb4' },
  { id: '2sJLu1DT9CQ5MrwZ63tmVH', title: 'Good Will Hunting By Myself', artist: 'Ludo', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e024e3413f1cd13e8c36ba988bc' },
  { id: '1Bv3h7Vc4AaYA2BcSM3rVd', title: 'All I Wanted', artist: 'Paramore', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e02e01d7d558032457b0e4883f6' },
  { id: '46fyLy4W9HhAkcb67kLaAV', title: 'Tourniquet', artist: 'Evanescence', art: 'https://image-cdn-fa.spotifycdn.com/image/ab67616d00001e0225f49ab23f0ec6332efef432' },
]

// the reveal order: which person's set comes up when
const order = [3, 0, 5, 2, 1, 7, 4, 6]

// What each guesser got wrong, as pairs of sets they swapped (a swap makes both sets wrong, and keeps every
// guesser's picks valid: a friend can only be matched to one set). Everything else is guessed correctly.
// This spread gives the reveal a DOXXED set (1), an UNTRACEABLE one (6) and a PROXIED one (7).
const swaps: [number, number][][] = [
  [[6, 7], [3, 4]], // DRE
  [[6, 7], [2, 3]], // DILLA
  [[6, 7], [0, 5]], // PHARRELL
  [[6, 7], [4, 5]], // TIMBALAND
  [[6, 3]], // METRO
  [[6, 2], [0, 3]], // MADLIB
  [], // KAYTRANADA: perfect ear
  [[6, 5]], // RZA
]

const sets = Array.from({ length: names.length }, (_, s) => s)
const pack = (set: number) => `pack-${set}`
const songId = (set: number, n: number) => `s${set}-${n}`
const songs: Song[] = order.flatMap((set) =>
  [0, 1].map((n) => ({
    id: songId(set, n),
    pack: pack(set),
    spotify_id: tracks[set * 2 + n].id,
    title: tracks[set * 2 + n].title,
    artist: tracks[set * 2 + n].artist,
    art_url: tracks[set * 2 + n].art,
  })),
)

// who guesser g says made set s
function pick(g: number, s: number) {
  const pair = swaps[g].find((p) => p.includes(s))
  return pair ? pair[0] + pair[1] - s : s
}

// everyone guesses every set but their own, both songs of a set getting the same answer
const guesses: Guess[] = players.flatMap((guesser, g) =>
  sets
    .filter((set) => set !== g)
    .flatMap((set) => [0, 1].map((n) => ({ song_id: songId(set, n), guesser_id: guesser.id, guessed_player_id: players[pick(g, set)].id }))),
)

// like the real room_scores: a point for each set matched. Everyone guesses the same number of sets here,
// so there is no fewest-guesses tie-break; ties fall back to name.
function scores() {
  return players
    .map((p, g) => {
      const guessed = sets.filter((set) => set !== g)
      return { player_id: p.id, name: p.name, correct: guessed.filter((set) => pick(g, set) === set).length, total: guessed.length }
    })
    .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name))
}

export function loadDemo() {
  // a friend can only be matched to one set: catch a bad table here, not on screen
  players.forEach((_, g) => {
    const targets = new Set(sets.filter((set) => set !== g).map((set) => pick(g, set)))
    if (targets.size !== names.length - 1 || targets.has(g)) throw new Error(`demo guesses for ${names[g]} match someone twice`)
  })

  // every stamp in lib/stamps.ts must show up somewhere in the demo: add a set that earns any new one
  const earned = new Set(players.map((p, s) => stampFor(statsOf(guesses.filter((g) => g.song_id === songId(s, 0)), p.id))))
  const missing = stamps.filter((tag) => !earned.has(tag))
  if (missing.length) throw new Error(`the demo game has no set that earns: ${missing.join(', ')}`)

  game.userId = 'u0'
  game.room = {
    id: 'demo',
    code: 'DEMO',
    host_user_id: 'u0',
    theme: 'songs that sound like a road trip at 2am',
    songs_per_player: 2,
    phase: 'reveal',
    playlist_id: playlist.split('/').pop()!,
    playlist_url: playlist,
  }
  game.players = players
  game.songs = songs
  game.owners = Object.fromEntries(sets.flatMap((set) => [0, 1].map((n) => [songId(set, n), players[set].id])))
  game.guesses = guesses
  game.counts = {}
  fake.room_scores = scores
  return () => delete fake.room_scores
}
