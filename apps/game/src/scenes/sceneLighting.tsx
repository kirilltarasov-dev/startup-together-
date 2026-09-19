import { ContactShadows, useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import type { SceneId } from '../state/types'
import type { Mood } from '../components/World'
import { MATERIAL as M, seededRandom } from './sceneMaterials'

/**
 * One lighting rig per location. Sun/sky/fog/exposure/environment intensity and the practical lights are a
 * single table keyed by scene id, so a location reads as one time of day instead of a daylight rig with
 * props swapped. The host canvases (FirstPersonWorld / ThirdPersonWorld) own the renderer, the drei <Sky>,
 * the hemisphere fill, the shadow-casting directional light and the HDR <Environment>; this module drives
 * those existing objects imperatively (damped per frame) rather than adding a second tone-mapping pipeline
 * or a second sun. Point/spot practicals use physical units (candela) with finite distance and decay 2.
 */

export type LightingSceneId = SceneId | 'devin'
type Vec3 = [number, number, number]

export interface Practical {
  kind: 'point' | 'spot'
  position: Vec3
  target?: Vec3
  color: string
  intensity: number
  distance: number
  angle?: number
  penumbra?: number
  castShadow?: boolean
  /** Follow the story mood (coral alarm / teal win) like the original pendants. */
  moodTint?: boolean
}

export interface LightingPreset {
  label: string
  exposure: number
  sun: { position: Vec3; color: string; intensity: number }
  hemisphere: { sky: string; ground: string; intensity: number }
  environmentIntensity: number
  /** drei <Sky> sun position; below the horizon renders a dark night gradient. */
  skySun: Vec3
  background: string
  fog: { color: string; near: number; far: number }
  contactShadows: { opacity: number; blur: number; color: string }
  /**
   * True night: the host's daylight <Sky> dome is hidden (its Preetham shader never gets darker than dusk-grey
   * with the sun below the horizon) and replaced by a dark zenith->horizon gradient dome plus a sparse star
   * field above the roofline. The HDR stays mounted for reflections only (environmentIntensity), never as
   * background.
   */
  night?: { zenith: string; horizon: string; stars: number }
  practicals: Practical[]
}

const screenGlow = (color: string, intensity: number, distance: number): Practical[] => [-1.8, 0, 1.8].map((x) => ({ kind: 'point', position: [x, 1.12, -5.55] as Vec3, color, intensity, distance }))

/**
 * Founder face fill: one low, camera-side spot from just above desk height in front of the left seat, aimed up
 * under Sadman's hood (x -1.8, y ~1.15, z ~-6.45) like laptop-screen bounce. Kirill (x 0) sits at ~50 deg off
 * axis, outside the 0.7 rad cone, and Sergio further still, so the other two faces keep their Phase 1 values.
 * Distance-limited (decay 2, 3.5 m cut-off), no shadow casting, tinted per location so it reads as bounce.
 * Known limit: from eye height the Sadman asset shows almost only its navy hood (#0f151b diffuse, ~1 % albedo), so
 * the measured head luminance moves only a few points per 5 cd; pushing harder just hot-spots the wall behind him.
 */
const FACE_FILL_POSITION: Vec3 = [-0.9, 1.05, -4.8]
const FACE_FILL_TARGET: Vec3 = [-1.75, 1.15, -6.45]
const faceFill = (color: string, intensity: number): Practical => ({ kind: 'spot', position: FACE_FILL_POSITION, target: FACE_FILL_TARGET, color, intensity, distance: 3.5, angle: 0.7, penumbra: 0.5 })

export const SCENE_LIGHTING: Record<LightingSceneId, LightingPreset> = {
  S1: {
    label: 'Puzl CowOrKing loft, Budapest — late afternoon hackathon: cool daylight through the glass wall, warm tungsten pendants inside',
    exposure: 1.1,
    sun: { position: [-7, 10, 6], color: '#ffe0b8', intensity: 1.9 },
    hemisphere: { sky: '#b4c9dc', ground: '#5a5046', intensity: 0.42 },
    environmentIntensity: 0.7,
    skySun: [-9, 9, 5],
    background: '#bdcfd0',
    fog: { color: '#b9c7bc', near: 24, far: 75 },
    contactShadows: { opacity: 0.55, blur: 2.4, color: '#1b1a17' },
    practicals: [
      ...[-2.6, 2.6].map((x): Practical => ({ kind: 'point', position: [x, 2.9, -4.5], color: '#ffc47c', intensity: 16, distance: 8, moodTint: true })),
      { kind: 'point', position: [-4.8, 2.9, -2.2], color: '#ffc47c', intensity: 8, distance: 6.5, moodTint: true },
      { kind: 'spot', position: [-4.73, 0.8, -5.98], target: [-4.8, 1.95, -7.83], color: '#dfe9ff', intensity: 5, distance: 4.5, angle: 0.5, penumbra: 0.5 },
      ...screenGlow('#8fd3e6', 2.0, 2.0),
      // Daylight through the glass wall as a soft cool key on the founders (the ceiling blocks the direct sun back there).
      { kind: 'spot', position: [0, 2.4, -0.3], target: [0, 1.1, -6.45], color: '#dfe9ff', intensity: 42, distance: 12, angle: 0.55, penumbra: 0.7 },
      faceFill('#ffe9d2', 5),
    ],
  },
  S2: {
    label: 'Debrecen two-room apartment, 03:00 — one warm desk lamp and laptop glow inside, cold moonlight and street sodium spill through the window',
    exposure: 1.1,
    sun: { position: [5, 4, 9], color: '#7d96c4', intensity: 0.6 },
    hemisphere: { sky: '#2a3f66', ground: '#0c0a07', intensity: 0.45 },
    environmentIntensity: 0.06,
    skySun: [0.3, -0.25, 1],
    background: '#060a14',
    fog: { color: '#0a1020', near: 12, far: 55 },
    contactShadows: { opacity: 0.7, blur: 1.8, color: '#030406' },
    night: { zenith: '#04060c', horizon: '#0d1222', stars: 360 },
    practicals: [
      { kind: 'spot', position: [0.46, 1.5, -5.06], target: [0.05, 0.84, -5.5], color: '#ffb066', intensity: 30, distance: 6, angle: 1.05, penumbra: 0.7, castShadow: true, moodTint: true },
      ...screenGlow('#7fc8ff', 2.6, 2.4),
      // Cold window key: the low moon cannot reach the back of a 2.5 m room through a 2.5 m window, so a wide blue
      // spot at the glass stands in for the sky/streetlight seen through it.
      { kind: 'spot', position: [0, 2.2, 0.4], target: [0, 1.1, -6.4], color: '#6f8fc8', intensity: 55, distance: 12, angle: 0.7, penumbra: 0.6 },
      { kind: 'point', position: [5.2, 2.05, -5.9], color: '#ffd9a0', intensity: 5, distance: 4.5 },
      // Courtyard sodium lamp (the StreetLamp post in SceneEnvironment stands at the same spot, right of the glass
      // wall, inside the spawn frame): amber spill on the brick, the side wall and the grass.
      { kind: 'point', position: [7.4, 3.15, -2.5], color: '#ff9a3c', intensity: 18, distance: 13 },
      faceFill('#ffc9a0', 12),
    ],
  },
  S3: {
    label: 'Accelerator investor room — neutral overcast daylight, even recessed downlights, low saturation',
    exposure: 1.1,
    sun: { position: [-4, 11, 7], color: '#fff4e6', intensity: 2.2 },
    hemisphere: { sky: '#d3d8dd', ground: '#6a6661', intensity: 0.6 },
    environmentIntensity: 1.0,
    skySun: [-9, 9, 5],
    background: '#c9d0d4',
    fog: { color: '#c3c9cb', near: 26, far: 80 },
    contactShadows: { opacity: 0.45, blur: 2.8, color: '#15171a' },
    practicals: [
      ...[-1.6, 1.6].flatMap((x) => [-5.7, -2.6].map((z): Practical => ({ kind: 'spot', position: [x, 3.68, z], target: [x, 0, z], color: '#f5f2ea', intensity: 18, distance: 7, angle: 0.85, penumbra: 0.55 }))),
      { kind: 'point', position: [4.6, 1.9, -5.7], color: '#a9bccf', intensity: 1.4, distance: 2.8 },
      ...screenGlow('#9fb4c8', 0.8, 1.6),
      { kind: 'spot', position: [0, 2.4, -0.3], target: [0, 1.1, -6.45], color: '#f4f4f0', intensity: 34, distance: 12, angle: 0.55, penumbra: 0.7 },
      faceFill('#f6f3ec', 3),
    ],
  },
  devin: {
    label: 'Mission control — dark blue room lit by monitors',
    exposure: 0.95,
    sun: { position: [3, 8, 6], color: '#5a76b8', intensity: 0.4 },
    hemisphere: { sky: '#1e2a48', ground: '#080a10', intensity: 0.15 },
    environmentIntensity: 0.1,
    skySun: [0.3, -0.25, 1],
    background: '#070a16',
    fog: { color: '#0a1024', near: 14, far: 60 },
    contactShadows: { opacity: 0.6, blur: 2, color: '#04050a' },
    night: { zenith: '#04060c', horizon: '#0c1226', stars: 360 },
    practicals: [
      // Same apartment dressing as S2 (the mission runs from Debrecen): desk lamp plus monitor light gone Devin-blue.
      { kind: 'spot', position: [0.46, 1.5, -5.06], target: [0.05, 0.84, -5.5], color: '#ffb066', intensity: 18, distance: 6, angle: 1.05, penumbra: 0.7, castShadow: true, moodTint: true },
      ...screenGlow(M.devin, 3.2, 2.6),
      { kind: 'spot', position: [0, 2.2, 0.4], target: [0, 1.1, -6.4], color: M.devin, intensity: 40, distance: 12, angle: 0.7, penumbra: 0.6 },
      { kind: 'point', position: [7.4, 3.15, -2.5], color: '#ff9a3c', intensity: 10, distance: 13 },
      faceFill('#c9d6ff', 8),
    ],
  },
}

// ------------------------------------------------------------------------------------------------------------
// Quality hooks (wired by world/quality.ts through setLightingQuality; this module never imports it).

export interface LightingQuality {
  /** Shadow map edge for the host sun; practical spots use min(1024, shadowMapSize). */
  shadowMapSize: number
  /** Master switch for every shadow-casting light this module drives (host sun + practicals). */
  shadows: boolean
  /** Whether the drei ContactShadows grounding pass renders at all. */
  contactShadows: boolean
}

let lightingQuality: LightingQuality = { shadowMapSize: 2048, shadows: true, contactShadows: true }
const qualityListeners = new Set<() => void>()

export function getLightingQuality(): LightingQuality { return lightingQuality }

/** Merge a quality update; listeners (mounted SceneLighting rigs) re-apply shadow maps on the next frame. */
export function setLightingQuality(next: Partial<LightingQuality>) {
  const merged: LightingQuality = {
    shadowMapSize: Math.max(256, Math.round(next.shadowMapSize ?? lightingQuality.shadowMapSize)),
    shadows: next.shadows ?? lightingQuality.shadows,
    contactShadows: next.contactShadows ?? lightingQuality.contactShadows,
  }
  if (merged.shadowMapSize === lightingQuality.shadowMapSize && merged.shadows === lightingQuality.shadows && merged.contactShadows === lightingQuality.contactShadows) return
  lightingQuality = merged
  qualityListeners.forEach((listener) => listener())
}

function subscribeLightingQuality(listener: () => void) {
  qualityListeners.add(listener)
  return () => { qualityListeners.delete(listener) }
}

function useLightingQuality() {
  return useSyncExternalStore(subscribeLightingQuality, getLightingQuality, getLightingQuality)
}

/**
 * Apply a shadow map size / on-off to a light without leaking the old map: three keeps `shadow.map` as a render
 * target sized on first use, so a size change must dispose it and let the next shadow pass recreate it.
 */
function applyShadowQuality(light: THREE.DirectionalLight | THREE.SpotLight, size: number, enabled: boolean) {
  let changed = false
  if (light.castShadow !== enabled) { light.castShadow = enabled; changed = true }
  if (light.shadow.mapSize.x !== size || light.shadow.mapSize.y !== size) {
    light.shadow.mapSize.set(size, size)
    light.shadow.map?.dispose()
    light.shadow.map = null
    changed = true
  }
  if (changed) light.shadow.needsUpdate = true
  return changed
}

const PRACTICAL_SHADOW_MAP_MAX = 1024

export function moodColor(base: string, mood: Mood, follow = true) {
  if (!follow) return base
  return mood === 'alarm' ? M.alarm : mood === 'win' ? M.win : mood === 'devin' ? M.devin : base
}

const isSkyDome = (object: THREE.Object3D): object is THREE.Mesh => object instanceof THREE.Mesh && !!(object.material as THREE.ShaderMaterial).uniforms?.sunPosition

interface HostRig {
  sun: THREE.DirectionalLight | null
  hemisphere: THREE.HemisphereLight | null
  sky: THREE.Mesh | null
  restore: () => void
}

/**
 * Locate the host canvas' sun/hemisphere/sky lazily (the whole R3F tree commits after this component renders,
 * so siblings are not attached during render) and remember their values so unmounting restores them.
 */
function useHostRig() {
  const scene = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const rig = useRef<HostRig | null>(null)
  const resolve = useCallback((): HostRig => {
    if (rig.current) return rig.current
    const sun = scene.children.find((object): object is THREE.DirectionalLight => object instanceof THREE.DirectionalLight && !object.userData.runwayPractical) ?? null
    const hemisphere = scene.children.find((object): object is THREE.HemisphereLight => object instanceof THREE.HemisphereLight) ?? null
    const sky = scene.children.find(isSkyDome) ?? null
    const saved = {
      exposure: gl.toneMappingExposure,
      environment: scene.environmentIntensity,
      background: scene.background instanceof THREE.Color ? scene.background.clone() : null,
      fog: scene.fog instanceof THREE.Fog ? { color: scene.fog.color.clone(), near: scene.fog.near, far: scene.fog.far } : null,
      sun: sun ? { color: sun.color.clone(), intensity: sun.intensity, position: sun.position.clone() } : null,
      hemisphere: hemisphere ? { color: hemisphere.color.clone(), ground: hemisphere.groundColor.clone(), intensity: hemisphere.intensity } : null,
      skySun: sky ? ((sky.material as THREE.ShaderMaterial).uniforms.sunPosition.value as THREE.Vector3).clone() : null,
      skyVisible: sky ? sky.visible : true,
    }
    // Sun shadow map size / castShadow are deliberately NOT restored: they follow the global quality setting.
    rig.current = {
      sun, hemisphere, sky,
      restore: () => {
        gl.toneMappingExposure = saved.exposure
        scene.environmentIntensity = saved.environment
        if (saved.background && scene.background instanceof THREE.Color) scene.background.copy(saved.background)
        if (saved.fog && scene.fog instanceof THREE.Fog) { scene.fog.color.copy(saved.fog.color); scene.fog.near = saved.fog.near; scene.fog.far = saved.fog.far }
        if (sun && saved.sun) { sun.color.copy(saved.sun.color); sun.intensity = saved.sun.intensity; sun.position.copy(saved.sun.position) }
        if (hemisphere && saved.hemisphere) { hemisphere.color.copy(saved.hemisphere.color); hemisphere.groundColor.copy(saved.hemisphere.ground); hemisphere.intensity = saved.hemisphere.intensity }
        if (sky && saved.skySun) ((sky.material as THREE.ShaderMaterial).uniforms.sunPosition.value as THREE.Vector3).copy(saved.skySun)
        if (sky) sky.visible = saved.skyVisible
      },
    }
    return rig.current
  }, [scene, gl])
  useEffect(() => () => { rig.current?.restore(); rig.current = null }, [scene, gl])
  return resolve
}

function PracticalLight({ light, mood }: { light: Practical; mood: Mood }) {
  const target = useMemo(() => new THREE.Object3D(), [])
  const spot = useRef<THREE.SpotLight>(null)
  const quality = useLightingQuality()
  const color = moodColor(light.color, mood, !!light.moodTint)
  const castShadow = !!light.castShadow && quality.shadows
  const mapSize = Math.min(PRACTICAL_SHADOW_MAP_MAX, quality.shadowMapSize)
  // Imperative so a size change disposes the old shadow map instead of leaving a stale render target behind.
  useEffect(() => { if (spot.current) applyShadowQuality(spot.current, mapSize, castShadow) }, [mapSize, castShadow])
  if (light.kind === 'point') {
    return <pointLight position={light.position} color={color} intensity={light.intensity} distance={light.distance} decay={2} userData={{ runwayPractical: true }} />
  }
  return <group>
    <primitive object={target} position={light.target ?? [light.position[0], 0, light.position[2]]} />
    <spotLight
      ref={spot}
      position={light.position}
      target={target}
      color={color}
      intensity={light.intensity}
      distance={light.distance}
      decay={2}
      angle={light.angle ?? 0.8}
      penumbra={light.penumbra ?? 0.5}
      castShadow={castShadow}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      userData={{ runwayPractical: true }}
    />
  </group>
}

const NIGHT_DOME_RADIUS = 80
const NIGHT_STAR_LIMIT = 400

/**
 * Night dome + stars for presets with `night`. The dome is a back-facing sphere with a zenith->horizon gradient
 * (fog disabled so it is never fogged toward the daylight fog colour); the stars are one additive Points cloud on
 * the upper hemisphere (elevation >= 14 deg, so they sit above the 10 m facade roofline from anywhere in the
 * courtyard) with per-star brightness/tint. Both follow the camera so the dome never intersects geometry.
 */
function NightSky({ zenith, horizon, stars }: { zenith: string; horizon: string; stars: number }) {
  const camera = useThree((state) => state.camera)
  const group = useRef<THREE.Group>(null)
  const dome = useMemo(() => {
    const geometry = new THREE.SphereGeometry(NIGHT_DOME_RADIUS, 24, 12)
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { zenith: { value: new THREE.Color(zenith) }, horizon: { value: new THREE.Color(horizon) } },
      vertexShader: 'varying float elevation; void main() { elevation = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; varying float elevation;
        void main() {
          float t = smoothstep(-0.05, 0.55, elevation);
          vec3 color = mix(horizon, zenith, t);
          gl_FragColor = vec4(color, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
    return { geometry, material }
  }, [zenith, horizon])
  const field = useMemo(() => {
    const count = Math.min(NIGHT_STAR_LIMIT, Math.max(0, Math.round(stars)))
    const random = seededRandom(2603)
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const tint = new THREE.Color()
    for (let i = 0; i < count; i++) {
      const azimuth = random() * Math.PI * 2
      // Bias toward the zenith: uniform in sin(elevation) between 14 deg and 88 deg.
      const elevation = Math.asin(THREE.MathUtils.lerp(Math.sin(0.245), Math.sin(1.536), random()))
      const radius = NIGHT_DOME_RADIUS * 0.96
      positions.set([Math.cos(elevation) * Math.cos(azimuth) * radius, Math.sin(elevation) * radius, Math.cos(elevation) * Math.sin(azimuth) * radius], i * 3)
      const magnitude = 0.4 + random() ** 2.2 * 0.6
      tint.setHSL(random() < 0.2 ? 0.08 : 0.6, 0.25 + random() * 0.3, 0.7).multiplyScalar(magnitude)
      colors.set([tint.r, tint.g, tint.b], i * 3)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    const material = new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })
    return { geometry, material, count }
  }, [stars])
  useEffect(() => () => { dome.geometry.dispose(); dome.material.dispose() }, [dome])
  useEffect(() => () => { field.geometry.dispose(); field.material.dispose() }, [field])
  useFrame(() => { if (group.current) group.current.position.copy(camera.position) })
  return <group ref={group} name="night-sky">
    <mesh geometry={dome.geometry} material={dome.material} renderOrder={-2} frustumCulled={false} />
    <points geometry={field.geometry} material={field.material} renderOrder={-1} frustumCulled={false} />
  </group>
}

const RATE = 3.2

/**
 * Fixed evidence cameras: first-person spawn pose, standing in front of the desk, a side view and one close-up per
 * seated founder. Eye height stays 1.65 m because the first-person controller damps the camera back to it.
 */
export const CAMERA_VIEWS = {
  spawn: { position: [0, 1.65, 5.2], lookAt: [0, 1.4, -5] },
  desk: { position: [0, 1.65, -3.3], lookAt: [0, 1.2, -6.4] },
  side: { position: [-3.6, 1.65, -1.2], lookAt: [3.5, 1.1, -6.2] },
  faceSadman: { position: [-1.8, 1.65, -5.3], lookAt: [-1.8, 1.15, -6.45] },
  faceKirill: { position: [0, 1.65, -5.3], lookAt: [0, 1.15, -6.45] },
  faceSergio: { position: [1.8, 1.65, -5.3], lookAt: [1.8, 1.15, -6.45] },
  /** Just inside the glass wall, looking up and out over the far facade roofline (z=17, 10 m) at the sky. */
  sky: { position: [2.8, 1.65, -0.3], lookAt: [2.8, 12, 14] },
  /** From the courtyard path toward the sodium lamp post right of the glass wall. */
  street: { position: [1.2, 1.65, 3.0], lookAt: [7.4, 3, -2.5] },
} as const

export function SceneLighting({ scene, mood }: { scene: LightingSceneId; mood: Mood }) {
  const preset = SCENE_LIGHTING[scene]
  const three = useThree((state) => state.scene)
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const resolveRig = useHostRig()
  const progress = useProgress((state) => `${state.active}/${state.loaded}`)
  const quality = useLightingQuality()
  const snapped = useRef(false)
  const targets = useMemo(() => ({
    sun: new THREE.Color(preset.sun.color), sunPosition: new THREE.Vector3(...preset.sun.position),
    hemisphereSky: new THREE.Color(preset.hemisphere.sky), hemisphereGround: new THREE.Color(preset.hemisphere.ground),
    background: new THREE.Color(preset.background), fog: new THREE.Color(preset.fog.color), skySun: new THREE.Vector3(...preset.skySun),
  }), [preset])
  useEffect(() => { snapped.current = false }, [three, gl])

  useFrame((_, frameDelta) => {
    const rig = resolveRig()
    // First frame after (re)mount snaps to the preset; later frames damp so in-place scene changes cross-fade.
    const k = snapped.current ? 1 - Math.exp(-RATE * Math.min(frameDelta, 0.1)) : 1
    snapped.current = true
    gl.toneMappingExposure = THREE.MathUtils.lerp(gl.toneMappingExposure, preset.exposure, k)
    // The HDR <Environment> suspends and re-applies its own intensity when it mounts; snap large jumps so a
    // night room never flashes daylight.
    three.environmentIntensity = Math.abs(three.environmentIntensity - preset.environmentIntensity) > 0.3 ? preset.environmentIntensity : THREE.MathUtils.lerp(three.environmentIntensity, preset.environmentIntensity, k)
    if (three.background instanceof THREE.Color) three.background.lerp(targets.background, k)
    if (three.fog instanceof THREE.Fog) {
      three.fog.color.lerp(targets.fog, k)
      three.fog.near = THREE.MathUtils.lerp(three.fog.near, preset.fog.near, k)
      three.fog.far = THREE.MathUtils.lerp(three.fog.far, preset.fog.far, k)
    }
    if (rig.sun) {
      rig.sun.color.lerp(targets.sun, k)
      rig.sun.intensity = THREE.MathUtils.lerp(rig.sun.intensity, preset.sun.intensity, k)
      rig.sun.position.lerp(targets.sunPosition, k)
      // Quality: the host sun's shadow map follows the injected setting (dispose + recreate on size change).
      applyShadowQuality(rig.sun, quality.shadowMapSize, quality.shadows)
    }
    if (rig.hemisphere) {
      rig.hemisphere.color.lerp(targets.hemisphereSky, k)
      rig.hemisphere.groundColor.lerp(targets.hemisphereGround, k)
      rig.hemisphere.intensity = THREE.MathUtils.lerp(rig.hemisphere.intensity, preset.hemisphere.intensity, k)
    }
    if (rig.sky) {
      ((rig.sky.material as THREE.ShaderMaterial).uniforms.sunPosition.value as THREE.Vector3).lerp(targets.skySun, k)
      // The Preetham daylight dome cannot render a true night; night presets hide it behind the NightSky dome.
      rig.sky.visible = !preset.night
    }
  })

  // Evidence hooks for the browser scripts: a lighting snapshot (read-only) and fixed camera poses so before/after
  // screenshots share an identical camera. Neither touches game state, story progress or missions.
  useEffect(() => {
    const debugWindow = window as Window & { __runwayCamera?: (view: keyof typeof CAMERA_VIEWS | { position: number[]; lookAt: number[] }) => number[] }
    const moveCamera = (view: keyof typeof CAMERA_VIEWS | { position: number[]; lookAt: number[] }) => {
      const pose = typeof view === 'string' ? CAMERA_VIEWS[view] : view
      camera.position.set(pose.position[0], pose.position[1], pose.position[2])
      camera.lookAt(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2])
      camera.updateMatrixWorld()
      return camera.position.toArray()
    }
    debugWindow.__runwayCamera = moveCamera
    return () => { if (debugWindow.__runwayCamera === moveCamera) delete debugWindow.__runwayCamera }
  }, [camera])
  useEffect(() => {
    const snapshot = () => {
      const rig = resolveRig()
      const lights: { type: string; intensity: number; color: string; position: number[] }[] = []
      three.traverse((object) => { if (object instanceof THREE.Light && object.userData.runwayPractical) lights.push({ type: object.type, intensity: object.intensity, color: `#${object.color.getHexString()}`, position: object.position.toArray().map((value) => +value.toFixed(2)) }) })
      return {
        scene, label: preset.label, exposure: +gl.toneMappingExposure.toFixed(3), environmentIntensity: +three.environmentIntensity.toFixed(3), hasEnvironmentMap: three.environment !== null, toneMapping: gl.toneMapping,
        sun: rig.sun ? { intensity: +rig.sun.intensity.toFixed(3), color: `#${rig.sun.color.getHexString()}`, position: rig.sun.position.toArray().map((value) => +value.toFixed(2)) } : null,
        hemisphere: rig.hemisphere ? { intensity: +rig.hemisphere.intensity.toFixed(3), sky: `#${rig.hemisphere.color.getHexString()}`, ground: `#${rig.hemisphere.groundColor.getHexString()}` } : null,
        fog: three.fog instanceof THREE.Fog ? { color: `#${three.fog.color.getHexString()}`, near: +three.fog.near.toFixed(1), far: +three.fog.far.toFixed(1) } : null,
        skySun: rig.sky ? ((rig.sky.material as THREE.ShaderMaterial).uniforms.sunPosition.value as THREE.Vector3).toArray().map((value) => +value.toFixed(2)) : null,
        skyDomeVisible: rig.sky ? rig.sky.visible : null,
        night: preset.night ? { ...preset.night, starsRendered: three.getObjectByName('night-sky')?.children.find((child): child is THREE.Points => child instanceof THREE.Points)?.geometry.attributes.position.count ?? 0 } : null,
        quality: { ...getLightingQuality(), sunShadowMap: rig.sun ? { castShadow: rig.sun.castShadow, size: rig.sun.shadow.mapSize.x } : null },
        practicals: lights,
      }
    }
    const debugWindow = window as Window & { __runwayLighting?: () => unknown; __runwaySetLightingQuality?: typeof setLightingQuality }
    debugWindow.__runwayLighting = snapshot
    // Lets the evidence script exercise the quality setter before world/quality.ts is wired.
    debugWindow.__runwaySetLightingQuality = setLightingQuality
    return () => {
      if (debugWindow.__runwayLighting === snapshot) delete debugWindow.__runwayLighting
      delete debugWindow.__runwaySetLightingQuality
    }
  }, [scene, preset, three, gl, resolveRig])

  return <group name={`lighting-${scene}`}>
    {preset.night && <NightSky {...preset.night} />}
    {preset.practicals.map((light, index) => <PracticalLight key={`${scene}-${index}`} light={light} mood={mood} />)}
    {/* Re-render the grounding shadow for a few frames whenever a loader finishes so late GLBs (chairs, founders, tables) are included. */}
    {quality.contactShadows && <ContactShadows key={`${scene}-${progress}`} frames={40} position={[0, 0.026, -4.2]} scale={[12.4, 8.2]} resolution={512} far={2.3} blur={preset.contactShadows.blur} opacity={preset.contactShadows.opacity} color={preset.contactShadows.color} />}
  </group>
}
