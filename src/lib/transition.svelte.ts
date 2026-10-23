// The matrix rain that plays when the game moves to its next phase. The glyphs spell out what the phase is about.
export const transition = $state({ title: '', glyphs: '', run: 0 })

const phases: Record<string, { title: string; glyphs: string }> = {
  guess: { title: 'THE EXPERIMENT BEGINS', glyphs: 'SUBJECTS LOCKED IN MATCH EVERY SET TO ITS OWNER TRUST NO ONE' },
  results: { title: 'DECRYPTING THE RESULTS', glyphs: 'ALL GUESSES RECEIVED THE FINDINGS ARE IN SIGNAL LOCKED' },
}

// the room's 'reveal' and 'done' phases both open the results
export function playTransition(phase: string) {
  const next = phases[phase === 'reveal' || phase === 'done' ? 'results' : phase]
  if (!next || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  Object.assign(transition, next, { run: transition.run + 1 })
}
