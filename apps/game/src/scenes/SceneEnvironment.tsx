import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FOUNDERS } from '../state/gameStore'
import type { FounderId, SceneId } from '../state/types'
import type { Mood } from '../components/World'
import { MATERIAL as M, SURFACE_METERS, applySurfaceVariation, posterTexture, scribbleTexture, scuffTexture, seededRandom, signTexture, slideTexture, surfaceTexture, useEnvironmentSurfaces, type Surface } from './sceneMaterials'
import { RemyFounder } from './RemyFounder'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { CourtyardTree } from './EnvironmentAssets'
import { DetailedFacades, LoftDetails } from './ArchitecturalDetails'
import { DESK_HEIGHT, RealisticChair, RealisticTable } from './RealisticFurniture'
import { SceneLighting, moodColor, type LightingSceneId } from './sceneLighting'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

type Position = [number, number, number]
type SceneKey = SceneId | 'devin'

/*
 * Layout contract (colliders live in engine/firstPerson.ts and are NOT changed here):
 *   room interior x in [-5.86, 5.86], z in [-7.86, 0]; glass wall at z=0 with the opening at |x| < 1.5
 *   desk footprint x in [-2.75, 2.75], z in [-5.7, -4.3]; chairs/founders at x = -1.8/0/1.8, z = -6.5
 *   side footprints (dressing per location) x = +-4.8, z = -5.7, 1.25 x 2.8 — the strip between them and the
 *   side walls is unreachable, so props may extend to the wall there.
 * Everything else placed here sits on/under those footprints, on walls, on the ceiling or on the floor as a
 * decal (<= 3 cm, walk-over), so the walking path stays clear.
 */

const MASK_PERIOD_METERS = 9

function Box({ position, size, color = M.metal, tint, surface, rotation, castShadow = true, receiveShadow = true, roughness, metalness = 0, radius, emissive, emissiveIntensity = 1 }: { position: Position; size: Position; color?: string; tint?: string; surface?: Surface; rotation?: Position; castShadow?: boolean; receiveShadow?: boolean; roughness?: number; metalness?: number; radius?: number; emissive?: string; emissiveIntensity?: number }) {
  const [width, height, depth] = size
  const [tileWidth, tileHeight] = surface?.meters ?? [2, 2]
  const geometry = useMemo(() => {
    const bevel = radius ?? (Math.max(width, height, depth) < 3 ? Math.min(0.018, width * 0.12, height * 0.12, depth * 0.12) : 0)
    const geometry = bevel > 0 ? new RoundedBoxGeometry(width, height, depth, 2, bevel) : new THREE.BoxGeometry(width, height, depth)
    const uv = geometry.attributes.uv
    const normal = geometry.attributes.normal
    for (let i = 0; i < uv.count; i++) {
      const u = Math.abs(normal.getX(i)) > 0.5 ? depth : width
      const v = Math.abs(normal.getY(i)) > 0.5 ? depth : height
      uv.setXY(i, uv.getX(i) * u / tileWidth, uv.getY(i) * v / tileHeight)
    }
    return geometry
  }, [width, height, depth, tileWidth, tileHeight, radius])
  const material = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: surface ? tint ?? 'white' : color,
      map: surface?.map,
      normalMap: surface?.normalMap,
      roughnessMap: surface?.roughnessMap,
      roughness: roughness ?? (surface?.roughnessMap ? 1 : surface?.roughness ?? 0.82),
      metalness,
      emissive: emissive ?? '#000000',
      emissiveIntensity,
    })
    if (surface?.normalMap) material.normalScale.setScalar(surface.normalScale ?? 1)
    else if (surface) { material.bumpMap = surface.map; material.bumpScale = 0.012 }
    if (surface) applySurfaceVariation(material, MASK_PERIOD_METERS / surface.meters[0])
    return material
  }, [surface, color, tint, roughness, metalness, emissive, emissiveIntensity])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  return <mesh position={position} rotation={rotation} geometry={geometry} material={material} castShadow={castShadow} receiveShadow={receiveShadow} />
}

function useDisposable<T extends THREE.Texture | THREE.BufferGeometry>(factory: () => T, deps: unknown[]) {
  const value = useMemo(factory, deps)
  useEffect(() => () => value.dispose(), [value])
  return value
}

function Sign({ title, subtitle, position, width = 3.4, dark = false, rotation }: { title: string; subtitle: string; position: Position; width?: number; dark?: boolean; rotation?: Position }) {
  const texture = useDisposable(() => signTexture(title, subtitle, dark), [title, subtitle, dark])
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, width / 4]} /><meshStandardMaterial map={texture} roughness={0.8} /></mesh>
}

function Poster({ position, rotation, lines, background, foreground, accent, width = 0.6 }: { position: Position; rotation?: Position; lines: string[]; background: string; foreground: string; accent?: string; width?: number }) {
  const texture = useDisposable(() => posterTexture(lines, background, foreground, accent), [lines.join('|'), background, foreground, accent])
  return <mesh position={position} rotation={rotation}><planeGeometry args={[width, width * 1.5]} /><meshStandardMaterial map={texture} roughness={0.85} /></mesh>
}

/** Emissive slide/screen surface with a thin dark bezel. */
function Screen({ position, rotation, width, title, subtitle, accent, dark = true, intensity = 0.9, bezel = 0.03 }: { position: Position; rotation?: Position; width: number; title: string; subtitle: string; accent: string; dark?: boolean; intensity?: number; bezel?: number }) {
  const texture = useDisposable(() => slideTexture(title, subtitle, accent, dark), [title, subtitle, accent, dark])
  const height = width * 9 / 16
  return <group position={position} rotation={rotation}>
    {bezel > 0 && <Box position={[0, 0, -0.012]} size={[width + bezel * 2, height + bezel * 2, 0.024]} color="#0f1418" roughness={0.45} radius={0.004} />}
    <mesh><planeGeometry args={[width, height]} /><meshStandardMaterial map={texture} emissiveMap={texture} emissive="white" emissiveIntensity={intensity} roughness={0.25} /></mesh>
  </group>
}

function Cable({ points, radius = 0.006, color = '#1c1e21' }: { points: Position[]; radius?: number; color?: string }) {
  const geometry = useDisposable(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)), false, 'catmullrom', 0.6), Math.max(16, points.length * 10), radius, 6, false), [points, radius])
  return <mesh geometry={geometry} castShadow><meshStandardMaterial color={color} roughness={0.55} /></mesh>
}

function PowerStrip({ position, rotation = 0 }: { position: Position; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box position={[0, 0.02, 0]} size={[0.34, 0.04, 0.075]} color={M.linen} roughness={0.6} />
    {[-0.11, -0.037, 0.037, 0.11].map((x) => <Box key={x} position={[x, 0.041, 0]} size={[0.045, 0.004, 0.045]} color="#0d0f11" castShadow={false} />)}
    <Box position={[0.155, 0.041, 0.02]} size={[0.012, 0.004, 0.012]} color="#5cff8a" emissive="#5cff8a" emissiveIntensity={1.4} castShadow={false} />
  </group>
}

function Can({ position, tipped = false, accent = M.win }: { position: Position; tipped?: boolean; accent?: string }) {
  return <group position={position} rotation={tipped ? [0, 0.4, Math.PI / 2] : [0, 0, 0]}>
    <mesh position={[0, 0.08, 0]} castShadow><cylinderGeometry args={[0.033, 0.033, 0.16, 16]} /><meshStandardMaterial color={M.can} metalness={0.75} roughness={0.28} /></mesh>
    <mesh position={[0, 0.085, 0]}><cylinderGeometry args={[0.0335, 0.0335, 0.09, 16, 1, true]} /><meshStandardMaterial color={accent} metalness={0.4} roughness={0.35} /></mesh>
  </group>
}

function Mug({ position, color = M.linen }: { position: Position; color?: string }) {
  return <group position={position}>
    <mesh position={[0, 0.047, 0]} castShadow><cylinderGeometry args={[0.04, 0.036, 0.094, 16]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
    <mesh position={[0.048, 0.05, 0]} rotation={[0, 0, 0]}><torusGeometry args={[0.022, 0.006, 8, 12, Math.PI]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
    <mesh position={[0, 0.088, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.034, 16]} /><meshStandardMaterial color="#2a1a10" roughness={0.2} /></mesh>
  </group>
}

function NoodleCup({ position, chopsticks = true }: { position: Position; chopsticks?: boolean }) {
  return <group position={position}>
    <mesh position={[0, 0.05, 0]} castShadow><cylinderGeometry args={[0.048, 0.036, 0.1, 16]} /><meshStandardMaterial color={M.paper} roughness={0.7} /></mesh>
    <mesh position={[0, 0.055, 0]}><cylinderGeometry args={[0.0485, 0.043, 0.035, 16, 1, true]} /><meshStandardMaterial color="#c8412f" roughness={0.6} /></mesh>
    {chopsticks && [0, 1].map((i) => <mesh key={i} position={[0.02 - i * 0.012, 0.13, 0.01 * i]} rotation={[0.35, 0, 0.5 + i * 0.08]} castShadow><cylinderGeometry args={[0.003, 0.004, 0.22, 6]} /><meshStandardMaterial color={M.oak} roughness={0.8} /></mesh>)}
  </group>
}

function Phone({ position, alert, rotation = 0.3 }: { position: Position; alert: boolean; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box position={[0, 0.004, 0]} size={[0.072, 0.008, 0.15]} color="#0d0f12" roughness={0.3} metalness={0.3} radius={0.004} />
    <mesh position={[0, 0.0085, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[0.064, 0.14]} /><meshStandardMaterial color={alert ? M.alarm : '#0b1a24'} emissive={alert ? M.alarm : '#0b1a24'} emissiveIntensity={alert ? 1.8 : 0.35} roughness={0.15} /></mesh>
  </group>
}

function PizzaBox({ position, open = true }: { position: Position; open?: boolean }) {
  return <group position={position}>
    <Box position={[0, 0.02, 0]} size={[0.5, 0.04, 0.5]} color={M.cardboard} roughness={0.9} />
    <Box position={[0, 0.02 + (open ? 0.24 : 0.045), open ? -0.245 : 0]} size={[0.5, 0.012, open ? 0.5 : 0.5]} rotation={open ? [-1.35, 0, 0] : undefined} color={M.cardboard} roughness={0.9} />
    {open && <mesh position={[0.05, 0.043, 0.02]} rotation={[-Math.PI / 2, 0, 0.4]}><circleGeometry args={[0.2, 20, 0, Math.PI * 0.7]} /><meshStandardMaterial color="#c99a4a" roughness={0.8} /></mesh>}
  </group>
}

function Whiteboard({ position, rotation, width = 1.6, height = 1.05, standing = false }: { position: Position; rotation?: Position; width?: number; height?: number; standing?: boolean }) {
  const texture = useDisposable(() => scribbleTexture(), [])
  return <group position={position} rotation={rotation}>
    <Box position={[0, 0, -0.02]} size={[width + 0.06, height + 0.06, 0.03]} color={M.steel} metalness={0.5} roughness={0.4} radius={0.006} />
    <mesh position={[0, 0, 0.001]}><planeGeometry args={[width, height]} /><meshStandardMaterial map={texture} roughness={0.15} /></mesh>
    <Box position={[0, -height / 2 + 0.01, 0.04]} size={[width * 0.6, 0.02, 0.06]} color={M.steel} metalness={0.5} roughness={0.4} />
    {[-0.12, 0.05].map((x, i) => <mesh key={x} position={[x - 0.1, -height / 2 + 0.03, 0.04]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.008, 0.008, 0.11, 8]} /><meshStandardMaterial color={['#2f4a8a', '#c43d3d'][i]} roughness={0.4} /></mesh>)}
    {standing && [-1, 1].map((side) => {
      // A-frame legs reach the floor from the board's bottom edge (component y is the board centre height).
      const legLength = position[1] - height / 2 - 0.03
      const legCenter = -height / 2 - legLength / 2
      return <group key={side}>
        <Box position={[side * (width / 2 - 0.05), legCenter, legLength * 0.16]} size={[0.035, legLength / Math.cos(0.3), 0.035]} rotation={[0.3, 0, 0]} color={M.steel} metalness={0.5} roughness={0.4} />
        <Box position={[side * (width / 2 - 0.05), legCenter, -legLength * 0.16]} size={[0.035, legLength / Math.cos(0.3), 0.035]} rotation={[-0.3, 0, 0]} color={M.steel} metalness={0.5} roughness={0.4} />
        {[1, -1].map((end) => <mesh key={end} position={[side * (width / 2 - 0.05), -height / 2 - legLength + 0.01, end * legLength * 0.31]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.04, 12]} /><meshStandardMaterial color="#111" roughness={0.6} /></mesh>)}
      </group>
    })}
  </group>
}

function Projector({ position, rotation = 0 }: { position: Position; rotation?: number }) {
  return <group position={position} rotation={[0, rotation, 0]}>
    <Box position={[0, 0.045, 0]} size={[0.3, 0.09, 0.24]} color={M.linen} roughness={0.5} />
    <mesh position={[0.07, 0.05, -0.125]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.028, 0.032, 0.02, 16]} /><meshStandardMaterial color="#0c1014" roughness={0.1} metalness={0.4} /></mesh>
    <mesh position={[0.07, 0.05, -0.136]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.02, 16]} /><meshStandardMaterial color="#dfe9ff" emissive="#dfe9ff" emissiveIntensity={3} /></mesh>
    <Box position={[-0.1, 0.092, 0.06]} size={[0.06, 0.004, 0.02]} color="#3aa0ff" emissive="#3aa0ff" emissiveIntensity={1} castShadow={false} />
  </group>
}

function DeskLamp({ position, mood }: { position: Position; mood: Mood }) {
  const color = moodColor('#ffb066', mood)
  return <group position={position}>
    <mesh position={[0, 0.012, 0]} castShadow><cylinderGeometry args={[0.075, 0.085, 0.024, 20]} /><meshStandardMaterial color="#1a1c1f" roughness={0.45} metalness={0.3} /></mesh>
    <mesh position={[0.05, 0.3, -0.06]} rotation={[0.2, 0, -0.3]} castShadow><cylinderGeometry args={[0.009, 0.009, 0.6, 8]} /><meshStandardMaterial color="#1a1c1f" roughness={0.45} metalness={0.3} /></mesh>
    <mesh position={[0.0, 0.58, -0.22]} rotation={[-0.9, 0, 0.45]} castShadow><cylinderGeometry args={[0.009, 0.009, 0.42, 8]} /><meshStandardMaterial color="#1a1c1f" roughness={0.45} metalness={0.3} /></mesh>
    <group position={[-0.16, 0.66, -0.34]} rotation={[0.85, 0.6, 0]}>
      <mesh castShadow><coneGeometry args={[0.09, 0.14, 20, 1, true]} /><meshStandardMaterial color="#1a1c1f" roughness={0.45} metalness={0.3} side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.06, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.07, 20]} /><meshBasicMaterial color={color} side={THREE.DoubleSide} /></mesh>
    </group>
  </group>
}

function Pendant({ position, mood, color = M.warm, size = 0.32 }: { position: Position; mood: Mood; color?: string; size?: number }) {
  return <group position={position}>
    <mesh position={[0, -0.18, 0]} castShadow><coneGeometry args={[size, size * 0.75, 24, 1, true]} /><meshStandardMaterial color={M.metal} side={THREE.DoubleSide} roughness={0.5} metalness={0.4} /></mesh>
    <mesh position={[0, -0.29, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[size * 0.7, 20]} /><meshBasicMaterial color={moodColor(color, mood)} side={THREE.DoubleSide} /></mesh>
    <Box position={[0, 0.17, 0]} size={[0.015, 0.34, 0.015]} />
  </group>
}

function Downlight({ position }: { position: Position }) {
  return <group position={position}>
    <mesh rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.07, 0.095, 24]} /><meshStandardMaterial color="#d9d7d0" roughness={0.4} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0, -0.002, 0]} rotation={[Math.PI / 2, 0, 0]}><circleGeometry args={[0.07, 24]} /><meshBasicMaterial color="#fff6e8" side={THREE.DoubleSide} /></mesh>
  </group>
}

function Scuff({ position, length, width = 1.4, opacity = 0.42, rotation = 0 }: { position: Position; length: number; width?: number; opacity?: number; rotation?: number }) {
  const texture = useDisposable(() => { const texture = scuffTexture(); texture.repeat.set(1, length / 2.2); return texture }, [length])
  return <mesh position={position} rotation={[-Math.PI / 2, 0, rotation]} receiveShadow renderOrder={1}>
    <planeGeometry args={[width, length]} />
    <meshStandardMaterial map={texture} transparent opacity={opacity} depthWrite={false} polygonOffset polygonOffsetFactor={-2} roughness={0.9} />
  </mesh>
}

function CardboardBoxes({ position, count = 2 }: { position: Position; count?: number }) {
  return <group position={position}>
    <Box position={[0, 0.2, 0]} size={[0.55, 0.4, 0.45]} color={M.cardboard} roughness={0.92} />
    {count > 1 && <Box position={[0.05, 0.56, -0.03]} size={[0.42, 0.32, 0.4]} rotation={[0, 0.25, 0]} color="#a67d4f" roughness={0.92} />}
    <Box position={[0, 0.401, 0]} size={[0.06, 0.003, 0.45]} color="#8a6a44" castShadow={false} />
  </group>
}

function Plant({ position, height = 1.7 }: { position: Position; height?: number }) {
  const leaves = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    if (!leaves.current) return
    const random = seededRandom(77)
    const object = new THREE.Object3D()
    for (let i = 0; i < 46; i++) {
      const angle = random() * Math.PI * 2
      const radius = 0.12 + random() * 0.3
      const y = height * 0.45 + random() * height * 0.55
      object.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
      object.rotation.set((random() - 0.5) * 1.2, angle + Math.PI / 2, -0.5 - random() * 0.8)
      object.scale.set(0.1 + random() * 0.08, 0.22 + random() * 0.14, 1)
      object.updateMatrix()
      leaves.current.setMatrixAt(i, object.matrix)
      leaves.current.setColorAt(i, new THREE.Color('#3f6b3a').offsetHSL(0, 0, (random() - 0.5) * 0.12))
    }
    leaves.current.instanceMatrix.needsUpdate = true
    if (leaves.current.instanceColor) leaves.current.instanceColor.needsUpdate = true
  }, [height])
  return <group position={position}>
    <mesh position={[0, 0.17, 0]} castShadow><cylinderGeometry args={[0.2, 0.16, 0.34, 20]} /><meshStandardMaterial color="#d7d2c6" roughness={0.6} /></mesh>
    <mesh position={[0, 0.345, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[0.185, 20]} /><meshStandardMaterial color="#3a2f24" roughness={1} /></mesh>
    <mesh position={[0, 0.34 + height * 0.4, 0]} castShadow><cylinderGeometry args={[0.018, 0.03, height * 0.8, 8]} /><meshStandardMaterial color={M.bark} roughness={1} /></mesh>
    <instancedMesh ref={leaves} args={[undefined, undefined, 46]} castShadow><circleGeometry args={[1, 10]} /><meshStandardMaterial roughness={0.75} side={THREE.DoubleSide} /></instancedMesh>
  </group>
}

function Credenza({ position, width = 1.2, height = 0.7, depth = 0.45, color = M.oak }: { position: Position; width?: number; height?: number; depth?: number; color?: string }) {
  return <group position={position}>
    <Box position={[0, height / 2 + 0.06, 0]} size={[width, height, depth]} color={color} roughness={0.4} radius={0.006} />
    {[-0.5, 0.5].map((side) => <Box key={side} position={[side * (width / 2 - 0.12), 0.03, 0]} size={[0.04, 0.06, depth - 0.1]} color={M.steel} metalness={0.6} roughness={0.35} />)}
    <Box position={[0, height / 2 + 0.06, depth / 2 + 0.001]} size={[0.003, height * 0.85, 0.004]} color="#2b2b2b" castShadow={false} />
  </group>
}

function Mattress({ position }: { position: Position }) {
  return <group position={position}>
    <Box position={[0, 0.1, 0]} size={[0.9, 0.2, 2.0]} color="#d8d3c6" roughness={0.95} radius={0.03} />
    <Box position={[0.03, 0.21, 0.25]} size={[0.82, 0.03, 1.35]} rotation={[0, 0.03, 0]} color="#5a6a7c" roughness={1} radius={0.01} />
    <Box position={[-0.08, 0.26, 0.55]} size={[0.6, 0.12, 0.5]} rotation={[0.1, -0.2, 0.05]} color="#6d7d90" roughness={1} radius={0.04} />
    <Box position={[0.02, 0.24, -0.76]} size={[0.55, 0.09, 0.36]} rotation={[0, 0.12, 0]} color={M.linen} roughness={0.95} radius={0.03} />
  </group>
}

function LaundryLine({ from, to, y }: { from: [number, number]; to: [number, number]; y: number }) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1])
  const yaw = Math.atan2(to[0] - from[0], to[1] - from[1])
  const garments = [
    { t: 0.2, size: [0.42, 0.55, 0.03] as Position, color: '#6d7d90' },
    { t: 0.46, size: [0.36, 0.5, 0.03] as Position, color: M.linen },
    { t: 0.7, size: [0.3, 0.38, 0.03] as Position, color: '#8a6a6a' },
    { t: 0.88, size: [0.22, 0.42, 0.025] as Position, color: M.trouser },
  ]
  return <group position={[from[0], y, from[1]]} rotation={[0, yaw, 0]}>
    <mesh position={[0, 0, length / 2]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.004, 0.004, length, 6]} /><meshStandardMaterial color="#e8e2d0" roughness={0.8} /></mesh>
    {garments.map((garment) => <group key={garment.t} position={[0, 0, garment.t * length]} rotation={[0, Math.PI / 2, 0]}>
      <Box position={[0, -garment.size[1] / 2 + 0.02, 0]} size={garment.size} color={garment.color} roughness={1} radius={0.008} />
      {[-0.35, 0.35].map((side) => <Box key={side} position={[side * garment.size[0] * 0.45, 0.02, 0]} size={[0.012, 0.06, 0.03]} color={M.oak} castShadow={false} />)}
    </group>)}
  </group>
}

function KitchenCounter({ x, z }: { x: number; z: number }) {
  // Occupies the unreachable strip between the side footprint and the wall (x >= 4.175).
  return <group position={[x, 0, z]}>
    <Box position={[0.35, 0.44, -0.1]} size={[1.0, 0.86, 2.1]} color="#cfc7b8" roughness={0.7} radius={0.004} />
    <Box position={[0.35, 0.885, -0.1]} size={[1.06, 0.04, 2.16]} color="#5d5a55" roughness={0.35} radius={0.004} />
    <Box position={[0.35, 0.89, -0.55]} size={[0.5, 0.06, 0.4]} color="#9ea3a6" metalness={0.7} roughness={0.25} />
    <Box position={[0.35, 0.875, -0.55]} size={[0.44, 0.03, 0.34]} color="#6f7477" metalness={0.7} roughness={0.25} castShadow={false} />
    <mesh position={[0.6, 1.04, -0.55]} castShadow><cylinderGeometry args={[0.012, 0.012, 0.28, 8]} /><meshStandardMaterial color="#9ea3a6" metalness={0.7} roughness={0.25} /></mesh>
    <Box position={[0.35, 0.915, 0.35]} size={[0.55, 0.02, 0.4]} color="#1d1f22" roughness={0.5} />
    <mesh position={[0.35, 0.93, 0.35]} rotation={[Math.PI / 2, 0, 0]}><ringGeometry args={[0.06, 0.1, 20]} /><meshStandardMaterial color="#5c5f63" roughness={0.4} side={THREE.DoubleSide} /></mesh>
    <mesh position={[0.15, 1.0, 0.75]} castShadow><cylinderGeometry args={[0.075, 0.085, 0.19, 16]} /><meshStandardMaterial color="#d8d8d6" metalness={0.5} roughness={0.35} /></mesh>
    <Box position={[0.35, 1.9, 0.05]} size={[0.7, 0.03, 1.1]} color={M.oak} roughness={0.7} />
    {[-0.35, -0.05, 0.25].map((dz, i) => <mesh key={dz} position={[0.4, 2.01, dz]} castShadow><cylinderGeometry args={[0.055, 0.055, 0.17, 12]} /><meshStandardMaterial color={['#b4894f', '#7e3a2f', '#c8c2a4'][i]} roughness={0.5} /></mesh>)}
    {/* fridge at the reachable end of the footprint (z toward the room) */}
    <Box position={[0.4, 0.75, 1.3]} size={[0.62, 1.5, 0.6]} color="#e3e4e0" roughness={0.35} metalness={0.05} radius={0.01} />
    <Box position={[0.083, 0.95, 1.32]} size={[0.015, 0.5, 0.02]} color={M.steel} metalness={0.6} roughness={0.3} castShadow={false} />
    <Poster position={[0.086, 1.28, 1.42]} rotation={[0, -Math.PI / 2, 0]} lines={['RENT', '03 / 01', 'HUF 145 000']} background="#f2e5a0" foreground="#2a2622" width={0.16} />
  </group>
}

function Curtain({ position, width, height, color }: { position: Position; width: number; height: number; color: string }) {
  const geometry = useDisposable(() => {
    const geometry = new THREE.PlaneGeometry(width, height, 24, 1)
    const positions = geometry.attributes.position
    for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getX(i) / width * Math.PI * 9) * 0.035)
    geometry.computeVertexNormals()
    return geometry
  }, [width, height])
  return <mesh position={position} geometry={geometry} castShadow receiveShadow><meshStandardMaterial color={color} roughness={1} side={THREE.DoubleSide} /></mesh>
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

function Laptop({ x, mood, y = DESK_HEIGHT - 0.005 }: { x: number; mood: Mood; y?: number }) {
  const screen = mood === 'alarm' ? M.alarm : mood === 'win' ? M.win : M.screen
  return <group position={[x, y, x === 0 ? -5.5 : -5]} rotation={[0, Math.PI, 0]}>
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

// ------------------------------------------------------------------------------------------------------------
// Per-location dressing

type Textures = Record<'brick' | 'wood' | 'concrete' | 'soil' | 'plaster', Surface>

const S1_CABLES: Position[][] = [
  [[-1.8, 0.86, -4.86], [-1.58, 0.85, -4.55], [-1.5, 0.83, -4.31], [-1.48, 0.5, -4.36], [-1.42, 0.03, -4.48], [-0.4, 0.03, -4.56], [0.72, 0.035, -4.55]],
  [[0.02, 0.86, -5.36], [0.25, 0.85, -4.9], [0.42, 0.85, -4.4], [0.45, 0.83, -4.31], [0.5, 0.45, -4.36], [0.7, 0.03, -4.5], [0.82, 0.035, -4.55]],
  [[1.8, 0.86, -4.86], [1.62, 0.85, -4.55], [1.5, 0.83, -4.31], [1.46, 0.5, -4.36], [1.4, 0.03, -4.5], [1.08, 0.035, -4.55]],
  [[1.07, 0.02, -4.6], [1.1, 0.012, -5.6], [1.05, 0.012, -6.9], [1.1, 0.012, -7.6], [1.1, 0.14, -7.83]],
]
const S2_CABLES: Position[][] = [
  [[-1.8, 0.86, -4.86], [-1.62, 0.85, -4.6], [-1.5, 0.83, -4.31], [-1.47, 0.5, -4.35], [-1.4, 0.03, -4.5], [-1.06, 0.035, -4.6]],
  [[0.02, 0.86, -5.36], [-0.2, 0.85, -4.95], [-0.42, 0.85, -4.42], [-0.46, 0.83, -4.31], [-0.5, 0.4, -4.36], [-0.62, 0.03, -4.55], [-0.74, 0.035, -4.6]],
  [[1.8, 0.86, -4.86], [1.55, 0.85, -4.55], [1.45, 0.83, -4.31], [1.42, 0.5, -4.36], [1.35, 0.03, -4.5], [0.2, 0.02, -4.62], [-0.72, 0.035, -4.6]],
  [[-0.92, 0.02, -4.66], [-0.9, 0.012, -5.6], [-0.9, 0.012, -7.0], [-0.92, 0.012, -7.6], [-0.92, 0.14, -7.83]],
  [[0.64, 0.86, -4.7], [0.68, 0.7, -4.6], [0.75, 0.3, -4.4], [0.72, 0.02, -4.5], [0.2, 0.02, -4.6]],
]

function HackathonDressing({ textures, mood }: { textures: Textures; mood: Mood }) {
  const deskFallback = <Box position={[-0.9, DESK_HEIGHT - 0.055, -5]} size={[3.7, 0.11, 1.38]} surface={textures.wood} />
  return <group name="hackathon-dressing">
    {/* Mismatched tables inside the shared desk footprint: two Poly Haven wooden tables at different sizes plus a laminate trestle. */}
    <ErrorBoundary label="Detailed desks" fallback={deskFallback}><Suspense fallback={deskFallback}>
      <RealisticTable x={-1.8} size={[1.62, DESK_HEIGHT, 1.28]} />
      <RealisticTable x={0} size={[1.88, DESK_HEIGHT, 1.38]} />
    </Suspense></ErrorBoundary>
    <Box position={[1.8, DESK_HEIGHT - 0.02, -5]} size={[1.7, 0.04, 1.3]} color={M.laminate} roughness={0.35} radius={0.006} />
    {[-1, 1].map((side) => <group key={side}>
      <Box position={[1.8 + side * 0.72, (DESK_HEIGHT - 0.04) / 2, -5]} size={[0.04, DESK_HEIGHT - 0.04, 0.04]} color={M.steel} metalness={0.5} roughness={0.4} />
      <Box position={[1.8 + side * 0.72, 0.02, -5]} size={[0.04, 0.04, 1.1]} color={M.steel} metalness={0.5} roughness={0.4} />
    </group>)}
    <Box position={[1.8, DESK_HEIGHT - 0.2, -5.55]} size={[1.45, 0.03, 0.03]} color={M.steel} metalness={0.5} roughness={0.4} castShadow={false} />
    <LoftDetails />
    {[-2.6, 2.6].map((x) => <Pendant key={x} position={[x, 3.3, -4.5]} mood={mood} />)}
    <Pendant position={[-4.8, 3.3, -2.2]} mood={mood} size={0.26} />
    {S1_CABLES.map((points, index) => <Cable key={index} points={points} />)}
    <PowerStrip position={[0.9, 0.02, -4.55]} />
    {/* Desk clutter: cans and mugs near the laptops, pizza box, phone */}
    <Can position={[-1.2, DESK_HEIGHT, -5.3]} />
    <Can position={[-1.1, DESK_HEIGHT, -5.12]} accent="#e05a3a" />
    <Can position={[0.45, DESK_HEIGHT, -5.25]} accent="#3a7de0" />
    <Can position={[0.62, DESK_HEIGHT + 0.033, -4.62]} tipped />
    <Can position={[2.45, DESK_HEIGHT, -5.3]} />
    <Can position={[2.35, DESK_HEIGHT, -4.85]} accent="#e05a3a" />
    <Mug position={[-2.45, DESK_HEIGHT, -5.05]} color="#2f4a8a" />
    <Mug position={[1.3, DESK_HEIGHT, -4.65]} />
    <PizzaBox position={[0.95, DESK_HEIGHT, -4.72]} />
    <Phone position={[-0.55, DESK_HEIGHT, -4.62]} alert={mood === 'alarm'} rotation={0.6} />
    {/* Left footprint: side table with the projector aimed at the back wall; right footprint: rolling whiteboard and boxes */}
    <Box position={[-4.8, 0.36, -6.35]} size={[0.75, 0.72, 1.2]} color={M.laminate} roughness={0.4} radius={0.006} />
    <Projector position={[-4.8, 0.72, -5.85]} />
    <CardboardBoxes position={[-4.7, 0, -4.9]} count={1} />
    <Screen position={[-4.8, 1.95, -7.83]} width={1.9} title="RUNWAY" subtitle="48H HACKATHON · DEMO 18:00 · ROOM B" accent={M.win} intensity={0.75} bezel={0} />
    <Whiteboard position={[4.7, 1.55, -5.55]} rotation={[0, -Math.PI / 2, 0]} width={1.5} height={1.0} standing />
    <CardboardBoxes position={[5.05, 0, -6.75]} />
    {/* Posters on the brick */}
    <Poster position={[-5.84, 1.95, -2.7]} rotation={[0, Math.PI / 2, 0]} lines={['48H', 'BUILD.', 'SHIP.', 'SLEEP LATER']} background="#f2e9d8" foreground="#1f2426" accent={M.win} />
    <Poster position={[5.84, 1.85, -2.3]} rotation={[0, -Math.PI / 2, 0]} lines={['SHIP IT', '(responsibly)']} background="#1f2426" foreground="#f2e9d8" accent={M.alarm} />
    <Poster position={[3.9, 2.25, -7.83]} lines={['WIFI', 'puzl-guest', 'pw: hackathon']} background="#dfe6ea" foreground="#25313a" width={0.45} />
    <Scuff position={[0, 0.031, -2.15]} length={4.3} />
    <Scuff position={[-3.4, 0.031, -4.2]} length={2.6} width={1.0} opacity={0.25} rotation={Math.PI / 2} />
  </group>
}

function ApartmentDressing({ textures, mood }: { textures: Textures; mood: Mood }) {
  return <group name="apartment-dressing">
    {/* Kitchen table, folding table and an ironing board doing desk duty — all at the shared work height. */}
    <Box position={[0, DESK_HEIGHT - 0.02, -5]} size={[1.4, 0.04, 0.9]} surface={textures.wood} tint="#b9a58a" roughness={0.55} radius={0.008} />
    {[-0.62, 0.62].flatMap((x) => [-0.38, 0.38].map((z) => <Box key={`${x}/${z}`} position={[x, (DESK_HEIGHT - 0.04) / 2, -5 + z]} size={[0.05, DESK_HEIGHT - 0.04, 0.05]} color="#7a5b3d" roughness={0.75} />))}
    <Box position={[-1.8, DESK_HEIGHT - 0.015, -5]} size={[1.15, 0.03, 0.6]} color="#c9c4b8" roughness={0.5} radius={0.006} />
    {[-1, 1].map((side) => <group key={side}>
      <Box position={[-1.8 + side * 0.48, (DESK_HEIGHT - 0.03) / 2, -5]} size={[0.025, DESK_HEIGHT - 0.03, 0.025]} rotation={[0.42, 0, 0]} color={M.steel} metalness={0.5} roughness={0.4} />
      <Box position={[-1.8 + side * 0.48, (DESK_HEIGHT - 0.03) / 2, -5]} size={[0.025, DESK_HEIGHT - 0.03, 0.025]} rotation={[-0.42, 0, 0]} color={M.steel} metalness={0.5} roughness={0.4} />
    </group>)}
    <Box position={[1.8, DESK_HEIGHT - 0.012, -5]} size={[1.2, 0.024, 0.36]} color="#6e7f96" roughness={0.9} radius={0.01} />
    <mesh position={[2.42, DESK_HEIGHT - 0.012, -5]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.18, 0.18, 0.024, 20, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#6e7f96" roughness={0.9} /></mesh>
    {[-1, 1].map((side) => <Box key={side} position={[1.8, (DESK_HEIGHT - 0.03) / 2, -5]} size={[0.025, DESK_HEIGHT - 0.03, 0.025]} rotation={[0, 0, side * 0.55]} color={M.steel} metalness={0.5} roughness={0.4} />)}
    {/* Low ceiling (room shell) with one exposed beam and a cheap ceiling rose, no pendants: the desk lamp is the only warm key */}
    <Box position={[0, 2.47, -3.1]} size={[12, 0.22, 0.24]} color="#a59a84" roughness={0.9} />
    <mesh position={[0.3, 2.55, -5.2]} castShadow><sphereGeometry args={[0.09, 12, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} /><meshStandardMaterial color="#e7e2d3" roughness={0.7} /></mesh>
    <DeskLamp position={[0.62, DESK_HEIGHT, -4.72]} mood={mood} />
    {S2_CABLES.map((points, index) => <Cable key={index} points={points} />)}
    <PowerStrip position={[-0.9, 0.02, -4.6]} />
    <NoodleCup position={[-0.45, DESK_HEIGHT, -4.7]} />
    <NoodleCup position={[2.3, DESK_HEIGHT, -5.05]} chopsticks={false} />
    <NoodleCup position={[-4.32, 0.02, -4.75]} chopsticks={false} />
    <Mug position={[-1.35, DESK_HEIGHT, -4.78]} color="#8a6a6a" />
    <Can position={[0.5, DESK_HEIGHT, -5.32]} accent="#e05a3a" />
    <Phone position={[0.35, DESK_HEIGHT, -4.66]} alert={mood === 'alarm'} rotation={-0.5} />
    {/* Left footprint: mattress on the floor, laundry basket; right: kitchen counter and fridge up to the wall */}
    <Mattress position={[-5.0, 0.02, -6.05]} />
    <mesh position={[-4.75, 0.24, -4.65]} castShadow><cylinderGeometry args={[0.22, 0.19, 0.44, 16]} /><meshStandardMaterial color="#5f6b78" roughness={0.9} /></mesh>
    <Box position={[-4.78, 0.5, -4.66]} size={[0.3, 0.08, 0.26]} rotation={[0, 0.5, 0.15]} color={M.linen} roughness={1} radius={0.02} />
    <KitchenCounter x={4.8} z={-5.9} />
    <LaundryLine from={[-5.7, -3.4]} to={[-3.1, -3.15]} y={2.3} />
    <Curtain position={[-3.6, 1.7, -0.14]} width={1.7} height={2.55} color="#5d5a66" />
    <Poster position={[-3.3, 1.95, -7.83]} lines={['2026', 'SEPT', 'OCT  NOV']} background="#f4f1e8" foreground="#2a2622" accent="#c43d3d" width={0.42} />
    <Poster position={[5.84, 1.75, -2.6]} rotation={[0, -Math.PI / 2, 0]} lines={['GYM', 'MEMBERSHIP', 'expired']} background="#d6d9d2" foreground="#2a2622" width={0.4} />
    <Scuff position={[0, 0.031, -2.15]} length={4.3} width={1.2} opacity={0.5} />
  </group>
}

function InvestorDressing({ textures }: { textures: Textures }) {
  return <group name="investor-dressing">
    {/* One long veneered conference table on two slab legs; bevelled edge via RoundedBoxGeometry */}
    <Box position={[0, DESK_HEIGHT - 0.025, -5]} size={[5.3, 0.05, 1.3]} surface={textures.wood} tint="#d9c7a8" roughness={0.32} radius={0.012} />
    {[-2.1, 2.1].map((x) => <Box key={x} position={[x, (DESK_HEIGHT - 0.05) / 2, -5]} size={[0.07, DESK_HEIGHT - 0.05, 1.05]} color="#23262a" roughness={0.45} metalness={0.2} radius={0.006} />)}
    <Box position={[0, 0.06, -5]} size={[4.1, 0.05, 0.08]} color="#23262a" roughness={0.45} metalness={0.2} castShadow={false} />
    {/* Symmetric table setting: carafe, three glasses, three notepads */}
    <mesh position={[0, DESK_HEIGHT + 0.12, -4.55]} castShadow><cylinderGeometry args={[0.05, 0.06, 0.24, 16]} /><meshPhysicalMaterial color="#dfe8ec" transmission={0.6} thickness={0.2} roughness={0.08} transparent opacity={0.85} /></mesh>
    {[-1.8, 0, 1.8].map((x) => <group key={x}>
      <mesh position={[x + 0.5, DESK_HEIGHT + 0.045, -4.55]} castShadow><cylinderGeometry args={[0.032, 0.028, 0.09, 14]} /><meshPhysicalMaterial color="#e8eef0" transmission={0.5} roughness={0.08} transparent opacity={0.8} /></mesh>
      <Box position={[x - 0.45, DESK_HEIGHT + 0.004, -4.55]} size={[0.21, 0.008, 0.3]} color="#f4f2ea" roughness={0.9} castShadow={false} />
      <Box position={[x - 0.45, DESK_HEIGHT + 0.012, -4.6]} size={[0.14, 0.008, 0.008]} rotation={[0, 0.3, 0]} color="#1f1f24" castShadow={false} />
    </group>)}
    {/* Clean ceiling with four recessed downlights; light itself comes from sceneLighting */}
    {[-1.6, 1.6].flatMap((x) => [-5.7, -2.6].map((z) => <Downlight key={`${x}/${z}`} position={[x, 3.68, z]} />))}
    {/* Left footprint: plant and low credenza; right: media credenza with the investor wall screen */}
    <Plant position={[-5.1, 0.02, -6.7]} />
    <Credenza position={[-4.85, 0.02, -5.0]} width={1.1} depth={0.42} color="#e0dcd3" />
    <mesh position={[-4.6, 0.92, -5.0]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.28, 16]} /><meshStandardMaterial color="#9ea3a6" metalness={0.7} roughness={0.25} /></mesh>
    <Credenza position={[5.0, 0.02, -5.7]} width={1.4} depth={0.45} height={0.6} color="#e0dcd3" />
    <Screen position={[5.82, 1.85, -5.7]} rotation={[0, -Math.PI / 2, 0]} width={1.9} title="THE NEXT ROUND" subtitle="BRIDGE · EUR 500 · 20% · TERMS FINAL" accent="#8aa3b8" intensity={0.55} />
    <Whiteboard position={[-5.82, 1.7, -3.0]} rotation={[0, Math.PI / 2, 0]} width={2.0} height={1.2} />
    <Box position={[0, 0.06, -7.83]} size={[11.7, 0.12, 0.03]} color="#2a2c30" roughness={0.6} castShadow={false} />
    {[-5.84, 5.84].map((x) => <Box key={x} position={[x, 0.06, -4]} size={[0.03, 0.12, 7.7]} color="#2a2c30" roughness={0.6} castShadow={false} />)}
  </group>
}

// ------------------------------------------------------------------------------------------------------------

type SceneProps = { scene: SceneKey; mood: Mood; active?: FounderId; reducedMotion: boolean }

export function SceneEnvironment(props: SceneProps) {
  const fallback = <EnvironmentScene {...props} />
  return <ErrorBoundary label="Environment surfaces" fallback={fallback}><Suspense fallback={fallback}><TexturedScene {...props} /></Suspense></ErrorBoundary>
}

function TexturedScene(props: SceneProps) {
  const surfaces = useEnvironmentSurfaces()
  return <EnvironmentScene {...props} surfaces={surfaces} />
}

interface RoomStyle {
  /** 'brick' for the textured wall, otherwise a paint colour applied over the plaster grain. */
  wall: string
  base: string
  floor: 'concrete' | 'wood' | 'charcoal'
  ceiling: number
  ceilingColor: string
  beams: boolean
  sign: { title: string; subtitle: string; width: number; dark: boolean; position: Position }
}

const ROOMS: Record<SceneKey, RoomStyle> = {
  S1: { wall: 'brick', base: 'brick', floor: 'concrete', ceiling: 3.76, ceilingColor: M.plaster, beams: true, sign: { title: 'PUZL / COWORKING', subtitle: 'BUDAPEST     COGNITION x DEVIN     2026', width: 5.2, dark: false, position: [0, 2.6, -7.83] } },
  S2: { wall: M.ochre, base: M.ochreDark, floor: 'wood', ceiling: 2.56, ceilingColor: '#b8b09e', beams: false, sign: { title: 'DEBRECEN / 03:00', subtitle: 'THREE FOUNDERS. ONE KITCHEN TABLE.', width: 2.2, dark: true, position: [1.9, 1.95, -7.83] } },
  S3: { wall: '#f1efe9', base: '#f1efe9', floor: 'charcoal', ceiling: 3.76, ceilingColor: '#f3f1ec', beams: false, sign: { title: 'THE NEXT ROUND', subtitle: 'BUILD SOMETHING PEOPLE WANT.', width: 3.2, dark: false, position: [0, 2.45, -7.83] } },
  devin: { wall: M.ochre, base: M.ochreDark, floor: 'wood', ceiling: 2.56, ceilingColor: '#b8b09e', beams: false, sign: { title: 'DEVIN / ENGINEERING', subtitle: 'REAL CODE. INDEPENDENT VERIFICATION.', width: 2.2, dark: true, position: [1.9, 1.95, -7.83] } },
}

function EnvironmentScene({ scene, mood, active, reducedMotion, surfaces }: SceneProps & { surfaces?: Record<'brick' | 'concrete', Surface> }) {
  const generated = useMemo(() => ({ brick: surfaceTexture('brick'), wood: surfaceTexture('wood'), concrete: surfaceTexture('concrete'), soil: surfaceTexture('soil'), plaster: surfaceTexture('plaster') }), [])
  useEffect(() => () => Object.values(generated).forEach((texture) => texture.dispose()), [generated])
  const textures: Textures = useMemo(() => ({
    brick: surfaces?.brick ?? { map: generated.brick, meters: [1.5, 1.5] },
    concrete: surfaces?.concrete ?? { map: generated.concrete, meters: [3.3, 3.3] },
    wood: { map: generated.wood, meters: SURFACE_METERS.wood, roughness: 0.6 },
    soil: { map: generated.soil, meters: [2, 2] },
    // Painted plaster: the generated concrete grain as a faint bump/tint carrier, coloured per location
    plaster: { map: generated.plaster, meters: [2.4, 2.4], roughness: 0.92 },
  }), [surfaces, generated])
  const polished: Surface = useMemo(() => ({ map: textures.concrete.map, normalMap: textures.concrete.normalMap, meters: textures.concrete.meters, roughness: 0.42, normalScale: 0.25 }), [textures])
  const room = ROOMS[scene]
  const lightingScene: LightingSceneId = scene
  const wallSurface = room.wall === 'brick' ? textures.brick : textures.plaster
  const wallTint = room.wall === 'brick' ? undefined : room.wall
  const baseSurface = room.base === 'brick' ? textures.brick : textures.plaster
  const baseTint = room.base === 'brick' ? undefined : room.base
  const floor = room.floor === 'concrete' ? { surface: textures.concrete } : room.floor === 'wood' ? { surface: textures.wood, tint: '#a08663' } : { surface: polished, tint: '#73767b' }
  const facadeFallback = <group>
    {[-1, 1].map((side) => <Box key={side} position={[side * 12, 5, 1]} size={[5, 10, 28]} surface={textures.brick} />)}
    <Box position={[0, 5, 19]} size={[26, 10, 4]} surface={textures.brick} />
  </group>
  return <group>
    <SceneLighting scene={lightingScene} mood={mood} />
    {/* Ground, courtyard path and slabs */}
    <Box position={[0, -0.17, 2]} size={[15.2, 0.3, 21]} surface={textures.soil} />
    <Box position={[0, -0.04, -4]} size={[12, 0.12, 8]} surface={floor.surface} tint={floor.tint} roughness={room.floor === 'charcoal' ? 0.42 : undefined} metalness={room.floor === 'charcoal' ? 0.06 : 0} />
    <Box position={[0, -0.01, 1]} size={[12, 0.08, 2]} surface={textures.concrete} />
    {Array.from({ length: 10 }, (_, i) => <Box key={i} position={[0, 0.005, 2.5 + i]} size={[2.12, 0.08, 0.94]} surface={textures.concrete} />)}
    {/* Walls */}
    <Box position={[0, 1.9, -8]} size={[12, 3.8, 0.28]} surface={wallSurface} tint={wallTint} />
    {[-1, 1].map((side) => <group key={side}>
      <Box position={[side * 6, 1.9, -4]} size={[0.28, 3.8, 8]} surface={wallSurface} tint={wallTint} />
      <Box position={[side * 3.75, 0.38, 0]} size={[4.5, 0.76, 0.25]} surface={baseSurface} tint={baseTint} />
      <mesh position={[side * 3.75, 2.15, 0]}><boxGeometry args={[4.45, 2.75, 0.025]} /><meshPhysicalMaterial color={M.ambient} transparent opacity={0.12} roughness={0.08} metalness={0.15} depthWrite={false} /></mesh>
      {[1.5, 3, 4.5, 6].map((x) => <Box key={x} position={[side * x, 2.1, 0]} size={[0.055, 3.4, 0.1]} color={scene === 'S3' ? '#3a3d42' : M.metal} roughness={0.5} metalness={0.3} />)}
      <Box position={[side * 3.75, 2.5, 0]} size={[4.5, 0.05, 0.1]} color={scene === 'S3' ? '#3a3d42' : M.metal} roughness={0.5} metalness={0.3} />
      <Box position={[side * 7.5, 0.45, 6.2]} size={[0.2, 0.9, 12.5]} surface={textures.concrete} />
      <ErrorBoundary label="Courtyard tree" fallback={<Tree x={side * 5.5} z={3.8} />}><Suspense fallback={<Tree x={side * 5.5} z={3.8} />}><CourtyardTree x={side * 5.5} z={3.8} /></Suspense></ErrorBoundary>
      <group position={[side * 5.1, 0, 8]}>
        {[0, 1, 2].map((n) => <Box key={n} position={[0, 0.48, -0.24 + n * 0.22]} size={[2.6, 0.07, 0.19]} surface={textures.wood} />)}
        {[-0.95, 0.95].map((x) => <Box key={x} position={[x, 0.25, 0]} size={[0.06, 0.5, 0.65]} />)}
      </group>
    </group>)}
    {/* Ceiling */}
    <Box position={[0, room.ceiling, -4]} size={[12.3, 0.15, 8.3]} color={room.ceilingColor} roughness={0.95} />
    {room.beams && [-6, -3, 0].map((z) => <Box key={z} position={[0, 3.58, z]} size={[12, 0.3, 0.14]} />)}
    <Box position={[0, 0.45, 12.5]} size={[15.2, 0.9, 0.25]} surface={textures.concrete} />
    <Sign title={room.sign.title} subtitle={room.sign.subtitle} position={room.sign.position} width={room.sign.width} dark={room.sign.dark} />
    <Sign title="TAKE A BREATH." subtitle="STEP OUTSIDE. TOUCH GRASS. COME BACK." position={[-3.6, 1.15, 0.17]} width={2.8} />
    {scene === 'S1' && <HackathonDressing textures={textures} mood={mood} />}
    {(scene === 'S2' || scene === 'devin') && <ApartmentDressing textures={textures} mood={mood} />}
    {scene === 'S3' && <InvestorDressing textures={textures} />}
    {(['sadman', 'kirill', 'sergio'] as const).map((id, i) => <group key={id}>
      <Chair x={(i - 1) * 1.8} />
      <Laptop x={(i - 1) * 1.8} mood={mood} />
      <ErrorBoundary label={`${id}Founder`} fallback={<Founder id={id} x={(i - 1) * 1.8} active={active === id} mood={mood} reducedMotion={reducedMotion} />}>
        <Suspense fallback={<Founder id={id} x={(i - 1) * 1.8} active={active === id} mood={mood} reducedMotion={reducedMotion} />}>
          <RemyFounder asset={id === 'kirill' ? 'remy' : id} x={(i - 1) * 1.8} active={active === id} mood={mood} reducedMotion={reducedMotion} />
        </Suspense>
      </ErrorBoundary>
    </group>)}
    <ErrorBoundary label="Detailed facades" fallback={facadeFallback}><Suspense fallback={facadeFallback}><DetailedFacades /></Suspense></ErrorBoundary>
  </group>
}
