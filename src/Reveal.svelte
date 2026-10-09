<script lang="ts">
  import Art from './Art.svelte'
  import { decrypt } from './lib/decrypt'
  import { game, me, nameOf, packsOf } from './lib/game.svelte'
  import { statsOf, stampFor } from './lib/stamps'

  // index is the set being shown; go moves this player (and only this player) to another one
  let { index, total, go }: { index: number; total: number; go: (to: number) => void } = $props()

  const pack = $derived(packsOf(game.songs)[index])
  const owner = $derived(game.owners[pack?.songs[0].id])
  const guesses = $derived(game.guesses.filter((g) => g.song_id === pack?.songs[0].id))
  const right = $derived(guesses.filter((g) => g.guessed_player_id === owner).length)
  const stamp = $derived(stampFor(statsOf(guesses, owner)))
  const mine = $derived(guesses.find((g) => g.guesser_id === me()?.id))
  const yours = $derived(owner === me()?.id)

  const source = $derived(nameOf(owner).toUpperCase())
  let name = $state('')
  const solved = $derived(name === source)
  $effect(() => decrypt(source, (shown) => (name = shown)))

  const next = () => go(index + 1)
  const back = () => index > 0 && go(index - 1)

  // swiping sideways moves between sets; the buttons do the same
  let start = { x: 0, y: 0 }
  const touchStart = (e: TouchEvent) => (start = { x: e.touches[0].clientX, y: e.touches[0].clientY })
  const touchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50) dx < 0 ? next() : back()
  }
</script>

<svelte:window ontouchstart={touchStart} ontouchend={touchEnd} />

<div class="stack">
  <div class="split">
    <span>{index + 1} OF {total}</span>
    <button class="link" onclick={() => go(total)}>SKIP TO RESULTS</button>
  </div>
  <div class="progress" aria-hidden="true">
    {#each { length: total } as _, i}<i class:seen={i <= index}></i>{/each}
  </div>

  {#if pack}
    {#each pack.songs as song}
      <div class="row">
        <Art src={song.art_url} />
        <div class="grow-text"><div>{song.title}</div><div class="dim">{song.artist}</div></div>
      </div>
    {/each}

    <div class="panel framed">
      <div class="label">{solved ? 'SOURCE IDENTIFIED' : 'DECRYPTING…'}</div>
      <div class="avatar big">{name[0]}</div>
      <div class="logo name" style:--len={source.length}>{name}</div>
    </div>

    <!-- always laid out, only faded in, so the buttons below never jump when the name resolves -->
    <div class="veil" class:veiled={!solved} aria-hidden={!solved}>
      {#if yours}
        <p class="verdict muted">YOUR SONGS</p>
      {:else if !mine}
        <p class="verdict muted">YOU DIDN'T GUESS THIS ONE</p>
      {:else if mine.guessed_player_id === owner}
        <p class="verdict good">✓ YOU TRACED IT</p>
      {:else}
        <p class="verdict">✗ YOU SAID {nameOf(mine.guessed_player_id).toUpperCase()}</p>
      {/if}

      <div class="split">
        <span class="good">{right === guesses.length ? 'EVERYONE' : right ? `${right} OF ${guesses.length}` : 'NOBODY'} TRACED IT</span>
        {#if stamp}<span class="stamp">[ {stamp} ]</span>{/if}
      </div>

      <div class="guesses">
        {#each guesses as g}
          {@const hit = g.guessed_player_id === owner}
          <div class="guess" class:hit class:me={g.guesser_id === me()?.id}>
            <span><b class:good={hit}>{hit ? '✓' : '✗'}</b> {nameOf(g.guesser_id).toUpperCase()}{#if g.guesser_id === me()?.id} <span class="tag">YOU</span>{/if}</span>
            {#if !hit}<span class="dim">→ {nameOf(g.guessed_player_id).toUpperCase()}</span>{/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<div class="grow"></div>

<!-- stays at the bottom of the screen, in thumb reach, however long the page is -->
<div class="dock">
  {#if index > 0}<button class="btn ghost plain prev" onclick={back} aria-label="Previous source">←</button>{/if}
  <button class="btn" onclick={next}>{index < total - 1 ? 'NEXT SOURCE' : 'SEE RESULTS'}</button>
</div>
