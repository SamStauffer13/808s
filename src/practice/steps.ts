// The wizard's script: for each journey and stage, the things to touch in order, one sentence each. `target` is a CSS
// selector for the real element on that screen (Wizard.svelte lights it up), so a screen that changes its markup must
// update it here. The words follow the kind being practiced (songs or movies), so both rounds read the same way.
import { kinds, type Kind } from '../lib/kinds'
import { spotifyKey, type Role, type Stage } from '../lib/practice.svelte'
import { badges, stamps } from '../lib/stamps'

// what the card calls each stage (the order is not a count: a real game has many more taps than five)
export const titles = (kind: Kind): Record<Stage, string> => ({
  home: 'START AN EXPERIMENT',
  invite: 'JOIN THE EXPERIMENT',
  submit: `ADD ${kinds[kind].nouns.toUpperCase()}`,
  guess: 'GUESS',
  results: 'RESULTS',
})

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

export const tour = (kind: Kind): Record<Role, Partial<Record<Stage, Prompt[]>>> => {
  const w = kinds[kind]
  const noun = w.noun.toUpperCase()
  const nouns = w.nouns.toUpperCase()

  const addSong: Prompt = { target: 'button.row:not([disabled])', text: `NEXT, TAP YOUR ${noun} TO ADD IT; NOBODY SEES WHO ADDED WHAT UNTIL THE RESULTS.` }

  // the same for everyone once the guessing starts
  const guess: Prompt[] = [
    { target: '.panel button.row:not(.on)', text: `FIRST, PICK A ${noun} TO GUESS WHICH CREW MEMBER ADDED IT. EACH PERSON ADDED ONE SET, SO EACH NAME GOES ON A DIFFERENT SET: THE LIST ABOVE SHOWS WHO IS LEFT.` },
    { target: '.chips', text: 'THEN, CHOOSE THE CREW MEMBER YOU THINK ADDED IT.', again: { to: 0, while: '.panel button.row:not(.on)' } },
  ]
  const results: Prompt[] = [
    { target: '.panel.framed', text: "HERE'S WHO WON, BASED ON THE MOST RIGHT GUESSES.", look: true },
    { target: '.board', text: `NEXT, EVERYONE'S SCORE: HOW MANY OF THE OTHER PLAYERS' ${nouns} THEY MATCHED RIGHT.`, look: true },
    { target: '.awards', text: `THEN THE AWARDS: ${badges.worst} FOR THE WORST GUESSER AND ${badges.blamed} FOR WHOEVER GOT BLAMED THE MOST. ${badges.twins} MARKS THE TWO PEOPLE WHOSE ${nouns} SHARE THE MOST GENRES.`, look: true },
    { target: '.subnets', text: `SUBNETS GROUP THE CREW BY THE GENRE THEIR ${nouns} LEAN ON MOST. ${badges.airGapped} IS ANYONE WITH NO MATCH.`, look: true },
    { target: '.files-toggle', text: 'THE FILES ARE TUCKED AWAY. TAP TO OPEN THEM.', when: '.file' },
    { target: '.file', text: `EACH FILE IS ONE PERSON'S ${nouns}, WHO ADDED THEM AND WHAT PERCENT OF THE CREW GUESSED THEM. A STAMP LIKE ${stamps[0]} FLAGS THE EXTREMES.`, look: true },
    { target: '.file .head', text: 'FINALLY, TAP A FILE TO SEE EXACTLY WHO GUESSED WHAT.', when: '.file.open' },
    { target: 'a.btn', text: 'NOW START A REAL EXPERIMENT OF YOUR OWN.', final: true },
  ]

  // songs publish a playlist in the host's Spotify, so the button first connects it; movies have no playlist to make
  const publish: Prompt =
    kind === 'music'
      ? {
          target: 'form .btn',
          // the same button connects Spotify first, then publishes the playlist
          text: () =>
            sessionStorage.getItem(spotifyKey) !== null
              ? 'ONCE AUTHENTICATED, CLICK THIS BUTTON TO PUBLISH THE PLAYLIST SO PEOPLE CAN SUBMIT SONGS.'
              : "FINALLY, AS A HOST YOU NEED TO AUTHENTICATE WITH SPOTIFY TO CREATE THE PLAYLIST (DON'T WORRY, IT'S SAFER THAN ANYTHING YOU'VE DONE LATELY).",
        }
      : { target: 'form .btn', text: 'FINALLY, CLICK THIS BUTTON TO OPEN THE EXPERIMENT SO PEOPLE CAN SUBMIT MOVIES. NO LOGIN NEEDED: THE LINEUP IS BUILT RIGHT IN THE APP.' }

  return {
    host: {
      home: [
        // the movie round is a preview, and says so; tapping either one carries on, with the rest of the tour following it
        { target: '.kind-toggle', text: 'PICK WHAT YOUR CREW WILL ADD: AUDIO (SONGS), OR VIDEO (MOVIES, A PREVIEW OF WHAT IS COMING).' },
        { target: 'form label.field:nth-of-type(1) input', text: 'ENTER YOUR NAME SO YOUR CREW KNOWS WHO YOU ARE.' },
        { target: 'form label.field:nth-of-type(2) input', text: `FIRST, ENTER A THEME FOR WHAT KINDS OF ${nouns} YOU WANT.` },
        ...(kind === 'music' ? [{ target: 'form label.field:nth-of-type(3) input', text: 'NEXT, GIVE THE PLAYLIST A DOPE NAME BASED OFF THAT THEME.', required: true }] : []),
        publish,
      ],
      submit: [
        { target: '.btn.ghost.plain', text: 'SHARE THIS INVITE LINK WITH YOUR CREW SO THEY CAN JOIN.', look: true },
        search(`FIRST, SEARCH FOR THE ${noun} YOU WANT TO ADD TO THE EXPERIMENT.`),
        addSong,
        { target: 'button.btn:not(.ghost):not([disabled])', text: `ONCE EVERYONE YOU SHARED THE LINK WITH HAS ADDED THEIR ${nouns}, CLICK THIS BUTTON TO BEGIN THE EXPERIMENT.` },
      ],
      guess,
      results,
    },
    guest: {
      invite: [
        { target: '.panel.framed', text: `THIS IS THE THEME YOUR HOST PICKED FOR THE ${nouns}.`, look: true },
        { target: '.panel.stack', text: 'THESE ARE THE STEPS, FROM JOINING TO SEEING WHO WON.', look: true },
        { target: 'form input', text: 'FIRST, ENTER YOUR NAME SO THE CREW KNOWS WHO YOU ARE.' },
        { target: 'form .btn', text: `NEXT, JOIN THE EXPERIMENT SO YOU CAN ADD YOUR ${noun}.` },
      ],
      submit: [
        search(`FIRST, SEARCH FOR A ${noun} THAT FITS THE THEME.`),
        addSong,
        { target: 'p.center.good', text: "FINALLY, THIS IS WHERE YOU WAIT FOR THE HOST TO BEGIN THE EXPERIMENT (WE'LL SKIP AHEAD FOR THIS TUTORIAL).", look: true, skipTo: 'guess' },
      ],
      guess,
      results,
    },
  }
}
