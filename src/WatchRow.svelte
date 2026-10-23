<script lang="ts">
  import type { Provider, Song } from './lib/game.svelte'

  // Where to watch a movie. The whole row is one link: the data gives one page per movie that lists every service,
  // not a link per service, so the names inform and the row is the thing to tap.
  let { song }: { song: Song } = $props()

  const groups: [string, keyof NonNullable<Song['watch']>][] = [
    ['STREAM', 'stream'],
    ['FREE', 'free'],
    ['RENT', 'rent'],
    ['BUY', 'buy'],
  ]
  const shown = 3
  const names = (list: Provider[]) => {
    const all = list.map((p) => p.name.toUpperCase())
    return all.length > shown ? `${all.slice(0, shown).join(' · ')} · +${all.length - shown}` : all.join(' · ')
  }
  const rows = $derived(groups.map(([label, key]) => [label, (song.watch?.[key] as Provider[] | undefined) ?? []] as const).filter(([, list]) => list.length))
  const link = $derived(song.watch?.link ?? `https://www.themoviedb.org/movie/${song.spotify_id}/watch`)
</script>

<a class="watch" href={link} target="_blank" rel="noopener">
  <span class="good">{rows.length ? 'WHERE TO WATCH ↗' : 'NO STREAMING INFO · CHECK THE LINK ↗'}</span>
  {#each rows as [label, list]}
    <span class="dim"><b>{label}</b> {names(list)}</span>
  {/each}
</a>
