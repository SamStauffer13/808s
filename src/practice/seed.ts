// Fills the game state for a stage, with only what a player may see at that point: songs stay anonymous until the reveal.
import { game, savedName, type Room } from '../lib/game.svelte'
import { practiceCode, type Stage } from '../lib/practice.svelte'
import { stampFor, stamps, statsOf } from '../lib/stamps'
import { guessesBy, me, order, players, playlist, sets, setSongs, songId, theme } from './data'

const room = (phase: Room['phase']): Room => ({
  id: 'practice',
  code: practiceCode,
  host_user_id: me.user_id,
  theme,
  songs_per_player: 1,
  phase,
  playlist_id: playlist.split('/').pop()!,
  playlist_url: playlist,
})

const songsInOrder = order.flatMap(setSongs)
const ownersOf = (among: number[]) => Object.fromEntries(among.map((set) => [songId(set), players[set].id]))

// the finished game: everyone has guessed every set, and every owner is known
const everyGuess = sets.flatMap((g) => guessesBy(g, sets))
const finished = () => ({ room: room('reveal'), songs: songsInOrder, owners: ownersOf(sets), guesses: everyGuess })

// (game.songs holds just your own songs while adding, the whole playlist while guessing.)
const seeds: Partial<Record<Stage, () => Partial<typeof game>>> = {
  // everyone else has added their song: add yours and "everyone's in"
  submit: () => ({
    room: room('submit'),
    songs: [],
    owners: {},
    counts: Object.fromEntries(players.map((p, i) => [p.id, i === 0 ? 0 : 1])),
  }),
  // everyone else has guessed everything; you have matched 3 of your 5, and only the right two crew members are left to pick
  guess: () => ({ room: room('guess'), songs: songsInOrder, owners: ownersOf([0]), guesses: guessesBy(0, [3, 5, 2]) }),
  results: finished,
}

// Returns what a room cleanup returns.
export function seed(stage: Stage) {
  players[0].name = savedName() || me.name // you are whoever you said you were
  game.userId = me.user_id
  Object.assign(game, { room: null, players: [], songs: [], owners: {}, guesses: [], counts: {} })
  Object.assign(game, { players }, seeds[stage]?.())
  return () => {}
}

// Every stamp in lib/stamps.ts must be earned by some set of the finished game, so practice always shows it.
// Add a stamp and this fails until the guesses in data.ts produce a set that earns it.
const earned = new Set(sets.map((set) => stampFor(statsOf(everyGuess.filter((g) => g.song_id === songId(set)), players[set].id))))
const missing = stamps.filter((stamp) => !earned.has(stamp))
if (missing.length) throw new Error(`the practice game has no set that earns: ${missing.join(', ')}`)
