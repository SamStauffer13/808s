<script lang="ts">
  import qrcode from 'qrcode-generator'
  import Admin from './Admin.svelte'
  import Notice from './Notice.svelte'
  import { attempt, notify, once, saveName, savedName, type Room } from './lib/game.svelte'
  import { isLinkName } from '../supabase/functions/_shared/rules'
  import { valid } from './lib/form'
  import { goStage, practice } from './lib/practice.svelte'
  import * as account from './lib/spotify-account'
  import { call } from './lib/supabase'

  // Starting a hijack: a link that never changes, to put on NFC tags and a poster. Logging in to Spotify leaves
  // the page, so what was typed is kept for the trip.
  const draftKey = '808s-setup-draft'
  const draft = (() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null')
      sessionStorage.removeItem(draftKey)
      return saved
    } catch {
      return null
    }
  })()
  const lastKey = '808s-setup' // the link name opened on this device, so coming back shows the hijack again
  const last = () => {
    try {
      return localStorage.getItem(lastKey) ?? ''
    } catch {
      return ''
    }
  }

  let name = $state(draft?.name ?? savedName())
  let title = $state(draft?.title ?? '')
  let slug = $state(draft?.slug ?? last())
  let spotifyName = $state<string | null>(null)
  let canHijack = $state(false)
  let room = $state<Room | null>(null)
  let tried = $state(false)
  let copied = $state(false)

  const needsLogin = $derived(!spotifyName || !canHijack)
  const link = $derived(room ? `${location.origin}${location.pathname}#/${room.code}` : '')
  // a QR code on a white card, so any phone camera reads it whatever theme the app is in
  const qr = $derived.by(() => {
    if (!link) return ''
    const code = qrcode(0, 'M')
    code.addData(link)
    code.make()
    return code.createSvgTag({ cellSize: 6, margin: 0, scalable: true })
  })
  const canWrite = 'NDEFReader' in window // Chrome on Android can write a tag from a web page; nothing else can

  account.reportLogin('setup')
  attempt('setup', async () => {
    const s = await account.status()
    spotifyName = s.name
    canHijack = s.canHijack
    // a return visit (not the trip back from Spotify's login, which keeps the form to be finished): bring the hijack back.
    // Without a name for it this can only find an existing one, so a miss is fine.
    if (slug && canHijack && !draft) room = (await call<{ room: Room }>('open-hijack', { name, title, slug }).catch(() => null))?.room ?? null
  })

  const connect = () =>
    attempt('setup', async () => {
      sessionStorage.setItem(draftKey, JSON.stringify({ name, title, slug }))
      location.href = await account.loginUrl(`${location.origin}${location.pathname}#/setup`)
    })

  const open = once(() =>
    attempt('setup', async () => {
      room = (await call<{ room: Room }>('open-hijack', { name, title, slug })).room
      saveName(name)
      try {
        localStorage.setItem(lastKey, room.code)
      } catch {}
    }),
  )

  const submit = (e: SubmitEvent) => (valid(e) ? (needsLogin ? connect() : open()) : (tried = true))

  // practice ignores the address, so it moves to the next stage instead
  const enter = () => (practice.on ? goStage('hijack') : (location.hash = `/${room!.code}`))

  const copy = async () => {
    await navigator.clipboard.writeText(link)
    copied = true
    setTimeout(() => (copied = false), 1500)
  }

  const writeTag = () =>
    attempt('setup', async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await new (window as any).NDEFReader().write({ records: [{ recordType: 'url', data: link }] })
      } catch {
        throw new Error('Could not write the tag. Hold it flat against the back of the phone and try again.')
      }
      notify('setup', 'Tag written. Tap a phone on it to test.')
    })

  const toggleExplicit = () =>
    attempt('setup', async () => {
      const block = !room!.block_explicit
      await call('hijack-host', { room_id: room!.id, action: block ? 'block_explicit' : 'allow_explicit' })
      room = { ...room!, block_explicit: block }
    })
</script>

<Admin />
<h1>Hijack</h1>

{#if !room}
  <p class="muted prose">/// One link that never changes, for a party or a bar. Put it on NFC tags and a poster, and anyone who taps or scans can hijack the speaker: push tracks and roll back the ones they can't stand. No Spotify needed for them.</p>
  <form class="form" class:tried novalidate autocomplete="off" onsubmit={submit}>
    <label class="field">
      <span class="label">YOUR NAME</span>
      <input bind:value={name} maxlength="16" pattern=".*\S.*" required />
      {#if tried && !name.trim()}<span class="err">/// ENTER YOUR NAME</span>{/if}
    </label>
    <label class="field">
      <span class="label">NAME YOUR HIJACK</span>
      <input bind:value={title} maxlength="60" pattern=".*\S.*" placeholder="e.g. rooftop friday or bar vino" required />
      {#if tried && !title.trim()}<span class="err">/// GIVE YOUR HIJACK A NAME</span>{/if}
    </label>
    <label class="field">
      <span class="label">LINK NAME · 3 TO 12 LETTERS OR NUMBERS</span>
      <input bind:value={slug} minlength="3" maxlength="12" pattern="[A-Za-z0-9]+" placeholder="e.g. vino" required autocapitalize="characters" />
      {#if tried && !isLinkName(slug.trim().toUpperCase())}<span class="err">/// 3 TO 12 LETTERS OR NUMBERS</span>{/if}
    </label>
    {#if spotifyName && canHijack}
      <p class="muted">/// THE HIJACK PLAYS ON {spotifyName.toUpperCase()}'S SPOTIFY (PREMIUM)</p>
    {:else}
      <p class="muted prose">/// Connect the Spotify account that plays your speakers (Premium). The login happens on Spotify's own secure page, so your password never touches this app.</p>
    {/if}
    <Notice scope="setup" />
    <button class="btn">{needsLogin ? 'CONNECT SPOTIFY' : 'START THE HIJACK'}</button>
  </form>
{:else}
  <div class="panel framed">
    <div class="label">YOUR HIJACK IS LIVE</div>
    <div class="big">{room.theme}</div>
  </div>

  <div class="panel stack setup-link">
    <div class="label">THE LINK · IT NEVER CHANGES</div>
    <div class="good break">{link}</div>
    <button class="btn ghost plain" onclick={copy}>{copied ? 'COPIED' : 'COPY LINK'}</button>
  </div>

  <div class="setup-qr" aria-label="QR code for the link">{@html qr}</div>

  <div class="panel stack setup-nfc">
    <div class="label">NFC TAG</div>
    {#if canWrite}
      <p class="prose">Hold a blank or rewritable NFC tag to the back of this phone, then tap the button.</p>
      <button class="btn" onclick={writeTag}>WRITE THE LINK TO A TAG</button>
    {:else}
      <p class="prose muted">/// This phone can't write tags from a web page (Chrome on Android can). On an iPhone, use the free NFC Tools app: Write, Add a record, URL, then paste the link above. Use NTAG213 or similar rewritable tags; payment and keycards usually can't be rewritten.</p>
    {/if}
    <Notice scope="setup" />
  </div>

  <button class="row setup-explicit" class:on={room.block_explicit} onclick={toggleExplicit}>
    <span class="grow">{room.block_explicit ? 'EXPLICIT TRACKS ARE BLOCKED' : 'EXPLICIT TRACKS ARE ALLOWED'}</span>
    <span class="dim">TAP TO CHANGE</span>
  </button>

  <button class="btn ghost plain setup-poster" onclick={() => window.print()}>PRINT A POSTER</button>
  <button class="btn setup-enter" onclick={enter}>OPEN THE HIJACK SCREEN</button>

  <div class="poster">
    <h1>{room.theme}</h1>
    <p>PICK THE NEXT SONG</p>
    <div class="poster-qr">{@html qr}</div>
    <p>TAP YOUR PHONE ON THE TAG, OR SCAN THE CODE</p>
    <p class="fine">{link}</p>
  </div>
{/if}
