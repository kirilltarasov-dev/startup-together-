import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isGrass } from './src/engine/firstPerson.ts'
import { GRASS_MAX_DISPLACEMENT, GRASS_WIND_AMPLITUDE, createGrassField, grassBounds } from './src/scenes/grassField.ts'

test('grass distribution is repeatable and different layers have distinct placement', () => {
  assert.deepEqual(createGrassField('grass'), createGrassField('grass'))
  assert.notDeepEqual(createGrassField('seed').offsets.slice(0, 30), createGrassField('clover').offsets.slice(0, 30))
})

test('all ground cover stays off the path, indoors, and furniture footprints', () => {
  for (const kind of ['grass', 'seed', 'clover'] as const) {
    const { offsets, shapes, count } = createGrassField(kind)
    assert.equal(offsets.length, count * 3)
    assert.equal(shapes.length, count * 4)
    for (let i = 0; i < count; i++) {
      const x = offsets[i * 3], z = offsets[i * 3 + 2]
      assert.ok(isGrass(x, z))
      assert.ok(!(Math.abs(Math.abs(x) - 5.1) < 1.35 && Math.abs(z - 8) < 0.45))
      assert.ok(shapes[i * 4 + 1] > 0 && shapes[i * 4 + 1] < 0.9)
      assert.ok(shapes[i * 4 + 2] > 0)
    }
  }
})

test('grass has coherent height variation while keeping its instance budget below the original', () => {
  const field = createGrassField('grass')
  const heights = Array.from({ length: field.count }, (_, i) => field.shapes[i * 4 + 1])
  assert.ok(Math.max(...heights) - Math.min(...heights) > 0.3)
  const total = field.count + createGrassField('seed').count + createGrassField('clover').count
  assert.ok(total < 64000)
  assert.equal(total, 58400, 'instance budget is unchanged by the shared-wind work')
})

test('animated bounding sphere covers every blade tip plus the maximum wind/foot/brush displacement', () => {
  assert.ok(GRASS_MAX_DISPLACEMENT > GRASS_WIND_AMPLITUDE + 0.38 + 0.48)
  for (const kind of ['grass', 'seed', 'clover'] as const) {
    const field = createGrassField(kind)
    const { center, radius } = grassBounds(field)
    assert.ok(radius < 12, `radius stays tight (${radius.toFixed(2)})`)
    for (let i = 0; i < field.count; i++) {
      const x = field.offsets[i * 3], y = field.offsets[i * 3 + 1], z = field.offsets[i * 3 + 2]
      const tip = y + field.shapes[i * 4 + 1]
      for (const [dx, dz] of [[GRASS_MAX_DISPLACEMENT, 0], [-GRASS_MAX_DISPLACEMENT, 0], [0, GRASS_MAX_DISPLACEMENT], [0, -GRASS_MAX_DISPLACEMENT]]) {
        const distance = Math.hypot(x + dx - center[0], tip - center[1], z + dz - center[2])
        assert.ok(distance <= radius, `${kind} blade ${i} tip displaced by (${dx},${dz}) leaves the bounding sphere`)
      }
      assert.ok(Math.hypot(x - center[0], y - center[1], z - center[2]) <= radius)
    }
  }
  assert.deepEqual(grassBounds({ count: 0, offsets: new Float32Array(), shapes: new Float32Array() }).center, [0, 0, 0])
})
