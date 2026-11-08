// The rules a hijack runs on, in one place. Plain TypeScript with no imports, so the edge functions, the app and the
// tests all use this copy (the app imports it from here too).

// How long before a song ends the next one is locked into Spotify's queue. Its queue cannot be edited, so this is also
// when rollbacks close: late enough that the room has had its say, early enough that the speaker never goes quiet.
export const LOCK_MS = 25_000

// A track queued in Spotify that still has not started this long after is dropped: the host skipped it, cleared their
// queue or switched device, and it must not block the next track for good.
export const STALE_QUEUE_MS = 10 * 60_000

// A track that just played cannot be pushed again for this long, and a rolled-back one cannot be pushed straight back in.
export const REPEAT_MINUTES = 180
export const COOLDOWN_MINUTES = 30

// Rollbacks it takes to drop a track: a third of the room, between 1 and 5.
export const threshold = (players: number) => Math.max(1, Math.min(5, Math.ceil(players / 3)))

// A hijack's link name is its room code, so it cannot be one of the app's own addresses.
export const SETUP_LINK = 'SETUP'
export const isLinkName = (name: string) => /^[A-Z0-9]{3,12}$/.test(name) && name !== SETUP_LINK
