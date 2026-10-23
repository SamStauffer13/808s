<script lang="ts">
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, notify, once, saveName, savedName } from './lib/game.svelte'
  import { kinds, type Kind } from './lib/kinds'
  import { practice, setKind, startPractice } from './lib/practice.svelte'
  import { call } from './lib/supabase'

  // What the crew will add. Movies are only a guided preview for now: they run the practice round, never a real room.
  const asked = new URLSearchParams(location.search).get('kind')
  let kind = $state<Kind>(practice.on ? practice.kind : asked === 'movies' ? 'movies' : 'music')
  const w = $derived(kinds[kind])
  const pickKind = (next: Kind) => ((kind = next), practice.on && setKind(next))

  // The playlist is made in the host's own Spotify account. Logging in leaves this page, so the form is kept
  // for the trip and comes back filled in.
  const draftKey = '808s-draft'
  const draft = (() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
      sessionStorage.removeItem(draftKey)
      return saved
    } catch {
      return null
    }
  })()

  let name = $state(draft?.name ?? savedName())
  let vibe = $state(draft?.vibe ?? '')
  let title = $state(draft?.title ?? '')
  let songs = $state(draft?.songs ?? 2)
  let editingSongs = $state(false)
  let spotifyName = $state<string | null>(null)

  const spotifyAccount = (body: object) => call<{ connected?: boolean; name?: string; url?: string }>('spotify-account', body)

  const result = new URLSearchParams(location.search).get('spotify')
  if (result) {
    history.replaceState(null, '', location.pathname + location.hash)
    if (result !== 'connected') notify('create', result === 'denied' ? 'Spotify login was cancelled' : 'Spotify login failed, try again')
  } else if (asked !== null) history.replaceState(null, '', location.pathname + location.hash)
  // only songs need the host's Spotify, so a movie screen never asks (it asks the first time songs are showing)
  let asking = false
  $effect(() => {
    if (kind !== 'music' || asking) return
    asking = true
    attempt('create', async () => (spotifyName = (await spotifyAccount({ action: 'status' })).name ?? null))
  })

  const connect = () =>
    attempt('create', async () => {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, vibe, title, songs }))
      const { url } = await spotifyAccount({ action: 'login', return_to: location.origin + import.meta.env.BASE_URL })
      location.href = url!
    })

  const disconnect = () => attempt('create', async () => (await spotifyAccount({ action: 'disconnect' }), (spotifyName = null)))

  const create = once(() =>
    attempt('create', async () => {
      const { room } = await call<{ room: { code: string } }>('create-room', { name, theme: vibe, title, songs_per_player: songs })
      saveName(name)
      location.hash = `/${room.code}`
    }),
  )

  // Songs make a real room. Movies run the practice round from the top, which is the only place they exist yet.
  const go = () => {
    if (kind === 'music') return spotifyName ? create() : connect()
    return practice.on ? create() : startPractice('host', 'home', location.href, 'movies')
  }
</script>

<Admin big {kind} />
<p class="tagline">
  <span>{w.tagline[0]}</span>
  <span>{w.tagline[1]}</span>
  <span class="good">{w.tagline[2]}<i class="cursor"></i></span>
</p>
<div class="pads kind-toggle" role="radiogroup" aria-label="What the crew adds">
  {#each Object.entries(kinds) as [k, words]}
    <button type="button" role="radio" aria-checked={kind === k} class="pad" class:on={kind === k} onclick={() => pickKind(k as Kind)}>{words.toggle}</button>
  {/each}
</div>
{#if !practice.on}<button type="button" class="link center" onclick={() => startPractice('host', 'home', location.href, kind)}>NEW HERE? TRY THE TUTORIAL →</button>{/if}

<!-- the movie preview needs nothing typed in: its button only opens the practice round -->
<form class="form" autocomplete="off" novalidate={kind === 'movies' && !practice.on} onsubmit={(e) => (e.preventDefault(), go())}>
  <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
  <label class="field">
    <span class="label">{w.vibeLabel}</span>
    <input bind:value={vibe} maxlength="140" placeholder={w.vibeExample} required />
  </label>
  {#if kind === 'music'}
    <label class="field">
      <span class="label">PLAYLIST NAME · OPTIONAL</span>
      <input bind:value={title} maxlength="100" placeholder="e.g. makeup is war paint" />
    </label>
  {/if}
  {#if editingSongs}
    <div class="field">
      <span class="label">{w.nouns.toUpperCase()} EACH</span>
      <div class="pads" role="radiogroup" aria-label={`${w.nouns} each`}>
        {#each [1, 2, 3, 4, 5] as n}
          <button type="button" role="radio" aria-checked={songs === n} class="pad" class:on={songs === n} onclick={() => ((songs = n), (editingSongs = false))}>{n}</button>
        {/each}
      </div>
    </div>
  {:else}
    <button type="button" class="link" onclick={() => (editingSongs = true)}>{songs} {w.nouns.toUpperCase()} EACH · CHANGE</button>
  {/if}
  {#if kind === 'music'}
    {#if spotifyName}
      <p class="muted">/// PLAYLIST GOES TO {spotifyName.toUpperCase()}'S SPOTIFY</p>
      <button type="button" class="link" onclick={disconnect}>NOT YOU? DISCONNECT</button>
    {:else}
      <p class="muted prose">/// Connect Spotify so the experiment can make your playlist. The login happens on Spotify's own secure page, so your password never touches this app.</p>
    {/if}
  {:else if !practice.on}
    <p class="muted prose">/// PREVIEW · A GUIDED TOUR OF THE MOVIE VERSION ON PRACTICE DATA. NO ROOM IS CREATED AND NO ONE IS CONTACTED.</p>
  {/if}
  <Notice scope="create" />
  <button class="btn">{kind === 'music' ? (spotifyName ? 'INITIALIZE THE EXPERIMENT' : 'CONNECT SPOTIFY') : practice.on ? 'INITIALIZE THE EXPERIMENT' : 'PLAY THE 35MM PREVIEW'}</button>
</form>
