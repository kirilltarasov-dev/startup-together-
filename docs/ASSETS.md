# Art assets — generate these NOW (Midjourney v7 / Flux / GPT-image)

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
