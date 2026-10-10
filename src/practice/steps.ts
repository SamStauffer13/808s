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

// Each prompt says what its thing is for, not how to use it. A text box is done when NEXT (or Return) is pressed with something typed in it; anything else, when it is tapped.
// `look`: something to read, not use: the card has a GOT IT button, and the thing itself can still be played with
// `stage`: which stage the card names, when it is not the one the screen is in (the reveal runs on into the results)
// `final`: the last prompt of practice; finishing it opens the YOU'RE READY card
// `again`: after this prompt is done, go back to prompt number `to` while something matching `while` is still on the screen
// `gone`: the prompt is done when its target leaves the screen (the reveal turns into the results on the same screen)
// `when`: the prompt is done as soon as something matching this shows up (search results appear while you type)
// `required`: practice will not let the form go on until this box is filled, even if the real one allows it
export type Prompt = { target: string; text: string; stage?: Stage; look?: boolean; final?: boolean; again?: { to: number; while: string }; gone?: boolean; when?: string; required?: boolean }

const results: Prompt[] = [
  { target: '.panel.framed', text: 'WHO WON, BASED ON THE MOST RIGHT GUESSES.', look: true },
  { target: '.chart', text: 'HOW MANY PEOPLE GOT EACH SONG RIGHT.', look: true },
  { target: '.pager .btn:last-child', text: 'STEPS THROUGH EVERY SONG TO SEE WHO GUESSED RIGHT.' },
  { target: 'a.btn', text: 'STARTS A REAL GAME OF YOUR OWN.', final: true },
].map((prompt) => ({ ...prompt, stage: 'results' as const }))

export const tour: Record<Stage, Prompt[]> = {
  home: [
    { target: 'form label.field:nth-of-type(1) input', text: 'YOUR NAME, AS YOUR FRIENDS WILL SEE IT.' },
    { target: 'form label.field:nth-of-type(2) input', text: 'THE THEME THAT TELLS EVERYONE WHAT KIND OF SONGS TO ADD.' },
    { target: 'form label.field:nth-of-type(3) input', text: 'THE TITLE OF THE SPOTIFY PLAYLIST THIS GAME WILL BUILD.', required: true },
    { target: 'form .btn', text: 'CONNECTS YOUR SPOTIFY SO THE PLAYLIST CAN BE MADE THERE, THEN CREATES THE GAME.' },
  ],
  invite: [
    { target: '.panel.framed', text: 'THE INVITE YOUR FRIENDS SEE WHEN THEY OPEN YOUR LINK.', look: true },
    { target: 'form input', text: 'YOUR NAME, AS THE OTHER PLAYERS WILL SEE IT.' },
    { target: 'form .btn', text: 'JOINS THE GAME SO YOU CAN ADD YOUR SONG.' },
  ],
  submit: [
    { target: 'label.field input', text: 'SEARCH FOR THE SONG YOU WANT TO ADD TO THE GAME.', when: 'button.row:not([disabled])' },
    { target: 'button.row:not([disabled])', text: 'ADDS THAT SONG, AND NOBODY SEES WHO ADDED IT UNTIL THE REVEAL.' },
    { target: 'button.btn:not(.ghost):not([disabled])', text: 'STARTS THE GUESSING ROUND ONCE EVERYONE HAS ADDED THEIR SONG.' },
  ],
  guess: [
    { target: '.framed', text: "EVERYONE'S SONGS, SHUFFLED TOGETHER, TO LISTEN TO BEFORE YOU GUESS.", look: true },
    { target: '.panel button.row:not(.on)', text: 'EACH SONG WAS ADDED BY ONE FRIEND, AND YOU GUESS WHO.' },
    { target: '.chips', text: 'YOUR GUESS FOR WHO ADDED THAT SONG.', again: { to: 1, while: '.panel button.row:not(.on)' } },
  ],
  reveal: [
    { target: '.panel.framed', text: 'WHO REALLY ADDED THAT SONG.', look: true },
    { target: '.guesses', text: "EVERYONE'S GUESSES, ✓ RIGHT AND ✗ WRONG.", look: true },
    { target: '.dock .btn:last-child', text: 'MOVES ON TO THE NEXT SONG IN THE REVEAL.', gone: true },
    ...results, // finishing the reveal opens the results without leaving this screen
  ],
  results,
}
