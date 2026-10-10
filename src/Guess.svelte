<script lang="ts">
  import Art from './Art.svelte'
  import Eq from './Eq.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import { attempt, game, isHost, me, nameOf, packsOf, refreshSoon, type Pack } from './lib/game.svelte'
  import { rpc } from './lib/supabase'

  const room = $derived(game.room!)
  const crew = $derived(game.players.filter((p) => p.id !== me()?.id))
  const packs = $derived(packsOf(game.songs))
  const isMine = (pack: Pack) => pack.songs.some((s) => game.owners[s.id] === me()?.id)
  const guessFor = (pack: Pack) => game.guesses.find((g) => g.song_id === pack.songs[0].id && g.guesser_id === me()?.id)?.guessed_player_id
  const todo = $derived(packs.filter((p) => !isMine(p)))
  const done = $derived(todo.filter((p) => guessFor(p)).length)
  const matchedElsewhere = (pack: Pack, playerId: string) => todo.some((p) => p !== pack && guessFor(p) === playerId)

  let open = $state<string | null>(null)
  let progress = $state<{ finished: number; total: number }>()
  const waiting = $derived(progress ? progress.total - progress.finished : 0)

  // other players' guesses are private, so their progress is polled instead of arriving live (not while the tab is hidden)
  $effect(() => {
    const load = () => document.hidden || rpc('guess_progress', { p_room: room.id }).then(([p]) => (progress = p)).catch(() => {})
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  })

  // a crew member can only be matched to one set, so choosing them again moves them
  async function pick(pack: Pack, playerId: string) {
    open = null
    const meId = me()!.id
    const ids = new Set(pack.songs.map((s) => s.id))
    game.guesses = [
      ...game.guesses.filter((g) => !(g.guesser_id === meId && (ids.has(g.song_id) || g.guessed_player_id === playerId))),
      ...pack.songs.map((s) => ({ song_id: s.id, guesser_id: meId, guessed_player_id: playerId })),
    ]
    await attempt(pack.id, () => rpc('submit_guess', { p_pack: pack.id, p_guessed: playerId }))
    refreshSoon()
  }

  const allIn = $derived(!todo.length || done === todo.length) // this player has matched every set they can
</script>

<Head step={`THE EXPERIMENT · ${done} / ${todo.length} GUESSED`} title="Who added what?" />

<p class="muted">VIBE: <span class="text">{room.theme}</span></p>

{#if isHost()}
  <div class="panel stack">
    <div class="label">HOST CHECKLIST</div>
    <div class="line"><b class:good={allIn}>{allIn ? '✓' : '○'}</b><span class:muted={allIn}>LISTEN AND GUESS · {done} / {todo.length}</span></div>
    <div class="line"><b class:good={waiting === 0}>{waiting === 0 ? '✓' : '○'}</b><span class:muted={waiting === 0}>WAIT FOR EVERYONE · {progress ? `${progress.finished} / ${progress.total}` : '...'}</span></div>
    <div class="line"><b>○</b><span>THE REVEAL OPENS BY ITSELF · NO BUTTON NEEDED</span></div>
  </div>
{/if}

{#if todo.length}
  <p class="muted center"><Eq />/// LISTEN TO THE PLAYLIST, THEN FOR EACH BOX OF SONGS PICK THE CREW MEMBER WHO ADDED THEM · EACH CREW MEMBER MATCHES ONE BOX</p>
{/if}

{#if todo.length && done === todo.length}
  <p class="center good">ALL GUESSED · {waiting > 0 ? `WAITING ON ${waiting} MORE PLAYER${waiting > 1 ? 'S' : ''}` : 'OPENING THE REVEAL'}</p>
  <p class="muted center">/// THE REVEAL OPENS WHEN EVERYONE IS DONE · COME BACK ANY TIME</p>
{:else if !todo.length}
  <p class="center good">NOTHING TO GUESS · THESE ARE ALL YOUR SONGS</p>
{/if}

<div class="framed">
  <iframe title="Playlist" src={`https://open.spotify.com/embed/playlist/${room.playlist_id}?theme=0`} allow="encrypted-media" loading="lazy"></iframe>
</div>
<Playlist />

{#if progress}
  <div class="split"><span><i class="rec"></i>CREW FINISHED</span><span class="good">{progress.finished} / {progress.total}</span></div>
{/if}

<div class="wave"></div>

{#each packs as pack}
  {#if isMine(pack)}
    <div class="panel muted">YOUR SONGS · {pack.songs.map((s) => s.title).join(' · ')}</div>
  {:else}
    <div class="panel stack">
      {#each pack.songs as s}
        <a class="line" href={`https://open.spotify.com/track/${s.spotify_id}`} target="_blank" rel="noopener">
          <Art src={s.art_url} />
          <div class="grow-text"><div>{s.title}</div><div class="dim">{s.artist}</div></div>
        </a>
      {/each}
      <button class="row" class:on={guessFor(pack)} onclick={() => (open = open === pack.id ? null : pack.id)}>
        <span class="grow">{guessFor(pack) ? nameOf(guessFor(pack)).toUpperCase() : 'WHO ADDED THESE?'}</span>
        <span>{open === pack.id ? '▴' : '▾'}</span>
      </button>
      {#if open === pack.id}
        <div class="chips" role="radiogroup" aria-label="Who added these songs">
          {#each crew as p}
            <button class="chip" role="radio" aria-checked={guessFor(pack) === p.id} class:on={guessFor(pack) === p.id} class:used={matchedElsewhere(pack, p.id)} onclick={() => pick(pack, p.id)}>
              {guessFor(pack) === p.id ? '✓ ' : ''}{p.name.toUpperCase()}
            </button>
          {/each}
        </div>
      {/if}
      <Notice scope={pack.id} />
    </div>
  {/if}
{/each}

<div class="grow"></div>
