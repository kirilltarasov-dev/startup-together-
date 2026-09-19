# Art assets — generate these NOW (Midjourney v7 / Flux / GPT-image)

## Architecture and Furniture Replacement (VIS03, September 19, 2026)

User authorized the grass session to take over environment/props and replace architecture/furniture while preserving the campaign, founder integration, lighting, tree and grass work. New runtime assets are self-contained GLBs under `apps/game/public/assets/realism/`. All source models are Poly Haven CC0 assets (https://polyhaven.com/license), downloaded via its public API with the RUNWAY user-agent and checksum verification; no paid service, account, asset upload or runtime external request is used.

| Runtime file | Source / author | Export |
| --- | --- | --- |
| `facade-kit.glb` | https://polyhaven.com/a/modular_factory_facade — James Ray Cock | Selected wide/narrow window-wall assemblies, recessed door-wall, cornice and base. 6,950 source triangles across five reusable modules; 512px textures; 1,233,508 bytes. GPU instanced placements reuse these modules rather than importing the full 175K-triangle source layout. |
| `school-chair.glb` | https://polyhaven.com/a/SchoolChair_01 — Ethan Place | 5,072 triangles, 1K textures, 483,764 bytes. Ground-centered and fitted to the existing chair footprint. |
| `wooden-table.glb` | https://polyhaven.com/a/wooden_table_02 — Serhii Khromov | 196 triangles, 1K textures, 485,100 bytes. Three worktables occupy the original desk collider footprint. |

Total new runtime GLBs: 2,202,372 bytes, before transfer compression. `sources.json` records upstream URLs/checksums; `exports.json` records exported hashes/budgets. Source glTF packages remain in ignored `node_modules/.cache/runway-realism-source/`. The first facade export failed its 6 MB budget test; reducing its background texture resolution produced the bounded export above, without relaxing the test. Added loft ducts/baseboards and small-prop bevels are local authored geometry, not externally acquired assets. This pass does not establish baked global illumination, full realistic character coverage or GTA VI-equivalent quality.

Reproduce from `apps/game`: `python3 scripts/prepare-realism.py --direct` (process-local direct public downloads; persistent proxy settings unchanged), then `blender --background --factory-startup --python-exit-code 1 --python scripts/export-realism.py`. Existing exports are refused unless `-- --overwrite` is explicitly supplied. `node --test realismAssets.test.mjs` validates embedded assets, hashes, named facade modules and download/triangle budgets. Browser verification is `TEST_URL=http://127.0.0.1:4181 node scripts/realism.browser.mjs`; it captures facade/furniture/desktop/narrow views and tests all three asset-failure fallbacks. Separate production snapshot: `node_modules/.cache/runway-realism-build/`; capture/report folder: `node_modules/.cache/runway-realism/`.

## Sergio Reference Model in Game (September 19, 2026)

User explicitly requested placing the previously generated Sergio reference asset in the active game. The runtime format is a self-contained GLB, not an FBX or a PNG billboard: `apps/game/public/assets/founders/sergio-seated.glb` (6,527,072 bytes), with hash/pose evidence in `sergio-seated.json`. It replaces only the right-hand Sergio slot at x=1.8; Kirill's Remy asset and Sadman's fallback are preserved. `RemyFounder.tsx` accepts the limited `remy`/`sergio` asset variants, retaining independent skeleton/material clones, head reactions and reduced-motion behavior.

Source: `/Users/QXZ6WEJ/Downloads/runway-sergio-reference/sergio-reference.blend`, SHA-256 `dabc28fc0d13d7c28c4f1cb463d217b2e81bc265425b781a111bbf98b0bd13e0`. It is the local Remy-derived adaptation of user-supplied `ChatGPT Image Sep 19, 2026, 01_55_43 PM.png` (reference SHA-256 `777b8a7dc38ee76fcccaff20dd8e459e34697cd0c899d50f1055425dc5be5159`), with the jacket projection, modeled sleeves/trousers, hat and accessories. Remy source/license evidence is recorded below; no new external asset/provider was used. Face remains the base model's approximation, not an exact recovered likeness.

Conversion preserves 18 skinned meshes, 67 bones, reference outfit and morph data. A locally fitted static seated pose puts the hips at 0.63m and the model within z-up bounds 0.015m to 1.463m. Textures are capped at 1024 pixels; opaque images use JPEG quality 82 and alpha images retain PNG. Original Idle/Walk/Talking/facial clips remain in the untouched standalone exports; this in-game derivative intentionally contains no animation clips, so standing locomotion cannot override the seated pose. Source file hash is checked before/after export. Preview floor/cameras/lights are excluded.

Reproduce from `apps/game`: `blender --background --disable-autoexec /path/to/sergio-reference.blend --python-exit-code 1 --python scripts/seat-sergio.py -- /absolute/output/sergio-seated.glb`. Existing output is refused unless `--overwrite` is explicitly supplied after the output path. No source image or standalone FBX/GLB/Blender export is overwritten.

Verification: `node --test sergioAsset.test.mjs` checks GLB/hash, embedded assets, skinning, outfit mesh names, seated bounds, size budget and absence of standing animation. `TEST_URL=http://127.0.0.1:4177 node scripts/sergio.browser.mjs` captures front/side/narrow views and blocks only Sergio's GLB to check isolated fallback and movement. Evidence is under `node_modules/.cache/runway-sergio/`. The existing `character.browser.mjs` route hit a chair collider while repositioning; the Sergio-specific route stays outside the table/chair colliders rather than weakening collision rules. Full first-person story/touch regression also passes against the stable Sergio snapshot. Initial full-build errors in in-progress campaign code were resolved by that owner; the full typecheck/build then passed without changes to the campaign lane. No paid mission, live voice, publishing or deployment was performed for CHAR02.

## CC0 Courtyard Environment Pass (September 19, 2026)

VIS02 uses self-hosted Poly Haven assets under CC0: https://polyhaven.com/license. No paid service, runtime CDN or API dependency was added. The user approved process-local direct downloads after the configured proxy failed DNS resolution; persistent proxy settings were not changed.

| Asset | Source | Runtime use / transformation |
| --- | --- | --- |
| Brick Wall 02, Dimitrios Savva | https://polyhaven.com/a/brick_wall_02 | 1K JPEG base color, OpenGL normal and roughness; physical two-metre repeat, separate sRGB color and linear data maps |
| Concrete Pavement | https://polyhaven.com/a/concrete_pavement | 1K JPEG base color, OpenGL normal and roughness; two-metre repeat |
| Urban Courtyard, Greg Zaal / Rico Cilliers | https://polyhaven.com/a/urban_courtyard | 1K HDR environment, lighting/reflections only; not presented as walkable scanned geometry |
| Tree Small 02, Rico Cilliers | https://polyhaven.com/a/tree_small_02 | Blender LOD1 reduced from 495,533 to 64,938 triangles; images capped at 512 pixels; JPEG quality 82 with alpha retained where needed; embedded GLB, 7,999,608 bytes, reused at two placements; custom Blender leaf group replaced with standard PBR nodes and source-color-preserving RGBA cutouts |

Runtime assets live in `apps/game/public/assets/environment/`. Six surface images plus HDR total 6,782,736 bytes; with the tree, 14,782,344 bytes before transfer compression. `sources.json` records download URLs, source checksums and CC0 license; `courtyard-tree.json` records export evidence/hash. Source Blender/textures remain in ignored `node_modules/.cache/runway-environment-source/`, not the served asset directory. No source Blender scripts are executed: conversion uses `--disable-autoexec` and the locally reviewed exporter.

Reproduce from `apps/game`: `python3 scripts/prepare-environment.py` (add `--direct` only when direct access is approved), `node scripts/prepare-tree-textures.mjs` to combine the source color/alpha using the browser's sRGB image pipeline, then `blender --background --disable-autoexec node_modules/.cache/runway-environment-source/tree.blend --python-exit-code 1 --python scripts/optimize-environment-tree.py`. Export refuses an existing output unless explicitly passed `-- --overwrite`. Download preparation refuses mismatched existing files.

New verification: `node --test environmentAssets.test.mjs` checks source hashes, distinct PBR channels, embedded tree assets and transfer/triangle budgets. `node scripts/environment.browser.mjs` checks all eight runtime requests and captures courtyard/tree views with frame-cadence evidence under `node_modules/.cache/runway-environment/`; `TEST_URL` selects development or production preview. Existing first-person browser regression remains required. Authored geometry, generated wood/soil, two primitive founder placeholders and the procedural brushing hand remain; this is not baked-GI or Unreal/Lumen rendering. Loading/error paths preserve procedural environment/tree/lighting fallbacks.

## First Imported Human: Remy (September 19, 2026)

User-supplied source: `/Users/QXZ6WEJ/Downloads/Remy.fbx`, provided in response to the Mixamo export request. FBX metadata contains `mixamorig` bones and `Armature|mixamo.com|Layer0`. Source SHA-256: `ea53dc7a94cde370ede41484be58d41a2e7278e13324a390d160232a5421493d`. Original FBX remains unmodified and is not copied into the repository.

Source/service: https://www.mixamo.com/. Adobe's FAQ permits royalty-free use of Mixamo characters and animations in games: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html (checked September 19, 2026). The supplied stock Remy model is used for the first Kirill-slot visual proof, not represented as a likeness of the real teammate. No asset was acquired from an unofficial mirror.

Conversion: Blender 5.2.0 LTS, installed with user authorization. Reproducible command from `apps/game`: `blender --background --factory-startup --python scripts/convert-remy.py -- /path/to/Remy.fbx /absolute/output/remy-seated.glb`. The converter refuses to overwrite output unless `--overwrite` is explicitly supplied.

Runtime file: `public/assets/founders/remy-seated.glb` (6,074,216 bytes). The adjacent JSON records source/output hashes and conversion facts. Seven mesh parts, 19,404 source vertices, 67-bone rig, 21 embedded texture images capped at 1024 pixels (some 512). Textured base color, normals, roughness and specular data are retained; gloss maps are inverted to roughness; opacity maps are packed into hair/eyelash RGBA. Opaque images use JPEG quality 85; alpha images remain PNG. Blender normalizes skinning to four influences where the FBX has more; close-up checks are still required for new poses.

The original action spans only frames 1-2, not a seated motion clip. The converter fits a static seated skeleton pose and exports no animation. Runtime uses `SkeletonUtils.clone`, private material clones and small head-bone pose reactions; there is no body bobbing or claimed mocap idle. A compatible Mixamo seated animation is still requested. Sadman and Sergio remain procedural until separate approved models arrive. The brushing hand remains procedural.

Active integration: `SceneEnvironment.tsx` loads `RemyFounder.tsx` in the Kirill slot with Suspense/error fallback; no room, movement or mission-system replacement. Desk height and laptop placement were adjusted to fit a realistically proportioned seated human. The model is loaded locally with `useGLTF`; it has no external texture URLs.

Validation: `node --test characterAssets.test.mjs` passes 3 checks for embedded assets/hash, skinning/material channels, alpha preservation and texture limits. `scripts/character.browser.mjs` captures wide, close and unobstructed/narrow views under `node_modules/.cache/runway-characters/` and measures requestAnimationFrame cadence and resource transfers. First production-preview sample: 30.00 FPS, p95 frame interval 33.4 ms at 1440x900 in headless Brave; this is not an interactive GPU performance certification. Browser network measurement: 6,074,216-byte GLB body (6,074,516 transfer bytes), no reported browser errors.

Full manual disable-feed browser regression passes with the imported model: movement, grass brushing/release, scene changes, ending/restart and narrow touch controls. No paid mission or voice call was started by these tests.

## First-Person Baseline Before Remy (September 19, 2026)

The user-approved first-person renderer is `apps/game/src/scenes/FirstPersonWorld.tsx`. Its active environment does not depend on the image requests below: architecture, furniture, founders, hand, trees and grass are modeled in code. Brick, wood, concrete, soil and sign textures are generated locally by `sceneMaterials.ts`; sky and lighting use the installed Three.js/Drei libraries. No external art pack or image-generation service was used for this upgrade. The generated scene is stylized/procedural, not scanned photoreal art. Existing sound assets and their earlier provenance are unchanged. The legacy panorama renderer is preserved but unused.

The image-generation brief below is retained as historical work, not a statement that these assets exist.

Drop files into `apps/game/public/assets/…` with EXACT filenames. The game loads them automatically
and falls back to gradients/silhouettes if missing. Commit them (they are static assets, a few MB is fine).
Record the generator used here for provenance.

Style anchor for every prompt (paste at the end):
`photorealistic, cinematic film still, 35mm, shallow depth of field, volumetric warm light, moody dark palette,
teal and amber accents, ultra detailed, no text, no watermark --ar 16:9`

## Scenes → `apps/game/public/assets/scenes/`  (JPG, 2560×1440, ≤600 KB each)

| File | Prompt |
| --- | --- |
| `s1-puzl-budapest.jpg` | Loft-style tech coworking space at night in Budapest, exposed brick wall, tall industrial windows with city lights, one long wooden desk with three laptops glowing, half-empty pizza box, energy drink cans, a hackathon banner hanging (blank, no text), string lights, empty chairs, wide shot, camera at desk height + style anchor |
| `s2-debrecen-apartment.jpg` | Cramped two-room Eastern European apartment at 3 AM, mattress on the floor, laundry drying on a line across the room, instant noodle cups, three laptops on a kitchen table glowing blue, a phone lit up with a red alert, single warm lamp, cables everywhere, wide shot + style anchor |
| `s3-investor-room.jpg` | Clean minimalist startup accelerator meeting room, large whiteboard with marker scribbles (no readable text), a wall-mounted screen glowing, one potted plant, glass wall, soft daylight, expensive chairs, wide shot from the founders' side of the table + style anchor |
| `devin-mission-control.jpg` | Dark futuristic mission control room, wall of monitors showing code and graphs (unreadable), blue and violet glow, empty operator chairs, fog, low key lighting, cinematic wide shot + style anchor |
| `title-budapest-night.jpg` | Budapest at night from above the Danube, Parliament lit gold, Chain Bridge, light rain, cinematic aerial + style anchor |

## Founders → `apps/game/public/assets/founders/`  (PNG, transparent background, full body, ~900×1800)

Prompt base: `full body character render, standing, facing slightly toward camera, photorealistic stylized (Pixar-meets-photoreal),
studio rim light, isolated on transparent background, PNG, 8k --ar 1:2`. Use a background remover (remove.bg / Photoshop) if the tool can't do alpha.

| File | Character |
| --- | --- |
| `kirill.png` | Kirill, CTO, tall slim man late 20s, over-ear headphones around neck, navy blue (#4F7CAC) hoodie, straight perfectionist posture, arms crossed, dry expression, laptop sticker-covered under one arm |
| `sadman.png` | Sadman, backend researcher, shorter and broader build, hood up over a cap, amber (#E0A458) hoodie, slightly hunched, holding a mechanical keyboard, deadpan calm face |
| `sergio.png` | Sergio, sales/hype founder, medium height athletic, backwards beanie, sunglasses, green (#7FB069) bomber jacket, arms open wide mid-shout, huge grin, phone in one hand |

Optional variants (same prompt + mood): `kirill-alarm.png`, `sadman-alarm.png`, `sergio-alarm.png` (stressed, red emergency light),
`*-win.png` (celebrating). Loaded if present.

## Extras (nice to have)

| File | Prompt |
| --- | --- |
| `apps/game/public/assets/ui/investor.jpg` | Portrait of a dry, unimpressed VC in a Patagonia vest, neutral office background, 1:1 |
| `apps/game/public/assets/ui/grain.png` | 512×512 tileable film grain, transparent (or use any CC0 grain texture) |

Do not use nationality as a visual joke. Faces: neutral-to-expressive, no caricature.
