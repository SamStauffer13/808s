<script lang="ts">
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'
  import Art from './Art.svelte'
  import Eq from './Eq.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Share from './Share.svelte'
  import Slot from './Slot.svelte'
  import { aboutMinutes, etaMs, host, iVoted, keepFed, line, LOCK_MS, locked, myWaiting, positionOf, suggest, taken, threshold, upNext, vote, votesOn } from './lib/hijack.svelte'
  import { attempt, game, isHost, me, nameOf, notify, type HijackRecent, type HijackTrack, type Item } from './lib/game.svelte'
  import { reduced } from './lib/motion'
  import { practice } from './lib/practice.svelte'
  import * as account from './lib/spotify-account'

  const room = $derived(game.room!)
  const needed = $derived(threshold())
  // a guest lands with the search already open: one tap into the box and they are picking a song
  let adding = $state(!isHost())

  // a clock for the countdowns and the progress bar
  let now = $state(Date.now())
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 1000)
    return () => clearInterval(timer)
  })

  const remaining = $derived(room.now_ends_at ? Math.max(0, new Date(room.now_ends_at).getTime() - now) : null)
  const progress = $derived(room.now_duration_ms && remaining !== null ? Math.min(1, Math.max(0, 1 - remaining / room.now_duration_ms)) : 0)
  const ending = $derived(remaining !== null && remaining < LOCK_MS)
  const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

  const waiting = $derived(line())
  const front = $derived(upNext())
  const mine = $derived(myWaiting())
  const mineEta = $derived(mine ? etaMs(mine.id, now) : null)
  const when = (t: HijackTrack) => (t.id === mine?.id && mineEta !== null ? aboutMinutes(mineEta) : '')
  const lockedIn = $derived(locked())

  // one plain sentence that always says what is going on
  const status = $derived.by(() => {
    if (room.host_offline) return isHost() ? 'NOTHING LIVE · START A SONG IN SPOTIFY ON YOUR SPEAKER' : 'NOTHING PLAYING RIGHT NOW · ASK THE HOST TO PRESS PLAY'
    if (lockedIn) return `LOCKED IN: ${lockedIn.title.toUpperCase()}`
    if (!front) return waiting.length ? '' : "STAGING EMPTY · THE HOST'S PLAYLIST KEEPS PROD ALIVE"
    if (remaining === null) return `${front.title.toUpperCase()} IS FIRST IN STAGING`
    const until = remaining - LOCK_MS
    return until > 0 ? `${front.title.toUpperCase()} LOCKS IN ${clock(until)} · ROLL IT BACK BEFORE THEN` : 'LOCKING IN THE NEXT TRACK…'
  })

  const by = (t: HijackTrack) => (t.suggested_by ? nameOf(t.suggested_by).toUpperCase() : 'A GUEST')

  // enter: a terminal wipe. leave: the row shakes, flashes red and fades. Both stay off for people who ask for less motion.
  const enter = (_node: Element) => ({
    duration: reduced() ? 0 : 450,
    easing: cubicOut,
    css: (t: number) => `clip-path: inset(0 ${(1 - t) * 100}% 0 0); opacity: ${Math.min(1, t * 3)}`,
  })
  // The leaving row is lifted out of the flow so the rows below glide up at once (animate:flip) instead of waiting for it.
  const leave = (node: Element) => {
    const { offsetTop, offsetLeft, offsetWidth, style, classList } = node as HTMLElement
    Object.assign(style, { position: 'absolute', top: `${offsetTop}px`, left: `${offsetLeft}px`, width: `${offsetWidth}px` })
    classList.add('rolled-back')
    return {
      duration: reduced() ? 0 : 480,
      css: (t: number) => `opacity: ${t}; transform: translateX(${Math.sin((1 - t) * Math.PI * 6) * 8 * t}px)`,
    }
  }

  const add = async (t: Item, scope: string) => {
    if (await suggest(t, scope)) adding = false
  }
  const cast = (t: HijackTrack) => {
    navigator.vibrate?.(15)
    vote(t, iVoted(t.id))
  }

  // the host's view of whether the music will keep flowing: Spotify login, anything Spotify refused, and the server timer
  let health = $state<{ reconnect: boolean; timerAgoMs: number | null; problem?: string }>({ reconnect: false, timerAgoMs: practice.on ? 8000 : null })
  const timerOn = $derived(health.timerAgoMs !== null && health.timerAgoMs < 150_000)
  $effect(() => (isHost() && !practice.on ? keepFed(room.code, (status) => (health = status)) : undefined))

  // cutting the music is a tap twice, so a stray touch cannot do it
  let armed = $state<string>()
  const twice = (what: string, go: () => void) => () => {
    if (armed === what) return void ((armed = undefined), go())
    armed = what
    setTimeout(() => armed === what && (armed = undefined), 3000)
  }

  // the moments that are yours: your track locks in (it is next), and your track starts playing
  let lastMoment: string | undefined
  $effect(() => {
    const live = game.hijack.tracks.find((t) => t.suggested_by === me()?.id && (t.status === 'queued' || t.status === 'playing'))
    const key = live ? `${live.id}:${live.status}` : ''
    if (lastMoment !== undefined && key && key !== lastMoment) {
      notify('hijack', live!.status === 'queued' ? 'YOUR TRACK IS NEXT' : 'YOUR TRACK IS LIVE')
      navigator.vibrate?.(live!.status === 'queued' ? 30 : [30, 60, 30])
    }
    lastMoment = key
  })
  const nowMine = $derived(game.hijack.tracks.some((t) => t.status === 'playing' && t.suggested_by === me()?.id))

  // play an earlier track again
  const again = (r: HijackRecent) => add({ id: r.item_id, title: r.title, artist: r.artist, art: r.art, blocked: false }, 'hijack')

  const login = () =>
    attempt('hijack-host', async () => {
      location.href = await account.loginUrl(`${location.origin}${import.meta.env.BASE_URL}#/${room.code}`)
    })
</script>

<Head step={`${game.players.length} ATTACHED`} title={room.theme} />

<!-- what the speaker is playing right now -->
<div class="panel hijack-now" class:idle={!room.now_title} class:mine={nowMine}>
  <Art src={room.now_art ?? null} big />
  <div class="grow-text">
    <div class="label">{room.now_title ? 'NOW LIVE' : 'NOTHING LIVE YET'} {#if room.now_title}<Eq />{/if}</div>
    {#key room.now_item_id}
      <div class="big hijack-title">{room.now_title ?? '···'}</div>
    {/key}
    <div class="dim">{room.now_artist ?? ''}</div>
  </div>
  <div class="hijack-bar" class:hot={ending}><i style:transform={`scaleX(${progress})`}></i></div>
  {#if remaining !== null}<div class="hijack-time muted">{clock(remaining)} LEFT</div>{/if}
  {#if isHost() && room.now_title}<button class="pill hijack-skip" onclick={twice('skip', () => host('skip'))}>{armed === 'skip' ? 'TAP AGAIN TO SKIP' : 'SKIP SONG'}</button>{/if}
</div>

{#if status}<p class="center good hijack-status">{status}</p>{/if}
<Notice scope="hijack" />

{#if isHost()}
  <div class="row hijack-health" class:on={timerOn}>
    <span class="grow">{timerOn ? 'RUNS WITHOUT THIS SCREEN · YOU CAN LOCK YOUR PHONE' : 'STOPS WHEN THIS SCREEN CLOSES · KEEP IT OPEN'}</span>
  </div>
  {#if health.problem}<p class="notice">{health.problem}</p>{/if}
  {#if health.reconnect}
    <div class="panel stack">
      <div class="label">ONE QUICK THING</div>
      <p class="prose">Spotify needs your OK once more so the hijack can feed tracks to your speaker.</p>
      <button class="btn" onclick={login}>RECONNECT SPOTIFY</button>
    </div>
  {:else if room.host_offline}
    <div class="panel stack">
      <div class="label">HOST CHECKLIST</div>
      <div class="line"><b>1</b><span>OPEN SPOTIFY (PREMIUM) ON YOUR PHONE OR COMPUTER</span></div>
      <div class="line"><b>2</b><span>PICK THE SPEAKER AND PLAY ANY SONG</span></div>
      <div class="line"><b>3</b><span>COME BACK HERE. THE HIJACK TAKES OVER</span></div>
    </div>
  {/if}
  <Notice scope="hijack-host" />
{/if}

{#if adding}
  <div class="panel stack hijack-add">
    <Slot n={1} label="PUSH A TRACK" {taken} onpick={add} />
    {#if game.hijack.recent.length}
      <div class="stack hijack-recent">
        <span class="label">PLAYED EARLIER · TAP TO REPLAY</span>
        {#each game.hijack.recent as r (r.item_id)}
          <button class="row recent" disabled={taken({ id: r.item_id, title: r.title, artist: r.artist, art: r.art, blocked: false })} onclick={() => again(r)}>
            <Art src={r.art} />
            <div class="grow-text"><div>{r.title}</div><div class="dim">{r.artist}</div></div>
            <span class="round">+</span>
          </button>
        {/each}
      </div>
    {/if}
    {#if isHost()}<button class="link center" onclick={() => (adding = false)}>CANCEL</button>{/if}
  </div>
{/if}

<!-- the line -->
<div class="split"><span>STAGING</span><span class="muted">{waiting.length + (lockedIn ? 1 : 0)} QUEUED</span></div>
<div class="stack hijack-list">
  {#if lockedIn}
    {@render entry(lockedIn, true)}
  {/if}
  {#each waiting as t, i (t.item_id)}
    <div animate:flip={{ delay: reduced() ? 0 : 120, duration: reduced() ? 0 : 280 }} in:enter out:leave>
      {@render entry(t, false, i === 0 && !lockedIn)}
    </div>
  {:else}
    {#if !lockedIn}<p class="muted center prose">/// Staging is empty. Push the first track.</p>{/if}
  {/each}
</div>

{#snippet entry(t: HijackTrack, isLocked: boolean, isNext = false)}
  <div class="row hijack-row" class:next={isNext} class:lock={isLocked}>
    <Art src={t.art} />
    <div class="grow-text">
      <div>{t.title}</div>
      <div class="dim">{when(t) ? `PLAYS IN ${when(t)}` : `${t.artist} · ${by(t)}`}</div>
    </div>
    {#if isLocked}
      <span class="tag">LOCKED IN</span>
    {:else if t.suggested_by === me()?.id}
      <span class="tag">{isNext ? 'YOURS · NEXT' : `YOURS · #${positionOf(t.id)}`}</span>
    {:else}
      <button class="hijack-vote" class:on={iVoted(t.id)} onclick={() => cast(t)} aria-label={iVoted(t.id) ? 'Take back your vote' : 'Roll back this track: vote it off'}>
        <span class="hijack-dots" aria-hidden="true">
          {#each Array(needed) as _, k}<i class:lit={k < votesOn(t.id)}></i>{/each}
        </span>
        <span>{iVoted(t.id) ? 'UNDO' : 'ROLLBACK'}</span>
      </button>
    {/if}
    {#if isHost() && !isLocked}
      <div class="hijack-host">
        <button class="pill" onclick={() => host('top', t)} disabled={isNext}>MOVE UP</button>
        <button class="pill" onclick={twice(`now-${t.id}`, () => host('play_now', t))} disabled={!!lockedIn} title={lockedIn ? 'A track is locked in, so it plays first' : ''}>{armed === `now-${t.id}` ? 'TAP AGAIN' : 'PLAY NOW'}</button>
        <button class="pill" onclick={() => host('remove', t)}>REMOVE</button>
      </div>
    {/if}
  </div>
{/snippet}

<div class="grow"></div>

{#if isHost()}
  <button class="btn ghost plain hijack-pause" onclick={() => host(room.suggestions_paused ? 'resume' : 'pause')}>
    {room.suggestions_paused ? 'CODE FREEZE ON · TAP TO LIFT IT' : 'CALL A CODE FREEZE'}
  </button>
{/if}
<Share />
{#if isHost() && !practice.on}<a class="btn ghost plain" href="#/setup">QR CODE, NFC TAG &amp; POSTER</a>{/if}

<div class="dock">
  {#if room.suggestions_paused}
    <button class="btn" disabled>CODE FREEZE · NO NEW TRACKS</button>
  {:else if mine}
    <button class="btn" disabled>YOU'RE #{positionOf(mine.id)}{mineEta !== null ? ` · ${aboutMinutes(mineEta)}` : ''}</button>
  {:else if !adding}
    <button class="btn plain" onclick={() => (adding = true)}>+ PUSH A TRACK</button>
  {/if}
</div>
