<script lang="ts">
  import Art from './Art.svelte'
  import Head from './Head.svelte'
  import Playlist from './Playlist.svelte'
  import { fade } from 'svelte/transition'
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

  const source = $derived(nameOf(owner).toUpperCase())
  let name = $state('')
  const solved = $derived(name === source)
  $effect(() => decrypt(source, (shown) => (name = shown)))
</script>

<Head step={`${index + 1} OF ${total}`} />

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
    {#if solved && guesses.length}
      <div class="good muted" in:fade={{ duration: 150 }}>
        {right === guesses.length ? 'EVERYONE TRACED IT' : right ? `${right} OF ${guesses.length} TRACED IT` : 'NOBODY TRACED IT'}
      </div>
      {#if stamp}<div class="stamp" in:fade={{ duration: 150 }}>[ {stamp} ]</div>{/if}
    {/if}
  </div>

  {#if solved}
    <div class="split" in:fade={{ duration: 150 }}><span>HOW EVERYONE GUESSED</span></div>
    <div class="stack" in:fade={{ duration: 150 }}>
      {#each guesses as g}
        <div class="row" class:hit={g.guessed_player_id === owner}>
          <div class="avatar">{nameOf(g.guesser_id)[0]}</div>
          <div class="grow">{nameOf(g.guesser_id).toUpperCase()} {#if g.guesser_id === me()?.id}<span class="tag">YOU</span>{/if}</div>
          <span class="dim">→ {nameOf(g.guessed_player_id).toUpperCase()}</span>
          <b class:good={g.guessed_player_id === owner} class:bad={g.guessed_player_id !== owner}>{g.guessed_player_id === owner ? '✓ GOT IT' : '✗ NOT QUITE'}</b>
        </div>
      {/each}
    </div>
  {/if}
{/if}

<Playlist />

<div class="grow"></div>

{#if index > 0}<button class="btn ghost plain" onclick={() => go(index - 1)}>← PREVIOUS SOURCE</button>{/if}
<button class="btn" onclick={() => go(index + 1)}>{index < total - 1 ? 'NEXT SOURCE' : 'SEE RESULTS'}</button>
