<script lang="ts">
  import { ui } from './lib/game.svelte'

  let { scope }: { scope: string } = $props()
</script>

{#key ui.notice}
  {#if ui.notice?.scope === scope}<p class="notice" role="alert">{ui.notice.message}</p>{/if}
{/key}
