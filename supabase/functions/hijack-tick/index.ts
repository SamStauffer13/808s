import { admin, same } from '../_shared/http.ts'
import { feed } from '../_shared/hijack.ts'

const PASSES = 11 // one scheduled run lasts about a minute, looking every 5 seconds
const IN_USE_HOURS = 2 // a hijack nobody has touched for this long is left alone until someone does
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

// The server timer for hijacks: the database calls this every minute (pg_cron) and it keeps the music fed in every
// hijack in use. A room whose speaker is off is only looked at once per run, not every 5 seconds.
// The caller proves itself with the HIJACK_TICK_KEY secret; there is no user here, so this is not a signed-in call.
Deno.serve(async (req) => {
  const secret = Deno.env.get('HIJACK_TICK_KEY')
  if (!secret || !same(req.headers.get('x-tick-key') ?? '', secret)) return new Response('no', { status: 403 })

  const db = admin()
  const since = new Date(Date.now() - IN_USE_HOURS * 3_600_000).toISOString()
  const { data: busy } = await db.from('hijack_feed').select('room_id').gt('active_at', since)
  const ids = (busy ?? []).map((b) => b.room_id)
  const ran: Record<string, number> = {}

  for (let pass = 0; pass < PASSES && ids.length; pass++) {
    if (pass) await sleep(5000)
    // looked at with their latest state each pass, since the last one may have changed it
    const { data: rooms } = await db.from('rooms').select('*').in('id', ids).eq('mode', 'hijack')
    await Promise.all(
      (rooms ?? [])
        .filter((room) => !pass || !room.host_offline)
        .map(async (room) => {
          try {
            await feed(db, room)
            ran[room.code] = (ran[room.code] ?? 0) + 1
          } catch (e) {
            console.error(`hijack-tick ${room.code}:`, (e as Error).message) // e.g. the host's Spotify needs reconnecting
          }
        }),
    )
  }
  return new Response(JSON.stringify({ rooms: ran }), { headers: { 'Content-Type': 'application/json' } })
})
