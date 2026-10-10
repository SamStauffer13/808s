<script lang="ts">
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, isDemo, joinGame, savedName } from './lib/game.svelte'
  import { rpc } from './lib/supabase'

  let { code, onjoin } = $props()

  let name = $state(savedName())
  let preview = $state<{ theme: string; phase: string } | null>()

  $effect(() => {
    attempt('preview', async () => (preview = (await rpc('room_preview', { p_code: code }))[0] ?? null))
  })

  const join = async () => {
    if (await joinGame(code, name)) onjoin()
  }
</script>

<Admin big {code} />

<div class="form">
  {#if preview === undefined}
    <p class="muted center">/// ESTABLISHING LINK</p>
    <Notice scope="preview" />
  {:else if preview === null}
    <p class="center">NO EXPERIMENT AT THIS ADDRESS</p>
    <a class="btn ghost" href="#/">START YOUR OWN</a>
  {:else}
    <div class="panel framed">
      <div class="label">INCOMING TRANSMISSION</div>
      <div class="big">{preview.theme}</div>
    </div>
    {#if preview.phase === 'submit'}
      <p class="muted center">/// 1 ADD YOUR SONGS · 2 LISTEN AND GUESS WHO ADDED WHAT · 3 SEE THE REVEAL</p>
      <p class="muted center">/// RETURNING? USE THE SAME NAME TO TAKE YOUR SEAT</p>
    {:else}
      <p class="muted center">/// IN PROGRESS · ONLY THE CREW CAN REJOIN</p>
    {/if}
    <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), join())}>
      <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
      <p class="muted">/// USE THE NAME YOUR FRIENDS KNOW YOU BY</p>
      <Notice scope="join" />
      <button class="btn">JOIN THE EXPERIMENT</button>
    </form>
    {#if !isDemo(code)}<a class="link center" href="#/demo">NEW HERE? SEE HOW IT WORKS</a>{/if}
  {/if}
</div>
