<script lang="ts">
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
  // whenever they like. Their place is kept on this device: nothing until they start, then how many sets
  // they have seen, and past the last set means they are on the results.
  const key = $derived(`808s-reveal-${code}`)
  const read = () => {
    if (isDemo(code)) return code === 'DEMO-RESULTS' ? Infinity : null
    try {
      const saved = localStorage.getItem(key)
      return saved === null ? null : Number(saved)
    } catch {
      return null
    }
  }
  let place = $state<number | null>(read())
  const go = (to: number) => {
    place = to
    try {
      localStorage.setItem(key, String(to))
    } catch {}
  }

  const total = $derived(packsOf(game.songs).length)
</script>

{#if isDemo(code)}<p class="muted center">/// DEMO · FAKE DATA</p>{/if}

{#if stranger}
  <Invite {code} onjoin={load} />
{:else if game.room}
  {#if game.room.phase === 'submit'}
    <Submit />
  {:else if game.room.phase === 'guess'}
    <Guess />
  {:else if !total}
    <p class="muted center">/// CONNECTING</p>
  {:else if place === null}
    <div class="logo big">808<small>s</small></div>
    <div class="panel framed">
      <div class="label good">ALL TRACED</div>
      <div class="big">THE SOURCES ARE READY</div>
    </div>
    <p class="muted center">/// {total} SETS · GO AT YOUR OWN PACE · COME BACK ANY TIME</p>
    <div class="grow"></div>
    <button class="btn" onclick={() => go(0)}>DECRYPT THE SOURCES</button>
  {:else if place < total}
    <Reveal index={place} {total} {go} />
  {:else}
    <Results replay={() => go(0)} />
  {/if}
{:else}
  <p class="muted center">/// CONNECTING</p>
{/if}
