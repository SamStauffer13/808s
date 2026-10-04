<script lang="ts">
  import { joinGame, savedName } from './lib/game.svelte'
  import { rpc } from './lib/supabase'

  let { code, onjoin } = $props()

  let name = $state(savedName())
  let preview = $state<{ theme: string; phase: string } | null>()

  $effect(() => {
    rpc('room_preview', { p_code: code }).then((r) => (preview = r[0] ?? null))
  })

  const join = async () => {
    if (await joinGame(code, name)) onjoin()
  }
</script>

<div class="logo big">808<small>s</small></div>

<div class="form">
  {#if preview === undefined}
    <p class="muted center">/// CONNECTING</p>
  {:else if preview === null}
    <p class="center">PLAYLIST NOT FOUND</p>
    <a class="btn ghost" href="#/">START YOUR OWN</a>
  {:else}
    <div class="panel framed">
      <div class="label">INCOMING INVITE</div>
      <div class="big">{preview.theme}</div>
    </div>
    <p class="muted center">/// {preview.phase === 'submit' ? 'RETURNING? USE THE SAME NAME TO TAKE YOUR SEAT' : 'IN PROGRESS · ONLY THE CREW CAN REJOIN'}</p>
    <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), join())}>
      <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
      <button class="btn">JOIN THE PLAYLIST</button>
    </form>
  {/if}
</div>
