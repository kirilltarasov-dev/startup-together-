/**
 * Pure locomotion state machine driven by controller evidence (planar speed, grounded flag, vertical velocity,
 * run modifier). No Three.js here so it can be unit-tested in Node.
 */
export type LocomotionState = 'idle' | 'walk' | 'run' | 'jump_takeoff' | 'airborne' | 'land'

export interface LocomotionSample {
  /** horizontal |v| in m/s from the rigid body */
  speed: number
  grounded: boolean
  /** vertical velocity in m/s (+ up) */
  verticalVelocity: number
  /** run modifier held/active */
  runActive: boolean
  /** seconds since the previous sample */
  dt: number
}

export interface LocomotionRules {
  walkThreshold: number
  /** hysteresis: leave walk for idle below this */
  idleThreshold: number
  runThreshold: number
  /** grounded edges shorter than this are ignored (Rapier jitter) */
  groundedDebounce: number
  /** takeoff is accepted immediately when moving up faster than this */
  jumpVelocity: number
  takeoffDuration: number
  landDuration: number
}

export const DEFAULT_RULES: LocomotionRules = {
  walkThreshold: 0.3,
  idleThreshold: 0.18,
  runThreshold: 3.4,
  groundedDebounce: 0.08,
  jumpVelocity: 0.5,
  takeoffDuration: 0.12,
  landDuration: 0.22,
}

export interface LocomotionStep {
  state: LocomotionState
  changed: boolean
  /** exactly one physical edge per takeoff / landing */
  event: 'takeoff' | 'land' | null
  /** 0 = idle, 1 = full walk; continuous locomotion blend from actual speed */
  walkBlend: number
}

export class LocomotionMachine {
  state: LocomotionState = 'idle'
  takeoffs = 0
  landings = 0
  private grounded = true
  private pendingGrounded: boolean | null = null
  private pendingFor = 0
  private stateTimer = 0
  private moving = false
  private readonly rules: LocomotionRules

  constructor(rules: LocomotionRules = DEFAULT_RULES) { this.rules = rules }

  /** Debounced grounded flag: a raw flip must persist `groundedDebounce` seconds, except an obvious jump. */
  private resolveGrounded(raw: boolean, verticalVelocity: number, dt: number): boolean | null {
    if (raw === this.grounded) { this.pendingGrounded = null; this.pendingFor = 0; return null }
    if (this.pendingGrounded !== raw) { this.pendingGrounded = raw; this.pendingFor = 0 }
    this.pendingFor += dt
    const jumpEdge = !raw && verticalVelocity > this.rules.jumpVelocity
    if (jumpEdge || this.pendingFor >= this.rules.groundedDebounce) {
      this.grounded = raw
      this.pendingGrounded = null
      this.pendingFor = 0
      return raw
    }
    return null
  }

  update(sample: LocomotionSample): LocomotionStep {
    const previous = this.state
    const rules = this.rules
    this.stateTimer += sample.dt
    const edge = this.resolveGrounded(sample.grounded, sample.verticalVelocity, sample.dt)
    let event: LocomotionStep['event'] = null
    if (edge === false) {
      this.takeoffs += 1
      event = 'takeoff'
      this.state = sample.verticalVelocity > rules.jumpVelocity ? 'jump_takeoff' : 'airborne'
      this.stateTimer = 0
    } else if (edge === true) {
      this.landings += 1
      event = 'land'
      this.state = 'land'
      this.stateTimer = 0
    } else if (!this.grounded) {
      if (this.state === 'jump_takeoff' && this.stateTimer >= rules.takeoffDuration) { this.state = 'airborne'; this.stateTimer = 0 }
      else if (this.state !== 'jump_takeoff') this.state = 'airborne'
    } else if (this.state === 'land' && this.stateTimer < rules.landDuration) {
      // hold the landing pose/dip; locomotion resumes after the window
    } else {
      if (this.moving && sample.speed < rules.idleThreshold) this.moving = false
      else if (!this.moving && sample.speed >= rules.walkThreshold) this.moving = true
      this.state = !this.moving ? 'idle' : sample.runActive && sample.speed > rules.runThreshold ? 'run' : 'walk'
    }
    const walkBlend = Math.min(1, Math.max(0, sample.speed / rules.walkThreshold))
    return { state: this.state, changed: this.state !== previous, event, walkBlend }
  }
}
