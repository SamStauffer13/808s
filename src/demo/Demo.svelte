<script lang="ts">
  import { onDestroy } from 'svelte'
  import Home from '../Home.svelte'
  import Room from '../Room.svelte'
  import { fake } from '../lib/supabase'
  import { handlers } from './backend'
  import { codeOf, stageOf, stages } from './stages'

  let { code }: { code: string } = $props()
  const stage = $derived(stageOf(code))

  // the real screens call the fake server only while the demo is open
  Object.assign(fake, handlers)
  onDestroy(() => Object.keys(handlers).forEach((name) => delete fake[name]))
</script>

<nav class="demo-bar" aria-label="Demo stages">
  <span class="label">/// DEMO · FAKE DATA</span>
  <div class="stages">
    {#each stages as s}
      <a class="chip" class:on={s === stage} href={`#/${codeOf(s)}`}>{s.toUpperCase()}</a>
    {/each}
  </div>
</nav>

{#key code}
  {#if stage === 'home'}<Home />{:else}<Room {code} />{/if}
{/key}
