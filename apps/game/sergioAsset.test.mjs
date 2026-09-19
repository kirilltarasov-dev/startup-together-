import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'

const root = new URL('./public/assets/founders/', import.meta.url)

test('Sergio is an embedded, verified seated GLB with the reference outfit', () => {
  const bytes = readFileSync(new URL('sergio-seated.glb', root))
  const evidence = JSON.parse(readFileSync(new URL('sergio-seated.json', root), 'utf8'))
  assert.equal(bytes.readUInt32LE(0), 0x46546c67)
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.outputSha256)
  assert.ok(bytes.length < 12_000_000)
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
  assert.ok(gltf.skins.length >= 1)
  assert.ok(gltf.skins.every((skin) => skin.joints.length >= 60))
  assert.ok(gltf.images.length > 0)
  assert.ok(gltf.images.every((image) => image.bufferView !== undefined && !image.uri))
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri))
  assert.equal(gltf.animations?.length ?? 0, 0, 'Standing clips must not override the seated pose')
  for (const name of ['Varsity_Jacket_And_Shirt', 'Woven_Wide_Hat_Brim', 'White_Sneakers']) {
    assert.ok(gltf.nodes.some((node) => node.name === name), `Preserved ${name}`)
  }
  assert.ok(gltf.nodes.every((node) => !node.name?.startsWith('PREVIEW_ONLY_')))
  assert.equal(gltf.cameras?.length ?? 0, 0)
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    assert.notEqual(primitive.attributes.JOINTS_0, undefined)
    assert.notEqual(primitive.attributes.WEIGHTS_0, undefined)
  }
  assert.ok(evidence.seatedBoundsMeters[2][1] < 1.9)
  assert.ok(evidence.seatedBoundsMeters[2][0] > -0.15)
  assert.ok(Math.abs(evidence.hipsHeightMeters - 0.63) < 0.01)
  console.log(JSON.stringify({ bytes: bytes.length, meshes: gltf.meshes.length, bounds: evidence.seatedBoundsMeters }))
})
