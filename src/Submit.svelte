<script lang="ts">
  import { fade } from 'svelte/transition'
  import Art from './Art.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Share from './Share.svelte'
  import Slot from './Slot.svelte'
  import { attempt, game, isHost, me, nameOf, once, refreshSoon, type Track } from './lib/game.svelte'
  import { call, rpc } from './lib/supabase'

  const room = $derived(game.room!)
  const mine = $derived(game.songs.filter((s) => game.owners[s.id] === me()?.id))
  const slots = $derived(Array.from({ length: room.songs_per_player }, (_, i) => mine[i]))
  const total = $derived(Object.values(game.counts).reduce((a, b) => a + b, 0))
  const left = $derived(room.songs_per_player - mine.length)
  const alone = $derived(isHost() && game.players.length === 1) // the host, before anyone has joined
  const locked = $derived(game.players.filter((p) => (game.counts[p.id] ?? 0) >= room.songs_per_player).length)
  const everyoneIn = $derived(game.players.length > 1 && locked === game.players.length)
  const hostName = $derived(nameOf(game.players.find((p) => p.user_id === room.host_user_id)?.id).toUpperCase())
  const waiting = $derived(game.players.length - locked) // players still adding songs
  const startHint = $derived.by(() => {
    if (total < 2) return 'NEEDS AT LEAST 2 TRACKS TO START'
    if (everyoneIn) return "CREW STANDING BY · BEGIN THE EXPERIMENT"
    if (waiting > 0) return `${waiting} STILL ADDING · STARTING LOCKS EVERYONE'S SONGS`
    return 'STARTING LOCKS YOUR SONGS AND BUILDS THE PLAYLIST'
  })

  const taken = (t: Track) => mine.some((s) => s.spotify_id === t.id)

  const add = once(async (t: Track, scope: string) => {
    if (!taken(t)) await attempt(scope, async () => (await call('add-song', { room_id: room.id, spotify_id: t.id }), refreshSoon()))
  })

  const remove = (id: string) => attempt('songs', async () => (await rpc('remove_song', { p_song: id }), refreshSoon()))
  const startGuessing = once(() => attempt('start', () => call('start-guess', { room_id: room.id })))
</script>

<Head step={`LOADED ${mine.length} / ${room.songs_per_player}`} title="Add your songs" />

<div class="panel"><div class="label">THE PLAYLIST VIBE</div><div class="good big">{room.theme}</div></div>

{#if alone}
  <p class="muted center">/// SEND THE INVITE LINK TO YOUR FRIENDS</p>
  <Share />
{/if}
{#if left > 0}
  <p class="muted center">/// ADD {left} MORE SONG{left > 1 ? 'S' : ''} THAT FIT THE VIBE · NOBODY SEES WHO ADDED WHAT UNTIL THE REVEAL</p>
{/if}

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
<Notice scope="songs" />

{#if mine.length >= room.songs_per_player}
  <p class="center good">{everyoneIn ? (isHost() ? "EVERYONE'S IN · CREW STANDING BY FOR YOUR AUTH" : "EVERYONE'S IN") : waiting > 0 ? `TRACKS LOCKED · WAITING ON ${waiting} MORE` : 'TRACKS LOCKED'}</p>
  {#if !isHost()}
    <p class="muted center">/// {everyoneIn ? `WAITING ON ${hostName} TO BEGIN THE EXPERIMENT` : `${hostName} HOLDS THE KEY · THE EXPERIMENT BEGINS ON THEIR COMMAND`}</p>
  {/if}
{/if}

<div class="wave"></div>
<div class="split"><span>CREW</span><span class="good">{locked} / {game.players.length} DONE</span></div>
<div class="stack">
  {#each game.players as p}
    <div class="row">
      <div class="avatar">{p.name[0]}</div>
      <div class="grow">{p.name.toUpperCase()} {#if p.id === me()?.id}<span class="tag">YOU</span>{:else if p.user_id === room.host_user_id}<span class="tag">HOST</span>{/if}</div>
      <b class:good={(game.counts[p.id] ?? 0) >= room.songs_per_player}>{game.counts[p.id] ?? 0} / {room.songs_per_player}</b>
    </div>
  {/each}
</div>

{#if !alone}<Share />{/if}

<div class="grow"></div>

{#if isHost()}
  <Notice scope="start" />
  <p class="muted center">/// {startHint}</p>
  <button class="btn" disabled={total < 2} onclick={startGuessing}>BEGIN THE EXPERIMENT · {total} TRACKS</button>
{/if}
