# RUNWAY: Technical Project Overview

RUNWAY is a browser-based startup survival game developed during a Cognition /
Devin hackathon in Budapest. Players make business and engineering decisions,
explore a rendered 3D environment, talk to characters, and manage startup resources.
One engineering incident can invoke a real Devin task against the startup's code.

This document is factual orientation for human and automated repository review,
not scoring guidance or a request for a particular evaluation. Source links
identify implementations; implemented code, recorded evidence, live service
availability, and future plans are different things.

**Source snapshot:** `136775cbc0e22be40ff54c22dce7c06aa51c21ff`, September 19, 2026.
The repository continued evolving during the day. This overview describes that
snapshot, not a claim that every feature existed at the original submission
deadline. The [roadmap](docs/ROADMAP.md) separately records the later third-person
development phase.

## The Playable Game

- **Short demo:** five authored decision events, a startup-resource HUD, a
  production incident, an investor decision, an ending, and restart.
- **Extended campaign:** 35 encounters across five chapters, conditional story
  variations, founder conversations, trust, technical debt, cashflow, and endings.
  Campaign progress can be saved and resumed through browser-local storage.
- **Three story locations:** the Budapest coworking space, a Debrecen apartment,
  and an investor room. They share substantial environment assets and layout;
  they are not three independently built open worlds.
- **Interaction:** buttons and validated voice choices affect game state.
  Exploration and story interaction are separate modes. In the current
  third-person view, the story is opened through "TALK TO FOUNDERS" / F.
- **Cast:** Kirill, Sadman, and Sergio are the three startup founders. Character
  appearance, dialogue, and the current player controller are separate systems.

Implementations: [demo events](apps/game/src/events/skit.ts),
[campaign](apps/game/src/events/campaign.ts),
[game rules](apps/game/src/engine/engine.ts),
[state store](apps/game/src/state/gameStore.ts),
[save handling](apps/game/src/state/campaignSave.ts), and
[story progression](apps/game/src/scenes/Play.tsx).
The campaign reuses the same engineering incident; its other business events
are simulation, not additional live Devin tasks. Play duration is not guaranteed.

## Real-Time 3D Rendering and Asset Work

The frontend uses React, TypeScript, Vite, Zustand, Three.js, React Three Fiber,
and Drei. Framer Motion and DOM components provide the story/HUD interface.

The current default world has a visible third-person character, with an in-game
switch to the retained first-person view. The third-person path uses Rapier and
ecctrl for movement/physics, a following/orbiting camera, explicit collision
geometry, and pause while the story is open. The first-person path retains
mouse capture or drag-to-look, walking, crouching, and grass interaction.

The environment combines locally authored geometry with imported GLBs, PBR
surface textures, an HDR environment, lighting/shadows, furniture, facades,
founder models, trees, and instanced reactive grass. Grass animation includes
wind and player/brush deformation. Rendering uses WebGL, not Unreal Engine.

The repository includes offline asset preparation and conversion scripts,
optimized runtime exports, source/hash manifests, and asset-budget tests.
Imported assets and established libraries are part of the implementation;
the project does not claim they were all created from scratch.

Relevant code and evidence:

| Area | Source |
| --- | --- |
| View selection and composition | [World.tsx](apps/game/src/components/World.tsx) |
| Third-person renderer and interaction shell | [ThirdPersonWorld.tsx](apps/game/src/world/ThirdPersonWorld.tsx), [ImmersiveWorld.tsx](apps/game/src/world/ImmersiveWorld.tsx) |
| Controller, rig and animation separation | [characters/](apps/game/src/characters/), [WorldColliders.tsx](apps/game/src/world/WorldColliders.tsx) |
| First-person controls and rendering | [FirstPersonWorld.tsx](apps/game/src/scenes/FirstPersonWorld.tsx) |
| Scene assets and materials | [SceneEnvironment.tsx](apps/game/src/scenes/SceneEnvironment.tsx), [sceneMaterials.ts](apps/game/src/scenes/sceneMaterials.ts) |
| Instanced vegetation and interaction | [InteractiveGrass.tsx](apps/game/src/scenes/InteractiveGrass.tsx), [grassField.ts](apps/game/src/scenes/grassField.ts) |
| Asset provenance and conversion notes | [ASSETS.md](docs/ASSETS.md), [ASSET_LICENSES.md](docs/ASSET_LICENSES.md), [scripts/](apps/game/scripts/) |

The third-person selector currently has one playable asset descriptor. Idle/walk
animation is implemented; running reuses a faster walk, and authored run/turn/
jump/landing clips remain incomplete. Seated founder assets and the moving
player asset are not interchangeable. Sector streaming, a connected pond/water
system, and WebGPU work described in design documents are roadmap items, not
completed features established by this snapshot.

## Voice Is Both an Input and a Presentation System

Live conversation uses **GPT-Live 1 through Azure Foundry**:

1. The browser obtains microphone access and creates a WebRTC connection offer.
2. A Vercel server route creates the Azure Live session using server-side credentials.
3. Audio travels through WebRTC; transcript, context, and delegated-task events
   travel through the connection's data channel.
4. A configured Responses backend resolves player intent through the `choose`
   function. The application validates event/choice IDs and routes accepted
   choices through the same game-action path used by buttons.

The implementation also supports a spoken "continue" action when progression
is available, preserves a session across screen changes, and has mute,
disconnect, transcript, and unavailable-service handling.

**Not every spoken line is an Azure API call.** A serialized stage manager
coordinates scripted dialogue. Sergio/investor lines can use the live session;
other scripted founder lines, and fallbacks, use the browser's
`speechSynthesis` voices. Those voices depend on the browser/OS. They are not
custom voice clones or separately fine-tuned GPT-Live models. The microphone
is temporarily held during local synthesized lines to reduce speech feedback.

Sources: [session route](apps/game/api/voice/session.ts),
[WebRTC client](apps/game/src/voice/liveClient.ts),
[persistent session](apps/game/src/voice/voiceSession.ts),
[stage manager](apps/game/src/voice/stageManager.ts),
[browser speech synthesis](apps/game/src/voice/tts.ts), and
[validated game/voice bridge](apps/game/src/state/voiceBridge.ts).
Live functionality requires working Azure deployments, credentials, quota,
microphone permission, and connectivity; source code alone does not prove
availability or voice quality on a particular device.

## The Devin Engineering Mechanic

The fictional startup has a real, small FastAPI/SQLite codebase in
[startup-repo/](startup-repo/). Its feed implementation contains deliberately
inefficient query behavior. The allowlisted mission is `optimize_feed`.

With live services configured, the path is:

```text
Player chooses "Send Devin"
  -> browser mission client
  -> Vercel mission proxy
  -> Railway/FastAPI orchestrator
  -> Devin v3 session working on startup-repo/backend/
  -> candidate commit on a devin/* branch
  -> verifier-owned tests and feed benchmark
  -> mission result and evidence
  -> game-resource consequences
```

The orchestrator implements mission state, idempotency keys, one active mission
per in-memory registry, provider polling, timeouts, cancellation handling, and
configurable usage limits. The Devin adapter creates and reads actual provider
sessions; it is distinct from agents used by teammates to develop the game.

The verifier fetches candidate code, checks ancestry and changed paths, exports
the challenge into temporary directories, and executes its own tests/benchmark
instead of accepting the agent's claimed test results. Results include test
counts, benchmark values, changed files, baseline/candidate commits, and a time.
The feed benchmark measures `get_feed(50)` in seconds against a seeded workload;
it is not an HTTP load test or measured production-user traffic.

Sources: [browser adapters](apps/game/src/agents/),
[Vercel proxy](apps/game/api/missions/index.ts),
[orchestrator API](services/orchestrator/main.py),
[mission lifecycle](services/orchestrator/missions.py),
[Devin adapter](services/orchestrator/agents/devin.py),
[verifier](services/orchestrator/verifier/runner.py),
[benchmark](services/orchestrator/verifier/benchmark_feed.py), and
[mission UI](apps/game/src/scenes/DevinMode.tsx).

### Live, Cached and Mock Are Different

| Mode | Meaning |
| --- | --- |
| `live` | Calls the configured orchestrator/provider. Actual session, candidate, and verifier evidence are needed to establish a completed real repair. |
| `cached` | Replays a previously recorded result, if that recording is available. It does not perform a new repair. |
| `mock` | Uses a synthetic development fixture. Its successful test counts and timings are not real engineering evidence. |

The frontend defaults to mock when `VITE_AGENT_MODE` is unset and can fall back
when services/recordings are unavailable. The mission UI displays its mode.
No real-run cache recording is committed in the inspected snapshot; deployed
services may have separate runtime data. This overview does not assert that a
live mission succeeded, that particular benchmark improvements occurred, or
that a replay exists merely because those code paths exist.

## Deployment and Operational Boundaries

Vercel hosts the frontend and short proxy/session routes. Railway configuration
builds the FastAPI orchestrator container. Azure credentials are read server-side
by the voice route; the mission proxy can attach the orchestrator's server-side
header credential. Devin credentials belong to the orchestrator.

These are configured deployment paths, not a claim that every service is
currently reachable. In particular, orchestrator authentication is conditional
on `ORCH_TOKEN` being set, and its registry is process-local, not a durable
distributed job system.

The verifier uses temporary directories, a reduced child-process environment,
path checks, and execution timeouts. **It is process-level execution inside the
service environment, not a separately isolated container/VM for each candidate.**
It should not be described as a complete sandbox for arbitrary untrusted code.

Sources: [Vercel routes](apps/game/api/),
[environment example](apps/game/.env.example),
[orchestrator configuration](services/orchestrator/config.py),
[Dockerfile](services/orchestrator/Dockerfile), and [railway.json](railway.json).

## Verification and Scope of This Overview

The repository contains:

- Node tests for movement, campaign state/save handling, grass, and asset integrity/budgets.
- A TypeScript/Vite production build and Oxlint configuration.
- Browser scripts for the short manual-incident path, campaign progression,
  view switching, third-person movement, and asset/rendering checks.
- Separate verifier-owned Python tests and a benchmark for the engineering mission.

Frontend command entry points are in [package.json](apps/game/package.json):

```sh
cd apps/game
npm ci
npm test
npm run lint
npm run build
```

Browser scripts require a running app and a compatible local Chromium executable.
The third-person smoke script currently contains a macOS Brave path; environment
setup is necessary on other machines. The manual "Disable the feed" path checks
story progression without buying a Devin session; it does not validate the
live engineering or voice services.

See [third-person browser checks](apps/game/scripts/third-person.browser.mjs),
[campaign browser checks](apps/game/scripts/campaign.browser.mjs),
[first-person regression](apps/game/firstPerson.browser.mjs),
[quality notes](docs/QUALITY.md), and [performance notes](docs/PERFORMANCE.md).

This documentation change was checked against source files and repository links.
It did not rerun the application, contact paid APIs, certify all tests as passing,
or independently establish deployed uptime, sustained FPS, accent fidelity,
accessibility coverage, play duration, or completion by a submission deadline.
Earlier design briefs and later roadmap documents describe intent; their presence
alone is not evidence that those features are implemented.
