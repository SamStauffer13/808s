<script lang="ts">
  import { flip } from 'svelte/animate'
  import { cubicOut } from 'svelte/easing'
  import Art from './Art.svelte'
  import Eq from './Eq.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Share from './Share.svelte'
  import Slot from './Slot.svelte'
  import { host, iVoted, line, LOCK_MS, locked, myWaiting, positionOf, suggest, taken, threshold, upNext, vote, votesOn } from './lib/dj.svelte'
  import { attempt, game, isHost, me, nameOf, once, type DjTrack, type Item } from './lib/game.svelte'
  import { reduced } from './lib/motion'
  import { practice } from './lib/practice.svelte'
  import * as account from './lib/spotify-account'
  import { call } from './lib/supabase'

  const room = $derived(game.room!)
  const needed = $derived(threshold())
  let adding = $state(false)

  // a clock for the countdowns and the progress bar
  let now = $state(Date.now())
  $effect(() => {
    const timer = setInterval(() => (now = Date.now()), 250)
    return () => clearInterval(timer)
  })

  const remaining = $derived(room.now_ends_at ? Math.max(0, new Date(room.now_ends_at).getTime() - now) : null)
  const progress = $derived(room.now_duration_ms && remaining !== null ? Math.min(1, Math.max(0, 1 - remaining / room.now_duration_ms)) : 0)
  const ending = $derived(remaining !== null && remaining < LOCK_MS)
  const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`

  const waiting = $derived(line())
  const front = $derived(upNext())
  const mine = $derived(myWaiting())
  const lockedIn = $derived(locked())

  // one plain sentence that always says what is going on
  const status = $derived.by(() => {
    if (room.host_offline) return isHost() ? 'NOTHING LIVE · START A SONG IN SPOTIFY ON YOUR SPEAKER' : 'NOTHING LIVE · WAITING FOR THE HOST TO START THE SPEAKER'
    if (lockedIn) return `LOCKED IN: ${lockedIn.title.toUpperCase()}`
    if (!front) return waiting.length ? '' : "STAGING EMPTY · THE HOST'S PLAYLIST KEEPS PROD ALIVE"
    if (remaining === null) return `${front.title.toUpperCase()} IS FIRST IN STAGING`
    const until = remaining - LOCK_MS
    return until > 0 ? `${front.title.toUpperCase()} LOCKS IN ${clock(until)} · ROLL IT BACK BEFORE THEN` : 'LOCKING IN THE NEXT TRACK…'
  })

  const by = (t: DjTrack) => (t.suggested_by ? nameOf(t.suggested_by).toUpperCase() : 'HOST')

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
  const cast = (t: DjTrack) => {
    navigator.vibrate?.(15)
    vote(t, iVoted(t.id))
  }

  // the host's open app keeps the music fed, so a sleeping server timer is never the only thing between the room and silence
  let reconnect = $state(false)
  const tick = once(async () => {
    try {
      await call('dj-feeder', { code: room.code })
      reconnect = false
    } catch (e) {
      if (/reconnect/i.test((e as Error).message)) reconnect = true
    }
  })
  $effect(() => {
    if (!isHost() || practice.on) return
    tick()
    const timer = setInterval(() => document.hidden || tick(), 5000)
    return () => clearInterval(timer)
  })

  const login = () =>
    attempt('dj-host', async () => {
      location.href = await account.loginUrl(`${location.origin}${import.meta.env.BASE_URL}#/${room.code}`)
    })
</script>

<Head step={`${game.players.length} ATTACHED`} title={room.theme} />

<!-- what the speaker is playing right now -->
<div class="panel dj-now" class:idle={!room.now_title}>
  <Art src={room.now_art ?? null} big />
  <div class="grow-text">
    <div class="label">{room.now_title ? 'NOW LIVE' : 'NOTHING LIVE YET'} {#if room.now_title}<Eq />{/if}</div>
    {#key room.now_item_id}
      <div class="big dj-title">{room.now_title ?? '···'}</div>
    {/key}
    <div class="dim">{room.now_artist ?? ''}</div>
  </div>
  <div class="dj-bar" class:hot={ending}><i style:transform={`scaleX(${progress})`}></i></div>
  {#if remaining !== null}<div class="dj-time muted">{clock(remaining)} LEFT</div>{/if}
</div>

{#if status}<p class="center good dj-status">{status}</p>{/if}

{#if isHost()}
  {#if reconnect}
    <div class="panel stack">
      <div class="label">ONE QUICK THING</div>
      <p class="prose">Spotify needs your OK once more so the session can feed tracks to your speaker.</p>
      <button class="btn" onclick={login}>RECONNECT SPOTIFY</button>
    </div>
  {:else if room.host_offline}
    <div class="panel stack">
      <div class="label">HOST CHECKLIST</div>
      <div class="line"><b>1</b><span>OPEN SPOTIFY (PREMIUM) ON YOUR PHONE OR COMPUTER</span></div>
      <div class="line"><b>2</b><span>PICK THE SPEAKER AND PLAY ANY SONG</span></div>
      <div class="line"><b>3</b><span>COME BACK HERE. THE SESSION TAKES OVER</span></div>
    </div>
  {/if}
  <Notice scope="dj-host" />
{/if}

<!-- the line -->
<div class="split"><span>STAGING</span><span class="muted">{waiting.length + (lockedIn ? 1 : 0)} QUEUED</span></div>
<div class="stack dj-list">
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

{#snippet entry(t: DjTrack, isLocked: boolean, isNext = false)}
  <div class="row dj-row" class:next={isNext} class:lock={isLocked}>
    <Art src={t.art} />
    <div class="grow-text">
      <div>{t.title}</div>
      <div class="dim">{t.artist} · {by(t)}</div>
    </div>
    {#if isLocked}
      <span class="tag">LOCKED IN</span>
    {:else if t.suggested_by === me()?.id}
      <span class="tag">{isNext ? 'YOURS · NEXT' : `YOURS · #${positionOf(t.id)}`}</span>
    {:else}
      <button class="dj-vote" class:on={iVoted(t.id)} onclick={() => cast(t)} aria-label={iVoted(t.id) ? 'Take back your vote' : 'Roll back this track: vote it off'}>
        <span class="dj-dots" aria-hidden="true">
          {#each Array(needed) as _, k}<i class:lit={k < votesOn(t.id)}></i>{/each}
        </span>
        <span>{iVoted(t.id) ? 'UNDO' : 'ROLLBACK'}</span>
      </button>
    {/if}
    {#if isHost() && !isLocked}
      <div class="dj-host">
        <button class="round" onclick={() => host('top', t)} aria-label="Promote this track to the front" disabled={isNext}>↑</button>
        <button class="round" onclick={() => host('remove', t)} aria-label="Remove this track">×</button>
      </div>
    {/if}
  </div>
{/snippet}

<Notice scope="dj" />

{#if adding}
  <div class="panel stack dj-add">
    <Slot n={1} label="PUSH A TRACK" {taken} onpick={add} />
    <button class="link center" onclick={() => (adding = false)}>CANCEL</button>
  </div>
{/if}

<div class="grow"></div>

{#if isHost()}
  <button class="btn ghost plain dj-pause" onclick={() => host(room.suggestions_paused ? 'resume' : 'pause')}>
    {room.suggestions_paused ? 'CODE FREEZE ON · TAP TO LIFT IT' : 'CALL A CODE FREEZE'}
  </button>
{/if}
<Share />

<div class="dock">
  {#if room.suggestions_paused}
    <button class="btn" disabled>CODE FREEZE · NO NEW TRACKS</button>
  {:else if mine}
    <button class="btn" disabled>YOU'RE #{positionOf(mine.id)} IN STAGING</button>
  {:else if !adding}
    <button class="btn plain" onclick={() => (adding = true)}>+ PUSH A TRACK</button>
  {/if}
</div>
