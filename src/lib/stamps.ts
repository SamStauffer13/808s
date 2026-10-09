import type { Guess } from './game.svelte'

// What the room did with one set of songs.
export type SetStats = {
  guessers: number // how many people guessed it
  right: number // how many got the owner
  topWrong: number // votes for the most-picked wrong player
}

export function statsOf(guesses: Guess[], owner: string | undefined): SetStats {
  const wrong = new Map<string, number>()
  let right = 0
  for (const g of guesses) {
    if (g.guessed_player_id === owner) right++
    else wrong.set(g.guessed_player_id, (wrong.get(g.guessed_player_id) ?? 0) + 1)
  }
  return { guessers: guesses.length, right, topWrong: Math.max(0, ...wrong.values()) }
}

// A stamp for a set. The first rule that matches wins, so order them most to least notable.
// To add a stamp, add a line; to drop one, delete its line.
const rules: { tag: string; when: (s: SetStats) => boolean }[] = [
  { tag: 'DOXXED', when: (s) => s.right === s.guessers },
  { tag: 'UNTRACEABLE', when: (s) => s.right === 0 },
  { tag: 'PROXIED', when: (s) => s.topWrong > s.right },
]

export const stamps = rules.map((r) => r.tag)

// with only a couple of guessers, "everyone" and "nobody" are just luck
const minGuessers = 3

export function stampFor(stats: SetStats): string | null {
  if (stats.guessers < minGuessers) return null
  return rules.find((r) => r.when(stats))?.tag ?? null
}
