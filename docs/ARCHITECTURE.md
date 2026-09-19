# Proposed Architecture

Status: **IMPLEMENTATION HANDOFF. Latest hosting/voice decisions: [HANDOFF.md](HANDOFF.md).**
This window has not installed or run the starter.

## Default Choice

Extend the existing `apps/game/` Vite/React application. Keep its Zustand,
Tailwind, and Framer Motion choices; add R3F/Three.js and selected Drei helpers.
Add one small FastAPI orchestrator for Devin credentials, session lifecycle,
and independent verification. Preserve `startup-repo/` as the broken challenge.

This supersedes the preliminary no-backend recommendation: the received RUNWAY
brief makes real agent work the core mechanic. Do not add SSR, a new database,
player accounts, a queue service, or new monorepo tooling.

| Concern | Proposed choice | Reason / admission rule |
| --- | --- | --- |
| Build and language | Existing Vite/TypeScript/npm app | Reuse `apps/game/package-lock.json`; no new starter [S1] |
| Scene and renderer | Three.js + `@react-three/fiber` | React component composition for Three.js [S2] |
| Scene helpers | `@react-three/drei` | Reuse camera, loading, and asset helpers [S3] |
| Discrete game state | Existing Zustand dependency + pure transition functions | One source of truth; rules remain testable without React |
| Frame state | Refs and `useFrame` delta | Do not rerender React on each simulation frame [S4] |
| Physics / character movement | None | Management decisions do not require locomotion |
| Visual assets | One approved pack; local GLB/textures | Coherent art with a short import path [S7] |
| HUD | React DOM, existing styling/motion, accessible icons | Keep UI testable outside the canvas |
| Tests | Focused rule tests and Playwright browser checks | Logic tests alone cannot verify rendered 3D [S10] |
| Backend | FastAPI + HTTP client, one bounded active mission | Separate from intentionally broken challenge; API contract in `DEVIN_CONTRACT.md` |
| Verification | Trusted harness in disposable restricted runner | Never execute candidate code in API process or developer environment |
| Hosting | Likely Vercel frontend/provider routes + Railway orchestrator | Judges must play hosted game; protect and limit provider operations |

Compatibility: the R3F maintainers document React 19 with Fiber 9, and React 18
with Fiber 8 [S2]. The incoming app declares React 19. These are compatibility
families, not instructions to install `latest`. At T01 inspect published peer
dependencies for the few additions, retain the lockfile, and record exact versions.

Local discovery found Node `v25.6.1` and npm `11.9.0`. The three teammates and
deployment must agree on a supported Node version before extending the starter; this
document does not establish production compatibility of the local runtime.

## Boundaries

```text
React HUD + 3D scene -> pure choice rules -> Zustand -> visible consequences
                             |
                        mission client
                             v
                   FastAPI orchestrator
                      |             |
                  Devin API    trusted verifier
                      |             |
                 candidate -> isolated execution
                                    |
                              verified result
                                    v
                         one game consequence

R3F frame loop -> transforms via refs, not React setState
```

Proposed layout, to be created only after approval:

```text
apps/game/                 # Existing app, not a second root application
  src/App.tsx              # Compose scene, HUD, mission view and boundaries
  src/engine/              # Pure rules, typed state transitions, focused tests
  src/state/               # Small Zustand store
  src/events/              # Five authored events, choices and effects
  src/scenes/              # Three scenes with reusable assets, three founders, camera
  src/components/          # HUD, choices, mission evidence, result
  src/agents/              # Browser mission client; no provider credentials
  public/assets/           # Approved local models/textures/audio
  tests/                   # Browser flows
services/orchestrator/     # New, only after approval
  app.py                   # Minimal mission endpoints
  models.py                # Validated request/status/result schemas
  agents.py                # Devin adapter and explicitly typed demo modes
  missions.py              # Lifecycle, deduplication, time and cost limits
  verifier.py              # Fixed trusted commands and isolated runner
  verification/            # Frozen tests/benchmark, not candidate-controlled
  tests/                   # Adapter, lifecycle and verifier contract tests
startup-repo/              # Existing intentionally inefficient mission target
```

Split additional components only when their responsibilities justify it. The
director does not need a reusable scene engine, entity system, dialogue editor,
or custom event framework to organize one game.

## Contract to Lock Before Parallel Work

- State progression: loading -> ready -> playing -> result; pause and error paths.
- Agree whether a failure result is required; do not invent one for every game.
- Actions: start, choose(eventId, choiceId), applyMissionResult, pause/resume, restart.
- Content IDs and completion conditions come from `BRIEF.md`'s approved mapping.
- `scenes/` reacts to state; it does not award points or decide victory.
- `components/` displays state and dispatches actions; it does not mutate scene objects.
- Frame updates move objects; discrete events update game state.
- A and C freeze game/mission types before B connects visual states. Keep types small.
- Match mission ID and game-run ID before applying results; deduplicate terminal results.

## Backend Limits

One process, one active mission, no broker. Poll status rather than building
WebSockets. In-memory state is acceptable for the hackathon only if restarts
invalidate outstanding jobs explicitly and do not automatically reissue paid work.
Record a sanitized result artifact for the authentic cached mode.

Use the current documented Devin API family and account permissions [S15-S17].
Provider completion is not verification. Never let browser input choose shell
commands, arbitrary repository URLs, or accepted thresholds. The complete
request/result and runner boundaries are in `DEVIN_CONTRACT.md`.

User direction: hosted playable game, likely Vercel plus Railway. Vercel owns
server-only provider keys and short provider/voice routes; Railway runs orchestration.
Authenticate service calls and enforce public usage caps. Never expose unrestricted
paid task creation. Explicit cached fallback remains available, not the only deliverable.

## Rendering and Asset Rules

- One full-bleed scene; HUD overlays must not obscure the main interaction.
- Prefer fixed or bounded camera interaction if it meets the script.
- Use simple geometry until the complete loop works, then replace selectively.
- Reuse geometry/materials; avoid allocations and React state updates per frame [S4].
- Begin with restrained lighting and no postprocessing.
- Proposed starting DPR cap: 1.5; adjust based on the actual demo device.
- Load assets through established helpers with loading/error recovery.
- Self-host required assets; inspect any decoder or helper that defaults to a CDN.
- GLTFJSX can generate typed reusable components; its compression workflow may
  require decoders, so verify those are included and load in the deployed build [S9].
- Record asset source, license evidence, transformations, and final size.

Performance targets and browser checks live in `QUALITY.md`.
