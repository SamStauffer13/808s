import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

export const preflight = (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: cors }) : null)

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

export function handler(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    const early = preflight(req)
    if (early) return early
    try {
      return json(await fn(req))
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message }, e.status)
      console.error(e)
      return json({ error: (e as Error).message ?? 'something went wrong' }, 500)
    }
  }
}
