<script lang="ts">
  import { tour, tourKey, type Prompt, type Stage } from './stages'

  let { stage, last }: { stage: Stage; last: boolean } = $props()

  // the stage's prompts, then one pointing at the bar's NEXT STEP so there is always a next thing to touch
  const steps = $derived<Prompt[]>([
    ...tour[stage],
    { target: '[data-tour-next]', text: last ? 'ALL DONE' : 'NEXT STEP', why: last ? 'START A REAL GAME OF YOUR OWN.' : 'ON TO THE NEXT PART OF THE GAME.' },
  ])
  // only the home stage leaves the page (the Spotify login), so only it needs to remember where it was
  const saved = (() => {
    try {
      const [name, n] = (sessionStorage.getItem(tourKey) ?? '').split(':')
      return stage === 'home' && name === stage ? Number(n) || 0 : 0
    } catch {
      return 0
    }
  })()
  let i = $state(Math.min(saved, steps.length - 2)) // never resume on the bar's NEXT STEP: a login round trip should land back on its button
  $effect(() => {
    try {
      if (stage === 'home') sessionStorage.setItem(tourKey, `${stage}:${i}`)
    } catch {}
  })
  const step = $derived(steps[i])
  const advance = () => i < steps.length - 1 && i++

  // touching the thing a prompt points at moves on to the next prompt (tapping the prompt itself does too)
  $effect(() => {
    const touched = (e: Event) => {
      const el = document.querySelector(step.target)
      if (!el || !(e.target instanceof Node) || !el.contains(e.target)) return
      const at = i
      setTimeout(() => i === at && advance()) // after the screen has reacted
    }
    document.addEventListener('click', touched, true)
    document.addEventListener('focusin', touched, true)
    return () => {
      document.removeEventListener('click', touched, true)
      document.removeEventListener('focusin', touched, true)
    }
  })

  // follow the target as the page scrolls or changes; a target that is not there yet shows nothing
  let box = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let tipHeight = $state(80)
  // under the thing it points at, or above it when there is no room left below
  const tipTop = $derived.by(() => {
    if (!box) return 0
    const below = box.y + box.h + 12
    const above = box.y - 12 - tipHeight
    return below + tipHeight > innerHeight - 8 && above > 48 ? above : below
  })
  $effect(() => {
    let frame = 0
    let scrolledTo = ''
    let shown = '' // what `box` holds, kept here so this effect never reads the state it writes
    const follow = () => {
      const el = document.querySelector(step.target)
      if (el) {
        const r = el.getBoundingClientRect()
        if (scrolledTo !== step.target) {
          scrolledTo = step.target
          el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
        const next = { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }
        const key = `${next.x},${next.y},${next.w},${next.h}`
        if (key !== shown) [shown, box] = [key, next]
      } else if (shown) [shown, box] = ['', null]
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  })
</script>

{#if box}
  <div class="ring" style:left="{box.x - 4}px" style:top="{box.y - 4}px" style:width="{box.w + 8}px" style:height="{box.h + 8}px" aria-hidden="true"></div>
  <button class="tip" style:--x="{box.x}px" style:top="{tipTop}px" bind:offsetHeight={tipHeight} onclick={advance}>
    <span class="n">{i + 1}/{steps.length}</span>
    <span class="say">{step.text}</span>
    <span class="why">{step.why}</span>
  </button>
{/if}
