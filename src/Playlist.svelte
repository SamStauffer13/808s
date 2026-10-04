<script lang="ts">
  import { game } from './lib/game.svelte'
</script>

{#if game.room?.playlist_url}
  <p class="center"><a class="link" href={game.room.playlist_url} target="_blank" rel="noopener">OPEN PLAYLIST IN SPOTIFY ↗</a></p>
{/if}
