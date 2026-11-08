// Fills the game state for a stage, with only what a player may see at that point: songs stay anonymous until the reveal.
import { game, savedName, type Room } from '../lib/game.svelte'
import { practice, practiceCode, type Stage } from '../lib/practice.svelte'
import { stampFor, stamps, statsOf } from '../lib/stamps'
import { firstSong, HIJACK_NAME, startDemo } from './demo'
import { guessesBy, items, me, order, players, playlist, sets, setSongs, songId, theme } from './data'

const room = (phase: Room['phase']): Room => ({
  id: 'practice',
  code: practiceCode,
  source: practice.source,
  host_user_id: players[practice.role === 'guest' ? 1 : 0].user_id, // a crew member's host is Cierra
  theme: theme(),
  songs_per_player: 1,
  phase,
  playlist_id: playlist()?.split('/').pop() ?? null,
  playlist_url: playlist(),
  mode: 'game',
})

// A hijack in full swing: one song playing (not for long), three waiting (the second already has a rollback against it),
// and you have not pushed anything yet. Tracks come from items the practice search skips, so searching still finds new ones.
// Once it opens, the demo (demo.ts) carries on by itself.
const party = (): Partial<typeof game> => {
  const [a, b, c, playing] = [items()[1], items()[2], items()[3], items()[4]]
  const waiting = [
    { item: a, by: 2, ago: 30 },
    { item: b, by: 3, ago: 20 },
    { item: c, by: 4, ago: 10 },
  ]
  return {
    room: {
      ...room('submit'),
      mode: 'hijack',
      theme: HIJACK_NAME,
      now_item_id: playing.id,
      now_title: playing.title,
      now_artist: playing.artist,
      now_art: playing.art,
      now_duration_ms: firstSong().durationMs,
      now_ends_at: new Date(Date.now() + firstSong().leftMs).toISOString(),
      host_offline: false,
      suggestions_paused: false,
    },
    hijack: {
      tracks: waiting.map(({ item, by, ago }) => ({
        id: `t-${item.id}`,
        item_id: item.id,
        title: item.title,
        artist: item.artist,
        art: item.art,
        suggested_by: players[by].id,
        status: 'pending' as const,
        sort_at: new Date(Date.now() - ago * 1000).toISOString(),
      })),
      vetoes: [{ track_id: `t-${b.id}`, player_id: players[5].id }],
    },
  }
}

// read when a stage opens, not at load: the experiment can turn out to be about videos after this file has loaded
const songsInOrder = () => order.flatMap(setSongs)
const ownersOf = (among: number[]) => Object.fromEntries(among.map((set) => [songId(set), players[set].id]))

// the finished game: everyone has guessed every set, and every owner is known
const everyGuess = sets.flatMap((g) => guessesBy(g, sets))
const finished = () => ({ room: room('reveal'), songs: songsInOrder(), owners: ownersOf(sets), guesses: everyGuess })

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
  guess: () => ({ room: room('guess'), songs: songsInOrder(), owners: ownersOf([0]), guesses: guessesBy(0, [3, 5, 2]) }),
  results: finished,
  hijack: party,
}

// Returns what a room cleanup returns, or null when this browser is not in the room yet (the invite stage),
// just like a real room you have not joined.
export function seed(stage: Stage) {
  players[0].name = savedName() || me.name // you are whoever you said you were
  game.userId = me.user_id
  Object.assign(game, { room: null, players: [], songs: [], owners: {}, guesses: [], counts: {}, hijack: { tracks: [], vetoes: [] } })
  if (stage === 'invite' || stage === 'join') return null
  Object.assign(game, { players }, seeds[stage]?.())
  return stage === 'hijack' ? startDemo() : () => {}
}

// Every stamp in lib/stamps.ts must be earned by some set of the finished game, so practice always shows it.
// Add a stamp and this fails until the guesses in data.ts produce a set that earns it.
const earned = new Set(sets.map((set) => stampFor(statsOf(everyGuess.filter((g) => g.song_id === songId(set)), players[set].id))))
const missing = stamps.filter((stamp) => !earned.has(stamp))
if (missing.length) throw new Error(`the practice game has no set that earns: ${missing.join(', ')}`)
