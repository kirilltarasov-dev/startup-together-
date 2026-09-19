import assert from 'node:assert/strict'
import { test } from 'node:test'
import { FOOTSTEP_SOUNDS, MIN_GAP, RUN, WALK, createFootstepTracker, footstepMix, stepCadence, type FootstepKind } from './src/scenes/footsteps.ts'

const fixed = () => 0.5

function run(tracker: ReturnType<typeof createFootstepTracker>, seconds: number, speed: number, grounded: boolean, out: { t: number; kind: FootstepKind }[], t0 = 0) {
  const dt = 1 / 60
  let t = t0
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    t += dt
    for (const kind of tracker.advance(dt, speed, grounded)) out.push({ t, kind })
  }
  return t
}

test('cadence follows speed: ~1.8 steps/s walking, ~2.8 running, silent when blocked or crawling', () => {
  assert.equal(stepCadence(0), 0)
  assert.equal(stepCadence(0.3), 0)
  assert.equal(stepCadence(WALK.speed), WALK.cadence)
  assert.equal(stepCadence(RUN.speed), RUN.cadence)
  assert.ok(Math.abs(stepCadence((WALK.speed + RUN.speed) / 2) - (WALK.cadence + RUN.cadence) / 2) < 1e-9)
  assert.equal(stepCadence(9), RUN.cadence, 'clamped above run speed')
  assert.ok(stepCadence(1) > 0 && stepCadence(1) <= WALK.cadence, 'slow walking still steps, but no faster than a walk')
})

test('steps fire at footfall cadence only while grounded and moving', () => {
  const events: { t: number; kind: FootstepKind }[] = []
  const tracker = createFootstepTracker(fixed)
  run(tracker, 10, WALK.speed, true, events)
  const walkSteps = events.filter((e) => e.kind === 'step')
  assert.ok(walkSteps.length >= 17 && walkSteps.length <= 19, `walk: ${walkSteps.length} steps in 10 s`)
  events.length = 0
  run(tracker, 10, RUN.speed, true, events)
  const runSteps = events.filter((e) => e.kind === 'step')
  assert.ok(runSteps.length >= 27 && runSteps.length <= 29, `run: ${runSteps.length} steps in 10 s`)
  events.length = 0
  run(tracker, 5, 0, true, events)
  assert.equal(events.length, 0, 'standing still / blocked is silent')
  run(tracker, 5, 0.2, true, events)
  assert.equal(events.length, 0, 'sliding against a wall is silent')
  run(tracker, 3, RUN.speed, false, events)
  assert.equal(events.length, 0, 'airborne is silent even at speed')
})

test('landing plays one heavier sound on the grounded edge and sounds never stack', () => {
  const events: { t: number; kind: FootstepKind }[] = []
  const tracker = createFootstepTracker(fixed)
  let t = run(tracker, 1, WALK.speed, true, events)
  t = run(tracker, 0.6, 3, false, events, t)
  const before = events.length
  t = run(tracker, 0.5, 3, true, events, t)
  const land = events.slice(before).filter((e) => e.kind === 'land')
  assert.equal(land.length, 1, 'exactly one land sound')
  assert.equal(events[before].kind, 'land', 'land comes first after touching down')
  // Tiny bounce (below the minimum air time) does not thud.
  run(tracker, 0.05, 3, false, events, t)
  const bounce = events.length
  run(tracker, 0.2, 3, true, events, t)
  assert.equal(events.slice(bounce).filter((e) => e.kind === 'land').length, 0, 'a 50 ms bounce does not thud')
  for (let i = 1; i < events.length; i++) assert.ok(events[i].t - events[i - 1].t >= MIN_GAP - 1e-6, `gap ${(events[i].t - events[i - 1].t).toFixed(3)} s`)
})

test('mix keeps footsteps quiet with slight variation, and only references shipped sounds', () => {
  const shipped = ['ui/keystroke_soft', 'ui/button_medium', 'ui/item_select', 'ui/buzz_long', 'ui/success_chime', 'arcade/coin', 'arcade/level_up', 'arcade/level_down', 'notification/error', 'notification/warning', 'game/portal_opening', 'system/boot_up']
  for (const name of Object.values(FOOTSTEP_SOUNDS)) assert.ok(shipped.includes(name), `${name} exists under public/sounds`)
  const volumes = new Set<number>(), rates = new Set<number>()
  for (let i = 0; i < 50; i++) {
    const step = footstepMix('step', 'concrete')
    assert.ok(step.volume > 0.2 && step.volume <= 0.29, `step volume ${step.volume}`)
    assert.ok(step.rate > 0.85 && step.rate < 1.1)
    volumes.add(step.volume); rates.add(step.rate)
    const grass = footstepMix('step', 'grass')
    assert.ok(grass.volume < step.volume + 0.05 && grass.rate < 1, 'grass is softer and lower')
    const land = footstepMix('land', 'concrete')
    assert.ok(land.volume > step.volume - 0.05 && land.rate < 0.65, 'land is heavier: louder and much lower pitched')
  }
  assert.ok(volumes.size > 10 && rates.size > 10, 'random variation applied')
})
