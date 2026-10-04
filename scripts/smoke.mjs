import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY)
const { error: signInError } = await sb.auth.signInAnonymously()
console.log('anonymous sign-in:', signInError ? signInError.message : 'ok')

// search is for people in a game, so a fresh anonymous user must be refused
const { error } = await sb.functions.invoke('spotify-search', { body: { q: 'midnight city' } })
const reason = (await error?.context?.json?.().catch(() => null))?.error
console.log('search without a game:', error ? `refused (${reason})` : 'unexpectedly worked')

const { data: rooms } = await sb.from('rooms').select('id')
console.log('rooms visible to a stranger:', rooms.length)

const preview = await sb.rpc('room_preview', { p_code: 'ZZ-0000' })
console.log('preview of a missing game:', preview.error ? preview.error.message : `${preview.data.length} rows`)
const join = await sb.rpc('join_room', { p_code: 'ZZ-0000', p_name: 'TEST' })
console.log('joining a missing game:', join.error ? join.error.message : 'unexpectedly worked')
