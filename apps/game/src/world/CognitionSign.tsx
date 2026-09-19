import { useTexture } from '@react-three/drei'

export function CognitionSign() {
  const logo = useTexture('/assets/branding/cognition-dark.png')
  return <group position={[-3.9, 2.65, -7.75]} name="cognition-brand-sign">
    <mesh castShadow><boxGeometry args={[2.8, 0.9, 0.08]} /><meshStandardMaterial color="white" roughness={0.8} /></mesh>
    <mesh position={[0, 0, 0.045]}><planeGeometry args={[2.5, 2.5 * 124 / 558]} /><meshStandardMaterial map={logo} transparent roughness={0.8} depthWrite={false} /></mesh>
  </group>
}
