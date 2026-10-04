const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const frames = 25
const still = matchMedia('(prefers-reduced-motion: reduce)').matches

// Shows the text scrambled and resolves it left to right in about a second. Returns a stop function.
export function decrypt(text: string, show: (shown: string) => void) {
  const step = (frame: number) => {
    const resolved = Math.floor((frame / frames) * text.length)
    show([...text].map((c, i) => (i < resolved || c === ' ' ? c : glyphs[Math.floor(Math.random() * glyphs.length)])).join(''))
  }

  if (still) return show(text)
  let frame = 0
  step(0)
  const timer = setInterval(() => {
    step(++frame)
    if (frame >= frames) clearInterval(timer)
  }, 40)
  return () => clearInterval(timer)
}
