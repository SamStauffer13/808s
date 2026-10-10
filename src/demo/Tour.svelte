<script lang="ts">
  import { tour, tourKey, type Prompt, type Stage } from './stages'

  let { stage }: { stage: Stage } = $props()

  // there is no skip button: the way forward is doing what the last prompt says, which moves the real game along
  const steps = $derived<Prompt[]>(tour[stage])
  // only the home stage leaves the page (the Spotify login), so only it needs to remember where it was
  const saved = (() => {
    try {
      const [name, n] = (sessionStorage.getItem(tourKey) ?? '').split(':')
      return stage === 'home' && name === stage ? Number(n) || 0 : 0
    } catch {
      return 0
    }
  })()
  let i = $state(Math.min(saved, steps.length - 1))
  $effect(() => {
    try {
      if (stage === 'home') sessionStorage.setItem(tourKey, `${stage}:${i}`)
    } catch {}
  })
  const step = $derived(steps[i])
  const usable = 'input, button, a, select, textarea'
  const advance = () => {
    const again = step.again
    if (again && document.querySelector(again.while)) i = again.to
    else if (i < steps.length - 1) i++
  }

  // A prompt is done when its thing has been used: a text box once it has been filled in and left, anything else
  // once it is tapped. (Tapping into a box does not count; the point is to type something.)
  const fields = 'input, textarea, select'
  // finishing a text box moves the cursor to the next empty one, so the form fills in top to bottom
  let focusNext = false
  $effect(() => {
    const touched = (e: Event) => {
      const el = document.querySelector(step.target)
      if (!el || step.when || step.gone || !(e.target instanceof Element) || !el.contains(e.target)) return
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
  // a prompt about something you can only look at (the playlist, a result) is dismissed by tapping it; one about
  // something you can use is not, so nobody skips past the thing they were meant to try
  line.onclick = () => {
    const el = document.querySelector(step.target)
    if (el && !el.matches(usable) && !el.querySelector(usable)) advance()
  }

  $effect(() => {
    count.textContent = `${i + 1}/${steps.length}`
    say.textContent = `> ${step.text}`
    why.textContent = step.why
  })

  // keep the line next to its target as screens change; a target that is not there yet shows nothing
  $effect(() => {
    let frame = 0
    let scrolledFor = -1
    let seenFor = -1
    let goneAt = 0
    const follow = () => {
      // boxes the practice round insists on are required from the start, so the form cannot be sent without them
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
        // above the nearest whole control (a field with its label, the bottom dock, a row of buttons)
        const anchor = el.closest('label.field, .dock, .pager') ?? el
        if (anchor.previousElementSibling !== line) {
          anchor.before(line)
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
