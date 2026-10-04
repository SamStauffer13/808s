<script lang="ts">
  import { fade } from 'svelte/transition'
  import { ui } from './lib/game.svelte'
  import Home from './Home.svelte'
  import Room from './Room.svelte'

  const read = () => decodeURIComponent(location.hash.slice(2)).toUpperCase()
  let code = $state(read())
</script>

<svelte:window onhashchange={() => (code = read())} />

{#if ui.error}
  <button class="toast" transition:fade={{ duration: 150 }} onclick={() => (ui.error = '')}>{ui.error}</button>
{/if}

{#if code}
  {#key code}<Room {code} />{/key}
{:else}
  <Home />
{/if}
