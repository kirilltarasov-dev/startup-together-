import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo } from 'react'
import { FLOOR_TOP_Y, PHYSICS_COLLIDERS, colliderCenter, sceneExtraColliders, type ColliderScene } from './colliderSpec'

export function WorldColliders({ scene }: { scene: ColliderScene }) {
  const volumes = useMemo(() => [...PHYSICS_COLLIDERS, ...sceneExtraColliders(scene)], [scene])
  return <RigidBody type="fixed" colliders={false}>
    <CuboidCollider args={[7.6, 0.1, 10.5]} position={[0, FLOOR_TOP_Y - 0.1, 2]} />
    {volumes.map((box) => <CuboidCollider key={`${box.kind}:${box.x},${box.z}`} args={[box.width / 2, box.height / 2, box.depth / 2]} position={colliderCenter(box)} />)}
  </RigidBody>
}
