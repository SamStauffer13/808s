<script lang="ts">
  import Spotify from './Spotify.svelte'
  import { kindOf } from './lib/game.svelte'

  // Whose data the search and the lineup come from. `full` is the longer credit the movie data's terms ask for.
  let { full = false }: { full?: boolean } = $props()
</script>

{#if kindOf() === 'movies'}
  {#if full}
    <p class="muted prose center">Movie data from TMDB, where-to-watch data from JustWatch. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
  {:else}
    <a class="link" href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a>
  {/if}
{:else}
  <Spotify />
{/if}
