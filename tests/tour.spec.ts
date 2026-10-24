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

test('theme: the matrix rain is drawn in the chosen color, not green', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('808s-theme', '#975eab'))
  await open(page, '/?practice=submit')
  await page.getByPlaceholder('search tracks or artists').fill('the')
  await page.locator('button.row:not([disabled])').first().dispatchEvent('click')
  await page.getByRole('button', { name: 'BEGIN THE EXPERIMENT' }).dispatchEvent('click')
  await expect(page.locator('.rain')).toBeVisible()
  await page.waitForTimeout(1100)
  await page.screenshot({ path: 'test-results/screens/rain-purple.png' })
  // the trails dim toward the background, so count the strongest pixels: purple has red and blue well above green
  const hue = await page.locator('canvas.rain').evaluate((c: HTMLCanvasElement) => {
    const { data } = c.getContext('2d')!.getImageData(0, 0, c.width, c.height)
    let purple = 0
    let green = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 120 && data[i + 2] > 90 && data[i + 1] < 0.7 * data[i]) purple++
      if (data[i + 1] > 120 && data[i] < 0.7 * data[i + 1] && data[i + 2] < 0.9 * data[i + 1]) green++
    }
    return { purple, green }
  })
  expect(hue.purple).toBeGreaterThan(hue.green)
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

test('home: audio or video is asked first, the form follows it, and changing keeps what was typed', async ({ page }) => {
  await open(page, '/?practice=home')
  await expect(page.getByRole('button', { name: /AUDIO/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /VIDEO/ })).toBeVisible()
  await expect(page.getByLabel('YOUR NAME')).toHaveCount(0) // nothing else until one is chosen
  await page.screenshot({ path: 'test-results/screens/home-choose.png', fullPage: true })
  await page.getByRole('button', { name: /VIDEO/ }).dispatchEvent('click')
  await expect(page.getByRole('button', { name: 'INITIALIZE THE EXPERIMENT' })).toBeVisible()
  await expect(page.getByText('PLAYLIST NAME')).toHaveCount(0)
  await expect(page.getByText(/VIDEOS? EACH/)).toHaveCount(0) // video is one each, with nothing to choose or explain
  await page.getByLabel('YOUR NAME').fill('Tester')
  await expect(page.locator('.rain')).toHaveCount(0, { timeout: 4000 }) // the choice plays the rain first
  await page.locator('.chosen').dispatchEvent('click') // CHANGE: back to the question, with no rain
  await expect(page.getByLabel('YOUR NAME')).toHaveCount(0)
  await expect(page.locator('.rain')).toHaveCount(0)
  await page.getByRole('button', { name: /AUDIO/ }).dispatchEvent('click')
  await expect(page.getByLabel('YOUR NAME')).toHaveValue('Tester') // nothing typed is lost
  await expect(page.getByRole('button', { name: 'CONNECT SPOTIFY' })).toBeVisible()
  await expect(page.getByText('PLAYLIST NAME')).toBeVisible()
  await expect(page.getByRole('button', { name: '2 SONGS EACH · CHANGE' })).toBeVisible() // audio keeps its choice of 1 to 5
})

test('home: the form will not go on without a name and a vibe, and says which one is missing', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('808s-source', 'youtube'))
  const problems = await open(page, '/')
  const created: string[] = []
  page.on('request', (r) => r.url().includes('create-room') && created.push(r.url()))
  const go = page.getByRole('button', { name: 'INITIALIZE THE EXPERIMENT' })
  const name = page.getByLabel('YOUR NAME')
  const vibe = page.getByLabel('THE VIDEO VIBE')
  await expect(page.getByText(/\/\/\/ ENTER YOUR NAME/)).toHaveCount(0) // nothing is red before a try
  await go.click()
  await expect(page.getByText('/// ENTER YOUR NAME')).toBeVisible()
  await expect(page.getByText('/// ADD A VIBE FOR YOUR CREW')).toBeVisible()
  await expect(name).toBeFocused() // the first box that needs filling
  await page.screenshot({ path: 'test-results/screens/home-invalid.png', fullPage: true })
  await name.fill('   ') // spaces are not a name
  await go.click()
  await expect(page.getByText('/// ENTER YOUR NAME')).toBeVisible()
  await name.fill('Tester') // typing clears that message at once
  await expect(page.getByText('/// ENTER YOUR NAME')).toHaveCount(0)
  await expect(page.getByText('/// ADD A VIBE FOR YOUR CREW')).toBeVisible()
  await go.click()
  await expect(vibe).toBeFocused()
  expect(created).toEqual([]) // nothing was sent
  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
})

test('home: a first visit asks, and the answer is remembered so the next one goes straight to the form', async ({ page }) => {
  const problems = await open(page, '/')
  await expect(page.locator('.choices')).toBeVisible()
  await expect(page.getByLabel('YOUR NAME')).toHaveCount(0)
  await page.getByRole('button', { name: /VIDEO/ }).click()
  await expect(page.locator('.rain')).toBeVisible() // the same matrix rain as every other phase, with the form opening under it
  await page.waitForTimeout(1100)
  await page.screenshot({ path: 'test-results/screens/home-rain.png' })
  await expect(page.locator('.rain')).toHaveCount(0, { timeout: 4000 })
  await expect(page.getByLabel('YOUR NAME')).toBeVisible()
  await page.screenshot({ path: 'test-results/screens/home-chosen.png', fullPage: true })
  await page.reload()
  await expect(page.getByLabel('YOUR NAME')).toBeVisible() // remembered: no question this time
  await expect(page.locator('.choices')).toHaveCount(0)
  await expect(page.locator('.chosen')).toContainText('VIDEO')
  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
})

// The wizard dims everything but what it points at, so this goes through it with real clicks (the other tests click
// the element directly, which gets past the dimming and would never notice a choice nobody can reach).
test('tutorial: the wizard lets you choose video, then skips the playlist name', async ({ page }) => {
  await open(page, '/?practice=home')
  const card = page.locator('.practice-card')
  await expect(card).toContainText('AUDIO OR VIDEO')
  await page.getByRole('button', { name: /VIDEO/ }).click() // a real click: the choice is the lit spot
  await expect(card).toContainText('ENTER YOUR NAME')
  await page.getByLabel('YOUR NAME').fill('Tester')
  await card.getByRole('button', { name: 'NEXT' }).click()
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

test('theme: tapping the logo cycles the colors, survives a reload, and the fifth tap opens the admin instead', async ({ page }) => {
  const problems = await open(page, '/')
  const accent = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())
  const logo = page.locator('.logo.big')
  expect(await accent()).toBe('#1db954')
  await logo.click()
  expect(await accent()).toBe('#579bd5')
  expect(await page.locator('link[rel="icon"]').getAttribute('href')).toContain('%23579bd5') // the tab icon follows too
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/screens/theme-blue.png', fullPage: true })
  await page.reload()
  expect(await accent()).toBe('#579bd5')
  await logo.click()
  expect(await accent()).toBe('#975eab')
  await logo.click()
  expect(await accent()).toBe('#eaeaea')
  await logo.click()
  expect(await accent()).toBe('#1db954')
  await logo.click()
  expect(await accent()).toBe('#579bd5') // four taps since the reload: once round the colors, back where it started
  await expect(page.getByText('ADMIN KEY')).toHaveCount(0)
  await logo.click() // the fifth tap in a row
  await expect(page.getByText('ADMIN KEY')).toBeVisible()
  expect(await accent()).toBe('#579bd5')
  expect(problems.filter((p) => !/favicon/.test(p))).toEqual([])
})

test('theme: a color saved by an older picker falls back to green', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('808s-theme', '#ffb000'))
  await open(page, '/')
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#1db954')
})

// Some things only exist in a real game, which practice cannot show and which needs the live server (play again, the host
// alone before anyone joins). So this puts the real screen in front of a pretend Supabase and records what is sent. By
// default it is a finished game with three players, six songs and everyone's guesses; `alone` is the host in the submit
// phase with nobody else yet (`submitted`: and their own songs already added).
async function pretendGame(page: Page, { host, next = false, alone = false, submitted = false }: { host: boolean; next?: boolean; alone?: boolean; submitted?: boolean }) {
  const sent: { what: string; body: any }[] = []
  const crew = [
    { id: 'pl-me', user_id: 'u-me', name: 'Sam' },
    { id: 'pl-a', user_id: 'u-a', name: 'Cole' },
    { id: 'pl-b', user_id: 'u-b', name: 'Dalton' },
  ]
  const players = alone ? crew.slice(0, 1) : crew
  const songs = alone && !submitted ? [] : players.flatMap((p, i) => [1, 2].map((n) => ({ id: `s${i}${n}`, pack: `pk-${p.id}`, source: 'spotify', item_id: `t${i}${n}`, title: `Song ${i}${n}`, artist: 'Artist', art_url: null, genres: ['rock'] })))
  const owners = songs.map((s) => ({ song_id: s.id, player_id: players.find((p) => `pk-${p.id}` === s.pack)!.id }))
  // a guess is made per set, on its first song: everyone but the owner names the owner right, except Cole, who blames Sam
  const guesses = alone ? [] : players.flatMap((owner, i) => players.filter((g) => g !== owner).map((g) => ({ song_id: `s${i}1`, guesser_id: g.id, guessed_player_id: g.id === 'pl-a' ? 'pl-me' : owner.id })))
  const room = { id: 'r1', code: 'AB-1234', host_user_id: host ? 'u-me' : 'u-a', theme: 'angsty teenager songs', title: null, songs_per_player: 2, phase: alone ? 'submit' : 'reveal', source: 'spotify', playlist_id: null, playlist_url: null, next_room_id: next ? 'r2' : null }

  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  await page.route(/\/(rest|auth|functions)\/v1\//, async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    const reply = (json: unknown) => route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify(json) })
    const { pathname } = new URL(req.url())
    const asObject = (req.headers().accept ?? '').includes('pgrst.object') // .single(); .maybeSingle() takes a list
    const rows = (all: unknown[]) => reply(asObject ? all[0] : all)
    if (pathname.endsWith('/auth/v1/signup')) {
      const user = { id: 'u-me', aud: 'authenticated', role: 'authenticated', is_anonymous: true, app_metadata: {}, user_metadata: {}, created_at: '2026-10-23T00:00:00Z' }
      return reply({ access_token: 'a.b.c', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'r', user })
    }
    if (pathname.endsWith('/rest/v1/rooms')) return rows([room])
    if (pathname.endsWith('/rest/v1/players')) return rows(players)
    if (pathname.endsWith('/rest/v1/songs')) return rows(songs)
    if (pathname.endsWith('/rest/v1/song_owners')) return rows(owners)
    if (pathname.endsWith('/rest/v1/guesses')) return rows(guesses)
    if (pathname.endsWith('/functions/v1/create-room')) {
      sent.push({ what: 'create-room', body: req.postDataJSON() })
      return reply({ room: { ...room, id: 'r2', code: 'NX-0001' } })
    }
    if (pathname.endsWith('/rest/v1/rpc/join_next_room')) {
      sent.push({ what: 'join_next_room', body: req.postDataJSON() })
      return reply({ ...room, id: 'r2', code: 'NX-0001', phase: 'submit' })
    }
    return reply([])
  })
  await open(page, '/#/AB-1234')
  if (!alone) await expect(page.locator('.board')).toBeVisible() // the real results screen, drawn from the pretend game
  return sent
}

test('play again: the host gives a new vibe, nothing is sent without one, and it opens the next experiment', async ({ page }) => {
  const sent = await pretendGame(page, { host: true })
  await expect(page.getByRole('button', { name: 'JOIN THE NEXT EXPERIMENT' })).toHaveCount(0)
  await expect(page.locator('a.btn')).toHaveClass(/ghost/) // NEW EXPERIMENT steps back for the host's main button
  await page.getByRole('button', { name: 'PLAY AGAIN WITH THIS CREW' }).click()
  await page.getByRole('button', { name: 'START THE NEXT EXPERIMENT' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'test-results/screens/results-play-again.png', fullPage: true })
  await page.getByRole('button', { name: 'START THE NEXT EXPERIMENT' }).click()
  await expect(page.getByText('/// ADD A VIBE FOR YOUR CREW')).toBeVisible()
  expect(sent).toEqual([])
  await page.getByLabel('THE NEW PLAYLIST VIBE').fill('   ') // spaces are not a vibe
  await page.getByRole('button', { name: 'START THE NEXT EXPERIMENT' }).click()
  expect(sent).toEqual([])
  await page.getByLabel('THE NEW PLAYLIST VIBE').fill('songs for a road trip')
  await page.getByLabel('PLAYLIST NAME').fill('road tripping')
  await page.getByRole('button', { name: 'START THE NEXT EXPERIMENT' }).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]).toEqual({ what: 'create-room', body: { from_room: 'AB-1234', theme: 'songs for a road trip', title: 'road tripping' } })
  await expect(page).toHaveURL(/#\/NX-0001$/) // and the host is in the next one
})

test('play again: the crew get a join button once the next experiment exists, and joining opens it', async ({ page }) => {
  const sent = await pretendGame(page, { host: false, next: true })
  await expect(page.locator('.notice')).toContainText('NEXT EXPERIMENT IS READY')
  await expect(page.getByRole('button', { name: /PLAY AGAIN/ })).toHaveCount(0) // only the host starts one
  await page.waitForTimeout(700) // the notice wipes in
  await page.screenshot({ path: 'test-results/screens/results-join-next.png', fullPage: true })
  await page.getByRole('button', { name: 'JOIN THE NEXT EXPERIMENT' }).click()
  await expect.poll(() => sent.length).toBe(1)
  expect(sent[0]).toEqual({ what: 'join_next_room', body: { p_old: 'r1' } })
  await expect(page).toHaveURL(/#\/NX-0001$/)
})

test('play again: the crew see nothing extra until the host starts one, and practice never shows it', async ({ page }) => {
  await pretendGame(page, { host: false })
  await expect(page.getByRole('button', { name: /PLAY AGAIN|JOIN THE NEXT/ })).toHaveCount(0)
  await expect(page.locator('a.btn')).not.toHaveClass(/ghost/) // NEW EXPERIMENT stays the main button
  await page.goto('/?practice=results')
  await expect(page.locator('.board')).toBeAttached()
  await expect(page.getByRole('button', { name: /PLAY AGAIN|JOIN THE NEXT/ })).toHaveCount(0)
})

test('submit: a host with nobody else yet is told to share, and the invite sits just above the waiting button', async ({ page }) => {
  await pretendGame(page, { host: true, alone: true, submitted: true })
  await expect(page.getByText('/// Your songs are locked in. Send the invite link to STOP_BEING_ALONE')).toBeVisible()
  const crewList = await page.getByText('CREW', { exact: true }).boundingBox()
  const share = await page.getByRole('button', { name: /INVITE LINK/ }).boundingBox()
  const waiting = await page.getByRole('button', { name: 'WAITING FOR THE CREW TO JOIN' }).boundingBox()
  expect(share!.y, 'the invite is below the crew list, not up by the songs').toBeGreaterThan(crewList!.y)
  expect(waiting!.y - (share!.y + share!.height), 'and right above the button that waits on it').toBeLessThan(90)
  await page.screenshot({ path: 'test-results/screens/submit-alone.png', fullPage: true })
})

test('submit: a host who is alone and has not added anything yet is not told their songs are locked in', async ({ page }) => {
  await pretendGame(page, { host: true, alone: true })
  await expect(page.getByText('/// Add your songs, then send the invite link to STOP_BEING_ALONE')).toBeVisible()
  await expect(page.getByText(/locked in/)).toHaveCount(0)
})
