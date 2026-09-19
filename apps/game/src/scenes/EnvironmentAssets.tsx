import { Environment, useGLTF } from '@react-three/drei'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { applyWindToMaterial } from './wind'

const ROOT = '/assets/environment/'

export function CourtyardLighting() {
  return <Environment files={`${ROOT}courtyard.hdr`} environmentIntensity={0.7} environmentRotation={[0, 1.3, 0]} />
}

export function CourtyardTree({ x, z }: { x: number; z: number }) {
  const { scene } = useGLTF(`${ROOT}courtyard-tree.glb`)
  const { tree, materials } = useMemo(() => {
    const tree = scene.clone(true)
    const materials: THREE.Material[] = []
    tree.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      const original = Array.isArray(object.material) ? object.material : [object.material]
      const copies = original.map((source) => {
        const material = source.clone()
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMapIntensity = 1
          if (material.name.toLowerCase().includes('lea')) {
            material.side = THREE.DoubleSide
            material.transparent = false
            material.alphaTest = 0.45
            // Shared wind (same gusts as the grass); leaf primitive local y range 1.46..4.55 (from the GLB).
            const { depthMaterial } = applyWindToMaterial(material, { stiffness: 0.35, heightRange: [1.4, 4.6], amplitude: 0.18 })
            object.customDepthMaterial = depthMaterial
            materials.push(depthMaterial)
          }
        }
        materials.push(material)
        return material
      })
      object.material = Array.isArray(object.material) ? copies : copies[0]
      object.castShadow = true
      object.receiveShadow = true
    })
    const bounds = new THREE.Box3().setFromObject(tree)
    const height = bounds.max.y - bounds.min.y
    tree.scale.setScalar(4.8 / height)
    tree.position.y = -bounds.min.y * tree.scale.y
    return { tree, materials }
  }, [scene])
  useEffect(() => () => materials.forEach((material) => material.dispose()), [materials])
  return <group position={[x, 0, z]} rotation={[0, x < 0 ? 0.6 : 2.5, 0]}><primitive object={tree} dispose={null} /></group>
}
