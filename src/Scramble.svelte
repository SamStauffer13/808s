<script lang="ts">
  import { decrypt } from './lib/decrypt'

  // Text that decrypts into place after a delay, so a list of names resolves one after another.
  let { text, delay = 0 }: { text: string; delay?: number } = $props()
  let shown = $state('')

  $effect(() => {
    let stop: (() => void) | void
    const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => (stop = decrypt(text, (s) => (shown = s))), quiet ? 0 : delay)
    return () => {
      clearTimeout(timer)
      if (stop) stop()
    }
  })
</script>

<span>{shown || '▒'.repeat(text.length)}</span>
