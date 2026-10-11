<script lang="ts">
  import { badges } from './lib/stamps'
  import type { Analysis } from './lib/results'

  let { worst, blamed }: { worst: Analysis['worst']; blamed: Analysis['blamed'] } = $props()
  const upper = (names: string[]) => names.join(' + ').toUpperCase()
</script>

{#if worst.length || blamed.length}
  <div class="stack awards">
    {#if worst.length}
      <div class="award"><span class="stamp">[ {badges.worst} ]</span><span class="text">{upper(worst.map((w) => w.name))}</span><span class="dim">ONLY {worst[0].correct} OF {worst[0].total} RIGHT</span></div>
    {/if}
    {#if blamed.length}
      <div class="award"><span class="stamp">[ {badges.blamed} ]</span><span class="text">{upper(blamed.map((b) => b.name))}</span><span class="dim">WRONGLY BLAMED {blamed[0].count} TIMES</span></div>
    {/if}
  </div>
{/if}
