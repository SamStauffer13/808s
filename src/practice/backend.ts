// Practice's stand-in for the server: the app's calls (`rpc` and `call` in lib/supabase.ts) land here, keyed by
// name, so the real screens work end to end without a network. Each handler does what the real server would,
// including moving to the next stage when the real game would move on.
import { threshold } from '../lib/hijack.svelte'
import { game, packsOf, savedName, type Song } from '../lib/game.svelte'
import { goStage, practice, practiceCode, spotifyKey } from '../lib/practice.svelte'
import { isSource } from '../lib/source-ids'
import { fake, type Fake } from '../lib/supabase'
import { HIJACK_NAME } from './demo'
import { chosen, items, me, players, searchable, theme } from './data'

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
    return { connected, name: connected ? savedName() || me.name : null, canHijack: connected }
  },
  // next you add songs, as the host; the choice on Home picks what the experiment is about
  'create-room': ({ source }) => ((practice.source = isSource(source) ? source : 'spotify'), goStage('submit'), { room: { code: practiceCode } }),

  // invite (a crew member's journey)
  room_preview: () => [{ theme: practice.stage === 'join' ? HIJACK_NAME : theme(), phase: 'submit', source: practice.source, mode: practice.stage === 'join' ? 'hijack' : 'game' }],
  join_room: () => (goStage(practice.stage === 'join' ? 'hijack' : 'submit'), { code: practiceCode }),

  // adding songs
  'media-search': ({ q }) => {
    const text = String(q).toLowerCase()
    const found = searchable().filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(text))
    // the practice search never comes up empty, so a new player is never left with nothing to tap
    return { items: (found.length ? found : searchable()).slice(0, 6).map((t) => ({ id: t.id, title: t.title, artist: t.artist, art: t.art, blocked: false })) }
  },
  'add-song': ({ item_id }) => {
    const t = items().find((x) => x.id === item_id)!
    chosen.set(t.id)
    const song: Song = { id: `added-${t.id}`, pack: null, source: practice.source, item_id: t.id, title: t.title, artist: t.artist, art_url: t.art, genres: t.genres }
    game.songs = [...game.songs, song]
    game.owners = { ...game.owners, [song.id]: me.id }
    game.counts = { ...game.counts, [me.id]: (game.counts[me.id] ?? 0) + 1 }
    return { song }
  },
  remove_song: ({ p_song }) => {
    game.songs = game.songs.filter((s) => s.id !== p_song)
    game.counts = { ...game.counts, [me.id]: Math.max(0, (game.counts[me.id] ?? 1) - 1) }
  },

  // starting a hijack gives its fixed link
  'open-hijack': ({ slug, title }) => ({ room: { id: 'practice', code: String(slug).toUpperCase(), theme: title, block_explicit: false } }),

  // the hijack: the screen has already shown your track or vote, so these only answer like the server would
  'hijack-suggest': () => ({ track: {} }),
  'hijack-veto': ({ track_id, undo }) => ({ status: !undo && game.hijack.vetoes.filter((v) => v.track_id === track_id).length >= threshold() ? 'vetoed' : 'pending' }),
  'hijack-host': ({ action, track_id }) => {
    const { tracks } = game.hijack
    if (action === 'remove') game.hijack.tracks = tracks.map((t) => (t.id === track_id ? { ...t, status: 'vetoed' } : t))
    if (action === 'top') game.hijack.tracks = tracks.map((t) => (t.id === track_id ? { ...t, sort_at: new Date(0).toISOString() } : t))
    if (action === 'pause' || action === 'resume') game.room!.suggestions_paused = action === 'pause'
    return { ok: true }
  },

  // the host moves the game along
  'start-guess': () => goStage('guess'),

  // guessing: the screen has already recorded your pick; the last one opens the scoreboard, like the real server
  submit_guess: () => {
    if (finished()) goStage('results')
  },
  guess_waiting: () => (finished() ? [] : [{ player_id: players[5].id }, { player_id: me.id }]),
  guess_progress: () => [{ finished: finished() ? 6 : 5, total: 6 }],
}

export const install = () => void Object.assign(fake, handlers)
