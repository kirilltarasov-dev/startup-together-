/**
 * Pure flight-path logic for the distant courtyard birds (rendered by Birds.tsx).
 * Everything here is deterministic given a random source so it can be unit tested in Node.
 */
import * as THREE from 'three'

export interface FlightBounds {
  minY: number
  maxY: number
  minRadius: number
  maxRadius: number
  /** Hard floor: no sampled point of any path may go below this. */
  floorY: number
  /** Axis-aligned volume (buildings/courtyard) that paths must avoid. */
  exclusion: { min: [number, number, number]; max: [number, number, number] }
}

/** Waypoints at y 12-20 m, 25-45 m from the origin: well above the ~10 m roofline and outside the courtyard. */
export const BIRD_BOUNDS: FlightBounds = {
  minY: 12,
  maxY: 20,
  minRadius: 25,
  maxRadius: 45,
  floorY: 8,
  exclusion: { min: [-15, -1, -9], max: [15, 10.5, 22] },
}

export interface FlightPath {
  curve: THREE.CatmullRomCurve3
  length: number
  waypoints: THREE.Vector3[]
}

export function insideBox(p: THREE.Vector3, box: FlightBounds['exclusion']) {
  return p.x > box.min[0] && p.x < box.max[0] && p.y > box.min[1] && p.y < box.max[1] && p.z > box.min[2] && p.z < box.max[2]
}

/**
 * Build a smooth Catmull-Rom path of 5-7 waypoints that starts exactly at `start` heading along `tangent`
 * (so a new path can replace a finished one without a visible teleport), circling the origin at a
 * slowly varying radius/altitude. Retries waypoint sets until every sampled point respects the floor and
 * the exclusion volume.
 */
export function generateFlightPath(start: THREE.Vector3, tangent: THREE.Vector3, random: () => number, bounds: FlightBounds = BIRD_BOUNDS): FlightPath {
  const count = 5 + Math.floor(random() * 3)
  for (let attempt = 0; attempt < 24; attempt++) {
    const points: THREE.Vector3[] = []
    // Three's open Catmull-Rom starts at points[0] heading towards points[1]; placing the first waypoint
    // straight ahead along the current tangent keeps the direction continuous across path changes.
    const heading = tangent.lengthSq() > 1e-6 ? tangent.clone().normalize() : new THREE.Vector3(1, 0, 0)
    heading.y *= 0.5
    points.push(start.clone())
    const lead = start.clone().addScaledVector(heading, 8 + random() * 4)
    lead.y = THREE.MathUtils.clamp(lead.y, bounds.minY, bounds.maxY)
    points.push(lead)
    let angle = Math.atan2(lead.z, lead.x)
    // Keep turning in the direction the bird is already circling.
    const cross = start.x * heading.z - start.z * heading.x
    const turn = (cross >= 0 ? 1 : -1) * (0.55 + random() * 0.45)
    let radius = THREE.MathUtils.clamp(Math.hypot(lead.x, lead.z), bounds.minRadius, bounds.maxRadius)
    let y = lead.y
    for (let i = 0; i < count - 2; i++) {
      angle += turn * (0.35 + random() * 0.3)
      // The open sky seen from the courtyard is over the low workspace roof (-z); the 10 m facades hide the
      // other directions. Fly closer and higher there so the birds are actually visible, wider/lower elsewhere.
      const openSky = 0.5 - 0.5 * Math.sin(angle)
      const radiusCap = bounds.minRadius + (bounds.maxRadius - bounds.minRadius) * (1 - 0.65 * openSky)
      const yFloor = bounds.minY + (bounds.maxY - bounds.minY) * 0.5 * openSky
      radius = THREE.MathUtils.clamp(radius + (random() - 0.5) * 12, bounds.minRadius, radiusCap)
      y = THREE.MathUtils.clamp(y + (random() - 0.5) * 5, yFloor, bounds.maxY)
      points.push(new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius))
    }
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
    curve.arcLengthDivisions = 240
    const samples = curve.getSpacedPoints(120)
    if (samples.every((p) => p.y >= bounds.floorY && !insideBox(p, bounds.exclusion))) {
      return { curve, length: curve.getLength(), waypoints: points }
    }
  }
  // Deterministic fallback: a level circle at a safe altitude.
  const radius = (bounds.minRadius + bounds.maxRadius) / 2
  const y = (bounds.minY + bounds.maxY) / 2
  const angle0 = Math.atan2(start.z, start.x)
  const points = Array.from({ length: 6 }, (_, i) => new THREE.Vector3(Math.cos(angle0 + i * 0.6) * radius, y, Math.sin(angle0 + i * 0.6) * radius))
  points[0] = start.clone()
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal')
  return { curve, length: curve.getLength(), waypoints: points }
}

/** Spawn point on the flight ring (optionally near `angleHint`) with a tangent circling in a random direction. */
export function spawnPoint(random: () => number, bounds: FlightBounds = BIRD_BOUNDS, angleHint?: number) {
  const angle = angleHint === undefined ? random() * Math.PI * 2 : angleHint + (random() - 0.5) * 1.2
  const radius = bounds.minRadius + random() * (bounds.maxRadius - bounds.minRadius) * 0.5
  const y = bounds.minY + random() * (bounds.maxY - bounds.minY)
  const position = new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
  const direction = random() < 0.5 ? 1 : -1
  const tangent = new THREE.Vector3(-Math.sin(angle) * direction, 0, Math.cos(angle) * direction)
  return { position, tangent }
}

export interface BirdState {
  path: FlightPath
  /** Arc-length parameter 0..1 along the current path. */
  u: number
  /** Cruise speed m/s (6-9). */
  speed: number
  /** Wingbeat frequency Hz (3-5) and phase (radians); unsynchronised per bird. */
  flapHz: number
  flapPhase: number
  /** 1 while flapping, eases to 0 during glides. */
  flapAmplitude: number
  /** Seconds left in the current flap/glide phase. */
  phaseTimer: number
  gliding: boolean
  /** Current smoothed roll (radians). */
  roll: number
  position: THREE.Vector3
  tangent: THREE.Vector3
}

export function createBird(random: () => number, bounds: FlightBounds = BIRD_BOUNDS, angleHint?: number): BirdState {
  const { position, tangent } = spawnPoint(random, bounds, angleHint)
  const path = generateFlightPath(position, tangent, random, bounds)
  return {
    path,
    u: 0,
    speed: 6 + random() * 3,
    flapHz: 3 + random() * 2,
    flapPhase: random() * Math.PI * 2,
    flapAmplitude: 1,
    phaseTimer: 2 + random() * 4,
    gliding: false,
    roll: 0,
    position: position.clone(),
    tangent: tangent.clone(),
  }
}

/** Steps/second->radians helper: signed yaw rate of the path tangent, used for banking. */
function yawRate(path: FlightPath, u: number, speed: number, tangent: THREE.Vector3, ahead: THREE.Vector3) {
  const du = Math.min(0.02, 0.5 / Math.max(path.length, 1))
  path.curve.getTangentAt(Math.min(1, u + du), ahead)
  const cross = tangent.x * ahead.z - tangent.z * ahead.x
  const dot = THREE.MathUtils.clamp(tangent.x * ahead.x + tangent.z * ahead.z, -1, 1)
  const dTheta = Math.atan2(cross, dot)
  const dt = du * path.length / speed
  return dt > 0 ? dTheta / dt : 0
}

const scratchAhead = new THREE.Vector3()

/**
 * Advance one bird by `delta` seconds. Mutates `bird` in place (no allocations in steady state) and
 * regenerates a path from the current position/tangent when the old one ends. Returns wing flap
 * angle (radians) for this frame.
 */
export function stepBird(bird: BirdState, delta: number, random: () => number, bounds: FlightBounds = BIRD_BOUNDS) {
  const dt = Math.min(Math.max(delta, 0), 0.1)
  bird.u += dt * bird.speed / Math.max(bird.path.length, 1)
  if (bird.u >= 1) {
    bird.path.curve.getPointAt(1, bird.position)
    bird.path.curve.getTangentAt(1, bird.tangent)
    bird.path = generateFlightPath(bird.position, bird.tangent, random, bounds)
    bird.u = 0
    bird.speed = THREE.MathUtils.clamp(bird.speed + (random() - 0.5) * 1.5, 6, 9)
  }
  bird.path.curve.getPointAt(bird.u, bird.position)
  bird.path.curve.getTangentAt(bird.u, bird.tangent)
  if (bird.position.y < bounds.floorY) bird.position.y = bounds.floorY
  // Banking: roll proportional to path curvature (yaw rate), smoothed.
  const rate = yawRate(bird.path, bird.u, bird.speed, bird.tangent, scratchAhead)
  const targetRoll = THREE.MathUtils.clamp(-rate * 0.9, -0.85, 0.85)
  bird.roll = THREE.MathUtils.damp(bird.roll, targetRoll, 3, dt)
  // Flap / glide phases.
  bird.phaseTimer -= dt
  if (bird.phaseTimer <= 0) {
    bird.gliding = !bird.gliding
    bird.phaseTimer = bird.gliding ? 1 + random() * 2 : 2 + random() * 4
  }
  bird.flapAmplitude = THREE.MathUtils.damp(bird.flapAmplitude, bird.gliding ? 0 : 1, 6, dt)
  bird.flapPhase = (bird.flapPhase + dt * bird.flapHz * Math.PI * 2) % (Math.PI * 2)
  return Math.sin(bird.flapPhase) * bird.flapAmplitude * 0.75 + (1 - bird.flapAmplitude) * 0.12
}
