<script lang="ts">
  let { done }: { done: () => void } = $props()

  const lines = ['> CONNECTING TO 808S', '> SIGNAL LOCKED', '> LOADING EXPERIMENT']
  let shown = $state(1)

  $effect(() => {
    let finish: ReturnType<typeof setTimeout>
    const timer = setInterval(() => {
      if (shown < lines.length) return shown++
      clearInterval(timer)
      finish = setTimeout(done, 300)
    }, 350)
    return () => {
      clearInterval(timer)
      clearTimeout(finish)
    }
  })

  // pressing Shift or Ctrl on the way to something else should not skip the intro
  const skip = (e: KeyboardEvent) => !['Shift', 'Control', 'Alt', 'Meta'].includes(e.key) && done()
</script>

<svelte:window onkeydown={skip} />

<button class="boot" onclick={done} aria-label="Skip intro">
  {#each lines.slice(0, shown) as line}<span>{line}</span>{/each}
  <i class="cursor"></i>
</button>
