<script lang="ts">
  import Credit from './Credit.svelte'
  import { game } from './lib/game.svelte'
  import { sourceOf } from './lib/sources'

  const info = $derived(sourceOf())
</script>

{#if game.room?.playlist_url}
  <p class="center"><Credit /><a class="link" href={game.room.playlist_url} target="_blank" rel="noopener">{info.verb.toUpperCase()} ON {info.name} ↗</a></p>
{/if}
