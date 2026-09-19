import { motion, useReducedMotion } from 'framer-motion'
import { lazy, Suspense, useRef, useState } from 'react'
import type { FounderId, SceneId } from '../state/types'
import { FirstPersonWorld, type FirstPersonHandle } from '../scenes/FirstPersonWorld'
import { ErrorBoundary } from './ErrorBoundary'
import { BigButton } from './ui'
const ImmersiveWorld = lazy(() => import('../world/ImmersiveWorld').then((module) => ({ default: module.ImmersiveWorld })))

export type Mood = 'idle' | 'alarm' | 'win' | 'lose' | 'devin'

const SIGN: Record<SceneId | 'devin', string> = {
  S1: 'PUZL COWORKING · OBUDA · COGNITION × DEVIN HACKATHON',
  S2: 'DEBRECEN · 2-ROOM APARTMENT',
  S3: 'ACCELERATOR · INVESTOR ROOM',
  devin: 'MISSION CONTROL',
}

const TINT: Record<Mood, string> = {
  idle: 'rgba(0,0,0,0)',
  alarm: 'rgba(255,90,95,0.18)',
  win: 'rgba(45,212,191,0.12)',
  lose: 'rgba(10,10,15,0.45)',
  devin: 'rgba(124,156,255,0.08)',
}

/** 3D world (R3F) + DOM overlay. Children render on top of the canvas. */
function LegacyWorld({ scene, mood = 'idle', active, shake, children, onSwitchView }: { scene: SceneId | 'devin'; mood?: Mood; active?: FounderId; shake?: boolean; children?: React.ReactNode; onSwitchView: () => void }) {
  const controls = useRef<FirstPersonHandle | null>(null)
  const hint = useRef<HTMLOutputElement | null>(null)
  const [exploring, setExploring] = useState(false)
  const [controlError, setControlError] = useState('')
  const reducedMotion = !!useReducedMotion()
  const canExplore = scene !== 'devin'
  const controlClass = '!px-4 !py-2 !text-xs !tracking-normal !bg-panel !text-mint border border-line focus-visible:ring-2 focus-visible:ring-mint'

  return (
    <div className="relative h-full flex-1 min-h-0 overflow-hidden bg-ink" data-world="first-person" data-exploring={exploring}>
      <ErrorBoundary key={scene} label="FirstPersonWorld" fallback={<section className="absolute inset-0 bg-panel p-8"><p role="alert">The 3D world could not start. Your story is still playable below. Reload to retry graphics.</p></section>}>
        <FirstPersonWorld scene={scene} mood={mood} active={active} controlsRef={controls} hintRef={hint} onExploreChange={setExploring} onControlError={setControlError} reducedMotion={reducedMotion} />
      </ErrorBoundary>
      <motion.div className="absolute inset-0 pointer-events-none" animate={{ background: TINT[mood] }} transition={{ duration: 0.6 }} />
      {mood === 'alarm' && <motion.div className="absolute inset-0 pointer-events-none bg-[#FF5A5F]/20" animate={{ opacity: reducedMotion ? 0.1 : [0.1, 0.3, 0.1] }} transition={{ repeat: Infinity, duration: 1 }} />}
      <div className={`absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink to-transparent pointer-events-none ${exploring ? 'invisible' : ''}`} />
      {canExplore && <aside className="absolute top-4 left-4 right-4 z-10 pointer-events-none" aria-label="World controls">
        <header className="world-toolbar">
          <section className="world-location">
            <p className="text-mint text-xs uppercase tracking-widest">RUNWAY / FIRST PERSON</p>
            <p className="text-xs mt-1">{SIGN[scene]}</p>
          </section>
          <nav className="world-actions pointer-events-auto" aria-label="Exploration">
            <BigButton className={controlClass} onClick={() => { controls.current?.exit(); onSwitchView() }}>THIRD-PERSON VIEW</BigButton>
            {exploring ? <>
              <BigButton className={controlClass} onClick={() => controls.current?.reset()}>RESET POSITION</BigButton>
              <BigButton className={controlClass} onClick={() => controls.current?.exit()}>BACK TO STORY · F / ESC</BigButton>
            </> : <>
              <BigButton className={controlClass} onClick={() => controls.current?.enter()}>EXPLORE IN FIRST PERSON</BigButton>
              <BigButton className={controlClass} onClick={() => controls.current?.enter(false)}>DRAG-TO-LOOK MODE</BigButton>
            </>}
          </nav>
        </header>
        {controlError && <p role="alert" className="world-note pointer-events-auto">{controlError}</p>}
        {!exploring && <p className="world-note">A real place to take a break. Walk outside, look down, brush the grass.</p>}
      </aside>}
      {exploring && <>
        <span className="world-reticle" aria-hidden="true" />
        <aside className="world-help" aria-label="First-person instructions">
          <output ref={hint} className="block text-mint text-sm" aria-live="off">Step off the path, look down, hold E.</output>
          <p className="text-xs mt-2">WASD / arrows · mouse or drag to look · C crouch · hold E to touch · F / Esc story</p>
          <nav className="world-touch" aria-label="Touch movement controls">
            {([['KeyW', 'Forward'], ['KeyA', 'Left'], ['KeyS', 'Back'], ['KeyD', 'Right'], ['KeyC', 'Crouch'], ['KeyE', 'Touch grass']] as const).map(([key, label]) => <BigButton
              key={key}
              className={controlClass}
              aria-label={label}
              onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); controls.current?.press(key, true) }}
              onPointerUp={() => controls.current?.press(key, false)}
              onPointerCancel={() => controls.current?.press(key, false)}
              onLostPointerCapture={() => controls.current?.press(key, false)}
            >{label}</BigButton>)}
          </nav>
        </aside>
      </>}
      <div inert={exploring} aria-hidden={exploring} className={`${canExplore ? 'world-story' : ''} relative h-full flex flex-col items-center justify-end pb-6 gap-6 px-6 pointer-events-none [&>*]:pointer-events-auto ${exploring ? 'invisible' : ''}`} data-incident={shake || undefined}>{children}</div>
    </div>
  )
}

export function World(props: { scene: SceneId | 'devin'; mood?: Mood; active?: FounderId; shake?: boolean; children?: React.ReactNode }) {
  const [firstPerson, setFirstPerson] = useState(() => ['legacy', 'first-person'].includes(new URLSearchParams(window.location.search).get('world') ?? ''))
  const switchView = () => {
    const next = !firstPerson
    const url = new URL(window.location.href)
    url.searchParams.set('world', next ? 'first-person' : 'third-person')
    window.history.replaceState(window.history.state, '', url)
    setFirstPerson(next)
  }
  return firstPerson ? <LegacyWorld {...props} onSwitchView={switchView} /> : <Suspense fallback={<section className="h-full bg-panel p-8 text-mint">Loading third-person world…</section>}><ImmersiveWorld {...props} onSwitchView={switchView} /></Suspense>
}
