<script lang="ts">
  import { game } from './lib/game.svelte'

  let copied = $state(false)

  async function copy() {
    await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/${game.room!.code}`)
    copied = true
    setTimeout(() => (copied = false), 1500)
  }
</script>

<button class="btn ghost plain" onclick={copy}>{copied ? 'COPIED' : 'COPY INVITE LINK'}</button>
