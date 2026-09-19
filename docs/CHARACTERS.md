# Human Character Pipeline

Do not build player anatomy from Three.js primitives. A physics capsule is an invisible gameplay approximation, not a visible human model.

## Mandatory boundaries

- **CharacterController:** Rapier/ecctrl body, input, grounding, slopes, jump and camera collision. Independent of model node names.
- **CharacterModel:** load the selected rigged GLB, normalize placement and instantiate via SkeletonUtils.clone; retain authored textures/materials and private mutable materials.
- **CharacterAnimator:** one independent mixer per instance, validated clip map and controlled crossfades. Pause on application pause/hidden tab and respect reduced motion for nonessential reactions.
- **CharacterCustomization:** choose an approved asset descriptor/model/outfit. Swapping appearance never rewrites the controller or changes story ownership implicitly.

Semantic clip slots: idle, walk, run, turn, jump, fall, land, talk. A missing slot is explicitly reported; a walk clip played faster is a temporary run fallback, not an authored run animation. Never rename incompatible clips and call it retargeting. Use clips for the source skeleton or retarget/bake and verify offline.

## Available assets

The seated Remy and Sergio GLBs are valid NPC assets with no locomotion clips. They must not slide around as the player. The local standalone Sergio export includes locally authored Idle/Walk/Talking loops and facial channels; these are prototype animation, not motion capture or exact photographic likeness. Source files and provenance are in ASSETS.md. The Remy FBX originally supplied only a two-frame pose.

First prove one standing rigged character moving in the actual room, including feet/grounding, scale, camera occlusion and pose transitions. Then introduce a second distinct selectable human. Selection and controller APIs can exist before the second asset is ready; do not disguise duplicate recolors as completed character diversity.

Stock Mixamo assets require confirmed provenance/terms; MPFB/MakeHuman is an alternative content pipeline, not a reason to reconstruct anatomy in runtime code. Keep skeleton/material/clip inspection reports and licensed source information with each output.

Acceptance: browser screenshots at gameplay and close distance; walk/run/stop/turn/jump/land without T-poses or broken joints; independent instances; pause/resume; no shared-cache material mutation. Full animation coverage remains pending until the corresponding clips are supplied or correctly authored and verified.
