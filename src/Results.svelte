<script lang="ts">
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import Art from './Art.svelte'
  import { attempt, game, me, nameOf, packsOf } from './lib/game.svelte'
  import { noteOf, statsOf, stampFor } from './lib/stamps'
  import { rpc } from './lib/supabase'

  let { replay }: { replay: () => void } = $props()

  type Score ={ player_id: string; name: string; correct: number; total: number }

  const room = $derived(game.room!)
  let scores = $state<Score[]>([])
  $effect(() => {
    attempt('scores', async () => (scores = await rpc('room_scores', { p_room: room.id })))
  })

  const top = $derived(scores[0]?.correct ?? 0)
  const winners = $derived(scores.filter((s) => s.correct === top))
  const sets = $derived(
    packsOf(game.songs).map((pack) => {
      const id = pack.songs[0].id
      const owner = game.owners[id]
      const guesses = game.guesses.filter((g) => g.song_id === id)
      const stats = statsOf(guesses, owner)
      return { pack, owner, guesses, stats, stamp: stampFor(stats), yours: owner === me()?.id }
    }),
  )
  const right = $derived(sets.reduce((n, s) => n + s.stats.right, 0))
  const all = $derived(sets.reduce((n, s) => n + s.stats.guessers, 0))
  const hits = $derived(sets.filter((s) => s.guesses.some((g) => g.guesser_id === me()?.id && g.guessed_player_id === s.owner)).length)
  const guessed = $derived(sets.filter((s) => s.guesses.some((g) => g.guesser_id === me()?.id)).length)

  // the song-by-song browser: any set can be opened from the chart, or stepped through with the arrows
  let at = $state(0)
  const set = $derived(sets[at])
  const step = (by: number) => (at = Math.min(sets.length - 1, Math.max(0, at + by)))
  const pct = (n: number, of: number) => (of ? (n / of) * 100 : 0)
</script>

<Head step="EXPERIMENT COMPLETE" />

<div class="panel framed">
  <div class="label good">{winners.length > 2 ? `${winners.length}-WAY TIE` : winners.length > 1 ? "IT'S A TIE" : 'L33T · TOP SCORER'}</div>
  {#if winners.length > 2}
    <div class="big center">{winners.map((w) => w.name.toUpperCase()).join(' · ')}</div>
  {:else}
    <div class="logo name" style:--len={Math.max(1, ...winners.map((w) => w.name.length))}>{winners.map((w) => w.name.toUpperCase()).join(' + ')}</div>
  {/if}
  <div class="muted"><span class="good">{top}</span> / {winners[0]?.total} RIGHT</div>
</div>

<div class="wave"></div>
<div class="label">LEADERBOARD · BOXES GUESSED RIGHT</div>
<Notice scope="scores" />
<div class="stack">
  {#each scores as s, n}
    <div class="score">
      <span>{String(n + 1).padStart(2, '0')}</span>
      <span class="text">{s.name.toUpperCase()}</span>
      <div class="bar" class:win={s.correct === top}><i style:width={`${(s.correct / (s.total || 1)) * 100}%`}></i></div>
      <b>{s.correct}</b>
    </div>
  {/each}
</div>

<div class="wave"></div>
<div class="split"><span class="label">HOW THE CREW DID</span><span class="good">{right} OF {all} RIGHT</span></div>
<p class="muted">EACH BAR IS ONE BOX OF SONGS · <span class="good">RIGHT</span> VS WRONG · TAP A BAR TO OPEN IT BELOW</p>
<div class="chart" role="list">
  {#each sets as s, i}
    <button class="chartrow" class:on={i === at} role="listitem" onclick={() => (at = i)} aria-label={`Box ${i + 1}: ${s.stats.right} right, ${s.stats.guessers - s.stats.right} wrong`}>
      <span>{String(i + 1).padStart(2, '0')}</span>
      <div class="vs"><i class="r" style:width={`${pct(s.stats.right, s.stats.guessers)}%`}></i></div>
      <b>{s.stats.right}/{s.stats.guessers}</b>
    </button>
  {/each}
</div>

{#if set}
  <div class="wave"></div>
  <div class="split"><span class="label">SONG BY SONG · {at + 1} OF {sets.length}</span><span class="good">YOU: {hits} OF {guessed} RIGHT</span></div>
  <div class="panel stack">
    {#each set.pack.songs as song}
      <div class="row">
        <Art src={song.art_url} />
        <div class="grow-text"><div>{song.title}</div><div class="dim">{song.artist}</div></div>
      </div>
    {/each}
    <div class="label">ADDED BY</div>
    <div class="logo name" style:--len={nameOf(set.owner).length}>{nameOf(set.owner).toUpperCase()}{#if set.yours} <span class="tag">YOU</span>{/if}</div>
    <div class="split">
      <span class="good">{set.stats.right} OF {set.stats.guessers} GUESSED RIGHT</span>
      {#if set.stamp}<span class="stamp">[ {set.stamp} ]</span>{/if}
    </div>
    {#if set.stamp}<p class="muted">{noteOf(set.stamp)}</p>{/if}
    <div class="guesses">
      {#each set.guesses as g}
        {@const hit = g.guessed_player_id === set.owner}
        <div class="guess" class:hit class:me={g.guesser_id === me()?.id}>
          <span><b class:good={hit}>{hit ? '✓' : '✗'}</b> {nameOf(g.guesser_id).toUpperCase()}{#if g.guesser_id === me()?.id} <span class="tag">YOU</span>{/if}</span>
          {#if !hit}<span class="dim">→ {nameOf(g.guessed_player_id).toUpperCase()}</span>{/if}
        </div>
      {/each}
    </div>
  </div>
  <div class="split pager">
    <button class="btn ghost" onclick={() => step(-1)} disabled={at === 0} aria-label="Previous box">← PREV</button>
    <button class="btn ghost" onclick={() => step(1)} disabled={at === sets.length - 1} aria-label="Next box">NEXT →</button>
  </div>
{/if}

<Playlist />

<div class="grow"></div>
<button class="btn ghost" onclick={replay}>REPLAY THE FINDINGS</button>
<a class="btn" href="#/">NEW EXPERIMENT</a>
