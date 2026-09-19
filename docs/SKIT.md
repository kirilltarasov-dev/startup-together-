# RUNWAY: Playable Skit (FROZEN 12:55 CEST)

Status: **FROZEN. User approved names, personalities, venue, numbers, voice moments, and movement.**
Do not re-litigate values during implementation. Record any forced change in `PLAN.md`.
Original source: [RUNWAY.md](../RUNWAY.md). Voice contract: [VOICE.md](VOICE.md). Visual spec: [DIRECTION.md](DIRECTION.md).

## Cast

| ID | Name | Role | Voice | Visual |
| --- | --- | --- | --- | --- |
| `kirill` | Kirill | CTO / product | Technical perfectionist. Nothing ships until it is correct. Dry, precise, allergic to shortcuts. | Tall, blue `#4F7CAC`, headphones |
| `sadman` | Sadman | Deep backend / research | Academic introvert. Speaks rarely, in exact sentences, usually about complexity or data. Deadpan. | Short/wide, amber `#E0A458`, cap, hood up |
| `sergio` | Sergio | Sales / growth / hype | Frat-bro founder energy. Oversells, overships, announces features that do not exist. Loud, joyful, dangerous. | Medium, green `#7FB069`, backwards beanie, sunglasses |

Humor comes from startup personalities and decisions, never nationality or accents.
The player controls Kirill with arrow keys / WASD; Sadman and Sergio sit at the desk and react.

## Scenes and Hotspots

| Scene | Setting | Events | Hotspots |
| --- | --- | --- | --- |
| S1 | **Puzl CowOrKing, Lajos utca 126-130, Obuda, Budapest** (loft coworking, exposed brick, Cognition/Devin hackathon banner) | E01, E02, hackathon result | Desk laptop (E01, E02), loft door (to S2) |
| S2 | Debrecen apartment | E03, E04 + real Devin mission | Kitchen laptop (E03), alarm phone (E04), door (to S3) |
| S3 | Accelerator / investor room | E05, ending | Wall screen (E05) |

Movement: arrow keys / WASD, room-bounds clamp, no physics. Only the next event's hotspot glows.
Buttons appear in the HUD when Kirill stands on the hotspot; a "Walk there" fallback button exists.

## Start State and HUD

Cash EUR 37, users 0, health 55, morale 80, ownership 100%, daily burn 0.
HUD: cash, users, health, morale, runway ("unbounded" when burn is 0).

## Opening (title cards, skippable, max 6 s)

Black. "OBUDA, BUDAPEST / SEPTEMBER 19, 2026" -> "PUZL COWORKING / COGNITION x DEVIN HACKATHON"
-> "3 FOUNDERS / EUR 37 / 1 AI ENGINEER" -> button **START RUNWAY**.
Camera reveals the loft desk, three founders, an almost empty pizza box.

Kirill: "We have thirty-seven euros and an AI engineer."
Sadman: "Thirty-seven is prime. That's the only good news."
Sergio: "Bro. Prime number. That's the brand."

## E01: What Are We Building? (VOICE MOMENT 1)

Sergio: "A social network for founders. Every post is a launch. We announce it tonight."
Kirill: "We have not written a single line."
Sadman: "Technically the feed is O(n squared). I haven't told him."

Prompt: "Say what we're building." Player speaks; the voice model (Sadman and Sergio) replies
in character (<= 2 sentences) and resolves to one choice. Buttons remain.

| Choice ID | Button | Effect | Reaction |
| --- | --- | --- | --- |
| `focused` | "Founders only" | Health +5; morale -5 | Sergio: "Small market. Huge egos. I can sell egos." |
| `broad` | "Everyone with a pitch" | Users +10; health -5 | Sadman: "Everyone. So the dataset will be noisy." |

Visual: laptop screens light up; the reacting founder leans forward.

## E02: Ship It

Sergio: "I already tweeted the launch. It's live in four hours."
Kirill: "The demo works on my laptop. That is not the same as working."
Sergio: "Then we ship your laptop."

| Choice ID | Button | Effect | Reaction |
| --- | --- | --- | --- |
| `careful` | "Test the launch" | Cash -12; health +15 | Kirill: "Twelve euros for tests. Finally, a budget line I respect." |
| `rush` | "Ship tonight" | Cash -3; users +20; health -10 | Sergio: "SHIPPED. Bugs are just features with confidence." |

Simulated decisions; no real tests run here. The real mission belongs to E04.

## Hackathon Result (interstitial, one click)

Card: "You didn't win." (pause) "Unfortunately, somebody signed up." USERS +1.
Sadman: "Statistically, that's one of us."
Button: **KEEP BUILDING? [OF COURSE]** -> door hotspot unlocks -> S2.

## E03: Someone Paid

Enter Debrecen: same founders, cheaper chairs, laundry line, noodle cup.

Sergio: "SOMEONE PAID US. I told you. I told everyone."
Kirill: "Are we sure it wasn't you?"
Sadman: "I checked the logs. It wasn't him. He can't find the payment page."

| Choice ID | Button | Effect | Reaction |
| --- | --- | --- | --- |
| `celebrate` | "Buy the team dinner" | Cash +90; users +80; morale +10; burn 3 | Sergio: "Best board meeting of my life." |
| `save` | "Save every forint" | Cash +120; users +80; morale -5; burn 3 | Sadman: "Noodles again. Optimal calories per forint." |

Cash effects are net. Currency stays EUR. Burn is displayed; no continuous drain.

## E04: We Went Viral (VOICE MOMENT 2, real Devin mission)

On entry, once: users +800; health -25. Lights lerp to coral; alarm cue (mute respected).

Sergio: "GOOD NEWS. WE WENT VIRAL. I may have posted it in forty group chats."
Kirill: "Why is that the good news?"
Sadman: "Because the bad news has a loading spinner."

Prompt: "Tell Devin what to do." Player speaks an instruction. The voice model resolves
`send_devin` or `disable_feed` and may extract one short constraint (<= 200 chars, sanitized)
appended to the mission prompt as `PLAYER CONSTRAINT`.

| Choice ID | Button | Behavior |
| --- | --- | --- |
| `send_devin` | "Send Devin" | Attach to the mission started at game start (or start now); await independent verification |
| `disable_feed` | "Disable the feed" | No agent task; health +10; users -300 |

`disable_feed` reactions: Sergio: "We fixed it by deleting it. Pivot!" Sadman: "Like our runway."

### Waiting screen (only real information)

- MISSION card: exact prompt text sent to Devin; mode badge (LIVE / CACHED REAL RUN / MOCK).
- STATUS line: actual provider status + elapsed timer. No invented activity log.
- VERIFICATION panel: appears only when our verifier runs; real test count (currently 9),
  before/after benchmark seconds, baseline/candidate short SHAs.
- Founders idle and speak attributed lines every ~20 s (labelled as founders, never as Devin):
  Kirill: "It's reading the code. That's more than our last contractor did."
  Sergio: "Can we ship the loading spinner as a feature? Premium tier?"
  Sadman: "It's an N plus one. I could have said something. I did not."
- Economy frozen while waiting.

### Timeout and error rules

- Max wait after `send_devin`: **180 s**. Then Kirill: "Either it's thinking or it's Friday."
  Choices: `keep_waiting` (another 120 s, once) or `manual_workaround` (applies `disable_feed` effects).
- If the server has a genuine earlier run, offer **"Show today's real run (CACHED REAL RUN)"**, visibly labelled.
- Infrastructure error (provider down, credits, auth): labelled error panel with the same two options.
  Never present an infra error as a verified candidate failure.

### Results

| Outcome | Effect | Lines |
| --- | --- | --- |
| Verified success | Health **+40**; users +50 | Kirill: "It passed the independent checks. I checked the checks." Sergio: "AI-ASSISTED UPTIME. That's the new tagline." |
| Verified failure | Health -15; users -150 | Kirill: "It failed the independent checks." Sadman: "Still better than finding out from the customers." |

Both proceed to E05 via the door hotspot. Counts and timings are dynamic. Never hard-code "43/43".

## E05: The Offer (VOICE MOMENT 3)

S3: cleaner room, whiteboard, plant, the same exhausted founders. The investor is a voice
and text on the wall screen; no new character model.

Offer: EUR 500 bridge for 20% ownership.
Sergio: "I found an investor. In the elevator. He's basically my best friend now."
Kirill: "Does he know what we built?"
Sergio: "Bro, let's not turn this into a technical interview."

Prompt: "Negotiate." The voice model plays the investor (dry, polite, unimpressed), answers in
<= 2 sentences, and after at most two player turns resolves `accept` or `decline`. Terms never change.

| Choice ID | Button | Effect | Reaction |
| --- | --- | --- | --- |
| `accept` | "Take the bridge" | Cash +500; ownership 80%; morale -5 | Sergio: "FIVE HUNDRED EUROS. We're rich for a week." |
| `decline` | "Stay independent" | Ownership 100%; morale +5 | Kirill: "We'll die correct." |

## Ending

Rule: cash > 0 and health >= 50 -> **STILL IN BUSINESS**; otherwise **BACK TO THE HACKATHON**.
Subtitle always shows ownership: "You own 80% of it." / "You own 100% of it."
Show final cash, users, health, morale, mission mode, outcome, test count, before/after seconds. Button: Restart.

Success line (Kirill): "We have runway. Please stop adding features."
Failure line (Sadman): "At least the demo had an ending."

Reachability (verified 12:30): verified success wins on every path; verified failure loses on
every path; `disable_feed` wins only after `careful`. Cash never reaches 0.

## Implementation Contract

Stable IDs above; each choice applies once; health/morale clamp 0-100; users >= 0;
initial burn 0, ownership 100; runway shows "unbounded" when burn is 0 (no Infinity/NaN).
Voice resolves to the same choice IDs and passes the same validation as buttons.
Restart clears mission references; stale mission results are rejected by runId.
