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
      { target: '.btn.ghost.plain', text: 'SHARE THIS INVITE LINK WITH YOUR CREW SO THEY CAN JOIN.', look: true },
      search((w) => `FIRST, SEARCH FOR THE ${w.NOUN} YOU WANT TO ADD TO THE EXPERIMENT.`),
      addSong,
      { target: 'button.btn:not(.ghost):not([disabled])', text: () => `ONCE EVERYONE YOU SHARED THE LINK WITH HAS ADDED THEIR ${words().NOUNS}, CLICK THIS BUTTON TO BEGIN THE EXPERIMENT.` },
    ],
    guess,
    results,
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
  },
}
