import assert from 'node:assert/strict'
import { test } from 'node:test'
import { grassTarget, isGrass, movePlayer, SCENE_COLLIDERS } from './src/engine/firstPerson.ts'

test('walking is frame-rate independent and diagonal speed is normalized', () => {
  const start = { x: 0, z: 5 }
  const straight = movePlayer(start, 0, -1, 0, 1 / 60)
  const diagonal = movePlayer(start, 1, -1, 0, 1 / 60)
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.z - 5) - Math.hypot(straight.x, straight.z - 5)) < 1e-8)
  let a = start
  let b = start
  for (let i = 0; i < 60; i++) a = movePlayer(a, 0, -1, 0, 1 / 60)
  for (let i = 0; i < 120; i++) b = movePlayer(b, 0, -1, 0, 1 / 120)
  assert.ok(Math.abs(a.z - b.z) < 1e-8)
})

test('walking follows camera yaw', () => {
  const next = movePlayer({ x: 0, z: 5 }, 0, -1, Math.PI / 2, 0.05)
  assert.ok(next.x < 0)
  assert.ok(Math.abs(next.z - 5) < 1e-8)
})

test('walls and furniture are solid while the doorway is traversable', () => {
  let wall = { x: 3, z: 1 }
  let door = { x: 0, z: 1 }
  let desk = { x: 0, z: -3 }
  for (let i = 0; i < 100; i++) {
    wall = movePlayer(wall, 0, -1, 0, 0.016)
    door = movePlayer(door, 0, -1, 0, 0.016)
    desk = movePlayer(desk, 0, -1, 0, 0.016)
  }
  assert.ok(wall.z > 0)
  assert.ok(door.z < 0)
  assert.ok(desk.z >= -4.06)
  assert.ok(SCENE_COLLIDERS.length > 0)
})

test('large frame gaps cannot teleport through obstacles or world bounds', () => {
  const next = movePlayer({ x: 0, z: 5 }, 1, 0, 0, 20)
  assert.ok(next.x <= 0.2)
  let edge = { x: 7, z: 5 }
  for (let i = 0; i < 200; i++) edge = movePlayer(edge, 1, 0, 0, 0.016)
  assert.ok(edge.x < 7.5)
})

test('grass exists in the garden, not the path or indoors', () => {
  assert.equal(isGrass(3, 5), true)
  assert.equal(isGrass(0, 5), false)
  assert.equal(isGrass(3, -5), false)
  assert.equal(isGrass(20, 5), false)
})

test('grass brushing requires a downward ray within reach', () => {
  assert.ok(grassTarget({ x: 3, y: 0.95, z: 5 }, { x: 0, y: -0.8, z: -0.6 }))
  assert.equal(grassTarget({ x: 0, y: 1.65, z: 5 }, { x: 0, y: -1, z: 0 }), null)
  assert.equal(grassTarget({ x: 3, y: 1.65, z: 5 }, { x: 0, y: 1, z: 0 }), null)
  assert.equal(grassTarget({ x: 3, y: 1.65, z: 5 }, { x: 0, y: -0.1, z: -0.99 }), null)
})
