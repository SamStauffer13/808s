<script lang="ts">
  import Notice from './Notice.svelte'
  import { attempt, notify, once } from './lib/game.svelte'
  import { call } from './lib/supabase'

  // The owner's override: five taps on the logo unlock it with the admin key, which stays on this device.
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
  let taps = 0
  let idle: ReturnType<typeof setTimeout>

  const room = $derived((code || typed).trim().toUpperCase())
  const shown = $derived(!!key && (big || open))

  const tap = () => {
    clearTimeout(idle)
    idle = setTimeout(() => (taps = 0), 2000)
    if (++taps < 5) return
    taps = 0
    if (key) return void (open = !open)
    const entered = prompt('ADMIN KEY')
    if (entered) attempt('admin', async () => (await call('admin-advance', { key: entered }), keep(entered), (key = entered), (open = true)))
  }

  const forget = () => (keep(null), (key = null))

  const advance = once(() =>
    attempt('admin', async () => {
      const { phase } = await call<{ phase: string }>('admin-advance', { key, code: room })
      notify('admin', `${room} MOVED TO ${phase.toUpperCase()}`)
    }),
  )
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="logo" class:big class:mark={!big} onclick={tap}>808<small>s</small></div>
<Notice scope="admin" />

{#if shown}
  <form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), advance())}>
    {#if code}
      <p class="muted center">/// ADMIN · ROOM {room}</p>
    {:else}
      <label class="field"><span class="label">ADMIN · ROOM CODE</span><input bind:value={typed} placeholder="e.g. AB-1234" required /></label>
    {/if}
    <button class="btn ghost">FORCE NEXT PHASE</button>
    <button type="button" class="link" onclick={forget}>FORGET ADMIN KEY</button>
  </form>
{/if}
