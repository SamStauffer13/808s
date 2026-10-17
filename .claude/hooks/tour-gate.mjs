// Stop hook: when the app's source or tests changed since the last green tutorial tour, run `npm run tour` before Claude
// finishes. A failing tour exits 2 (stderr goes back to Claude, which keeps working); a passing one asks Claude once to
// look at the screenshots. Cheap when nothing changed: it only hashes the files.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd()
const stateFile = `${root}/test-results/.tour-state.json`
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024, ...opts })

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {}

if (!existsSync(`${root}/node_modules/@playwright/test`)) process.exit(0) // not set up here: stay out of the way

// a fingerprint of everything the tour depends on (committed or not)
const files = run('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'src', 'tests', 'index.html', 'playwright.config.ts', 'package.json']).stdout.split('\n').filter(Boolean).sort()
const hash = createHash('sha256')
for (const f of files) if (existsSync(`${root}/${f}`)) hash.update(f).update(readFileSync(`${root}/${f}`))
const now = hash.digest('hex')

let state = {}
try {
  state = JSON.parse(readFileSync(stateFile, 'utf8'))
} catch {}
const save = (patch) => {
  mkdirSync(`${root}/test-results`, { recursive: true })
  writeFileSync(stateFile, JSON.stringify({ ...state, ...patch }))
}

if (state.green === now) process.exit(0) // nothing changed since the last green run
if (input.stop_hook_active && state.failed === now) process.exit(0) // already told Claude about this failure: no loop

const result = run('npx', ['playwright', 'test'], { timeout: 180_000 })
if (result.status === 0) {
  save({ green: now, failed: undefined })
  if (input.stop_hook_active) process.exit(0)
  console.log(JSON.stringify({ decision: 'block', reason: 'The tutorial tour passed (npm run tour). Before finishing, open the screenshots for the stages you touched in test-results/screens/ and check the layout by eye: the tests cannot see an overlap or a broken layout. If it looks right, say so briefly and stop.' }))
  process.exit(0)
}

save({ failed: now })
const out = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim().split('\n').slice(-70).join('\n')
console.error(`The tutorial tour failed (npm run tour). Fix it, or the test if the app change was intended, then finish.\n\n${out}`)
process.exit(2)
