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

/**
 * Third-person orbit camera (CharacterController): follow at ~3.2 m (1.6-5.5), chest-height target.
 * Obstruction handling: camera-controls dollies in against the camera-blocking colliders; the controller's
 * post-step holds >= `minObstructedDistance` and swings the azimuth to the smallest clear probe (see
 * `pickCameraSwing`) before it ever raises the camera, and the rise stops at `riseMinPolar`.
 */
export const CAMERA = {
  distance: 3.2, minDistance: 1.6, maxDistance: 5.5, minObstructedDistance: 1.2, smoothTime: 0.18,
  minPolar: 0.3, maxPolar: 1.5, defaultPolar: 1.15, raiseStep: 0.06, returnStep: 0.02,
  /** The automatic obstruction rise stops here (31.5 deg from vertical): still a side view, never top-down. */
  riseMinPolar: 0.55,
  /**
   * Azimuth offsets probed on obstruction, degrees, both signs, smallest first. A wall the player hugs at distance d
   * only clears when cos(offset) < d / (r sin(polar)); 0.375 m from the glass wall (the Phase 1 corner route) at
   * r = 3.2 needs > 83 deg, so the list runs to a wall-parallel 90 deg.
   */
  swingOffsetsDeg: [20, 40, 60, 80, 90],
  /** Bounded swing rate, rad/s (90 deg/s). */
  swingRate: Math.PI / 2,
  /** A probe with at least this fraction of the preferred distance clear counts as an escape (a low ceiling caps every probe). */
  swingAcceptFraction: 0.6,
  /** A probe must beat the current azimuth's clearance by this much before a swing starts (no chatter). */
  swingGain: 0.05,
} as const

export const DEG = Math.PI / 180

/**
 * Choose the azimuth offset (radians, signed) the camera should swing toward, or null to leave the azimuth alone.
 * `clearDistance(offsetRad)` returns how far along that orbit direction is free of camera-blocking geometry,
 * capped at `preferred`. Pass 1 wants the full preferred distance; pass 2 accepts `swingAcceptFraction` of it (a low
 * ceiling caps every direction). Smallest offset wins; during an active swing only the current direction is
 * considered so a swing never reverses mid-way (a reversal needs a fresh obstruction), and the candidate must beat
 * the current direction's clearance so an already-best view stays put.
 */
export function pickCameraSwing(clearDistance: (offsetRad: number) => number, preferred: number, activeSign: 0 | 1 | -1 = 0): number | null {
  const current = clearDistance(0)
  const accept = Math.max(CAMERA.minDistance, preferred * CAMERA.swingAcceptFraction)
  const signs = activeSign === 0 ? [1, -1] : [activeSign]
  for (const threshold of [preferred - 1e-3, accept]) {
    for (const degrees of CAMERA.swingOffsetsDeg) {
      for (const sign of signs) {
        const offset = sign * degrees * DEG
        const clear = clearDistance(offset)
        if (clear >= threshold && clear > current + CAMERA.swingGain) return offset
      }
    }
  }
  return null
}

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
