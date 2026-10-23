<script lang="ts">
  import Art from './Art.svelte'
  import WatchRow from './WatchRow.svelte'
  import { kindOf, type Song } from './lib/game.svelte'

  // One pick on the guess screen: a track that opens in Spotify, or a movie poster with where to watch it.
  let { song }: { song: Song } = $props()
</script>

{#if kindOf() === 'movies'}
  <div class="movie">
    <div class="line">
      <Art poster big src={song.art_url} title={song.title} />
      <div class="grow-text">
        <div>{song.title}</div>
        <div class="dim">{song.artist}</div>
        {#if song.genres.length}<div class="dim">{song.genres.slice(0, 3).join(' · ').toUpperCase()}</div>{/if}
      </div>
    </div>
    <WatchRow {song} />
  </div>
{:else}
  <a class="line" href={`https://open.spotify.com/track/${song.spotify_id}`} target="_blank" rel="noopener">
    <Art src={song.art_url} />
    <div class="grow-text"><div>{song.title}</div><div class="dim">{song.artist}</div></div>
  </a>
{/if}
