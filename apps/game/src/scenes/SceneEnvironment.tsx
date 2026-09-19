import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FOUNDERS } from '../state/gameStore'
import type { FounderId, SceneId } from '../state/types'
import type { Mood } from '../components/World'
import { MATERIAL as M, seededRandom, signTexture, surfaceTexture, useEnvironmentSurfaces, type Surface } from './sceneMaterials'
import { RemyFounder } from './RemyFounder'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CourtyardTree } from './EnvironmentAssets'
import { DetailedFacades, LoftDetails } from './ArchitecturalDetails'
import { RealisticChair, RealisticDesks } from './RealisticFurniture'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type Position = [number, number, number]

function Box({ position, size, color = M.metal, surface, rotation, castShadow = true }: { position: Position; size: Position; color?: string; surface?: Surface; rotation?: Position; castShadow?: boolean }) {
  const [width, height, depth] = size
  const map = surface?.map
  const [tileWidth, tileHeight] = surface?.meters ?? [2, 2]
  const geometry = useMemo(() => {
    const geometry = Math.max(width, height, depth) < 3
      ? new RoundedBoxGeometry(width, height, depth, 2, Math.min(0.018, width * 0.12, height * 0.12, depth * 0.12))
      : new THREE.BoxGeometry(width, height, depth)
    const uv = geometry.attributes.uv
    const normal = geometry.attributes.normal
    for (let i = 0; i < uv.count; i++) {
      const u = Math.abs(normal.getX(i)) > 0.5 ? depth : width
      const v = Math.abs(normal.getY(i)) > 0.5 ? depth : height
      uv.setXY(i, uv.getX(i) * u / tileWidth, uv.getY(i) * v / tileHeight)
    }
    return geometry
  }, [width, height, depth, tileWidth, tileHeight])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh position={position} rotation={rotation} geometry={geometry} castShadow={castShadow} receiveShadow><meshStandardMaterial color={map ? 'white' : color} map={map} normalMap={surface?.normalMap} roughnessMap={surface?.roughnessMap} bumpMap={surface?.normalMap ? undefined : map} bumpScale={0.012} roughness={surface?.roughnessMap ? 1 : 0.82} /></mesh>
}

function Sign({ title, subtitle, position, width = 3.4, dark = false }: { title: string; subtitle: string; position: Position; width?: number; dark?: boolean }) {
  const texture = useMemo(() => signTexture(title, subtitle, dark), [title, subtitle, dark])
  useEffect(() => () => texture.dispose(), [texture])
  return <mesh position={position}><planeGeometry args={[width, width / 4]} /><meshStandardMaterial map={texture} roughness={0.8} /></mesh>
}

function Chair({ x, z = -6.5 }: { x: number; z?: number }) {
  const fallback = <FallbackChair x={x} z={z} />
  return <ErrorBoundary label="Detailed chair" fallback={fallback}><Suspense fallback={fallback}><RealisticChair x={x} z={z} /></Suspense></ErrorBoundary>
}

function FallbackChair({ x, z = -6.5 }: { x: number; z?: number }) {
  return <group position={[x, 0, z]}>
    <Box position={[0, 0.52, 0]} size={[0.56, 0.1, 0.55]} />
    <Box position={[0, 0.94, -0.25]} size={[0.56, 0.72, 0.08]} />
    {[-0.23, 0.23].flatMap((a) => [-0.22, 0.22].map((b) => <Box key={`${a}/${b}`} position={[a, 0.25, b]} size={[0.035, 0.5, 0.035]} />))}
  </group>
}

function Laptop({ x, mood }: { x: number; mood: Mood }) {
  const screen = mood === 'alarm' ? M.alarm : mood === 'win' ? M.win : M.screen
  return <group position={[x, 0.84, x === 0 ? -5.5 : -5]} rotation={[0, Math.PI, 0]}>
    <Box position={[0, 0.015, 0]} size={[0.64, 0.035, 0.42]} color={M.metal} />
    <group position={[0, 0.24, -0.17]} rotation={[-0.2, 0, 0]}>
      <Box position={[0, 0, 0]} size={[0.64, 0.43, 0.035]} color={M.dark} />
      <mesh position={[0, 0, 0.021]}><planeGeometry args={[0.58, 0.36]} /><meshStandardMaterial color={M.dark} emissive={screen} emissiveIntensity={0.5} /></mesh>
      {[0, 1, 2, 3, 4].map((n) => <mesh key={n} position={[-0.07 + (n % 2) * 0.03, 0.12 - n * 0.055, 0.025]}><planeGeometry args={[0.29 + (n % 3) * 0.05, 0.012]} /><meshBasicMaterial color={screen} /></mesh>)}
    </group>
    {Array.from({ length: 5 }, (_, n) => <Box key={n} position={[0, 0.037, -0.08 + n * 0.04]} size={[0.48, 0.004, 0.018]} color={M.dark} castShadow={false} />)}
  </group>
}

function Founder({ id, x, active, mood, reducedMotion }: { id: FounderId; x: number; active: boolean; mood: Mood; reducedMotion: boolean }) {
  const body = useRef<THREE.Group>(null)
  const height = id === 'sadman' ? 0.94 : id === 'kirill' ? 1.06 : 1
  useFrame(({ clock }, delta) => {
    if (!body.current) return
    body.current.position.y = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 1.7 + x) * 0.007
    body.current.rotation.x = THREE.MathUtils.damp(body.current.rotation.x, mood === 'lose' ? 0.2 : active ? -0.05 : 0.04, 4, delta)
  })
  return <group position={[x, 0, -6.2]} scale={[1, height, 1]}>
    <group ref={body}>
      <mesh position={[0, 0.98, 0]} castShadow><capsuleGeometry args={[0.21, 0.39, 6, 12]} /><meshStandardMaterial color={FOUNDERS[id].color} roughness={0.94} /></mesh>
      <mesh position={[0, 1.48, 0.02]} castShadow><sphereGeometry args={[0.18, 20, 16]} /><meshStandardMaterial color={id === 'sadman' ? '#9e704d' : M.skin} roughness={0.85} /></mesh>
      <mesh position={[0, 1.56, -0.025]} castShadow><sphereGeometry args={[0.177, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62]} /><meshStandardMaterial color={M.hair} roughness={1} /></mesh>
      <mesh position={[0, 1.46, 0.18]}><sphereGeometry args={[0.033, 8, 8]} /><meshStandardMaterial color={M.skin} /></mesh>
      {[-1, 1].map((side) => <group key={side}>
        <mesh position={[side * 0.064, 1.51, 0.171]}><sphereGeometry args={[0.014, 8, 8]} /><meshStandardMaterial color={M.dark} /></mesh>
        <mesh position={[side * 0.26, 0.96, 0.1]} rotation={[-0.48, 0, side * 0.12]} castShadow><capsuleGeometry args={[0.07, 0.38, 4, 10]} /><meshStandardMaterial color={FOUNDERS[id].color} roughness={1} /></mesh>
        <mesh position={[side * 0.12, 0.45, 0.21]} rotation={[-0.3, 0, 0]} castShadow><capsuleGeometry args={[0.085, 0.5, 4, 10]} /><meshStandardMaterial color={M.trouser} roughness={1} /></mesh>
        <Box position={[side * 0.12, 0.11, 0.37]} size={[0.17, 0.13, 0.32]} color={M.dark} />
      </group>)}
      {id === 'kirill' && <mesh position={[0, 1.58, 0]} rotation={[0, 0, Math.PI]}><torusGeometry args={[0.2, 0.032, 6, 16, Math.PI]} /><meshStandardMaterial color={M.dark} /></mesh>}
      {id === 'sergio' && <Box position={[0, 1.52, 0.175]} size={[0.3, 0.052, 0.035]} color={M.dark} />}
      {id === 'sadman' && <mesh position={[0, 1.59, 0.08]}><sphereGeometry args={[0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={M.trouser} /></mesh>}
    </group>
  </group>
}

function Tree({ x, z }: { x: number; z: number }) {
  const canopy = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (!canopy.current) return
    const random = seededRandom(51)
    const object = new THREE.Object3D()
    for (let i = 0; i < 160; i++) {
      const angle = random() * Math.PI * 2
      const radius = Math.sqrt(random()) * 2.1
      object.position.set(Math.cos(angle) * radius, 3.5 + random() * 1.5 - radius * 0.18, Math.sin(angle) * radius)
      object.rotation.set(random(), random() * Math.PI, random())
      object.scale.set(0.35 + random() * 0.4, 0.1 + random() * 0.2, 0.3 + random() * 0.4)
      object.updateMatrix()
      canopy.current.setMatrixAt(i, object.matrix)
      canopy.current.setColorAt(i, new THREE.Color(M.leaf).multiplyScalar(0.75 + random() * 0.65))
    }
    canopy.current.instanceMatrix.needsUpdate = true
    if (canopy.current.instanceColor) canopy.current.instanceColor.needsUpdate = true
  }, [])
  return <group position={[x, 0, z]}>
    <mesh position={[0, 1.7, 0]} castShadow><cylinderGeometry args={[0.1, 0.24, 3.4, 10]} /><meshStandardMaterial color={M.bark} roughness={1} /></mesh>
    {[-1, 1].map((side) => <mesh key={side} position={[side * 0.45, 2.9, 0]} rotation={[0.2, 0, side * -0.6]} castShadow><cylinderGeometry args={[0.05, 0.12, 1.8, 8]} /><meshStandardMaterial color={M.bark} roughness={1} /></mesh>)}
    <instancedMesh ref={canopy} args={[undefined, undefined, 160]} castShadow receiveShadow><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial roughness={0.95} /></instancedMesh>
  </group>
}

type SceneProps = { scene: SceneId | 'devin'; mood: Mood; active?: FounderId; reducedMotion: boolean }

export function SceneEnvironment(props: SceneProps) {
  const fallback = <EnvironmentScene {...props} />
  return <ErrorBoundary label="Environment surfaces" fallback={fallback}><Suspense fallback={fallback}><TexturedScene {...props} /></Suspense></ErrorBoundary>
}

function TexturedScene(props: SceneProps) {
  const surfaces = useEnvironmentSurfaces()
  return <EnvironmentScene {...props} surfaces={surfaces} />
}

function EnvironmentScene({ scene, mood, active, reducedMotion, surfaces }: SceneProps & { surfaces?: Record<'brick' | 'concrete', Surface> }) {
  const generated = useMemo(() => ({ brick: surfaceTexture('brick'), wood: surfaceTexture('wood'), concrete: surfaceTexture('concrete'), soil: surfaceTexture('soil') }), [])
  useEffect(() => () => Object.values(generated).forEach((texture) => texture.dispose()), [generated])
  const textures: Record<'brick' | 'wood' | 'concrete' | 'soil', Surface> = {
    brick: surfaces?.brick ?? { map: generated.brick, meters: [1.1, 0.64] },
    concrete: surfaces?.concrete ?? { map: generated.concrete, meters: [2, 2] },
    wood: { map: generated.wood, meters: [2, 2] },
    soil: { map: generated.soil, meters: [2, 2] },
  }
  const title = scene === 'S1' ? 'PUZL / COWORKING' : scene === 'S2' ? 'DEBRECEN / 03:00' : scene === 'S3' ? 'THE NEXT ROUND' : 'DEVIN / ENGINEERING'
  const subtitle = scene === 'S1' ? 'BUDAPEST     COGNITION x DEVIN     2026' : scene === 'S2' ? 'THREE FOUNDERS. ONE KITCHEN TABLE.' : scene === 'S3' ? 'BUILD SOMETHING PEOPLE WANT.' : 'REAL CODE. INDEPENDENT VERIFICATION.'
  const deskFallback = <group>
    <Box position={[0, 0.79, -5]} size={[5.5, 0.11, 1.4]} surface={textures.wood} />
    {[-2.4, 2.4].flatMap((x) => [-5.5, -4.5].map((z) => <Box key={`${x}/${z}`} position={[x, 0.37, z]} size={[0.08, 0.74, 0.08]} />))}
  </group>
  const facadeFallback = <group>
    {[-1, 1].map((side) => <Box key={side} position={[side * 12, 5, 1]} size={[5, 10, 28]} surface={textures.brick} />)}
    <Box position={[0, 5, 19]} size={[26, 10, 4]} surface={textures.brick} />
  </group>
  return <group>
    <Box position={[0, -0.17, 2]} size={[15.2, 0.3, 21]} surface={textures.soil} />
    <Box position={[0, -0.04, -4]} size={[12, 0.12, 8]} surface={scene === 'S2' ? textures.wood : textures.concrete} />
    <Box position={[0, -0.01, 1]} size={[12, 0.08, 2]} surface={textures.concrete} />
    {Array.from({ length: 10 }, (_, i) => <Box key={i} position={[0, 0.005, 2.5 + i]} size={[2.12, 0.08, 0.94]} surface={textures.concrete} />)}
    <Box position={[0, 1.9, -8]} size={[12, 3.8, 0.28]} surface={scene === 'S1' ? textures.brick : undefined} color={M.plaster} />
    {[-1, 1].map((side) => <group key={side}>
      <Box position={[side * 6, 1.9, -4]} size={[0.28, 3.8, 8]} surface={scene === 'S1' ? textures.brick : undefined} color={M.plaster} />
      <Box position={[side * 3.75, 0.38, 0]} size={[4.5, 0.76, 0.25]} surface={textures.brick} />
      <mesh position={[side * 3.75, 2.15, 0]}><boxGeometry args={[4.45, 2.75, 0.025]} /><meshPhysicalMaterial color={M.ambient} transparent opacity={0.12} roughness={0.08} metalness={0.15} depthWrite={false} /></mesh>
      {[1.5, 3, 4.5, 6].map((x) => <Box key={x} position={[side * x, 2.1, 0]} size={[0.055, 3.4, 0.1]} />)}
      <Box position={[side * 3.75, 2.5, 0]} size={[4.5, 0.05, 0.1]} />
      <Box position={[side * 7.5, 0.45, 6.2]} size={[0.2, 0.9, 12.5]} surface={textures.concrete} />
      <ErrorBoundary label="Courtyard tree" fallback={<Tree x={side * 5.5} z={3.8} />}><Suspense fallback={<Tree x={side * 5.5} z={3.8} />}><CourtyardTree x={side * 5.5} z={3.8} /></Suspense></ErrorBoundary>
      <group position={[side * 5.1, 0, 8]}>
        {[0, 1, 2].map((n) => <Box key={n} position={[0, 0.48, -0.24 + n * 0.22]} size={[2.6, 0.07, 0.19]} surface={textures.wood} />)}
        {[-0.95, 0.95].map((x) => <Box key={x} position={[x, 0.25, 0]} size={[0.06, 0.5, 0.65]} />)}
      </group>
      <Box position={[side * 4.8, 0.4, -5.7]} size={[1.25, 0.8, 2.8]} color={scene === 'S2' ? M.trouser : M.wood} surface={scene === 'S2' ? undefined : textures.wood} />
    </group>)}
    <Box position={[0, 3.76, -4]} size={[12.3, 0.15, 8.3]} color={M.plaster} />
    {[-6, -3, 0].map((z) => <Box key={z} position={[0, 3.58, z]} size={[12, 0.3, 0.14]} />)}
    <Box position={[0, 0.45, 12.5]} size={[15.2, 0.9, 0.25]} surface={textures.concrete} />
    <Sign title={title} subtitle={subtitle} position={[0, 2.6, -7.83]} width={5.2} />
    <Sign title="TAKE A BREATH." subtitle="STEP OUTSIDE. TOUCH GRASS. COME BACK." position={[-3.6, 1.15, 0.17]} width={2.8} />
    <ErrorBoundary label="Detailed desks" fallback={deskFallback}><Suspense fallback={deskFallback}><RealisticDesks /></Suspense></ErrorBoundary>
    {scene === 'S1' && <LoftDetails />}
    {(['sadman', 'kirill', 'sergio'] as const).map((id, i) => <group key={id}>
      <Chair x={(i - 1) * 1.8} />
      <Laptop x={(i - 1) * 1.8} mood={mood} />
      <ErrorBoundary label={`${id}Founder`} fallback={<Founder id={id} x={(i - 1) * 1.8} active={active === id} mood={mood} reducedMotion={reducedMotion} />}>
        <Suspense fallback={<Founder id={id} x={(i - 1) * 1.8} active={active === id} mood={mood} reducedMotion={reducedMotion} />}>
          <RemyFounder asset={id === 'kirill' ? 'remy' : id} x={(i - 1) * 1.8} active={active === id} mood={mood} reducedMotion={reducedMotion} />
        </Suspense>
      </ErrorBoundary>
    </group>)}
    {[-2.6, 2.6].map((x) => <group key={x} position={[x, 3.3, -4.5]}>
      <mesh position={[0, -0.18, 0]} castShadow><coneGeometry args={[0.32, 0.24, 24, 1, true]} /><meshStandardMaterial color={M.metal} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.29, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.22, 20]} /><meshBasicMaterial color={M.warm} side={THREE.DoubleSide} /></mesh>
      <pointLight position={[0, -0.4, 0]} intensity={10} distance={7} color={mood === 'alarm' ? M.alarm : mood === 'win' ? M.win : M.warm} />
      <Box position={[0, 0.17, 0]} size={[0.015, 0.34, 0.015]} />
    </group>)}
    {scene === 'S1' && <group>
      <Box position={[0.75, 0.875, -4.6]} size={[0.55, 0.08, 0.55]} color={M.paper} />
      {[0.4, -0.7, 2.5].map((x) => <mesh key={x} position={[x, 0.95, -5.25]} castShadow><cylinderGeometry args={[0.055, 0.055, 0.22, 12]} /><meshStandardMaterial color={M.win} metalness={0.6} roughness={0.3} /></mesh>)}
    </group>}
    {scene === 'S2' && <group>
      <Box position={[-4.8, 0.85, -5.7]} size={[1.23, 0.15, 2.7]} color={M.paper} />
      <Box position={[-4.8, 1, -6.6]} size={[0.85, 0.2, 0.45]} color={M.plaster} />
      <Box position={[-4, 2.75, -2.3]} size={[3, 0.025, 0.025]} color={M.bark} />
      {[-4.8, -4, -3.2].map((x, i) => <Box key={x} position={[x, 2.35, -2.3]} size={[0.58, 0.8, 0.035]} color={[M.trouser, M.paper, M.wood][i]} />)}
    </group>}
    {scene === 'S3' && <group position={[4.8, 1.9, -5.7]} rotation={[0, -Math.PI / 2, 0]}>
      <Box position={[0, 0, 0]} size={[2.3, 1.35, 0.06]} color={M.paper} />
      <Sign title="RUNWAY" subtitle="OWNERSHIP. GROWTH. SURVIVAL." position={[0, 0.2, 0.04]} width={2} />
      {[-0.7, 0, 0.7].map((x, i) => <Box key={x} position={[x, -0.4 + i * 0.08, 0.04]} size={[0.28, 0.22 + i * 0.16, 0.02]} color={M.win} />)}
    </group>}
    <ErrorBoundary label="Detailed facades" fallback={facadeFallback}><Suspense fallback={facadeFallback}><DetailedFacades /></Suspense></ErrorBoundary>
  </group>
}
