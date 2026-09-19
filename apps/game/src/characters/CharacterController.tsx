import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControlsImpl } from '@react-three/drei'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CharacterModel } from './CharacterModel'
import type { CharacterId } from './CharacterCustomization'
import type { GrassInteraction } from '../scenes/InteractiveGrass'
import { CAMERA_COLLIDERS } from '../world/colliderSpec'
import { CAMERA_TARGET_OFFSET_Y, LOCOMOTION, PLAYER_BODY, SPAWN_POSITION } from './playerBody'

export interface PlayerActions { reset: () => void; press: (key: string, down: boolean) => void }

/**
 * Third-person camera: follow at ~3.2 m (1.6-5.5), look at chest height, never below the floor. camera-controls'
 * obstruction handling dollies in against the unified collider meshes; the post-step below refuses to let that
 * pull-in enter the character (>= CAMERA.minObstructedDistance) and raises the camera instead.
 */
const CAMERA = { distance: 3.2, minDistance: 1.6, maxDistance: 5.5, minObstructedDistance: 1.2, smoothTime: 0.18, minPolar: 0.3, maxPolar: 1.5, defaultPolar: 1.15, raiseStep: 0.06, returnStep: 0.02 }

export function CharacterController({ selected, paused, actionsRef, interaction }: { selected: CharacterId; paused: boolean; actionsRef: RefObject<PlayerActions | null>; interaction: RefObject<GrassInteraction> }) {
  const body = useRef<EcctrlHandle>(null)
  const orbit = useRef<EcctrlCameraControlsHandle>(null)
  const keys = useRef(new Set<string>())
  const { gl, camera } = useThree()
  const scratch = useRef({ target: new THREE.Vector3(), offset: new THREE.Vector3(), spherical: new THREE.Spherical(), raycaster: new THREE.Raycaster(), dir: new THREE.Vector3(), preferredPolar: CAMERA.defaultPolar })
  const cameraColliders = useMemo(() => CAMERA_COLLIDERS.map((box) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.width, box.height, box.depth), new THREE.MeshBasicMaterial())
    mesh.position.set(box.x, box.height / 2, box.z)
    mesh.updateMatrixWorld()
    return mesh
  }), [])
  useEffect(() => {
    const clear = () => { keys.current.clear() }
    const down = (event: KeyboardEvent) => {
      if (paused || (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]'))) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE'].includes(event.code)) {
        event.preventDefault()
        keys.current.add(event.code)
      }
    }
    const up = (event: KeyboardEvent) => keys.current.delete(event.code)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', clear)
    return () => { clear(); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', clear) }
  }, [paused])
  useEffect(() => {
    if (orbit.current) {
      orbit.current.colliderMeshes = cameraColliders
      const target = new THREE.Vector3(SPAWN_POSITION.x, SPAWN_POSITION.y + CAMERA_TARGET_OFFSET_Y, SPAWN_POSITION.z)
      const eye = new THREE.Vector3().setFromSphericalCoords(CAMERA.distance, CAMERA.defaultPolar, 0).add(target)
      orbit.current.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false)
    }
    // the user's own orbit angle becomes the angle the obstruction avoidance returns to
    const controls = orbit.current
    const remember = () => { if (controls) scratch.current.preferredPolar = controls.polarAngle }
    controls?.addEventListener('controlend', remember)
    actionsRef.current = {
      reset: () => {
        const actor = body.current?.body
        if (!actor) return
        actor.setTranslation({ ...SPAWN_POSITION }, true)
        actor.setLinvel({ x: 0, y: 0, z: 0 }, true)
        actor.setAngvel({ x: 0, y: 0, z: 0 }, true)
        keys.current.clear()
      },
      press: (key, down) => { if (down) keys.current.add(key); else keys.current.delete(key) },
    }
    return () => { actionsRef.current = null; controls?.removeEventListener('controlend', remember) }
  }, [actionsRef, cameraColliders])
  useEffect(() => () => cameraColliders.forEach((mesh) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }), [cameraColliders])
  useFrame((_, delta) => {
    const actor = body.current
    if (!actor?.body) return
    const held = keys.current
    actor.setMovement({ forward: !paused && (held.has('KeyW') || held.has('ArrowUp')), backward: !paused && (held.has('KeyS') || held.has('ArrowDown')), leftward: !paused && (held.has('KeyA') || held.has('ArrowLeft')), rightward: !paused && (held.has('KeyD') || held.has('ArrowRight')), run: !paused && (held.has('ShiftLeft') || held.has('ShiftRight')), jump: !paused && held.has('Space') })
    const p = actor.body.translation()
    const controls = orbit.current
    controls?.moveTo(p.x, p.y + CAMERA_TARGET_OFFSET_Y, p.z, true)
    interaction.current.player.set(p.x, p.z)
    interaction.current.brush.set(p.x, p.z)
    interaction.current.brushing = !paused && held.has('KeyE')
    interaction.current.strength = THREE.MathUtils.damp(interaction.current.strength, interaction.current.brushing ? 1 : 0, 5, delta)
    if (p.y < -4) actionsRef.current?.reset()

    // Camera post-step: camera-controls (priority -1) has already dollied against colliders for this frame.
    let camDist = 0
    if (controls) {
      const { target, offset, spherical, raycaster, dir, preferredPolar } = scratch.current
      controls.getTarget(target, false)
      offset.subVectors(camera.position, target)
      camDist = offset.length()
      const obstructed = camDist < CAMERA.minObstructedDistance - 1e-3
      if (!obstructed && controls.currentAction === CameraControlsImpl.ACTION.NONE && controls.polarAngle < preferredPolar - 1e-3) {
        // Ease back down toward the preferred orbit angle once that direction is clear again.
        spherical.setFromVector3(offset)
        spherical.phi = Math.min(preferredPolar, spherical.phi + CAMERA.returnStep)
        dir.setFromSpherical(spherical).normalize()
        raycaster.set(target, dir)
        raycaster.far = spherical.radius + camera.near + 0.05
        if (raycaster.intersectObjects(cameraColliders, false).length === 0) controls.rotatePolarTo(spherical.phi, false)
      }
      if (obstructed) {
        // Obstruction pulled the camera into the character: hold >= 1.2 m and look for a higher, clear angle.
        spherical.setFromVector3(offset)
        spherical.radius = CAMERA.minObstructedDistance
        for (let phi = spherical.phi; phi >= CAMERA.minPolar; phi -= CAMERA.raiseStep) {
          spherical.phi = phi
          dir.setFromSpherical(spherical).normalize()
          raycaster.set(target, dir)
          raycaster.far = CAMERA.minObstructedDistance + camera.near + 0.05
          if (raycaster.intersectObjects(cameraColliders, false).length === 0) break
        }
        spherical.phi = Math.max(spherical.phi, CAMERA.minPolar)
        camera.position.setFromSpherical(spherical).add(target)
        camera.lookAt(target)
        controls.rotatePolarTo(Math.max(CAMERA.minPolar, spherical.phi - CAMERA.raiseStep), true)
        camDist = CAMERA.minObstructedDistance
      }
    }
    const canvas = gl.domElement.dataset
    canvas.position = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`
    canvas.character = selected
    canvas.grounded = String(actor.isOnGround)
    canvas.camDist = camDist.toFixed(2)
    if (controls) canvas.camPolar = controls.polarAngle.toFixed(2)
    // facing evidence: +1 when the body's +Z (the model's face) points along the travel direction
    const v = actor.body.linvel()
    const planar = Math.hypot(v.x, v.z)
    if (planar > 0.5) canvas.facing = ((actor.bodyZAxis.x * v.x + actor.bodyZAxis.z * v.z) / planar).toFixed(2)
    if (!canvas.mass) canvas.mass = actor.body.mass().toFixed(3)
  })
  return <>
    <Ecctrl ref={body} position={[SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z]}
      capsuleHalfHeight={PLAYER_BODY.capsuleHalfHeight} capsuleRadius={PLAYER_BODY.capsuleRadius} floatHeight={PLAYER_BODY.floatHeight}
      maxWalkVel={LOCOMOTION.maxWalkVel} maxRunVel={LOCOMOTION.maxRunVel} enableToggleRun={false}
      accDeltaTime={0.25} decDeltaTime={0.4} slideGripFactor={0.7} airDragFactor={0.1}
      jumpVel={3.5} fallingGravityScale={2.5} moveImpulsePointOffset={0.2} slopeMaxAngle={Math.PI / 3.6}
      springK={120} dampingC={14} rayHitForgiveness={0.2}
      enable={!paused} followPlatform={false}>
      <CharacterModel selected={selected} controller={body} paused={paused} />
    </Ecctrl>
    <EcctrlCameraControls ref={orbit} makeDefault smoothTime={CAMERA.smoothTime} minDistance={CAMERA.minDistance} maxDistance={CAMERA.maxDistance} minPolarAngle={CAMERA.minPolar} maxPolarAngle={CAMERA.maxPolar} enabled={!paused} />
  </>
}
