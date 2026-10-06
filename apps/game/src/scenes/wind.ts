/**
 * Shared wind for every animated surface in a RUNWAY canvas (grass, tree foliage, hanging fabric).
 *
 * One module-level state is advanced once per frame by `useWindDriver()`; consumers read the SAME
 * uniform objects from `getWindUniforms()`, so grass, leaves and cloth answer the same gust at the
 * same moment. All math here is pure and mirrored in the GLSL chunk so it can be unit tested in Node.
 *
 * Model
 * - direction: unit vec2 (x, z). Base heading ~28° (matches the old grass push vector) drifting ±15°
 *   with two slow incommensurate sines (periods ~2 and ~1.3 minutes).
 * - strength: 0..1 base wind (0 under reduced motion / hidden tab).
 * - gust: 0..1 envelope from three sines with irrational frequency ratios (f, f·φ, f·(√2−1)); the sum
 *   is thresholded so that a clear gust arrives ~5 times per minute and lasts 3-6 s (p50 ≈ 3.6 s).
 * - windOffset(): dimensionless sway in [-1, 1] × (1 − stiffness), zero at the root, ∝ height², so tips
 *   flex more than roots. Consumers multiply by an amplitude in metres.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export interface WindState {
  /** Unit horizontal wind direction (x, z). */
  direction: THREE.Vector2
  /** Base wind strength 0..1 (0 when reduced motion is requested). */
  strength: number
  /** Current gust envelope 0..1. */
  gust: number
  /** Accumulated gust clock (seconds, keeps running at a fixed rate; kept for debugging/tests). */
  gustPhase: number
  /** Wind clock in seconds (frozen while hidden / reduced motion). */
  time: number
}

export const WIND_BASE_ANGLE = Math.atan2(0.4, 0.75)
export const WIND_DRIFT = THREE.MathUtils.degToRad(15)
const GUST_F1 = 0.53
const GUST_F2 = GUST_F1 * 1.6180339887
const GUST_F3 = GUST_F1 * 0.4142135624
const GUST_LOW = 0.6
const GUST_HIGH = 0.85
const MAX_DELTA = 0.05

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Raw gust noise 0..1 (sum of three sines with irrational ratios). */
export function gustNoise(t: number) {
  return 0.5 + 0.5 * (Math.sin(t * GUST_F1) * 0.5 + Math.sin(t * GUST_F2 + 1.7) * 0.32 + Math.sin(t * GUST_F3 + 0.4) * 0.18)
}

/** Gust envelope 0..1 at time t: thresholded noise so gusts are occasional and last a few seconds. */
export function gustEnvelope(t: number) {
  return smoothstep(GUST_LOW, GUST_HIGH, gustNoise(t))
}

/** Wind heading (radians, from +x towards +z) at time t; drifts ±15° around the base heading. */
export function windAngle(t: number) {
  return WIND_BASE_ANGLE + WIND_DRIFT * (Math.sin(t * 0.052) * 0.6 + Math.sin(t * 0.0803 + 2) * 0.4)
}

/**
 * Dimensionless wind sway for one vertex. Pure; identical to `windSway` in WIND_GLSL.
 * @param height01 0 at the attachment/root, 1 at the tip (already inverted for hanging fabric)
 * @param stiffness 0 (limp) .. 1 (rigid)
 * @param t phase in seconds: wind time plus a spatial phase so the wind travels as a wave
 * @param gust effective wind level 0..1 (= strength × (0.5 + 0.5 × gust envelope))
 * @returns value in [-(1 − stiffness), (1 − stiffness)] × height01²
 */
export function windOffset(height01: number, stiffness: number, t: number, gust: number) {
  const h = Math.min(1, Math.max(0, height01))
  const sway = Math.sin(t) * 0.6 + Math.sin(t * 2.37 + 1.3) * 0.25 + Math.sin(t * 3.71) * 0.15
  const level = Math.min(1, Math.max(0, gust))
  return h * h * (1 - Math.min(1, Math.max(0, stiffness))) * level * sway
}

/** Effective wind level fed to windOffset(): calm wind still moves a little, gusts double it. */
export function windLevel(strength: number, gust: number) {
  return strength * (0.5 + 0.5 * gust)
}

const state: WindState = { direction: new THREE.Vector2(Math.cos(WIND_BASE_ANGLE), Math.sin(WIND_BASE_ANGLE)), strength: 1, gust: 0, gustPhase: 0, time: 0 }

const uniforms = {
  uWindDir: { value: state.direction },
  uWindTime: { value: 0 },
  uWindStrength: { value: 1 },
  uGust: { value: 0 },
}

export type WindUniforms = typeof uniforms

/** The single shared uniform set. Assign into `shader.uniforms` (same object references, never copies). */
export function getWindUniforms(): WindUniforms { return uniforms }

/** Read-only view of the current wind (for debugging, birds, tests). */
export function getWindState(): Readonly<WindState> { return state }

/** Advance the shared wind by `delta` seconds. Exported for tests; the driver calls it once per frame. */
export function stepWind(delta: number, options: { reducedMotion?: boolean; hidden?: boolean } = {}) {
  const dt = Math.min(Math.max(delta, 0), MAX_DELTA)
  const still = options.reducedMotion || options.hidden
  if (!still) {
    state.time += dt
    state.gustPhase += dt
  }
  const targetStrength = options.reducedMotion ? 0 : 1
  state.strength = THREE.MathUtils.damp(state.strength, targetStrength, 4, dt)
  state.gust = gustEnvelope(state.gustPhase)
  const angle = windAngle(state.gustPhase)
  state.direction.set(Math.cos(angle), Math.sin(angle))
  uniforms.uWindTime.value = state.time
  uniforms.uWindStrength.value = state.strength
  uniforms.uGust.value = state.gust
  return state
}

let owner: symbol | null = null

/**
 * Mount ONCE per canvas (the grass does this). Extra mounts are harmless: only the first live instance
 * steps the state, so the wind never advances twice in a frame.
 */
export function useWindDriver(reducedMotion = false) {
  const token = useMemo(() => Symbol('wind-driver'), [])
  useEffect(() => {
    if (owner === null) owner = token
    return () => { if (owner === token) owner = null }
  }, [token])
  useFrame((_, delta) => {
    if (owner !== null && owner !== token) return
    owner = token
    stepWind(delta, { reducedMotion, hidden: typeof document !== 'undefined' && document.hidden })
  }, -10)
}

/**
 * GLSL shared by every wind consumer. Declares the wind uniforms and:
 *   float windSway(float phase)                                  — same waveform as windOffset()
 *   float windPhase(vec2 worldXZ, float scale, float variation)  — traveling-wave phase
 *   float windLevel()                                            — strength × (0.5 + 0.5 × gust)
 *   vec3  windDisplace(vec2 worldXZ, float height01, float stiffness, float amplitude, float variation)
 *         — returns a metres offset along the wind direction with a small lateral component and a
 *           vertical shortening so bent tips do not stretch.
 */
export const WIND_GLSL = /* glsl */ `
uniform vec2 uWindDir;
uniform float uWindTime;
uniform float uWindStrength;
uniform float uGust;
float windSway(float phase) {
  return sin(phase) * 0.6 + sin(phase * 2.37 + 1.3) * 0.25 + sin(phase * 3.71) * 0.15;
}
float windPhase(vec2 worldXZ, float scale, float variation) {
  return uWindTime * 1.35 - dot(worldXZ, uWindDir) * scale + variation * 2.0;
}
float windLevel() {
  return uWindStrength * (0.5 + 0.5 * uGust);
}
vec3 windDisplace(vec2 worldXZ, float height01, float stiffness, float amplitude, float variation) {
  float h = clamp(height01, 0.0, 1.0);
  float phase = windPhase(worldXZ, 0.65, variation);
  float sway = windSway(phase) * h * h * (1.0 - stiffness) * windLevel() * amplitude;
  float lateral = sin(phase * 1.83 + variation * 4.0) * 0.28 * sway;
  vec2 dir = uWindDir;
  vec2 side = vec2(-dir.y, dir.x);
  vec2 xz = dir * (sway + abs(sway) * 0.35) + side * lateral;
  return vec3(xz.x, -length(xz) * 0.35 * h, xz.y);
}
`

export interface WindMaterialOptions {
  /** 0 = limp (cloth), 1 = rigid. Leaves ~0.35, thin branches ~0.7, cotton shirt ~0.15. */
  stiffness: number
  /** [attachment y, tip y] in the geometry's LOCAL space. Vertices at/below the first value never move. */
  heightRange: [number, number]
  /** Tip displacement in metres at full gust (before stiffness). Leaves ~0.18, shirt ~0.12. Default 0.15. */
  amplitude?: number
  /** Hanging fabric: anchored at heightRange[1] (top), free at heightRange[0] (hem). */
  invert?: boolean
  /** Extra per-vertex phase variation from a position hash (0 = coherent, 1 = fluttery; >0.4 can visibly shear leaf cards). Default 0.25. */
  flutter?: number
}

/** Optional depth material fields we mirror so shadow cutouts match the lit surface. */
type CutoutSource = Pick<THREE.MeshStandardMaterial, 'map' | 'alphaTest' | 'side' | 'alphaMap'>

function windVertexPatch(shader: THREE.WebGLProgramParametersWithUniforms, options: Required<WindMaterialOptions>) {
  Object.assign(shader.uniforms, uniforms)
  shader.vertexShader = WIND_GLSL + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
    #include <begin_vertex>
    {
      vec4 windWorld = modelMatrix * vec4(position, 1.0);
      #ifdef USE_INSTANCING
        windWorld = modelMatrix * instanceMatrix * vec4(position, 1.0);
      #endif
      float windH = clamp((position.y - ${options.heightRange[0].toFixed(4)}) / ${(options.heightRange[1] - options.heightRange[0] || 1).toFixed(4)}, 0.0, 1.0);
      ${options.invert ? 'windH = 1.0 - windH;' : ''}
      float windVar = fract(sin(dot(position.xz, vec2(12.9898, 78.233))) * 43758.5453) * ${options.flutter.toFixed(3)};
      vec3 windDelta = windDisplace(windWorld.xz, windH, ${options.stiffness.toFixed(3)}, ${options.amplitude.toFixed(3)}, windVar);
      mat3 windModel = mat3(modelMatrix);
      #ifdef USE_INSTANCING
        windModel = windModel * mat3(instanceMatrix);
      #endif
      // world -> object for rotation + uniform scale (transpose / scale^2); non-uniform scale is unsupported.
      transformed += (transpose(windModel) * windDelta) / max(dot(windModel[0], windModel[0]), 1e-6);
    }
  `)
}

/**
 * Patch a MeshStandardMaterial (and build a matching depth material) so it bends with the shared wind.
 * The displacement is weighted by a per-vertex height factor: 0 at heightRange[0], 1 at heightRange[1]
 * (inverted for hanging fabric). Assign the returned depthMaterial to `mesh.customDepthMaterial` so the
 * shadow map bends with the surface. Both materials must be disposed by the caller.
 *
 * Tree leaves (EnvironmentAssets.tsx): `applyWindToMaterial(material, { stiffness: 0.35, heightRange: [1.4, 4.6], amplitude: 0.18 })`
 * Laundry shirt plane hung from the top edge: `applyWindToMaterial(material, { stiffness: 0.15, heightRange: [-0.35, 0.35], amplitude: 0.12, invert: true })`
 */
export function applyWindToMaterial(material: THREE.MeshStandardMaterial, options: WindMaterialOptions) {
  const resolved: Required<WindMaterialOptions> = { stiffness: options.stiffness, heightRange: options.heightRange, amplitude: options.amplitude ?? 0.15, invert: options.invert ?? false, flutter: options.flutter ?? 0.25 }
  const key = `runway-wind-${resolved.stiffness}-${resolved.heightRange.join('/')}-${resolved.amplitude}-${resolved.invert}-${resolved.flutter}`
  const previous = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    previous?.(shader, renderer)
    windVertexPatch(shader, resolved)
  }
  material.customProgramCacheKey = () => key
  material.needsUpdate = true
  const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  const cutout: CutoutSource = material
  depthMaterial.map = cutout.map
  depthMaterial.alphaMap = cutout.alphaMap
  depthMaterial.alphaTest = cutout.alphaTest
  depthMaterial.side = cutout.side
  depthMaterial.onBeforeCompile = (shader) => windVertexPatch(shader, resolved)
  depthMaterial.customProgramCacheKey = () => key + '-depth'
  return { material, depthMaterial, key }
}
