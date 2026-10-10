<script lang="ts">
  import { fade } from 'svelte/transition'
  import Art from './Art.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Share from './Share.svelte'
  import Slot from './Slot.svelte'
  import { attempt, game, isHost, me, nameOf, once, refreshCounts, refreshSoon, type Track } from './lib/game.svelte'
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
  const steps = $derived([
    { text: `ADD YOUR SONGS · ${mine.length} / ${room.songs_per_player}`, done: left === 0 },
    { text: `INVITE THE CREW · ${game.players.length - 1} JOINED`, done: !alone },
    { text: `WAIT FOR EVERYONE'S SONGS · ${locked} / ${game.players.length}`, done: everyoneIn },
    { text: 'BEGIN THE EXPERIMENT', done: false },
  ])

  // everyone's progress, a few seconds behind at most (not while the tab is hidden)
  $effect(() => {
    const timer = setInterval(() => document.hidden || refreshCounts().catch(() => {}), 5000)
    return () => clearInterval(timer)
  })

  const taken = (t: Track) => mine.some((s) => s.spotify_id === t.id)

  const add = once(async (t: Track, scope: string) => {
    if (!taken(t)) await attempt(scope, async () => (await call('add-song', { room_id: room.id, spotify_id: t.id }), refreshSoon()))
  })

  const remove = (id: string) => attempt('songs', async () => (await rpc('remove_song', { p_song: id }), refreshSoon()))
  const startGuessing = once(() => attempt('start', () => call('start-guess', { room_id: room.id })))
</script>

<Head step={`SONGS ADDED ${mine.length} / ${room.songs_per_player}`} title="Add your songs" />

{#if isHost()}
  <div class="panel stack">
    <div class="label">HOST CHECKLIST</div>
    {#each steps as step}
      <div class="line"><b class:good={step.done}>{step.done ? '✓' : '○'}</b><span class:muted={step.done}>{step.text}</span></div>
    {/each}
  </div>
{/if}

<div class="panel"><div class="label">THE PLAYLIST VIBE</div><div class="good big">{room.theme}</div></div>

{#if alone}<p class="muted center">/// SEND THE INVITE LINK TO YOUR CREW</p>{/if}
<Share />
{#if left > 0}
  <p class="muted center">/// ADD {left} MORE SONG{left > 1 ? 'S' : ''} THAT FIT THE VIBE · NOBODY SEES WHO ADDED WHAT UNTIL THE RESULTS</p>
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
  <p class="center good">{everyoneIn ? (isHost() ? "EVERYONE'S IN · PRESS BEGIN THE EXPERIMENT BELOW" : "EVERYONE'S IN") : waiting > 0 ? `SONGS ADDED · WAITING ON ${waiting} MORE CREW MEMBER${waiting > 1 ? 'S' : ''}` : 'SONGS ADDED'}</p>
  {#if !isHost()}
    <p class="muted center">/// {everyoneIn ? `WAITING ON ${hostName} TO BEGIN THE EXPERIMENT` : `WHEN EVERYONE'S DONE, ${hostName} BEGINS THE EXPERIMENT`} · THE ROUND WHERE YOU GUESS WHO ADDED WHAT</p>
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

<div class="grow"></div>

{#if isHost()}
  <Notice scope="start" />
  {#if everyoneIn}
    <p class="muted center">/// {total} TRACKS · EVERYONE'S WAITING ON YOU</p>
    <button class="btn" onclick={startGuessing}>BEGIN THE EXPERIMENT</button>
  {:else}
    <button class="btn" disabled>{alone ? 'WAITING FOR THE CREW TO JOIN' : `WAITING ON ${waiting} TO ADD SONGS`}</button>
  {/if}
{/if}
