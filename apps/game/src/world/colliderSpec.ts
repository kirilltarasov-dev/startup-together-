import { SCENE_COLLIDERS, type Collider } from '../engine/firstPerson.ts'

/**
 * Single source of truth for the third-person world's static collision volumes.
 * `SCENE_COLLIDERS` (engine/firstPerson.ts, owned by the first-person lane) only carries X/Z footprints; this
 * module assigns each footprint an explicit height/kind so the Rapier colliders and the camera-obstruction
 * meshes stop guessing heights independently. Rules first, then an override table keyed by "x,z".
 */
export type ColliderKind = 'wall' | 'glass' | 'furniture' | 'crate' | 'tree' | 'door' | 'fence' | 'ceiling'

export interface ColliderSpec extends Collider {
  height: number
  kind: ColliderKind
  /** Bottom face elevation; volumes stand on the floor (0) unless stated (the false ceiling floats). */
  y?: number
  /** The player may walk through it: emitted for tests/tools only, never as a physics or camera collider. */
  traversable: boolean
  /** Camera-controls obstruction raycasts consider this volume. Low furniture must not pull the camera in. */
  blocksCamera: boolean
}

export const CAMERA_BLOCKING_MIN_HEIGHT = 2
/** Floor collider top: matches the room floor slab in SceneEnvironment (box at y=-0.04, 0.12 thick). */
export const FLOOR_TOP_Y = 0.02
const ROOM_HEIGHT = 3.8
/** Interior room footprint spanned by the walls in SCENE_COLLIDERS: x in [-6, 6], z in [-8, 0]. */
export const ROOM_FOOTPRINT: Collider = { x: 0, z: -4, width: 12, depth: 8 }
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

/**
 * Scene-specific volumes that have no footprint in SCENE_COLLIDERS (first-person ignores them: it cannot leave
 * the floor and never reaches the investor chairs' row).
 *  - S2/devin apartment: false ceiling. The visual shell (SceneEnvironment room.ceiling 2.56, 0.15 thick) has its
 *    underside at 2.485 m; the collider keeps the orbit camera under it instead of showing the slab's top face.
 *  - S3 investor room: the two chairs on the investor side of the conference table (backs toward the door).
 *    Seat/back volume 0.6 x 0.6 x 0.9: waist-high, so it stops the player but never pulls the camera in.
 */
export const S2_FALSE_CEILING: ColliderSpec = { ...ROOM_FOOTPRINT, y: 2.5, height: 0.1, kind: 'ceiling', traversable: false, blocksCamera: true }
export const S3_INVESTOR_CHAIRS: ColliderSpec[] = [-1.8, 1.8].map((x) => ({ x, z: -3.9, width: 0.6, depth: 0.6, height: 0.9, kind: 'furniture' as const, traversable: false, blocksCamera: false }))

export type ColliderScene = 'S1' | 'S2' | 'S3' | 'devin'

export function sceneExtraColliders(scene: ColliderScene): ColliderSpec[] {
  if (scene === 'S2' || scene === 'devin') return [S2_FALSE_CEILING]
  if (scene === 'S3') return S3_INVESTOR_CHAIRS
  return []
}

/** Bottom elevation of a volume (floor-standing unless it declares `y`). */
export const colliderBottom = (spec: ColliderSpec) => spec.y ?? 0
/** World-space centre of a volume, shared by the Rapier cuboids and the camera-obstruction meshes. */
export const colliderCenter = (spec: ColliderSpec): [number, number, number] => [spec.x, colliderBottom(spec) + spec.height / 2, spec.z]

export function overlapsXZ(a: Collider, b: Collider) {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
}
