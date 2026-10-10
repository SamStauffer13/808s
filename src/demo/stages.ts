// The demo walks one fake game through the real screens. Each stage is a code (#/DEMO-SUBMIT, ...) and
// shows what the host sees at that point of a real game, with the other seven players already in.
import { game, type Room } from '../lib/game.svelte'
import { stampFor, stamps, statsOf } from '../lib/stamps'
import { guessesBy, me, order, players, playlist, sets, setSongs, songId, theme } from './data'

export const stages = ['home', 'invite', 'submit', 'guess', 'reveal', 'results'] as const
export type Stage = (typeof stages)[number]

export const codeOf = (stage: Stage) => (stage === 'home' ? 'DEMO' : `DEMO-${stage.toUpperCase()}`)
export const stageOf = (code: string): Stage => stages.find((stage) => codeOf(stage) === code) ?? 'home'

// what each step of the practice round tells a new player: what is happening, and one thing to try
export const captions: Record<Stage, { what: string; tryIt: string }> = {
  home: {
    what: 'THE HOST STARTS A GAME: PICK A VIBE, THEN CONNECT SPOTIFY SO THE PLAYLIST IS MADE IN THEIR ACCOUNT',
    tryIt: 'LOOK AT THE FORM. NOTHING HERE IS SAVED.',
  },
  invite: {
    what: 'FRIENDS GET A LINK FROM THE HOST. THEY NEED NO SPOTIFY ACCOUNT, JUST A NAME.',
    tryIt: 'TYPE A NAME AND TAP JOIN.',
  },
  submit: {
    what: 'EVERYONE ADDS SONGS THAT FIT THE VIBE. NOBODY SEES WHO ADDED WHAT.',
    tryIt: 'TYPE A SONG OR ARTIST IN THE SEARCH BOX, THEN TAP A RESULT TO ADD IT.',
  },
  guess: {
    what: 'THE HOST BEGINS THE EXPERIMENT. EVERYONE LISTENS TO THE PLAYLIST, THEN GUESSES WHO ADDED EACH BOX OF SONGS.',
    tryIt: 'TAP "WHO ADDED THESE?" ON A BOX AND PICK A FRIEND. EACH FRIEND MATCHES ONE BOX.',
  },
  reveal: {
    what: 'THE ANSWERS OPEN ONE BOX AT A TIME, SO YOU CAN SEE WHO FOOLED YOU.',
    tryIt: 'TAP NEXT SOURCE, OR SWIPE SIDEWAYS, TO STEP THROUGH THEM.',
  },
  results: {
    what: 'THE MOST RIGHT GUESSES WINS THE L33T TITLE. THEN GO THROUGH EVERY BOX SONG BY SONG.',
    tryIt: 'TAP A BAR IN THE CHART OR USE NEXT TO SEE WHO GUESSED EACH BOX RIGHT, THEN TAP START YOUR OWN.',
  },
}

const room = (phase: Room['phase']): Room => ({
  id: 'demo',
  code: 'DEMO',
  host_user_id: me.user_id,
  theme,
  songs_per_player: 2,
  phase,
  playlist_id: playlist.split('/').pop()!,
  playlist_url: playlist,
})

const songsInOrder = order.flatMap(setSongs)
const ownersOf = (among: number[]) => Object.fromEntries(among.flatMap((set) => [0, 1].map((n) => [songId(set, n), players[set].id])))

// the finished game: everyone has guessed every set, and every owner is known
const everyGuess = sets.flatMap((g) => guessesBy(g, sets))
const finished = () => ({ room: room('reveal'), songs: songsInOrder, owners: ownersOf(sets), guesses: everyGuess })

// Only what a player may see at that point: songs stay anonymous until the reveal.
// (game.songs holds just your own songs while adding, the whole playlist while guessing.)
const seeds: Partial<Record<Stage, () => Partial<typeof game>>> = {
  // you added 1 of your 2 songs and everyone else is done: add your last one and "everyone's in"
  submit: () => ({
    room: room('submit'),
    songs: setSongs(0).slice(0, 1),
    owners: ownersOf([0]),
    counts: Object.fromEntries(players.map((p, i) => [p.id, i === 0 ? 1 : 2])),
  }),
  // everyone else has guessed everything; you have matched 3 of your 7
  guess: () => ({ room: room('guess'), songs: songsInOrder, owners: ownersOf([0]), guesses: guessesBy(0, [3, 5, 2]) }),
  reveal: finished,
  results: finished,
}

// Fills the game state for a stage. Returns what a room cleanup returns, or null when this browser is not
// in the room yet (the invite stage), just like a real room you have not joined.
export function seed(stage: Stage) {
  game.userId = me.user_id
  Object.assign(game, { room: null, players: [], songs: [], owners: {}, guesses: [], counts: {} })
  if (stage === 'invite') return null
  Object.assign(game, { players }, seeds[stage]?.())
  return () => {}
}

// Every stamp in lib/stamps.ts must be earned by some set of the finished game, so the demo always shows it.
// Add a stamp and this fails until the guesses in data.ts produce a set that earns it.
const earned = new Set(sets.map((set) => stampFor(statsOf(everyGuess.filter((g) => g.song_id === songId(set, 0)), players[set].id))))
const missing = stamps.filter((stamp) => !earned.has(stamp))
if (missing.length) throw new Error(`the demo game has no set that earns: ${missing.join(', ')}`)
