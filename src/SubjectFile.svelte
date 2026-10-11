<script lang="ts">
  import Scramble from './Scramble.svelte'
  import { me, nameOf } from './lib/game.svelte'
  import type { Analysis } from './lib/results'
  import { noteOf } from './lib/stamps'

  // One subject: who they are, the songs they added, how the crew did and how you called it. A tap shows who guessed what.
  let { file, rank }: { file: Analysis['files'][number]; rank: number } = $props()
  let open = $state(false)
  const upper = (id?: string) => nameOf(id).toUpperCase()
</script>

<div class="file" class:open class:hit={file.call?.hit} class:miss={file.call && !file.call.hit}>
  <button class="head" aria-expanded={open} onclick={() => (open = !open)}>
    <span class="who">
      <span class="dim">{String(rank + 1).padStart(2, '0')}</span>
      <span class="text"><Scramble text={file.name.toUpperCase()} delay={Math.min(rank * 150, 1200)} /></span>
      {#if file.yours}<span class="tag">YOU</span>{/if}
      {#if file.stamp}<span class="flag" title={noteOf(file.stamp)}>{file.stamp}</span>{/if}
    </span>
    <span class="pct"><span class="dim">{file.right}/{file.guessers}</span> <b class:good={file.share >= 50}>{file.guessers ? `${file.share}%` : '--'}</b> <span class="dim">{open ? '▴' : '▾'}</span></span>
    <span class="meter"><span class="vs"><i class="r" style:width={`${file.share}%`} style:--n={rank}></i></span></span>
    <span class="songs">
      {#each file.songs as song}<span>♪ {song.title} <span class="dim">· {song.artist}</span></span>{/each}
    </span>
    {#if file.call}
      <span class="you">YOU {file.call.hit ? '✓ NAILED IT' : `✗ SAID ${upper(file.call.pick)}`}</span>
    {:else if file.yours}
      <span class="you">YOUR SONGS</span>
    {/if}
  </button>
  {#if open}
    <div class="guesses">
      {#each file.guesses as g}
        {@const hit = g.guessed_player_id === file.id}
        <div class="guess" class:hit class:me={g.guesser_id === me()?.id}>
          <span><b class:good={hit}>{hit ? '✓' : '✗'}</b> {upper(g.guesser_id)}{#if g.guesser_id === me()?.id} <span class="tag">YOU</span>{/if}</span>
          {#if !hit}<span class="dim">→ {upper(g.guessed_player_id)}</span>{/if}
        </div>
      {/each}
    </div>
    {#if file.stamp}<p class="muted note">{noteOf(file.stamp)}</p>{/if}
  {/if}
</div>
