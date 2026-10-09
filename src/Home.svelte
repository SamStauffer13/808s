<script lang="ts">
  import Notice from './Notice.svelte'
  import { attempt, notify, once, saveName, savedName } from './lib/game.svelte'
  import { call } from './lib/supabase'

  const tagline = ["CAN YOU FEEL PEOPLE'S VIBES?", "LET'S TEST THAT"]

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

  // Owner override: five taps on the logo asks for the admin key, which is kept on this device only. The server
  // checks it every time, so a panel on someone else's screen would do nothing.
  const adminStore = '808s-admin'
  const stored = () => {
    try {
      return localStorage.getItem(adminStore)
    } catch {
      return null
    }
  }
  let adminKey = $state(stored())
  let adminCode = $state('')
  let taps = 0

  const logoTap = () => {
    if (adminKey || ++taps < 5) return
    taps = 0
    const key = prompt('ADMIN KEY')
    if (!key) return
    attempt('admin', async () => {
      await call('admin-advance', { key })
      try {
        localStorage.setItem(adminStore, key)
      } catch {}
      adminKey = key
    })
  }

  const forget = () => {
    try {
      localStorage.removeItem(adminStore)
    } catch {}
    adminKey = null
  }

  const advance = once(() =>
    attempt('admin', async () => {
      const { phase } = await call<{ phase: string }>('admin-advance', { key: adminKey, code: adminCode })
      notify('admin', `${adminCode.trim().toUpperCase()} MOVED TO ${phase.toUpperCase()}`)
    }),
  )

  const disconnect = () => attempt('create', async () => (await spotifyAccount({ action: 'disconnect' }), (spotifyName = null)))

  const create = once(() =>
    attempt('create', async () => {
      const { room } = await call<{ room: { code: string } }>('create-room', { name, theme: vibe, title, songs_per_player: songs })
      saveName(name)
      location.hash = `/${room.code}`
    }),
  )
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="logo big" onclick={logoTap}>808<small>s</small></div>
<p class="tagline">
  <span>{tagline[0]}</span>
  <span class="good">{tagline[1]}<i class="cursor"></i></span>
</p>
<p class="muted center">/// ADD SONGS TO A SHARED PLAYLIST, THEN GUESS WHO ADDED WHAT</p>

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
    <p class="muted">/// SPOTIFY LOGIN BUILDS THE PLAYLIST IN YOUR ACCOUNT · FORM IS SAVED</p>
  {/if}
  <Notice scope="create" />
  <button class="btn">{spotifyName ? 'BUILD THE PLAYLIST' : 'CONNECT SPOTIFY'}</button>
</form>

<Notice scope="admin" />
{#if adminKey}
  <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), advance())}>
    <label class="field"><span class="label">ADMIN · ROOM CODE</span><input bind:value={adminCode} placeholder="e.g. AB-1234" required /></label>
    <button class="btn ghost">FORCE NEXT PHASE</button>
    <button type="button" class="link" onclick={forget}>FORGET ADMIN KEY</button>
  </form>
{/if}
