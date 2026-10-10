<script lang="ts">
  import { onDestroy } from 'svelte'
  import Home from '../Home.svelte'
  import Room from '../Room.svelte'
  import { fake } from '../lib/supabase'
  import { handlers } from './backend'
  import { captions, codeOf, stageOf, stages } from './stages'

  let { code }: { code: string } = $props()
  const stage = $derived(stageOf(code))
  const at = $derived(stages.indexOf(stage))
  const link = (s: (typeof stages)[number]) => `#/${codeOf(s)}`

  // the real screens call the fake server only while the demo is open
  Object.assign(fake, handlers)
  onDestroy(() => Object.keys(handlers).forEach((name) => delete fake[name]))
</script>

<nav class="demo-bar" aria-label="Practice round">
  <div class="split"><span class="label">/// PRACTICE ROUND · FAKE DATA</span><a class="link" href="#/">EXIT</a></div>
  <p class="muted">STEP {at + 1} OF {stages.length} · {captions[stage].what}</p>
  <p class="try"><b class="good">TRY IT:</b> {captions[stage].tryIt}</p>
  <div class="stages">
    {#if at > 0}<a class="chip" href={link(stages[at - 1])}>← BACK</a>{/if}
    {#each stages as s}
      <a class="chip jump" class:on={s === stage} href={link(s)}>{s.toUpperCase()}</a>
    {/each}
    <a class="chip on" href={at < stages.length - 1 ? link(stages[at + 1]) : '#/'}>{at < stages.length - 1 ? 'NEXT STEP →' : 'START YOUR OWN'}</a>
  </div>
</nav>

{#key code}
  {#if stage === 'home'}<Home />{:else}<Room {code} />{/if}
{/key}
