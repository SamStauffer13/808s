<script lang="ts">
  import Awards from './Awards.svelte'
  import Subnets from './Subnets.svelte'
  import Head from './Head.svelte'
  import Playlist from './Playlist.svelte'
  import SubjectFile from './SubjectFile.svelte'
  import Notice from './Notice.svelte'
  import { game, isHost, joinNext, me, once, playAgain } from './lib/game.svelte'
  import { valid } from './lib/form'
  import { practice } from './lib/practice.svelte'
  import { sourceOf, wordsOf } from './lib/sources'
  import { analyze } from './lib/results'
  import { badges } from './lib/stamps'

  let { replay }: { replay: () => void } = $props()

  const r = $derived(analyze(game, me()?.id))
  let showFiles = $state(false) // the files are the long part of the scoreboard, so they start tucked away

  // Play again with this crew. The host gives a new vibe; once the next experiment exists everyone, the host too if they
  // come back, gets a JOIN. Practice has one game and no next one, so it shows neither.
  const next = $derived(!practice.on && game.room?.next_room_id)
  const again = $derived(!practice.on && (next || isHost()))
  let asking = $state(false)
  let vibe = $state('')
  let title = $state('')
  let tried = $state(false)
  const start = once(() => playAgain(game.room!.code, vibe, title))
  const join = once(() => joinNext(game.room!.id))
  const submit = (e: SubmitEvent) => (valid(e) ? start() : (tried = true))
</script>

<Head step="EXPERIMENT COMPLETE" />

<div class="panel framed">
  <div class="label good">{r.winners.length > 2 ? `${r.winners.length}-WAY TIE` : r.winners.length > 1 ? "IT'S A TIE" : badges.best}</div>
  {#if r.winners.length > 2}
    <div class="big center">{r.winners.map((w) => w.name.toUpperCase()).join(' · ')}</div>
  {:else}
    <div class="logo name glitch" style:--len={Math.max(1, ...r.winners.map((w) => w.name.length))}>{r.winners.map((w) => w.name.toUpperCase()).join(' + ')}</div>
  {/if}
  <div class="muted"><span class="good">{r.top}</span> / {r.winners[0]?.total} RIGHT</div>
</div>

<div class="wave"></div>
<div class="label">SUBJECT PERFORMANCE</div>
<div class="stack board">
  {#each r.scores as s, n}
    <div class="score">
      <span>{String(n + 1).padStart(2, '0')}</span>
      <span class="text">{s.name.toUpperCase()}</span>
      <div class="bar" class:win={s.correct === r.top}><i style:width={`${(s.correct / (s.total || 1)) * 100}%`}></i></div>
      <b>{s.correct}</b>
    </div>
  {/each}
</div>
<Awards worst={r.worst} blamed={r.blamed} twins={r.twins} />
<Subnets subnets={r.subnets} airGapped={r.airGapped} />

<div class="wave"></div>
{#if r.verdict}
  <div class="panel framed">
    <div class="label good glitch" class:lost={!r.hits}>[ {r.verdict.tag} ]</div>
    <div class="muted">{r.verdict.note}</div>
  </div>
{/if}
<button class="files-toggle" aria-expanded={showFiles} onclick={() => (showFiles = !showFiles)}>
  <span class="label">THE FILES · {r.files.length}</span>
  {#if r.guessed}<span class="good">YOU CRACKED {r.hits} OF {r.guessed}</span>{/if}
  <span>{showFiles ? '▴' : '▾'}</span>
</button>
{#if showFiles}
  <p class="muted prose">Each file is one person's {wordsOf().nouns}, most guessed on top. Tap one to see who guessed what.</p>
  <div class="files">
    {#each r.files as file, rank (file.id)}<SubjectFile {file} {rank} />{/each}
  </div>
{/if}

<Playlist />

<div class="grow"></div>
{#if next}
  <p class="notice">NEXT EXPERIMENT IS READY</p>
  <button class="btn" onclick={join}>JOIN THE NEXT EXPERIMENT</button>
{:else if again && asking}
  <form class="form" class:tried novalidate autocomplete="off" onsubmit={submit}>
    <label class="field">
      <span class="label">THE NEW {sourceOf().vibe} VIBE</span>
      <input bind:value={vibe} maxlength="140" pattern=".*\S.*" placeholder={sourceOf().vibePlaceholder} required />
      {#if tried && !vibe.trim()}<span class="err">/// ADD A VIBE FOR YOUR CREW</span>{/if}
    </label>
    {#if sourceOf().playlist}
      <label class="field">
        <span class="label">PLAYLIST NAME · OPTIONAL</span>
        <input bind:value={title} maxlength="100" placeholder="e.g. makeup is war paint" />
      </label>
    {/if}
    <button class="btn">START THE NEXT EXPERIMENT</button>
  </form>
{:else if again}
  <button class="btn" onclick={() => (asking = true)}>PLAY AGAIN WITH THIS CREW</button>
{/if}
{#if again}<Notice scope="again" />{/if}
<button class="btn ghost" onclick={replay}>REPLAY THE FINDINGS</button>
<a class="btn" class:ghost={again} href="#/">NEW EXPERIMENT</a>
