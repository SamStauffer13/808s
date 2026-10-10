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

// A prompt on a text box is done when the box has been filled in and left; on anything else, when it is tapped.
// `look`: something to read, not use: the card has a GOT IT button, and the thing itself is left alone
// `stage`: which stage the card names, when it is not the one the screen is in (the reveal runs on into the results)
// `final`: the last prompt of practice; finishing it opens the YOU'RE READY card
// `again`: after this prompt is done, go back to prompt number `to` while something matching `while` is still on the screen
// `gone`: the prompt is done when its target leaves the screen (the reveal turns into the results on the same screen)
// `when`: the prompt is done as soon as something matching this shows up (search results appear while you type)
// `required`: practice will not let the form go on until this box is filled, even if the real one allows it
export type Prompt = { target: string; text: string; stage?: Stage; look?: boolean; final?: boolean; again?: { to: number; while: string }; gone?: boolean; when?: string; required?: boolean }

const results: Prompt[] = [
  { target: '.panel.framed', text: 'SEE WHO WON THE ROUND.', look: true },
  { target: '.chart', text: 'TAP A BAR TO OPEN THAT SONG.' },
  { target: '.pager .btn:last-child', text: 'TAP NEXT TO STEP THROUGH EVERY SONG.' },
  { target: 'a.btn', text: 'TAP HERE TO START YOUR OWN GAME.', final: true },
].map((prompt) => ({ ...prompt, stage: 'results' as const }))

export const tour: Record<Stage, Prompt[]> = {
  home: [
    { target: 'form label.field:nth-of-type(1) input', text: 'ENTER YOUR NAME, THEN TAP OUTSIDE THE BOX.' },
    { target: 'form label.field:nth-of-type(2) input', text: 'DESCRIBE THE KIND OF SONGS TO ADD, THEN TAP OUTSIDE THE BOX.' },
    { target: 'form label.field:nth-of-type(3) input', text: 'NAME YOUR PLAYLIST, THEN TAP OUTSIDE THE BOX.', required: true },
    { target: 'form .btn', text: 'TAP THE GREEN BUTTON TO CONNECT SPOTIFY, THEN TAP IT AGAIN TO CREATE THE GAME.' },
  ],
  invite: [
    { target: '.panel.framed', text: 'THIS IS WHAT YOUR FRIENDS SEE WHEN THEY OPEN YOUR LINK.', look: true },
    { target: 'form input', text: 'ENTER YOUR NAME, THEN TAP OUTSIDE THE BOX.' },
    { target: 'form .btn', text: 'TAP JOIN TO PICK YOUR SONGS.' },
  ],
  submit: [
    { target: 'label.field input', text: 'SEARCH FOR YOUR SONG, ANY WORD WORKS HERE.', when: 'button.row:not([disabled])' },
    { target: 'button.row:not([disabled])', text: 'TAP A SONG TO ADD IT.' },
    { target: 'button.btn:not(.ghost):not([disabled])', text: 'TAP BEGIN THE EXPERIMENT TO START THE GUESSING.' },
  ],
  guess: [
    { target: '.framed', text: 'LISTEN TO THE SHUFFLED PLAYLIST, OR SKIP AHEAD.', look: true },
    { target: '.panel button.row:not(.on)', text: 'TAP A SONG TO GUESS WHO ADDED IT.' },
    { target: '.chips', text: 'PICK THE FRIEND YOU THINK ADDED THAT SONG.', again: { to: 1, while: '.panel button.row:not(.on)' } },
  ],
  reveal: [
    { target: '.panel.framed', text: 'THIS IS WHO REALLY ADDED THAT SONG.', look: true },
    { target: '.guesses', text: 'THESE ARE EVERYONE\'S GUESSES, ✓ RIGHT AND ✗ WRONG.', look: true },
    { target: '.dock .btn:last-child', text: 'TAP NEXT SOURCE TO STEP THROUGH EVERY SONG.', gone: true },
    ...results, // finishing the reveal opens the results without leaving this screen
  ],
  results,
}
