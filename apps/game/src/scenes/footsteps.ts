/**
 * Footstep audio driven by actual locomotion, not by key presses.
 *
 * - Cadence follows planar speed: 1.8 steps/s at 2.2 m/s (walk) … 2.8 steps/s at 4.6 m/s (run), linear
 *   in between and clamped outside. Below 0.4 m/s (idle or blocked against a wall) nothing plays.
 * - A step only fires while grounded; the phase does not advance in the air.
 * - A heavier 'land' plays on the grounded false→true edge (after at least 0.12 s airborne).
 * - Steps never stack: a minimum 0.18 s gap between any two sounds.
 * - Global mute: the HUD toggle (runStore.muted) and the `muted` option both silence everything.
 *
 * Sounds: only files already shipped under public/sounds (react-sounds collection, see docs/ASSET_LICENSES.md):
 *   step → ui/keystroke_soft (soft tick, played at 0.25 volume, rate 0.8-1.05; grass lowers rate/volume)
 *   land → ui/button_medium at rate 0.55 (a dull thud). No dedicated footstep/thud samples exist in the
 *   repo; pass a custom `play` to swap in licensed samples later without touching the cadence logic.
 *
 * Integration (CharacterController.tsx, owned by the controller workstream):
 *   const speed = useRef(0), grounded = useRef(true)
 *   useFootsteps({ getSpeed: () => speed.current, getGrounded: () => grounded.current, getSurface: () => isGrass(p.x, p.z) ? 'grass' : 'concrete' })
 *   // in its useFrame after reading the body: const v = actor.body.linvel(); speed.current = Math.hypot(v.x, v.z); grounded.current = actor.isOnGround
 */
import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

export type FootstepKind = 'step' | 'land'
export type FootSurface = 'grass' | 'concrete' | 'wood' | 'soil' | string

export interface FootstepPlayOptions { volume: number; rate: number; surface: FootSurface }

export const FOOTSTEP_SOUNDS: Record<FootstepKind, string> = {
  step: 'ui/keystroke_soft',
  land: 'ui/button_medium',
}

export const WALK = { speed: 2.2, cadence: 1.8 }
export const RUN = { speed: 4.6, cadence: 2.8 }
export const MIN_STEP_SPEED = 0.4
export const MIN_GAP = 0.18
export const MIN_AIR_TIME = 0.12

/** Steps per second for a planar speed; 0 when standing still / blocked. */
export function stepCadence(speed: number) {
  if (!(speed > MIN_STEP_SPEED)) return 0
  const t = (speed - WALK.speed) / (RUN.speed - WALK.speed)
  return WALK.cadence + (RUN.cadence - WALK.cadence) * Math.min(1, Math.max(0, t))
}

export interface FootstepTracker {
  /** Advance by `dt` seconds; returns the sounds that should fire this frame (0, 1 or 2 entries). */
  advance(dt: number, speed: number, grounded: boolean): FootstepKind[]
  /** Current stride phase 0..1 (a step fires when it wraps). */
  readonly phase: number
}

/** Pure state machine; `random` only shapes the first-step offset so two players never sound identical. */
export function createFootstepTracker(random: () => number = Math.random): FootstepTracker {
  let phase = 0.55 + random() * 0.2
  let wasGrounded = true
  let airTime = 0
  let sinceSound = MIN_GAP
  return {
    get phase() { return phase },
    advance(delta, speed, grounded) {
      const dt = Math.min(Math.max(delta, 0), 0.1)
      sinceSound += dt
      const events: FootstepKind[] = []
      if (!grounded) {
        airTime += dt
        wasGrounded = false
        return events
      }
      if (!wasGrounded) {
        wasGrounded = true
        if (airTime >= MIN_AIR_TIME && sinceSound >= MIN_GAP) { events.push('land'); sinceSound = 0 }
        airTime = 0
        phase = 0.35
        return events
      }
      airTime = 0
      const cadence = stepCadence(speed)
      if (cadence === 0) {
        // Standing or blocked: hold the stride so the next real step arrives promptly, not instantly.
        phase = Math.min(phase, 0.6)
        return events
      }
      phase += cadence * dt
      if (phase >= 1) {
        phase -= Math.floor(phase)
        if (sinceSound >= MIN_GAP) { events.push('step'); sinceSound = 0 }
      }
      return events
    },
  }
}

/**
 * Audio dependencies (howler via react-sounds, the HUD mute store) touch `window`/`localStorage` at import
 * time, so they are loaded lazily by the hook; this keeps the cadence logic importable from Node tests.
 */
interface AudioDeps { playSound: typeof import('react-sounds').playSound; isMuted: () => boolean }
let audioDeps: AudioDeps | null = null
let audioLoading: Promise<AudioDeps> | null = null
function loadAudio() {
  audioLoading ??= Promise.all([import('react-sounds'), import('../state/runStore'), import('../state/sfx')])
    .then(([sounds, store]) => { audioDeps = { playSound: sounds.playSound, isMuted: () => store.useRun.getState().muted }; return audioDeps })
  return audioLoading
}

export function defaultFootstepPlayer(kind: FootstepKind, options: FootstepPlayOptions) {
  audioDeps?.playSound(FOOTSTEP_SOUNDS[kind], { volume: options.volume, rate: options.rate }).catch(() => {})
}

/** Volume/rate for a footfall, with slight random variation and a surface flavour. */
export function footstepMix(kind: FootstepKind, surface: FootSurface, random: () => number = Math.random): FootstepPlayOptions {
  const soft = surface === 'grass' || surface === 'soil'
  if (kind === 'land') return { volume: 0.32 * (0.9 + random() * 0.2), rate: (soft ? 0.5 : 0.55) * (0.95 + random() * 0.1), surface }
  return { volume: 0.25 * (soft ? 0.7 : 1) * (0.85 + random() * 0.3), rate: (soft ? 0.8 : 0.95) * (0.94 + random() * 0.12), surface }
}

export interface FootstepOptions {
  /** Planar (xz) speed in m/s. */
  getSpeed: () => number
  getGrounded: () => boolean
  getSurface?: () => FootSurface
  /** Local mute (e.g. paused); the global HUD mute is always respected too. */
  muted?: boolean
  /** Override playback (tests, future licensed samples). */
  play?: (kind: FootstepKind, options: FootstepPlayOptions) => void
}

/** Mount inside the Canvas next to the character controller. */
export function useFootsteps({ getSpeed, getGrounded, getSurface, muted = false, play = defaultFootstepPlayer }: FootstepOptions) {
  const tracker = useRef<FootstepTracker | null>(null)
  if (tracker.current === null) tracker.current = createFootstepTracker()
  const latest = useRef({ getSpeed, getGrounded, getSurface, muted, play })
  useEffect(() => { latest.current = { getSpeed, getGrounded, getSurface, muted, play } }, [getSpeed, getGrounded, getSurface, muted, play])
  useEffect(() => { loadAudio().catch(() => {}) }, [])
  useFrame((_, delta) => {
    const current = latest.current
    const events = tracker.current!.advance(delta, current.getSpeed(), current.getGrounded())
    // Until the audio modules are loaded the global mute state is unknown: stay silent.
    if (events.length === 0 || current.muted || !audioDeps || audioDeps.isMuted()) return
    if (typeof document !== 'undefined' && document.hidden) return
    const surface = current.getSurface?.() ?? 'concrete'
    for (const kind of events) current.play(kind, footstepMix(kind, surface))
  })
}
