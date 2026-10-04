<script lang="ts">
  import Art from './Art.svelte'
  import Head from './Head.svelte'
  import Playlist from './Playlist.svelte'
  import { attempt, game, isHost, me, nameOf, once, packsOf, refresh, type Pack } from './lib/game.svelte'
  import { rpc } from './lib/supabase'

  const room = $derived(game.room!)
  const friends = $derived(game.players.filter((p) => p.id !== me()?.id))
  const packs = $derived(packsOf(game.songs))
  const isMine = (pack: Pack) => pack.songs.some((s) => game.owners[s.id] === me()?.id)
  const guessFor = (pack: Pack) => game.guesses.find((g) => g.song_id === pack.songs[0].id && g.guesser_id === me()?.id)?.guessed_player_id
  const todo = $derived(packs.filter((p) => !isMine(p)))
  const done = $derived(todo.filter((p) => guessFor(p)).length)
  const matchedElsewhere = (pack: Pack, playerId: string) => todo.some((p) => p !== pack && guessFor(p) === playerId)

  let open = $state<string | null>(null)
  let progress = $state<{ finished: number; total: number }>()

  // other players' guesses are private, so their progress is polled instead of arriving live
  $effect(() => {
    const load = () => rpc('guess_progress', { p_room: room.id }).then(([p]) => (progress = p)).catch(() => {})
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  })

  // a friend can only be matched to one set, so choosing them again moves them
  async function pick(pack: Pack, playerId: string) {
    open = null
    const meId = me()!.id
    const ids = new Set(pack.songs.map((s) => s.id))
    game.guesses = [
      ...game.guesses.filter((g) => !(g.guesser_id === meId && (ids.has(g.song_id) || g.guessed_player_id === playerId))),
      ...pack.songs.map((s) => ({ song_id: s.id, guesser_id: meId, guessed_player_id: playerId })),
    ]
    await attempt(() => rpc('submit_guess', { p_pack: pack.id, p_guessed: playerId }))
    await refresh()
  }

  const reveal = once(() => attempt(() => rpc('host_set_phase', { p_room: room.id, p_phase: 'reveal' })))
</script>

<Head step={`${done} OF ${todo.length} MATCHED`} title="Whose songs are these?" />

<p class="muted">VIBE: <span class="text">{room.theme}</span></p>

<iframe title="Playlist" src={`https://open.spotify.com/embed/playlist/${room.playlist_id}?theme=0`} allow="encrypted-media" loading="lazy"></iframe>
<Playlist />

{#if todo.length}
  <p class="muted center">/// MATCH EACH SET OF SONGS TO THE FRIEND WHO ADDED THEM</p>
{/if}

{#if progress}
  <div class="split"><span>FINISHED GUESSING</span><span class="good">{progress.finished} / {progress.total}</span></div>
{/if}

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
          {#each friends as p}
            <button class="chip" role="radio" aria-checked={guessFor(pack) === p.id} class:on={guessFor(pack) === p.id} class:used={matchedElsewhere(pack, p.id)} onclick={() => pick(pack, p.id)}>
              {guessFor(pack) === p.id ? '✓ ' : ''}{p.name.toUpperCase()}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/each}

{#if todo.length && done === todo.length}
  <p class="center good">ALL MATCHED · WAITING FOR THE REVEAL</p>
{:else if !todo.length}
  <p class="center good">NOTHING TO GUESS · THESE ARE ALL YOUR SONGS</p>
{/if}

<div class="grow"></div>

{#if isHost()}
  <button class="btn" onclick={reveal}>END GUESSING · REVEAL</button>
{/if}
