<script lang="ts">
  // poster: a tall movie poster instead of square cover art. With no image it is drawn from the title.
  let { src = null, big = false, poster = false, title = '' }: { src?: string | null; big?: boolean; poster?: boolean; title?: string } = $props()

  const hue = $derived([...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7))
</script>

{#if src}
  <img class="art" class:big class:poster {src} alt="" loading="lazy" decoding="async" />
{:else if poster}
  <div class="art poster typo" class:big style:--hue={hue}><span>{title}</span></div>
{:else}
  <div class="art" class:big></div>
{/if}
