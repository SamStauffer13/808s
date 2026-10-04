<script lang="ts">
  let { src = null, big = false }: { src?: string | null; big?: boolean } = $props()
</script>

{#if src}
  <img class="art" class:big {src} alt="" loading="lazy" decoding="async" />
{:else}
  <div class="art" class:big></div>
{/if}
