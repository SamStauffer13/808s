// The wizard's script: for each stage, the things to touch in order, one sentence each. `target` is a CSS selector for
// the real element on that screen (Wizard.svelte lights it up), so a screen that changes its markup must update it here.
import type { Stage } from '../lib/practice.svelte'

// what the card calls each stage (the order is not a count: a real game has many more taps than six)
export const titles: Record<Stage, string> = {
  home: 'START A GAME',
  submit: 'ADD SONGS',
  guess: 'GUESS',
  results: 'RESULTS',
}

// Each prompt is one friendly sentence in order (First, Next, Then, Finally) saying what its thing is for. A text box is done when NEXT (or Return) is pressed with something typed in it; anything else, when it is tapped.
// `look`: something to read, not use: the card has a GOT IT button, and the thing itself can still be played with
// `final`: the last prompt of practice; finishing it opens the YOU'RE READY card
// `again`: after this prompt is done, go back to prompt number `to` while something matching `while` is still on the screen
// `when`: the prompt is done as soon as something matching this shows up (search results appear while you type)
// `required`: practice will not let the form go on until this box is filled, even if the real one allows it
export type Prompt = { target: string; text: string; look?: boolean; final?: boolean; again?: { to: number; while: string }; when?: string; required?: boolean }

export const tour: Record<Stage, Prompt[]> = {
  home: [
    { target: 'form label.field:nth-of-type(1) input', text: 'ENTER YOUR NAME SO YOUR CREW KNOWS WHO YOU ARE.' },
    { target: 'form label.field:nth-of-type(2) input', text: 'FIRST, ENTER A THEME FOR WHAT KINDS OF SONGS YOU WANT.' },
    { target: 'form label.field:nth-of-type(3) input', text: 'NEXT, GIVE THE PLAYLIST A DOPE NAME BASED OFF THAT THEME.', required: true },
    { target: 'form .btn', text: "FINALLY, AS A HOST YOU NEED TO AUTHENTICATE WITH SPOTIFY TO CREATE THE PLAYLIST (DON'T WORRY, IT'S SAFER THAN ANYTHING YOU'VE DONE LATELY)." },
  ],
  submit: [
    { target: '.panel.stack', text: 'AFTER YOU CREATE A GAME, SEND THE INVITE LINK TO YOUR CREW AND WATCH THIS CHECKLIST FILL IN.', look: true },
    { target: 'label.field input', text: 'FIRST, SEARCH FOR THE SONG YOU WANT TO ADD TO THE GAME.', when: 'button.row:not([disabled])' },
    { target: 'button.row:not([disabled])', text: 'NEXT, TAP YOUR SONG TO ADD IT; NOBODY SEES WHO ADDED WHAT UNTIL THE REVEAL.' },
    { target: 'button.btn:not(.ghost):not([disabled])', text: 'ONCE EVERYONE YOU SHARED THE LINK WITH HAS ADDED THEIR SONGS, CLICK THIS BUTTON TO BEGIN THE EXPERIMENT.' },
  ],
  guess: [
    { target: '.framed', text: "FIRST, LISTEN TO EVERYONE'S SONGS, SHUFFLED TOGETHER.", look: true },
    { target: '.panel button.row:not(.on)', text: 'NEXT, PICK A SONG TO GUESS WHICH CREW MEMBER ADDED IT.' },
    { target: '.chips', text: 'THEN, CHOOSE THE CREW MEMBER YOU THINK ADDED IT.', again: { to: 1, while: '.panel button.row:not(.on)' } },
  ],
  results: [
    { target: '.panel.framed', text: "HERE'S WHO WON, BASED ON THE MOST RIGHT GUESSES.", look: true },
    { target: '.chart', text: 'THIS SHOWS HOW MANY PEOPLE GOT EACH SONG RIGHT.', look: true },
    { target: '.pager .btn:last-child', text: 'NEXT, STEP THROUGH EVERY SONG TO SEE WHO ADDED IT AND HOW EVERYONE GUESSED.' },
    { target: 'a.btn', text: 'FINALLY, START A REAL GAME OF YOUR OWN.', final: true },
  ],
}
