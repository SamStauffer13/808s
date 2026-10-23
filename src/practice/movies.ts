// The movie round's picks: 12 movies, shaped like the music snapshot in data.ts. Set i belongs to player i and is movie i;
// the rest are there to search for. There is no poster art (each is drawn from its title), and the where-to-watch rows are
// made-up samples to show the screen's states, not real availability. Nothing here talks to a server.
import type { Watch } from '../lib/game.svelte'

export type Pick = { id: string; title: string; artist: string; art: string | null; genres: string[]; watch?: Watch | null }

export const movieTheme = 'movies that make a rainy day better'

const search = (title: string) => `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`
const on = (...names: string[]) => names.map((name) => ({ name }))

const movie = (id: number, title: string, year: number, director: string, genres: string[], watch: Omit<Watch, 'link'> | null): Pick => ({
  id: String(id),
  title,
  artist: `${year} · ${director}`,
  art: null,
  genres,
  watch: watch && { link: search(title), ...watch },
})

export const movies: Pick[] = [
  movie(129, 'Spirited Away', 2001, 'Hayao Miyazaki', ['Animation', 'Fantasy', 'Family'], { stream: on('Max'), rent: on('Apple TV', 'Amazon') }),
  movie(278, 'The Shawshank Redemption', 1994, 'Frank Darabont', ['Drama', 'Crime'], { stream: on('Netflix', 'Hulu'), rent: on('Apple TV', 'Amazon', 'Vudu', 'Google Play') }),
  movie(496243, 'Parasite', 2019, 'Bong Joon-ho', ['Drama', 'Thriller', 'Comedy'], { stream: on('Hulu'), buy: on('Apple TV', 'Amazon') }),
  movie(194, 'Amélie', 2001, 'Jean-Pierre Jeunet', ['Comedy', 'Romance'], null), // no where-to-watch data: shows the empty state (a set someone else added, so the guess screen draws it)
  movie(546554, 'Knives Out', 2019, 'Rian Johnson', ['Comedy', 'Mystery', 'Crime'], { stream: on('Netflix', 'Prime Video'), rent: on('Apple TV') }),
  movie(335984, 'Blade Runner 2049', 2017, 'Denis Villeneuve', ['Science Fiction', 'Drama', 'Thriller'], { rent: on('Apple TV', 'Amazon', 'Vudu'), buy: on('Apple TV', 'Amazon') }),
  movie(153, 'Lost in Translation', 2003, 'Sofia Coppola', ['Drama', 'Romance', 'Comedy'], { stream: on('Peacock'), rent: on('Apple TV', 'Amazon') }),
  movie(76341, 'Mad Max: Fury Road', 2015, 'George Miller', ['Action', 'Adventure', 'Science Fiction'], { stream: on('Max', 'Netflix'), rent: on('Apple TV') }),
  movie(2493, 'The Princess Bride', 1987, 'Rob Reiner', ['Adventure', 'Fantasy', 'Comedy'], { stream: on('Disney+', 'Hulu'), rent: on('Apple TV', 'Amazon') }),
  movie(244786, 'Whiplash', 2014, 'Damien Chazelle', ['Drama', 'Music'], { stream: on('Netflix', 'Prime Video', 'Hulu', 'Max', 'Peacock'), rent: on('Apple TV') }), // five services: shows the "+N"
  movie(545611, 'Everything Everywhere All at Once', 2022, 'Daniel Kwan, Daniel Scheinert', ['Action', 'Comedy', 'Science Fiction'], { stream: on('Showtime'), rent: on('Apple TV', 'Amazon', 'Vudu') }),
  movie(120467, 'The Grand Budapest Hotel', 2014, 'Wes Anderson', ['Comedy', 'Drama', 'Adventure'], { stream: on('Max'), free: on('Pluto TV'), rent: on('Apple TV') }),
]
