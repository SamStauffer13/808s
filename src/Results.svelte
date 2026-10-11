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

  // your own report: for every box that is not yours, who you said and who it really was
  const calls = $derived(
    sets.flatMap((s, i) => {
      const mine = s.guesses.find((g) => g.guesser_id === me()?.id)
      return mine ? [{ i, song: s.pack.songs[0], owner: s.owner, pick: mine.guessed_player_id, hit: mine.guessed_player_id === s.owner }] : []
    }),
  )
  const verdict = $derived.by(() => {
    const n = calls.length
    const share = n ? hits / n : 0
    if (n > 1 && hits === n) return { tag: 'MIND READER', note: 'EVERY SINGLE ONE. ARE YOU IN THEIR HEADS?' }
    if (n > 1 && hits === 0) return { tag: 'COMPLETE STRANGER', note: 'NOT ONE. YOU DO NOT KNOW THESE PEOPLE.' }
    if (share >= 0.5) return { tag: 'DECENT SIGNAL', note: 'YOU KNOW YOUR CREW. MOSTLY.' }
    return { tag: 'MOSTLY STATIC', note: 'A FEW LUCKY HITS IN THE NOISE.' }
  })

  // crew awards, from what everyone guessed
  // a crew-wide tie for last is not an award, so only one or two names qualify
  const worst = $derived.by(() => {
    const last = scores[scores.length - 1]?.correct
    const tied = scores.filter((s) => s.correct === last)
    return scores.length > 1 && last < top && tied.length <= 2 ? tied : []
  })
  const blamed = $derived.by(() => {
    const wrong = new Map<string, number>()
    for (const s of sets) for (const g of s.guesses) if (g.guessed_player_id !== s.owner) wrong.set(g.guessed_player_id, (wrong.get(g.guessed_player_id) ?? 0) + 1)
    const most = Math.max(0, ...wrong.values())
    return most < 2 ? [] : [...wrong].filter(([, n]) => n === most).map(([id]) => ({ id, n: most }))
  })

  // the song-by-song browser: any set can be opened from the chart, or stepped through with the arrows
  let at = $state(0)
  const set = $derived(sets[at])
  const step = (by: number) => (at = Math.min(sets.length - 1, Math.max(0, at + by)))
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

  // one row per person (each added one box), the most guessed first; a tap opens their box below
  const people = $derived(
    sets
      .map((s, i) => ({ i, name: nameOf(s.owner), yours: s.yours, stamp: s.stamp, ...s.stats, share: pct(s.stats.right, s.stats.guessers) }))
      .sort((a, b) => b.share - a.share || b.guessers - a.guessers || a.name.localeCompare(b.name)),
  )
</script>

<Head step="EXPERIMENT COMPLETE" />

<div class="panel framed">
  <div class="label good">{winners.length > 2 ? `${winners.length}-WAY TIE` : winners.length > 1 ? "IT'S A TIE" : 'L33T'}</div>
  {#if winners.length > 2}
    <div class="big center">{winners.map((w) => w.name.toUpperCase()).join(' · ')}</div>
  {:else}
    <div class="logo name" style:--len={Math.max(1, ...winners.map((w) => w.name.length))}>{winners.map((w) => w.name.toUpperCase()).join(' + ')}</div>
  {/if}
  <div class="muted"><span class="good">{top}</span> / {winners[0]?.total} RIGHT</div>
</div>

<div class="wave"></div>
<div class="label">SUBJECT PERFORMANCE</div>
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

{#if calls.length}
  <div class="wave"></div>
  <div class="split"><span class="label">YOUR REPORT</span><span class="good">{hits} OF {calls.length} CRACKED</span></div>
  <div class="panel framed report">
    <div class="label good">[ {verdict.tag} ]</div>
    <div class="muted">{verdict.note}</div>
  </div>
  <div class="stack">
    {#each calls as c}
      <button class="call" class:hit={c.hit} onclick={() => (at = c.i)} aria-label={`${c.song.title}: ${c.hit ? 'you got it' : 'you missed it'}`}>
        <b>{c.hit ? '✓' : '✗'}</b>
        <span class="grow-text"><span class="text">{c.song.title}</span><span class="dim">{c.hit ? `YOU SAID ${nameOf(c.pick).toUpperCase()} · NAILED IT` : `YOU SAID ${nameOf(c.pick).toUpperCase()} · IT WAS ${nameOf(c.owner).toUpperCase()}`}</span></span>
      </button>
    {/each}
  </div>
{/if}

{#if worst.length || blamed.length}
  <div class="wave"></div>
  <div class="label">CREW AWARDS</div>
  <div class="stack awards">
    {#if worst.length}
      <div class="award"><span class="stamp">[ ZERO SIGNAL ]</span><span class="text">{worst.map((w) => w.name.toUpperCase()).join(' + ')}</span><span class="dim">ONLY {worst[0].correct} OF {worst[0].total} RIGHT</span></div>
    {/if}
    {#if blamed.length}
      <div class="award"><span class="stamp">[ THE DECOY ]</span><span class="text">{blamed.map((b) => nameOf(b.id).toUpperCase()).join(' + ')}</span><span class="dim">WRONGLY BLAMED {blamed[0].n} TIMES</span></div>
    {/if}
  </div>
{/if}

<div class="wave"></div>
<div class="split"><span class="label">HOW READABLE WAS EACH PERSON?</span><span class="good">{right} OF {all} RIGHT</span></div>
<p class="muted">% OF GUESSERS WHO CRACKED THEM · MOST GUESSED ON TOP · STAMPS MARK THE EXTREMES · TAP A NAME TO OPEN THEIR BOX BELOW</p>
<div class="chart">
  {#each people as p, n}
    <button class="chartrow" class:on={p.i === at} style:--n={n} onclick={() => (at = p.i)} aria-label={`${p.name}: ${p.right} of ${p.guessers} guessed right, ${p.share} percent`}>
      <span class="who">
        <span class="dim">{String(n + 1).padStart(2, '0')}</span>
        <span class="text">{p.name.toUpperCase()}</span>
        {#if p.yours}<span class="tag">YOU</span>{/if}
        {#if p.stamp}<span class="flag" title={noteOf(p.stamp)}>{p.stamp}</span>{/if}
      </span>
      <span class="pct"><span class="dim">{p.right}/{p.guessers}</span> <b class:good={p.share >= 50}>{p.guessers ? `${p.share}%` : '--'}</b></span>
      <span class="meter"><span class="vs"><i class="r" style:width={`${p.share}%`}></i></span></span>
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
