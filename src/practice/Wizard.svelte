<script lang="ts">
  import { exitPractice, goStage, practice, setStep, stages } from '../lib/practice.svelte'
  import { tour, titles } from './steps'

  // there is no skip button: the way forward is doing what the card says, which moves the real game along
  const steps = $derived(tour[practice.stage])
  const i = $derived(Math.min(practice.step, steps.length - 1))
  const step = $derived(steps[i])

  const where = $derived(step.stage ?? practice.stage)
  let done = $state(false)
  const advance = () => {
    const again = step.again
    if (again && document.querySelector(again.while)) setStep(again.to)
    else if (i < steps.length - 1) setStep(i + 1)
    else if (step.final) done = true
  }
  const replay = () => {
    done = false
    goStage('home')
  }

  // A prompt is done when its thing has been used: a text box once it has been filled in and left, anything else
  // once it is tapped. (Tapping into a box does not count; the point is to type something.)
  const fields = 'input, textarea, select'
  // finishing a text box moves the cursor to the next empty one, so the form fills in top to bottom
  let focusNext = false
  $effect(() => {
    const touched = (e: Event) => {
      const el = document.querySelector(step.target)
      if (!el || step.look || step.when || step.gone || !(e.target instanceof Element) || !el.contains(e.target)) return
      if (e.type === 'change' ? !e.target.matches(fields) : e.target.matches(fields)) return
      if (e.type === 'change') focusNext = true
      const at = i
      setTimeout(() => i === at && advance()) // after the screen has reacted
    }
    // Enter finishes a box too. When another box is next it moves there instead of submitting a half-filled form.
    const enter = (e: KeyboardEvent) => {
      const el = document.querySelector(step.target)
      const next = document.querySelector(steps[i + 1]?.target ?? '')
      if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement) || !el?.contains(e.target) || step.when || !next?.matches('input')) return
      e.preventDefault()
      e.target.blur() // leaving the box is what finishes it
    }
    document.addEventListener('click', touched, true)
    document.addEventListener('change', touched, true)
    document.addEventListener('keydown', enter, true)
    return () => {
      document.removeEventListener('click', touched, true)
      document.removeEventListener('change', touched, true)
      document.removeEventListener('keydown', enter, true)
    }
  })

  // The lit spot follows its target as screens change; a target that is not there yet lights nothing.
  const pad = 8
  let hole = $state<{ top: number; left: number; width: number; height: number } | null>(null)
  $effect(() => {
    let frame = 0
    let scrolledFor = -1
    let seenFor = -1
    let goneAt = 0
    let last = ''
    const follow = () => {
      // boxes practice insists on are required from the start, so the form cannot be sent without them
      for (const s of steps) {
        const box = s.required ? document.querySelector(s.target) : null
        if (box instanceof HTMLInputElement) box.required = true
      }
      const el = document.querySelector(step.target)
      if (el && seenFor !== i) {
        seenFor = i
        // a box that already has something in it is not asked for again
        if (!step.when && el instanceof HTMLInputElement && el.value.trim()) advance()
        else if (focusNext && el instanceof HTMLInputElement) el.focus({ preventScroll: true })
        focusNext = false
      }
      // it was there and has been gone for a moment (not just remounting between two reveal sets): the user did it
      if (el) goneAt = 0
      else if (step.gone && seenFor === i) {
        goneAt ||= Date.now()
        if (Date.now() - goneAt > 400) {
          goneAt = 0
          advance()
        }
      }
      if (step.when && document.querySelector(step.when)) advance()
      if (el) {
        // the whole control: a field with its label, the bottom dock, a row of buttons
        const anchor = el.closest('label.field, .dock, .pager') ?? el
        const r = anchor.getBoundingClientRect()
        const now = [r.top, r.left, r.width, r.height].map(Math.round).join()
        if (now !== last) {
          last = now
          hole = { top: r.top - pad, left: r.left - pad, width: r.width + 2 * pad, height: r.height + 2 * pad }
        }
        if (scrolledFor !== i) {
          scrolledFor = i
          anchor.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }
      } else {
        last = ''
        hole = null
      }
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  })

  // The card sits above the lit spot (screens flow downward, so what comes next stays uncovered), or below it when
  // there is no room above, with an arrow pointing at it.
  let width = $state(0)
  let height = $state(0)
  let cardHeight = $state(0)
  const cardWidth = $derived(Math.min(480, width - 32))
  const card = $derived.by(() => {
    if (!hole) return null
    const gap = 14
    const room = cardHeight + gap + 8
    const below = height - (hole.top + hole.height)
    const side = hole.top - 48 >= room ? 'above' : below >= room ? 'below' : 'over' // 48: the PRACTICE bar
    const top = side === 'below' ? hole.top + hole.height + gap : side === 'above' ? hole.top - gap - cardHeight : height - cardHeight - 16
    const arrow = Math.min(Math.max(hole.left + hole.width / 2 - (width - cardWidth) / 2, 24), cardWidth - 24)
    return { side, top, arrow }
  })

  // leave room at the top of the page for the PRACTICE bar
  $effect(() => {
    document.body.classList.add('practicing')
    return () => document.body.classList.remove('practicing')
  })
</script>

<svelte:window bind:innerWidth={width} bind:innerHeight={height} />

<div class="practice-pill">
  <span>PRACTICE ROUND</span>
  <button type="button" onclick={exitPractice}>✕ EXIT</button>
</div>

{#if done}
  <div class="practice-veil"></div>
  <div class="practice-card done" role="dialog" aria-label="Practice finished">
    <p class="say">YOU'RE READY.</p>
    <p class="muted">THAT'S EVERY STEP. START A REAL GAME AND SEND YOUR FRIENDS THE LINK.</p>
    <button type="button" class="btn" onclick={exitPractice}>START A REAL GAME</button>
    <button type="button" class="btn ghost plain" onclick={replay}>PLAY IT AGAIN</button>
  </div>
{:else if hole}
  <div class="practice-block" style:inset="0 0 {height - hole.top}px 0"></div>
  <div class="practice-block" style:inset="{hole.top + hole.height}px 0 0 0"></div>
  <div class="practice-block" style:inset="{hole.top}px {width - hole.left}px {height - hole.top - hole.height}px 0"></div>
  <div class="practice-block" style:inset="{hole.top}px 0 {height - hole.top - hole.height}px {hole.left + hole.width}px"></div>
  <div class="practice-spot" style:top="{hole.top}px" style:left="{hole.left}px" style:width="{hole.width}px" style:height="{hole.height}px"></div>
  {#if card}
    <div class="practice-card {card.side}" bind:clientHeight={cardHeight} style:top="{card.top}px" style:--arrow="{card.arrow}px">
      <div class="meta"><span>STEP {i + 1} OF {steps.length}</span><span>{titles[where]}</span></div>
      <p class="say" aria-live="polite">{step.text}</p>
      {#if step.look}<button type="button" class="btn" onclick={advance}>GOT IT</button>{/if}
      <div class="dots" aria-hidden="true">
        {#each stages as s}<i class:on={s === where}></i>{/each}
      </div>
    </div>
  {/if}
{/if}
