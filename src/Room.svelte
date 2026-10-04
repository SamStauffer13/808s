<script lang="ts">
  import Invite from './Invite.svelte'
  import Submit from './Submit.svelte'
  import Guess from './Guess.svelte'
  import Reveal from './Reveal.svelte'
  import Results from './Results.svelte'
  import { game, open } from './lib/game.svelte'

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
</script>

{#if stranger}
  <Invite {code} onjoin={load} />
{:else if game.room}
  {#if game.room.phase === 'submit'}
    <Submit />
  {:else if game.room.phase === 'guess'}
    <Guess />
  {:else if game.room.phase === 'reveal'}
    <Reveal />
  {:else}
    <Results />
  {/if}
{:else}
  <p class="muted center">/// LOADING</p>
{/if}
