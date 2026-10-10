<script lang="ts">
  import Admin from './Admin.svelte'
  import Invite from './Invite.svelte'
  import Submit from './Submit.svelte'
  import Guess from './Guess.svelte'
  import Reveal from './Reveal.svelte'
  import Results from './Results.svelte'
  import { game, open, packsOf } from './lib/game.svelte'
  import { practice } from './lib/practice.svelte'

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

  // The scoreboard opens for everyone once the last guess is in. REPLAY THE FINDINGS on it walks through the reveal
  // song by song, at the player's own pace. Their place is kept on this device: how many sets they have seen,
  // and past the last set (the default) means they are on the scoreboard.
  const key = $derived(`808s-reveal-${code}`)
  const read = () => {
    if (practice.on) return Infinity // practice never saves a place
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? Infinity : Number(saved)
    } catch {
      return Infinity
    }
  }
  let place = $state(read())
  const go = (to: number) => {
    place = to
    if (practice.on) return
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
