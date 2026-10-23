// What differs between the things an experiment can be about. A room has a source and every screen asks it for its
// wording, links and look, so a Spotify room and a YouTube room are the same screens and no screen checks which one it
// is. The server has the matching `providers` (supabase/functions/_shared/providers.ts): add a source in both, plus a
// name in source-ids.ts. (The type below makes the compiler list whatever a new source forgot.)
import type { Component } from 'svelte'
import Spotify from '../Spotify.svelte'
import YouTube from '../YouTube.svelte'
import { game, type Room, type Song } from './game.svelte'
import type { Source } from './source-ids'

export type { Source } from './source-ids'

// a player for the guess screen: where it loads from, and whether it is a wide video player (a Spotify one is a short bar)
export type Embed = { src: string; wide?: boolean }

export type SourceInfo = {
  name: string // "SPOTIFY": who it is from
  label: string // the toggle on Home
  noun: string // "song": the word the screens use for one item
  nouns: string // "songs"
  icon: string // marks one item in a list
  placeholder: string // the search box
  vibe: string // "THE PLAYLIST VIBE": what the host's theme is a vibe for
  vibePlaceholder: string
  blurb: string // what to tell a host when there is no account to connect
  verb: string // what players do to take it in: "listen", "watch"
  consume: string // that, as the instruction before guessing: "Listen to the playlist"
  picks: number[] // how many each player may add, to choose from on Home (one entry means it is fixed)
  defaultPicks: number
  playlist: boolean // the host connects an account and the experiment makes a playlist there
  link: (id: string) => string // opens one item at its source
  embed: (room: Room, songs: Song[]) => Embed | null // plays the whole list in order, when the source has a way to
  credit: Component // whose results these are, shown beside them
}

export const sources: Record<Source, SourceInfo> = {
  spotify: {
    name: 'SPOTIFY',
    label: 'AUDIO',
    noun: 'song',
    nouns: 'songs',
    icon: '♪',
    placeholder: 'search tracks or artists',
    vibe: 'PLAYLIST',
    vibePlaceholder: 'e.g. your favorite angsty teenager songs',
    blurb: '',
    verb: 'listen',
    consume: 'Listen to the playlist',
    picks: [1, 2, 3, 4, 5],
    defaultPicks: 2,
    playlist: true,
    link: (id) => `https://open.spotify.com/track/${id}`,
    embed: (room) => (room.playlist_id ? { src: `https://open.spotify.com/embed/playlist/${room.playlist_id}?theme=0` } : null),
    credit: Spotify,
  },
  youtube: {
    name: 'YOUTUBE',
    label: 'VIDEO',
    noun: 'video',
    nouns: 'videos',
    icon: '▶',
    placeholder: 'search videos or channels',
    vibe: 'VIDEO',
    vibePlaceholder: 'e.g. your favorite music video or scifi short',
    blurb: 'Players search YouTube for a full movie or any goofy video. Nobody needs a YouTube account.',
    verb: 'watch',
    consume: 'Watch the videos',
    picks: [1],
    defaultPicks: 1,
    playlist: false,
    link: (id) => `https://www.youtube.com/watch?v=${id}`,
    // no playlist exists on YouTube, but its embed plays a list of video ids one after another (no login needed)
    embed: (_room, [first, ...rest]) =>
      first ? { src: `https://www.youtube-nocookie.com/embed/${first.item_id}${rest.length ? `?playlist=${rest.map((s) => s.item_id).join(',')}` : ''}`, wide: true } : null,
    credit: YouTube,
  },
}

// the source of the room being played (a Spotify room until it has loaded)
export const sourceOf = (source: Source | undefined = game.room?.source): SourceInfo => sources[source ?? 'spotify']

// the room's words for one item and for several, in the two cases the screens use ("video", "VIDEOS")
export function wordsOf(source?: Source) {
  const { noun, nouns } = sourceOf(source)
  return { noun, nouns, NOUN: noun.toUpperCase(), NOUNS: nouns.toUpperCase() }
}
