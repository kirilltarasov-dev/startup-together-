import { Canvas } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Environment, Html, Sky } from '@react-three/drei'
import { Suspense, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { FounderId, SceneId } from '../state/types'
import type { Mood } from '../components/World'
import { SceneEnvironment } from '../scenes/SceneEnvironment'
import { InteractiveGrass, type GrassInteraction } from '../scenes/InteractiveGrass'
import { Birds } from '../scenes/Birds'
import { MATERIAL as M } from '../scenes/sceneMaterials'
import { CharacterController, type PlayerActions } from '../characters/CharacterController'
import type { CharacterId } from '../characters/CharacterCustomization'
import { WorldColliders } from './WorldColliders'
import { CognitionSign } from './CognitionSign'

export function ThirdPersonWorld({ scene, mood, active, paused, actionsRef, selected, reducedMotion }: { scene: SceneId | 'devin'; mood: Mood; active?: FounderId; paused: boolean; actionsRef: RefObject<PlayerActions | null>; selected: CharacterId; reducedMotion: boolean }) {
  const interaction = useRef<GrassInteraction>({ player: new THREE.Vector2(0, -0.5), brush: new THREE.Vector2(0, -0.5), strength: 0, brushing: false })
  return <Canvas shadows="soft" dpr={[1, 1.5]} camera={{ position: [0, 3, 4.5], fov: 55, near: 0.1, far: 90 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }} style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
    <color attach="background" args={[M.sky]} />
    <fog attach="fog" args={[M.fog, 24, 75]} />
    <Sky sunPosition={[-9, 9, 5]} turbidity={3.5} rayleigh={1.1} />
    <hemisphereLight args={[M.ambient, M.ground, 0.55]} />
    <directionalLight position={[-7, 10, 6]} color={M.sun} intensity={2.4} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} shadow-normalBias={0.025} />
    <Suspense fallback={null}><Environment files="/assets/environment/courtyard.hdr" environmentIntensity={0.7} /></Suspense>
    <SceneEnvironment scene={scene} mood={mood} active={active} reducedMotion={reducedMotion} />
    <InteractiveGrass interactionRef={interaction} reducedMotion={reducedMotion} />
    <Birds visible={scene !== 'S2'} reducedMotion={reducedMotion} />
    <Suspense fallback={null}><CognitionSign /></Suspense>
    <Suspense fallback={<Html center><p className="rounded bg-panel p-4 text-white">Loading physics and character…</p></Html>}>
      <Physics timeStep={1 / 60} paused={paused}>
        <WorldColliders />
        <CharacterController selected={selected} paused={paused} actionsRef={actionsRef} interaction={interaction} />
      </Physics>
    </Suspense>
  </Canvas>
}
