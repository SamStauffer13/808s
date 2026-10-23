// The kinds of thing an experiment can be about. Kept apart from sources.ts so the code that only needs the names
// (the game's types, practice's address parsing) does not pull in the screens each source draws.
export const sourceIds = ['spotify', 'youtube'] as const
export type Source = (typeof sourceIds)[number]
export const isSource = (value: unknown): value is Source => (sourceIds as readonly unknown[]).includes(value)
