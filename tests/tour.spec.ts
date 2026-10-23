// Plays every stage of the tutorial: each screen has to draw what the wizard points at, nothing may throw, and a
// screenshot of each lands in test-results/screens for a human (or Claude) to look over.
import { expect, test, type Page } from '@playwright/test'

const stages = [
  ['host', 'home', '/?practice=home'],
  ['host', 'submit', '/?practice=submit'],
  ['host', 'guess', '/?practice=guess'],
  ['host', 'results', '/?practice=results'],
  ['guest', 'invite', '/?practice=guest'],
  ['guest', 'submit', '/?practice=guest-submit'],
  ['guest', 'guess', '/?practice=guest-guess'],
  ['guest', 'results', '/?practice=guest-results'],
] as const

// every stage again as the movie round (the songs round is the one above)
const kinds = [
  ['songs', ''],
  ['movies', '&kind=movies'],
] as const

async function open(page: Page, url: string) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  await page.addInitScript(() => sessionStorage.setItem('808s-booted', '1')) // skip the boot animation
  await page.goto(url)
  return problems
}

for (const [kind, extra] of kinds) {
  for (const [role, stage, url] of stages) {
    test(`${kind} ${role} ${stage}: draws, lights up its first prompt, throws nothing`, async ({ page }) => {
      const problems = await open(page, url + extra)
      await expect(page.locator('.practice-card')).toBeVisible()
      await expect(page.locator('.practice-card')).toContainText(/STEP 1 OF \d+/)
      const spot = await page.locator('.practice-spot').boundingBox() // the wizard found the element it points at
      expect(spot && spot.width > 0 && spot.height > 0, 'the first prompt points at something on screen').toBe(true)
      await page.waitForTimeout(500)
      await page.screenshot({ path: `test-results/screens/${kind === 'songs' ? '' : 'movies-'}${role}-${stage}.png`, fullPage: true })
      expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
      await expect(page.getByText(/not available in the practice round/i)).toHaveCount(0)
    })
  }
}

test('results: scoreboard shows the genre features', async ({ page }) => {
  await open(page, '/?practice=results')
  for (const sel of ['.board', '.awards', '.subnets', '.files-toggle']) await expect(page.locator(sel).first()).toBeAttached()
  await expect(page.locator('.file')).toHaveCount(0) // tucked away until opened
  await page.locator('.files-toggle').dispatchEvent('click') // the wizard's overlay sits on top, so click the element directly
  await expect(page.locator('.file').first()).toBeAttached()
  await expect(page.locator('.awards')).toContainText('SAME WAVELENGTH')
  await expect(page.locator('.subnets')).toContainText('THE CREW BY SUBNET')
  await expect(page.locator('.file').first()).toContainText('VIBE ·')
})

test('movies guess: posters, where to watch, and the empty state; songs still get the playlist', async ({ page }) => {
  await open(page, '/?practice=guess&kind=movies')
  await expect(page.locator('.art.poster').first()).toBeAttached()
  await expect(page.locator('.watch', { hasText: 'WHERE TO WATCH' }).first()).toBeAttached()
  await expect(page.locator('.watch', { hasText: 'STREAM' }).first()).toBeAttached() // a movie you can stream
  await expect(page.locator('.watch', { hasText: 'RENT' }).first()).toBeAttached()
  await expect(page.getByText(/NO STREAMING INFO/)).toBeAttached() // a movie with no where-to-watch data
  await expect(page.getByText(/\+1/).first()).toBeAttached() // more services than fit on a row
  await expect(page.getByText(/This product uses the TMDB API/)).toBeAttached()
  await expect(page.locator('iframe')).toHaveCount(0) // no Spotify playlist for movies
  await page.goto('/?practice=guess')
  await expect(page.locator('iframe')).toHaveCount(1)
  await expect(page.locator('.watch')).toHaveCount(0)
})

test('movies results: the scoreboard says movies, not songs', async ({ page }) => {
  await open(page, '/?practice=results&kind=movies')
  await page.locator('.files-toggle').dispatchEvent('click')
  await expect(page.locator('.file').first()).toContainText('▶')
  await expect(page.getByText(/person's movies/)).toBeAttached()
  await expect(page.getByText(/songs/i)).toHaveCount(0)
})

test('home: the toggle starts the movie preview and the first prompt points at it', async ({ page }) => {
  const hosts = new Set<string>()
  page.on('request', (r) => hosts.add(new URL(r.url()).hostname))
  await page.addInitScript(() => sessionStorage.setItem('808s-booted', '1'))
  await page.goto('/')
  const toggle = page.locator('.kind-toggle')
  await expect(toggle.locator('.pad.on')).toHaveText('AUDIO')
  await toggle.getByText('VIDEO').click()
  await expect(page.getByText('EVERYONE ADDS MOVIES.')).toBeVisible()
  await expect(toggle.locator('.pad.on')).toHaveText('VIDEO') // the toggle follows the choice
  await expect(page.getByText(/PLAYLIST NAME/)).toHaveCount(0) // movies have no playlist to name
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/home-movies-toggle.png', fullPage: true })
  await page.getByRole('button', { name: 'PLAY THE 35MM PREVIEW' }).click() // nothing typed in: the preview needs none
  await expect(page.locator('.practice-card')).toContainText(/STEP 1 OF \d+/)
  await expect(page.locator('.kind-toggle .pad.on')).toHaveText('VIDEO')
  await expect(page.locator('.practice-card')).toContainText('AUDIO (SONGS), OR VIDEO (MOVIES')
  // the preview runs on the fake server: whatever the page does, it never talks to the real backend
  expect([...hosts].filter((h) => /supabase\.co/.test(h))).toEqual([])
})

test('home: /?kind=movies opens on the movie side and never asks the backend anything', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (r) => requests.push(r.url()))
  const problems = await open(page, '/?kind=movies')
  await expect(page.locator('.kind-toggle .pad.on')).toHaveText('VIDEO')
  await expect(page.getByText('EVERYONE ADDS MOVIES.')).toBeVisible()
  await page.waitForTimeout(500)
  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([]) // no failed call to flash an error
  expect(requests.filter((u) => !/^(http:\/\/localhost:5173|data:|blob:)/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u))).toEqual([])
})

test('movies: walk the preview from home to a guess, touching nothing but the fake server', async ({ page }) => {
  const requests: string[] = []
  const problems = await open(page, '/?kind=movies')
  page.on('request', (r) => requests.push(r.url()))
  await page.getByRole('button', { name: 'PLAY THE 35MM PREVIEW' }).click()

  const card = page.locator('.practice-card')
  const next = () => card.getByRole('button', { name: 'NEXT' }).click()
  await expect(card).toContainText('STEP 1 OF 4')
  await page.locator('.kind-toggle .pad', { hasText: 'VIDEO' }).dispatchEvent('click')
  await expect(card).toContainText('STEP 2 OF 4')
  await page.locator('form label.field:nth-of-type(1) input').fill('Sam')
  await next()
  await page.locator('form label.field:nth-of-type(2) input').fill('rainy days')
  await next()
  await expect(card).toContainText('OPEN THE EXPERIMENT')
  await page.locator('form .btn').dispatchEvent('click')

  await expect(card).toContainText('ADD MOVIES') // search, add, begin
  await card.getByRole('button', { name: 'GOT IT' }).click()
  await page.locator('label.field input').fill('sh')
  await expect(page.locator('button.row:not([disabled]) .art.poster').first()).toBeVisible()
  await page.locator('button.row:not([disabled])').first().dispatchEvent('click')
  await expect(page.locator('.row .art.poster').first()).toBeVisible() // your pick shows as a poster
  await page.locator('button.btn:not(.ghost):not([disabled])').dispatchEvent('click')

  await expect(card).toContainText('GUESS') // guess one set
  await expect(page.locator('.watch').first()).toBeVisible()
  await page.locator('.panel button.row:not(.on)').first().dispatchEvent('click')
  await page.locator('.chip').first().dispatchEvent('click')
  await expect(page.locator('.panel button.row.on').first()).toBeVisible()
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/screens/movies-walk-guess.png', fullPage: true })

  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
  expect(requests.filter((u) => /supabase\.co|127\.0\.0\.1:9|themoviedb|justwatch/.test(u))).toEqual([])
})

test('guess: shows who is still guessing', async ({ page }) => {
  await open(page, '/?practice=guess')
  await expect(page.getByText('CREW FINISHED')).toBeVisible()
  await expect(page.getByText(/STILL GUESSING · COLE/)).toBeAttached()
})

test('guess: shows who is left to place, and says when a pick moves someone', async ({ page }) => {
  await open(page, '/?practice=guess')
  await expect(page.locator('.placed-strip .pip')).toHaveCount(5)
  await expect(page.locator('.placed-strip .pip.on').first()).toBeAttached() // some are placed already
  await page.locator('.panel .row:not(.on)').first().dispatchEvent('click') // a set with nobody picked yet
  const used = page.locator('.chip.used').first()
  await expect(used).toContainText(/on "/) // says where that person already is
  await used.dispatchEvent('click')
  await expect(page.getByText(/MOVED HERE FROM ".*" · THAT SET IS OPEN AGAIN/)).toBeVisible()
})
