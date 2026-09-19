import { AnimationClip, Bone, Matrix3, Matrix4, Object3D, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack, type KeyframeTrack } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'

/**
 * Optional licensed clip drop-in (no Blender needed): public/assets/animations/manifest.json lists Mixamo
 * "without skin" FBX files per semantic slot. Clips are validated against the instantiated skeleton, renamed to the
 * runtime bone names, and made in-place (the controller moves the body; hips X/Z translation is discarded).
 */
export const MANIFEST_SLOTS = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'turnLeft', 'turnRight'] as const
export type ManifestSlot = typeof MANIFEST_SLOTS[number]
export interface AnimationManifest { clips: Partial<Record<ManifestSlot, string>> }

export const MANIFEST_URL = '/assets/animations/manifest.json'
export const ANIMATIONS_BASE = '/assets/animations/'
/** Minimum share of a clip's target bones that must exist in the skeleton. */
export const BONE_COVERAGE_MIN = 0.9

/** "mixamorig:Hips" | "mixamorigHips" | "mixamorig_Hips" | "Hips" -> "hips" */
export const normalizeBoneName = (name: string) => name.replace(/^mixamorig[:_]?/i, '').toLowerCase()

export function skeletonBoneMap(root: Object3D) {
  const map = new Map<string, string>()
  root.traverse((object) => { if (object instanceof Bone) map.set(normalizeBoneName(object.name), object.name) })
  return map
}

/** Where the rig keeps its hips at rest, expressed so a world-space vertical bob can be written into the local track. */
export interface HipsFrame {
  /** rest translation of the Hips node in its parent's space (rig units) */
  restLocal: { x: number; y: number; z: number }
  /** world "up" (1 m) expressed in the Hips parent's space (rig units) */
  upLocal: { x: number; y: number; z: number }
  /** rest height of the hips above the model root, metres */
  restHeight: number
}

export function hipsFrame(root: Object3D, hipsName: string): HipsFrame | null {
  const hips = root.getObjectByName(hipsName)
  if (!hips?.parent) return null
  root.updateWorldMatrix(true, true)
  const rootInverse = new Matrix4().copy(root.matrixWorld).invert()
  const parentToRoot = new Matrix4().multiplyMatrices(rootInverse, hips.parent.matrixWorld)
  const hipsToRoot = new Matrix4().multiplyMatrices(rootInverse, hips.matrixWorld)
  const restHeight = new Vector3().setFromMatrixPosition(hipsToRoot).y
  const upLocal = new Vector3(0, 1, 0).applyMatrix3(new Matrix3().setFromMatrix4(parentToRoot.invert()))
  return { restLocal: { x: hips.position.x, y: hips.position.y, z: hips.position.z }, upLocal: { x: upLocal.x, y: upLocal.y, z: upLocal.z }, restHeight }
}

export interface RetargetResult { clip: AnimationClip | null; coverage: number; dropped: string[]; hipsScale: number | null }

/**
 * Rebind a Mixamo FBX clip onto the runtime skeleton by bone name.
 * - Rotation tracks are renamed only (assumes identical rest orientations: same Mixamo rig family).
 * - The Hips position track keeps its vertical bob only, rescaled from FBX units to metres via the FBX skeleton's own
 *   rest hips height (Mixamo cm -> this is 0.01 for a metric rig) and written along the rig's local up axis;
 *   X/Z stay at the rest pose (in-place policy).
 * - Other position/scale tracks are dropped (proportions belong to the model, not the clip).
 */
export function retargetClip(source: AnimationClip, slot: ManifestSlot, boneMap: Map<string, string>, hips: HipsFrame | null, fbxRestHipsY: number | null): RetargetResult {
  const targets = new Set<string>()
  const matched = new Set<string>()
  const tracks: KeyframeTrack[] = []
  const dropped: string[] = []
  let hipsScale: number | null = null
  for (const track of source.tracks) {
    const dot = track.name.lastIndexOf('.')
    const node = track.name.slice(0, dot), property = track.name.slice(dot + 1)
    const normalized = normalizeBoneName(node)
    targets.add(normalized)
    const bone = boneMap.get(normalized)
    if (!bone) { dropped.push(track.name); continue }
    matched.add(normalized)
    if (property === 'quaternion') {
      tracks.push(new QuaternionKeyframeTrack(`${bone}.quaternion`, Array.from(track.times), Array.from(track.values)))
    } else if (property === 'position' && normalized === 'hips' && hips && fbxRestHipsY && Math.abs(fbxRestHipsY) > 1e-6) {
      hipsScale = hips.restHeight / fbxRestHipsY
      const values = new Array<number>(track.values.length)
      for (let i = 0; i < track.times.length; i++) {
        const bob = (track.values[i * 3 + 1] - fbxRestHipsY) * hipsScale
        values[i * 3] = hips.restLocal.x + hips.upLocal.x * bob
        values[i * 3 + 1] = hips.restLocal.y + hips.upLocal.y * bob
        values[i * 3 + 2] = hips.restLocal.z + hips.upLocal.z * bob
      }
      tracks.push(new VectorKeyframeTrack(`${bone}.position`, Array.from(track.times), values))
    } else dropped.push(track.name)
  }
  const coverage = targets.size ? matched.size / targets.size : 0
  if (coverage < BONE_COVERAGE_MIN || tracks.length === 0) return { clip: null, coverage, dropped, hipsScale }
  const clip = new AnimationClip(`manifest:${slot}`, source.duration, tracks)
  clip.userData = { slot, source: source.name }
  return { clip, coverage, dropped, hipsScale }
}

export async function fetchManifest(url = MANIFEST_URL): Promise<AnimationManifest> {
  try {
    const response = await fetch(url, { cache: 'no-cache' })
    if (!response.ok) return { clips: {} }
    const data = await response.json() as Partial<AnimationManifest>
    return { clips: data.clips ?? {} }
  } catch { return { clips: {} } }
}

/** Load, validate and retarget every manifest clip onto `root` (an instantiated SkeletonUtils clone). */
export async function loadManifestClips(root: Object3D, manifest?: AnimationManifest): Promise<AnimationClip[]> {
  const entries = Object.entries((manifest ?? await fetchManifest()).clips) as [ManifestSlot, string][]
  if (entries.length === 0) return []
  const boneMap = skeletonBoneMap(root)
  const hipsName = boneMap.get('hips')
  const hips = hipsName ? hipsFrame(root, hipsName) : null
  const loader = new FBXLoader()
  const clips: AnimationClip[] = []
  for (const [slot, file] of entries) {
    if (!MANIFEST_SLOTS.includes(slot)) { console.warn(`[animations] unknown manifest slot "${slot}" ignored`); continue }
    const url = /^(https?:)?\//.test(file) ? file : ANIMATIONS_BASE + file
    try {
      const group = await loader.loadAsync(url)
      const source = group.animations[0]
      if (!source) { console.warn(`[animations] ${file} has no animation`); continue }
      let fbxRestHipsY: number | null = null
      group.traverse((object) => { if (fbxRestHipsY === null && normalizeBoneName(object.name) === 'hips') fbxRestHipsY = object.position.y })
      const result = retargetClip(source, slot, boneMap, hips, fbxRestHipsY)
      if (!result.clip) { console.warn(`[animations] ${file}: only ${(result.coverage * 100).toFixed(0)}% of its bones exist in the skeleton; clip ignored`, result.dropped.slice(0, 5)); continue }
      clips.push(result.clip)
    } catch (error) { console.warn(`[animations] failed to load ${url}`, error) }
  }
  return clips
}
