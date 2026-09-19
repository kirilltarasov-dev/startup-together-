# Active Team Handoff

## Master Reorientation — Latest User Authority

The new product requirement is a freely explorable third-person browser world with a visible rigged human, proven physics/controller, replaceable character assets and a phased path to sectors, water, quality tiers and profiling. See PRODUCT_VISION.md and ROADMAP.md; this supersedes the earlier first-person/no-selection/no-physics restrictions. Preserve the existing story/campaign, voice and Devin integration. Work is isolated on `feat/third-person-foundation`; prior release remains on main. The supplied `Cognition_AI (2).png` is approved as a brand input. A further 13-minute window was stated at the 15:04 CEST check; do not claim the entire roadmap can be completed in that window.

Production owner/checklist: [COORDINATOR.md](COORDINATOR.md).
Playable script draft: [SKIT.md](SKIT.md).

## Latest Frontend Amendment (September 19, 2026)

The user requested a realistic, touchable 3D environment, selected first-person over third-person/diorama, and explicitly authorized the current Devin session to take over frontend/3D while preserving existing uncommitted work. This supersedes the earlier fixed-camera/panorama and primitives-only constraints for the visual/input upgrade. The implemented local build has modeled three-scene environments and a connected courtyard, WASD/mouse or drag-to-look, crouching, reactive grass, and story-overlay return. The five-event story and backend/voice ownership remain unchanged. The user-supplied Remy model replaces the middle founder with a textured, rigged human in a locally fitted static seated pose. The user-approved reference-derived Sergio GLB now replaces the right-hand founder in a matching seated pose; original reference and animated standalone exports remain untouched. The environment uses self-hosted CC0 PBR brick/pavement, HDR lighting and optimized textured trees, alongside the separate grass upgrade. Sadman, the hand and much of the architecture remain procedural; no exact Sergio likeness, photoreal scene or motion-capture idle is claimed. Verification commands are in `AGENTS.md`; asset provenance, measurements and remaining animation/character gaps are in `ASSETS.md`.

User update recorded September 19, 2026, 12:35 CEST (supersedes 11:59 entries below where they conflict).

## 12:35 Freeze (latest user approval)

- Founder names: `sadman` (Sadman, Bangladeshi, growth) and `sergio` (Sergio, Colombian, design/sales).
- Verified Devin success is health **+40** (was +30); ending shows ownership 80% / 100%.
- **Voice is mandatory**: three gpt-live-1 talk moments (E01, E04, E05). Contract in [VOICE.md](VOICE.md).
- **Movement is in**: arrow keys / WASD move Kirill; hotspots trigger events. Spec in [DIRECTION.md](DIRECTION.md).
- Founder selection is **out**.
- Benchmark recalibration approved: baseline measures 77 ms today; the verifier-owned copy seeds
  a ~500k-post database so the incident is visibly slow (~2.3 s) and a real fix is visibly fast.
- Hosting: **Vercel** = static frontend + `/api/voice/session` route holding the **Azure Foundry**
  key (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, deployments). gpt-live-1 is called through Azure, decided 13:10.
  **Railway** = FastAPI orchestrator container holding `DEVIN_API_KEY` and serving `/api/missions`.
- 13:00: Devin works in **this repo** (`kirilltarasov-dev/startup-together-`), constrained to
  `startup-repo/`, pushing `devin/*` branches only. No throwaway repo. The verifier rejects any
  candidate diff outside `startup-repo/`. Devin key and hosting are set up by the infra owner via
  [COLLEAGUE_SETUP_PROMPT.md](COLLEAGUE_SETUP_PROMPT.md). Voice is gpt-live-1 via a Vercel server route, not Web Speech API.
- Frozen script: [SKIT.md](SKIT.md). Frozen visuals: [DIRECTION.md](DIRECTION.md).
- Cut order if the clock slips (decided at 14:00 by the user): container isolation -> third dressing
  -> title cards -> voice moment 3 -> voice moment 1. Voice moment 2 and the real mission are never cut.

This file supersedes earlier unapproved scope, two-scene, no-voice, and local-only
hosting proposals. The user approved the reduced MVP with the changes below.

## Confirmed

- Three hours remaining at confirmation; working submission cutoff: 14:59 CEST.
- Exactly three 3D scenes, three distinct founders, five authored events, one
  real engineering incident, one investor decision, and one ending.
- Teammates use their own Devin agents/accounts for implementation and usage.
- This Codex window coordinates Markdown, ownership, contracts, and checkpoints;
  it does not start coding or spend Devin credits.
- Judges must play the hosted game. A stage recording alone is not delivery.
- Expected hosting: Vercel frontend/provider routes and Railway orchestration.
- Provider API keys stay in server-only Vercel environment variables.
- Voice model: `gpt-live-1`. Retain clickable choices when voice is unavailable.

## Scenes and Characters

Scene allocation: Budapest hackathon, Debrecen apartment, and an accelerator/
investor room. The third setting is the proposed default, not a newly confirmed
user choice; do not block parallel work on its naming. Reuse props and camera.

| Character ID | Name | Background | Distinct role and personality |
| --- | --- | --- | --- |
| `kirill` | Kirill | Russian | CTO/product; technical perfectionist, nothing ships until correct |
| `sadman` | Sadman | Bangladeshi | Deep backend/research; academic introvert, deadpan, exact |
| `sergio` | Sergio | Colombian | Sales/growth; frat-bro hype, oversells and overships everything |

Scene 1 venue (user-provided, 12:50): Puzl CowOrKing, Lajos utca 126-130, 1036 Budapest (Obuda), loft-style tech coworking.

These are confirmed planning characters, not completed models. Give them distinct
silhouettes, colors, and reactions. Nationality is not a comedy mechanism.

## Parallel Claims

Claim a lane by replacing UNCLAIMED with the responsible teammate/agent.
Use separate branches/checkouts; never share an active worktree between agents.

| Lane | Branch suggestion | Exclusive write area | Claim |
| --- | --- | --- | --- |
| A: game/UI | `feat/game-loop` | `apps/game/src/engine`, `state`, `events`, `components`, `App.tsx`, app config/lockfile, movement input, `apps/game/src/agents` (interface + mock/cached) | **Kirill** (claimed 12:50) |
| B: 3D | `feat/three-scenes` | `apps/game/src/scenes`, `apps/game/public/assets` | **Kirill** (after A; 2.5D greybox ships if 3D slips) |
| C: Devin/backend | `feat/orchestrator` | `services/orchestrator`, `apps/game/src/agents/httpAgent.ts`, `cache/`, Railway config | **Sadman** — prompt: [LANE_C_SADMAN.md](LANE_C_SADMAN.md) |
| V: voice | `feat/voice` | `apps/game/src/voice`, `apps/game/api/voice/*` (Vercel route) | **Sergio** — prompt: [LANE_V_SERGIO.md](LANE_V_SERGIO.md) |
| Direction | Devin (director window) | `docs/` freeze files | Devin, with Codex coordination |

Game <-> voice interface: `apps/game/src/state/voiceBridge.ts` (owned by A, consumed by V).
Game <-> backend interface: MissionStatus JSON in [LANE_C_SADMAN.md](LANE_C_SADMAN.md) TASK 2 (owned by C, consumed by A).

A owns the frontend lockfile: B/C request dependency additions instead of
concurrently editing it. A/C freeze interfaces first; B consumes shared state
without adding another store. Each lane hands off a commit, changed paths,
verification result, and blocker. Integrate every 20 minutes.

Milestones from confirmation: +20 minutes scene/API proof; +60 playable greybox;
+110 real mission and three scenes integrated; +150 release freeze; +180 submitted.
No agent waits for finished art to wire gameplay, or for LIVE to test the contract.

## Hosting and Voice Boundaries

- Vercel handles short authenticated provider calls using its server-side keys.
- Railway handles long-lived orchestration; do not make a Vercel request wait for
  a full Devin repair. Authenticate service-to-service requests.
- Vercel secrets do not automatically appear in Railway. Do not put keys in
  `VITE_*`, browser bundles, public URLs, or logs.
- Official OpenAI docs confirm `gpt-live-1` uses the Live API, not the Realtime
  endpoint. Follow the browser WebRTC quickstart with trusted server session setup.
- Voice submits the same validated choices as buttons. Spoken instructions must
  not bypass mission allowlists, authorization, confirmation, or spending limits.
- Request microphone access only on user action; support denial, mute, disconnect,
  and session closure. Cap public session duration and paid session creation.
- Keep LIVE / CACHED REAL RUN / MOCK visibly distinct; never fabricate verification.

Sources checked:
`https://developers.openai.com/api/docs/models/gpt-live-1.md`
`https://developers.openai.com/api/docs/guides/live.md`

## Immediate Owner Checks

Confirm lane owners, hosting access, provider credentials and spending caps.
These block the affected live integration, not independent UI/scene work.
The exact official submission time, if different, overrides the working cutoff.
Planning files are local until an explicitly authorized commit/push shares them.
