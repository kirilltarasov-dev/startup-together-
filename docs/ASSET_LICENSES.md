# Asset and Library Registry

Do not admit an external asset with unknown rights. This index complements ASSETS.md and the machine-readable manifests, which hold source URLs, authors, hashes, modifications and runtime output paths.

| Source / asset | Rights evidence | Modifications / outputs |
| --- | --- | --- |
| Poly Haven: Brick Wall 02, Concrete Pavement, Urban Courtyard, Tree Small 02 | CC0: https://polyhaven.com/license | Resize, material conversion, tree simplification; `apps/game/public/assets/environment/sources.json` and `courtyard-tree.json`; outputs in that directory |
| Poly Haven: Modular Factory Facade, SchoolChair_01, Wooden Table 02 | CC0: https://polyhaven.com/license | Selected modules, normalized/optimized self-contained GLBs; `apps/game/public/assets/realism/sources.json` and `exports.json` |
| User-supplied Remy FBX, Mixamo metadata | Adobe game-use terms: https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html | Locally fitted seated pose/textures; `public/assets/founders/remy-seated.json`; stock model, not a teammate likeness |
| User-supplied Sergio reference and Remy-derived model | User-authorized adaptation; underlying Mixamo terms still apply | Static seated derivative and separately stored prototype animated export; `public/assets/founders/sergio-seated.json`, ASSETS.md |
| Cognition_AI (2).png | User-provided Cognition brand asset; no CC0 claim | Preserve logo; local image derivatives and a 3D venue sign, recorded by branding pipeline |
| Existing sound effects | Existing react-sounds collection; preserve upstream attribution and verify per-asset terms for further additions | Self-hosted under `public/sounds/`; no new sound acquisition in this reorientation |
| Three.js / R3F / Drei / react-three-rapier / ecctrl | Verify installed package LICENSE files; retain dependency notices | Reused renderer/helpers/physics/controller; no copied proprietary engine assets |

When adding models or textures, extend the relevant manifest before using the asset. Record its exact source identifier, author where available, license/version, source/output hashes, modifications and optimized location. Reusing an asset in several sectors does not require several source copies.

Do not infer that a random mirror of a commercial model has the same redistribution rights. Do not use Rockstar/GTA assets. This registry does not grant rights beyond the source licenses or the user's supplied material.
