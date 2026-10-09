import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)

// players are anonymous users: no signup, the session lives in this browser
export async function signIn() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return anon.user!
}

// lets the demo game (src/demo.ts) answer server calls without a server; empty unless the demo is open
export const fake: Record<string, (args: object) => unknown> = {}

export async function rpc(name: string, args: object = {}) {
  if (fake[name]) return fake[name](args)
  await signIn()
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

export async function call<T = unknown>(name: string, body: object): Promise<T> {
  await signIn()
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  return data
}
