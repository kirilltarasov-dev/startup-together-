# Art assets — generate these NOW (Midjourney v7 / Flux / GPT-image)

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
