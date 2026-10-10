<script lang="ts">
  import { onMount } from 'svelte'
  import Notice from './Notice.svelte'
  import { attempt, notify, once } from './lib/game.svelte'
  import { practice } from './lib/practice.svelte'
  import { call } from './lib/supabase'

  // The owner's override: five taps on the logo open it, and the admin key, entered once, stays on this device.
  // The server checks the key on every use. With a room code it moves that room, otherwise it asks for one.
  let { code = '', big = false } = $props()

  const read = () => {
    try {
      return localStorage.getItem('808s-admin')
    } catch {
      return null
    }
  }
  const keep = (value: string | null) => {
    try {
      value ? localStorage.setItem('808s-admin', value) : localStorage.removeItem('808s-admin')
    } catch {}
  }
  let key = $state(read())
  let open = $state(false)
  let typed = $state('')
  let entry = $state('')
  let connect = $state(false) // the playlist needs a Spotify account and none is connected
  let taps = 0
  let idle: ReturnType<typeof setTimeout>

  const room = $derived((code || typed).trim().toUpperCase())

  const tap = () => {
    if (practice.on) return // practice has no admin
    clearTimeout(idle)
    idle = setTimeout(() => (taps = 0), 2000)
    if (++taps < 5) return
    taps = 0
    open = !open
  }

  const unlock = once(() =>
    attempt('admin', async () => {
      await call('admin-advance', { key: entry })
      keep(entry)
      key = entry
      entry = ''
    }),
  )

  const forget = () => (keep(null), (key = null))

  const advance = once(async () => {
    try {
      const { phase } = await call<{ phase: string }>('admin-advance', { key, code: room })
      connect = false
      notify('admin', `${room} MOVED TO ${phase === 'guess' ? 'THE EXPERIMENT' : 'THE REVEAL'}`)
    } catch (e) {
      const message = (e as Error).message
      if (/connect/i.test(message)) connect = true
      else notify('admin', message)
    }
  })

  // Spotify's login leaves the page. The room comes back with ?spotify=..., and the move carries on by itself.
  const resume = '808s-admin-resume'
  const login = once(() =>
    attempt('admin', async () => {
      sessionStorage.setItem(resume, room)
      const { url } = await call<{ url: string }>('spotify-account', { action: 'login', return_to: location.href })
      location.href = url
    }),
  )

  onMount(() => {
    const back = new URLSearchParams(location.search).get('spotify')
    if (!back || !code || sessionStorage.getItem(resume) !== code) return
    sessionStorage.removeItem(resume)
    history.replaceState(null, '', location.pathname + location.hash)
    open = true
    if (back === 'connected' && key) advance()
    else notify('admin', back === 'denied' ? 'Spotify login was cancelled' : 'Spotify login failed, try again')
  })
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="logo" class:big class:mark={!big} onclick={tap}>808<small>s</small></div>
<Notice scope="admin" />

{#if !key && open}
  <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), unlock())}>
    <label class="field"><span class="label">ADMIN KEY</span><input class="secret" bind:value={entry} required /></label>
    <button class="btn ghost">UNLOCK</button>
  </form>
{:else if key && (big || open)}
  <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), advance())}>
    {#if code}
      <p class="muted center">/// ADMIN · ROOM {room}</p>
    {:else}
      <label class="field"><span class="label">ADMIN · ROOM CODE</span><input bind:value={typed} placeholder="e.g. AB-1234" required /></label>
    {/if}
    {#if connect}
      <p class="muted center">/// SPOTIFY NEEDS CONNECTING TO BUILD THE PLAYLIST · YOURS WILL BE USED</p>
      <button type="button" class="btn" onclick={login}>CONNECT SPOTIFY</button>
    {:else}
      <button class="btn ghost">FORCE NEXT PHASE</button>
    {/if}
    <button type="button" class="link" onclick={forget}>FORGET ADMIN KEY</button>
  </form>
{/if}
