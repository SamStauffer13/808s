# Text notifications (Twilio)

Plan for texting players when a game moves between phases. Nothing here is built yet. Prices and API details are from
memory: check Twilio's current docs and pricing before relying on them.

## Why SMS, and why Twilio

- The players are mostly iPhone users who are not comfortable with technology. Anything that needs an install or an
  account (web push, Telegram, Discord, Slack) is out. Facebook, Instagram and Snapchat have no way for an app to post
  to a group chat or message a user who has not set up a relationship with the app first.
- A plain text works for everyone, with nothing to install.
- **Do not use a personal phone as the sender for a public app.** It exposes your number to strangers, makes you the
  target of abuse and spam reports, risks the carrier flagging the line, and Android throttles app-sent SMS (roughly
  30 per 30 minutes before it prompts; verify). It is fine only for a friends-only test.
- **Twilio** gives a separate sender number, registered traffic, automatic STOP handling and no phone to keep charged.
  It is not free in production (roughly $3 to $6 a month at low volume), but it has a free trial for building.

## Twilio free trial

- About $15 of credit (verify), plus a free number to send from.
- **Only numbers you have verified in the Twilio console can receive texts.** Realistically that is you and a few
  friends. Each message starts with "Sent from your Twilio trial account".
- Credit is not the limit. At roughly $0.012 to $0.013 per text, about 1,100 texts:
  - 4 verified players, 2 texts each: about 140 games.
  - 8 verified players, 2 texts each: about 70 games.
  - Twilio Verify costs about $0.05 per check, so using our own codes is roughly 4x cheaper per verification.
- Going public needs the paid upgrade and A2P 10DLC (or toll-free) registration. That takes days to weeks and costs a
  little, so start it early if a launch is planned.
- Put the UI behind `VITE_SMS_ENABLED` and the server behind `SMS_ENABLED` so public players see nothing until the
  account is live. Add a test mode that logs messages instead of sending them, so the flow can be exercised without
  spending credit.

## What gets texted

Fixed templates only. No user-typed text (the room theme is host-written, so it is left out) and nothing that hints at
who added which song.

| When | Text |
|---|---|
| Opt-in confirmed | `808s: you're in. We'll text you when it's your move. Reply STOP to stop.` |
| Guessing opens | `808s: the playlist is ready. Come guess who added what: <link> Reply STOP to stop.` (include `playlist_url`) |
| Reveal opens | `808s: everyone's guessed. The reveal is open: <link>` |
| After the reveal (optional) | `808s: save the playlist: <link>` |

No text on join or during submit.

## How the app asks

Ask after joining, not during. Joining stays one field (name). The ask is a small card on the Submit screen, above the
song slots, optional and skippable:

```
/// SIGNAL BOOSTER (optional)
THE EXPERIMENT HAS A BOTTLENECK.
/// NOBODY CHECKS THEIR APPS. EVERYBODY CHECKS THEIR TEXTS.
[ (555) 123-4567 ]   [ TEXT ME ]
/// ABOUT 2 TEXTS A GAME · NO SPAM · NUMBER NEVER SHARED · REPLY STOP ANYTIME
                      [ I'LL REMEMBER (I WON'T) ]
```

Flow:

1. **Number:** `input type="tel" autocomplete="tel"`, formatted as they type. US numbers only at first.
2. **Consent** sits directly under the button, so tapping TEXT ME counts as agreeing:
   "By tapping TEXT ME you agree to get 808s texts about this game at this number, about 2 per game. Msg & data rates
   may apply. Reply STOP to cancel."
3. **Code:** "CHECK YOUR TEXTS. YES, ACTUALLY CHECK THEM." A 6-digit field with `autocomplete="one-time-code"` so iPhone
   offers the code above the keyboard.
4. **Done:** "SIGNAL LOCKED. WE'LL TEXT YOU. YOUR FRIENDS CAN STOP WAITING." An ALERTS ON/OFF toggle stays in the room.
5. **Decline:** the card collapses, the choice is remembered on that device, and it never nags again.
6. **Rejoin by name:** if the seat already has a verified number, show ON with only the last 4 digits.

Tone: keep the teasing aimed at "the group chat", not at the user or named platforms. Strangers will read this while
being asked for their number. A harsher variant can exist for a friends-only build.

## Backend

**Flow**

```
rooms.phase changes --> trigger fills sms_outbox (verified, opted-in players, deduped)
                    --> database webhook --> notify-phase Edge Function (secret header)
                                              --> sendSms() --> Twilio --> player
Player replies STOP --> Twilio --> sms-inbound Edge Function (signature checked) --> opt-out
```

The auto-reveal inside `submit_guess`, `admin-advance` and `begin_guess` all write `rooms.phase`, so one trigger covers
every path.

**Migration** (new file in `supabase/migrations`, never edit an applied one)

- `player_phones`: `player_id`, `e164`, `verified_at`, `consent_version`, `opted_out_at`. RLS enabled with no policies,
  not in the realtime publication, never selected by the client, `on delete cascade` from `players` so the existing room
  cleanup removes numbers too.
- `sms_outbox`: unique on `(room_id, player_id, kind)` so each player gets each text once even if the phase update fires
  twice. Status, attempts, sent time.
- `set_my_phone` RPC (`security definer`) that checks the caller is in the room. Numbers go in through it only.
- Trigger on `rooms.phase` that fills the outbox.
- Keep numbers out of `players`, which every room member can read.

**Edge Functions**

- `sms-send-code` and `sms-confirm`: our own codes through `sendSms()` (or Twilio Verify later). Use `currentUser`.
- `notify-phase`: called by the database webhook. Checks the `x-webhook-secret` header with the constant-time compare
  from `admin-advance`, which should move into `_shared`.
- `sms-inbound`: handles STOP and HELP. Verifies `X-Twilio-Signature`.
- `_shared/sms.ts`: `sendSms(to, body)`, the only code that knows about Twilio.

**Secrets** (Supabase only, set with `npx supabase secrets set`, typed by you, never committed or pasted into chat;
`.env` is tracked in git and is for public values only): `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`,
`TWILIO_API_KEY_SECRET` (use an API key, not the main auth token), `TWILIO_FROM`, `SMS_WEBHOOK_SECRET`, `SMS_ENABLED`.

## Safety and abuse

Anonymous sign-in means anyone can create unlimited users, so the server enforces the limits.

- Verification codes: max 3 per number per hour and 5 per day.
- A number can belong to only a few active rooms.
- A global daily send cap, plus a Twilio spending cap in the console.
- `SMS_ENABLED` kill switch; auto-pause after repeated Twilio auth failures.
- STOP honoured in our table as well as by Twilio.
- Numbers normalized to E.164, logs masked to the last 4 digits, message bodies never logged.
- Treat a failed send (including an unverified trial number) as a normal outcome that never breaks the game.
- Production needs a short privacy page and a description of the opt-in for the Twilio registration. This is not legal
  advice: check consent and opt-out rules before a public launch.

## Songs by text (later)

Not in the first release. Players would reply with a Spotify track link and an Edge Function would add it through the
same path as `add-song`, including the duplicate and per-player limits. Rules for when it is built:

- Songs added by text go into the normal submission pool and appear with everyone else's at the guess phase.
- Never add songs to a visible, shared playlist during submit, and never make the playlist collaborative: watching it
  would reveal who added what.
- Replies go only to the sender and never repeat a title or artist to anyone else.
- Support Spotify track URLs only at first; anything else gets "Send me a Spotify song link."
- Rate-limit it like outbound sends.

## Build order

1. Sign up for the Twilio trial and verify your own number (you).
2. Migration and RLS, with a test that no other player can read a number.
3. Edge Functions, tested with curl against your own number.
4. The Submit-screen card and the ALERTS toggle.
5. Demo support: `src/demo/backend.ts` needs fake handlers (the demo must never text anyone), `src/demo/stages.ts`
   needs a prompt that points at the card, and the demo's screens must stay in step (see README).
6. README: add the new secrets and functions to the lists.
7. Two-browser test with real texts to verified numbers: opt in, guess, reveal, STOP, a duplicate phase update, and the
   room-cleanup deletion.
8. Later, if public: upgrade, register, set spending limits, flip the flags.

## Open decisions

1. Copy tone: in-character as above, or harsher for a friends build?
2. Verification: our own codes (cheaper) or Twilio Verify?
3. Card location: Submit screen only, or the Invite page too?
4. Songs by text: first release or follow-up? (Recommended: follow-up.)
