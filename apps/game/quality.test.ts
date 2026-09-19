// Quality tiers: settings table, persistence defaults and the auto step-down/step-up hysteresis.
// Run: node --test quality.test.ts   (Node 22.18+ type stripping; no DOM, so storage falls back to memory)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AUTO_QUALITY, DEFAULT_QUALITY, QUALITY_ORDER, QUALITY_TABLE, QualityAutoTuner, decideQualityStep, getQuality, initialAutoState, percentile, resetQuality, resolveDpr, setQuality, stepDown, stepUp, subscribeQuality, type AutoState, type Quality } from './src/world/quality.ts'

/** Feed one p50 per window (5 s apart) through the decision function; returns the tier after each window. */
function run(windows: number[], tier: Quality, manual: boolean, state: AutoState = initialAutoState(), startAt = 0) {
  const tiers: Quality[] = []
  let current = tier
  for (const [index, p50] of windows.entries()) {
    const decision = decideQualityStep(state, p50, current, manual, startAt + (index + 1) * AUTO_QUALITY.windowMs)
    state = decision.state
    if (decision.next) current = decision.next
    tiers.push(current)
  }
  return { tiers, tier: current, state }
}

test('settings table: dpr caps, shadow map sizes, shadows off only on low, grass density falls with the tier', () => {
  assert.deepEqual(QUALITY_ORDER, ['low', 'balanced', 'high'])
  assert.equal(QUALITY_TABLE.high.dprCap, 2)
  assert.equal(QUALITY_TABLE.balanced.dprCap, 1.5)
  assert.equal(QUALITY_TABLE.low.dprCap, 1)
  assert.deepEqual([QUALITY_TABLE.high.shadowMapSize, QUALITY_TABLE.balanced.shadowMapSize, QUALITY_TABLE.low.shadowMapSize], [2048, 1024, 512])
  assert.deepEqual([QUALITY_TABLE.high.shadows, QUALITY_TABLE.balanced.shadows, QUALITY_TABLE.low.shadows], [true, true, false])
  assert.deepEqual([QUALITY_TABLE.high.grassDensity, QUALITY_TABLE.balanced.grassDensity, QUALITY_TABLE.low.grassDensity], [1, 0.7, 0.4])
  assert.equal(QUALITY_TABLE.high.contactShadows, true)
  assert.equal(resolveDpr(2, 3), 2, 'high caps a 3x display at 2')
  assert.equal(resolveDpr(2, 1.25), 1.25, 'high never upsamples')
  assert.equal(resolveDpr(1.5, 2), 1.5)
  assert.equal(resolveDpr(1, 2), 1)
  assert.equal(resolveDpr(1.5, 0), 1, 'missing devicePixelRatio -> 1')
  assert.equal(stepDown('low'), 'low', 'never below low')
  assert.equal(stepUp('high'), 'high')
  assert.equal(stepDown('high'), 'balanced')
  assert.equal(stepUp('low'), 'balanced')
})

test('store: first run is balanced, manual choice is remembered as manual, auto changes are not', () => {
  resetQuality()
  assert.equal(DEFAULT_QUALITY, 'balanced')
  assert.equal(getQuality().tier, 'balanced')
  assert.equal(getQuality().manual, false)
  assert.equal(getQuality().dpr, 1, 'no window in Node -> dpr 1')
  let notified = 0
  const unsubscribe = subscribeQuality(() => notified++)
  setQuality('low', 'auto')
  assert.equal(getQuality().tier, 'low')
  assert.equal(getQuality().manual, false, 'an automatic step keeps auto step-up enabled')
  setQuality('high', 'manual')
  assert.equal(getQuality().manual, true)
  setQuality('balanced', 'auto')
  assert.equal(getQuality().tier, 'balanced', 'auto step-down still applies after a manual choice')
  assert.equal(getQuality().manual, true, 'the manual flag survives automatic changes')
  assert.equal(notified, 3)
  setQuality('balanced', 'auto')
  assert.equal(notified, 3, 'no notification without a change')
  unsubscribe()
  resetQuality()
})

test('percentile: p50 of a synthetic frame-time window', () => {
  assert.equal(percentile([16, 17, 40, 16, 17], 0.5), 17)
  assert.equal(percentile([30], 0.5), 30)
  assert.ok(Number.isNaN(percentile([], 0.5)))
})

test('hysteresis: two slow windows step down once, never below low', () => {
  assert.deepEqual(run([30, 30], 'high', false).tiers, ['high', 'balanced'])
  assert.deepEqual(run([30, 30, 30, 30], 'balanced', false).tiers, ['balanced', 'low', 'low', 'low'], 'second pair is inside the 30 s cooldown; low is the floor anyway')
  assert.deepEqual(run([25, 25], 'low', false).tiers, ['low', 'low'])
  assert.equal(run([24, 24], 'high', false).tier, 'high', 'exactly 24 ms is not slow')
})

test('hysteresis: a normal window between two slow windows resets the slow counter', () => {
  assert.equal(run([30, 20, 30], 'high', false).tier, 'high')
  assert.equal(run([30, 20, 30, 30], 'high', false).tier, 'balanced')
})

test('hysteresis: six fast windows step up once, only without a manual choice', () => {
  const fast = Array(6).fill(12)
  assert.deepEqual(run(fast, 'low', false).tiers, ['low', 'low', 'low', 'low', 'low', 'balanced'])
  assert.equal(run(fast.slice(0, 5), 'low', false).tier, 'low', 'five fast windows are not enough')
  assert.equal(run(fast, 'low', true).tier, 'low', 'a manual tier never steps up automatically')
  assert.equal(run(fast, 'high', false).tier, 'high')
  assert.equal(run([12, 12, 12, 16, 12, 12, 12], 'low', false).tier, 'low', 'a 16 ms window resets the fast counter')
  assert.equal(run([13.9, 13.9, 13.9, 13.9, 13.9, 13.9], 'balanced', false).tier, 'high')
  assert.equal(run([14, 14, 14, 14, 14, 14], 'balanced', false).tier, 'balanced', 'exactly 14 ms is not fast')
})

test('hysteresis: manual tier still steps down under sustained slow frames', () => {
  assert.equal(run([30, 30], 'high', true).tier, 'balanced')
})

test('cooldown: no second change within 30 s, counters saturate so the change fires right after the cooldown', () => {
  // t = 5 s, 10 s: slow -> step down at 10 s. t = 15..35 s slow: blocked until 40 s (>= 10 s + 30 s).
  const slow = Array(8).fill(40)
  const result = run(slow, 'high', false)
  assert.deepEqual(result.tiers, ['high', 'balanced', 'balanced', 'balanced', 'balanced', 'balanced', 'balanced', 'low'])
  assert.equal(result.state.lastChangeAt, 8 * AUTO_QUALITY.windowMs)
  // down at 10 s, then fast: the sixth fast window lands at 40 s (exactly 30 s later) -> step up allowed there, not before
  const bounce = run([40, 40, 10, 10, 10, 10, 10, 10], 'balanced', false)
  assert.deepEqual(bounce.tiers, ['balanced', 'low', 'low', 'low', 'low', 'low', 'low', 'balanced'])
  // step-up at 30 s, then slow at 35 s and 40 s: the slow pair is complete at 40 s but the cooldown runs to 60 s;
  // the saturated counter fires at the first slow window after that (60 s), not at 45/50/55 s.
  const fastThenSlow = run([10, 10, 10, 10, 10, 10, 40, 40, 40, 40, 40, 40], 'low', false)
  assert.deepEqual(fastThenSlow.tiers.slice(5), ['balanced', 'balanced', 'balanced', 'balanced', 'balanced', 'balanced', 'low'])
})

test('tuner: 5 s windows of frame samples drive the decision, evidence fields update per window', () => {
  const store = { tier: 'balanced' as Quality, manual: false }
  const applied: Quality[] = []
  const tuner = new QualityAutoTuner(() => ({ ...store }), (tier) => { applied.push(tier); store.tier = tier })
  let now = 1000
  const feed = (frameMs: number, seconds: number) => { for (let t = 0; t < seconds * 1000; t += frameMs) { now += frameMs; tuner.sample(frameMs, now) } }
  feed(33, 5.1)
  assert.equal(tuner.windows, 1)
  assert.equal(tuner.lastP50, 33)
  assert.deepEqual(applied, [], 'one slow window is not enough')
  feed(33, 5.1)
  assert.deepEqual(applied, ['low'])
  assert.equal(tuner.lastChange, 'balanced>low@33.0')
  tuner.sample(NaN, now)
  tuner.sample(0, now)
  assert.equal(tuner.windows, 2, 'invalid samples are ignored')
})

test('tuner: a manual tier change discards the mixed window, resets the counters and starts a 30 s grace period', () => {
  const store = { tier: 'balanced' as Quality, manual: false }
  const applied: Quality[] = []
  const tuner = new QualityAutoTuner(() => ({ ...store }), (tier) => { applied.push(tier); store.tier = tier })
  let now = 1000
  const feed = (frameMs: number, seconds: number) => { for (let t = 0; t < seconds * 1000; t += frameMs) { now += frameMs; tuner.sample(frameMs, now) } }
  feed(33, 5.1); feed(33, 5.1)
  assert.deepEqual(applied, ['low'], 'auto step-down at ~11 s')
  feed(33, 5.1); feed(33, 5.1); feed(33, 5.1); feed(33, 5.1)   // saturated slow counter, cooldown elapsing (~31 s)
  store.tier = 'high'; store.manual = true                      // the player picks High from the toolbar
  feed(33, 5.1)
  assert.deepEqual(applied, ['low'], 'the window that saw the manual change is discarded, nothing is undone')
  feed(33, 5.1); feed(33, 5.1); feed(33, 5.1); feed(33, 5.1); feed(33, 5.1)
  assert.deepEqual(applied, ['low'], 'still inside the 30 s grace after the manual change (5 more windows = ~25 s)')
  feed(33, 5.1)
  assert.deepEqual(applied, ['low', 'balanced'], 'sustained slow frames still step a manual High down once the grace has passed')
  assert.equal(store.tier, 'balanced')
  feed(10, 5.1); feed(10, 5.1); feed(10, 5.1); feed(10, 5.1); feed(10, 5.1); feed(10, 5.1); feed(10, 5.1); feed(10, 5.1)
  assert.deepEqual(applied, ['low', 'balanced'], 'never steps up after a manual choice')
})
