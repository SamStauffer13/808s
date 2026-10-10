<script lang="ts">
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, joinGame, savedName } from './lib/game.svelte'
  import { practice, startPractice } from './lib/practice.svelte'
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
      <div class="panel stack">
        <div class="label">MISSION BRIEFING</div>
        <div class="line"><b class="good">1</b><span>ENTER YOUR NAME BELOW AND JOIN</span></div>
        <div class="line"><b class="good">2</b><span>ADD YOUR SONGS THAT FIT THE THEME</span></div>
        <div class="line"><b class="good">3</b><span>ONCE THE CREW IS IN, LISTEN TO THE PLAYLIST AND GUESS WHO ADDED WHAT</span></div>
        <div class="line"><b class="good">4</b><span>SEE WHO WON</span></div>
      </div>
      <p class="muted center">/// RETURNING? USE THE SAME NAME TO TAKE YOUR SEAT</p>
    {:else}
      <p class="muted center">/// IN PROGRESS · ONLY THE CREW CAN REJOIN</p>
    {/if}
    <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), join())}>
      <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
      <p class="muted">/// USE THE NAME YOUR CREW KNOWS YOU BY</p>
      <Notice scope="join" />
      <button class="btn">JOIN THE EXPERIMENT</button>
    </form>
    {#if !practice.on}<button type="button" class="link center" onclick={() => startPractice('guest')}>NEW HERE? TRY THE TUTORIAL →</button>{/if}
  {/if}
</div>
