export interface GroundPoint { x: number; z: number }
export interface Point3 extends GroundPoint { y: number }
export interface Collider { x: number; z: number; width: number; depth: number }

export const PLAYER_RADIUS = 0.24
export const SCENE_COLLIDERS: Collider[] = [
  { x: -6, z: -4, width: 0.3, depth: 8 },
  { x: 6, z: -4, width: 0.3, depth: 8 },
  { x: 0, z: -8, width: 12, depth: 0.3 },
  { x: -3.75, z: 0, width: 4.5, depth: 0.25 },
  { x: 3.75, z: 0, width: 4.5, depth: 0.25 },
  { x: 0, z: -5, width: 5.5, depth: 1.4 },
  { x: -4.8, z: -5.7, width: 1.25, depth: 2.8 },
  { x: 4.8, z: -5.7, width: 1.25, depth: 2.8 },
  { x: -5.1, z: 8, width: 2.6, depth: 0.8 },
  { x: 5.1, z: 8, width: 2.6, depth: 0.8 },
  { x: -5.5, z: 3.8, width: 0.55, depth: 0.55 },
  { x: 5.5, z: 3.8, width: 0.55, depth: 0.55 },
  ...[-1.8, 0, 1.8].map((x) => ({ x, z: -6.4, width: 0.7, depth: 0.8 })),
]

function canOccupy(x: number, z: number) {
  if (Math.abs(x) > 7.5 - PLAYER_RADIUS || z > 12.5 - PLAYER_RADIUS || z < -8 + PLAYER_RADIUS) return false
  return !SCENE_COLLIDERS.some((box) => Math.abs(x - box.x) < box.width / 2 + PLAYER_RADIUS && Math.abs(z - box.z) < box.depth / 2 + PLAYER_RADIUS)
}

export function movePlayer(position: GroundPoint, sideways: number, forward: number, yaw: number, delta: number, speed = 2.7): GroundPoint {
  const magnitude = Math.max(1, Math.hypot(sideways, forward))
  const distance = Math.max(0, Math.min(delta, 0.05)) * speed / magnitude
  const dx = (sideways * Math.cos(yaw) + forward * Math.sin(yaw)) * distance
  const dz = (forward * Math.cos(yaw) - sideways * Math.sin(yaw)) * distance
  const x = canOccupy(position.x + dx, position.z) ? position.x + dx : position.x
  const z = canOccupy(x, position.z + dz) ? position.z + dz : position.z
  return { x, z }
}

export function isGrass(x: number, z: number) {
  return Math.abs(x) > 1.15 && Math.abs(x) < 7.15 && z > 2.15 && z < 12.1
}

export function grassTarget(origin: Point3, direction: Point3): GroundPoint | null {
  if (direction.y >= -0.05) return null
  const distance = (0.2 - origin.y) / direction.y
  if (distance < 0 || distance > 2.6) return null
  const x = origin.x + direction.x * distance
  const z = origin.z + direction.z * distance
  return isGrass(x, z) ? { x, z } : null
}
