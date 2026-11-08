<script lang="ts">
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, joinGame, savedName } from './lib/game.svelte'
  import { practice, startPractice } from './lib/practice.svelte'
  import { sourceOf, wordsOf, type Source } from './lib/sources'
  import { rpc } from './lib/supabase'

  let { code, onjoin } = $props()

  // A hijack's guests are people who tapped a tag and want a song, not players with a name: they get one automatically
  // (and can change it), so joining is a single tap.
  const guestName = () => `GUEST ${100 + Math.floor(Math.random() * 900)}`
  let name = $state(savedName())
  let named = $state(false) // the guest typed a name themselves
  let editingName = $state(false)
  let preview = $state<{ theme: string; phase: string; source: Source; mode?: 'game' | 'hijack'; now_title?: string | null; now_artist?: string | null } | null>()

  $effect(() => {
    attempt('preview', async () => (preview = (await rpc('room_preview', { p_code: code }))[0] ?? null))
  })
  $effect(() => {
    if (preview?.mode === 'hijack' && !name.trim()) name = guestName()
  })

  const join = async () => {
    // an automatic name can already be taken: try another rather than bother the guest
    for (let tries = 0; ; tries++) {
      const joined = await joinGame(code, name, preview?.mode === 'hijack' && !named && tries < 3)
      if (joined) return onjoin()
      if (joined === null) name = guestName() // retried quietly
      else return
    }
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
      <div class="label">{preview.mode === 'hijack' ? 'THE SPEAKER IS UP FOR HIJACK' : 'INCOMING TRANSMISSION'}</div>
      <div class="big">{preview.theme}</div>
    </div>
    {#if preview.mode === 'hijack'}
      {#if preview.now_title}<p class="center good hijack-playing">NOW PLAYING · {preview.now_title}{preview.now_artist ? ` · ${preview.now_artist}` : ''}</p>{/if}
      <p class="muted prose center">/// PICK THE NEXT SONG. ROLL BACK THE ONES YOU CAN'T STAND. NO APP OR ACCOUNT NEEDED.</p>
    {:else if preview.phase === 'submit'}
      <div class="panel stack">
        <div class="label">MISSION BRIEFING</div>
        <div class="line"><b class="good">1</b><span>ENTER YOUR NAME BELOW AND JOIN</span></div>
        <div class="line"><b class="good">2</b><span>ADD YOUR {wordsOf(preview.source).NOUNS} THAT FIT THE THEME</span></div>
        <div class="line"><b class="good">3</b><span>ONCE THE CREW IS IN, {sourceOf(preview.source).consume.toUpperCase()} AND GUESS WHO ADDED WHAT</span></div>
        <div class="line"><b class="good">4</b><span>SEE WHO WON</span></div>
      </div>
      <p class="muted center">/// RETURNING? USE THE SAME NAME TO TAKE YOUR SEAT</p>
    {:else}
      <p class="muted center">/// IN PROGRESS · ONLY THE CREW CAN REJOIN</p>
    {/if}
    <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), join())}>
      {#if preview.mode === 'hijack' && !editingName}
        <p class="center hijack-as">YOU'LL APPEAR AS <b class="good">{name}</b> · <button type="button" class="link" onclick={() => (editingName = true)}>CHANGE</button></p>
      {:else}
        <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} oninput={() => (named = true)} maxlength="16" required /></label>
        <p class="muted">/// USE THE NAME YOUR CREW KNOWS YOU BY</p>
      {/if}
      <Notice scope="join" />
      <button class="btn">{preview.mode === 'hijack' ? 'JOIN & PICK A SONG' : 'JOIN THE EXPERIMENT'}</button>
    </form>
    {#if !practice.on}<button type="button" class="link center" onclick={() => startPractice('guest', undefined, undefined, preview?.source)}>NEW HERE? TRY THE TUTORIAL →</button>{/if}
  {/if}
</div>
