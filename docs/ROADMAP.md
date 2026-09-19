# Third-Person Vertical-Slice Roadmap

Governing intent: PRODUCT_VISION.md. The prior first-person release is preserved; these are new acceptance gates, not a declaration that every requested system already exists.

## Phase 0 — Audit and authority

Audit completed against baseline `2bea46f`: retain story/campaign, voice, Devin contracts, imported art, grass and tests. Replace overlay-first entry, camera-only player and handwritten movement collision. Record the nine requested architecture documents and precedence in AGENTS/HANDOFF. Process the supplied Cognition logo without inventing a replacement.

## Phase 1 — Embodied foundation (current milestone)

Pin compatible Rapier/ecctrl releases. Separate controller/model/animator/customization. Load one standing textured rigged human, third-person orbit/follow camera, camera obstruction handling, floor/wall/furniture colliders, movement/run/jump support and contextual story access. Keep the same decision API for buttons/voice. Existing PBR/HDR/shadows remain.

Exit evidence: visible human traverses the interior door and courtyard; collision and camera checks; pause/interaction input isolation; story/manual mission path still works; no T-pose as a finished idle. Missing authored animation slots are disclosed.

## Phase 2 — Beauty and connected pond

Fit character pose/animation, authored materials and lighting. Integrate WaterSurface, moving normals, reflection/sun response and shoreline. Profile restrained post-processing, preserve sharp gameplay visibility. Review a continuous interior-to-water route at human scale. Obtain a second distinct selectable character where practical; otherwise report the exact missing asset/clip rather than fake it.

## Phase 3 — World systems and budgets

Implement sector residency/preload/unload and low-detail shells with collision readiness. Quality presets and independent effect budgets; instanced vegetation, LOD/distance density, telemetry. Benchmark Meshopt/Draco and KTX2/WebP candidates against existing assets. Separate WebGPU/TSL spike and a measured comparison; no production switch without benefit and compatibility evidence.

Exit evidence: route-based frame timings/screenshots, bounded residency, failure/retry tests and measured transfer/decode behavior. Texture memory estimates labelled. Tests run on a stable snapshot, not a changing shared dev server.

## Phase 4 — Expansion (gated)

Additional regions, NPCs, characters, buildings, vehicles and gameplay only after visual review accepts the slice. No city expansion to hide a weak room/character/camera foundation.

## Verification

Retain `npm test`, `npm run lint`, `npm run build`, campaign browser checks and existing asset-integrity checks. Add third-person browser tests for locomotion, wall/furniture contact, camera orbit/occlusion, character changes, interaction pause, recovery and narrow input. Never start paid Devin/voice operations for visual tests. Public signed-out deployment verification remains a separate gate.

The previous 14:59 hackathon deadline has passed; this phased reorientation must not be represented as delivered under that deadline. Current task status/evidence belongs in PLAN.md.
