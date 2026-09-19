import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { SCENE_COLLIDERS } from '../engine/firstPerson'

export function WorldColliders() {
  return <RigidBody type="fixed" colliders={false}>
    <CuboidCollider args={[7.6, 0.1, 10.5]} position={[0, -0.08, 2]} />
    {SCENE_COLLIDERS.map((box, index) => {
      const height = box.width >= 11 || box.depth >= 7 || box.z === 0 ? 3.8 : box.width === 0.55 ? 3.4 : 1
      return <CuboidCollider key={index} args={[box.width / 2, height / 2, box.depth / 2]} position={[box.x, height / 2, box.z]} />
    })}
    <CuboidCollider args={[0.15, 1, 10.5]} position={[-7.5, 1, 2]} />
    <CuboidCollider args={[0.15, 1, 10.5]} position={[7.5, 1, 2]} />
    <CuboidCollider args={[7.5, 1, 0.15]} position={[0, 1, 12.5]} />
  </RigidBody>
}
