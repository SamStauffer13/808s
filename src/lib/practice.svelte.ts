// Practice mode: the real screens, run on a fake game and a fake server (src/practice) while a wizard walks the
// player through them. One flag turns it on; leaving reloads the page, which throws all of it away.
export const stages = ['home', 'invite', 'submit', 'guess', 'reveal', 'results'] as const
export type Stage = (typeof stages)[number]

// the one room in practice mode; real codes look like AB-1234, so it can never match one
export const practiceCode = 'PRACTICE'

// kept for the tab, so a reload (or the trip through the fake Spotify login) lands on the same step
const key = '808s-practice'
type Saved = { stage: Stage; step: number; returnTo: string }

const saved = (): Partial<Saved> => {
  try {
    return JSON.parse(sessionStorage.getItem(key) ?? '{}')
  } catch {
    return {}
  }
}
const start = saved()

export const practice = $state({ on: !!start.returnTo, stage: start.stage ?? 'home', step: start.step ?? 0, returnTo: start.returnTo ?? '' })

const save = () => {
  try {
    sessionStorage.setItem(key, JSON.stringify({ stage: practice.stage, step: practice.step, returnTo: practice.returnTo }))
  } catch {}
}

// the fake server is loaded only when practice is, and only once
let installed: Promise<void> | undefined
export const installPractice = () => (installed ??= import('../practice/backend').then((m) => m.install()))

export function startPractice(stage: Stage = 'home', returnTo = location.href) {
  Object.assign(practice, { on: true, stage, step: 0, returnTo })
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

// /?practice and /?practice=guess open practice (so does an old #/demo link); handy for testing one screen
export function startFromAddress() {
  const asked = new URLSearchParams(location.search).get('practice')
  const old = /^#\/demo(?:-(\w+))?$/.exec(location.hash)
  if (asked === null && !old) return
  const stage = [asked, old?.[1]].find((s): s is Stage => stages.includes(s as Stage))
  history.replaceState(null, '', location.pathname)
  startPractice(stage, location.origin + location.pathname)
}
