import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useReducedMotion } from 'framer-motion'
import { ThirdPersonWorld } from './ThirdPersonWorld'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useGame } from '../state/gameStore'
import { BigButton } from '../components/ui'
import type { FounderId, SceneId } from '../state/types'
import type { Mood } from '../components/World'
import type { PlayerActions } from '../characters/CharacterController'
import { CHARACTERS, type CharacterId } from '../characters/CharacterCustomization'

export function ImmersiveWorld({ scene, mood = 'idle', active, children }: { scene: SceneId | 'devin'; mood?: Mood; active?: FounderId; children?: ReactNode }) {
  const screen = useGame((state) => state.screen)
  const forced = screen === 'ending' || screen === 'result' || scene === 'devin'
  const [story, setStory] = useState(false)
  const [inactive, setInactive] = useState(false)
  const [selected, setSelected] = useState<CharacterId>('sergio')
  const controls = useRef<PlayerActions | null>(null)
  const reduced = !!useReducedMotion()
  const paused = forced || story || inactive
  const button = '!px-4 !py-2 !text-xs !tracking-normal !bg-panel !text-mint border border-line'
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input,textarea,select,[contenteditable="true"]')) return
      if (!forced && (event.code === 'KeyF' || event.code === 'Escape')) { event.preventDefault(); setStory((open) => !open) }
    }
    const blur = () => setInactive(true)
    const focus = () => setInactive(false)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', blur)
    window.addEventListener('focus', focus)
    return () => { window.removeEventListener('keydown', key); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus) }
  }, [forced])
  return <section className="relative h-full min-h-0 flex-1 overflow-hidden bg-ink" aria-label="Third-person world" data-world="third-person" data-story-open={forced || story}>
    <ErrorBoundary label="Third-person world" fallback={<section className="absolute inset-0 bg-panel p-8"><p role="alert">The third-person world could not load.</p><a className="text-mint underline" href="?world=legacy">Open the previous renderer</a><BigButton onClick={() => setStory(true)}>KEEP PLAYING THE STORY</BigButton></section>}>
      <ThirdPersonWorld scene={scene} mood={mood} active={active} selected={selected} actionsRef={controls} paused={paused} reducedMotion={reduced} />
    </ErrorBoundary>
    {!forced && <header className="absolute inset-x-3 top-3 z-20 flex flex-wrap items-start justify-between gap-2 pointer-events-none">
      <section className="rounded-xl bg-panel/90 p-3"><img src="/assets/branding/cognition-light.png" alt="Cognition" className="h-5 w-auto" /><p className="mt-2 text-xs text-mint">RUNWAY · THIRD PERSON</p></section>
      <nav className="flex flex-wrap gap-2 pointer-events-auto" aria-label="Third-person controls">
        <label className="rounded border border-line bg-panel p-2 text-xs">Character <select aria-label="Character appearance" value={selected} onChange={(event) => setSelected(event.target.value as CharacterId)} className="bg-panel text-mint">{CHARACTERS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <BigButton className={button} onClick={() => controls.current?.reset()}>RESET POSITION</BigButton>
        <BigButton className={button} onClick={() => setStory((open) => !open)}>{story ? 'BACK TO WORLD' : 'TALK TO FOUNDERS · F'}</BigButton>
      </nav>
    </header>}
    {!paused && <aside className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-panel/90 px-4 py-3 text-center text-xs">
      <p>WASD / arrows · Shift run · Space jump · drag to orbit · scroll zoom · F story · E grass</p>
      <nav className="world-touch" aria-label="Third-person touch controls">{([['KeyW', 'Forward'], ['KeyA', 'Left'], ['KeyS', 'Back'], ['KeyD', 'Right'], ['Space', 'Jump']] as const).map(([key, label]) => <BigButton key={key} className={button} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); controls.current?.press(key, true) }} onPointerUp={() => controls.current?.press(key, false)} onPointerCancel={() => controls.current?.press(key, false)} onLostPointerCapture={() => controls.current?.press(key, false)}>{label}</BigButton>)}</nav>
    </aside>}
    {inactive && !forced && <button className="absolute inset-0 z-30 bg-ink/60 text-white" onClick={() => setInactive(false)}>PAUSED · CLICK TO CONTINUE</button>}
    <section hidden={!forced && !story} inert={!forced && !story} aria-label="Story interaction" className="absolute inset-0 z-10 flex flex-col items-center justify-end gap-4 px-3 pb-4 pt-20 pointer-events-none [&>*]:pointer-events-auto [&>*]:max-h-full [&>*]:overflow-y-auto">{children}</section>
  </section>
}
