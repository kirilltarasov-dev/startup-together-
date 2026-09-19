# Creative and Production Direction (FROZEN 12:40 CEST)

Status: **Earlier frozen spec below; first-person amendment now supersedes its camera and rendering restrictions.**

## First-Person Amendment (September 19, 2026)

User selected first-person and authorized the current Devin session to take over A/B while preserving uncommitted work. The active world now uses modeled rooms/courtyard, WASD/arrows, mouse capture or drag-to-look, C crouch, E/held click to brush nearby grass, F/Escape to return to story, reset-position and narrow-screen touch controls. A courtyard is part of each existing location, not another chapter. Grass uses instanced geometry with wind/contact deformation; this supersedes the earlier no-custom-shader restriction for grass only. Remy is now an imported textured human in the middle founder slot, following user approval of rigged human assets; the other founder figures and environment remain procedural/stylized. The current seated pose is locally fitted, not a supplied animation. See `ASSETS.md` for source and limitations. The five-event story and integration contracts remain unchanged. The previous fixed-camera spec is retained below for history.
Script: [SKIT.md](SKIT.md). Voice: [VOICE.md](VOICE.md). Lanes: [HANDOFF.md](HANDOFF.md).

## The Point

Make the player laugh at a fragile startup, care when it breaks, and then realize the repair
happened in a real codebase. The climax is evidence of a repair, not a decorative agent animation.

## Hats

| Hat | Deliverable | Owner |
| --- | --- | --- |
| Executive producer | Scope, Devin key, GitHub repo, cut decisions at 14:00 | User |
| Director / writer | Frozen skit, numbers, voice prompt, visual spec, acceptance | Devin (this window) |
| Lane A: game/UI | Events, state, HUD, movement + hotspots, ending, Vercel deploy | Teammate 1 |
| Lane B: 3D | Diorama, founders, dressings, animations | Teammate 1 second agent or director |
| Lane C: backend | Railway orchestrator, Devin session, verifier, cached real run | Devin (this window) |
| Lane V: voice | gpt-live-1 session route + client, three moments | Teammate 2 |
| QA / stage | Hosted playthrough, two rehearsals, backup recording | All, from 14:29 |

## Storyboard

| Beat | Player action | Visual consequence |
| --- | --- | --- |
| Title cards | START RUNWAY | Black to diorama reveal |
| E01 | Walk to laptop, speak/click premise | Screens light up; founder leans |
| E02 | Click shipping tradeoff | Founder reacts; HUD numbers animate |
| Result card | OF COURSE | Door glows; walk out; camera dolly; Debrecen dressing |
| E03 | Kitchen laptop | Founder reacts |
| E04 | Alarm phone; speak orders to Devin | Lights to coral; screens pulse while real mission runs |
| Verdict | Observe | Teal + bounce (success) or dim + slump (failure) |
| E05 | Whiteboard screen; negotiate | Investor text on wall screen |
| Ending | Restart | DOM overlay over the frozen diorama |

## Stack and "Stunning Out of the Box" Rules (user direction 12:50)

React Three Fiber + drei + framer-motion. Geometry stays primitives; the *look* comes from
drei/postprocessing helpers that cost one line each. Approved, in priority order:

| Helper | Use | Why it is cheap |
| --- | --- | --- |
| `<Environment preset="city" />` (drei) | Reflections and fill light | One line; self-host the HDR if the CDN fails |
| `<ContactShadows>` (drei) | Grounding under desk and founders | No shadow maps to tune |
| `<Bloom>` from `@react-three/postprocessing` | Glow on laptop screens, hotspots, coral incident, teal recovery | Emissive materials already in spec; one `<EffectComposer>` |
| `<Float>` (drei) | Hovering hotspot markers and the title cards | Replaces hand-written bob |
| `<Sparkles>` (drei) | Success beat only (teal), and E03 "someone paid" | Built-in, cap count 60 |
| `<Text>` / `<Html>` (drei) | Hackathon banner text, wall-screen investor offer | Avoids texture work |
| `<Stars>` (drei) | Behind the open loft window in S1 night sky | Free depth |
| `<CameraShake>` (drei) | E04 incident entry, intensity 0.3, 0.6 s | Replaces custom shake |
| `<SoftShadows>` (drei) | Only if FPS > 45 on the demo laptop after everything else | Last |

Materials: `meshStandardMaterial` with roughness 0.6, metalness 0.1; screens and hotspots use
`emissive` + `emissiveIntensity` 1.5-2.5 so Bloom picks them up; `toneMapping` ACES; fog
`#1A1B1E` from 9 to 16 units for depth. framer-motion drives all DOM: HUD number ticks,
decision panel spring-in, title cards, ending overlay. No custom shaders, no GLB today.

S1 venue detail: exposed-brick back wall (`#5A3E36` boxes in a brick offset pattern, 2 rows
is enough), large loft window plane with `<Stars>` behind, "PUZL" and "COGNITION x DEVIN
HACKATHON" banner via `<Text>`.

## Tiny Diorama Spec (build with Three.js primitives, ~60 min)

Camera: `PerspectiveCamera` fixed, position `[6, 5, 7]`, lookAt `[0, 0.8, 0]`, FOV 35, no
orbit controls. Under 600 px width: position `[7, 6, 8]`, FOV 45. DPR cap 1.5.

Room: floor plane 6 x 5 at y=0; back wall (z=-2.5) and left wall (x=-3), no ceiling, open front.
Lighting: ambient `#404040` at 0.6; one warm point light `#FFB35C` intensity 2 above the desk;
one key light whose color lerps to state (warm / coral / teal). No shadows first; add if >45 FPS.

Palette: floor `#2B2D33`, walls `#3A3D45`, lamp `#FFB35C`, teal recovery `#2DD4BF`, coral
incident `#FF5A5F`, laptop screen `#7CE7F4`, failure dim `#333644`, hotspot glow `#F5D547`.

Desk: box 3 x 0.12 x 1.2 at y=0.75, four leg boxes. Laptop (x3): base box 0.5 x 0.03 x 0.35,
screen box 0.5 x 0.35 x 0.02 tilted, emissive plane 0.44 x 0.28 with 3 thin white bars as UI.
Chair (x3): seat box, back box, cylinder post.

Founders (capsule body + sphere head, seated; Kirill stands and walks):

| ID | Height | Body color | Accessory |
| --- | --- | --- | --- |
| `kirill` | 0.85 | `#4F7CAC` | torus headphones; upright posture (perfectionist) |
| `sadman` | 0.70, wider radius | `#E0A458` | hood (half-sphere over head) + cap brim; slightly hunched toward laptop (introvert coder) |
| `sergio` | 0.78 | `#7FB069` | backwards beanie cone + sunglasses (thin black box); arms-open pose, leans back (hype) |

Dressings (swap one group per scene):

| Scene | Props |
| --- | --- |
| S1 Puzl CowOrKing, Obuda | brick back wall, loft window + `<Stars>`, `<Text>` banner "PUZL / COGNITION x DEVIN HACKATHON", pizza box (flat cylinder), energy-drink cylinders, countdown in HUD |
| S2 Debrecen | laundry rod (thin cylinder) + two shirt planes, mattress box against wall, noodle cup cylinder |
| S3 Investor | whiteboard box 1.6 x 1 x 0.05 with marker line boxes, plant (pot cylinder + icosahedron), two extra chairs |

Hotspots: small emissive cylinders on the floor (radius 0.35) at laptop, door (right edge x=2.6),
phone (desk corner), whiteboard. Only the active one glows and pulses.

## Movement

Arrow keys / WASD move Kirill on the floor plane at 2.2 units/s, clamped to the room bounds
(x in [-2.6, 2.6], z in [-2.2, 2.2]). Position updates in `useFrame` via refs, not React state.
Entering the active hotspot radius dispatches `enterHotspot(id)` once (Zustand) and shows the
event panel. Leaving does not cancel a shown event. A "Walk there" button teleports for
keyboard-less devices. No physics, jumping, or collision beyond the clamp.

## Animations (exactly eight, all `useFrame` + refs)

| # | Trigger | Motion | Duration |
| --- | --- | --- | --- |
| A1 | always | seated founders bob `sin(t*2+i)*0.02` | loop |
| A2 | always | screens flicker emissiveIntensity +-10% | loop |
| A3 | any choice | reacting founder leans forward 0.15, springs back | 0.8 s |
| A4 | E04 entry | key light and screens lerp to coral | 0.6 s |
| A5 | mission pending | screens pulse coral/dim; founders bob faster | loop |
| A6 | verified success | light/screens lerp to teal; all three bounce once | 1.2 s |
| A7 | verified failure | screens to `#333644`; founders slump rotation.x +0.3 | 1.0 s |
| A8 | scene change | camera x dolly +2 and back; prop groups cross-fade | 1.0 s |

Reduced motion: A1/A2/A5 static; colors still change. Ending is a DOM overlay; no particles.

## HUD and Readability

DOM top bar: cash, users, health, morale, runway at >= 24 px bold tabular numerals, `#F5F5F4`
on `#1A1B1E`. EUR 37 at 40 px. Decision panel bottom-center, solid fills, >= 20 px text.
Founders stay inside the center 60% of the frame; top 80 px and bottom 140 px are HUD zones.
Narrow (390 x 844): two-row HUD, full-width stacked buttons, camera per spec above.
Mode badge (LIVE / CACHED REAL RUN / MOCK) always visible during and after E04.

## Rules Locked

Every choice changes a resource or the ending. No randomness. No continuous cash drain.
Pending mission freezes the economy. Failed mission stays playable. Restart clears mission refs.
No asset pack, GLB, Draco, physics, or custom rigs today. Postprocessing is limited to Bloom. If B is done by 13:40
with slack, one CC0 prop swap is allowed after the deployed build is verified.
