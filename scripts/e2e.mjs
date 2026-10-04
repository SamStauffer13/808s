// Plays a full round against the real backend with three players and a stranger, and checks
// that nobody can learn who added what before the reveal.
//
//   $env:E2E_PASSPHRASE = "<host passphrase>"
//   node --experimental-websocket --env-file=.env scripts/e2e.mjs
//
// It creates a real playlist on the host Spotify account; delete it afterwards.
import { createClient } from '@supabase/supabase-js'

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_KEY: key, E2E_PASSPHRASE: passphrase } = process.env
if (!passphrase) throw new Error('set E2E_PASSPHRASE first')

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`)
  if (!ok) failed++
}

async function player() {
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await sb.auth.signInAnonymously()
  if (error) throw error
  return { sb, id: data.user.id }
}

async function fn(p, name, body) {
  const { data, error } = await p.sb.functions.invoke(name, { body })
  if (!error) return { data }
  return { error: (await error.context?.json?.().catch(() => null))?.error ?? error.message }
}

const rpc = async (p, name, args) => {
  const { data, error } = await p.sb.rpc(name, args)
  return error ? { error: error.message } : { data }
}

const [A, B, C, stranger] = await Promise.all([player(), player(), player(), player()])
const players = { ALPHA: A, BRAVO: B, CHARLIE: C }

// --- room ------------------------------------------------------------------------------
const bad = await fn(stranger, 'create-room', { passphrase: 'nope', name: 'X', theme: 'x' })
check('wrong host passphrase is refused', !!bad.error)

const created = await fn(A, 'create-room', { passphrase, name: 'ALPHA', theme: 'E2E Test', songs_per_player: 2 })
check('host creates a room', !!created.data?.room, created.error)
const room = created.data.room

check('stranger cannot read the room', ((await stranger.sb.from('rooms').select('id')).data ?? []).length === 0)
for (const [name, p] of [['BRAVO', B], ['CHARLIE', C]]) {
  const joined = await rpc(p, 'join_room', { p_code: room.code, p_name: name })
  check(`${name} joins by code`, !!joined.data, joined.error)
}

check('a game opens straight into song picking', room.phase === 'submit', room.phase)
check('a non-host cannot change the phase', !!(await rpc(B, 'host_set_phase', { p_room: room.id, p_phase: 'reveal' })).error)

// --- submit ----------------------------------------------------------------------------
const search = async (q) => (await fn(A, 'spotify-search', { q })).data?.tracks ?? []
const pools = { ALPHA: await search('midnight city'), BRAVO: await search('bohemian rhapsody'), CHARLIE: await search('blinding lights') }
const truth = {} // spotify_id -> player name
for (const [name, p] of Object.entries(players)) {
  const picks = pools[name].filter((t) => !truth[t.id]).slice(0, 2)
  for (const t of picks) {
    const added = await fn(p, 'add-song', { room_id: room.id, spotify_id: t.id })
    check(`${name} adds "${t.title}"`, !!added.data?.song, added.error)
    if (added.data?.song) truth[t.id] = name
  }
}

const aFirst = Object.keys(truth).find((id) => truth[id] === 'ALPHA')
check('duplicate song is refused', !!(await fn(B, 'add-song', { room_id: room.id, spotify_id: aFirst })).error)
const extra = pools.ALPHA.find((t) => !truth[t.id])
check('adding past the limit is refused', !!(await fn(A, 'add-song', { room_id: room.id, spotify_id: extra.id })).error)

const bOwners = (await B.sb.from('song_owners').select('song_id')).data ?? []
const bSongs = (await B.sb.from('songs').select('id')).data ?? []
check('during submit a player sees only their own owner rows', bOwners.length === 2, `saw ${bOwners.length}`)
check('during submit a player sees only their own songs', bSongs.length === 2, `saw ${bSongs.length}`)
const counts = (await rpc(A, 'submission_counts', { p_room: room.id })).data ?? []
check('submission counts show 2 each', counts.length === 3 && counts.every((c) => c.n === 2))

// --- guess -----------------------------------------------------------------------------
const earlyGuess = await fn(B, 'start-guess', { room_id: room.id })
check('a non-host cannot start guessing', !!earlyGuess.error)
const guessing = await fn(A, 'start-guess', { room_id: room.id })
check('host starts guessing and the playlist is built', !!guessing.data?.playlist_id, guessing.error)

const live = (await A.sb.from('rooms').select('*').eq('id', room.id).single()).data
check('room moved to guess with a playlist', live.phase === 'guess' && !!live.playlist_url, live.phase)
console.log('      playlist:', live.playlist_url)

const songs = (await B.sb.from('songs').select('id, spotify_id, pack').eq('room_id', room.id)).data ?? []
check('everyone now sees all 6 songs', songs.length === 6, `saw ${songs.length}`)
const bOwnersNow = (await B.sb.from('song_owners').select('song_id')).data ?? []
check('owners are still hidden during guessing', bOwnersNow.length === 2, `saw ${bOwnersNow.length}`)

const roster = (await A.sb.from('players').select('id, name').eq('room_id', room.id)).data
const idOf = Object.fromEntries(roster.map((r) => [r.name, r.id]))

const packOf = {} // owner name -> pack id
for (const s of songs) packOf[truth[s.spotify_id]] = s.pack
check("each person's songs share one pack", new Set(songs.map((s) => s.pack)).size === 3)

const guess = (who, ownerName, pick) => rpc(players[who], 'submit_guess', { p_pack: packOf[ownerName], p_guessed: idOf[pick] })
const guessCount = async (p) => ((await p.sb.from('guesses').select('id')).data ?? []).length

// ALPHA gets both right, CHARLIE gets one right and skips the other, BRAVO gets both wrong
for (const [who, owner, pick] of [['ALPHA', 'BRAVO', 'BRAVO'], ['ALPHA', 'CHARLIE', 'CHARLIE'], ['CHARLIE', 'ALPHA', 'ALPHA']]) {
  const res = await guess(who, owner, pick)
  if (res.error) check(`${who} guesses`, false, res.error)
}
check('guessing your own songs is refused', !!(await guess('BRAVO', 'BRAVO', 'CHARLIE')).error)

await guess('BRAVO', 'ALPHA', 'ALPHA')
await guess('BRAVO', 'CHARLIE', 'ALPHA') // ALPHA is already matched to another set, so this moves them
check('matching a friend again moves them', (await guessCount(B)) === 2, `saw ${await guessCount(B)}`)
await guess('BRAVO', 'ALPHA', 'CHARLIE')

check('during guessing a player sees only their own guesses', (await guessCount(B)) === 4, `saw ${await guessCount(B)}`)
check('a stranger sees nothing', ((await stranger.sb.from('guesses').select('id')).data ?? []).length === 0)

// --- reveal ----------------------------------------------------------------------------
const revealed = await rpc(A, 'host_set_phase', { p_room: room.id, p_phase: 'reveal' })
check('host reveals', !revealed.error, revealed.error)
check('guessing is closed after the reveal', !!(await guess('BRAVO', 'ALPHA', 'ALPHA')).error)

const owners = (await B.sb.from('song_owners').select('song_id, player_id')).data ?? []
const ownerOf = Object.fromEntries(owners.map((o) => [o.song_id, o.player_id]))
check('after the reveal a player can read all 6 owners', owners.length === 6, `saw ${owners.length}`)
check('revealed owners match who really added each song', songs.every((s) => ownerOf[s.id] === idOf[truth[s.spotify_id]]))
check('after the reveal a player can read all guesses', ((await B.sb.from('guesses').select('id')).data ?? []).length === 12)

const scores = (await rpc(B, 'room_scores', { p_room: room.id })).data ?? []
const score = Object.fromEntries(scores.map((s) => [s.name, s.correct]))
check('scores: ALPHA 4, CHARLIE 2, BRAVO 0', score.ALPHA === 4 && score.CHARLIE === 2 && score.BRAVO === 0, JSON.stringify(score))
check('scores are hidden from a stranger', ((await rpc(stranger, 'room_scores', { p_room: room.id })).data ?? []).length === 0)

console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed')
process.exit(failed ? 1 : 0)
