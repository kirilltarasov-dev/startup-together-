import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer, Sky } from '@react-three/drei'
import { Suspense, useEffect, useImperativeHandle, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js'
import type { FounderId, SceneId } from '../state/types'
import type { Mood } from '../components/World'
import { grassTarget, isGrass, movePlayer } from '../engine/firstPerson'
import { InteractiveGrass, type GrassInteraction } from './InteractiveGrass'
import { Birds } from './Birds'
import { SceneEnvironment } from './SceneEnvironment'
import { MATERIAL as M } from './sceneMaterials'
import { CourtyardLighting } from './EnvironmentAssets'
import { ErrorBoundary } from '../components/ErrorBoundary'

export interface FirstPersonHandle {
  enter: (lock?: boolean) => void
  exit: () => void
  reset: () => void
  press: (key: string, down: boolean) => void
}

interface ControllerProps {
  controlsRef: RefObject<FirstPersonHandle | null>
  interactionRef: RefObject<GrassInteraction>
  hintRef: RefObject<HTMLOutputElement | null>
  onExploreChange: (active: boolean) => void
  onControlError: (message: string) => void
  reducedMotion: boolean
}

function Player({ controlsRef, interactionRef, hintRef, onExploreChange, onControlError, reducedMotion }: ControllerProps) {
  const { camera, gl } = useThree()
  const controls = useRef<PointerLockControls | null>(null)
  const enabled = useRef(false)
  const keys = useRef(new Set<string>())
  const brushHeld = useRef(false)
  const dragging = useRef<{ id: number; x: number; y: number } | null>(null)
  const direction = useMemo(() => new THREE.Vector3(), [])
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const hand = useRef<THREE.Group>(null)
  const walkPhase = useRef(0)
  const hudTime = useRef(0)

  useEffect(() => {
    camera.position.set(0, 1.65, 5.2)
    camera.lookAt(0, 1.4, -5)
    const control = new PointerLockControls(camera, gl.domElement)
    control.minPolarAngle = 0.12
    control.maxPolarAngle = Math.PI - 0.12
    controls.current = control
    const clearInput = () => { keys.current.clear(); brushHeld.current = false; dragging.current = null }
    const lock = () => { enabled.current = true; onExploreChange(true); onControlError('') }
    const unlock = () => { enabled.current = false; clearInput(); onExploreChange(false) }
    const pause = () => { control.unlock(); unlock() }
    const visibility = () => { if (document.hidden) pause() }
    const keyDown = (event: KeyboardEvent) => {
      if ((event.code === 'Escape' || event.code === 'KeyF') && (enabled.current || document.pointerLockElement === gl.domElement)) {
        event.preventDefault()
        pause()
        return
      }
      if (!enabled.current || (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]'))) return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyC', 'KeyE'].includes(event.code)) event.preventDefault()
      keys.current.add(event.code)
    }
    const keyUp = (event: KeyboardEvent) => { keys.current.delete(event.code) }
    const pointerDown = (event: PointerEvent) => {
      if (!enabled.current || event.button !== 0) return
      if (control.isLocked) brushHeld.current = true
      else {
        dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
        gl.domElement.setPointerCapture(event.pointerId)
      }
    }
    const pointerMove = (event: PointerEvent) => {
      const drag = dragging.current
      if (!enabled.current || control.isLocked || !drag || drag.id !== event.pointerId) return
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= (event.clientX - drag.x) * 0.004
      euler.x = THREE.MathUtils.clamp(euler.x - (event.clientY - drag.y) * 0.004, -1.45, 1.45)
      camera.quaternion.setFromEuler(euler)
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const pointerUp = () => { brushHeld.current = false; dragging.current = null }
    control.addEventListener('lock', lock)
    control.addEventListener('unlock', unlock)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility)
    gl.domElement.addEventListener('pointerdown', pointerDown)
    gl.domElement.addEventListener('pointermove', pointerMove)
    window.addEventListener('pointerup', pointerUp)
    window.addEventListener('pointercancel', pointerUp)
    return () => {
      enabled.current = false
      clearInput()
      control.removeEventListener('lock', lock)
      control.removeEventListener('unlock', unlock)
      if (control.isLocked) control.unlock()
      control.dispose()
      controls.current = null
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', pause)
      document.removeEventListener('visibilitychange', visibility)
      gl.domElement.removeEventListener('pointerdown', pointerDown)
      gl.domElement.removeEventListener('pointermove', pointerMove)
      window.removeEventListener('pointerup', pointerUp)
      window.removeEventListener('pointercancel', pointerUp)
    }
  }, [camera, gl, euler, onExploreChange, onControlError])

  useImperativeHandle(controlsRef, () => ({
    enter: (lock = true) => {
      if (!lock) { enabled.current = true; onExploreChange(true); onControlError(''); return }
      if (!gl.domElement.requestPointerLock) { onControlError('Mouse capture is unavailable. Use drag-to-look below.'); return }
      try {
        const result = gl.domElement.requestPointerLock()
        result?.catch(() => onControlError('Mouse capture was declined. Try again or use drag-to-look.'))
      } catch { onControlError('Mouse capture is unavailable. Use drag-to-look below.') }
    },
    exit: () => {
      enabled.current = false
      keys.current.clear()
      brushHeld.current = false
      controls.current?.unlock()
      onExploreChange(false)
    },
    reset: () => {
      camera.position.set(0, 1.65, 5.2)
      camera.lookAt(0, 1.4, -5)
      keys.current.clear()
      brushHeld.current = false
      interactionRef.current.strength = 0
    },
    press: (key, down) => { if (down) keys.current.add(key); else keys.current.delete(key) },
  }), [camera, gl, interactionRef, onExploreChange, onControlError])

  useFrame(({ camera, clock, gl }, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05)
    const input = keys.current
    const crouching = enabled.current && input.has('KeyC')
    let moving = false
    if (enabled.current) {
      euler.setFromQuaternion(camera.quaternion)
      const sideways = Number(input.has('KeyD') || input.has('ArrowRight')) - Number(input.has('KeyA') || input.has('ArrowLeft'))
      const forward = Number(input.has('KeyS') || input.has('ArrowDown')) - Number(input.has('KeyW') || input.has('ArrowUp'))
      const next = movePlayer(camera.position, sideways, forward, euler.y, delta, crouching ? 1.3 : input.has('ShiftLeft') || input.has('ShiftRight') ? 3.8 : 2.7)
      moving = Math.hypot(next.x - camera.position.x, next.z - camera.position.z) > 0.001
      camera.position.set(next.x, camera.position.y, next.z)
    }
    walkPhase.current += moving ? delta * 9 : 0
    const bob = !reducedMotion && moving ? Math.sin(walkPhase.current) * 0.016 : 0
    camera.position.y = THREE.MathUtils.damp(camera.position.y, (crouching ? 0.95 : 1.65) + bob, 12, delta)
    interactionRef.current.player.set(camera.position.x, camera.position.z)
    camera.getWorldDirection(direction)
    const target = enabled.current ? grassTarget(camera.position, direction) : null
    const brushing = !!target && (input.has('KeyE') || brushHeld.current)
    interactionRef.current.brushing = brushing
    if (brushing) interactionRef.current.brush.set(target.x, target.z)
    interactionRef.current.strength = THREE.MathUtils.damp(interactionRef.current.strength, brushing ? 1 : 0, brushing ? 12 : 3, delta)
    if (hand.current) {
      hand.current.visible = interactionRef.current.strength > 0.01
      hand.current.position.copy(camera.position)
      hand.current.quaternion.copy(camera.quaternion)
      hand.current.scale.setScalar(interactionRef.current.strength)
      const palm = hand.current.children[0]
      if (palm) palm.rotation.z = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 4) * 0.12
    }
    hudTime.current += delta
    if (hudTime.current > 0.12 && hintRef.current) {
      hudTime.current = 0
      const zone = camera.position.z < 0 ? 'THE WORKSPACE' : isGrass(camera.position.x, camera.position.z) ? 'IN THE GRASS' : 'THE COURTYARD'
      hintRef.current.textContent = brushing ? 'BRUSHING GRASS · release to let it spring back' : target ? 'HOLD E OR CLICK · brush the grass' : `${zone} · ${camera.position.z < 0 ? 'F to talk to your founders' : 'step off the path, look down, hold E'}`
      hintRef.current.dataset.zone = zone
      hintRef.current.dataset.brushing = String(brushing)
      gl.domElement.dataset.position = `${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}`
    }
  })

  return <group ref={hand} visible={false}>
    <group position={[0.25, -0.24, -0.6]} rotation={[-0.5, -0.2, -0.15]}>
      <mesh position={[0.015, -0.12, 0.08]} rotation={[0.5, 0, 0]}><capsuleGeometry args={[0.05, 0.25, 5, 10]} /><meshStandardMaterial color={M.trouser} roughness={0.9} /></mesh>
      <mesh scale={[0.075, 0.025, 0.105]}><sphereGeometry args={[1, 12, 10]} /><meshStandardMaterial color={M.skin} roughness={0.8} /></mesh>
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[-0.05 + i * 0.031, 0, -0.1]} rotation={[Math.PI / 2, 0, (i - 1.5) * 0.09]}><capsuleGeometry args={[0.013, 0.105 - Math.abs(i - 1.5) * 0.017, 4, 8]} /><meshStandardMaterial color={M.skin} roughness={0.8} /></mesh>)}
      <mesh position={[0.077, 0, -0.015]} rotation={[0.9, 0, -0.7]}><capsuleGeometry args={[0.018, 0.055, 4, 8]} /><meshStandardMaterial color={M.skin} roughness={0.8} /></mesh>
    </group>
  </group>
}

export function FirstPersonWorld({ scene, mood, active, controlsRef, hintRef, onExploreChange, onControlError, reducedMotion }: Omit<ControllerProps, 'interactionRef'> & { scene: SceneId | 'devin'; mood: Mood; active?: FounderId }) {
  const interactionRef = useRef<GrassInteraction>({ player: new THREE.Vector2(0, 5.2), brush: new THREE.Vector2(0, 5.2), strength: 0, brushing: false })
  const fallbackLighting = <Environment resolution={64} frames={1}>
    <Lightformer form="rect" intensity={1.4} color={M.ambient} scale={[30, 30, 1]} position={[0, 15, 0]} rotation={[Math.PI / 2, 0, 0]} />
    <Lightformer form="rect" intensity={2} color={M.sun} scale={[12, 12, 1]} position={[-10, 8, 8]} target={[0, 0, 0]} />
  </Environment>
  return <Canvas
    shadows="soft"
    dpr={[1, 1.5]}
    camera={{ position: [0, 1.65, 5.2], fov: 68, near: 0.05, far: 100 }}
    gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
    style={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    fallback={<p role="alert">3D requires WebGL. Try a hardware-accelerated browser; the story remains playable.</p>}
  >
    <color attach="background" args={[M.sky]} />
    <fog attach="fog" args={[M.fog, 24, 75]} />
    <Sky distance={450000} sunPosition={[-9, 9, 5]} inclination={0.5} azimuth={0.25} turbidity={3.5} rayleigh={1.1} />
    <hemisphereLight args={[M.ambient, M.ground, 0.55]} />
    <directionalLight position={[-7, 10, 6]} color={M.sun} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-camera-near={0.5} shadow-camera-far={45} shadow-bias={-0.0003} shadow-normalBias={0.025} />
    <ErrorBoundary label="Courtyard lighting" fallback={fallbackLighting}><Suspense fallback={fallbackLighting}><CourtyardLighting /></Suspense></ErrorBoundary>
    <SceneEnvironment scene={scene} mood={mood} active={active} reducedMotion={reducedMotion} />
    <InteractiveGrass interactionRef={interactionRef} reducedMotion={reducedMotion} />
    <Birds visible={scene !== 'S2'} reducedMotion={reducedMotion} />
    <Player controlsRef={controlsRef} interactionRef={interactionRef} hintRef={hintRef} onExploreChange={onExploreChange} onControlError={onControlError} reducedMotion={reducedMotion} />
  </Canvas>
}
