import { admin } from '../_shared/http.ts'
import { feed } from '../_shared/dj.ts'

// compares without stopping at the first wrong character
const same = (a: string, b: string) => {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

const PASSES = 11 // one scheduled run lasts about a minute, looking every 5 seconds
const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms))

// The server timer for hijacks: the database calls this every minute (pg_cron), and it keeps every hijack's
// music fed for that minute. A room whose speaker is off is only checked once per run, not every 5 seconds.
// The caller proves itself with the DJ_TICK_KEY secret; there is no user here, so this is not a signed-in call.
Deno.serve(async (req) => {
  const secret = Deno.env.get('DJ_TICK_KEY')
  const key = req.headers.get('x-tick-key') ?? ''
  if (!secret || !same(key, secret)) return new Response('no', { status: 403 })

  const db = admin()
  const { data: rooms } = await db.from('rooms').select('*').eq('mode', 'dj')
  const ran: Record<string, number> = {}

  for (let pass = 0; pass < PASSES; pass++) {
    if (pass) await sleep(5000)
    // each room is looked at with its latest state, since the last pass may have changed it
    for (const old of rooms ?? []) {
      const { data: room } = await db.from('rooms').select('*').eq('id', old.id).single()
      if (!room || (pass && room.host_offline)) continue
      try {
        await feed(db, room)
        ran[room.code] = (ran[room.code] ?? 0) + 1
      } catch (e) {
        console.error(`dj-tick ${room.code}:`, (e as Error).message) // e.g. the host's Spotify needs reconnecting
      }
    }
  }
  return new Response(JSON.stringify({ rooms: ran }), { headers: { 'Content-Type': 'application/json' } })
})
