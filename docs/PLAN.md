# Delivery Plan

## Third Founder FBX (September 19, 2026, 15:07 CEST)

| ID | Owner | Claimed files | Status | Acceptance |
| --- | --- | --- | --- | --- |
| CHAR03 | Current graphics/character export session | `scripts/convert-remy.py` namespace handling, `public/assets/founders/sadman-seated.{glb,json}`, `src/scenes/RemyFounder.tsx` asset union and `SceneEnvironment.tsx` founder branch only; focused asset test and this record | DOING | User supplied `Downloads/Ch06_nonPBR.fbx` and a four-minute window. Interpreted as the remaining third founder, not takeover of the separately claimed third-person camera/controller. 65-bone rig and embedded textures verified; export a static seated derivative, preserve source and other owners' work. No commit/push/deploy authorized. |

## Master Third-Person Reorientation (September 19, 2026)

Latest user instruction supersedes the first-person, primitives-only, no-physics and no-character-selection restrictions below. High-quality immersive 3D is mandatory. Branch: `feat/third-person-foundation`, baseline `2bea46f`; previous release remains on main. Current integration owner claims the requested nine architecture documents, AGENTS/HANDOFF authority updates, logo pipeline, `src/characters/`, `src/world/`, World integration, frontend dependencies and associated tests. Preserve story/campaign, voice and Devin infrastructure. No other lane's unfinished edits existed at branch creation.

Phase 0 audit: DONE (existing first-person controls, handwritten collisions, overlay-first flow, static seated characters and eager world mounting identified). First milestone: DOING (Cognition branding, a visible rigged third-person human, Rapier/ecctrl movement/collision/follow camera, preserved story access). Later phases remain pending until measured: water/shoreline, streaming/LOD/quality/telemetry, compression comparison and isolated WebGPU spike. Full city/vehicles/NPC expansion is not approved before the slice passes visual review. The earlier 14:59 cutoff has passed; do not call the reorientation complete based on the prior release's tests.

## Release Handoff (September 19, 2026, 14:53 CEST)

User explicitly requested pushing all remaining repository work. Runtime campaign and verified graphics are already published at `af8263f`; this follow-up publishes the coordination records and standalone character build/verification scripts. Local source downloads, private environment variables, ignored caches and generated build output remain excluded. Latest checks: 25 tests pass, full production build passes, campaign and demo browser paths passed earlier in this release. Public deployment, live provider behavior and one-hour pacing remain unverified. Storyline continuity/pacing review remains a requested follow-up; do not equate 35 encounters with a measured hour.

## Sergio In-Game Asset (September 19, 2026, 14:36 CEST)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| CHAR02 | Current VIS02 Devin, user-approved asset integration | `apps/game/src/scenes/RemyFounder.tsx`, founder branch only in `SceneEnvironment.tsx`, new `public/assets/founders/sergio-seated.{glb,json}`, `scripts/seat-sergio.py`, `sergioAsset.test.mjs`, `scripts/sergio.browser.mjs`; this checkpoint, brief, asset provenance and latest handoff | DONE | Reference-derived Sergio occupies the right-hand seat as an embedded 6,527,072-byte GLB, 18 meshes / 67 bones, with a locally fitted static seated pose. Source image and standalone exports preserved; source Blender hash unchanged. Fifteen focused logic/asset/grass checks pass; full typecheck/build passes after campaign-owner edits settle; changed files lint clean. Stable desktop/front/side/narrow captures and model-load fallback pass, with full five-event story/touch regression and no normal-path browser errors/missing assets. No campaign/grass/backend edits, dependencies, commit or deployment by this task. |

Checkpoint 14:41 CEST: approximately 18 minutes to 14:59 cutoff. Verified snapshot: `apps/game/node_modules/.cache/runway-sergio-build/`, preview port 4177, bundle `index-BdbgH0lX.js`. Captures/report: `node_modules/.cache/runway-sergio/`; full regression captures: `runway-first-person/`. Snapshot includes then-current campaign-lane changes, but this task verifies the original five-event path, not the new campaign. Main bundle-size warning remains. Earlier live character capture collided with a chair; the dedicated Sergio route avoids the collider without changing movement rules. Narrow capture explicitly checks the active canvas so Puppeteer's device-mode reload cannot produce a false positive. Owner next action: user visual approval / frontend owner integration; signed-out deployed validation remains outstanding. No further character animations or likeness work before submission; the model remains a Remy-derived approximation, not an exact photographic reconstruction.

## Whole-Scene Graphics Audit (September 19, 2026)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| VIS03 | Character/grass session, user-approved environment/prop takeover at 14:37 CEST | `SceneEnvironment.tsx` environment/prop sections only; new `ArchitecturalDetails.tsx`, `RealisticFurniture.tsx`, `public/assets/realism/`, `scripts/prepare-realism.py`, `scripts/export-realism.py`, `realismAssets.test.mjs`, `scripts/realism.browser.mjs`; this section, corresponding brief and `ASSETS.md` provenance | DONE | Approved architecture/furniture pass implemented and locally verified. Replaced flat background windows with instanced CC0 recessed window/door/wall modules and trim; replaced block chairs/desk with textured chairs and three worktables; added loft ducts/baseboards and small-prop bevels. Three new GLBs total 2,202,372 bytes. Preserved CHAR02 founder integration, campaign files, lighting/trees/grass and collision footprints. New asset tests 2/2; combined existing campaign/movement/Remy tests 17/17, environment+grass 5/5 and Sergio 1/1. Typecheck/build pass; changed files lint clean; project lint 0 errors / 14 inherited warnings. Full desktop/narrow demo browser regression passes; all three normal asset requests succeed and blocking all three still renders fallbacks with movement. No paid assets, engine migration, MetaHuman restart, commit/push or deployment. |

Verified candidate sources: `https://polyhaven.com/a/modular_factory_facade` (industrial wall/window/door modules; site lists 175K triangles and a selected download around 901 MB, so select/optimize modules and textures rather than shipping the source package); `https://polyhaven.com/a/SchoolChair_01` (5K triangles); `https://polyhaven.com/a/wooden_table_02` (196 triangles). All are covered by `https://polyhaven.com/license` (CC0). The selected 1K source packages were subsequently downloaded and checksum-verified; compact exported modules and props passed runtime checks. Source and runtime evidence is in `public/assets/realism/{sources,exports}.json` and `docs/ASSETS.md`. Rejected Gothic WoodenChair_01/Sofa_01 as a poor visual fit. Three.js MeshStandardMaterial supports baked light maps, while GLTFLoader supports KTX2 and Meshopt with configured decoders; none of those new pipelines has been installed or implemented in VIS03. Recommended order: facade/windows, furniture/props, character/hand replacements, then baking and final lighting. Preserve traversal and story interfaces.

VIS03 checkpoint 14:49 CEST: about ten minutes to documented cutoff. Owner hands off the bounded graphics pass; next action is human visual approval and release-owner deployment checks, not additional art scope. Verified snapshot: `node_modules/.cache/runway-realism-build/`, bundle `index-gdt_nyR4.js`, preview port **4181**. Port 4177 was already occupied by the character session; its earlier unrelated test results were excluded and both browser suites rerun against 4181. Evidence: `node_modules/.cache/runway-realism/{facade-detail,furniture-detail,narrow-workspace,asset-failure-fallback}.png` plus `report.json`. The asset monitor was corrected to treat valid HTTP 304 cache responses as successful loads. Full demo regression passed on 4181 with no browser errors or missing assets. The campaign owner still verifies any newer campaign changes separately. Main bundle-size warning remains; no device-wide FPS guarantee. Remaining all-entity realism gaps: Sadman/hand, some props and room surfaces, authored animation and baked indirect lighting. Do not label this GTA VI or Unreal parity; keep those larger phases out of this delivery unless separately authorized.

## Campaign Expansion (user override, September 19, 2026, 14:30 CEST)

User explicitly chose "Expand campaign now" after the freeze/deadline risk was explained. Kirill's integration session claims only `apps/game/src/{events,engine,state}/` campaign logic, `scenes/{Opening,Play,Result,Ending}.tsx`, `components/EventCard.tsx`, campaign tests and app test commands. Keep the five-event demo intact; add a separate authored campaign with branching consequences, local save/resume and campaign endings. One-hour duration is a target, not verified. Do not add paid missions or voice moments beyond the existing contracts. VIS02 owns environment/lighting; GRASS01 owns grass; no edits to their files. Status: DONE for the extended campaign beta (not for one-hour pacing). Added 35 encounters, five chapters, conditional follow-ups, local save/resume, cashflow and endings while retaining the five-event demo. Eight campaign tests exercise 100 paths; full 35-encounter unpaid browser playthrough, save/reload/resume, narrow ending and demo regression pass. Published campaign commit `dc81b72`; integrated verified visual handoffs in separate commit `af8263f`. Combined suite: 25 tests pass; production build passes; 14 inherited lint warnings, no errors. No paid API calls were made in tests. One-hour pacing still requires timed human playtesting; public deployment validation is outstanding. Standalone export drafts remain local.

## Grass Reference Pass (September 19, 2026, 14:22 CEST)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| GRASS01 | Character-export Devin session, user-approved split | Only `apps/game/src/scenes/InteractiveGrass.tsx`, new `apps/game/src/scenes/grassField.ts`, `apps/game/grassField.test.ts`, `apps/game/scripts/grass-reference.browser.mjs`; this checkpoint and brief amendment | DONE | Scoped grass implementation and local checks complete: clustered curved blades, rounded clover, sparse seed heads, coherent color variation and corrected dark back-face shading. Three new deterministic/distribution/budget tests plus nine existing tests pass. Typecheck/build pass; changed source/test files lint with zero warnings/errors. Production browser checks pass: desktop/narrow movement, contact pixels, release recovery, pointer-lock exit, full manual story, restart; no browser errors or missing assets. VIS02 retains lighting, trees, materials and shared scene files. No dependencies, shared-scene edits, publishing or asset uploads. MetaHuman setup explicitly deferred. |

Checkpoint 14:30 CEST: about 29 minutes to 14:59 cutoff; feature freeze is active. Owner: grass session hands off verified source, with no further feature work. Latest verified snapshot: `apps/game/node_modules/.cache/runway-grass-build/`, preview port 4176, bundle `index-B1cVPndW.js`. It includes the then-current VIS02 work, not subsequent edits. Main bundle-size warning remains. Grass uses 58,400 instances / 496,000 triangles across three draws, versus the original 64,000 / 512,000 in one draw; this is a geometry budget, not a measured FPS claim. Geometry is locally authored, with colors derived from existing MATERIAL entries; no external grass asset license is required. Qlab MCP discovery was unavailable; no UI redesign or token-system migration attempted. Visual review shows more varied ground cover, not photographic/Unreal parity. Human acceptance and signed-out deployed validation remain outstanding; deployment is not authorized in this lane.

Verification from `apps/game`: `node --test grassField.test.ts`; `npm test`; `npm run build`; targeted `npm exec oxlint -- src/scenes/InteractiveGrass.tsx src/scenes/grassField.ts grassField.test.ts scripts/grass-reference.browser.mjs`; `TEST_URL=http://127.0.0.1:4176 npm run test:browser`; `TEST_URL=http://127.0.0.1:4176 node scripts/grass-reference.browser.mjs verified`. Screenshots: `node_modules/.cache/runway-grass/verified-{courtyard,grass,narrow}.png` and existing first-person evidence folder. Early development captures were invalidated by another session's HMR / incomplete tree export; final verification used an isolated production snapshot. VIS02 must preserve the claimed grass files.

## Environment Visual Pass (September 19, 2026, 14:18 CEST)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| VIS02 | Current Devin, user-approved A/B environment pass | `apps/game/src/scenes/FirstPersonWorld.tsx`, `SceneEnvironment.tsx` (environment only), `sceneMaterials.ts`, new `EnvironmentAssets.tsx`, `public/assets/environment/`, `scripts/{prepare-environment.py,prepare-tree-textures.mjs,optimize-environment-tree.py,inspect-environment.mjs,environment.browser.mjs}`, `environmentAssets.test.mjs`, this checkpoint, realism brief, asset provenance and `AGENTS.md` verification amendment | DONE | Local bounded pass verified: CC0 PBR brick/pavement, HDR lighting, optimized textured tree with corrected leaf export and independent material clones. New asset tests 2/2, existing tests 9/9, separate grass tests 3/3, typecheck/build pass; changed files lint clean, project lint 0 errors / 14 existing warnings. Production browser regression passes desktop/narrow movement, grass release, pointer-lock exit, all scenes, ending/restart. Asset failure test blocks all 8 resources and verifies rendered fallback pixels/movement. Human visual acceptance and deployed validation remain outstanding. No publish or dependencies added. |

Checkpoint 14:34 CEST: about 25 minutes to 14:59 cutoff; feature freeze active. Verified production preview is port 4175, bundle `index-BOCJA6DC.js`; screenshots/report under `apps/game/node_modules/.cache/runway-environment/`, full regression evidence under `runway-first-person/`. All 8 normal asset requests succeeded without browser errors; headless Brave sample at 1440x900 was 60.00 FPS, p95 16.7 ms, not a device-wide performance guarantee. Tree is 64,938 triangles / 7,999,608 bytes; total added runtime art is 14,782,344 bytes. Source textures/Blender remain ignored. A live-HMR test failed during concurrent development; stable production reruns passed. The post-freeze change corrected the Blender leaf color/alpha export rather than adding features. Founder/grass/voice/backend work is preserved. Owner next action: user visual approval, then frontend release owner verifies signed-out deployed URL if publishing is authorized; no commit/push/deploy performed here. Remaining visual limitations are simple architecture/windows, generated wood/soil and two placeholder founders; no Unreal/Lumen or baked-GI parity claim. No additional geometry/postprocessing scope before submission.

## Environment Realism Research (September 19, 2026, 14:15 CEST)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| VIS01 | Current Devin, visual research/coordination only | This section and the Environment Realism Decision in `docs/BRIEF.md`; no implementation files claimed | DONE | Reviewed the three user screenshots and active renderer; researched CC0 PBR/vegetation/HDR assets, complete environment packs, Gaussian splats and Unreal Pixel Streaming. Presented sources and limitations. User selected free assets in the existing game and reconfirmed 14:59 CEST deadline with 14:29 freeze. |

Checkpoint: approximately 44 minutes remain at the clock check. Latest recorded local game evidence is HUM01 below; no new build, browser test or deployment was performed for VIS01. Proposed A/B follow-up: PBR surfaces, courtyard lighting and an optimized tree asset, preserving gameplay and separate founder work. Specific implementation scope still awaits approval and coordination with existing `SceneEnvironment.tsx` ownership. No purchases, paid generation, engine migration or new services. Cut whole-scene replacement and experimental rendering; defer extra props/postprocessing if the freeze is threatened. Research verified license terms, not import suitability or asset performance; Poly Haven Tree Small 02 lists 5M triangles and must not be imported at full detail unchecked.

## Reference Character Export (September 19, 2026, 14:06 CEST)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| CHAR01 | Current Devin, standalone asset export | `apps/game/scripts/build-sergio-reference.py`, `apps/game/scripts/verify-sergio-reference.py`, new `Downloads/runway-sergio-reference/` output; this checkpoint and brief amendment | REVIEW | Local exports created: `sergio-reference.fbx` (25,236,780 bytes), `.glb` (11,228,964 bytes), editable `.blend`, textures, front/three-quarter previews and JSON evidence. Both exports reimport successfully with 67 bones, 18 mesh objects, weighted vertices, loaded textures, nonzero talking deformation and Blink/MouthOpen morphs. FBX has Idle/Walk/Talking takes with facial channels; GLB also has a separate Face_Blink_And_Speech clip. Approximate Remy-derived face and constructed clothing do not establish exact photographic likeness; human visual approval remains outstanding. |

Checkpoint: export/reimport checks passed at 14:14 CEST, about 45 minutes to the documented 14:59 cutoff; latest recorded game checks remain FP02 below. Owner: current Devin. Artifacts are isolated in Downloads; no game integration, external uploads, paid generation, commit, push or deployment by this task. Source `Remy.fbx` and existing game assets preserved. No additional views arrived; hidden details inferred. Base asset provenance/license still needs owner confirmation before distribution. Next smallest decision: accept the approximate asset visually or obtain a closer human base; game integration is excluded from this export task.

Reproduce locally using Blender 5.2: `blender --background --factory-startup --python-exit-code 1 --python apps/game/scripts/build-sergio-reference.py -- --source <Remy.fbx> --reference <reference.png> --output <new-directory>`. Verify with `blender --background --factory-startup --python-exit-code 1 --python apps/game/scripts/verify-sergio-reference.py -- <output-directory>`. The builder refuses an existing output directory unless explicitly passed `--overwrite`; no runtime dependency was added.

## Human Asset Upgrade (September 19, 2026, 13:42 CEST)

| ID | Owner | Claimed files | Status | Acceptance / blocker |
| --- | --- | --- | --- | --- |
| HUM01 | Kirill / current Devin, A+B | `src/scenes/SceneEnvironment.tsx`, new founder asset component, `public/assets/`, `scripts/` under `apps/game`; asset-specific tests; `docs/ASSETS.md`, `docs/BRIEF.md`, this checkpoint | DOING | User supplied `/Users/QXZ6WEJ/Downloads/Remy.fbx`: 67-bone rig, seven mesh parts and embedded textures verified in Blender 5.2.0 LTS. Only a two-frame pose action is present; seated animation requested. Convert and fit one static seated pose first, then verify browser screenshots before replacing other founders. |

The current renderer is `World -> FirstPersonWorld -> SceneEnvironment`; legacy `World3D` is not the integration target. First imported model is implemented and visually verified in the Kirill slot: static seated pose, textured materials and skeleton, private cloned materials/skeleton. Tests: 6 movement + 3 asset checks passed; lint 0 errors / 14 existing warnings; production build passed (bundle-size warning); desktop/narrow browser regressions and character screenshots passed without browser errors. Headless Brave sample: 30.00 FPS, p95 33.4 ms; not a guarantee of interactive GPU performance. User now explicitly authorizes pushing after verification. Separate CHAR01 scripts and its coordination drafts remain excluded. Remaining: seated motion clip and distinct models for the other founders; brushing hand stays procedural.

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

## First-Person Upgrade Handoff (September 19, 2026)

User approved first-person movement, modeled environments, and grass that reacts to walking and brushing. User explicitly handed this Devin session the frontend/3D lane and confirmed takeover of existing uncommitted work. Preserve that work; no backend or voice-lane edits.

| ID | Work item | Owner | Status | Evidence / acceptance |
| --- | --- | --- | --- | --- |
| FP01 | First-person scene, collision, interactive grass and game-overlay integration | Devin, user-authorized A/B takeover | DONE | Claimed frontend files implemented and verified in local production build. Preserved legacy renderer and unrelated uncommitted work. No new dependencies added by this session. |
| FP02 | Movement/interaction tests, hook-order fix, build and browser validation | Same owner | DONE | `npm test`: 6/6; `npm run build`: pass; lint: 0 errors, 14 pre-existing warnings. Puppeteer checks pass against both Vite and production preview: rendered pixels, grass bending/recovery, mouse capture/Escape, three-scene manual story path, ending/restart, 390x844 touch movement. No browser errors or missing local assets. |
| FP03 | Requested photoreal visual-quality pass | A/B, user review | REVIEW | Functional 3D is complete, but current generated materials, founder figures and trees remain stylized/procedural. Photoreal art quality is not claimed. User visual review and suitable higher-fidelity assets remain outstanding. |

First-person evidence: `apps/game/node_modules/.cache/runway-first-person/`. Local dev server 5174; production preview 4174. Browser tests use an isolated headless Brave profile through the already-installed Puppeteer, not Playwright. No paid mission, live voice, public deployment, or presentation-device FPS verification was performed. The production bundle still has Vite's >500 kB chunk warning. Qlab MCP discovery failed; existing project components/tokens were reused rather than adding an unverified UI dependency.

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
