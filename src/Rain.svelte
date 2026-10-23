<script lang="ts">
  import { transition } from './lib/transition.svelte'

  // Falling green glyphs that spell the next phase, then settle on its title. One full-screen canvas per run.
  // Everything moves by elapsed time, so it plays the same on a 60Hz and a 144Hz screen.
  let { title, glyphs }: { title: string; glyphs: string } = $props()
  let canvas: HTMLCanvasElement
  const length = 1800 // ms, matches the fade in app.css
  const size = 16 // px per glyph

  $effect(() => {
    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(devicePixelRatio || 1, 2) // a 3x phone gains nothing from the extra pixels
    const { innerWidth: width, innerHeight: height } = window
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)

    const style = getComputedStyle(document.documentElement)
    const accent = style.getPropertyValue('--accent').trim()
    const bg = style.getPropertyValue('--bg').trim()
    const light = style.getPropertyValue('--accent-light').trim()
    const letters = glyphs.replace(/\s+/g, ' ')
    const streams = Array.from({ length: Math.ceil(width / size) }, () => ({
      speed: 36 + Math.random() * 54, // rows per second
      start: -Math.random() * 20, // rows above the screen
      offset: Math.floor(Math.random() * letters.length),
    }))
    const glyph = (offset: number, row: number) => letters[(offset + Math.max(0, Math.floor(row)) + letters.length) % letters.length]

    const px = Math.min(22, (width - 48) / title.length / 0.62) // the title shrinks to fit a narrow phone
    const titleFont = `bold ${px}px 'JetBrains Mono', monospace`
    ctx.font = titleFont
    const box = ctx.measureText(title).width + 40

    let id = 0
    let last = 0
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = Math.min((now - t0) / length, 1)
      const seconds = (now - t0) / 1000
      ctx.globalAlpha = 1 - 0.78 ** (((now - (last || now)) / 1000) * 60) // the trails: each frame dims the last
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, width, height)
      last = now
      ctx.globalAlpha = 1
      ctx.font = `${size}px 'JetBrains Mono', monospace`
      ctx.textAlign = 'center'
      streams.forEach(({ speed, start, offset }, c) => {
        const row = start + seconds * speed
        if (row < 0 || row > height / size + 2) return
        const x = c * size + size / 2
        ctx.fillStyle = light // the bright head of the stream
        ctx.fillText(glyph(offset, row), x, row * size)
        ctx.fillStyle = accent
        ctx.fillText(glyph(offset, row - 1), x, (row - 1) * size)
      })
      if (t > 0.35) {
        ctx.globalAlpha = Math.min((t - 0.35) / 0.3, 1)
        ctx.font = titleFont
        ctx.fillStyle = bg
        ctx.fillRect(width / 2 - box / 2, height / 2 - 28, box, 56)
        ctx.fillStyle = accent
        ctx.shadowColor = accent
        ctx.shadowBlur = 14
        ctx.fillText(title, width / 2, height / 2 + px / 3)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
      if (t < 1) id = requestAnimationFrame(draw)
      else transition.playing = false
    }
    id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  })
</script>

<canvas bind:this={canvas} class="rain" aria-hidden="true"></canvas>
