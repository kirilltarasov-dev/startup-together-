# Acceptance and Demo

Status: **CHECKLIST ONLY. No application tests, screenshots, or builds have run.**

## Definition of MVP

A judge can open the agreed build, make startup decisions, see a game consequence
from a genuinely verified Devin repair, and restart. Every mandatory requirement
in `BRIEF.md` has evidence. Decorative 3D or simulated engineering alone does not
satisfy RUNWAY's technical premise.

## Gates

| Gate | Required evidence |
| --- | --- |
| G0: Brief | Approval checklist in `BRIEF.md`; no implementation before approval |
| G1: Technical proof | 3D set visible; frozen baseline; authorized Devin mission started; unavailable access leaves gate open |
| G2: Greybox game | Five events, three scenes, three distinct founders, ending/restart; MOCK contract and rule tests pass |
| G3: Real integration | Exact real candidate independently verified; consequence applied; authentic replay artifact captured |
| G4: Release candidate | Validation below passes on an identified build and deployed URL |
| G5: Submitted | Two rehearsals, backup recording/local build, submission confirmed |

## G4 Checks

### Logic and Code

- [ ] Type checking, linting, focused tests, and production build succeed.
- [ ] Initial state, primary action, completion, and restart are covered.
- [ ] Invalid/repeated actions cannot duplicate rewards or bypass the goal.
- [ ] Pause prevents gameplay advancement; resume does not jump simulation time.
- [ ] The ending follows the approved rules, not a hidden demo-only shortcut.
- [ ] Cash/burn boundaries, zero burn, clamping, and investor effects have defined tests.
- [ ] Pending provider work cannot cause unbounded resource loss.
- [ ] Duplicate clicks do not create duplicate paid tasks.
- [ ] Stale or repeated mission results cannot change the new run or award success twice.
- [ ] Lockfile and configured Node version reproduce on a second teammate's machine.
- [ ] No credentials, unrelated files, or unreviewed generated code in the change.

Existing `apps/game` scripts include `build` (TypeScript plus Vite) and `lint`
(Oxlint). T01 must verify them and add focused logic/browser test commands.
The challenge already has pytest tests and a benchmark; neither has run here.

### Browser and 3D

- [ ] Complete start -> play -> result -> restart using real browser input.
- [ ] No application exceptions, failed critical requests, missing textures, or decoder errors.
- [ ] Playwright screenshots at 1440x900 and 390x844 inspected for framing and overlap.
- [ ] Inspect captured canvas pixels for actual scene content, not just a canvas element.
- [ ] Capture before/after the core input; verify the expected rendered object/state changes.
- [ ] Verify expected animation/movement across frames; HUD-only changes are insufficient.
- [ ] Canvas, hit targets, and HUD remain aligned after resizing.
- [ ] Keyboard focus and controls work; pointer lock can be exited if it is used.
- [ ] Narrow-screen behavior matches the brief; viewport emulation alone does not prove physical-device support.
- [ ] Loading, unavailable assets, unsupported graphics, and restart have usable recovery.
- [ ] Audio, if included, starts after user interaction and mute works.
- [ ] Requested GPT-Live 1 voice uses server-created sessions; microphone denial,
  interruption, mute, disconnect, and session closure work; buttons remain usable.
- [ ] Voice dispatches the same validated actions and cannot bypass paid-task confirmation.
- [ ] LIVE, CACHED REAL RUN, and MOCK are visibly distinct; activity is not invented.
- [ ] Test failures, provider errors, attention requests, throttling, timeout,
  cancellation, and replay switching remain navigable.

Use PNG screenshots of the canvas for pixel checks; do not rely on a preserved
WebGL drawing buffer or introduce expensive renderer settings just for tests.
Visual checks must inspect the expected game action, not merely count changing
background pixels.

### Proposed Performance Budget

These are project targets awaiting the actual demo device, not measured results.

- First usable scene within 5 seconds on the presentation network after a cold load.
- At least 30 FPS during a 60-second play session on the demo laptop; target 60.
- Initial critical downloads target <= 10 MB transferred, including required assets.
- No progressive slowdown, duplicated listeners, or duplicated timers after three restarts.

Measure with the production build and record device, browser, and method.
If a target fails, reduce download sizes, effects, shadows, and render resolution
before adding complexity. Automated headless timing is not a substitute for a
measurement on the presentation laptop.

### Deployment

- [ ] Deployed commit/build identified and opens in a signed-out browser.
- [ ] Another teammate can open it without the owner's hosting login.
- [ ] Refresh works; asset URLs resolve from the actual hosted base path.
- [ ] Hosted behavior matches the local production build.
- [ ] Required integrations have explicit timeout/error behavior and approved fallback.
- [ ] Hosted mode cannot trigger paid work unless explicitly authorized and protected.
- [ ] Secrets and unredacted provider logs are absent from browser bundles and replay artifacts.
- [ ] External asset sources, license evidence, and hackathon eligibility recorded.
- [ ] Submission URL, materials, and format match the organizer's requirements.

If GitHub Pages is selected, configure the repository base path and test asset
URLs there. Push access does not establish permission to change hosting settings.
Account availability and any publishing action must be confirmed separately.

### Real Engineering Evidence

- [ ] Approved baseline SHA and actual candidate SHA recorded.
- [ ] Candidate changes constrained to the approved challenge scope.
- [ ] Frozen verifier-owned tests and benchmark used, not agent-reported outcomes.
- [ ] Candidate executed in the restricted runner described in `DEVIN_CONTRACT.md`.
- [ ] Before/after use the same workload, units, environment, and acceptance rule.
- [ ] UI labels function benchmark timings honestly; no fabricated HTTP/p95 claims.
- [ ] Actual test totals displayed; the source's example "43/43" is not hard-coded.
- [ ] At least one genuine run independently verified before marking G3 complete.
- [ ] Cached evidence identifies its original session, time, commits, and harness.

## Evidence Log

| Gate/check | Build/commit | Device/browser | Result | Evidence path or URL | Reviewer |
| --- | --- | --- | --- | --- | --- |
| All application gates | None | Not tested | NOT RUN | None | Unassigned |

Record browser artifacts under `output/playwright/` when tests exist. Do not
commit generated screenshots or recordings by default; share only selected
evidence with explicit intent.

## Demo Runbook

Presentation length: **TBD**. Suggested 90-second narration, excluding unpredictable
live execution time. Set a maximum wait and rehearse the labelled replay fallback.

| Time | Presenter action |
| --- | --- |
| 00-15 | Establish three founders, EUR 37, and the startup survival objective |
| 15-40 | Make decisions, show Debrecen, reach the production incident |
| 40-60 | Trigger real Devin; show actual repository/session, not fake progress |
| 60-75 | Show verified result if ready, or explicitly switch to a genuine prior run |
| 75-90 | Show the game consequence and explain that real code changed the outcome |

- Rehearse twice with the actual presentation laptop, browser, and network.
- Keep the last known working production build available locally.
- Record a short video of the actual working build before the deadline.
- Clearly label a recording as a recording if it must replace the live demo.
- Do not claim unfinished features, mocked integrations, or untested platforms.
- Record the submission confirmation before calling the hackathon delivery complete.
