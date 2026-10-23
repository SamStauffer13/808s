<script lang="ts">
  import { transition } from './lib/transition.svelte'

  // Falling green glyphs that spell the next phase, then settle on its title. One full-screen canvas per run.
  let { title, glyphs }: { title: string; glyphs: string } = $props()
  let canvas: HTMLCanvasElement
  const length = 1800
  const size = 16

  $effect(() => {
    const ctx = canvas.getContext('2d')!
    const dpr = devicePixelRatio || 1
    const w = (canvas.width = innerWidth * dpr)
    const h = (canvas.height = innerHeight * dpr)
    ctx.scale(dpr, dpr)
    const letters = glyphs.replace(/\s+/g, ' ')
    const columns = Math.ceil(innerWidth / size)
    const speed = Array.from({ length: columns }, () => 0.6 + Math.random() * 0.9) // rows per frame
    const start = Array.from({ length: columns }, () => -Math.random() * 20) // rows above the screen
    const offset = Array.from({ length: columns }, () => Math.floor(Math.random() * letters.length))
    const rows = Math.ceil(innerHeight / size)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#1db954'
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#090b0a'
    let frame = 0
    let id = 0
    const t0 = performance.now()

    const draw = (now: number) => {
      const t = Math.min((now - t0) / length, 1)
      frame++
      ctx.globalAlpha = 0.22
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, innerWidth, innerHeight) // the trails: each frame dims the last
      ctx.globalAlpha = 1
      ctx.font = `${size}px 'JetBrains Mono', monospace`
      ctx.textAlign = 'center'
      for (let c = 0; c < columns; c++) {
        const row = start[c] + frame * speed[c]
        if (row < 0 || row > rows + 2) continue
        const letter = letters[(offset[c] + Math.floor(row)) % letters.length]
        ctx.fillStyle = '#d9ffe6' // the bright head of the stream
        ctx.fillText(letter, c * size + size / 2, row * size)
        ctx.fillStyle = accent
        ctx.fillText(letters[(offset[c] + Math.floor(row) - 1 + letters.length) % letters.length], c * size + size / 2, (row - 1) * size)
      }
      if (t > 0.35) {
        const show = Math.min((t - 0.35) / 0.3, 1)
        ctx.globalAlpha = show
        ctx.fillStyle = bg
        const width = title.length * 15 + 40
        ctx.fillRect(innerWidth / 2 - width / 2, innerHeight / 2 - 28, width, 56)
        ctx.fillStyle = accent
        ctx.font = `bold 22px 'JetBrains Mono', monospace`
        ctx.shadowColor = accent
        ctx.shadowBlur = 14
        ctx.fillText(title, innerWidth / 2, innerHeight / 2 + 8)
        ctx.shadowBlur = 0
        ctx.globalAlpha = 1
      }
      if (t < 1) id = requestAnimationFrame(draw)
      else transition.title = ''
    }
    id = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(id)
  })
</script>

<canvas bind:this={canvas} class="rain" aria-hidden="true"></canvas>
