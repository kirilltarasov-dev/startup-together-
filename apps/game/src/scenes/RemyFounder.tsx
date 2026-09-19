import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { Mood } from '../components/World'

export function RemyFounder({ x, active, mood, reducedMotion, asset = 'remy' }: { x: number; active: boolean; mood: Mood; reducedMotion: boolean; asset?: 'remy' | 'sergio' | 'sadman' }) {
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
    const bone = (name: string) => root.getObjectByName(`mixamorig${name}`) ?? root.getObjectByName(`mixamorig:${name}`)
    const head = bone('Head')
    const breathingBones = ['Spine2', 'LeftShoulder', 'RightShoulder'].flatMap((name) => {
      const joint = bone(name)
      return joint ? [{ joint, rest: joint.quaternion.clone(), strength: name === 'Spine2' ? 0.012 : 0.005 }] : []
    })
    return { root, materials, head, breathingBones, headRest: head?.quaternion.clone(), target: new THREE.Quaternion(), tilt: new THREE.Quaternion(), axis: new THREE.Vector3(1, 0, 0) }
  }, [scene])

  useEffect(() => () => {
    model.materials.forEach((material) => material.dispose())
    model.root.traverse((object) => {
      if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose()
    })
  }, [model])

  const idleTime = useRef(0)
  useFrame((_, delta) => {
    if (document.hidden) return
    if (!reducedMotion) idleTime.current += Math.min(delta, 0.05)
    const breath = reducedMotion ? 0 : (Math.sin(idleTime.current * 1.45 + x) + 1) * 0.5
    for (const { joint, rest, strength } of model.breathingBones) {
      joint.quaternion.copy(rest).multiply(model.tilt.setFromAxisAngle(model.axis, breath * strength))
    }
    if (!model.head || !model.headRest) return
    const idle = reducedMotion ? 0 : Math.sin(idleTime.current * 0.65 + x * 2) * 0.007
    const angle = (mood === 'lose' ? 0.08 : active ? -0.035 : 0) + idle
    model.target.copy(model.headRest).multiply(model.tilt.setFromAxisAngle(model.axis, angle))
    model.head.quaternion.slerp(model.target, reducedMotion ? 1 : 1 - Math.exp(-4 * Math.min(delta, 0.1)))
  })

  return <group position={[x, 0, -6.45]} name={`${asset}-founder`}>
    <primitive object={model.root} dispose={null} />
  </group>
}
