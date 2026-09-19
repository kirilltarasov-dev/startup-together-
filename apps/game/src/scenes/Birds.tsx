/**
 * 1-3 distant birds for daytime exterior views. Three InstancedMeshes (body, left wing, right wing) so the
 * whole flock costs 3 draw calls and 8 triangles per bird. Flight paths come from birdFlight.ts: smooth
 * Catmull-Rom splines high above the roofline (y 12-20, 25-45 m out), banked turns, glide phases and
 * unsynchronised wingbeats. All per-frame work happens in refs; no React state is touched per frame.
 * The three meshes are never frustum culled (their bounds move every frame and the draws are trivial).
 *
 * Integration (owned by the world files): `<Birds visible={scene !== 'S2'} reducedMotion={reducedMotion} />`
 * S2 is 03:00, so no birds there.
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { seededRandom } from './sceneMaterials'
import { createBird, stepBird, type BirdState } from './birdFlight'

declare global {
  interface Window { __runwayBirds?: () => { x: number; y: number; z: number }[] }
}

function bodyGeometry() {
  // Stretched tetrahedron: nose forward (+z), tail back, keel below. 4 triangles.
  const geometry = new THREE.BufferGeometry()
  const nose = [0, 0, 0.26], tail = [0, 0.02, -0.22], left = [-0.07, 0.03, -0.02], right = [0.07, 0.03, -0.02], keel = [0, -0.06, 0]
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    ...nose, ...left, ...right,
    ...tail, ...right, ...left,
    ...nose, ...keel, ...left,
    ...nose, ...right, ...keel,
  ], 3))
  geometry.computeVertexNormals()
  return geometry
}

function wingGeometry(side: 1 | -1) {
  // Quad from the hinge (x = 0) to the tip (x = 0.55·side), swept back. 2 triangles.
  const geometry = new THREE.BufferGeometry()
  const root0 = [0, 0, 0.12], root1 = [0, 0, -0.1], tip0 = [0.55 * side, 0, -0.02], tip1 = [0.42 * side, 0, -0.16]
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(side === 1
    ? [...root0, ...tip0, ...root1, ...root1, ...tip0, ...tip1]
    : [...root0, ...root1, ...tip0, ...root1, ...tip1, ...tip0], 3))
  geometry.computeVertexNormals()
  return geometry
}

export function Birds({ visible = true, count = 3, reducedMotion = false }: { visible?: boolean; count?: number; reducedMotion?: boolean }) {
  const flock = Math.max(0, Math.min(3, Math.round(count)))
  const body = useRef<THREE.InstancedMesh>(null)
  const leftWing = useRef<THREE.InstancedMesh>(null)
  const rightWing = useRef<THREE.InstancedMesh>(null)
  const { geometries, material, birds, random, scratch } = useMemo(() => {
    const random = seededRandom(4411 + flock)
    // Spread the flock around the ring so the birds are not bunched at spawn.
    const birds: BirdState[] = Array.from({ length: flock }, (_, i) => createBird(random, undefined, -Math.PI / 2 + (i / Math.max(1, flock)) * Math.PI * 2))
    const geometries = { body: bodyGeometry(), left: wingGeometry(-1), right: wingGeometry(1) }
    const material = new THREE.MeshBasicMaterial({ color: '#23262c', side: THREE.DoubleSide })
    const scratch = { matrix: new THREE.Matrix4(), wing: new THREE.Matrix4(), hinge: new THREE.Matrix4(), right: new THREE.Vector3(), up: new THREE.Vector3(), forward: new THREE.Vector3(), quaternion: new THREE.Quaternion() }
    return { geometries, material, birds, random, scratch }
  }, [flock])
  useEffect(() => () => { Object.values(geometries).forEach((geometry) => geometry.dispose()); material.dispose() }, [geometries, material])
  useEffect(() => {
    window.__runwayBirds = () => birds.map((bird) => ({ x: bird.position.x, y: bird.position.y, z: bird.position.z }))
    return () => { if (window.__runwayBirds) delete window.__runwayBirds }
  }, [birds])
  useFrame((_, delta) => {
    if (!visible || reducedMotion || !body.current || !leftWing.current || !rightWing.current) return
    if (typeof document !== 'undefined' && document.hidden) return
    const { matrix, wing, hinge, right, up, forward, quaternion } = scratch
    for (let i = 0; i < birds.length; i++) {
      const bird = birds[i]
      const flap = stepBird(bird, delta, random)
      forward.copy(bird.tangent).normalize()
      up.set(0, 1, 0)
      right.crossVectors(up, forward).normalize()
      up.crossVectors(forward, right).normalize()
      quaternion.setFromAxisAngle(forward, bird.roll)
      right.applyQuaternion(quaternion)
      up.applyQuaternion(quaternion)
      matrix.makeBasis(right, up, forward).setPosition(bird.position)
      body.current.setMatrixAt(i, matrix)
      // Wings hinge at the body sides and rotate about the forward (local z) axis.
      hinge.makeRotationZ(flap)
      wing.multiplyMatrices(matrix, hinge)
      rightWing.current.setMatrixAt(i, wing)
      hinge.makeRotationZ(-flap)
      wing.multiplyMatrices(matrix, hinge)
      leftWing.current.setMatrixAt(i, wing)
    }
    body.current.instanceMatrix.needsUpdate = true
    leftWing.current.instanceMatrix.needsUpdate = true
    rightWing.current.instanceMatrix.needsUpdate = true
  })
  if (flock === 0 || reducedMotion) return null
  return <group name="Birds" visible={visible}>
    <instancedMesh ref={body} args={[geometries.body, material, flock]} frustumCulled={false} />
    <instancedMesh ref={leftWing} args={[geometries.left, material, flock]} frustumCulled={false} />
    <instancedMesh ref={rightWing} args={[geometries.right, material, flock]} frustumCulled={false} />
  </group>
}
