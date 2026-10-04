<script module lang="ts">
  import type { Track } from './lib/game.svelte'

  const cache = new Map<string, Track[]>()
</script>

<script lang="ts">
  import { fade } from 'svelte/transition'
  import Art from './Art.svelte'
  import { attempt } from './lib/game.svelte'
  import { call } from './lib/supabase'

  let { n, taken, onpick }: { n: number; taken: (t: Track) => boolean; onpick: (t: Track) => void } = $props()

  let q = $state('')
  let results = $state<Track[]>([])

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
      const found = (await attempt(() => call<{ tracks: Track[] }>('spotify-search', { q: text })))?.tracks
      if (!found) return
      cache.set(text, found)
      if (q.trim().toLowerCase() === text) results = found
    }, 350)
    return () => clearTimeout(timer)
  })
</script>

<div class="stack">
  <label class="field"><span class="label">TRACK {n}</span><input bind:value={q} autocomplete="off" placeholder="search tracks or artists" /></label>
  {#each results as t (t.id)}
    <button class="row" disabled={taken(t)} onclick={() => onpick(t)} in:fade={{ duration: 120 }}>
      <Art src={t.art} />
      <div class="grow-text"><div>{t.title}</div><div class="dim">{t.artist}</div></div>
      <span class="round" class:done={taken(t)}>{taken(t) ? '✓' : '+'}</span>
    </button>
  {/each}
</div>
