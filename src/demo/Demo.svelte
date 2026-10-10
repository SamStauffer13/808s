<script lang="ts">
  import { onDestroy } from 'svelte'
  import Home from '../Home.svelte'
  import Room from '../Room.svelte'
  import { fake } from '../lib/supabase'
  import { handlers } from './backend'
  import Tour from './Tour.svelte'
  import { codeOf, stageOf, stages, titles, tourKey } from './stages'

  let { code }: { code: string } = $props()
  const stage = $derived(stageOf(code))
  const at = $derived(stages.indexOf(stage))
  const link = (s: (typeof stages)[number]) => `#/${codeOf(s)}`
  const fresh = () => {
    try {
      sessionStorage.removeItem(tourKey) // leaving a stage by the bar starts the other one from its first prompt
    } catch {}
  }

  // the real screens call the fake server only while the demo is open
  Object.assign(fake, handlers)
  onDestroy(() => Object.keys(handlers).forEach((name) => delete fake[name]))
</script>

<nav class="demo-bar" aria-label="Practice round">
  <span class="label">PRACTICE · {titles[stage]}</span>
  <span class="actions">
    {#if at > 0}<a class="chip" href={link(stages[at - 1])} onclick={fresh}>← BACK</a>{/if}
    <a class="link" href="#/" onclick={fresh}>EXIT</a>
  </span>
</nav>

{#key code}
  {#if stage === 'home'}<Home />{:else}<Room {code} />{/if}
{/key}

{#key code}<Tour {stage} />{/key}
