<script module lang="ts">
  import type { Track } from './lib/game.svelte'

  const cache = new Map<string, Track[]>()
</script>

<script lang="ts">
  import { fade } from 'svelte/transition'
  import Art from './Art.svelte'
  import Notice from './Notice.svelte'
  import Spotify from './Spotify.svelte'
  import { attempt, clearNotice, notify } from './lib/game.svelte'
  import { call } from './lib/supabase'

  let { n, taken, onpick }: { n: number; taken: (t: Track) => boolean; onpick: (t: Track, scope: string) => void } = $props()

  const scope = $derived(`slot-${n}`)
  let q = $state('')
  let results = $state<Track[]>([])
  let shaking = $state<string>()

  // a blocked track shakes and gets a comment instead of being added
  const pick = (t: Track) => {
    if (!t.blocked) return onpick(t, scope)
    notify(scope, "DON'T BE BORING/BASIC")
    shaking = t.id
  }

  $effect(() => {
    const text = q.trim().toLowerCase()
    if (text.length < 2) {
      results = []
      return
    }
    const hit = cache.get(text)
    if (hit) {
      results = hit
      return
    }
    const timer = setTimeout(async () => {
      const found = (await attempt(scope, () => call<{ tracks: Track[] }>('spotify-search', { q: text })))?.tracks
      if (!found) return
      cache.set(text, found)
      if (q.trim().toLowerCase() === text) results = found
    }, 350)
    return () => clearTimeout(timer)
  })
</script>

<div class="stack">
  <label class="field">
    <span class="label">TRACK {n}</span>
    <input bind:value={q} oninput={() => clearNotice(scope)} autocomplete="off" placeholder="search tracks or artists" />
  </label>
  <Notice {scope} />
  {#each results as t (t.id)}
    <button class="row" class:blocked={t.blocked} class:shake={shaking === t.id} disabled={taken(t)} onclick={() => pick(t)} onanimationend={() => (shaking = undefined)} in:fade={{ duration: 120 }}>
      <Art src={t.art} />
      <div class="grow-text"><div>{t.title}</div><div class="dim">{t.artist}</div></div>
      <span class="round" class:done={taken(t)}>{t.blocked ? '✗' : taken(t) ? '✓' : '+'}</span>
    </button>
  {/each}
  {#if results.length}<p class="muted center">RESULTS FROM <Spotify /></p>{/if}
</div>
