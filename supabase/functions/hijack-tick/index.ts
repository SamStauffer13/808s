import { admin, same } from '../_shared/http.ts'
import { feed } from '../_shared/hijack.ts'

const RUN_MS = 55_000 // one scheduled run lasts about a minute
const STEP_MS = 500 // how often it checks whether any hijack is due a look
const IN_USE_HOURS = 2 // a hijack nobody has touched for this long is left alone until someone does
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

// The server timer for hijacks: the database calls this every minute (pg_cron) and it keeps the music fed in every
// hijack in use. Each hijack says when it wants its next look (feed() returns nextMs): rarely in the middle of a song,
// closely around the lock-in and the song change, so the room reacts quickly without hammering Spotify.
// The caller proves itself with the HIJACK_TICK_KEY secret; there is no user here, so this is not a signed-in call.
Deno.serve(async (req) => {
  const secret = Deno.env.get('HIJACK_TICK_KEY')
  if (!secret || !same(req.headers.get('x-tick-key') ?? '', secret)) return new Response('no', { status: 403 })

  const db = admin()
  const since = new Date(Date.now() - IN_USE_HOURS * 3_600_000).toISOString()
  const { data: busy } = await db.from('hijack_feed').select('room_id').gt('active_at', since)
  const due: Record<string, number> = Object.fromEntries((busy ?? []).map((b) => [b.room_id, 0])) // everyone is looked at once at the start
  const ran: Record<string, number> = {}
  if (Object.keys(due).length) await db.from('hijack_feed').update({ ticked_at: new Date().toISOString() }).in('room_id', Object.keys(due)) // the host's screen shows this

  const started = Date.now()
  while (Object.keys(due).length && Date.now() - started < RUN_MS) {
    const ids = Object.keys(due).filter((id) => due[id] <= Date.now())
    if (ids.length) {
      // looked at with their latest state, since the last look may have changed it
      const { data: rooms } = await db.from('rooms').select('*').in('id', ids).eq('mode', 'hijack')
      await Promise.all(
        (rooms ?? []).map(async (room) => {
          try {
            const result = (await feed(db, room)) as { nextMs?: number }
            ran[room.code] = (ran[room.code] ?? 0) + 1
            due[room.id] = Date.now() + (result.nextMs ?? 5000)
          } catch (e) {
            console.error(`hijack-tick ${room.code}:`, (e as Error).message) // e.g. the host's Spotify needs reconnecting
            delete due[room.id] // not again this run
          }
        }),
      )
      for (const id of ids) if (!(rooms ?? []).some((r) => r.id === id)) delete due[id]
    }
    await sleep(STEP_MS)
  }
  return new Response(JSON.stringify({ rooms: ran }), { headers: { 'Content-Type': 'application/json' } })
})
