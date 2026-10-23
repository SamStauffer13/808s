<script lang="ts">
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, notify, once, saveName, savedName } from './lib/game.svelte'
  import { practice, startPractice } from './lib/practice.svelte'
  import { sourceOf, sources, wordsOf, type Source } from './lib/sources'
  import * as account from './lib/spotify-account'
  import { call } from './lib/supabase'

  const tagline = ["EVERYONE ADDS AUDIO OR VIDEO.", "GUESS WHO ADDED WHAT.", "WINNERS GET CREDS."]

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
  let source = $state<Source>(draft?.source ?? 'spotify')
  const info = $derived(sourceOf(source))
  const w = $derived(wordsOf(source))
  let wanted = $state<number>(draft?.songs ?? 0) // how many each, as chosen (0: not chosen yet)
  const songs = $derived(info.picks.includes(wanted) ? wanted : info.defaultPicks) // what the source allows
  let editingSongs = $state(false)
  let spotifyName = $state<string | null>(null)

  const result = new URLSearchParams(location.search).get('spotify')
  if (result) {
    history.replaceState(null, '', location.pathname + location.hash)
    if (result !== 'connected') notify('create', result === 'denied' ? 'Spotify login was cancelled' : 'Spotify login failed, try again')
  }
  attempt('create', async () => (spotifyName = await account.name()))

  const connect = () =>
    attempt('create', async () => {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, vibe, title, songs, source }))
      location.href = await account.loginUrl(location.origin + import.meta.env.BASE_URL)
    })

  const disconnect = () => attempt('create', async () => (await account.disconnect(), (spotifyName = null)))

  const create = once(() =>
    attempt('create', async () => {
      const { room } = await call<{ room: { code: string } }>('create-room', { name, theme: vibe, title: info.playlist ? title : '', songs_per_player: songs, source })
      saveName(name)
      location.hash = `/${room.code}`
    }),
  )
</script>

<Admin big />
<p class="tagline">
  <span>{tagline[0]}</span>
  <span>{tagline[1]}</span>
  <span class="good">{tagline[2]}<i class="cursor"></i></span>
</p>
{#if !practice.on}<button type="button" class="link center" onclick={() => startPractice()}>NEW HERE? TRY THE TUTORIAL →</button>{/if}

<form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), spotifyName || !info.playlist ? create() : connect())}>
  <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
  <div class="field">
    <span class="label">WHAT ARE YOU ADDING</span>
    <div class="pads" role="radiogroup" aria-label="What are you adding">
      {#each Object.entries(sources) as [key, s]}
        <button type="button" role="radio" aria-checked={source === key} class="pad" class:on={source === key} onclick={() => (source = key as Source)}>{s.label}</button>
      {/each}
    </div>
  </div>
  <label class="field">
    <span class="label">THE {info.vibe} VIBE</span>
    <input bind:value={vibe} maxlength="140" placeholder={info.vibePlaceholder} required />
  </label>
  {#if info.playlist}
    <label class="field">
      <span class="label">PLAYLIST NAME · OPTIONAL</span>
      <input bind:value={title} maxlength="100" placeholder="e.g. makeup is war paint" />
    </label>
  {/if}
  {#if editingSongs}
    <div class="field">
      <span class="label">{w.NOUNS} EACH</span>
      <div class="pads" role="radiogroup" aria-label={`${w.nouns} each`}>
        {#each info.picks as n}
          <button type="button" role="radio" aria-checked={songs === n} class="pad" class:on={songs === n} onclick={() => ((wanted = n), (editingSongs = false))}>{n}</button>
        {/each}
      </div>
    </div>
  {:else if info.picks.length > 1}
    <button type="button" class="link" onclick={() => (editingSongs = true)}>{songs} {songs > 1 ? w.NOUNS : w.NOUN} EACH · CHANGE</button>
  {:else}
    <p class="muted">/// {songs} {w.NOUN} EACH</p>
  {/if}
  {#if !info.playlist}
    <p class="muted prose">/// {info.blurb}</p>
  {:else if spotifyName}
    <p class="muted">/// PLAYLIST GOES TO {spotifyName.toUpperCase()}'S SPOTIFY</p>
    <button type="button" class="link" onclick={disconnect}>NOT YOU? DISCONNECT</button>
  {:else}
    <p class="muted prose">/// Connect Spotify so the experiment can make your playlist. The login happens on Spotify's own secure page, so your password never touches this app.</p>
  {/if}
  <Notice scope="create" />
  <button class="btn">{spotifyName || !info.playlist ? 'INITIALIZE THE EXPERIMENT' : 'CONNECT SPOTIFY'}</button>
</form>
