<script lang="ts">
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import { attempt, game, me, nameOf, packsOf } from './lib/game.svelte'
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
  const mine = $derived(
    packsOf(game.songs).flatMap(({ songs }) => {
      const g = game.guesses.find((g) => g.song_id === songs[0].id && g.guesser_id === me()?.id)
      return g ? [{ songs, guess: g.guessed_player_id, owner: game.owners[songs[0].id] }] : []
    }),
  )
  const hits = $derived(mine.filter((m) => m.guess === m.owner).length)
</script>

<Head step="EXPERIMENT COMPLETE" />

<div class="panel framed">
  <div class="label good">{winners.length > 1 ? 'IT\'S A TIE' : 'L33T'}</div>
  <div class="logo name" style:--len={Math.max(1, ...winners.map((w) => w.name.length))}>{winners.map((w) => w.name.toUpperCase()).join(' + ')}</div>
  <div class="muted"><span class="good">{top}</span> / {winners[0]?.total} CRACKED</div>
</div>

<div class="wave"></div>
<div class="label">LEADERBOARD</div>
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

<div class="split"><span>YOUR GUESSES</span><span class="good">{hits} OF {mine.length} RIGHT</span></div>
<div class="stack">
  {#each mine as m}
    <div class="row" class:hit={m.guess === m.owner}>
      <div class="grow-text">
        <div>{m.songs.map((s) => s.title).join(' · ')}</div>
        <div class="dim">YOU: {nameOf(m.guess).toUpperCase()}{m.guess === m.owner ? '' : ` · IT WAS ${nameOf(m.owner).toUpperCase()}`}</div>
      </div>
      <b class:good={m.guess === m.owner} class:bad={m.guess !== m.owner}>{m.guess === m.owner ? '✓' : '✗'}</b>
    </div>
  {/each}
</div>

<Playlist />

<div class="grow"></div>
<button class="btn ghost" onclick={replay}>REPLAY THE FINDINGS</button>
<a class="btn" href="#/">NEW EXPERIMENT</a>
