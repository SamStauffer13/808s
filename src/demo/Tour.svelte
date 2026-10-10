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

  // The prompt is a line of the page itself, placed just above what it points at, so it never covers anything.
  // It is built by hand because it lives among the real screens' elements, not in this component's markup.
  const line = document.createElement('button')
  line.type = 'button'
  line.className = 'prompt'
  const part = (tag: string, cls: string) => line.appendChild(Object.assign(document.createElement(tag), { className: cls }))
  const count = part('span', 'n')
  const say = part('span', 'say')
  part('i', 'cursor')
  const why = part('span', 'why')
  line.onclick = advance

  $effect(() => {
    count.textContent = `${i + 1}/${steps.length}`
    say.textContent = `> ${step.text}`
    why.textContent = step.why
  })

  // keep the line next to its target as screens change; a target that is not there yet shows nothing
  $effect(() => {
    let frame = 0
    let scrolledFor = -1
    const follow = () => {
      const el = document.querySelector(step.target)
      if (el) {
        // the bar sits at the top, so its prompt goes under it; the rest go above the nearest whole control
        const bar = el.closest('nav')
        const anchor = bar ?? el.closest('label.field, .dock, .pager') ?? el
        const spot = bar ? anchor.nextElementSibling : anchor.previousElementSibling
        if (spot !== line) {
          bar ? anchor.after(line) : anchor.before(line)
          if (scrolledFor !== i) {
            scrolledFor = i
            line.scrollIntoView({ block: 'center', behavior: 'smooth' })
          }
        }
      } else line.remove()
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => {
      cancelAnimationFrame(frame)
      line.remove()
    }
  })
</script>
