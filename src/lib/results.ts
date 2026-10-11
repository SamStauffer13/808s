// Everything the scoreboard shows, worked out from the finished game. A plain function of the game state, so the
// screen only has to draw it. By the reveal everyone's guesses and every owner are visible, so the scores come from
// them directly.
import { packsOf, type Guess, type Player, type Song } from './game.svelte'
import { badges, stampFor, statsOf } from './stamps'

type State = { players: Player[]; songs: Song[]; owners: Record<string, string>; guesses: Guess[] }

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

export function analyze(game: State, meId?: string) {
  const nameOf = (id?: string) => game.players.find((p) => p.id === id)?.name ?? '?'

  // one file per subject: a person and the songs they added, with how the crew did and how you called it
  const files = packsOf(game.songs)
    .map((pack) => {
      const id = pack.songs[0].id
      const owner = game.owners[id]
      const guesses = game.guesses.filter((g) => g.song_id === id)
      const stats = statsOf(guesses, owner)
      const mine = guesses.find((g) => g.guesser_id === meId)
      return {
        id: owner ?? pack.id,
        name: nameOf(owner),
        yours: owner === meId,
        songs: pack.songs,
        guesses,
        stamp: stampFor(stats),
        ...stats,
        share: pct(stats.right, stats.guessers),
        call: mine ? { pick: mine.guessed_player_id, hit: mine.guessed_player_id === owner } : null,
      }
    })
    .sort((a, b) => b.share - a.share || b.guessers - a.guessers || a.name.localeCompare(b.name))

  const calls = files.filter((f) => f.call)
  const hits = calls.filter((f) => f.call!.hit).length
  const picks = new Map(files.flatMap((f) => f.guesses.map((g) => [`${g.guesser_id}:${f.id}`, g.guessed_player_id] as const)))

  // the leaderboard: sets matched right, then fewer guesses first, then name
  const scores = game.players
    .map((p) => {
      const theirs = files.filter((f) => f.id !== p.id)
      return {
        id: p.id,
        name: p.name,
        total: theirs.length,
        correct: theirs.filter((f) => picks.get(`${p.id}:${f.id}`) === f.id).length,
        guessed: theirs.filter((f) => picks.has(`${p.id}:${f.id}`)).length,
      }
    })
    .sort((a, b) => b.correct - a.correct || a.guessed - b.guessed || a.name.localeCompare(b.name))
  const top = scores[0]?.correct ?? 0
  const last = scores[scores.length - 1]?.correct
  const tiedLast = scores.filter((s) => s.correct === last)

  // who the crew blamed wrongly, and how often
  const wrong = new Map<string, number>()
  for (const f of files) for (const g of f.guesses) if (g.guessed_player_id !== f.id) wrong.set(g.guessed_player_id, (wrong.get(g.guessed_player_id) ?? 0) + 1)
  const most = Math.max(0, ...wrong.values())

  return {
    files,
    scores,
    top,
    winners: scores.filter((s) => s.correct === top),
    hits,
    guessed: calls.length,
    // only a perfect or a zero earns a title
    verdict:
      calls.length < 2 ? null
      : hits === calls.length ? { tag: badges.best, note: badges.perfect }
      : hits === 0 ? { tag: badges.worst, note: badges.zero }
      : null,
    // a crew-wide tie for last is not an award, so only one or two names qualify
    worst: scores.length > 1 && last < top && tiedLast.length <= 2 ? tiedLast : [],
    blamed: most < 2 ? [] : [...wrong].filter(([, count]) => count === most).map(([id]) => ({ name: nameOf(id), count: most })),
  }
}

export type Analysis = ReturnType<typeof analyze>
