<script lang="ts">
  import { fade } from 'svelte/transition'
  import Art from './Art.svelte'
  import Head from './Head.svelte'
  import Share from './Share.svelte'
  import Slot from './Slot.svelte'
  import { attempt, game, isHost, me, once, refresh, type Track } from './lib/game.svelte'
  import { call, rpc } from './lib/supabase'

  const room = $derived(game.room!)
  const mine = $derived(game.songs.filter((s) => game.owners[s.id] === me()?.id))
  const slots = $derived(Array.from({ length: room.songs_per_player }, (_, i) => mine[i]))
  const total = $derived(Object.values(game.counts).reduce((a, b) => a + b, 0))
  const locked = $derived(game.players.filter((p) => (game.counts[p.id] ?? 0) >= room.songs_per_player).length)

  const taken = (t: Track) => mine.some((s) => s.spotify_id === t.id)

  const add = once(async (t: Track) => {
    if (!taken(t)) await attempt(async () => (await call('add-song', { room_id: room.id, spotify_id: t.id }), refresh()))
  })

  const remove = (id: string) => attempt(async () => (await rpc('remove_song', { p_song: id }), refresh()))
  const startGuessing = once(() => attempt(() => call('start-guess', { room_id: room.id })))
</script>

<Head step={`PICK ${mine.length} / ${room.songs_per_player}`} title="Add your songs" />

<div class="panel"><div class="label">THE PROMPT</div><div class="good big">{room.theme}</div></div>

{#each slots as s, i}
  {#if s}
    <div class="row" in:fade={{ duration: 150 }}>
      <Art src={s.art_url} />
      <div class="grow-text"><div>{s.title}</div><div class="dim">{s.artist}</div></div>
      <button class="round" onclick={() => remove(s.id)} aria-label="Remove song">×</button>
    </div>
  {:else}
    <Slot n={i + 1} {taken} onpick={add} />
  {/if}
{/each}

{#if mine.length >= room.songs_per_player}
  <p class="center good">ALL LOCKED IN · WAITING FOR THE OTHERS</p>
{/if}

<p class="muted center">/// NOBODY SEES WHO ADDED WHAT. UNTIL THE REVEAL.</p>

<div class="split"><span>FRIENDS</span><span class="good">{locked} / {game.players.length} DONE</span></div>
<div class="stack">
  {#each game.players as p}
    <div class="row">
      <div class="avatar">{p.name[0]}</div>
      <div class="grow">{p.name.toUpperCase()} {#if p.id === me()?.id}<span class="tag">YOU</span>{:else if p.user_id === room.host_user_id}<span class="tag">HOST</span>{/if}</div>
      <b class:good={(game.counts[p.id] ?? 0) >= room.songs_per_player}>{game.counts[p.id] ?? 0} / {room.songs_per_player}</b>
    </div>
  {/each}
</div>

<Share />

<div class="grow"></div>

{#if isHost()}
  <button class="btn" disabled={total < 2} onclick={startGuessing}>START GUESSING · {total} SONGS</button>
{/if}
