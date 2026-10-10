// Practice mode: the real screens, run on a fake game and a fake server (src/practice) while a wizard walks the
// player through them. One flag turns it on; leaving reloads the page, which throws all of it away.
// There are two journeys: the host's (start a game) and a crew member's (join one from an invite link).
export type Role = 'host' | 'guest'
export type Stage = 'home' | 'invite' | 'submit' | 'guess' | 'results'
export const journeys: Record<Role, readonly Stage[]> = {
  host: ['home', 'submit', 'guess', 'results'],
  guest: ['invite', 'submit', 'guess', 'results'],
}

// the one room in practice mode; real codes look like AB-1234, so it can never match one
export const practiceCode = 'PRACTICE'

// kept for the tab, so a reload (or the trip through the fake Spotify login) lands on the same step
const key = '808s-practice'
type Saved = { role: Role; stage: Stage; step: number; returnTo: string }

const saved = (): Partial<Saved> => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}
const start = saved()
const role = start.role ?? 'host'

export const practice = $state({ on: !!start.returnTo, role, stage: start.stage ?? journeys[role][0], step: start.step ?? 0, returnTo: start.returnTo ?? '' })

const save = () => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ role: practice.role, stage: practice.stage, step: practice.step, returnTo: practice.returnTo }))
  } catch {}
}

// the fake server is loaded only when practice is, and only once
let installed: Promise<void> | undefined
export const installPractice = () => (installed ??= import('../practice/backend').then((m) => m.install()))

export function startPractice(role: Role = 'host', stage: Stage = journeys[role][0], returnTo = location.href) {
  Object.assign(practice, { on: true, role, stage, step: 0, returnTo })
  save()
}

export function goStage(stage: Stage) {
  Object.assign(practice, { stage, step: 0 })
  save()
}

export function setStep(step: number) {
  practice.step = step
  save()
}

// back to where practice was started from, with nothing left over
export function exitPractice() {
  const to = practice.returnTo
  try {
    sessionStorage.removeItem(key)
  } catch {}
  history.replaceState(null, '', to)
  location.reload()
}

// /?practice opens the host's journey and /?practice=guest the crew member's; /?practice=guess or =guest-guess jumps
// to one stage (so does an old #/demo link). Handy for testing one screen.
export function startFromAddress() {
  const asked = new URLSearchParams(location.search).get('practice')
  const old = /^#\/demo(?:-(\w+))?$/.exec(location.hash)
  if (asked === null && !old) return
  const [, guest, name] = /^(guest-?)?(\w*)$/.exec(asked ?? old?.[1] ?? '') ?? []
  const role: Role = guest || name === 'invite' ? 'guest' : 'host'
  const stage = journeys[role].find((s) => s === name)
  history.replaceState(null, '', location.pathname)
  startPractice(role, stage, location.origin + location.pathname)
}
