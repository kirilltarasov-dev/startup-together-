import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as THREE from 'three'
import { WIND_BASE_ANGLE, WIND_DRIFT, WIND_GLSL, applyWindToMaterial, getWindState, getWindUniforms, gustEnvelope, stepWind, windAngle, windLevel, windOffset } from './src/scenes/wind.ts'

test('windOffset is zero at the root, bounded at the tip and grows with height', () => {
  for (let t = 0; t < 40; t += 0.37) {
    assert.equal(Math.abs(windOffset(0, 0.3, t, 1)), 0)
    assert.equal(Math.abs(windOffset(-1, 0.3, t, 1)), 0)
    assert.ok(Math.abs(windOffset(1, 0, t, 1)) <= 1)
    assert.ok(Math.abs(windOffset(1, 0.6, t, 1)) <= 0.4 + 1e-9)
    assert.ok(Math.abs(windOffset(0.5, 0, t, 1)) <= Math.abs(windOffset(1, 0, t, 1)) + 1e-9)
    assert.ok(Math.abs(windOffset(1, 0, t, 0.3)) <= Math.abs(windOffset(1, 0, t, 1)) + 1e-9)
  }
  assert.equal(Math.abs(windOffset(1, 1, 3, 1)), 0, 'a fully rigid surface does not move')
  assert.equal(Math.abs(windOffset(1, 0, 3, 0)), 0, 'no wind, no motion')
  let peak = 0
  for (let t = 0; t < 60; t += 0.01) peak = Math.max(peak, Math.abs(windOffset(1, 0, t, 1)))
  assert.ok(peak > 0.7 && peak <= 1, `tip reaches a visible amplitude (${peak.toFixed(2)})`)
})

test('windOffset is continuous over time (no jumps between consecutive frames)', () => {
  const dt = 1 / 60
  let previous = windOffset(1, 0, 0, 1)
  for (let t = dt; t < 120; t += dt) {
    const next = windOffset(1, 0, t, 1)
    assert.ok(Math.abs(next - previous) < 0.12, `step at t=${t.toFixed(2)} is ${Math.abs(next - previous).toFixed(3)}`)
    previous = next
  }
})

test('gusts are occasional, last roughly 3-6 s and the wind direction drifts within ±15°', () => {
  const segments: number[] = []
  let inGust = false, start = 0, active = 0, samples = 0
  for (let t = 0; t < 3600; t += 0.02) {
    const g = gustEnvelope(t)
    assert.ok(g >= 0 && g <= 1)
    samples++
    if (g > 0.05) active++
    if (g > 0.05 && !inGust) { inGust = true; start = t }
    if (g <= 0.05 && inGust) { inGust = false; segments.push(t - start) }
  }
  segments.sort((a, b) => a - b)
  const median = segments[Math.floor(segments.length / 2)]
  assert.ok(segments.length / 60 > 2 && segments.length / 60 < 8, `about 2-8 gusts per minute (${(segments.length / 60).toFixed(1)})`)
  assert.ok(median > 2.5 && median < 6, `median gust length ${median.toFixed(1)} s`)
  assert.ok(segments[segments.length - 1] < 9, `longest gust ${segments[segments.length - 1].toFixed(1)} s`)
  assert.ok(active / samples < 0.4, 'the wind is calm most of the time')
  for (let t = 0; t < 3600; t += 0.5) assert.ok(Math.abs(windAngle(t) - WIND_BASE_ANGLE) <= WIND_DRIFT + 1e-9)
  let span = 0
  for (let t = 0; t < 600; t += 0.5) span = Math.max(span, Math.abs(windAngle(t) - WIND_BASE_ANGLE))
  assert.ok(span > WIND_DRIFT * 0.5, 'the direction actually drifts')
})

test('stepWind advances one shared state, publishes the same uniform objects and honours reduced motion', () => {
  const uniforms = getWindUniforms()
  assert.equal(uniforms, getWindUniforms(), 'uniforms object is stable')
  const state = getWindState()
  const before = state.time
  for (let i = 0; i < 120; i++) stepWind(1 / 60)
  assert.ok(state.time > before + 1.9 && state.time < before + 2.1)
  assert.equal(uniforms.uWindTime.value, state.time)
  assert.equal(uniforms.uGust.value, state.gust)
  assert.equal(uniforms.uWindDir.value, state.direction, 'direction uniform shares the state vector')
  assert.ok(Math.abs(state.direction.length() - 1) < 1e-6, 'direction stays unit length')
  const frozen = state.time
  stepWind(0.5, { hidden: true })
  assert.equal(state.time, frozen, 'hidden tab does not advance the clock')
  stepWind(10)
  assert.ok(state.time - frozen <= 0.05 + 1e-9, 'huge deltas are clamped')
  for (let i = 0; i < 240; i++) stepWind(1 / 60, { reducedMotion: true })
  assert.ok(state.strength < 0.02, 'reduced motion fades the wind out')
  assert.equal(uniforms.uWindStrength.value, state.strength)
  for (let i = 0; i < 240; i++) stepWind(1 / 60)
  assert.ok(state.strength > 0.98)
  assert.ok(windLevel(1, 0) === 0.5 && windLevel(1, 1) === 1 && windLevel(0, 1) === 0)
})

test('applyWindToMaterial patches the lit material and yields a matching depth material', () => {
  const material = new THREE.MeshStandardMaterial({ alphaTest: 0.45, side: THREE.DoubleSide })
  const { depthMaterial, key } = applyWindToMaterial(material, { stiffness: 0.35, heightRange: [1.4, 4.6], amplitude: 0.18 })
  assert.equal(depthMaterial.alphaTest, 0.45)
  assert.equal(depthMaterial.side, THREE.DoubleSide)
  assert.equal(depthMaterial.depthPacking, THREE.RGBADepthPacking)
  assert.equal(material.customProgramCacheKey(), key)
  assert.notEqual(depthMaterial.customProgramCacheKey(), key)
  const fabric = applyWindToMaterial(new THREE.MeshStandardMaterial(), { stiffness: 0.15, heightRange: [-0.35, 0.35], invert: true })
  assert.notEqual(fabric.key, key, 'different options never share a program cache key')
  for (const target of [material, depthMaterial, fabric.material, fabric.depthMaterial]) {
    const shader = { uniforms: {} as Record<string, THREE.IUniform>, vertexShader: '#include <begin_vertex>\n#include <project_vertex>', fragmentShader: '' }
    target.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
    assert.equal(shader.uniforms.uWindDir, getWindUniforms().uWindDir, 'consumer shares the wind uniform objects')
    assert.ok(shader.vertexShader.includes('windDisplace('))
    assert.ok(shader.vertexShader.includes('#include <begin_vertex>'), 'keeps the original begin_vertex so skinning/morph chunks still work')
  }
  const shader = { uniforms: {}, vertexShader: '#include <begin_vertex>', fragmentShader: '' }
  fabric.material.onBeforeCompile(shader as unknown as THREE.WebGLProgramParametersWithUniforms, {} as THREE.WebGLRenderer)
  assert.ok(shader.vertexShader.includes('windH = 1.0 - windH'), 'fabric inverts the height factor (anchored at the top)')
  assert.ok(WIND_GLSL.includes('uniform vec2 uWindDir') && WIND_GLSL.includes('uniform float uGust'))
})
