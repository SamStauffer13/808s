<script lang="ts">
  import Boot from './Boot.svelte'
  import Home from './Home.svelte'
  import Rain from './Rain.svelte'
  import Room from './Room.svelte'
  import { reduced } from './lib/motion'
  import { transition } from './lib/transition.svelte'
  import { installPractice, practice, practiceCode, startFromAddress } from './lib/practice.svelte'

  startFromAddress()

  // room codes are uppercase
  const read = () => decodeURIComponent(location.hash.slice(2)).toUpperCase()
  let code = $state(read())

  // a short terminal intro, once per visit, only on the home screen
  let booting = $state(!practice.on && !read() && !sessionStorage.getItem('808s-booted') && !reduced())
  const booted = () => {
    sessionStorage.setItem('808s-booted', '1')
    booting = false
  }
</script>

<svelte:window onhashchange={() => (startFromAddress(), (code = read()))} />

{#if booting}
  <Boot done={booted} />
{:else if practice.on}
  <!-- the real screens on a fake game; the address is ignored while practicing -->
  {#await installPractice() then}
    {#key practice.stage}
      {#if practice.stage === 'home'}<Home />{:else}<Room code={practiceCode} />{/if}
    {/key}
    {#await import('./practice/Wizard.svelte') then wizard}<wizard.default />{/await}
  {/await}
{:else if code}
  {#key code}<Room {code} />{/key}
{:else}
  <Home />
{/if}

{#if transition.playing}
  {#key transition.run}<Rain title={transition.title} glyphs={transition.glyphs} />{/key}
{/if}
