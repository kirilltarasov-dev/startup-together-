import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { AnimationMixer, Bone, LoopOnce, LoopRepeat, MathUtils, Quaternion, Vector3, type AnimationAction, type AnimationClip, type Object3D } from 'three'
import type { EcctrlHandle } from 'ecctrl'
import { DEFAULT_RULES, LocomotionMachine, type LocomotionState } from './locomotionState'
import { LOCOMOTION, WALK_CLIP } from './playerBody'

/**
 * Locomotion animator: idle | walk | run | jump_takeoff | airborne | land driven by controller evidence
 * (planar speed, grounded flag, vertical velocity, run modifier), see locomotionState.ts.
 *
 * Blending: every action stays active and its weight is moved toward a per-state target over a fixed fade duration
 * (0.12-0.22 s). This is a manual crossfade instead of AnimationAction.crossFadeTo/warp because fadeOut() stops the
 * action at weight 0, which fights the continuous speed-driven idle<->walk blend; walk->run is phase-locked instead.
 *
 * Fallbacks (flagged on the canvas dataset): no run clip -> walk clip at speed-matched rate (usingWalkAsRunFallback);
 * no jump/fall clip -> the walk clip frozen at its mid-stride pose (airbornePoseFallback); no land clip -> 220 ms
 * crossfade back to locomotion plus a small procedural knee-dip on the model root.
 */
type Slot = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'land' | 'face'
const SLOT_PATTERNS: Record<Slot, RegExp> = { idle: /^idle/i, walk: /walk/i, run: /^run/i, jump: /jump/i, fall: /fall/i, land: /land/i, face: /blink|face/i }
const FADE = { locomotion: 0.18, takeoff: 0.12, land: 0.22 }
const WALK_TIMESCALE: [number, number] = [0.6, 1.6]
const RUN_FALLBACK_TIMESCALE: [number, number] = [0.6, 1.9]
const LAND_DIP = { depth: -0.03, duration: 0.2 }
const BREATH = { hz: 0.25, degrees: 1 }
const BLINK_INTERVAL: [number, number] = [3, 6]
const WEIGHTED = ['idle', 'walk', 'run', 'jump', 'fall', 'land', 'pose'] as const

interface Rig {
  slots: Partial<Record<Slot, AnimationClip>>
  idle: AnimationAction | null
  walk: AnimationAction | null
  run: AnimationAction | null
  jump: AnimationAction | null
  fall: AnimationAction | null
  land: AnimationAction | null
  /** Walk clip frozen at its mid-stride (double-support) pose: airborne fallback when no jump/fall clip exists. */
  pose: AnimationAction | null
  face: AnimationAction | null
  spine: Bone | null
  toes: Bone[]
  all: AnimationAction[]
  machine: LocomotionMachine
  usingWalkAsRunFallback: boolean
  airbornePoseFallback: boolean
}

function resolveSlot(clips: AnimationClip[], slot: Slot) {
  return clips.find((clip) => clip.userData?.slot === slot) ?? clips.find((clip) => !clip.userData?.slot && SLOT_PATTERNS[slot].test(clip.name) && !/talk/i.test(clip.name))
}

function buildRig(mixer: AnimationMixer, model: Object3D, clips: AnimationClip[]): Rig {
  const slots: Partial<Record<Slot, AnimationClip>> = {}
  for (const slot of Object.keys(SLOT_PATTERNS) as Slot[]) { const clip = resolveSlot(clips, slot); if (clip) slots[slot] = clip }
  const all: AnimationAction[] = []
  const loop = (clip: AnimationClip | undefined) => {
    if (!clip) return null
    const action = mixer.clipAction(clip)
    action.setLoop(LoopRepeat, Infinity).setEffectiveWeight(0).play()
    all.push(action)
    return action
  }
  const once = (clip: AnimationClip | undefined, clamp: boolean) => {
    if (!clip) return null
    const action = mixer.clipAction(clip)
    action.setLoop(LoopOnce, 1).setEffectiveWeight(0)
    action.clampWhenFinished = clamp
    all.push(action)
    return action
  }
  const idle = loop(slots.idle), walk = loop(slots.walk), run = loop(slots.run), fall = loop(slots.fall)
  const jump = once(slots.jump, true), land = once(slots.land, true), face = once(slots.face, false)
  let pose: AnimationAction | null = null
  if (slots.walk && !(slots.fall && slots.jump)) {
    const frozen = slots.walk.clone()
    frozen.name = 'fallback:airborne-pose'
    pose = mixer.clipAction(frozen)
    pose.setEffectiveWeight(0).play()
    pose.time = slots.walk.name === 'Walk' ? WALK_CLIP.midStrideTime : slots.walk.duration * 0.3
    pose.setEffectiveTimeScale(0)
    all.push(pose)
  }
  if (idle) idle.setEffectiveWeight(1)
  let spine: Bone | null = null
  const toes: Bone[] = []
  model.traverse((object) => {
    if (!(object instanceof Bone)) return
    if (!spine && /spine1$/i.test(object.name)) spine = object
    if (/toebase$/i.test(object.name)) toes.push(object)
  })
  const machine = new LocomotionMachine({ ...DEFAULT_RULES, walkThreshold: LOCOMOTION.walkThreshold, runThreshold: LOCOMOTION.runThreshold, landDuration: slots.land ? Math.min(slots.land.duration, 0.6) : DEFAULT_RULES.landDuration })
  return { slots, idle, walk, run, jump, fall, land, pose, face, spine, toes, all, machine, usingWalkAsRunFallback: !run, airbornePoseFallback: !fall }
}

const approach = (value: number, target: number, step: number) => value < target ? Math.min(target, value + step) : Math.max(target, value - step)

export function CharacterAnimator({ model, clips, controller, paused }: { model: Object3D; clips: AnimationClip[]; controller: RefObject<EcctrlHandle | null>; paused: boolean }) {
  const { gl } = useThree()
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const reducedMotion = useMemo(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const rigRef = useRef<Rig | null>(null)
  // Imperative handles mutated per frame (canvas dataset for tests/debug, model root for the landing dip).
  const runtime = useRef({ fade: FADE.locomotion, landedAt: -1, elapsed: 0, nextBlink: 4, breath: new Quaternion(), lastAnim: '' as LocomotionState | '', canvas: null as HTMLCanvasElement | null, root: null as Object3D | null, frame: 0, probe: new Vector3() })
  useEffect(() => { runtime.current.canvas = gl.domElement; runtime.current.root = model }, [gl, model])
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(model) }, [mixer, model])
  // Build inside the effect (not useMemo) so the previous rig is torn down before the next one reuses cached actions.
  useEffect(() => {
    const rig = buildRig(mixer, model, clips)
    rigRef.current = rig
    const handle = runtime.current
    if (handle.canvas) {
      handle.canvas.dataset.usingWalkAsRunFallback = String(rig.usingWalkAsRunFallback)
      handle.canvas.dataset.airbornePoseFallback = String(rig.airbornePoseFallback)
      handle.canvas.dataset.clipSlots = Object.keys(rig.slots).join(',')
    }
    return () => {
      rigRef.current = null
      rig.all.forEach((action) => action.stop())
      rig.all.forEach((action) => mixer.uncacheClip(action.getClip()))
    }
  }, [mixer, model, clips])

  useFrame((_, frameDelta) => {
    const delta = Math.min(frameDelta, 0.05)
    const rig = rigRef.current
    const run = runtime.current
    if (!rig) return
    if (paused || document.hidden) {
      // keep the first pose applied while paused (no T-pose behind the story overlay); the clock does not advance
      if (mixer.time === 0) mixer.update(0.001)
      return
    }
    run.elapsed += delta

    // --- controller evidence -> state machine ---------------------------------------------------------------
    const actor = controller.current
    const velocity = actor?.body ? actor.body.linvel() : null
    const speed = velocity ? Math.hypot(velocity.x, velocity.z) : 0
    const step = rig.machine.update({ speed, grounded: actor ? actor.isOnGround : true, verticalVelocity: velocity?.y ?? 0, runActive: !!actor?.runActive, dt: delta })
    if (step.changed) run.fade = step.event === 'takeoff' ? FADE.takeoff : step.event === 'land' ? FADE.land : FADE.locomotion
    if (step.event === 'takeoff' && rig.jump) rig.jump.reset().play()
    if (step.event === 'land') { run.landedAt = run.elapsed; if (rig.land) rig.land.reset().play() }
    if (step.event && run.canvas) { run.canvas.dataset.takeoffs = String(rig.machine.takeoffs); run.canvas.dataset.landings = String(rig.machine.landings) }

    // --- target weights per state ---------------------------------------------------------------------------
    const target = { idle: 0, walk: 0, run: 0, jump: 0, fall: 0, land: 0, pose: 0 }
    const locomotion = () => { target.idle = 1 - step.walkBlend; target.walk = step.walkBlend }
    switch (step.state) {
      case 'idle': case 'walk': locomotion(); break
      case 'run': if (rig.run) target.run = 1; else target.walk = 1; break
      case 'jump_takeoff': if (rig.jump) target.jump = 1; else target.pose = 1; break
      case 'airborne': if (rig.fall) target.fall = 1; else target.pose = 1; break
      case 'land': if (rig.land) target.land = 1; else locomotion(); break
    }
    if (!rig.walk) { target.idle = Math.max(target.idle, target.walk, target.run, target.pose); target.walk = target.run = target.pose = 0 }
    if (!rig.idle && rig.walk) target.walk = Math.max(target.walk, target.idle)

    // --- speed-matched playback rates (feet vs ground travel) -----------------------------------------------
    if (rig.walk) {
      const ratio = speed / WALK_CLIP.naturalSpeed
      const [lo, hi] = step.state === 'run' && !rig.run ? RUN_FALLBACK_TIMESCALE : WALK_TIMESCALE
      rig.walk.setEffectiveTimeScale(step.state === 'idle' ? 1 : MathUtils.clamp(ratio, lo, hi))
    }
    if (rig.run && rig.walk && step.state === 'run' && rig.run.getEffectiveWeight() < 0.01) {
      // phase-lock the run cycle to the walk cycle when the crossfade starts (warp equivalent)
      rig.run.time = (rig.walk.time / rig.walk.getClip().duration) * rig.run.getClip().duration
    }

    // --- crossfade: every weight moves toward its target over the chosen fade duration ---------------------
    const rate = delta / Math.max(run.fade, 1e-3)
    let total = 0
    for (const key of WEIGHTED) {
      const action = rig[key]
      if (!action) continue
      const weight = approach(action.getEffectiveWeight(), target[key], rate)
      action.setEffectiveWeight(weight)
      total += weight
    }
    if (total < 1e-3 && rig.idle) rig.idle.setEffectiveWeight(1)   // never fall back to the bind (T) pose

    // --- presence: blink one-shot, landing knee-dip ---------------------------------------------------------
    if (rig.face && run.elapsed >= run.nextBlink) {
      rig.face.reset().setEffectiveWeight(1).play()
      run.nextBlink = run.elapsed + MathUtils.randFloat(BLINK_INTERVAL[0], BLINK_INTERVAL[1])
    }
    const sinceLanding = run.landedAt < 0 ? Infinity : run.elapsed - run.landedAt
    if (run.root) run.root.position.y = !rig.land && sinceLanding < LAND_DIP.duration ? LAND_DIP.depth * (1 - sinceLanding / LAND_DIP.duration) : 0

    mixer.update(delta)

    // --- presence: idle breathing (post-mixer micro-rotation on Spine1, fades out with speed) ----------------
    if (rig.spine && !reducedMotion && (step.state === 'idle' || step.state === 'walk')) {
      const angle = MathUtils.degToRad(BREATH.degrees) * (1 - step.walkBlend) * Math.sin(run.elapsed * Math.PI * 2 * BREATH.hz)
      rig.spine.quaternion.multiply(run.breath.set(Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)))
    }

    if (run.lastAnim !== step.state && run.canvas) { run.lastAnim = step.state; run.canvas.dataset.anim = step.state }
    // Grounding evidence for the browser test: lowest toe-joint world Y (the sole is ~0.016 m below the joint), 6 Hz.
    if (run.canvas && rig.toes.length && ++run.frame % 10 === 0) {
      let lowest = Infinity
      for (const toe of rig.toes) lowest = Math.min(lowest, toe.getWorldPosition(run.probe).y)
      run.canvas.dataset.toeY = lowest.toFixed(3)
    }
  })
  return null
}
