<script lang="ts">
  import Admin from './Admin.svelte'
  import Invite from './Invite.svelte'
  import Submit from './Submit.svelte'
  import Guess from './Guess.svelte'
  import Reveal from './Reveal.svelte'
  import Results from './Results.svelte'
  import { game, isDemo, open, packsOf } from './lib/game.svelte'

  let { code } = $props()
  let stranger = $state(false)
  let stop: (() => void) | null = null

  async function load() {
    stop?.()
    stop = await open(code)
    stranger = !stop
  }

  $effect(() => {
    load()
    return () => stop?.()
  })

  // The reveal opens for everyone once the last guess is in, and each player walks through it on their own,
  // whenever they like. Their place is kept on this device: how many sets they have seen (the first one until
  // they move), and past the last set means they are on the results.
  const key = $derived(`808s-reveal-${code}`)
  const read = () => {
    if (isDemo(code)) return code === 'DEMO-RESULTS' ? Infinity : 0 // the demo never saves a place
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? 0 : Number(saved)
    } catch {
      return 0
    }
  }
  let place = $state(read())
  const go = (to: number) => {
    place = to
    try {
      localStorage.setItem(key, String(to))
    } catch {}
  }

  const total = $derived(packsOf(game.songs).length)
</script>

{#if stranger}
  <Invite {code} onjoin={load} />
{:else if game.room}
  <Admin {code} />
  <p class="muted center">EXPERIMENT {code}</p>
  {#if game.room.phase === 'submit'}
    <Submit />
  {:else if game.room.phase === 'guess'}
    <Guess />
  {:else if !total}
    <p class="muted center">/// ESTABLISHING LINK</p>
  {:else if place < total}
    <Reveal index={place} {total} {go} />
  {:else}
    <Results replay={() => go(0)} />
  {/if}
{:else}
  <p class="muted center">/// ESTABLISHING LINK</p>
{/if}
