// The accent color, one of four, saved on this device. Each carries its whole family so nothing is worked out at run
// time: hover for buttons, tint for rows and notices, light for the bright head of the matrix rain, text for the words
// on a filled button (light on the purple, which is too dim for dark text). Blue, purple and white are the terminal's
// Aurelia scheme.
const THEMES = [
  { accent: '#1db954', hover: '#1ed760', light: '#d9ffe6', tint: 'rgba(29, 185, 84, 0.14)', text: '#090b0a' }, // green: the default in app.css
  { accent: '#579bd5', hover: '#6faadb', light: '#d6e7f5', tint: 'rgba(87, 155, 213, 0.14)', text: '#090b0a' }, // blue
  { accent: '#975eab', hover: '#a472b5', light: '#e9ddee', tint: 'rgba(151, 94, 171, 0.14)', text: '#f5f5f5' }, // purple
  { accent: '#eaeaea', hover: '#ebebeb', light: '#e6e6e6', tint: 'rgba(234, 234, 234, 0.14)', text: '#090b0a' }, // white
]

const key = '808s-theme'
let current = 0

// the tab icon is public/favicon.svg with its corner brackets in the accent
const icon = (accent: string) =>
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="5" fill="#090b0a"/><path d="M3 10V3h7M22 3h7v7M29 22v7h-7M10 29H3v-7" fill="none" stroke="${accent}" stroke-width="2.5"/><circle cx="16" cy="11" r="4" fill="none" stroke="#f5f5f5" stroke-width="3.2"/><circle cx="16" cy="21" r="5" fill="none" stroke="#f5f5f5" stroke-width="3.2"/></svg>`,
  )

const apply = (index: number) => {
  const { accent, hover, light, tint, text } = THEMES[index]
  const style = document.documentElement.style
  style.setProperty('--accent', accent)
  style.setProperty('--accent-hover', hover)
  style.setProperty('--accent-light', light)
  style.setProperty('--accent-tint', tint)
  style.setProperty('--accent-text', text)
  document.querySelector('link[rel="icon"]')?.setAttribute('href', icon(accent))
  current = index
}

// each tap on the logo moves to the next color and wraps around
export const cycleTheme = () => {
  apply((current + 1) % THEMES.length)
  try {
    localStorage.setItem(key, THEMES[current].accent)
  } catch {}
}

export const loadTheme = () => {
  try {
    apply(Math.max(0, THEMES.findIndex((t) => t.accent === localStorage.getItem(key)))) // anything else is green
  } catch {}
}
