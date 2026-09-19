# Repository Working Instructions

## Current Governing Direction — Third-Person Reorientation

The user's Master Product + Architecture Reorientation supersedes older camera, primitives-only, no-physics and no-character-selection constraints below. Read `docs/PRODUCT_VISION.md`, `3D_ARCHITECTURE.md`, `RENDERING.md`, `ASSET_PIPELINE.md`, `CHARACTERS.md`, `WORLD_STREAMING.md`, `PERFORMANCE.md`, `ASSET_LICENSES.md` and `ROADMAP.md`. Immersive high-quality 3D is a requirement. Reuse Rapier/ecctrl, rigged human assets and offline Blender processing; keep controller, model, animator and customization separate. Preserve story/voice/Devin infrastructure and real-verification safeguards. Do not describe target streaming, water, animation coverage or WebGPU experiments as implemented without evidence. New configuration stays in `.devin/`; this existing instructions file remains the project entry point.

The user granted an additional 13-minute window at the 15:04 CEST check. First milestone only: supplied Cognition branding plus verified third-person character/controller/camera integration. Preserve the prior main release; later roadmap phases remain pending, not silently dropped.

## Mission and Authority

Read `docs/HANDOFF.md` first: the latest user approval supersedes earlier proposals.
This Codex window is documentation/coordination only. Teammates' Devin agents
implement in separately claimed lanes; preserve their code.
Use `docs/COORDINATOR.md` for production ownership and `docs/SKIT.md` for the
playable script draft. Do not treat unapproved draft numeric values as user approval.

Ship RUNWAY within the team's actual three-hour deadline: startup decisions,
real Devin engineering, independent verification, and visible game consequences.
Read `RUNWAY.md`, `docs/BRIEF.md`, `docs/PLAN.md`, and `docs/ARCHITECTURE.md`.
Use `docs/DEVIN_CONTRACT.md` and `docs/QUALITY.md` for acceptance evidence.

- The reduced MVP is approved; affected owners must still verify credentials and
  safety limits before live provider calls. Do not block independent scene/UI work.
- The user's request for discussion before coding overrides `RUNWAY.md`'s instruction
  to implement immediately. Its five-hour schedule is not the current time budget.
- Preserve the original script. Record adaptations in `docs/BRIEF.md`.
- Do not invent judging rules, organizer approval, Devin access, or measured results.
- Ask the highest-impact unanswered question first; record answers in the brief.
- After each answer round, summarize the proposed scope and seek approval for the remaining decisions.
- Time-box discovery to the first 15 minutes of the real sprint. Do not reset the clock after planning.
- If that time expires without essential answers, surface the blocker and request a minimal decision.
- Do not independently add features, agents, services, or infrastructure to fill missing requirements.

## Scope and Implementation

- Extend `apps/game/`; retain its React, TypeScript, Vite, Zustand, Tailwind, and motion choices.
- Add Three.js through React Three Fiber and selected Drei helpers after approval.
- Approved scope: five events, three 3D scenes, three founders, one mission, one investor decision, one ending.
- Voice is requested using `gpt-live-1`; keep button input available.
- A small FastAPI orchestrator is justified by the real Devin integration.
- Keep `startup-repo/` separate from the orchestrator: it is the challenge, not trusted infrastructure.
- Do not pre-fix its intentional bottleneck; Devin must make the demonstrated repair.
- Do not execute agent-modified code on the developer host or in the API process.
- A subprocess alone is not a sandbox; use the isolated verifier contract.
- Keep API credentials server-side. Never expose a public, unrestricted paid mission endpoint.
- Distinguish LIVE, CACHED REAL RUN, and MOCK. Do not invent live activity or evidence.
- Use established libraries for required physics or established game rules; do not build an engine.
- Keep pure game rules separate from rendering and input.
- Keep frame-by-frame transforms out of React state; use refs and frame delta.
- Prefer existing helpers and small components. Avoid generic engines, event buses, and speculative layers.
- Render the game as the primary full-bleed experience, not a marketing page.
- Use real game assets or purposeful Three.js geometry; document external asset provenance.
- Provide usable loading, error, pause, and restart behavior appropriate to the approved loop.
- Do not install a third-party skill or execute its scripts without reviewing its source and scope.

## Ownership and Git

- Claim a task and its files in `docs/PLAN.md` before editing.
- Only the frontend integration owner edits shared app composition and its lockfile.
- The backend owner controls orchestrator dependencies and the mission contract.
- Coordinate interface changes before either side consumes them.
- Inspect local changes before editing; preserve teammates' work.
- Do not switch branches under another person's uncommitted changes.
- Use short-lived branches or separate worktrees after the first approved baseline commit.
- Stage explicit files; never force-push or reset teammates' work.
- In this window, verify both author and committer are `Big-Boss-0` before committing.
- Leave global Git settings and other repositories alone.
- Commit, push, merge, and publish only on explicit user instruction.

## Director Checkpoints

At each milestone and before taking new scope, report:

1. Time remaining against the confirmed deadline.
2. Last working build and evidence.
3. Open blockers and the next smallest decision.
4. Owner and next action for each active task.
5. What will be removed if the milestone slips.

Update task statuses as work changes, not only at the end.
Use `TODO`, `DOING`, `BLOCKED`, `REVIEW`, or `DONE`.
`DONE` requires its acceptance check and evidence, not merely generated code.
Do not imply autonomous monitoring or work between user turns.

## Verification and Delivery

- Run focused logic checks, type checking, linting, and a production build once implemented.
- Verify the actual browser experience with Playwright and human inspection.
- Check desktop and narrow viewports, nonblank canvas pixels, movement/input response, and loaded assets.
- A mounted canvas or passing DOM test alone does not prove the game renders.
- Test the deployed URL as a signed-out visitor before calling it delivered.
- Freeze features for the last 30 minutes; fix blockers, rehearse, and submit.
- Report missing tests or unavailable infrastructure honestly.

## First-Person Frontend Verification

- From `apps/game`, `npm test` runs movement/collision/grass-target tests and embedded Remy GLB integrity/material tests using Node's native TypeScript stripping (Node 22.18+).
- `npm run test:browser` uses the existing Puppeteer dependency with a disposable browser profile. Set `BROWSER_PATH` to a Chromium-family executable on other machines; the local default is Brave on macOS.
- Start Vite on port 5174, or set `TEST_URL` to the running development/production-preview URL. The browser test takes only the manual disable-feed path; it never starts a paid mission.
- Screenshots are generated under `apps/game/node_modules/.cache/runway-first-person/` and remain untracked. Tests check rendered pixel changes, grass release, pointer-lock exit, story completion/restart, and emulated touch movement.
- The active first-person environment combines code-generated geometry with self-hosted CC0 PBR textures, an HDR environment and an optimized imported tree. Sources/conversion are recorded in `docs/ASSETS.md`. `World3D.tsx` is preserved legacy work and is not the active renderer.
- From `apps/game`, `node --test environmentAssets.test.mjs` verifies environment hashes, PBR channels, embedded leaf alpha, texture sizes and model budgets. `TEST_URL=http://127.0.0.1:4175 node scripts/environment.browser.mjs` checks normal asset loading plus blocked-asset rendering/movement fallback and saves screenshots/frame-cadence evidence in `node_modules/.cache/runway-environment/`. Use a stable production preview when other sessions are editing; live HMR can invalidate pixel comparisons.
