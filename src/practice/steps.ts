// The wizard's script: for each stage, the things to touch in order, one sentence each. `target` is a CSS selector for
// the real element on that screen (Wizard.svelte lights it up), so a screen that changes its markup must update it here.
import type { Stage } from '../lib/practice.svelte'

// what the card calls each stage (the order is not a count: a real game has many more taps than six)
export const titles: Record<Stage, string> = {
  home: 'START A GAME',
  invite: 'FRIENDS JOIN',
  submit: 'ADD SONGS',
  guess: 'GUESS',
  reveal: 'THE REVEAL',
  results: 'RESULTS',
}

// Each prompt is one friendly sentence in order (First, Next, Then, Finally) saying what its thing is for. A text box is done when NEXT (or Return) is pressed with something typed in it; anything else, when it is tapped.
// `look`: something to read, not use: the card has a GOT IT button, and the thing itself can still be played with
// `stage`: which stage the card names, when it is not the one the screen is in (the reveal runs on into the results)
// `final`: the last prompt of practice; finishing it opens the YOU'RE READY card
// `again`: after this prompt is done, go back to prompt number `to` while something matching `while` is still on the screen
// `gone`: the prompt is done when its target leaves the screen (the reveal turns into the results on the same screen)
// `when`: the prompt is done as soon as something matching this shows up (search results appear while you type)
// `required`: practice will not let the form go on until this box is filled, even if the real one allows it
export type Prompt = { target: string; text: string; stage?: Stage; look?: boolean; final?: boolean; again?: { to: number; while: string }; gone?: boolean; when?: string; required?: boolean }

const results: Prompt[] = [
  { target: '.panel.framed', text: "HERE'S WHO WON, BASED ON THE MOST RIGHT GUESSES.", look: true },
  { target: '.chart', text: 'THIS SHOWS HOW MANY PEOPLE GOT EACH SONG RIGHT.', look: true },
  { target: '.pager .btn:last-child', text: 'NEXT, STEP THROUGH EVERY SONG TO SEE WHO GUESSED RIGHT.' },
  { target: 'a.btn', text: 'FINALLY, START A REAL GAME OF YOUR OWN.', final: true },
].map((prompt) => ({ ...prompt, stage: 'results' as const }))

export const tour: Record<Stage, Prompt[]> = {
  home: [
    { target: 'form label.field:nth-of-type(1) input', text: 'ENTER YOUR NAME SO YOUR FRIENDS KNOW WHO YOU ARE.' },
    { target: 'form label.field:nth-of-type(2) input', text: 'FIRST, ENTER A THEME FOR WHAT KINDS OF SONGS YOU WANT.' },
    { target: 'form label.field:nth-of-type(3) input', text: 'NEXT, GIVE THE PLAYLIST A DOPE NAME BASED OFF THAT THEME.', required: true },
    { target: 'form .btn', text: "FINALLY, AS A HOST YOU NEED TO AUTHENTICATE WITH SPOTIFY TO CREATE THE PLAYLIST (DON'T WORRY, IT'S SAFER THAN ANYTHING YOU'VE DONE LATELY)." },
  ],
  invite: [
    { target: '.panel.framed', text: 'THIS IS THE INVITE YOUR FRIENDS SEE WHEN THEY OPEN YOUR LINK.', look: true },
    { target: 'form input', text: 'FIRST, ENTER YOUR NAME SO THE OTHER PLAYERS KNOW WHO YOU ARE.' },
    { target: 'form .btn', text: 'THEN, JOIN THE GAME SO YOU CAN ADD YOUR SONG.' },
  ],
  submit: [
    { target: 'label.field input', text: 'FIRST, SEARCH FOR THE SONG YOU WANT TO ADD TO THE GAME.', when: 'button.row:not([disabled])' },
    { target: 'button.row:not([disabled])', text: 'NEXT, TAP YOUR SONG TO ADD IT; NOBODY SEES WHO ADDED WHAT UNTIL THE REVEAL.' },
    { target: 'button.btn:not(.ghost):not([disabled])', text: 'FINALLY, WAIT UNTIL EVERYONE YOU SHARED THE LINK WITH HAS ADDED THEIR SONGS, THEN BEGIN THE EXPERIMENT TO START THE GUESSING.' },
  ],
  guess: [
    { target: '.framed', text: "FIRST, LISTEN TO EVERYONE'S SONGS, SHUFFLED TOGETHER.", look: true },
    { target: '.panel button.row:not(.on)', text: 'NEXT, PICK A SONG TO GUESS WHICH FRIEND ADDED IT.' },
    { target: '.chips', text: 'THEN, CHOOSE THE FRIEND YOU THINK ADDED IT.', again: { to: 1, while: '.panel button.row:not(.on)' } },
  ],
  reveal: [
    { target: '.panel.framed', text: "HERE'S WHO REALLY ADDED THAT SONG.", look: true },
    { target: '.guesses', text: "AND HERE'S HOW EVERYONE GUESSED, ✓ RIGHT AND ✗ WRONG.", look: true },
    { target: '.dock .btn:last-child', text: 'NEXT, MOVE ON TO THE REVEAL FOR THE NEXT SONG.', gone: true },
    ...results, // finishing the reveal opens the results without leaving this screen
  ],
  results,
}
