<script lang="ts">
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, notify, once, saveName, savedName } from './lib/game.svelte'
  import { practice, startPractice } from './lib/practice.svelte'
  import { call } from './lib/supabase'

  const tagline = ["EVERYONE ADDS SONGS.", "GUESS WHO ADDED WHAT.", "WINNERS GET CREDS."]

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
  }
  attempt('create', async () => (spotifyName = (await spotifyAccount({ action: 'status' })).name ?? null))

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
</script>

<Admin big />
<p class="tagline">
  <span>{tagline[0]}</span>
  <span>{tagline[1]}</span>
  <span class="good">{tagline[2]}<i class="cursor"></i></span>
</p>
{#if !practice.on}
  <button type="button" class="btn ghost" onclick={() => startPractice()}>PRACTICE ROUND</button>
  <p class="muted center">/// NEW HERE? 2 MINUTES · FAKE FRIENDS · NOTHING IS REAL</p>
{/if}

<form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), spotifyName ? create() : connect())}>
  <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
  <label class="field">
    <span class="label">THE PLAYLIST VIBE</span>
    <input bind:value={vibe} maxlength="140" placeholder="e.g. your favorite angsty teenager songs" required />
  </label>
  <label class="field">
    <span class="label">PLAYLIST NAME · OPTIONAL</span>
    <input bind:value={title} maxlength="100" placeholder="e.g. makeup is war paint" />
  </label>
  {#if editingSongs}
    <div class="field">
      <span class="label">SONGS EACH</span>
      <div class="pads" role="radiogroup" aria-label="Songs each">
        {#each [1, 2, 3, 4, 5] as n}
          <button type="button" role="radio" aria-checked={songs === n} class="pad" class:on={songs === n} onclick={() => ((songs = n), (editingSongs = false))}>{n}</button>
        {/each}
      </div>
    </div>
  {:else}
    <button type="button" class="link" onclick={() => (editingSongs = true)}>{songs} SONGS EACH · CHANGE</button>
  {/if}
  {#if spotifyName}
    <p class="muted">/// PLAYLIST GOES TO {spotifyName.toUpperCase()}'S SPOTIFY</p>
    <button type="button" class="link" onclick={disconnect}>NOT YOU? DISCONNECT</button>
  {:else}
    <p class="muted">/// YOU'LL LOG IN TO SPOTIFY SO THE PLAYLIST CAN BE MADE IN YOUR ACCOUNT, THEN COME BACK HERE · YOUR FORM IS SAVED</p>
  {/if}
  <Notice scope="create" />
  <button class="btn">{spotifyName ? 'INITIALIZE THE EXPERIMENT' : 'CONNECT SPOTIFY'}</button>
</form>
