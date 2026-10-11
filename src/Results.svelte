<script lang="ts">
  import Awards from './Awards.svelte'
  import GuessGrid from './GuessGrid.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import SubjectFile from './SubjectFile.svelte'
  import { attempt, game, me } from './lib/game.svelte'
  import { analyze, type Score } from './lib/results'
  import { badges } from './lib/stamps'
  import { rpc } from './lib/supabase'

  let { replay }: { replay: () => void } = $props()

  let scores = $state<Score[]>([])
  $effect(() => {
    const room = game.room!.id
    attempt('scores', async () => (scores = await rpc('room_scores', { p_room: room })))
  })

  const r = $derived(analyze(game, scores, me()?.id))
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

{#if r.grid.subjects.length}<GuessGrid grid={r.grid} right={r.right} all={r.all} />{/if}

<div class="wave"></div>
<div class="label">SUBJECT PERFORMANCE</div>
<Notice scope="scores" />
<div class="stack">
  {#each scores as s, n}
    <div class="score">
      <span>{String(n + 1).padStart(2, '0')}</span>
      <span class="text">{s.name.toUpperCase()}</span>
      <div class="bar" class:win={s.correct === r.top}><i style:width={`${(s.correct / (s.total || 1)) * 100}%`}></i></div>
      <b>{s.correct}</b>
    </div>
  {/each}
</div>
<Awards worst={r.worst} blamed={r.blamed} />

<div class="wave"></div>
<div class="split"><span class="label">THE FILES</span>{#if r.guessed}<span class="good">YOU CRACKED {r.hits} OF {r.guessed}</span>{/if}</div>
{#if r.verdict}
  <div class="panel framed">
    <div class="label good glitch" class:lost={!r.hits}>[ {r.verdict.tag} ]</div>
    <div class="muted">{r.verdict.note}</div>
  </div>
{/if}
<p class="muted">ONE FILE PER SUBJECT · MOST GUESSED ON TOP · TAP A FILE TO SEE WHO GUESSED WHAT</p>
<div class="files">
  {#each r.files as file, rank (file.id)}<SubjectFile {file} {rank} />{/each}
</div>

<Playlist />

<div class="grow"></div>
<button class="btn ghost" onclick={replay}>REPLAY THE FINDINGS</button>
<a class="btn" href="#/">NEW EXPERIMENT</a>
