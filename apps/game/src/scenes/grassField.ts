import { isGrass } from '../engine/firstPerson.ts'
import { seededRandom } from './sceneMaterials.ts'

export type GroundCoverKind = 'grass' | 'seed' | 'clover'

export function createGrassField(kind: GroundCoverKind) {
  const count = kind === 'grass' ? 56000 : kind === 'seed' ? 800 : 1600
  const random = seededRandom(kind === 'grass' ? 7319 : kind === 'seed' ? 1843 : 9251)
  const offsets = new Float32Array(count * 3)
  const shapes = new Float32Array(count * 4)
  let centerX = 0, centerZ = 0
  for (let i = 0; i < count; i++) {
    let x: number, z: number
    let valid = false
    do {
      if (i % 8 === 0 || !isGrass(centerX, centerZ) || kind !== 'grass') {
        centerX = (random() - 0.5) * 14.2
        centerZ = 2.18 + random() * 9.85
      }
      x = centerX + (random() - 0.5) * 0.28
      z = centerZ + (random() - 0.5) * 0.28
      valid = isGrass(x, z) && !(Math.abs(Math.abs(x) - 5.1) < 1.35 && Math.abs(z - 8) < 0.45) && !(kind === 'seed' && Math.abs(x) < 3.4 && z < 10.2)
      if (!valid) centerX = 0
    } while (!valid)
    const patch = (Math.sin(x * 1.7 + Math.cos(z * 0.9)) * Math.cos(z * 1.25) + 1) * 0.5
    const border = Math.min(1, Math.max(0, (Math.abs(x) - 1.15) / 0.8))
    const height = kind === 'grass' ? 0.10 + border * (0.08 + patch * 0.18 + random() ** 2 * 0.19) : kind === 'seed' ? 0.45 + random() * 0.34 : 0.045 + random() * 0.08
    const width = kind === 'clover' ? 0.09 + random() * 0.07 : kind === 'seed' ? 0.042 + random() * 0.018 : 0.009 + random() * 0.009
    offsets.set([x, 0.024, z], i * 3)
    shapes.set([random() * Math.PI * 2, height, width, patch * 0.65 + random() * 0.35], i * 4)
  }
  return { count, offsets, shapes }
}

export interface GrassField { count: number; offsets: Float32Array; shapes: Float32Array }
export interface GrassBounds { center: [number, number, number]; radius: number }

/** Tip displacement (metres) of a blade at full wind level; the shader multiplies by height² and the shared wind level. */
export const GRASS_WIND_AMPLITUDE = 0.09

/**
 * Largest horizontal displacement (metres) the meadow vertex shader can add to a blade tip:
 * wind (amplitude × (1 + 0.35 overshoot + 0.28 lateral)) + lean (≤0.4) + player foot (0.38) + brush (0.48).
 */
export const GRASS_MAX_DISPLACEMENT = GRASS_WIND_AMPLITUDE * (1 + 0.35 + 0.28) + 0.4 + 0.38 + 0.48

/**
 * Bounding sphere for a ground-cover layer covering every blade root, the tallest blade tip and the
 * maximum animated displacement, so frustum culling never clips swaying or brushed grass.
 */
export function grassBounds(field: GrassField, maxDisplacement = GRASS_MAX_DISPLACEMENT): GrassBounds {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity, minY = Infinity, maxHeight = 0
  for (let i = 0; i < field.count; i++) {
    const x = field.offsets[i * 3], y = field.offsets[i * 3 + 1], z = field.offsets[i * 3 + 2]
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z)
    minY = Math.min(minY, y)
    maxHeight = Math.max(maxHeight, y + field.shapes[i * 4 + 1])
  }
  if (!Number.isFinite(minX)) return { center: [0, 0, 0], radius: maxDisplacement }
  const center: [number, number, number] = [(minX + maxX) / 2, (minY + maxHeight) / 2, (minZ + maxZ) / 2]
  const halfX = (maxX - minX) / 2 + maxDisplacement
  const halfY = (maxHeight - minY) / 2
  const halfZ = (maxZ - minZ) / 2 + maxDisplacement
  return { center, radius: Math.hypot(halfX, halfY, halfZ) + 0.05 }
}
