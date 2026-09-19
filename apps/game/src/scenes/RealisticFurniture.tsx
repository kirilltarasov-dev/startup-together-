import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

type Position = [number, number, number]

function FurnitureAsset({ file, position, size, height, rotation = 0 }: { file: string; position: Position; size?: Position; height?: number; rotation?: number }) {
  const { scene } = useGLTF(`/assets/realism/${file}.glb`)
  const model = useMemo(() => {
    const model = scene.clone(true)
    const bounds = new THREE.Box3().setFromObject(model)
    const dimensions = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    if (size) model.scale.set(size[0] / dimensions.x, size[1] / dimensions.y, size[2] / dimensions.z)
    else model.scale.setScalar((height ?? dimensions.y) / dimensions.y)
    model.position.set(-center.x * model.scale.x, -bounds.min.y * model.scale.y, -center.z * model.scale.z)
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true
        object.receiveShadow = true
      }
    })
    return model
  }, [scene, size, height])
  return <group position={position} rotation={[0, rotation, 0]}><primitive object={model} dispose={null} /></group>
}

const DESK_SIZE: Position = [1.78, 0.845, 1.38]

export function RealisticChair({ x, z = -6.5 }: { x: number; z?: number }) {
  return <FurnitureAsset file="school-chair" position={[x, 0, z]} height={1.04} />
}

export function RealisticDesks() {
  return <group>{[-1.8, 0, 1.8].map((x) => <FurnitureAsset key={x} file="wooden-table" position={[x, 0, -5]} size={DESK_SIZE} />)}</group>
}
