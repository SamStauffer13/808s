<script lang="ts">
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import Scramble from './Scramble.svelte'
  import { attempt, game, me, nameOf, packsOf } from './lib/game.svelte'
  import { noteOf, statsOf, stampFor } from './lib/stamps'
  import { rpc } from './lib/supabase'

  let { replay }: { replay: () => void } = $props()

  type Score = { player_id: string; name: string; correct: number; total: number }

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
  const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)

  // one file per subject (a person and the songs they added), the most guessed first, with how you called it
  const files = $derived(
    sets
      .map((s) => {
        const mine = s.guesses.find((g) => g.guesser_id === me()?.id)
        return {
          id: s.owner ?? s.pack.id,
          name: nameOf(s.owner),
          yours: s.yours,
          songs: s.pack.songs,
          guesses: s.guesses,
          stamp: s.stamp,
          ...s.stats,
          share: pct(s.stats.right, s.stats.guessers),
          call: mine ? { pick: mine.guessed_player_id, hit: mine.guessed_player_id === s.owner } : null,
        }
      })
      .sort((a, b) => b.share - a.share || b.guessers - a.guessers || a.name.localeCompare(b.name)),
  )
  const calls = $derived(files.filter((f) => f.call))
  const hits = $derived(calls.filter((f) => f.call!.hit).length)

  // only a perfect or a zero earns a title
  const verdict = $derived(
    calls.length < 2 ? null
    : hits === calls.length ? { tag: 'L33T', note: 'EVERY SINGLE ONE. ARE YOU IN THEIR HEADS?' }
    : hits === 0 ? { tag: 'N00B', note: 'NOT ONE. YOU DO NOT KNOW THESE PEOPLE.' }
    : null,
  )

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

  // the guess grid: every guesser (rows) against every subject (columns), in leaderboard order on both sides
  const ranked = $derived(scores.length ? scores.flatMap((sc) => game.players.filter((p) => p.id === sc.player_id)) : game.players)
  const subjects = $derived(ranked.filter((p) => sets.some((s) => s.owner === p.id)))
  // the shortest start of each name that tells everyone apart, so a column only needs a few letters
  const codes = $derived.by(() => {
    const names = ranked.map((p) => p.name.toUpperCase())
    let n = 2
    while (n < 5 && new Set(names.map((x) => x.slice(0, n))).size < new Set(names).size) n++
    return Object.fromEntries(ranked.map((p, i) => [p.id, names[i].slice(0, n)]))
  })
  const guessOf = (guesser: string, subject: string) => sets.find((s) => s.owner === subject)?.guesses.find((g) => g.guesser_id === guesser)

  let open = $state<Record<string, boolean>>({})
</script>

<Head step="EXPERIMENT COMPLETE" />

<div class="panel framed">
  <div class="label good">{winners.length > 2 ? `${winners.length}-WAY TIE` : winners.length > 1 ? "IT'S A TIE" : 'L33T'}</div>
  {#if winners.length > 2}
    <div class="big center">{winners.map((w) => w.name.toUpperCase()).join(' · ')}</div>
  {:else}
    <div class="logo name glitch" style:--len={Math.max(1, ...winners.map((w) => w.name.length))}>{winners.map((w) => w.name.toUpperCase()).join(' + ')}</div>
  {/if}
  <div class="muted"><span class="good">{top}</span> / {winners[0]?.total} RIGHT</div>
</div>

{#if subjects.length}
  <div class="split"><span class="label">THE GUESS GRID</span><span class="good">{right} OF {all} RIGHT</span></div>
  <div class="gridwrap">
    <table class="grid">
      <thead>
        <tr>
          <th><span class="sr">Guesser</span></th>
          {#each subjects as c}<th class:me={c.id === me()?.id} title={c.name}>{codes[c.id]}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each ranked as r, ri}
          <tr class:me={r.id === me()?.id}>
            <th scope="row">{r.name.toUpperCase()}</th>
            {#each subjects as c, ci}
              {@const g = guessOf(r.id, c.id)}
              <td class:hit={g && g.guessed_player_id === c.id} class:miss={g && g.guessed_player_id !== c.id} style:--n={ri + ci} title={g ? `${r.name} guessed ${nameOf(g.guessed_player_id)} for ${c.name}` : ''}>
                {#if r.id === c.id}·{:else if !g}–{:else if g.guessed_player_id === c.id}✓{:else}{codes[g.guessed_player_id]}{/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="muted">ROWS GUESS · COLUMNS ARE THE SUBJECTS · <span class="good">✓</span> CRACKED IT · <span class="bad">RED</span> IS WHO THEY BLAMED</p>
{/if}

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

{#if worst.length || blamed.length}
  <div class="stack awards">
    {#if worst.length}
      <div class="award"><span class="stamp">[ N00B ]</span><span class="text">{worst.map((w) => w.name.toUpperCase()).join(' + ')}</span><span class="dim">ONLY {worst[0].correct} OF {worst[0].total} RIGHT</span></div>
    {/if}
    {#if blamed.length}
      <div class="award"><span class="stamp">[ HONEYPOT ]</span><span class="text">{blamed.map((b) => nameOf(b.id).toUpperCase()).join(' + ')}</span><span class="dim">WRONGLY BLAMED {blamed[0].n} TIMES</span></div>
    {/if}
  </div>
{/if}

<div class="wave"></div>
<div class="split"><span class="label">THE FILES</span>{#if calls.length}<span class="good">YOU CRACKED {hits} OF {calls.length}</span>{/if}</div>
{#if verdict}
  <div class="panel framed">
    <div class="label good glitch" class:lost={!hits}>[ {verdict.tag} ]</div>
    <div class="muted">{verdict.note}</div>
  </div>
{/if}
<p class="muted">ONE FILE PER SUBJECT · MOST GUESSED ON TOP · TAP A FILE TO SEE WHO GUESSED WHAT</p>
<div class="files">
  {#each files as f, n (f.id)}
    <div class="file" class:open={open[f.id]} class:hit={f.call?.hit} class:miss={f.call && !f.call.hit}>
      <button class="head" aria-expanded={!!open[f.id]} onclick={() => (open[f.id] = !open[f.id])}>
        <span class="who">
          <span class="dim">{String(n + 1).padStart(2, '0')}</span>
          <span class="text"><Scramble text={f.name.toUpperCase()} delay={Math.min(n * 150, 1200)} /></span>
          {#if f.yours}<span class="tag">YOU</span>{/if}
          {#if f.stamp}<span class="flag" title={noteOf(f.stamp)}>{f.stamp}</span>{/if}
        </span>
        <span class="pct"><span class="dim">{f.right}/{f.guessers}</span> <b class:good={f.share >= 50}>{f.guessers ? `${f.share}%` : '--'}</b> <span class="dim">{open[f.id] ? '▴' : '▾'}</span></span>
        <span class="meter"><span class="vs"><i class="r" style:width={`${f.share}%`} style:--n={n}></i></span></span>
        <span class="songs">
          {#each f.songs as song}<span>♪ {song.title} <span class="dim">· {song.artist}</span></span>{/each}
        </span>
        {#if f.call}
          <span class="you">YOU {f.call.hit ? '✓ NAILED IT' : `✗ SAID ${nameOf(f.call.pick).toUpperCase()}`}</span>
        {:else if f.yours}
          <span class="you">YOUR SONGS</span>
        {/if}
      </button>
      {#if open[f.id]}
        <div class="guesses">
          {#each f.guesses as g}
            {@const hit = g.guessed_player_id === f.id}
            <div class="guess" class:hit class:me={g.guesser_id === me()?.id}>
              <span><b class:good={hit}>{hit ? '✓' : '✗'}</b> {nameOf(g.guesser_id).toUpperCase()}{#if g.guesser_id === me()?.id} <span class="tag">YOU</span>{/if}</span>
              {#if !hit}<span class="dim">→ {nameOf(g.guessed_player_id).toUpperCase()}</span>{/if}
            </div>
          {/each}
        </div>
        {#if f.stamp}<p class="muted note">{noteOf(f.stamp)}</p>{/if}
      {/if}
    </div>
  {/each}
</div>

<Playlist />

<div class="grow"></div>
<button class="btn ghost" onclick={replay}>REPLAY THE FINDINGS</button>
<a class="btn" href="#/">NEW EXPERIMENT</a>
