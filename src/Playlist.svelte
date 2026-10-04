<script lang="ts">
  import Spotify from './Spotify.svelte'
  import { game } from './lib/game.svelte'
</script>

{#if game.room?.playlist_url}
  <p class="center"><Spotify /><a class="link" href={game.room.playlist_url} target="_blank" rel="noopener">LISTEN ON SPOTIFY ↗</a></p>
{/if}
