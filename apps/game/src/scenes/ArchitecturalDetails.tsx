import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { MATERIAL as M } from './sceneMaterials'

type Placement = { x: number; y: number; z: number; yaw: number }
type ModuleName = 'FacadeWide' | 'FacadeNarrow' | 'FacadeDoor' | 'FacadeCornice' | 'FacadeBase'

function ModuleInstances({ parts, placements }: { parts: THREE.Mesh[]; placements: Placement[] }) {
  const instances = useMemo(() => parts.map((part) => {
    const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length)
    const transform = new THREE.Object3D()
    placements.forEach(({ x, y, z, yaw }, index) => {
      transform.position.set(x, y, z)
      transform.rotation.set(0, yaw, 0)
      transform.updateMatrix()
      mesh.setMatrixAt(index, transform.matrix.clone().multiply(part.matrixWorld))
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.computeBoundingSphere()
    return mesh
  }), [parts, placements])
  useEffect(() => () => instances.forEach((mesh) => mesh.dispose()), [instances])
  return <group>{instances.map((mesh) => <primitive key={mesh.uuid} object={mesh} dispose={null} />)}</group>
}

export function DetailedFacades() {
  const { scene } = useGLTF('/assets/realism/facade-kit.glb')
  const modules = useMemo(() => {
    const root = scene.clone(true)
    root.updateMatrixWorld(true)
    const names: ModuleName[] = ['FacadeWide', 'FacadeNarrow', 'FacadeDoor', 'FacadeCornice', 'FacadeBase']
    const result = {} as Record<ModuleName, THREE.Mesh[]>
    names.forEach((name) => {
      const node = root.getObjectByName(name)
      if (!node) throw new Error(`Missing architectural module: ${name}`)
      const parts: THREE.Mesh[] = []
      node.traverse((object) => { if (object instanceof THREE.Mesh) parts.push(object) })
      result[name] = parts
    })
    return result
  }, [scene])
  const placements = useMemo(() => {
    const result: Record<ModuleName, Placement[]> = { FacadeWide: [], FacadeNarrow: [], FacadeDoor: [], FacadeCornice: [], FacadeBase: [] }
    const columns = [
      ...[-1, 1].flatMap((side) => Array.from({ length: 10 }, (_, i) => ({ x: side * 9.5, z: -11.5 + i * 3, yaw: -side * Math.PI / 2 }))),
      ...Array.from({ length: 9 }, (_, i) => ({ x: -12 + i * 3, z: 17, yaw: Math.PI })),
    ]
    columns.forEach((column, i) => {
      for (let floor = 0; floor < 3; floor++) {
        const name = floor === 0 && i % 5 === 2 ? 'FacadeDoor' : (i + floor) % 3 === 0 ? 'FacadeNarrow' : 'FacadeWide'
        result[name].push({ ...column, y: 0.45 + floor * 3 })
        result.FacadeCornice.push({ ...column, y: 0.43 + floor * 3 })
      }
      result.FacadeCornice.push({ ...column, y: 9.45 })
      result.FacadeBase.push({ ...column, y: -0.15 })
    })
    return result
  }, [])
  return <group name="Detailed-industrial-facades">
    {(Object.keys(modules) as ModuleName[]).map((name) => <ModuleInstances key={name} parts={modules[name]} placements={placements[name]} />)}
    {[-1, 1].map((side) => <mesh key={side} position={[side * 10.1, 4.9, 2]} rotation={[0, -side * Math.PI / 2, 0]}><planeGeometry args={[30, 10]} /><meshStandardMaterial color={M.dark} roughness={0.85} /></mesh>)}
    <mesh position={[0, 4.9, 17.65]} rotation={[0, Math.PI, 0]}><planeGeometry args={[28, 10]} /><meshStandardMaterial color={M.dark} roughness={0.85} /></mesh>
  </group>
}

export function LoftDetails() {
  return <group name="Workspace-architectural-details">
    {[-4.6, 4.6].map((x) => <group key={x}>
      <mesh position={[x, 3.42, -4]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow><cylinderGeometry args={[0.13, 0.13, 7.6, 20]} /><meshStandardMaterial color={M.ambient} metalness={0.65} roughness={0.42} /></mesh>
      {[-6.6, -4, -1.4].map((z) => <mesh key={z} position={[x, 3.42, z]} castShadow><torusGeometry args={[0.138, 0.012, 6, 20]} /><meshStandardMaterial color={M.metal} metalness={0.7} roughness={0.5} /></mesh>)}
    </group>)}
    {[-5.83, 5.83].map((x) => <mesh key={x} position={[x, 0.09, -4]} receiveShadow><boxGeometry args={[0.055, 0.18, 7.7]} /><meshStandardMaterial color={M.metal} roughness={0.8} /></mesh>)}
    <mesh position={[0, 0.09, -7.83]} receiveShadow><boxGeometry args={[11.7, 0.18, 0.055]} /><meshStandardMaterial color={M.metal} roughness={0.8} /></mesh>
    {[-5.7, 5.7].map((x) => <mesh key={x} position={[x, 3.73, -4]} receiveShadow><boxGeometry args={[0.13, 0.1, 7.8]} /><meshStandardMaterial color={M.plaster} roughness={0.9} /></mesh>)}
  </group>
}
