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
const rules: { tag: string; note: string; when: (s: SetStats) => boolean }[] = [
  { tag: 'MARKED', note: 'EVERYONE GOT IT RIGHT', when: (s) => s.right === s.guessers },
  { tag: 'ANONYMOUS', note: 'NOBODY GOT IT RIGHT', when: (s) => s.right === 0 },
  { tag: 'PROXIED', note: 'MOST PEOPLE PICKED THE SAME WRONG PERSON', when: (s) => s.topWrong > s.right },
]

// Every other tag on the scoreboard, in one place. Two families, so a word always means one thing:
// - the GUESSER: L33T is a great guesser (the winner, or a perfect score) and N00B is a bad one (a zero score, or last place)
// - the PERSON BEING GUESSED: the stamps above, and HONEYPOT, the person the crew blamed wrongly most often
export const badges = {
  best: 'L33T',
  worst: 'N00B',
  blamed: 'HONEYPOT',
  perfect: 'EVERY SINGLE ONE. ARE YOU IN THEIR HEADS?',
  zero: 'NOT ONE. YOU DO NOT KNOW THESE PEOPLE.',
}

export const stamps = rules.map((r) => r.tag)
export const noteOf = (tag: string) => rules.find((r) => r.tag === tag)?.note

// with only a couple of guessers, "everyone" and "nobody" are just luck
const minGuessers = 3

export function stampFor(stats: SetStats): string | null {
  if (stats.guessers < minGuessers) return null
  return rules.find((r) => r.when(stats))?.tag ?? null
}
