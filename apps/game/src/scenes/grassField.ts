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
