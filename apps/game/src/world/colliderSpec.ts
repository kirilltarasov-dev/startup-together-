import { SCENE_COLLIDERS, type Collider } from '../engine/firstPerson.ts'

/**
 * Single source of truth for the third-person world's static collision volumes.
 * `SCENE_COLLIDERS` (engine/firstPerson.ts, owned by the first-person lane) only carries X/Z footprints; this
 * module assigns each footprint an explicit height/kind so the Rapier colliders and the camera-obstruction
 * meshes stop guessing heights independently. Rules first, then an override table keyed by "x,z".
 */
export type ColliderKind = 'wall' | 'glass' | 'furniture' | 'crate' | 'tree' | 'door' | 'fence'

export interface ColliderSpec extends Collider {
  height: number
  kind: ColliderKind
  /** The player may walk through it: emitted for tests/tools only, never as a physics or camera collider. */
  traversable: boolean
  /** Camera-controls obstruction raycasts consider this volume. Low furniture must not pull the camera in. */
  blocksCamera: boolean
}

export const CAMERA_BLOCKING_MIN_HEIGHT = 2
/** Floor collider top: matches the room floor slab in SceneEnvironment (box at y=-0.04, 0.12 thick). */
export const FLOOR_TOP_Y = 0.02
const ROOM_HEIGHT = 3.8
const key = (x: number, z: number) => `${x},${z}`

/** Explicit per-footprint values: measured from SceneEnvironment.tsx geometry (top surface heights). */
const OVERRIDES: Record<string, { height: number; kind: ColliderKind }> = {
  [key(0, -5)]: { height: 0.85, kind: 'furniture' },        // long desk: top at 0.79 + 0.055
  [key(-4.8, -5.7)]: { height: 0.8, kind: 'furniture' },    // sideboards
  [key(4.8, -5.7)]: { height: 0.8, kind: 'furniture' },
  [key(-5.1, 8)]: { height: 0.52, kind: 'furniture' },      // courtyard benches: slats at 0.48 + 0.035
  [key(5.1, 8)]: { height: 0.52, kind: 'furniture' },
  [key(-1.8, -6.4)]: { height: 1.3, kind: 'crate' },        // desk chairs (seat 0.52, backrest to 1.3) — labelled crates in the integrator's report
  [key(0, -6.4)]: { height: 1.3, kind: 'crate' },
  [key(1.8, -6.4)]: { height: 1.3, kind: 'crate' },
}

function classify(box: Collider): { height: number; kind: ColliderKind } {
  const override = OVERRIDES[key(box.x, box.z)]
  if (override) return override
  if (box.width >= 11 || box.depth >= 7) return { height: ROOM_HEIGHT, kind: 'wall' }    // back/side room walls
  if (box.z === 0) return { height: 3.5, kind: 'glass' }                                // front sill + glazing (mullions to 3.5)
  if (box.width === 0.55 && box.depth === 0.55) return { height: 3.4, kind: 'tree' }    // courtyard tree trunks
  return { height: 1, kind: 'furniture' }
}

/** Courtyard perimeter: invisible 2 m bounds (never camera-blocking); first-person clamps to the same box numerically. */
const PERIMETER: Collider[] = [
  { x: -7.5, z: 2, width: 0.3, depth: 21 },
  { x: 7.5, z: 2, width: 0.3, depth: 21 },
  { x: 0, z: 12.5, width: 15, depth: 0.3 },
]

/** The doorway between the two glass walls at z=0 (a gap, so a spec entry rather than a collider). */
export const DOORWAY: ColliderSpec = { x: 0, z: 0, width: 3, depth: 0.25, height: 3.5, kind: 'door', traversable: true, blocksCamera: false }

export const COLLIDER_SPECS: ColliderSpec[] = [
  ...SCENE_COLLIDERS.map((box) => {
    const { height, kind } = classify(box)
    return { ...box, height, kind, traversable: false, blocksCamera: height >= CAMERA_BLOCKING_MIN_HEIGHT }
  }),
  ...PERIMETER.map((box) => ({ ...box, height: 2, kind: 'fence' as const, traversable: false, blocksCamera: false })),
  DOORWAY,
]

export const PHYSICS_COLLIDERS = COLLIDER_SPECS.filter((spec) => !spec.traversable)
export const CAMERA_COLLIDERS = COLLIDER_SPECS.filter((spec) => !spec.traversable && spec.blocksCamera)

export function overlapsXZ(a: Collider, b: Collider) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
}
