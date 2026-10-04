import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_KEY)
const { error: signInError } = await sb.auth.signInAnonymously()
console.log('anonymous sign-in:', signInError ? signInError.message : 'ok')

const { data, error } = await sb.functions.invoke('spotify-search', { body: { q: 'midnight city' } })
if (error) console.log('search failed:', error.message, await error.context?.json?.().catch(() => ''))
else console.log(`search ok: ${data.tracks.length} tracks, first: ${data.tracks[0]?.title} - ${data.tracks[0]?.artist}`)

const { data: rooms } = await sb.from('rooms').select('id')
console.log('rooms visible to a stranger:', rooms.length)

const preview = await sb.rpc('room_preview', { p_code: 'ZZ-0000' })
console.log('preview of a missing game:', preview.error ? preview.error.message : `${preview.data.length} rows`)
const join = await sb.rpc('join_room', { p_code: 'ZZ-0000', p_name: 'TEST' })
console.log('joining a missing game:', join.error ? join.error.message : 'unexpectedly worked')
