import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { seededRandom } from './src/scenes/sceneMaterials.ts'
import { BIRD_BOUNDS, createBird, generateFlightPath, insideBox, spawnPoint, stepBird } from './src/scenes/birdFlight.ts'

test('flight paths have 5-7 waypoints, stay above 8 m, outside the building volume and start at the bird', () => {
  const random = seededRandom(17)
  for (let n = 0; n < 60; n++) {
    const { position, tangent } = spawnPoint(random)
    const path = generateFlightPath(position, tangent, random)
    assert.ok(path.waypoints.length >= 5 && path.waypoints.length <= 7, `waypoints ${path.waypoints.length}`)
    assert.ok(path.curve.getPointAt(0).distanceTo(position) < 1e-6, 'path starts exactly at the previous position')
    const startTangent = path.curve.getTangentAt(0)
    assert.ok(startTangent.dot(tangent.clone().normalize()) > 0.9, `initial heading is continuous (dot ${startTangent.dot(tangent).toFixed(2)})`)
    for (const p of path.curve.getSpacedPoints(200)) {
      assert.ok(p.y >= BIRD_BOUNDS.floorY, `y=${p.y.toFixed(2)} below floor`)
      assert.ok(!insideBox(p, BIRD_BOUNDS.exclusion), 'never inside the buildings/courtyard volume')
    }
    for (const w of path.waypoints.slice(2)) {
      assert.ok(w.y >= BIRD_BOUNDS.minY && w.y <= BIRD_BOUNDS.maxY)
      const r = Math.hypot(w.x, w.z)
      assert.ok(r >= BIRD_BOUNDS.minRadius - 1e-6 && r <= BIRD_BOUNDS.maxRadius + 1e-6, `radius ${r.toFixed(1)}`)
    }
  }
})

test('birds fly 6-9 m/s without teleporting across path changes, bank in turns and glide unsynchronised', () => {
  const random = seededRandom(99)
  const birds = [createBird(random), createBird(random), createBird(random)]
  const dt = 1 / 60
  const flapSamples: number[][] = [[], [], []]
  let glideFrames = 0, flapFrames = 0, banked = 0, paths = 0, maxRoll = 0
  const previous = birds.map((bird) => bird.position.clone())
  for (let frame = 0; frame < 60 * 120; frame++) {
    birds.forEach((bird, i) => {
      const before = bird.path
      const flap = stepBird(bird, dt, random)
      if (bird.path !== before) paths++
      const moved = bird.position.distanceTo(previous[i])
      assert.ok(moved < 9.5 * dt * 1.6, `frame ${frame}: bird ${i} moved ${moved.toFixed(3)} m in one frame`)
      previous[i].copy(bird.position)
      assert.ok(bird.position.y >= BIRD_BOUNDS.floorY)
      assert.ok(!insideBox(bird.position, BIRD_BOUNDS.exclusion))
      assert.ok(Math.abs(bird.roll) <= 0.85 + 1e-9)
      maxRoll = Math.max(maxRoll, Math.abs(bird.roll))
      if (Math.abs(bird.roll) > 0.08) banked++
      if (bird.flapAmplitude < 0.05) glideFrames++
      if (bird.flapAmplitude > 0.95) flapFrames++
      if (frame % 6 === 0) flapSamples[i].push(flap)
    })
  }
  assert.ok(paths >= 3, `each bird regenerated at least one path (${paths})`)
  assert.ok(glideFrames > 60 * 3 && flapFrames > 60 * 10, `both glide (${glideFrames}) and flap (${flapFrames}) phases occur`)
  assert.ok(banked > 60 * 5, `birds bank in turns (${banked} frames, max roll ${maxRoll.toFixed(2)})`)
  const speeds = birds.map((bird) => bird.speed)
  assert.ok(speeds.every((s) => s >= 6 && s <= 9))
  assert.ok(new Set(birds.map((bird) => bird.flapHz.toFixed(3))).size === 3, 'wingbeat frequencies differ per bird')
  const correlation = (a: number[], b: number[]) => {
    const n = Math.min(a.length, b.length)
    let sum = 0
    for (let i = 0; i < n; i++) sum += a[i] * b[i]
    return sum / n
  }
  assert.ok(Math.abs(correlation(flapSamples[0], flapSamples[1])) < 0.15, 'wingbeats are not synchronised')
})

test('a bird covers its path at cruise speed', () => {
  const random = seededRandom(5)
  const bird = createBird(random)
  const length = bird.path.length
  const path = bird.path
  let elapsed = 0
  while (bird.path === path) { stepBird(bird, 1 / 60, random); elapsed += 1 / 60 }
  const expected = length / bird.speed
  assert.ok(Math.abs(elapsed - expected) < expected * 0.25 + 0.5, `took ${elapsed.toFixed(1)} s for ${length.toFixed(1)} m (expected ~${expected.toFixed(1)} s)`)
  assert.ok(bird.position instanceof THREE.Vector3)
})
