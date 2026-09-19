import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { FLOOR_TOP_Y, PHYSICS_COLLIDERS } from './colliderSpec'

export function WorldColliders() {
  return <RigidBody type="fixed" colliders={false}>
    <CuboidCollider args={[7.6, 0.1, 10.5]} position={[0, FLOOR_TOP_Y - 0.1, 2]} />
    {PHYSICS_COLLIDERS.map((box) => <CuboidCollider key={`${box.kind}:${box.x},${box.z}`} args={[box.width / 2, box.height / 2, box.depth / 2]} position={[box.x, box.height / 2, box.z]} />)}
  </RigidBody>
}
