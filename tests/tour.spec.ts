// Plays every stage of the tutorial: each screen has to draw what the wizard points at, nothing may throw, and a
// screenshot of each lands in test-results/screens for a human (or Claude) to look over.
import { expect, test, type Page } from '@playwright/test'
import { readdirSync, readFileSync } from 'node:fs'
import { sourceIds } from '../src/lib/source-ids'

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

async function open(page: Page, url: string) {
  const problems: string[] = []
  page.on('pageerror', (e) => problems.push(e.message))
  page.on('console', (m) => m.type() === 'error' && problems.push(m.text()))
  await page.addInitScript(() => sessionStorage.setItem('808s-booted', '1')) // skip the boot animation
  await page.goto(url)
  return problems
}

for (const [role, stage, url] of stages) {
  test(`${role} ${stage}: draws, lights up its first prompt, throws nothing`, async ({ page }) => {
    const problems = await open(page, url)
    await expect(page.locator('.practice-card')).toBeVisible()
    await expect(page.locator('.practice-card')).toContainText(/STEP 1 OF \d+/)
    const spot = await page.locator('.practice-spot').boundingBox() // the wizard found the element it points at
    expect(spot && spot.width > 0 && spot.height > 0, 'the first prompt points at something on screen').toBe(true)
    await page.waitForTimeout(500)
    await page.screenshot({ path: `test-results/screens/${role}-${stage}.png`, fullPage: true })
    expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
    await expect(page.getByText(/not available in the practice round/i)).toHaveCount(0)
  })
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

test('submit: beginning the experiment plays the matrix rain, then clears', async ({ page }) => {
  await open(page, '/?practice=submit')
  await page.getByPlaceholder('search tracks or artists').fill('the')
  await page.locator('button.row:not([disabled])').first().dispatchEvent('click') // the host's own song: now everyone is in
  await page.getByRole('button', { name: 'BEGIN THE EXPERIMENT' }).dispatchEvent('click')
  await expect(page.locator('.rain')).toBeVisible()
  await page.waitForTimeout(1100) // mid-fall, with the title showing
  await page.screenshot({ path: 'test-results/screens/rain.png' })
  await expect(page.locator('.rain')).toHaveCount(0, { timeout: 4000 })
})

// a video experiment: the same screens, about YouTube videos
for (const stage of ['submit', 'guess', 'results']) {
  test(`videos ${stage}: draws, throws nothing`, async ({ page }) => {
    const problems = await open(page, `/?practice=${stage}&source=youtube`)
    await expect(page.locator('.practice-card')).toBeVisible()
    await page.waitForTimeout(500)
    await page.screenshot({ path: `test-results/screens/videos-${stage}.png`, fullPage: true })
    expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
    await expect(page.getByText(/not available in the practice round/i)).toHaveCount(0)
    await expect(page.getByText(/spotify/i)).toHaveCount(0) // nothing about Spotify in a video experiment
  })
}

test('home: choosing videos drops the playlist name and the Spotify login', async ({ page }) => {
  await open(page, '/?practice=home')
  await expect(page.getByRole('button', { name: 'CONNECT SPOTIFY' })).toBeVisible()
  await expect(page.getByText('PLAYLIST NAME')).toBeVisible()
  await page.getByRole('radio', { name: 'VIDEO' }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: 'INITIALIZE THE EXPERIMENT' })).toBeVisible()
  await expect(page.getByText('PLAYLIST NAME')).toHaveCount(0)
})

// The wizard dims everything but what it points at, so this goes through it with real clicks (the other tests click
// the element directly, which gets past the dimming and would never notice a toggle nobody can reach).
test('tutorial: the wizard lets you choose video, then skips the playlist name', async ({ page }) => {
  await open(page, '/?practice=home')
  const card = page.locator('.practice-card')
  await page.getByLabel('YOUR NAME').fill('Tester')
  await card.getByRole('button', { name: 'NEXT' }).click()
  await expect(card).toContainText('AUDIO OR VIDEO')
  await page.getByRole('radio', { name: 'VIDEO' }).click() // a real click: the toggle is the lit spot
  await expect(card).toContainText('KINDS OF VIDEOS')
  await page.getByLabel('THE VIDEO VIBE').fill('goofy shorts')
  await card.getByRole('button', { name: 'NEXT' }).click()
  await expect(card).toContainText('SUBMIT VIDEOS') // straight to the button: no playlist name for video
})

test('videos guess: one player plays the whole list, and each video opens on YouTube', async ({ page }) => {
  await open(page, '/?practice=guess&source=youtube')
  await expect(page.locator('iframe.wide')).toHaveAttribute('src', /^https:\/\/www\.youtube-nocookie\.com\/embed\/\w[\w-]{10}\?playlist=([\w-]{11},){4}[\w-]{11}$/) // the first video, then the other five
  await expect(page.locator('a.line[href^="https://www.youtube.com/watch?v="]').first()).toBeAttached()
  await expect(page.getByText(/Watch the videos/)).toBeAttached()
})

// every item opens at its source, with an arrow that says so: the guess screen, the reveal and the scoreboard's files
for (const [source, url] of [['spotify', 'https://open.spotify.com/track/'], ['youtube', 'https://www.youtube.com/watch?v=']] as const) {
  test(`${source}: items link to their source with an arrow`, async ({ page }) => {
    await open(page, `/?practice=guess&source=${source}`)
    const link = page.locator('a.line').first()
    await expect(link).toHaveAttribute('href', new RegExp(`^${url.replace(/[.?]/g, '\\$&')}`))
    await expect(link).toContainText('↗')
    await expect(page.locator('.line', { hasText: 'AND GUESS' })).toContainText(source === 'spotify' ? 'LISTEN' : 'WATCH')

    await page.goto(`/?practice=results&source=${source}`)
    await page.locator('.files-toggle').dispatchEvent('click')
    await page.locator('.file .head').first().dispatchEvent('click')
    await expect(page.locator('.file.open a.line').first()).toHaveAttribute('href', new RegExp(`^${url.replace(/[.?]/g, '\\$&')}`))

    await page.getByRole('button', { name: 'REPLAY THE FINDINGS' }).dispatchEvent('click')
    await expect(page.locator('a.row').first()).toHaveAttribute('href', new RegExp(`^${url.replace(/[.?]/g, '\\$&')}`))
    await page.screenshot({ path: `test-results/screens/${source}-reveal.png`, fullPage: true })
  })
}

// A source is named in three places that cannot import each other: the client, the Edge Functions and the database.
test('sources: the client, the server and the database list the same ones', () => {
  const quoted = (text: string) => [...text.matchAll(/'(\w+)'/g)].map((m) => m[1]).sort()
  const server = quoted(/export type Source = ([^\n]+)/.exec(readFileSync('supabase/functions/_shared/providers.ts', 'utf8'))![1])
  const database = readdirSync('supabase/migrations').flatMap((file) => quoted(/insert into sources[^;]*;/i.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))?.[0] ?? '')).sort()
  expect(server).toEqual([...sourceIds].sort())
  expect(database).toEqual([...sourceIds].sort())
})

// The two experiences are the same screens: a video room never says "song" and an audio room never says "video"
// (the other's word would mean a screen forgot to ask its source for the wording).
for (const [source, other] of [['spotify', /\bvideos?\b/i], ['youtube', /\bsongs?\b/i]] as const) {
  for (const stage of ['submit', 'guess', 'results']) {
    test(`${source} ${stage}: no wording from the other source`, async ({ page }) => {
      await open(page, `/?practice=${stage}&source=${source}`)
      await page.waitForTimeout(300)
      const text = await page.locator('body').innerText()
      expect(text.match(other)?.[0], 'the other source\'s word on this screen').toBeUndefined()
    })
  }
}
