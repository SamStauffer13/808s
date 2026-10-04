<script lang="ts">
  let { done }: { done: () => void } = $props()

  const lines = ['> CONNECTING TO 808S', '> SIGNAL LOCKED', '> READY']
  let shown = $state(1)

  $effect(() => {
    const timer = setInterval(() => {
      if (shown < lines.length) return shown++
      clearInterval(timer)
      setTimeout(done, 300)
    }, 350)
    return () => clearInterval(timer)
  })
</script>

<svelte:window onkeydown={done} />

<button class="boot" onclick={done} aria-label="Skip intro">
  {#each lines.slice(0, shown) as line}<span>{line}</span>{/each}
  <i class="cursor"></i>
</button>
