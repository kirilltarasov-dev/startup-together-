# Delivery Plan

## Clock and Current State

- Budget reported by user: 180 minutes.
- First recorded planning check: September 19, 2026, 11:41 CEST, Budapest.
- Latest user confirmation: three hours remaining, recorded 11:59 CEST; working cutoff 14:59 CEST.
- Planning and setup consume the real budget; approval does not restart it.
- Current phase: pre-production. Original brief and starter code reviewed at `1988cd3`.
- Reduced MVP approved; teammates implement with their Devin agents. This window coordinates docs only.
- Last verified playable build / demo URL: none; starter commands not run.
- Immediate owner checks: claim lanes, confirm hosting/provider access and usage limits.
- The five-hour plan inside `RUNWAY.md` is superseded by the user's three-hour limit.

## 12:40 Director Checkpoint (Devin window)

1. Time remaining: ~2h20m to 14:59. G1 (12:19) missed: zero application code exists.
2. Last working build: none. Evidence gathered: baseline benchmark p95 = 0.077 s at 20k posts;
   0.93 s at 200k posts (linear). Docker 29.3 present on the director machine.
3. Blockers: Devin API key + throwaway challenge repo not yet handed to Lane C; Lane A/B/V owners unnamed.
4. Frozen this checkpoint: `SKIT.md`, `DIRECTION.md`, `VOICE.md`, `HANDOFF.md` 12:35 section.
5. Revised milestones: 13:05 deployed skeleton (Vercel hello + Railway `/health`), 13:20 greybox
   diorama + E01 clickable, 13:45 real mission started and cached run in progress, 14:15 voice moment 2
   working, 14:29 freeze, 14:59 submit. Cut order lives in `HANDOFF.md`.

## Three Human Workstreams

Claim parallel lanes in [HANDOFF.md](HANDOFF.md). Teammates use their own Devin
agents. Names are unassigned; isolated branches and ownership prevent collisions.

| Role | Proposed responsibility | File ownership after approval |
| --- | --- | --- |
| A: Gameplay / UI integration | Events, state, HUD, frontend integration and dependencies | `apps/game/src/engine/`, `state/`, `events/`, `components/`, `App.tsx`, app package/config |
| B: 3D / assets | Diorama, camera, founders, asset provenance, visual QA | `apps/game/src/scenes/`, `apps/game/public/assets/`, browser screenshots |
| C: Devin / verification | Orchestrator, provider adapter, safe verifier, deployment | `services/orchestrator/`, `apps/game/src/agents/`, contract fixtures |
| Agent in this window | Maintain decisions, challenge scope, assist assigned work, verify evidence | Only the current claimed task |

A integrates frontend files and its lockfile. C owns the backend and API contract.
B reviews the visual experience; all three rehearse. Keep `startup-repo/` unchanged
as the challenge baseline until C freezes the approved mission setup. Do not fix
the intentional bottleneck while building the game. Assign real names before coding.

## Milestones

The user confirmed three hours remaining at 11:59 CEST. These checkpoints align
with `HANDOFF.md`; writing more documents does not move them. Final thirty minutes
are protected. Replace the working cutoff only if the organizer supplies another.

| Due, CEST | Milestone and observable exit | Gate | If late |
| --- | --- | --- | --- |
| First active handoff | Scope approved; skit reviewed; branches and owners claimed | G0 | Ask the smallest blocking question; independent scene/API work proceeds |
| 12:19 (+20 min) | A: choice/HUD; B: visible 3D; C: baseline and authorized real mission started | G1 | Resolve access; simplify art, not real-engineering evidence |
| 12:59 (+60 min) | Five-event greybox, three scene states, ending/restart; MOCK contract wired | G2 | Reduce props; isolate voice work and retain button input |
| 13:49 (+110 min) | Real candidate independently verified; game consequence; three scenes and voice integrated | G3 | Escalate blocker; never claim mock as live success |
| 14:29 (+150 min) | Hosted playable release, visual checks, protected usage, recovery and honest modes | G4 | Freeze scope; fix release blockers only |
| 14:59 (+180 min) | Fresh-browser play, rehearsals, backup, submission receipt | G5 | Submit the last verified playable build |

G0 is defined in `BRIEF.md`; G1-G5 evidence is defined in `QUALITY.md`.

## Task Board

Owner labels below are proposed roles until real names are assigned.
Dependencies refer to IDs in this table. External implementation progress is
unconfirmed until teammates report a branch/build; this window has not coded.

| ID | Work item | Owner | Depends on | Status | Done when |
| --- | --- | --- | --- | --- | --- |
| P01 | Inspect repository, existing stack, and primary sources | Agent | - | DONE | Sources and starter findings recorded |
| P02 | Create planning package and check internal links | Agent | P01 | DONE | Nine planning files checked for links, source IDs, ASCII and whitespace; source/code unchanged |
| P03 | Fetch and read teammate's brief and starters | Agent | - | DONE | `1988cd3` fast-forwarded locally; tracked files unchanged |
| P04 | Obtain reduced-scope approval and remaining time | User + agent | P03 | DONE | User approved three scenes, hosted play, teammate coding, and three hours remaining |
| P05 | Claim lanes and verify hosting/provider access and usage caps | Teammates | P04 | TODO | Owners recorded; live calls permitted only within verified limits |
| P06 | Produce coordinator and playable skit draft | Codex + user | P04 | DONE | User approved names, +40, ownership ending, voice moments, movement at 12:35; frozen in `SKIT.md` |
| P07 | Adversarial review (script, technical, art) and spec freeze | Devin director | P06 | DONE | Findings recorded; `DIRECTION.md`, `VOICE.md` frozen 12:40 |
| T13 | Recalibrate verifier-owned benchmark seed (~500k posts) and freeze threshold 0.5 s | C | P07 | TODO | Baseline/candidate measured with the same harness; startup-repo untouched |
| T14 | Movement + hotspots (arrow/WASD, clamp, `enterHotspot`) | A | T04 | TODO | Kirill walks; active hotspot triggers next event once |
| T15 | Three voice moments via gpt-live-1 with `choose` tool | V | T01, T04 | TODO | Each moment resolves to a validated choice; denial/mute/disconnect tested |
| T01 | Validate existing starter and versions; define test commands | A | P04 | TODO | Existing app builds; R3F dependencies compatible |
| T02 | Build one lit set, three figures, fixed camera | B | T01 | TODO | Scene visible and responsive on demo laptop |
| T03 | Validate Devin access, sandbox target, and trusted baseline | C | P04 | TODO | Approved environment and repeatable baseline evidence |
| T04 | Implement five-event state, choice rules, result and restart | A | T01 | TODO | State transitions and economic boundaries tested |
| T05 | Implement mission API and live provider adapter | C | T03 | TODO | One authorized session launched; polling and cost bounds verified |
| T06 | Wire mission UI using reviewed MOCK contract fixture | A | T04 | TODO | Pending, attention, success, failure and mode labels exercised |
| T07 | Build three scene dressings and restrained feedback | B | T02,T04 | TODO | Three scenes and three founders render; provenance recorded |
| T12 | Integrate GPT-Live 1 through server-side Vercel routes | C + A | T01,P05 | TODO | Voice dispatches validated choices; denial/mute/disconnect and buttons work |
| T08 | Independently verify real candidate and export cached evidence | C | T05 | TODO | Frozen harness passes; exact baseline/head recorded |
| T09 | Connect real result and exercise recovery/idempotency | A + C | T06,T08 | TODO | Matching result applied once; stale result rejected |
| T10 | Visual/browser QA, production build, hosting smoke | All | T07,T09,T12 | TODO | G4 passes against identified build, including requested voice/fallback |
| T11 | Rehearse live/replay, record backup, and submit | All | T10 | TODO | G5 passes; real-repair evidence and submission recorded |

## Risk and Decision Register

| ID | Risk / open decision | Trigger | Response | Owner |
| --- | --- | --- | --- | --- |
| R1 | Approval, owners, or deadline remain unknown | Discovery reaches 15 minutes | Ask for minimal scope approval and exact remaining time | User + agent |
| R2 | 3D or asset import becomes costly | Scene spike exceeds 10 minutes | Use simpler geometry, fixed camera, fewer props | B |
| R3 | Public paid integrations add security/setup work | Hosted service access or limits fail proof | Protect paid endpoints; keep hosted game playable; disclose any fallback | C |
| R4 | Poor GPU performance or large downloads | G1/G4 measurement misses budget | Reduce asset sizes, shadows, DPR, and repeated geometry | B |
| R5 | Devin access, duration, or credits fail | G1 cannot start real mission | Account owner intervenes; require genuine cached run, not invented success | C |
| R6 | Conflicting edits across three people | Shared file needed by two tasks | Single integrator, small branches, explicit handoff | A |
| R7 | Weak benchmark or mutable tests undermine proof | Baseline already meets target or candidate can change harness | Calibrate and freeze trusted evidence before Devin starts | C |
| R8 | An optional feature threatens submission | G4 not on track for 14:29 CEST | Remove all stretch work | Agent + all |

| Decision | Status | Rationale / next evidence |
| --- | --- | --- |
| Preserve incoming React/Python structure | SELECTED FOR PLANNING | Do not create a competing root app or repair the challenge early |
| Fixed-camera R3F game | PROPOSED | User requires 3D; full locomotion is unnecessary |
| Small FastAPI orchestrator | PROPOSED | Required to protect Devin credentials and verify real work |
| Playable hosted game on likely Vercel/Railway | USER DIRECTION | Server-only keys in Vercel; authorize and limit paid operations |
| One mission; five events; three scenes; three founders | APPROVED | User amended and approved the reduced MVP |
| GPT-Live 1 voice, three moments | APPROVED, MANDATORY | Lane V; contract in `VOICE.md`; buttons remain |
| Arrow-key movement with hotspots | APPROVED | Lightest locomotion: clamp only, no physics |
| Founder selection | REJECTED | User declined 12:35 |
| Success +40, ownership on ending | APPROVED | All success paths win; investor choice visible |
| Primitives only, no asset pack | APPROVED | Spec in `DIRECTION.md` |
| Vercel frontend + voice route, Railway orchestrator | USER DIRECTION | Keys server-side in each platform |
| Exact new dependency versions | DEFERRED TO T01 | Retain existing lockfile; verify only additions |
| External skill installation | NOT REQUESTED / NOT DONE | Research first; use existing local skills meanwhile |
| Remote publishing of this planning package | NOT DONE | Await explicit commit/push instruction |

## Working Cadence and Stretch Rules

- Check in at each milestone or every 15 minutes during active team work.
- Each owner reports: last working result, blocker, next task, and time estimate.
- A blocked task lasting five minutes needs a concrete recovery or scope decision.
- Hand off small, verified changes; integrate at least every 20-30 minutes.
- Update requirements only in `BRIEF.md`; record decision outcomes here.
- Before optional work, require a working deployed MVP and preserved 30-minute buffer.
- Voice is now requested work; Balaton and extra systems remain deferred.
- Multiplayer, accounts, backend infrastructure, and an engine rewrite are not polish.
- Post-hackathon expansion requires new requirements and a new plan.
