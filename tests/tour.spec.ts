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
