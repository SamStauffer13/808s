<script lang="ts">
  import { badges } from './lib/stamps'
  import type { Analysis } from './lib/results'

  let { worst, blamed, twins }: { worst: Analysis['worst']; blamed: Analysis['blamed']; twins: Analysis['twins'] } = $props()
  const upper = (names: string[]) => names.join(' + ').toUpperCase()
</script>

{#if worst.length || blamed.length || twins}
  <div class="stack awards">
    {#if worst.length}
      <div class="award"><span class="stamp">[ {badges.worst} ]</span><span class="text">{upper(worst.map((w) => w.name))}</span><span class="dim">ONLY {worst[0].correct} OF {worst[0].total} RIGHT</span></div>
    {/if}
    {#if blamed.length}
      <div class="award"><span class="stamp">[ {badges.blamed} ]</span><span class="text">{upper(blamed.map((b) => b.name))}</span><span class="dim">WRONGLY BLAMED {blamed[0].count} TIMES</span></div>
    {/if}
    {#if twins}
      <div class="award"><span class="stamp">[ {badges.twins} ]</span><span class="text">{upper(twins.names)}</span><span class="dim">BOTH ADDED {twins.shared.slice(0, 3).join(' · ').toUpperCase()}</span></div>
    {/if}
  </div>
{/if}
