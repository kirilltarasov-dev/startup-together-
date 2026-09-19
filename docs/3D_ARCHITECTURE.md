# 3D Architecture

Authority: PRODUCT_VISION.md. This document separates target contracts from implemented evidence; it does not assert the whole world system is complete.

## Audit of baseline 2bea46f

`App -> Play -> World -> FirstPersonWorld -> SceneEnvironment` renders WebGL with R3F. World starts with the story overlay visible and a separate exploration toggle. Player movement modifies the camera using PointerLockControls and a handwritten X/Z collision list. SceneEnvironment mounts the room, courtyard, imported facades/furniture, seated founders and trees together. Grass is instanced. There is no visible player, Rapier, character selection, sector manager or water. World3D is unused legacy code.

The flat impression has architectural causes: overlay-first interaction, no player embodiment, static seated humans, eager repeated scenery and inconsistent material/asset fidelity. More bloom does not solve these causes.

## Target composition

```text
WorldRuntime (renderer ownership)
  LightingSystem / QualitySettings / PerformanceTelemetry
  Physics (Rapier)
    SectorManager
      sector visual assets
      explicit cheap static colliders
      interaction sensors / NPC placements
    CharacterController (ecctrl + Rapier)
      CharacterModel (GLB hierarchy and private material instances)
        CharacterAnimator (clip binding, blending, pause)
  CharacterCustomization (selected asset descriptor)
  WaterSurface (render-backend adapter)
  contextual story / voice UI -> existing game actions
```

Frame transforms belong to refs/physics, not React state. Zustand handles discrete choices, selected character, quality and interaction focus. The physics controller must not know a model's node names. The animator maps semantic locomotion states to clips validated in the asset descriptor. Collision meshes differ from rendering meshes; avoid dynamic triangle meshes for furniture.

## Migration boundary

Keep the old first-person renderer and tests as a regression reference while integrating the third-person path. Preserve events, saves, backend/proxy routes and paid-operation authorization. The new path must not trigger missions merely by spawning, walking or loading a sector. Opening a story interaction pauses player input; closing it restores controls without sticky keys.

## Loading and ownership

Asset registry -> cacheable local/CDN URL -> loader cache -> model instances. Sector unmounting releases instances; shared cache entries have explicit residency ownership before eviction. Do not dispose shared geometry/material textures from one character clone. See WORLD_STREAMING.md and ASSET_PIPELINE.md.

WebGL remains the release renderer. WebGPU work uses the same scene/asset/input contracts on an isolated spike branch; no mixed production renderer migration without measurements.
