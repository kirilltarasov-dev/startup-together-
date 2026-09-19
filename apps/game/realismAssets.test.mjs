import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const root = new URL('./public/assets/realism/', import.meta.url)
const evidence = JSON.parse(readFileSync(new URL('exports.json', root), 'utf8'))
const assets = evidence.assets.map((asset) => {
  const bytes = readFileSync(new URL(asset.file, root))
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'))
  return { ...asset, bytes, json }
})

test('realism assets are self-contained, licensed, and match conversion evidence', () => {
  assert.equal(assets.length, 3)
  for (const asset of assets) {
    assert.equal(asset.license, 'CC0-1.0')
    assert.equal(createHash('sha256').update(asset.bytes).digest('hex'), asset.sha256)
    assert.ok(asset.json.images.length > 0)
    assert.ok(asset.json.images.every((image) => image.bufferView !== undefined && !image.uri))
    assert.ok(asset.json.buffers.every((buffer) => !buffer.uri))
    assert.equal(asset.json.animations?.length ?? 0, 0)
  }
})

test('selected facade modules and furniture fit bounded geometry/download budgets', () => {
  const facade = assets.find((asset) => asset.file === 'facade-kit.glb')
  for (const name of ['FacadeWide', 'FacadeNarrow', 'FacadeDoor', 'FacadeCornice', 'FacadeBase']) {
    assert.ok(facade.json.nodes.some((node) => node.name === name), name)
  }
  let total = 0
  for (const asset of assets) {
    total += asset.bytes.length
    const triangles = asset.json.meshes.flatMap((mesh) => mesh.primitives).reduce((sum, primitive) => sum + asset.json.accessors[primitive.indices].count / 3, 0)
    assert.equal(triangles, asset.triangles)
    assert.ok(triangles < 15000)
    assert.ok(asset.bytes.length < 6000000)
  }
  assert.ok(total < 8000000)
  console.log(JSON.stringify(assets.map(({ file, triangles, bytes }) => ({ file, triangles, bytes: bytes.length }))))
})
