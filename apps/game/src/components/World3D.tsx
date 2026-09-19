import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { CameraShake, ContactShadows, Float } from '@react-three/drei'
import { Bloom, EffectComposer, Noise, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { FOUNDERS } from '../state/gameStore'
import type { FounderId, SceneId } from '../state/types'
import type { Mood } from './World'

/** Photoreal 360° panoramas (equirectangular 2:1) generated per docs/ASSETS.md. */
const PANO: Record<SceneId | 'devin', string> = {
  S1: '/assets/pano/s1-puzl.jpg',
  S2: '/assets/pano/s2-debrecen.jpg',
  S3: '/assets/pano/s3-investor.jpg',
  devin: '/assets/pano/devin.jpg',
}

const KEY_COLOR: Record<Mood, string> = { idle: '#FFB35C', alarm: '#FF5A5F', win: '#2DD4BF', lose: '#333644', devin: '#7C9CFF' }

const assetCache = new Map<string, boolean>()
/** True only if the URL serves an image (Vite/Vercel return index.html with 200 for unknown paths). */
function useAssetExists(url: string): boolean | null {
  const [ok, setOk] = useState<boolean | null>(assetCache.get(url) ?? null)
  useEffect(() => {
    if (assetCache.has(url)) { setOk(assetCache.get(url)!); return }
    fetch(url, { method: 'HEAD' })
      .then((r) => r.ok && (r.headers.get('content-type') ?? '').startsWith('image/'))
      .catch(() => false)
      .then((v) => { assetCache.set(url, v); setOk(v) })
  }, [url])
  return ok
}

/** 360° room. Falls back to a dark procedural room if the panorama isn't there yet. */
function Panorama({ scene }: { scene: SceneId | 'devin' }) {
  const ok = useAssetExists(PANO[scene])
  if (!ok) return <ProceduralRoom scene={scene} />
  return (
    <Suspense fallback={<ProceduralRoom scene={scene} />}>
      <PanoSphere url={PANO[scene]} />
    </Suspense>
  )
}

function PanoSphere({ url }: { url: string }) {
  const tex = useLoader(THREE.TextureLoader, url)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.mapping = THREE.EquirectangularReflectionMapping
  return (
    <mesh scale={[-1, 1, 1]}>
      <sphereGeometry args={[30, 64, 40]} />
      <meshBasicMaterial map={tex} side={THREE.BackSide} toneMapped={false} />
    </mesh>
  )
}

function ProceduralRoom({ scene }: { scene: SceneId | 'devin' }) {
  const wall = scene === 'S1' ? '#3a2a22' : scene === 'S2' ? '#242b26' : scene === 'S3' ? '#2a2d3a' : '#0e1230'
  return (
    <group>
      <mesh position={[0, 1.5, -6]}><boxGeometry args={[16, 6, 0.2]} /><meshStandardMaterial color={wall} roughness={0.9} /></mesh>
      <mesh position={[-8, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[12, 6, 0.2]} /><meshStandardMaterial color={wall} roughness={0.9} /></mesh>
      <mesh position={[8, 1.5, 0]} rotation={[0, -Math.PI / 2, 0]}><boxGeometry args={[12, 6, 0.2]} /><meshStandardMaterial color={wall} roughness={0.9} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.5, 0]}><planeGeometry args={[16, 12]} /><meshStandardMaterial color="#1d1e24" roughness={0.8} /></mesh>
      {/* desk with glowing laptops */}
      <mesh position={[0, -0.6, -2.5]}><boxGeometry args={[5, 0.12, 1.4]} /><meshStandardMaterial color="#4a3a2c" roughness={0.6} /></mesh>
      {[-1.6, 0, 1.6].map((x) => (
        <mesh key={x} position={[x, -0.25, -2.7]} rotation={[-0.3, 0, 0]}><planeGeometry args={[0.7, 0.45]} /><meshStandardMaterial color="#7CE7F4" emissive="#7CE7F4" emissiveIntensity={2.2} toneMapped={false} /></mesh>
      ))}
    </group>
  )
}

/** Founder as a billboard in 3D space. Uses /assets/founders/<id>.png; falls back to a colored capsule. */
function FounderBillboard({ id, x, active, mood }: { id: FounderId; x: number; active: boolean; mood: Mood }) {
  const f = FOUNDERS[id]
  const g = useRef<THREE.Group>(null)
  const imgOk = useAssetExists(`/assets/founders/${id}.png`)
  const h = id === 'kirill' ? 2.0 : id === 'sadman' ? 1.7 : 1.9
  useFrame(({ clock }) => {
    if (!g.current) return
    const t = clock.getElapsedTime()
    const speed = mood === 'alarm' ? 6 : 2
    g.current.position.y = -1.5 + h / 2 + Math.sin(t * speed + x) * (mood === 'alarm' ? 0.04 : 0.02)
    g.current.rotation.z = mood === 'lose' ? THREE.MathUtils.lerp(g.current.rotation.z, 0.15, 0.05) : THREE.MathUtils.lerp(g.current.rotation.z, 0, 0.1)
    const target = active ? 1.08 : 1
    g.current.scale.setScalar(THREE.MathUtils.lerp(g.current.scale.x, target, 0.1))
  })
  return (
    <group ref={g} position={[x, 0, -1.2]}>
      {imgOk ? (
        <Suspense fallback={<Capsule color={f.color} h={h} />}>
          <Sprite url={`/assets/founders/${id}.png`} h={h} />
        </Suspense>
      ) : <Capsule color={f.color} h={h} />}
      {active && <pointLight position={[0.6, h / 2, 0.8]} intensity={6} distance={4} color="#F5D547" />}
    </group>
  )
}

function Sprite({ url, h }: { url: string; h: number }) {
  const tex = useLoader(THREE.TextureLoader, url)
  tex.colorSpace = THREE.SRGBColorSpace
  const ratio = tex.image ? tex.image.width / tex.image.height : 0.5
  return (
    <mesh>
      <planeGeometry args={[h * ratio, h]} />
      <meshStandardMaterial map={tex} transparent alphaTest={0.1} roughness={0.7} />
    </mesh>
  )
}

function Capsule({ color, h }: { color: string; h: number }) {
  return (
    <mesh>
      <capsuleGeometry args={[0.32, h - 0.64, 8, 16]} />
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </mesh>
  )
}

/** Camera: gentle mouse-look + slow dolly on scene change. Transforms live in refs, not React state. */
function Rig({ scene, mood }: { scene: string; mood: Mood }) {
  const { camera, pointer } = useThree()
  const dolly = useRef(0)
  useEffect(() => { dolly.current = 1 }, [scene])
  useFrame((_, dt) => {
    dolly.current = THREE.MathUtils.damp(dolly.current, 0, 2, dt)
    const orbit = mood === 'devin' ? Math.sin(performance.now() / 4000) * 0.4 : 0
    const tx = pointer.x * 0.35 + orbit
    const ty = 0.3 + pointer.y * 0.15
    camera.position.x = THREE.MathUtils.damp(camera.position.x, tx, 3, dt)
    camera.position.y = THREE.MathUtils.damp(camera.position.y, ty, 3, dt)
    camera.position.z = THREE.MathUtils.damp(camera.position.z, 3.2 + dolly.current * 2.5, 3, dt)
    camera.lookAt(0, 0.1, -1.5)
  })
  return null
}

function KeyLight({ mood }: { mood: Mood }) {
  const ref = useRef<THREE.PointLight>(null)
  const target = useMemo(() => new THREE.Color(KEY_COLOR[mood]), [mood])
  useFrame((_, dt) => { ref.current?.color.lerp(target, dt * 3) })
  return <pointLight ref={ref} position={[0, 2.5, -1]} intensity={mood === 'lose' ? 4 : 14} distance={12} decay={1.6} />
}

export function World3D({ scene, mood = 'idle', active, shake }: { scene: SceneId | 'devin'; mood?: Mood; active?: FounderId; shake?: boolean }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0.3, 3.2], fov: 42 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      className="absolute inset-0"
    >
      <color attach="background" args={['#0a0a0f']} />
      <fog attach="fog" args={['#0a0a0f', 8, 30]} />
      <ambientLight intensity={0.5} color="#404050" />
      <KeyLight mood={mood} />
      <Panorama scene={scene} />
      {scene !== 'devin' && (
        <>
          <Float speed={0} floatIntensity={0}>
            <FounderBillboard id="sadman" x={-1.7} active={active === 'sadman'} mood={mood} />
            <FounderBillboard id="kirill" x={0} active={active === 'kirill'} mood={mood} />
            <FounderBillboard id="sergio" x={1.7} active={active === 'sergio'} mood={mood} />
          </Float>
          <ContactShadows position={[0, -1.49, -1.2]} opacity={0.6} scale={8} blur={2.4} far={3} color="#000" />
        </>
      )}
      <Rig scene={scene} mood={mood} />
      {shake && <CameraShake intensity={0.5} decay decayRate={0.9} maxYaw={0.03} maxPitch={0.03} maxRoll={0.03} />}
      <EffectComposer>
        <Bloom luminanceThreshold={0.8} intensity={0.9} mipmapBlur />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.2} darkness={0.9} />
      </EffectComposer>
    </Canvas>
  )
}
