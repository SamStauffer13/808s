<script lang="ts">
  import Boot from './Boot.svelte'
  import Home from './Home.svelte'
  import Room from './Room.svelte'
  import { isDemo } from './lib/game.svelte'

  const read = () => decodeURIComponent(location.hash.slice(2)).toUpperCase()
  let code = $state(read())

  // a short terminal intro, once per visit, only on the home screen
  let booting = $state(!read() && !sessionStorage.getItem('808s-booted') && !matchMedia('(prefers-reduced-motion: reduce)').matches)
  const booted = () => {
    sessionStorage.setItem('808s-booted', '1')
    booting = false
  }
</script>

<svelte:window onhashchange={() => (code = read())} />

{#if booting}
  <Boot done={booted} />
{:else if isDemo(code)}
  {#await import('./demo/Demo.svelte') then demo}<demo.default {code} />{/await}
{:else if code}
  {#key code}<Room {code} />{/key}
{:else}
  <Home />
{/if}
