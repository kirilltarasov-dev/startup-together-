import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { Mood } from '../components/World'

export function RemyFounder({ x, active, mood, reducedMotion, asset = 'remy' }: { x: number; active: boolean; mood: Mood; reducedMotion: boolean; asset?: 'remy' | 'sergio' }) {
  const { scene } = useGLTF(`/assets/founders/${asset}-seated.glb`)
  const model = useMemo(() => {
    const root = clone(scene)
    const materials = new Set<THREE.Material>()
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const copy = (material: THREE.Material) => {
        const cloned = material.clone()
        materials.add(cloned)
        return cloned
      }
      object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material)
    })
    const head = root.getObjectByName('mixamorigHead') ?? root.getObjectByName('mixamorig:Head')
    return { root, materials, head, headRest: head?.quaternion.clone(), target: new THREE.Quaternion(), tilt: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0) }
  }, [scene])

  useEffect(() => () => {
    model.materials.forEach((material) => material.dispose())
    model.root.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose()
    })
  }, [model])

  useFrame((_, delta) => {
    if (!model.head || !model.headRest) return
    const angle = mood === 'lose' ? 0.08 : active ? -0.035 : 0
    model.target.copy(model.headRest).multiply(model.tilt.setFromAxisAngle(model.axis, angle))
    model.head.quaternion.slerp(model.target, reducedMotion ? 1 : 1 - Math.exp(-4 * Math.min(delta, 0.1)))
  })

  return <group position={[x, 0, -6.45]} name={`${asset}-founder`}>
    <primitive object={model.root} dispose={null} />
  </group>
}
