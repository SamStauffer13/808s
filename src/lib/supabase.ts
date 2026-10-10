import { createClient } from '@supabase/supabase-js'
import { practice } from './practice.svelte'

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY)

// players are anonymous users: no signup, the session lives in this browser
export async function signIn() {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return anon.user!
}

// Practice mode (src/practice) answers server calls from here instead of the network. A call it has no answer for
// fails loudly: it must never reach the real server.
export type Fake = Record<string, (args: any) => unknown>
export const fake: Fake = {}

function practiceReply(name: string, args: object) {
  if (!fake[name]) throw new Error(`"${name}" is not available in the practice round`)
  return fake[name](args)
}

export async function rpc(name: string, args: object = {}) {
  if (practice.on) return practiceReply(name, args)
  await signIn()
  const { data, error } = await supabase.rpc(name, args)
  if (error) throw new Error(error.message)
  return data
}

export async function call<T = unknown>(name: string, body: object): Promise<T> {
  if (practice.on) return practiceReply(name, body) as T
  await signIn()
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (error) {
    const detail = await error.context?.json?.().catch(() => null)
    throw new Error(detail?.error ?? error.message)
  }
  return data
}
