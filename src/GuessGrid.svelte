<script lang="ts">
  import { me, nameOf } from './lib/game.svelte'
  import type { Analysis } from './lib/results'

  // Guessers down the side, subjects across the top: a green tick is a hit, red letters are who they blamed.
  let { grid, right, all }: { grid: Analysis['grid']; right: number; all: number } = $props()
  const { guessers, subjects, code, pick } = $derived(grid)
</script>

<div class="split"><span class="label">THE GUESS GRID</span><span class="good">{right} OF {all} RIGHT</span></div>
<div class="gridwrap">
  <table class="grid">
    <thead>
      <tr>
        <th><span class="sr">Guesser</span></th>
        {#each subjects as s}<th class:me={s.id === me()?.id} title={s.name}>{code[s.id]}</th>{/each}
      </tr>
    </thead>
    <tbody>
      {#each guessers as g, row}
        <tr class:me={g.id === me()?.id}>
          <th scope="row">{g.name.toUpperCase()}</th>
          {#each subjects as s, col}
            {@const picked = pick(g.id, s.id)}
            <td class:hit={picked === s.id} class:miss={picked && picked !== s.id} style:--n={row + col} title={picked ? `${g.name} guessed ${nameOf(picked)} for ${s.name}` : ''}>
              {#if g.id === s.id}·{:else if !picked}–{:else if picked === s.id}✓{:else}{code[picked]}{/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>
<p class="muted">ROWS GUESS · COLUMNS ARE THE SUBJECTS · <span class="good">✓</span> CRACKED IT · <span class="bad">RED</span> IS WHO THEY BLAMED</p>
