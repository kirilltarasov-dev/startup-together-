import { FLOOR_TOP_Y } from '../world/colliderSpec.ts'

/**
 * Physical description of the player: the invisible Rapier capsule (ecctrl) and where the visible ~1.83 m human
 * mesh hangs from it. Ecctrl floats the capsule `floatHeight` above the standing surface, so the body centre sits at
 * capsuleHalfHeight + capsuleRadius + floatHeight above the ground and the model root (soles at y=0) is offset by
 * exactly that amount downwards.
 */
export const PLAYER_BODY = {
  modelHeight: 1.828,        // sergio-player.glb mesh bounds (see locomotion.test.ts)
  capsuleHalfHeight: 0.55,   // cylinder half length -> capsule 1.7 m + float 0.1 m = 1.8 m standing envelope
  capsuleRadius: 0.3,
  floatHeight: 0.1,
  cameraTargetHeight: 1.35,  // chest / lower head, above the standing surface
} as const

/** Body centre height above the standing surface at rest. */
export const PLAYER_CENTER_HEIGHT = PLAYER_BODY.capsuleHalfHeight + PLAYER_BODY.capsuleRadius + PLAYER_BODY.floatHeight
/** Local Y of the model group inside the ecctrl body so the soles meet the ground. */
export const MODEL_OFFSET_Y = -PLAYER_CENTER_HEIGHT
/** Camera follow-target offset from the body centre. */
export const CAMERA_TARGET_OFFSET_Y = PLAYER_BODY.cameraTargetHeight - PLAYER_CENTER_HEIGHT
/** Spawn/reset: body centre exactly at its floating equilibrium on the floor slab (no drop, no crate). */
export const SPAWN_POSITION = { x: 0, y: FLOOR_TOP_Y + PLAYER_CENTER_HEIGHT + 0.02, z: -0.5 } as const

export const LOCOMOTION = {
  maxWalkVel: 2.2,
  maxRunVel: 4.6,
  /** Planar speed at which idle has fully blended into walk. */
  walkThreshold: 0.3,
  /** Speed above which (with Shift held) the run state is used: midpoint of the walk/run velocities. */
  runThreshold: (2.2 + 4.6) / 2,
} as const

/**
 * Walk-clip calibration measured from sergio-player.glb by scripts/inspect-locomotion-clips.mjs (forward kinematics
 * of the Hips/Foot joints): the authored loop is a short shuffle — 0.095 m foot excursion per step, 1 s cycle.
 */
export const WALK_CLIP = {
  cycleSeconds: 1,
  stepMetres: 0.0946,
  /** stride per cycle (2 steps) / cycle duration */
  naturalSpeed: 0.1892,
  /** Time in the clip where the feet are furthest apart (double support) — used as the frozen airborne pose fallback. */
  midStrideTime: 0.2917,
} as const
