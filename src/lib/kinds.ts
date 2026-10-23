// Everything a screen says that depends on what the crew is adding, so a screen asks for its words here instead of
// hard-coding "song". Music's words are the app's original ones; a new kind is one more entry.
export type Kind = 'music' | 'movies'

type Words = {
  title: string // the app's name, as shared with the crew
  logo: [string, string] // the header mark: big part, small part
  toggle: string // its label on the home screen toggle
  tagline: [string, string, string]
  noun: string // one pick
  nouns: string
  item: string // what a search result is called
  vibeLabel: string
  vibeExample: string
  searchHint: string
  inviteWatch: string // the invite's step about getting through the lineup
  guessIntro: string
  glyph: string // marks a pick in the scoreboard files
  poster: boolean // picks are drawn as tall posters, not square cover art
}

export const kinds: Record<Kind, Words> = {
  music: {
    title: '808s',
    logo: ['808', 's'],
    toggle: 'AUDIO',
    tagline: ['EVERYONE ADDS SONGS.', 'GUESS WHO ADDED WHAT.', 'WINNERS GET CREDS.'],
    noun: 'song',
    nouns: 'songs',
    item: 'track',
    vibeLabel: 'THE PLAYLIST VIBE',
    vibeExample: 'e.g. your favorite angsty teenager songs',
    searchHint: 'search tracks or artists',
    inviteWatch: 'ONCE THE CREW IS IN, LISTEN TO THE PLAYLIST AND GUESS WHO ADDED WHAT',
    guessIntro: 'Listen to the playlist, then match every crew member to the set of songs they added. Each person added exactly one set, so each name goes on a different set.',
    glyph: '♪',
    poster: false,
  },
  movies: {
    title: '35mm',
    logo: ['35', 'mm'],
    toggle: 'VIDEO',
    tagline: ['EVERYONE ADDS MOVIES.', 'GUESS WHO ADDED WHAT.', 'WINNERS GET CREDS.'],
    noun: 'movie',
    nouns: 'movies',
    item: 'movie',
    vibeLabel: 'THE MOVIE VIBE',
    vibeExample: 'e.g. movies that make a rainy day better',
    searchHint: 'search movies',
    inviteWatch: 'ONCE THE CREW IS IN, CHECK THE LINEUP, WATCH WHAT YOU CAN, AND GUESS WHO ADDED WHAT',
    guessIntro: 'Check the lineup and where to watch each movie, then match every crew member to the set of movies they added. Each person added exactly one set, so each name goes on a different set.',
    glyph: '▶',
    poster: true,
  },
}
