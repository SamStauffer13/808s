// The demo's stand-in for the server: the app's calls (`rpc` and `call` in lib/supabase.ts) land here, keyed by
// name, so the real screens work end to end without a network. Each handler does what the real server would,
// including moving to the next stage when the real game would move on.
import { game, packsOf, type Song } from '../lib/game.svelte'
import type { Fake } from '../lib/supabase'
import { me, scores, theme, tracks } from './data'
import { codeOf, type Stage } from './stages'

const go = (stage: Stage) => (location.hash = `/${codeOf(stage)}`)

// "logged in to Spotify" lasts for the tab, so the round trip through Spotify looks like the real one
const spotifyKey = '808s-demo-spotify'

// have you matched every set that is not yours?
const finished = () =>
  packsOf(game.songs).every((pack) => game.owners[pack.songs[0].id] === me.id || game.guesses.some((g) => g.guesser_id === me.id && g.song_id === pack.songs[0].id))

export const handlers: Fake = {
  // home
  'spotify-account': ({ action }) => {
    if (action === 'login') {
      sessionStorage.setItem(spotifyKey, '1')
      return { url: `${location.origin}${location.pathname}?spotify=connected#/${codeOf('home')}` }
    }
    if (action === 'disconnect') sessionStorage.removeItem(spotifyKey)
    const connected = sessionStorage.getItem(spotifyKey) !== null
    return { connected, name: connected ? me.name : null }
  },
  'create-room': () => ({ room: { code: codeOf('submit') } }),

  // invite
  room_preview: () => [{ theme, phase: 'submit' }],
  join_room: () => (go('submit'), { code: codeOf('submit') }),

  // adding songs
  'spotify-search': ({ q }) => {
    const text = String(q).toLowerCase()
    const found = tracks.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(text))
    return { tracks: found.slice(0, 6).map((t) => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, blocked: false })) }
  },
  'add-song': ({ spotify_id }) => {
    const t = tracks.find((x) => x.id === spotify_id)!
    const song: Song = { id: `added-${t.id}`, pack: null, spotify_id: t.id, title: t.title, artist: t.artist, art_url: t.art }
    game.songs = [...game.songs, song]
    game.owners = { ...game.owners, [song.id]: me.id }
    game.counts = { ...game.counts, [me.id]: (game.counts[me.id] ?? 0) + 1 }
    return { song }
  },
  remove_song: ({ p_song }) => {
    game.songs = game.songs.filter((s) => s.id !== p_song)
    game.counts = { ...game.counts, [me.id]: Math.max(0, (game.counts[me.id] ?? 1) - 1) }
  },

  // the host moves the game along
  'start-guess': () => go('guess'),
  host_set_phase: () => go('reveal'),
  'admin-advance': ({ code }) => (code === undefined ? { ok: true } : { phase: 'guess' }), // the owner's override, from Home

  // guessing: the screen has already recorded your pick; the last one opens the reveal, like the real server
  submit_guess: () => {
    if (finished()) go('reveal')
  },
  guess_progress: () => [{ finished: finished() ? 8 : 7, total: 8 }],

  // results
  room_scores: () => scores(),
}
