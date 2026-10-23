// The accent color: one hex, saved on this device, from which the rest of the accent family is derived.
const PRESETS = [
  { name: 'Green', hex: '#1db954' },
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Magenta', hex: '#ff4fd8' },
  { name: 'White', hex: '#e8e8e8' },
]

const key = '808s-theme'
const fallback = PRESETS[0].hex

const theme = $state({ accent: fallback })

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

const hex = ([r, g, b]: number[]) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

const toHsl = ([r, g, b]: number[]) => {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === R ? ((G - B) / d) % 6 : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

const fromHsl = (h: number, s: number, l: number) => {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255]
}

const luminance = (channels: number[]) => {
  const [r, g, b] = channels.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// the tab icon is public/favicon.svg with its corner brackets in the accent
const icon = (accent: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#090b0a"/><path d="M3 10V3h7M22 3h7v7M29 22v7h-7M10 29H3v-7" fill="none" stroke="${accent}" stroke-width="2.5"/><circle cx="16" cy="11" r="4" fill="none" stroke="#f5f5f5" stroke-width="3.2"/><circle cx="16" cy="21" r="5" fill="none" stroke="#f5f5f5" stroke-width="3.2"/></svg>`,
  )

export const applyTheme =(color: string) => {
  const accent = /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback
  const channels = rgb(accent)
  const [h, s, l] = toHsl(channels)
  const style = document.documentElement.style
  style.setProperty('--accent', accent)
  style.setProperty('--accent-hover', hex(fromHsl(h, s, Math.min(l + 0.06, 0.92))))
  style.setProperty('--accent-light', hex(fromHsl(h, Math.min(s, 1), 0.9))) // the bright head of the matrix rain
  style.setProperty('--accent-tint', `rgba(${channels.join(', ')}, 0.14)`)
  style.setProperty('--accent-text', luminance(channels) < 0.18 ? '#f5f5f5' : '#090b0a') // the text on a filled accent button
  theme.accent = accent
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.setAttribute('href', icon(accent))
}

// each tap on the logo moves to the next color and wraps around
export const cycleTheme = () => {
  const { hex } = PRESETS[(PRESETS.findIndex((p) => p.hex === theme.accent) + 1) % PRESETS.length]
  applyTheme(hex)
  try {
    localStorage.setItem(key, hex)
  } catch {}
}

export const loadTheme = () => {
  try {
    const saved = localStorage.getItem(key)
    applyTheme(PRESETS.some((p) => p.hex === saved) ? saved! : fallback) // a color from an older picker falls back to green
  } catch {}
}
