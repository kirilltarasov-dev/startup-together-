# RUNWAY Brief

Status: **REDUCED MVP APPROVED WITH THREE SCENES AND VOICE**

Latest decisions and remaining owner checks: [active handoff](HANDOFF.md).
The user confirmed three hours remaining, teammate-owned Devin coding, a playable
hosted game, likely Vercel/Railway, server-side Vercel keys, and `gpt-live-1` voice.
Earlier question rounds below are historical prompts, not a request to repeat approval.

Source: [RUNWAY.md](../RUNWAY.md), 2,121 lines, received in commit `1988cd3`.
It describes a Cognition/Devin hackathon game; it is not the organizer's rulebook.
The original is preserved. The current user request governs time and authorization.

## Whole-Scene Realism Request (September 19, 2026)

After the bounded environment/grass upgrades, user requested better graphics for every entity, citing GTA VI as a visual reference. Research identified authored architecture/windows and furniture, character/hand assets, consistent PBR materials and baked static lighting as the appropriate next direction within Three.js. This is an aspirational quality target, not an attainable-quality guarantee or permission to use Rockstar assets. The earlier free-assets/existing-web-engine decisions and MetaHuman deferral remain in force. At 14:37 CEST the user selected **Take over, start now**, authorizing this grass/character-export session to take over completed VIS02 environment/prop ownership and start architecture/furniture replacement despite the freeze. Preserve the CHAR02 founder branch, RemyFounder, campaign logic and all other work. Free downloads and local conversion are authorized; no paid services, engine migration or publishing. Campaign logic remains another session's lane.

## Environment Realism Decision (September 19, 2026, 14:15 CEST)

After reviewing research on authored environments, PBR assets, Gaussian splats and Unreal Pixel Streaming, the user selected **Free assets, existing game** and **Yes, protect submission**. Retain the documented 14:59 CEST deadline and 14:29 feature freeze. Target a substantially more realistic environment without promising Unreal/Lumen parity. Proposed next pass: free license-verified PBR surfaces, courtyard lighting and an optimized tree replacement; preserve first-person movement, interactive grass, story, voice/backend boundaries and separate founder work. User explicitly approved this bounded implementation at 14:18 CEST. Current Devin claims only environment materials, lighting and tree integration; preserve existing founder integration and other lanes. No paid assets/services, engine migration, whole-scene rebuild, commit, push or deployment is authorized by this decision. The bounded local pass is implemented and verified as VIS02 in `PLAN.md`; asset provenance and conversion are in `ASSETS.md`. Real PBR brick/pavement, HDR lighting and an optimized imported tree replace the relevant placeholders; simple architecture/windows, generated wood/soil and two founder placeholders still limit realism. User visual acceptance and signed-out deployed verification remain outstanding.

## Grass Reference Split (September 19, 2026, 14:22 CEST)

User supplied a sunlit foliage screenshot and selected **Split work** plus **Defer MetaHuman setup**. VIS02 continues its claimed lighting/material/tree pass. The character-export session owns only interactive grass and ground-cover rendering plus isolated tests: varied clumps, tapered blades, natural color variation and limited seed heads, preserving movement, brushing and reduced motion. Keep the existing browser engine and submission deadline. This is not authorization for an engine migration, Epic cloud uploads, MetaHuman setup, paid services or publishing. The screenshot is a visual direction, not an achieved-quality claim.

## First-Person Amendment (September 19, 2026)

The user requests realistic, genuinely three-dimensional environments and grass they can interact with. They selected first-person movement and explicitly authorized this Devin session to take over frontend/3D implementation while preserving existing uncommitted changes. This supersedes fixed-camera, panorama/billboard-only, and primitives-only restrictions for this visual/input upgrade. Keep the existing three story locations and five-event loop; add a small courtyard as part of a location, not another story chapter. Grass bends under footsteps and a nearby brushing interaction. No new backend, paid integration, or story systems are authorized by this amendment.

## Imported Human Asset Amendment (September 19, 2026)

The user explicitly requests replacing primitive founder figures with licensed, clothed, textured, rigged human assets in the active `FirstPersonWorld` / `SceneEnvironment` renderer. This supersedes the earlier primitives-only character restriction. Prove one seated founder in the actual room first, then extend to three distinct founders. Preserve movement, collision, grass, voice/button input, missions, scenes, ending and restart. PNG billboards and more detailed procedural mannequins do not satisfy this requirement. Keep authored materials, skeleton-compatible animations, independent skeleton clones, reduced motion and pause behavior. No commit, push, merge or deploy is authorized by this request. The user has now supplied `Remy.fbx`. One textured rigged model is integrated in the Kirill slot as a locally fitted static seated pose; its supplied action was only two frames. A compatible seated motion clip and two distinct founder assets remain outstanding. See `ASSETS.md` for provenance, conversion and verification evidence.

## Sergio Integration Amendment (September 19, 2026, 14:36 CEST)

User now requests placing the Sergio reference asset in the game in the correct format. This authorizes the current environment session to integrate a browser-ready GLB into Sergio's right-hand founder slot, superseding the standalone-only restriction for this derivative. Preserve the supplied PNG and all standalone FBX/GLB/Blender exports. Fit a static seated derivative to the current desk rather than replay standing/walking clips through furniture; preserve original animation exports separately. Keep other founders, environment, grass and campaign work intact. Exact likeness, new facial animation and publishing are not part of this placement request. The seated GLB is now integrated and locally verified in CHAR02 (`PLAN.md`); conversion/source evidence is in `ASSETS.md`. Human visual approval and deployed verification remain separate.

## Standalone Reference Character Export (September 19, 2026)

User supplied `Downloads/ChatGPT Image Sep 19, 2026, 01_55_43 PM.png` and selected a complete character, RUNWAY destination, realistic close-match target, rig plus animations, basic speech/blinking, and local tools only. User then authorized immediate construction without further questions. Additional views were offered but not supplied. Working defaults: infer unseen surfaces, idle/walk/talking clips, FBX plus browser-friendly GLB. Existing local Remy anatomy/rig may serve as a base; photographic identity and garment accuracy remain unverified requirements, not achieved quality. Export separately without modifying the game integration or existing Remy files. No uploads, service purchases, commit, push, or deployment authorized.

## Round 1: Scope-Defining Questions

1. Who owns the Devin account, and are API access, credits, and repository permissions already working?
2. Do you approve five authored events, one fixed-camera 3D set in two locations, one real mission, an investor choice, and one ending?
3. What exact submission time applies today, September 19, 2026, in Budapest, and how long is the presentation?
4. What must judges be able to do at the public URL, beyond watching the live stage demonstration?
5. What are the three teammates' names, strengths, and current assignments? Has anyone already started coding?
6. Where are the organizer's judging criteria and rules about prerecorded fallbacks and external assets?

An answer of "undecided" is useful. The director should offer one recommendation
for each undecided item and obtain scope approval. Do not paste credentials here.

## Original Script

Source: `RUNWAY.md`, preserved verbatim.

Conflicts: its build schedule assumes five hours; the user has three. It makes
3D optional; the user requests 3D. Its instruction to implement immediately does
not override the user's request to discuss and approve the plan first.

| Requirement ID | Exact source or script beat | Player action / visible result | MVP or deferred | Acceptance check |
| --- | --- | --- | --- | --- |
| R01 | Section 31: opening and three founders | Short reveal and distinct founders | MVP | First action within 10 seconds |
| R02 | Budapest hackathon environment | Readable 3D startup set | MVP | Scene screenshot |
| R03 | HUD and state-changing choices | Cash, users, runway, health, morale | MVP | UI matches centralized state |
| R04 | 5-8 events | Exactly five authored decision events | MVP | Full deterministic playthrough |
| R05 | User update: three scenes | Budapest, Debrecen, proposed investor room | MVP | All three scenes reachable and distinct |
| R06 | One real production incident | Existing slow feed challenge | MVP | Frozen baseline measurement |
| R07 | One real Devin mission and code change | Budgeted session and candidate commit | MVP | Session ID, exact diff and commit |
| R08 | Real independent verification | Trusted tests and benchmark | MVP | Verifier-owned evidence |
| R09 | Game follows actual result | Apply matching terminal result once | MVP | Success/failure/stale-result tests |
| R10 | Investor interaction | One fixed offer and explicit tradeoff | MVP | Consistent cash/equity consequence |
| R11 | One ending | One result screen with outcome variants | MVP | Reachable ending and restart |
| R12 | Animation/audio/visual feedback | Intentional camera and founder reactions; a few muted-capable cues | MVP, audio time-boxed | Browser and human checks |
| R13 | Section 33: demo safety | LIVE / CACHED REAL RUN / MOCK distinguished | MVP | Failure rehearsal |
| R14 | User update: voice | GPT-Live 1 with button fallback | Requested | Voice action and microphone-denial paths tested |
| R15 | Balaton, VC boss | Not implemented | Deferred | Not in build plan |

## Experience Contract

| Decision | Approved answer |
| --- | --- |
| Game title and one-sentence premise | RUNWAY: keep a startup alive with Devin as the real engineer |
| Intended player and judging goal | Hackathon audience; make real engineering affect a game |
| Core player verb | Choose a startup response; trade resources and consequences |
| Why 3D improves this mechanic | Founder reactions and changing room make abstract stakes visible |
| Camera and input | Proposed: fixed isometric/three-quarter camera, pointer choices |
| Start state and first actionable object | Source: EUR 37, 0 users, health 55, morale 80; company premise choice |
| Goal and exact completion rule | Proposed: resolve incident and investor decision, then survival result |
| Failure rule, if the game needs one | Cash/health thresholds TBD; failed mission must remain playable |
| Target session length | Source: 5-8 minutes; stage duration and live-wait budget TBD |
| Required story beats and ending | Five-event adaptation in `DIRECTION.md`; ending thresholds TBD |
| Visual direction and available assets | Proposed reusable low-poly set; pack not yet selected |
| Audio requirement and muted behavior | Short cues only; mute; never required to understand state |
| Target device, browser, and narrow-screen behavior | Desktop-first source; demo device TBD; no mobile game scope |
| Mandatory integrations and approved fallback | Real Devin, independent verifier, clearly labelled cached/mock modes |
| Deployment account and public access requirement | Likely Vercel + Railway; judges must play the hosted game |
| Founder names | Kirill, Sadman, Sergio (approved 12:35) |
| Voice | Mandatory: three gpt-live-1 moments, `VOICE.md` |
| Movement | Arrow keys / WASD, hotspots, no physics |
| Teammate names and owners | TBD |
| Actual sprint start / hard submission deadline, CEST | Three hours remaining recorded 11:59; working cutoff 14:59, September 19, 2026 |
| Demo duration and submission deliverables | TBD |
| Permission for templates, external assets, and AI tools | TBD |

## Proposed MVP Boundary

Three 3D scenes reusing set assets, three distinct founders, five
authored events, one feed-performance mission, one investor choice, and one ending
screen with outcome variants. Keep state small and effects declarative.

Exclude multiplayer, player accounts, persistent game databases, open worlds,
free movement/physics, custom rigs, dynamic company generation, Balaton,
the VC boss, and additional engineering incidents. SQLite remains inside the
existing challenge; it is not an orchestrator database.

The reason to include a feature must be a judging requirement or a necessary
part of the approved player loop. "We might scale later" is not sufficient.

## Round 2: Creative Decisions

- What are the other two founders called, and should they resemble the team?
- What can the player understand and affect within the first ten seconds?
- How much profanity fits the audience, without nationality becoming the joke?
- How can the player get stuck, and what resets that situation?
- What is the maximum live wait before an explicitly labelled real-run replay?
- What can we remove without losing the point of the game?

## Gate 0: Permission to Implement

- [x] Script reviewed and proposed requirements mapped to acceptance checks.
- [x] Reduced playable scope approved; detailed effect values owned by gameplay lane.
- [ ] Target platform, input, art direction, and asset approach agreed.
- [ ] Devin access, spending limit, isolated challenge, and fallback honesty agreed.
- [ ] Three owners, actual deadline, and presentation length recorded.
- [ ] Hosting path and account owner identified.
- [x] Reduced MVP accepted, amended to three scenes and requested voice.
- [x] User authorizes teammates' implementation; this window remains coordination-only.

Approved by: **User in this conversation**. Recorded: **September 19, 2026, 11:59 CEST**.
Unchecked access and safety details are assigned owner checks, not a global coding hold.
