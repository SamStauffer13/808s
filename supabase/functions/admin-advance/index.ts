import { admin, currentUser, handler, HttpError } from '../_shared/http.ts'
import { beginGuess } from '../_shared/guess.ts'

// compares without stopping at the first wrong character
const same = (a: string, b: string) => {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// The owner's override: moves any room to its next phase, whether or not the host is around.
// Needs the ADMIN_KEY secret, so only whoever holds it can use it. Without { code }, it only checks the key.
Deno.serve(
  handler(async (req) => {
    const user = await currentUser(req)
    if (!user) throw new HttpError(401, 'sign in first')
    const { code, key } = await req.json()

    const secret = Deno.env.get('ADMIN_KEY')
    if (!secret || typeof key !== 'string' || !same(key, secret)) {
      await new Promise((done) => setTimeout(done, 1500)) // slows down guessing
      throw new HttpError(403, 'wrong admin key')
    }
    if (code === undefined) return { ok: true }

    const db = admin()
    const { data: room } = await db.from('rooms').select('*').eq('code', String(code).trim().toUpperCase()).maybeSingle()
    if (!room) throw new HttpError(404, 'no room with that code')

    if (room.phase === 'submit') {
      await beginGuess(db, room)
      return { phase: 'guess' }
    }
    if (room.phase === 'guess') {
      const { error } = await db.from('rooms').update({ phase: 'reveal' }).eq('id', room.id).eq('phase', 'guess')
      if (error) throw new HttpError(400, error.message)
      return { phase: 'reveal' }
    }
    throw new HttpError(400, 'already at the reveal, nothing left to advance')
  }),
)
