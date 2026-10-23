<script lang="ts">
  import Art from './Art.svelte'
  import Eq from './Eq.svelte'
  import Head from './Head.svelte'
  import Notice from './Notice.svelte'
  import Playlist from './Playlist.svelte'
  import { attempt, game, isHost, me, nameOf, notify, packsOf, refreshSoon, type Pack } from './lib/game.svelte'
  import { sourceOf, wordsOf } from './lib/sources'
  import { rpc } from './lib/supabase'

  const room = $derived(game.room!)
  const w = $derived(wordsOf(room.source)) // song/songs, video/videos
  const info = $derived(sourceOf(room.source))
  const embed = $derived(info.embed(room, game.songs)) // the songs come in playlist order
  const crew = $derived(game.players.filter((p) => p.id !== me()?.id))
  const packs = $derived(packsOf(game.songs))
  const isMine = (pack: Pack) => pack.songs.some((s) => game.owners[s.id] === me()?.id)
  const guessFor = (pack: Pack) => game.guesses.find((g) => g.song_id === pack.songs[0].id && g.guesser_id === me()?.id)?.guessed_player_id
  const todo = $derived(packs.filter((p) => !isMine(p)))
  const done = $derived(todo.filter((p) => guessFor(p)).length)
  // the set a crew member is already matched to (other than this one), so the chips can say where everyone is
  const placedOn = (pack: Pack, playerId: string) => todo.find((p) => p !== pack && guessFor(p) === playerId)
  const label = (pack: Pack) => {
    const title = pack.songs[0].title
    return `"${title.length > 30 ? `${title.slice(0, 29)}…` : title}"`
  }
  const left = $derived(crew.filter((p) => !todo.some((t) => guessFor(t) === p.id))) // crew members not matched to any set yet
  const openSets = $derived(todo.filter((p) => !guessFor(p)))
  const lastOne = $derived(openSets.length === 1 && left.length === 1 ? { pack: openSets[0], player: left[0] } : null)

  let open = $state<string | null>(null)
  let progress = $state<{ finished: number; total: number }>()
  const waiting = $derived(progress ? progress.total - progress.finished : 0)
  let slow = $state<string[]>([]) // crew members who still have sets to match

  // other players' guesses are private, so their progress is polled instead of arriving live (not while the tab is hidden)
  $effect(() => {
    const load = () =>
      document.hidden ||
      Promise.all([rpc('guess_progress', { p_room: room.id }), rpc('guess_waiting', { p_room: room.id })])
        .then(([[p], rows]) => ((progress = p), (slow = rows.map((r: { player_id: string }) => r.player_id).filter((id: string) => id !== me()?.id))))
        .catch(() => {})
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  })

  // a crew member can only be matched to one set, so choosing them again moves them
  async function pick(pack: Pack, playerId: string) {
    open = null
    const meId = me()!.id
    const ids = new Set(pack.songs.map((s) => s.id))
    const from = placedOn(pack, playerId)
    game.guesses = [
      ...game.guesses.filter((g) => !(g.guesser_id === meId && (ids.has(g.song_id) || g.guessed_player_id === playerId))),
      ...pack.songs.map((s) => ({ song_id: s.id, guesser_id: meId, guessed_player_id: playerId })),
    ]
    const saved = attempt(pack.id, () => rpc('submit_guess', { p_pack: pack.id, p_guessed: playerId }))
    // each person is on one set, so say so when choosing them takes them off another
    if (from) notify(pack.id, `${nameOf(playerId).toUpperCase()} MOVED HERE FROM ${label(from)} · THAT SET IS OPEN AGAIN`)
    await saved
    refreshSoon()
  }

  const allIn = $derived(!todo.length || done === todo.length) // this player has matched every set they can
</script>

<Head step={`THE EXPERIMENT · ${done} / ${todo.length} GUESSED`} title="Who added what?" />

<p class="muted">VIBE: <span class="text">{room.theme}</span></p>

{#if isHost()}
  <div class="panel stack">
    <div class="label">HOST CHECKLIST</div>
    <div class="line"><b class:good={allIn}>{allIn ? '✓' : '○'}</b><span class:muted={allIn}>{info.verb.toUpperCase()} AND GUESS · {done} / {todo.length}</span></div>
    <div class="line"><b class:good={waiting === 0}>{waiting === 0 ? '✓' : '○'}</b><span class:muted={waiting === 0}>WAIT FOR EVERYONE · {progress ? `${progress.finished} / ${progress.total}` : '...'}</span></div>
    <div class="line"><b>○</b><span>THE RESULTS OPEN BY THEMSELVES · NO BUTTON NEEDED</span></div>
  </div>
{/if}

{#if todo.length}
  <p class="muted prose center"><Eq />/// {info.consume}, then match every crew member to the set of {w.nouns} they added. Each person added exactly one set, so each name goes on a different set. Tap any {w.noun} to open it.</p>
  <div class="placed-strip" aria-label="Crew members still to place">
    {#each crew as p}
      {@const placed = !left.includes(p)}
      <span class="pip" class:on={placed}>{placed ? '✓' : '○'} {p.name.toUpperCase()}</span>
    {/each}
  </div>
  {#if lastOne}
    <button class="btn ghost plain" onclick={() => pick(lastOne.pack, lastOne.player.id)}>ONLY {lastOne.player.name.toUpperCase()} IS LEFT · PLACE THEM ON {label(lastOne.pack)}</button>
  {/if}
{/if}

{#if todo.length && done === todo.length}
  <p class="center good">ALL GUESSED · {waiting > 0 ? `WAITING ON ${waiting} MORE CREW MEMBER${waiting > 1 ? 'S' : ''}` : 'OPENING THE RESULTS'}</p>
  <p class="muted center">/// THE RESULTS OPEN WHEN THE WHOLE CREW IS DONE · COME BACK ANY TIME</p>
{:else if !todo.length}
  <p class="center good">NOTHING TO GUESS · THESE ARE ALL YOUR {w.NOUNS}</p>
{/if}

{#if embed}
  <div class="framed">
    <iframe title="Player" src={embed.src} class:wide={embed.wide} allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen loading="lazy"></iframe>
  </div>
{/if}
<Playlist />

{#if progress}
  <div class="split"><span><i class="rec"></i>CREW FINISHED</span><span class="good">{progress.finished} / {progress.total}</span></div>
  {#if slow.length}<p class="muted center">/// STILL GUESSING · {slow.map((id) => nameOf(id).toUpperCase()).join(' · ')}</p>{/if}
{/if}

<div class="wave"></div>

{#each packs as pack}
  {#if isMine(pack)}
    <div class="panel muted">YOUR {w.NOUNS} · {pack.songs.map((s) => s.title).join(' · ')}</div>
  {:else}
    <div class="panel stack">
      {#each pack.songs as s}
        <a class="line" href={sourceOf(s.source).link(s.item_id)} target="_blank" rel="noopener">
          <Art src={s.art_url} />
          <div class="grow-text"><div>{s.title}</div><div class="dim">{s.artist}</div></div>
          <span class="open" aria-hidden="true">↗</span>
        </a>
      {/each}
      <button class="row" class:on={guessFor(pack)} onclick={() => (open = open === pack.id ? null : pack.id)}>
        <span class="grow">{guessFor(pack) ? nameOf(guessFor(pack)).toUpperCase() : 'WHO ADDED THESE?'}</span>
        <span>{open === pack.id ? '▴' : '▾'}</span>
      </button>
      {#if open === pack.id}
        <div class="chips" role="radiogroup" aria-label={`Who added these ${w.nouns}`}>
          {#each crew as p}
            {@const elsewhere = placedOn(pack, p.id)}
            <button class="chip" role="radio" aria-checked={guessFor(pack) === p.id} class:on={guessFor(pack) === p.id} class:used={elsewhere} onclick={() => pick(pack, p.id)}>
              <span>{guessFor(pack) === p.id ? '✓ ' : ''}{p.name.toUpperCase()}</span>{#if elsewhere}<span class="dim">on {label(elsewhere)}</span>{/if}
            </button>
          {/each}
        </div>
      {/if}
      <Notice scope={pack.id} />
    </div>
  {/if}
{/each}

<div class="grow"></div>
