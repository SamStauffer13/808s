// The demo walks one fake game through the real screens. Each stage is a code (#/demo-submit, ...) and
// shows what the host sees at that point of a real game, with the other seven players already in.
import { game, type Room } from '../lib/game.svelte'
import { stampFor, stamps, statsOf } from '../lib/stamps'
import { guessesBy, me, order, players, playlist, sets, setSongs, songId, theme } from './data'

export const stages = ['home', 'invite', 'submit', 'guess', 'reveal', 'results'] as const
export type Stage = (typeof stages)[number]

// what the bar calls each stage (the order is not a count: a real game has many more taps than six)
export const titles: Record<Stage, string> = {
  home: 'START A GAME',
  invite: 'FRIENDS JOIN',
  submit: 'ADD SONGS',
  guess: 'GUESS',
  reveal: 'THE REVEAL',
  results: 'RESULTS',
}

export const codeOf = (stage: Stage) => (stage === 'home' ? 'demo' : `demo-${stage}`)
export const stageOf = (code: string): Stage => stages.find((stage) => codeOf(stage) === code) ?? 'home'

// The walkthrough: for each stage, the things to touch in order. `target` is a CSS selector for the real element
// on that screen (src/demo/Tour.svelte points at it), so a screen that changes its markup must update it here.
// where the walkthrough remembers its place, so the trip through the (fake) Spotify login does not restart it
export const tourKey = '808s-tour'

// `again`: after this prompt is done, go back to prompt number `to` while something matching `while` is still on the screen
// `gone`: the prompt is done when its target leaves the screen (the reveal turns into the results on the same address)
// `when`: the prompt is done as soon as something matching this shows up (search results appear while you type)
// `required`: the practice round will not let the form go on until this box is filled, even if the real one allows it
// A prompt on a text box is done when the box has been filled in and left; on anything else, when it is tapped.
export type Prompt = { target: string; text: string; again?: { to: number; while: string }; gone?: boolean; when?: string; required?: boolean }

const results: Prompt[] = [
  { target: '.panel.framed', text: 'SEE WHO WON, THEN TAP HERE.' },
  { target: '.chart', text: 'TAP A BAR TO OPEN THAT BOX OF SONGS.' },
  { target: '.pager .btn:last-child', text: 'TAP NEXT TO STEP THROUGH EVERY SONG.' },
  { target: 'a.btn', text: 'TAP HERE TO START YOUR OWN GAME.' },
]

export const tour: Record<Stage, Prompt[]> = {
  home: [
    { target: 'form label.field:nth-of-type(1) input', text: 'TYPE YOUR NAME, THEN TAP THE NEXT BOX.' },
    { target: 'form label.field:nth-of-type(2) input', text: 'TYPE A VIBE FOR THE SONGS, LIKE A ROAD TRIP AT 2AM, THEN TAP AWAY.' },
    { target: 'form label.field:nth-of-type(3) input', text: 'NAME YOUR PLAYLIST, LIKE MAKEUP IS WAR PAINT, THEN TAP AWAY.', required: true },
    { target: 'form .btn', text: 'TAP THE GREEN BUTTON TO CONNECT SPOTIFY, THEN TAP IT AGAIN TO CREATE THE GAME.' },
  ],
  invite: [
    { target: '.panel.framed', text: 'THIS IS WHAT YOUR FRIENDS SEE, SO TAP HERE TO JOIN AS ONE OF THEM.' },
    { target: 'form input', text: 'TYPE YOUR NAME, THEN TAP AWAY.' },
    { target: 'form .btn', text: 'TAP JOIN TO PICK YOUR SONGS.' },
  ],
  submit: [
    { target: 'label.field input', text: 'SEARCH FOR A SONG THAT FITS THE VIBE, ANY WORD WORKS HERE.', when: 'button.row:not([disabled])' },
    { target: 'button.row:not([disabled])', text: 'TAP A SONG TO ADD IT.' },
    { target: 'button.btn:not(.ghost):not([disabled])', text: 'TAP BEGIN THE EXPERIMENT TO START THE GUESSING.' },
  ],
  guess: [
    { target: '.framed', text: 'LISTEN TO THE SHUFFLED PLAYLIST, THEN TAP HERE.' },
    { target: '.panel button.row:not(.on)', text: 'TAP A BOX OF SONGS TO GUESS WHO ADDED IT.' },
    { target: '.chips', text: 'PICK THE FRIEND YOU THINK ADDED THOSE SONGS.', again: { to: 1, while: '.panel button.row:not(.on)' } },
  ],
  reveal: [
    { target: '.panel.framed', text: 'SEE WHO REALLY ADDED THE SONGS, THEN TAP HERE.' },
    { target: '.guesses', text: 'SEE WHO GUESSED WHAT, THEN TAP HERE.' },
    { target: '.dock .btn:last-child', text: 'TAP NEXT SOURCE TO STEP THROUGH EVERY BOX.', gone: true },
    ...results, // finishing the reveal opens the results without leaving this address
  ],
  results,
}

const room = (phase: Room['phase']): Room => ({
  id: 'demo',
  code: 'demo',
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
  // everyone else has guessed everything; you have matched 5 of your 7
  guess: () => ({ room: room('guess'), songs: songsInOrder, owners: ownersOf([0]), guesses: guessesBy(0, [3, 5, 2, 6, 1]) }),
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
