<script lang="ts">
  import { game } from './lib/game.svelte'

  let copied = $state(false)

  // on a phone the invite goes straight to the share sheet (messages, group chat); elsewhere it is copied
  const sheet = matchMedia('(pointer: coarse)').matches && !!navigator.share

  async function share() {
    const url = `${location.origin}${location.pathname}#/${game.room!.code}`
    if (sheet) {
      await navigator.share({ title: '808s', text: `Join my 808s experiment: ${game.room!.theme}`, url }).catch(() => {})
      return
    }
    await navigator.clipboard.writeText(url)
    copied = true
    setTimeout(() => (copied = false), 1500)
  }
</script>

<button class="btn ghost plain" onclick={share}>{copied ? 'COPIED' : sheet ? 'SHARE INVITE LINK' : 'COPY INVITE LINK'}</button>
