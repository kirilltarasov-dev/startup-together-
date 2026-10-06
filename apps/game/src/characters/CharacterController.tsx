import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControlsImpl } from '@react-three/drei'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CharacterModel } from './CharacterModel'
import type { CharacterId } from './CharacterCustomization'
import type { GrassInteraction } from '../scenes/InteractiveGrass'
import { CAMERA_COLLIDERS, colliderCenter, sceneExtraColliders, type ColliderScene } from '../world/colliderSpec'
import { CAMERA, CAMERA_TARGET_OFFSET_Y, LOCOMOTION, PLAYER_BODY, SPAWN_POSITION, pickCameraSwing } from './playerBody'
import { useFootsteps } from '../scenes/footsteps'
import { isGrass } from '../engine/firstPerson'

export interface PlayerActions { reset: () => void; press: (key: string, down: boolean) => void }

/**
 * Third-person camera: follow at ~3.2 m (1.6-5.5), look at chest height, never below the floor. camera-controls'
 * obstruction handling dollies in against the unified collider meshes; the post-step below refuses to let that
 * pull-in enter the character (>= CAMERA.minObstructedDistance). Instead of rising to a top-down view it first
 * probes alternative azimuths (same polar angle, preferred distance) and swings the orbit toward the smallest clear
 * offset at <= 90 deg/s; only when no probed azimuth is clear does it fall back to raising the camera, and that rise
 * is capped at `riseMinPolar`. Once clear it never swings back on its own (no ping-pong); only the polar angle eases
 * back toward the player's own orbit angle. A user drag or wheel (`currentAction !== NONE`) always wins.
 */
/** camera-controls keeps the un-collided (user-chosen) orbit radius private; fall back to the default follow distance. */
const preferredDistance = (controls: CameraControlsImpl) => THREE.MathUtils.clamp((controls as unknown as { _sphericalEnd?: THREE.Spherical })._sphericalEnd?.radius ?? CAMERA.distance, CAMERA.minDistance, CAMERA.maxDistance)

export function CharacterController({ scene, selected, paused, actionsRef, interaction }: { scene: ColliderScene; selected: CharacterId; paused: boolean; actionsRef: RefObject<PlayerActions | null>; interaction: RefObject<GrassInteraction> }) {
  const body = useRef<EcctrlHandle>(null)
  const orbit = useRef<EcctrlCameraControlsHandle>(null)
  const keys = useRef(new Set<string>())
  const { gl, camera } = useThree()
  const scratch = useRef({ target: new THREE.Vector3(), offset: new THREE.Vector3(), spherical: new THREE.Spherical(), probe: new THREE.Spherical(), raycaster: new THREE.Raycaster(), dir: new THREE.Vector3(), preferredPolar: CAMERA.defaultPolar as number, swing: { active: false, sign: 1, end: 0 } })
  const cameraColliders = useMemo(() => [...CAMERA_COLLIDERS, ...sceneExtraColliders(scene).filter((box) => box.blocksCamera)].map((box) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.width, box.height, box.depth), new THREE.MeshBasicMaterial())
    mesh.position.set(...colliderCenter(box))
    mesh.updateMatrixWorld()
    return mesh
  }), [scene])
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
    /** Default follow view at the spawn point: behind the character (azimuth 0), default polar, default distance. */
    const spawnView = () => {
      const controls = orbit.current
      if (!controls) return
      const target = new THREE.Vector3(SPAWN_POSITION.x, SPAWN_POSITION.y + CAMERA_TARGET_OFFSET_Y, SPAWN_POSITION.z)
      const eye = new THREE.Vector3().setFromSphericalCoords(CAMERA.distance, CAMERA.defaultPolar, 0).add(target)
      controls.setLookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, false)
      scratch.current.preferredPolar = CAMERA.defaultPolar
      scratch.current.swing.active = false
    }
    if (orbit.current) {
      orbit.current.colliderMeshes = cameraColliders
      spawnView()
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
        spawnView()   // RESET POSITION also resets the view: the swing-around never undoes itself
      },
      press: (key, down) => { if (down) keys.current.add(key); else keys.current.delete(key) },
    }
    return () => { actionsRef.current = null; controls?.removeEventListener('controlend', remember) }
  }, [actionsRef, cameraColliders])
  useEffect(() => () => cameraColliders.forEach((mesh) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }), [cameraColliders])
  // Footsteps at real footfalls (cadence from planar speed, grounded only, land on the grounded edge).
  const gait = useRef({ speed: 0, grounded: true, x: 0, z: 0 })
  useFootsteps({ getSpeed: () => gait.current.speed, getGrounded: () => gait.current.grounded, getSurface: () => (isGrass(gait.current.x, gait.current.z) ? 'grass' : 'concrete'), muted: paused })
  useFrame((_, delta) => {
    const actor = body.current
    if (!actor?.body) return
    const held = keys.current
    actor.setMovement({ forward: !paused && (held.has('KeyW') || held.has('ArrowUp')), backward: !paused && (held.has('KeyS') || held.has('ArrowDown')), leftward: !paused && (held.has('KeyA') || held.has('ArrowLeft')), rightward: !paused && (held.has('KeyD') || held.has('ArrowRight')), run: !paused && (held.has('ShiftLeft') || held.has('ShiftRight')), jump: !paused && held.has('Space') })
    const p = actor.body.translation()
    { const v = actor.body.linvel(); gait.current.speed = Math.hypot(v.x, v.z); gait.current.grounded = actor.isOnGround; gait.current.x = p.x; gait.current.z = p.z }
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
      const { target, offset, spherical, probe, raycaster, dir, preferredPolar, swing } = scratch.current
      controls.getTarget(target, false)
      offset.subVectors(camera.position, target)
      camDist = offset.length()
      const obstructed = camDist < CAMERA.minObstructedDistance - 1e-3
      const idle = controls.currentAction === CameraControlsImpl.ACTION.NONE
      /** Free run along an orbit direction (same polar, azimuth offset by `offsetRad`), capped at `maxDistance`. */
      const clearDistance = (offsetRad: number, maxDistance: number, phi = controls.polarAngle) => {
        probe.set(maxDistance, phi, controls.azimuthAngle + offsetRad)
        dir.setFromSpherical(probe).normalize()
        raycaster.set(target, dir)
        raycaster.far = maxDistance + camera.near + 0.05
        const hit = raycaster.intersectObjects(cameraColliders, false)[0]
        return hit ? Math.max(0, hit.distance - camera.near - 0.05) : maxDistance
      }
      if (!idle) swing.active = false   // the player's own drag/wheel always wins; a swing resumes only on a fresh obstruction
      if (idle && (obstructed || swing.active)) {
        // Swing-around: probe azimuths at the preferred distance and rotate toward the smallest clear one (<= 90 deg/s).
        const preferred = preferredDistance(controls)
        const pick = pickCameraSwing((offsetRad) => clearDistance(offsetRad, preferred), preferred, swing.active ? (swing.sign as 1 | -1) : 0)
        if (pick === null) swing.active = false
        else {
          if (!swing.active) { swing.active = true; swing.sign = Math.sign(pick); swing.end = controls.azimuthAngle }
          const goal = controls.azimuthAngle + pick
          const step = CAMERA.swingRate * Math.min(delta, 0.1)
          swing.end = swing.sign > 0 ? Math.min(swing.end + step, goal) : Math.max(swing.end - step, goal)
          controls.rotateAzimuthTo(swing.end, true)
        }
      }
      if (!obstructed && idle && controls.polarAngle < preferredPolar - 1e-3) {
        // Ease back down toward the preferred orbit angle once that direction is clear again (never swing back).
        spherical.setFromVector3(offset)
        spherical.phi = Math.min(preferredPolar, spherical.phi + CAMERA.returnStep)
        if (clearDistance(0, spherical.radius, spherical.phi) >= spherical.radius) controls.rotatePolarTo(spherical.phi, false)
      }
      if (obstructed) {
        // Obstruction pulled the camera into the character: hold >= 1.2 m. While a swing is under way keep the polar
        // angle; only when no probed azimuth is clear look for a higher angle, and never above riseMinPolar.
        spherical.setFromVector3(offset)
        spherical.radius = CAMERA.minObstructedDistance
        if (!swing.active && idle) {
          const startPhi = spherical.phi
          let phi = startPhi
          for (; phi >= CAMERA.riseMinPolar; phi -= CAMERA.raiseStep) if (clearDistance(0, CAMERA.minObstructedDistance, phi) >= CAMERA.minObstructedDistance) break
          spherical.phi = Math.min(startPhi, Math.max(phi, CAMERA.riseMinPolar))
          if (spherical.phi < startPhi - 1e-6) controls.rotatePolarTo(Math.max(CAMERA.riseMinPolar, spherical.phi - CAMERA.raiseStep), true)
        }
        camera.position.setFromSpherical(spherical).add(target)
        camera.lookAt(target)
        camDist = CAMERA.minObstructedDistance
      }
    }
    const canvas = gl.domElement.dataset
    canvas.position = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`
    canvas.character = selected
    canvas.grounded = String(actor.isOnGround)
    canvas.camDist = camDist.toFixed(2)
    if (controls) { canvas.camPolar = controls.polarAngle.toFixed(2); canvas.camAzimuth = controls.azimuthAngle.toFixed(2); canvas.camSwing = String(scratch.current.swing.active) }
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
