// The demo walks one fake game through the real screens. Each stage is a code (#/demo-submit, ...) and
// shows what the host sees at that point of a real game, with the other seven players already in.
import { game, type Room } from '../lib/game.svelte'
import { stampFor, stamps, statsOf } from '../lib/stamps'
import { guessesBy, me, order, players, playlist, sets, setSongs, songId, theme } from './data'

export const stages = ['home', 'invite', 'submit', 'guess', 'reveal', 'results'] as const
export type Stage = (typeof stages)[number]

export const codeOf = (stage: Stage) => (stage === 'home' ? 'demo' : `demo-${stage}`)
export const stageOf = (code: string): Stage => stages.find((stage) => codeOf(stage) === code) ?? 'home'

// The walkthrough: for each stage, the things to touch in order. `target` is a CSS selector for the real element
// on that screen (src/demo/Tour.svelte points at it), so a screen that changes its markup must update it here.
// where the walkthrough remembers its place, so the trip through the (fake) Spotify login does not restart it
export const tourKey = '808s-tour'

export type Prompt = { target: string; text: string; why: string }

export const tour: Record<Stage, Prompt[]> = {
  home: [
    { target: 'form label.field:nth-of-type(1) input', text: 'TYPE YOUR NAME', why: 'THE HOST STARTS A GAME. THIS IS HOW FRIENDS SEE YOU.' },
    { target: 'form label.field:nth-of-type(2) input', text: 'PICK A VIBE', why: 'EVERY SONG ADDED SHOULD FIT IT.' },
    { target: 'form button.link', text: 'HOW MANY SONGS EACH?', why: 'EVERYONE ADDS THE SAME NUMBER.' },
    { target: 'form .btn', text: 'TAP TO CONTINUE', why: "THE PLAYLIST IS MADE IN THE HOST'S SPOTIFY, SO THE HOST LOGS IN FIRST. FRIENDS NEED NO ACCOUNT." },
  ],
  invite: [
    { target: 'form input', text: 'TYPE YOUR NAME', why: "FRIENDS JOIN FROM THE HOST'S LINK. NO SPOTIFY ACCOUNT NEEDED." },
    { target: 'form .btn', text: 'JOIN THE GAME', why: "YOU'LL LAND ON THE SONG PICKER." },
  ],
  submit: [
    { target: 'label.field input', text: 'SEARCH FOR A SONG', why: 'ONE THAT FITS THE VIBE ABOVE. TYPE ANYTHING: THE PRACTICE SEARCH ALWAYS FINDS SOME.' },
    { target: 'button.row:not([disabled])', text: 'TAP A RESULT TO ADD IT', why: 'NOBODY SEES WHO ADDED WHAT UNTIL THE REVEAL.' },
  ],
  guess: [
    { target: '.framed', text: 'LISTEN TO THE PLAYLIST', why: "IT'S EVERYONE'S SONGS, SHUFFLED, IN THE HOST'S SPOTIFY." },
    { target: '.panel button.row:not(.on)', text: 'WHO ADDED THESE?', why: 'EACH BOX OF SONGS WAS ADDED BY ONE FRIEND. TAP TO CHOOSE.' },
    { target: '.chips', text: 'PICK A FRIEND', why: 'EACH FRIEND MATCHES ONE BOX. THE LAST GUESS OPENS THE REVEAL.' },
  ],
  reveal: [
    { target: '.panel.framed', text: 'THE ADDER IS DECRYPTED', why: 'THIS IS WHO REALLY ADDED THE SONGS ABOVE.' },
    { target: '.guesses', text: 'WHO GUESSED WHAT', why: '✓ GOT IT RIGHT · ✗ GOT IT WRONG, WITH THEIR PICK.' },
    { target: '.dock .btn', text: 'NEXT SOURCE', why: 'OR SWIPE SIDEWAYS. SKIP TO RESULTS ANY TIME.' },
  ],
  results: [
    { target: '.panel.framed', text: 'THE WINNER', why: 'THE MOST RIGHT GUESSES WINS THE L33T TITLE.' },
    { target: '.chart', text: 'HOW THE ROOM DID', why: 'ONE BAR PER BOX OF SONGS. TAP A BAR TO OPEN IT.' },
    { target: '.pager .btn:last-child', text: 'STEP THROUGH EVERY SONG', why: 'SEE WHO GUESSED RIGHT OR WRONG ON EACH ONE.' },
  ],
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
