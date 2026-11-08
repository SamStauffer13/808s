// The wizard's script: for each journey and stage, the things to touch in order, one sentence each. `target` is a CSS
// selector for the real element on that screen (Wizard.svelte lights it up), so a screen that changes its markup must
// update it here.
import { practice, spotifyKey, type Role, type Stage } from '../lib/practice.svelte'
import { wordsOf } from '../lib/sources'
import { badges, stamps } from '../lib/stamps'

// what the card calls each stage (the order is not a count: a real game has many more taps than five)
export const titles: Record<Stage, string> = {
  home: 'START AN EXPERIMENT',
  invite: 'JOIN THE EXPERIMENT',
  get submit() {
    return `ADD ${wordsOf(practice.source).NOUNS}`
  },
  guess: 'GUESS',
  results: 'RESULTS',
  hijack: 'THE HIJACK',
  setup: 'START A HIJACK',
  join: 'JOIN THE HIJACK',
}

// Each prompt is one friendly sentence in order (First, Next, Then, Finally) saying what its thing is for. A text box is
// done when NEXT (or Return) is pressed with something typed in it; anything else, when it is tapped.
// `text` can be a function when what to say depends on where the player is (it is read as the card appears)
// `look`: something to read, not use: the card has a GOT IT button, and the thing itself can still be played with
// `skipTo`: finishing this prompt jumps to that stage (a crew member waits for the host, so the tutorial skips ahead)
// `final`: the last prompt of practice; finishing it opens the YOU'RE READY card
// `again`: after this prompt is done, go back to prompt number `to` while something matching `while` is still on the screen
// `when`: the prompt is done as soon as something matching this shows up (search results appear while you type)
// `required`: practice will not let the form go on until this box is filled, even if the real one allows it
// `skip`: the prompt is passed over while this says true (its box is not on the screen)
export type Prompt = { target: string; text: string | (() => string); look?: boolean; skipTo?: Stage; final?: boolean; again?: { to: number; while: string }; when?: string; required?: boolean; skip?: () => boolean }

// the words for what the experiment is about: songs, or videos when the host chose that on Home
const words = () => wordsOf(practice.source)
// what the host chose on Home (the room does not exist yet, so practice.source cannot say)
const picked = () => (document.querySelector('.chosen')?.getAttribute('data-source') === 'youtube' ? 'VIDEOS' : 'SONGS')
const search = (text: (w: ReturnType<typeof words>) => string): Prompt => ({ target: 'label.field input', text: () => text(words()), when: 'button.row:not([disabled])' })
const addSong: Prompt = { target: 'button.row:not([disabled])', text: () => `NEXT, TAP YOUR ${words().NOUN} TO ADD IT; NOBODY SEES WHO ADDED WHAT UNTIL THE RESULTS.` }

// the same for everyone once the guessing starts
const guess: Prompt[] = [
  { target: '.panel button.row:not(.on)', text: () => `FIRST, PICK A ${words().NOUN} TO GUESS WHICH CREW MEMBER ADDED IT. EACH PERSON ADDED ONE SET, SO EACH NAME GOES ON A DIFFERENT SET: THE LIST ABOVE SHOWS WHO IS LEFT.` },
  { target: '.chips', text: 'THEN, CHOOSE THE CREW MEMBER YOU THINK ADDED IT.', again: { to: 0, while: '.panel button.row:not(.on)' } },
]
const results: Prompt[] = [
  { target: '.panel.framed', text: "HERE'S WHO WON, BASED ON THE MOST RIGHT GUESSES.", look: true },
  { target: '.board', text: () => `NEXT, EVERYONE'S SCORE: HOW MANY OF THE OTHER PLAYERS' ${words().NOUNS} THEY MATCHED RIGHT.`, look: true },
  { target: '.awards', text: () => `THEN THE AWARDS: ${badges.worst} FOR THE WORST GUESSER AND ${badges.blamed} FOR WHOEVER GOT BLAMED THE MOST. ${badges.twins} MARKS THE TWO PEOPLE WHOSE ${words().NOUNS} SHARE THE MOST GENRES.`, look: true },
  { target: '.subnets', text: () => `SUBNETS GROUP THE CREW BY THE GENRE THEIR ${words().NOUNS} LEAN ON MOST. ${badges.airGapped} IS ANYONE WITH NO MATCH.`, look: true },
  { target: '.files-toggle', text: 'THE FILES ARE TUCKED AWAY. TAP TO OPEN THEM.', when: '.file' },
  { target: '.file', text: () => `EACH FILE IS ONE PERSON'S ${words().NOUNS}, WHO ADDED THEM AND WHAT PERCENT OF THE CREW GUESSED THEM. A STAMP LIKE ${stamps[0]} FLAGS THE EXTREMES.`, look: true },
  { target: '.file .head', text: 'FINALLY, TAP A FILE TO SEE EXACTLY WHO GUESSED WHAT.', when: '.file.open' },
  { target: 'a.btn', text: 'NOW START A REAL EXPERIMENT OF YOUR OWN.', final: true },
]

// The hijack plays out by itself in practice (see demo.ts), and these follow it: what is live, what is in staging, a
// rollback, then the lock-in as it happens, then pushing a track of your own. Anyone attached sees all of it; the host
// has a few extra controls in the middle.
const hijackIntro: Prompt[] = [
  { target: '.hijack-now', text: "THIS IS WHAT'S LIVE ON THE SPEAKER RIGHT NOW.", look: true },
  { target: '.hijack-list', text: 'THESE TRACKS ARE IN STAGING, IN THE ORDER THEY WILL PLAY. EVERYONE ATTACHED CAN SEE THEM AND CHANGE THEM.', look: true },
]
const hijackBody: Prompt[] = [
  { target: '.hijack-vote:not(.on)', text: "NOT FEELING A TRACK? ROLL IT BACK. ENOUGH ROLLBACKS FROM THE CREW AND IT'S GONE, SO TAP TO CAST YOURS.", skip: () => !document.querySelector('.hijack-vote:not(.on)') },
  { target: '.hijack-status', text: 'KEEP AN EYE ON THIS LINE. A FEW SECONDS BEFORE THE SONG ENDS, THE FRONT TRACK LOCKS IN. WAIT FOR IT.', when: '.hijack-row.lock' },
  { target: '.hijack-row.lock', text: "LOCKED IN. ROLLBACKS ARE CLOSED FOR IT NOW AND IT PLAYS WHEN THE SONG ENDS (IN THE REAL THING, SPOTIFY HAS IT QUEUED).", look: true, skip: () => !document.querySelector('.hijack-row.lock') },
  // a guest lands with the search already open, so only the host has this button to tap first
  { target: '.dock .btn', text: 'NOW PUSH A TRACK OF YOUR OWN.', skip: () => !document.querySelector('.dock .btn:not([disabled])') },
  { target: 'label.field input', text: 'SEARCH FOR THE SONG YOU WANT. TYPE A FEW LETTERS.', when: '.hijack-add button.row:not(.recent):not([disabled])' },
  { target: '.hijack-add button.row:not(.recent):not([disabled])', text: 'TAP IT TO PUSH IT TO STAGING. YOU WILL SEE ABOUT HOW LONG UNTIL IT PLAYS, AND THE CREW CAN ROLL IT BACK, SO PICK WELL.', final: true },
]
// what the host can do that nobody else can: promote a track to the front, remove one, or call a code freeze
const hijackHost: Prompt[] = [
  { target: '.hijack-health', text: 'THIS TELLS YOU WHETHER THE MUSIC KEEPS FLOWING WITH YOUR PHONE LOCKED. IF IT SAYS TO KEEP THE SCREEN OPEN, THE SERVER TIMER IS NOT SET UP YET.', look: true },
  { target: '.hijack-skip', text: 'SKIP THE SONG THAT IS PLAYING. IT TAKES TWO TAPS, SO A STRAY TOUCH CANNOT CUT THE MUSIC.', look: true },
  { target: '.hijack-host', text: 'AS HOST YOU CAN MOVE A TRACK UP, PLAY IT RIGHT NOW, OR REMOVE IT, NO MATTER WHAT THE CREW SAYS.', look: true },
  { target: '.hijack-pause', text: 'CALL A CODE FREEZE IF STAGING GETS OUT OF HAND.', look: true },
]
// starting a hijack: name it, pick the fixed link, connect Spotify, then put the link on tags and a poster
const setup: Prompt[] = [
  { target: 'form label.field:nth-of-type(2) input', text: 'FIRST, NAME YOUR HIJACK. THIS IS WHAT YOUR GUESTS SEE.', required: true },
  { target: 'form label.field:nth-of-type(3) input', text: 'NEXT, PICK THE LINK NAME. IT NEVER CHANGES, SO IT CAN GO ON NFC TAGS AND POSTERS.', required: true },
  {
    target: 'form .btn',
    text: () =>
      document.querySelector('form .btn')?.textContent?.includes('CONNECT')
        ? 'FINALLY, CONNECT THE SPOTIFY ACCOUNT THAT PLAYS YOUR SPEAKERS.'
        : 'ONCE SPOTIFY IS CONNECTED, START THE HIJACK.',
  },
  { target: '.setup-link', text: 'THIS IS YOUR LINK. IT NEVER CHANGES, SO WRITE IT TO TAGS ONCE.', look: true },
  { target: '.setup-qr', text: 'ANY PHONE CAMERA CAN SCAN THIS CODE, FOR GUESTS WITHOUT NFC.', look: true },
  { target: '.setup-nfc', text: 'WRITE THE LINK TO AN NFC TAG HERE. ONCE WRITTEN, ANYONE WHO TAPS THEIR PHONE ON IT JOINS.', look: true },
  { target: '.setup-poster', text: 'PRINT A POSTER WITH THE CODE FOR THE BAR.', look: true },
  { target: '.setup-enter', text: 'NOW OPEN THE HIJACK SCREEN TO SEE IT IN ACTION.', skipTo: 'hijack' },
]

export const tour: Record<Role, Partial<Record<Stage, Prompt[]>>> = {
  host: {
    home: [
      // what the crew adds comes first and the form opens after it: the choice made here is the one the rest of the
      // tutorial follows (see 'create-room' in backend.ts)
      { target: '.choices', text: 'FIRST, CHOOSE WHAT YOUR CREW WILL ADD: AUDIO OR VIDEO. THE REST OF THE TUTORIAL FOLLOWS YOUR CHOICE.' },
      { target: 'form label.field:nth-of-type(1) input', text: 'NEXT, ENTER YOUR NAME SO YOUR CREW KNOWS WHO YOU ARE.' },
      { target: 'form label.field:nth-of-type(2) input', text: () => `THEN, ENTER A THEME FOR WHAT KINDS OF ${picked()} YOU WANT.` },
      // only audio makes a playlist, so only audio has a name to give it
      { target: 'form label.field:nth-of-type(3) input', text: 'NEXT, GIVE THE PLAYLIST A DOPE NAME BASED OFF THAT THEME.', required: true, skip: () => !document.querySelector('form label.field:nth-of-type(3) input') },
      {
        target: 'form .btn',
        // the same button connects Spotify first, then publishes the playlist
        // (a video experiment has no playlist, so its button starts the experiment straight away)
        text: () =>
          document.querySelector('form .btn')?.textContent?.includes('CONNECT')
            ? "FINALLY, AS A HOST YOU NEED TO AUTHENTICATE WITH SPOTIFY TO CREATE THE PLAYLIST (DON'T WORRY, IT'S SAFER THAN ANYTHING YOU'VE DONE LATELY)."
            : sessionStorage.getItem(spotifyKey) !== null
              ? 'ONCE AUTHENTICATED, CLICK THIS BUTTON TO PUBLISH THE PLAYLIST SO PEOPLE CAN SUBMIT SONGS.'
              : 'FINALLY, CLICK THIS BUTTON TO START THE EXPERIMENT SO PEOPLE CAN SUBMIT VIDEOS.',
      },
    ],
    submit: [
      search((w) => `FIRST, SEARCH FOR THE ${w.NOUN} YOU WANT TO ADD TO THE EXPERIMENT.`),
      addSong,
      // the invite sits at the bottom, just above the button that waits on the crew
      { target: '.btn.ghost.plain', text: 'THEN, SHARE THIS INVITE LINK WITH YOUR CREW SO THEY CAN JOIN.', look: true },
      { target: 'button.btn:not(.ghost):not([disabled])', text: () => `ONCE EVERYONE YOU SHARED THE LINK WITH HAS ADDED THEIR ${words().NOUNS}, CLICK THIS BUTTON TO BEGIN THE EXPERIMENT.` },
    ],
    guess,
    results,
    // the host also keeps the speaker fed: they can push a track to the front, remove one, or freeze new ones
    hijack: [...hijackIntro, ...hijackHost, ...hijackBody],
    setup,
  },
  guest: {
    invite: [
      { target: '.panel.framed', text: () => `THIS IS THE THEME YOUR HOST PICKED FOR THE ${words().NOUNS}.`, look: true },
      { target: '.panel.stack', text: 'THESE ARE THE STEPS, FROM JOINING TO SEEING WHO WON.', look: true },
      { target: 'form input', text: 'FIRST, ENTER YOUR NAME SO THE CREW KNOWS WHO YOU ARE.' },
      { target: 'form .btn', text: () => `NEXT, JOIN THE EXPERIMENT SO YOU CAN ADD YOUR ${words().NOUN}.` },
    ],
    submit: [
      search((w) => `FIRST, SEARCH FOR A ${w.NOUN} THAT FITS THE THEME.`),
      addSong,
      { target: 'p.center.good', text: "FINALLY, THIS IS WHERE YOU WAIT FOR THE HOST TO BEGIN THE EXPERIMENT (WE'LL SKIP AHEAD FOR THIS TUTORIAL).", look: true, skipTo: 'guess' },
    ],
    guess,
    results,
    hijack: [...hijackIntro, ...hijackBody],
    // a guest arriving from the link, a tag or the QR code: the page they land on, then they are in
    join: [
      { target: '.panel.framed', text: "THIS IS THE HIJACK YOU'VE BEEN INVITED TO. YOU GOT HERE FROM A LINK, AN NFC TAG OR A QR CODE.", look: true },
      { target: '.hijack-playing', text: 'YOU CAN SEE WHAT IS PLAYING RIGHT NOW, BEFORE YOU EVEN JOIN.', look: true },
      { target: '.hijack-as', text: "YOU'LL APPEAR TO THE CREW UNDER THIS NAME. NO TYPING NEEDED, BUT TAP CHANGE IF YOU WANT YOUR OWN.", look: true },
      { target: 'form .btn', text: "TAP JOIN. YOU'LL LAND ON THE LIVE SCREEN WITH THE SEARCH ALREADY OPEN." },
    ],
  },
}
