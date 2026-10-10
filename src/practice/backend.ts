// Practice's stand-in for the server: the app's calls (`rpc` and `call` in lib/supabase.ts) land here, keyed by
// name, so the real screens work end to end without a network. Each handler does what the real server would,
// including moving to the next stage when the real game would move on.
import { game, packsOf, savedName, type Song } from '../lib/game.svelte'
import { goStage, practiceCode } from '../lib/practice.svelte'
import { fake, type Fake } from '../lib/supabase'
import { chosen, me, scores, searchable, theme, tracks } from './data'

// "logged in to Spotify" lasts for the tab, so the round trip through Spotify looks like the real one
const spotifyKey = '808s-practice-spotify'

// have you matched every set that is not yours?
const finished = () =>
  packsOf(game.songs).every((pack) => game.owners[pack.songs[0].id] === me.id || game.guesses.some((g) => g.guesser_id === me.id && g.song_id === pack.songs[0].id))

const handlers: Fake = {
  // home
  'spotify-account': ({ action }) => {
    if (action === 'login') {
      sessionStorage.setItem(spotifyKey, '1')
      return { url: `${location.origin}${location.pathname}?spotify=connected#/` }
    }
    if (action === 'disconnect') sessionStorage.removeItem(spotifyKey)
    const connected = sessionStorage.getItem(spotifyKey) !== null
    return { connected, name: connected ? savedName() || me.name : null }
  },
  'create-room': () => (goStage('invite'), { room: { code: practiceCode } }), // next you see what a crew member sees

  // invite
  room_preview: () => [{ theme, phase: 'submit' }],
  join_room: () => (goStage('submit'), { code: practiceCode }),

  // adding songs
  'spotify-search': ({ q }) => {
    const text = String(q).toLowerCase()
    const found = searchable().filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(text))
    // the practice search never comes up empty, so a new player is never left with nothing to tap
    return { tracks: (found.length ? found : searchable()).slice(0, 6).map((t) => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, blocked: false })) }
  },
  'add-song': ({ spotify_id }) => {
    const t = tracks.find((x) => x.id === spotify_id)!
    chosen.set(t.id)
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
  'start-guess': () => goStage('guess'),

  // guessing: the screen has already recorded your pick; the last one opens the scoreboard, like the real server
  submit_guess: () => {
    if (finished()) goStage('results')
  },
  guess_progress: () => [{ finished: finished() ? 6 : 5, total: 6 }],

  // results
  room_scores: () => scores(),
}

export const install = () => void Object.assign(fake, handlers)
