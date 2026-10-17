<script lang="ts">
  import { badges } from './lib/stamps'
  import type { Analysis } from './lib/results'

  // The crew grouped by taste: each subnet is a genre, with the people whose songs lean that way.
  let { subnets, airGapped }: { subnets: Analysis['subnets']; airGapped: Analysis['airGapped'] } = $props()
  const upper = (names: string[]) => names.join(' · ').toUpperCase()
</script>

{#if subnets.length}
  <div class="stack subnets">
    <div class="label">THE CREW BY SUBNET</div>
    {#each subnets as s}
      <div class="award"><span class="stamp">[ {s.genre.toUpperCase()} ]</span><span class="text">{upper(s.names)}</span></div>
    {/each}
    {#if airGapped.length}
      <div class="award"><span class="stamp">[ {badges.airGapped} ]</span><span class="text">{upper(airGapped)}</span><span class="dim">NO GENRE IN COMMON WITH ANYONE</span></div>
    {/if}
  </div>
{/if}
