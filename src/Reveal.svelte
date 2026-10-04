<script lang="ts">
  import Art from './Art.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import { fade } from 'svelte/transition'
  import { decrypt } from './lib/decrypt'
  import { attempt, game, isHost, me, nameOf, once, packsOf } from './lib/game.svelte'
  import { rpc } from './lib/supabase'

  const room = $derived(game.room!)
  const packs = $derived(packsOf(game.songs))
  const last = $derived(packs.length - 1)
  const pack = $derived(packs[Math.min(room.reveal_index, last)])
  const owner = $derived(game.owners[pack?.songs[0].id])
  const guesses = $derived(game.guesses.filter((g) => g.song_id === pack?.songs[0].id))
  const right = $derived(guesses.filter((g) => g.guessed_player_id === owner).length)

  const source = $derived(nameOf(owner).toUpperCase())
  let name = $state('')
  const solved = $derived(name === source)
  $effect(() => decrypt(source, (shown) => (name = shown)))

  const next = once(() =>
    attempt('next', () =>
      room.reveal_index < last
        ? rpc('host_set_reveal_index', { p_room: room.id, p_index: room.reveal_index + 1 })
        : rpc('host_set_phase', { p_room: room.id, p_phase: 'done' }),
    ),
  )
</script>

<Head step={`${room.reveal_index + 1} OF ${packs.length}`} />

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
    <div class="logo name">{name}</div>
    {#if solved && guesses.length}
      <div class="good muted" in:fade={{ duration: 150 }}>
        {right === guesses.length ? 'EVERYONE TRACED IT' : right ? `${right} OF ${guesses.length} TRACED IT` : 'NOBODY TRACED IT'}
      </div>
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

{#if isHost()}
  <Notice scope="next" />
  <button class="btn" onclick={next}>{room.reveal_index < last ? 'NEXT SOURCE' : 'SEE RESULTS'}</button>
{:else}
  <p class="muted center">/// HOST CONTROLS THE REVEAL</p>
{/if}
