/**
 * Render-quality tiers for the third-person world. Framework-free (no React, no zustand) so that scene modules
 * can read `getQuality()` synchronously and Node can unit-test the auto step-down/step-up hysteresis.
 *
 * Persisted in localStorage `runway.quality` (tier) and `runway.quality.manual` ('1' once the player picked a tier
 * by hand: a manual choice disables automatic step-UP; automatic step-DOWN under sustained slow frames stays on).
 */
export type Quality = 'high' | 'balanced' | 'low'

export interface QualityTable {
  /** Upper bound for the canvas device-pixel-ratio; the effective dpr is min(devicePixelRatio, dprCap). */
  dprCap: number
  shadowMapSize: number
  shadows: boolean
  /** Fraction of the authored grass instance count to draw (InteractiveGrass: geometry.instanceCount). */
  grassDensity: number
  contactShadows: boolean
}

export interface QualitySettings extends QualityTable {
  tier: Quality
  /** Effective canvas dpr for the current device. */
  dpr: number
  /** True once the player chose a tier; auto step-up is then disabled. */
  manual: boolean
}

export const QUALITY_ORDER: readonly Quality[] = ['low', 'balanced', 'high']
export const DEFAULT_QUALITY: Quality = 'balanced'
export const STORAGE_KEY = 'runway.quality'
export const STORAGE_MANUAL_KEY = 'runway.quality.manual'

export const QUALITY_TABLE: Record<Quality, QualityTable> = {
  high: { dprCap: 2, shadowMapSize: 2048, shadows: true, grassDensity: 1, contactShadows: true },
  balanced: { dprCap: 1.5, shadowMapSize: 1024, shadows: true, grassDensity: 0.7, contactShadows: true },
  low: { dprCap: 1, shadowMapSize: 512, shadows: false, grassDensity: 0.4, contactShadows: false },
}

export const isQuality = (value: unknown): value is Quality => typeof value === 'string' && (QUALITY_ORDER as readonly string[]).includes(value)
export const resolveDpr = (cap: number, devicePixelRatio: number) => Math.max(1, Math.min(devicePixelRatio || 1, cap))
export const stepDown = (tier: Quality): Quality => QUALITY_ORDER[Math.max(0, QUALITY_ORDER.indexOf(tier) - 1)]
export const stepUp = (tier: Quality): Quality => QUALITY_ORDER[Math.min(QUALITY_ORDER.length - 1, QUALITY_ORDER.indexOf(tier) + 1)]

// ------------------------------------------------------------------------------------------------------------
// Store

interface QualityState { tier: Quality; manual: boolean }

function storage(): Storage | null {
  // Node >= 22 exposes a `localStorage` global that only works with --localstorage-file: require a usable API.
  try { return typeof localStorage === 'object' && localStorage !== null && typeof localStorage.getItem === 'function' ? localStorage : null } catch { return null }
}

function load(): QualityState {
  const store = storage()
  const saved = store?.getItem(STORAGE_KEY)
  return { tier: isQuality(saved) ? saved : DEFAULT_QUALITY, manual: store?.getItem(STORAGE_MANUAL_KEY) === '1' }
}

let state: QualityState = load()
let settings: QualitySettings | null = null
const listeners = new Set<() => void>()

/** Immutable snapshot (stable reference between changes: safe for useSyncExternalStore). */
export function getQualityState(): { tier: Quality; manual: boolean } { return state }

export function getQuality(): QualitySettings {
  if (settings && settings.tier === state.tier && settings.manual === state.manual) return settings
  const dpr = resolveDpr(QUALITY_TABLE[state.tier].dprCap, typeof window === 'undefined' ? 1 : window.devicePixelRatio)
  settings = { ...QUALITY_TABLE[state.tier], tier: state.tier, dpr, manual: state.manual }
  return settings
}

export function setQuality(tier: Quality, source: 'manual' | 'auto' = 'manual') {
  const manual = source === 'manual' || state.manual
  if (tier === state.tier && manual === state.manual) return
  state = { tier, manual }
  const store = storage()
  try { store?.setItem(STORAGE_KEY, tier); if (manual) store?.setItem(STORAGE_MANUAL_KEY, '1') } catch { /* private mode: keep in memory */ }
  listeners.forEach((listener) => listener())
}

export function subscribeQuality(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Test/reset helper: forget persisted choice and return to the first-run default. */
export function resetQuality() {
  const store = storage()
  try { store?.removeItem(STORAGE_KEY); store?.removeItem(STORAGE_MANUAL_KEY) } catch { /* ignore */ }
  state = { tier: DEFAULT_QUALITY, manual: false }
  listeners.forEach((listener) => listener())
}

// ------------------------------------------------------------------------------------------------------------
// Auto tuning: rAF frame times sampled in 5 s windows, decisions on the window p50 with hysteresis.

export const AUTO_QUALITY = {
  windowMs: 5000,
  /** p50 above this for `slowWindows` consecutive windows -> step down one tier (never below low). */
  slowMs: 24,
  slowWindows: 2,
  /** p50 below this for `fastWindows` consecutive windows (and no manual choice) -> step up one tier. */
  fastMs: 14,
  fastWindows: 6,
  /** Minimum spacing between automatic tier changes. */
  cooldownMs: 30000,
} as const

export interface AutoState { slow: number; fast: number; lastChangeAt: number }
export const initialAutoState = (): AutoState => ({ slow: 0, fast: 0, lastChangeAt: -Infinity })

export function percentile(values: readonly number[], q: number) {
  if (values.length === 0) return NaN
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))
  return sorted[index]
}

/**
 * One decision per completed window. Counters saturate while the 30 s cooldown blocks a change so the change
 * fires at the first window after the cooldown, as long as the frames are still slow (or still fast).
 */
export function decideQualityStep(previous: AutoState, p50: number, tier: Quality, manual: boolean, now: number): { next: Quality | null; state: AutoState } {
  const slow = p50 > AUTO_QUALITY.slowMs ? previous.slow + 1 : 0
  const fast = p50 < AUTO_QUALITY.fastMs ? previous.fast + 1 : 0
  const cooled = now - previous.lastChangeAt >= AUTO_QUALITY.cooldownMs
  if (slow >= AUTO_QUALITY.slowWindows && cooled && tier !== 'low') return { next: stepDown(tier), state: { slow: 0, fast: 0, lastChangeAt: now } }
  if (fast >= AUTO_QUALITY.fastWindows && cooled && !manual && tier !== 'high') return { next: stepUp(tier), state: { slow: 0, fast: 0, lastChangeAt: now } }
  return { next: null, state: { slow: Math.min(slow, AUTO_QUALITY.slowWindows), fast: Math.min(fast, AUTO_QUALITY.fastWindows), lastChangeAt: previous.lastChangeAt } }
}

/** Accumulates frame times; call `sample` once per rendered frame. Applies tier changes through `apply`. */
export class QualityAutoTuner {
  state = initialAutoState()
  private frames: number[] = []
  private windowStart = NaN
  /** Windows evaluated and last p50, for evidence (canvas dataset). */
  windows = 0
  lastP50 = NaN
  /** Last automatic change, e.g. "balanced>low@33.1" (from>to@p50 ms). */
  lastChange = ''
  private expectedTier: Quality | null = null
  private readonly read: () => { tier: Quality; manual: boolean }
  private readonly apply: (tier: Quality) => void
  constructor(read: () => { tier: Quality; manual: boolean }, apply: (tier: Quality) => void) { this.read = read; this.apply = apply }
  sample(frameMs: number, now: number) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) return
    if (Number.isNaN(this.windowStart)) this.windowStart = now
    this.frames.push(frameMs)
    if (now - this.windowStart < AUTO_QUALITY.windowMs) return
    const p50 = percentile(this.frames, 0.5)
    this.frames = []
    this.windowStart = now
    this.windows++
    this.lastP50 = p50
    const { tier, manual } = this.read()
    if (this.expectedTier !== null && tier !== this.expectedTier) {
      // Somebody else (the toolbar select) changed the tier: this window mixed two tiers, so it does not count, and
      // the player's choice gets the same 30 s grace as an automatic change before saturated counters can undo it.
      this.expectedTier = tier
      this.state = { slow: 0, fast: 0, lastChangeAt: now }
      return
    }
    this.expectedTier = tier
    const decision = decideQualityStep(this.state, p50, tier, manual, now)
    this.state = decision.state
    if (decision.next) { this.lastChange = `${tier}>${decision.next}@${p50.toFixed(1)}`; this.expectedTier = decision.next; this.apply(decision.next) }
  }
}
