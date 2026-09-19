# Repository Working Instructions

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
