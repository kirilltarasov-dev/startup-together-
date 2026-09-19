import { Ecctrl, type EcctrlHandle } from 'ecctrl'
import { EcctrlCameraControls, type EcctrlCameraControlsHandle } from 'ecctrl/camera'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { CharacterModel } from './CharacterModel'
import type { CharacterId } from './CharacterCustomization'
import type { GrassInteraction } from '../scenes/InteractiveGrass'
import { SCENE_COLLIDERS } from '../engine/firstPerson'

export interface PlayerActions { reset: () => void; press: (key: string, down: boolean) => void }

export function CharacterController({ selected, paused, actionsRef, interaction }: { selected: CharacterId; paused: boolean; actionsRef: RefObject<PlayerActions | null>; interaction: RefObject<GrassInteraction> }) {
  const body = useRef<EcctrlHandle>(null)
  const orbit = useRef<EcctrlCameraControlsHandle>(null)
  const keys = useRef(new Set<string>())
  const { gl } = useThree()
  const cameraColliders = useMemo(() => SCENE_COLLIDERS.map((box) => {
    const height = box.width >= 11 || box.depth >= 7 || box.z === 0 ? 3.8 : 1
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(box.width, height, box.depth), new THREE.MeshBasicMaterial())
    mesh.position.set(box.x, height / 2, box.z)
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
      orbit.current.setLookAt(0, 3, 4.5, 0, 1, -0.5, false)
    }
    actionsRef.current = {
      reset: () => { body.current?.body?.setTranslation({ x: 0, y: 1.1, z: -0.5 }, true); body.current?.body.setLinvel({ x: 0, y: 0, z: 0 }, true); keys.current.clear() },
      press: (key, down) => { if (down) keys.current.add(key); else keys.current.delete(key) },
    }
    return () => { actionsRef.current = null }
  }, [actionsRef, cameraColliders])
  useEffect(() => () => cameraColliders.forEach((mesh) => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }), [cameraColliders])
  useFrame((_, delta) => {
    const actor = body.current
    if (!actor?.body) return
    const held = keys.current
    actor.setMovement({ forward: !paused && (held.has('KeyW') || held.has('ArrowUp')), backward: !paused && (held.has('KeyS') || held.has('ArrowDown')), leftward: !paused && (held.has('KeyA') || held.has('ArrowLeft')), rightward: !paused && (held.has('KeyD') || held.has('ArrowRight')), run: !paused && (held.has('ShiftLeft') || held.has('ShiftRight')), jump: !paused && held.has('Space') })
    const p = actor.body.translation()
    orbit.current?.moveTo(p.x, p.y + 0.45, p.z, true)
    interaction.current.player.set(p.x, p.z)
    interaction.current.brush.set(p.x, p.z)
    interaction.current.brushing = !paused && held.has('KeyE')
    interaction.current.strength = THREE.MathUtils.damp(interaction.current.strength, interaction.current.brushing ? 1 : 0, 5, delta)
    if (p.y < -4) actionsRef.current?.reset()
    gl.domElement.dataset.position = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`
    gl.domElement.dataset.character = selected
    gl.domElement.dataset.grounded = String(actor.isOnGround)
  })
  return <>
    <Ecctrl ref={body} position={[0, 1.1, -0.5]} capsuleHalfHeight={0.45} capsuleRadius={0.3} floatHeight={0.15} maxWalkVel={2.7} maxRunVel={4.5} jumpVel={4} enable={!paused} followPlatform={false}>
      <CharacterModel selected={selected} controller={body} paused={paused} />
    </Ecctrl>
    <EcctrlCameraControls ref={orbit} makeDefault smoothTime={0.12} minDistance={1.2} maxDistance={6} minPolarAngle={0.25} maxPolarAngle={1.65} enabled={!paused} />
  </>
}
