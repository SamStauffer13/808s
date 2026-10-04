<script lang="ts">
  import { attempt, once, saveName, savedName } from './lib/game.svelte'
  import { call } from './lib/supabase'

  type Old = { id: string; theme: string; created_at: string; players: number }

  const tagline = ["CAN YOU SENSE PEOPLE'S VIBES?", "LET'S TEST THAT"]

  let name = $state(savedName())
  const adjectives = ['sad', 'summer', 'guilty-pleasure', 'late-night', 'nostalgic', 'angry']
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)]

  let vibe = $state('')
  let songs = $state(2)
  let editingSongs = $state(false)
  let passphrase = $state(localStorage.getItem('808s-host') ?? '')
  let remembered = $state(!!localStorage.getItem('808s-host'))

  const create = once(() =>
    attempt(async () => {
      try {
        const { room } = await call<{ room: { code: string } }>('create-room', {
          passphrase,
          name,
          theme: vibe,
          songs_per_player: songs,
        })
        saveName(name)
        localStorage.setItem('808s-host', passphrase)
        location.hash = `/${room.code}`
      } catch (e) {
        if ((e as Error).message.includes('access code')) {
          localStorage.removeItem('808s-host')
          remembered = false
        }
        throw e
      }
    }),
  )

  // finished playlists the app made, which anyone with the access code can remove from Spotify
  let old = $state<Old[]>()
  let confirming = $state<string>()

  const manage = (body: object) => call<{ playlists: Old[] }>('manage-playlists', { passphrase, ...body })
  const cleanup = () => attempt(async () => (old = (await manage({ action: 'list' })).playlists))
  const remove = (id: string) =>
    attempt(async () => {
      if (confirming !== id) {
        confirming = id
        return
      }
      await manage({ action: 'delete', room_id: id })
      old = old!.filter((g) => g.id !== id)
      confirming = undefined
    })
</script>

<div class="logo big">808<small>s</small></div>
<p class="tagline">
  <span>{tagline[0]}</span>
  <span class="good">{tagline[1]}<i class="cursor"></i></span>
</p>

<form class="form" autocomplete="off" onsubmit={(e) => (e.preventDefault(), create())}>
  <label class="field"><span class="label">YOUR NAME</span><input bind:value={name} maxlength="16" required /></label>
  <label class="field">
    <span class="label">THE PLAYLIST VIBE</span>
    <input bind:value={vibe} maxlength="140" placeholder={`e.g. your favorite ${adjective} songs`} required />
  </label>
  {#if editingSongs}
    <div class="field">
      <span class="label">SONGS EACH</span>
      <div class="pads" role="radiogroup" aria-label="Songs each">
        {#each [1, 2, 3, 4, 5] as n}
          <button type="button" role="radio" aria-checked={songs === n} class="pad" class:on={songs === n} onclick={() => ((songs = n), (editingSongs = false))}>{n}</button>
        {/each}
      </div>
    </div>
  {:else}
    <button type="button" class="link" onclick={() => (editingSongs = true)}>{songs} SONGS EACH · CHANGE</button>
  {/if}
  {#if !remembered}
    <label class="field"><span class="label">HOST ACCESS CODE</span><input class="secret" autocomplete="off" data-lpignore="true" bind:value={passphrase} required /></label>
  {/if}
  <button class="btn">BUILD THE PLAYLIST</button>
</form>

<p class="center"><button type="button" class="link" onclick={cleanup}>/// CLEAN UP OLD PLAYLISTS</button></p>
{#if old}
  <div class="stack">
    {#each old as g (g.id)}
      <div class="row">
        <div class="grow-text"><div>{g.theme}</div><div class="dim">{new Date(g.created_at).toLocaleDateString()} · {g.players} PLAYERS</div></div>
        {#if confirming === g.id}
          <button class="chip on" onclick={() => remove(g.id)}>DELETE?</button>
        {:else}
          <button class="round" onclick={() => remove(g.id)} aria-label="Delete playlist">×</button>
        {/if}
      </div>
    {:else}
      <p class="muted center">/// NOTHING TO CLEAN UP</p>
    {/each}
  </div>
{/if}
