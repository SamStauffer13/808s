// The wizard's script: for each journey and stage, the things to touch in order, one sentence each. `target` is a CSS
// selector for the real element on that screen (Wizard.svelte lights it up), so a screen that changes its markup must
// update it here.
import { spotifyKey, type Role, type Stage } from '../lib/practice.svelte'

// what the card calls each stage (the order is not a count: a real game has many more taps than five)
export const titles: Record<Stage, string> = {
  home: 'START AN EXPERIMENT',
  invite: 'JOIN THE EXPERIMENT',
  submit: 'ADD SONGS',
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
export type Prompt = { target: string; text: string | (() => string); look?: boolean; skipTo?: Stage; final?: boolean; again?: { to: number; while: string }; when?: string; required?: boolean }

const search = (text: string): Prompt => ({ target: 'label.field input', text, when: 'button.row:not([disabled])' })
const addSong: Prompt = { target: 'button.row:not([disabled])', text: 'NEXT, TAP YOUR SONG TO ADD IT; NOBODY SEES WHO ADDED WHAT UNTIL THE RESULTS.' }

// the same for everyone once the guessing starts
const guess: Prompt[] = [
  { target: '.framed', text: "FIRST, LISTEN TO EVERYONE'S SONGS, SHUFFLED TOGETHER.", look: true },
  { target: '.panel button.row:not(.on)', text: 'NEXT, PICK A SONG TO GUESS WHICH CREW MEMBER ADDED IT.' },
  { target: '.chips', text: 'THEN, CHOOSE THE CREW MEMBER YOU THINK ADDED IT.', again: { to: 1, while: '.panel button.row:not(.on)' } },
]
const results: Prompt[] = [
  { target: '.panel.framed', text: "HERE'S WHO WON, BASED ON THE MOST RIGHT GUESSES.", look: true },
  { target: '.report', text: 'THIS IS YOUR REPORT: THE SONGS YOU CRACKED AND THE ONES THAT FOOLED YOU.', look: true },
  { target: '.awards', text: 'AND THE CREW AWARDS FOR THE BEST AND WORST GUESSES.', look: true },
  { target: '.chart', text: 'THIS SHOWS HOW OFTEN EACH PERSON WAS GUESSED RIGHT, MOST GUESSED ON TOP, WITH STAMPS FOR THE EXTREMES.', look: true },
  { target: '.pager .btn:last-child', text: 'NEXT, STEP THROUGH EVERY SONG TO SEE WHO ADDED IT AND HOW EVERYONE GUESSED.' },
  { target: 'a.btn', text: 'FINALLY, START A REAL EXPERIMENT OF YOUR OWN.', final: true },
]

export const tour: Record<Role, Partial<Record<Stage, Prompt[]>>> = {
  host: {
    home: [
      { target: 'form label.field:nth-of-type(1) input', text: 'ENTER YOUR NAME SO YOUR CREW KNOWS WHO YOU ARE.' },
      { target: 'form label.field:nth-of-type(2) input', text: 'FIRST, ENTER A THEME FOR WHAT KINDS OF SONGS YOU WANT.' },
      { target: 'form label.field:nth-of-type(3) input', text: 'NEXT, GIVE THE PLAYLIST A DOPE NAME BASED OFF THAT THEME.', required: true },
      {
        target: 'form .btn',
        // the same button connects Spotify first, then publishes the playlist
        text: () =>
          sessionStorage.getItem(spotifyKey) !== null
            ? 'ONCE AUTHENTICATED, CLICK THIS BUTTON TO PUBLISH THE PLAYLIST SO PEOPLE CAN SUBMIT SONGS.'
            : "FINALLY, AS A HOST YOU NEED TO AUTHENTICATE WITH SPOTIFY TO CREATE THE PLAYLIST (DON'T WORRY, IT'S SAFER THAN ANYTHING YOU'VE DONE LATELY).",
      },
    ],
    submit: [
      { target: '.btn.ghost.plain', text: 'SHARE THIS INVITE LINK WITH YOUR CREW SO THEY CAN JOIN.', look: true },
      search('FIRST, SEARCH FOR THE SONG YOU WANT TO ADD TO THE EXPERIMENT.'),
      addSong,
      { target: 'button.btn:not(.ghost):not([disabled])', text: 'ONCE EVERYONE YOU SHARED THE LINK WITH HAS ADDED THEIR SONGS, CLICK THIS BUTTON TO BEGIN THE EXPERIMENT.' },
    ],
    guess,
    results,
  },
  guest: {
    invite: [
      { target: '.panel.framed', text: 'THIS IS THE THEME YOUR HOST PICKED FOR THE SONGS.', look: true },
      { target: '.panel.stack', text: 'THESE ARE THE STEPS, FROM JOINING TO SEEING WHO WON.', look: true },
      { target: 'form input', text: 'FIRST, ENTER YOUR NAME SO THE CREW KNOWS WHO YOU ARE.' },
      { target: 'form .btn', text: 'NEXT, JOIN THE EXPERIMENT SO YOU CAN ADD YOUR SONG.' },
    ],
    submit: [
      search('FIRST, SEARCH FOR A SONG THAT FITS THE THEME.'),
      addSong,
      { target: 'p.center.good', text: "FINALLY, THIS IS WHERE YOU WAIT FOR THE HOST TO BEGIN THE EXPERIMENT (WE'LL SKIP AHEAD FOR THIS TUTORIAL).", look: true, skipTo: 'guess' },
    ],
    guess,
    results,
  },
}
