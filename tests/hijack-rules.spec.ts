// The hijack's decisions, tested without a browser or a server: what the feeder does about each look at the host's
// player (the cases that went wrong in review), and the rules the app and the edge functions share.
import { expect, test } from '@playwright/test'
import { planFeed, type Playback, type Track } from '../supabase/functions/_shared/feed-plan'
import { isLinkName, LOCK_MS, STALE_QUEUE_MS, threshold } from '../supabase/functions/_shared/rules'

const NOW = Date.parse('2026-11-08T22:00:00Z')
const song = (id: string, left: number, playing = true): Playback => ({ is_playing: playing, progress_ms: 200_000 - left, item: { id, duration_ms: 200_000 } })
const track = (id: string, status: Track['status'], over: Partial<Track> = {}): Track => ({ id, item_id: `item-${id}`, status, sort_at: `2026-11-08T21:0${id}:00Z`, queued_at: null, ...over })
const plan = (playback: Playback, tracks: Track[] = [], room: Partial<{ now_item_id: string | null; now_ends_at: string | null; host_offline: boolean }> = {}) =>
  planFeed({ now: NOW, lockMs: LOCK_MS, staleMs: STALE_QUEUE_MS, driftMs: 3000, room: { now_item_id: null, now_ends_at: null, host_offline: false, ...room }, playback, tracks })

test.describe('feeder plan', () => {
  test('nothing playing: the room is told, once', () => {
    expect(plan(null).state).toBe('offline')
    expect(plan(null).writeRoom).toBe(true)
    expect(plan(null, [], { host_offline: true }).writeRoom).toBe(false) // already told
  })

  test('mid song: waits, queues nothing', () => {
    const p = plan(song('a', 120_000), [track('1', 'pending')])
    expect(p.state).toBe('waiting')
    expect(p.queue).toBeNull()
  })

  test('near the end: queues the front of the line, by position not age', () => {
    const p = plan(song('a', LOCK_MS - 1000), [track('1', 'pending'), track('2', 'pending', { sort_at: '2026-11-08T20:00:00Z' })]) // 2 was moved to the front
    expect(p.state).toBe('queue')
    expect(p.queue?.id).toBe('2')
  })

  test('paused near the end: does not queue', () => {
    expect(plan(song('a', 5000, false), [track('1', 'pending')]).state).toBe('waiting')
  })

  test('a track already on its way blocks the next one', () => {
    const p = plan(song('a', 5000), [track('1', 'queued', { queued_at: new Date(NOW - 20_000).toISOString() }), track('2', 'pending')])
    expect(p.state).toBe('queued')
    expect(p.queue).toBeNull()
  })

  test('the queued track that just started does not block the next one', () => {
    const p = plan(song('item-1', 5000), [track('1', 'queued', { queued_at: new Date(NOW - 190_000).toISOString() }), track('2', 'pending')])
    expect(p.queue?.id).toBe('2')
  })

  test('a skipped or cleared track goes stale and stops blocking (the stuck queue)', () => {
    const queued = track('1', 'queued', { queued_at: new Date(NOW - STALE_QUEUE_MS - 1000).toISOString() })
    const p = plan(song('a', 5000), [queued, track('2', 'pending')])
    expect(p.stale).toEqual(['1'])
    expect(p.queue?.id).toBe('2')
    // and not before it is stale
    expect(plan(song('a', 5000), [{ ...queued, queued_at: new Date(NOW - 60_000).toISOString() }, track('2', 'pending')]).queue).toBeNull()
  })

  test('nothing waiting: the host playlist carries on', () => {
    expect(plan(song('a', 5000), []).state).toBe('empty')
  })

  test('a new song, and how much the end time may wobble before it is written', () => {
    expect(plan(song('a', 100_000), [], { now_item_id: 'b' }).newSong).toBe(true)
    const ends = new Date(NOW + 100_000).toISOString()
    expect(plan(song('a', 101_500), [], { now_item_id: 'a', now_ends_at: ends }).writeRoom).toBe(false) // wobble
    expect(plan(song('a', 130_000), [], { now_item_id: 'a', now_ends_at: ends }).writeRoom).toBe(true) // the host scrubbed
    expect(plan(song('a', 100_000, false), [], { now_item_id: 'a', now_ends_at: ends }).writeRoom).toBe(true) // paused
  })
})

test.describe('shared rules', () => {
  test('rollbacks it takes: a third of the room, between 1 and 5', () => {
    expect([1, 3, 4, 6, 9, 15, 100].map(threshold)).toEqual([1, 1, 2, 2, 3, 5, 5])
  })

  test('link names: 3 to 12 capital letters or numbers, and not the setup address', () => {
    expect(['VINO', 'ROOF2', 'ABC'].every(isLinkName)).toBe(true)
    expect(['AB', 'WAYTOOLONGNAME1', 'has space', 'vino', 'SETUP', 'AB-1234'].some(isLinkName)).toBe(false)
  })
})
