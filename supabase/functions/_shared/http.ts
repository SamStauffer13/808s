import { createClient } from 'npm:@supabase/supabase-js@2'

export const origins = ['https://samstauffer.net', 'http://localhost:5173']

// browsers from other sites are refused: they only ever get our own origin back
const corsFor = (req: Request) => {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': origins.includes(origin) ? origin : origins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

export async function currentUser(req: Request) {
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await client.auth.getUser()
  return data.user
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

// compares without stopping at the first wrong character
export const same = (a: string, b: string) => {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

// an id that came from a client must look like one before it goes near the database
export function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, 'bad id')
  return value
}

export function handler(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    const headers = corsFor(req)
    if (req.method === 'OPTIONS') return new Response('ok', { headers })

    const reply = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } })

    try {
      return reply(await fn(req))
    } catch (e) {
      if (e instanceof HttpError) return reply({ error: e.message }, e.status)
      console.error(e)
      return reply({ error: (e as Error).message ?? 'something went wrong' }, 500)
    }
  }
}
