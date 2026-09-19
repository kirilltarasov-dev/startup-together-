import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'

const root = new URL('./public/assets/founders/', import.meta.url)
test('third founder retains embedded textures, normalized rig and seated pose', () => {
  const bytes = readFileSync(new URL('sadman-seated.glb', root))
  const report = JSON.parse(readFileSync(new URL('sadman-seated.json', root), 'utf8'))
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF')
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.outputSha256)
  assert.equal(report.source, 'Ch06_nonPBR.fbx')
  assert.ok(bytes.length < 6000000)
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8'))
  assert.equal(json.skins[0].joints.length, 65)
  assert.ok(json.images.length > 0)
  assert.ok(json.images.every((image) => image.bufferView !== undefined && !image.uri))
  assert.ok(json.buffers.every((buffer) => !buffer.uri))
  assert.ok(json.nodes.some((node) => node.name === 'mixamorigHead' || node.name === 'mixamorig:Head'))
  assert.equal(json.animations?.length ?? 0, 0)
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
    assert.notEqual(primitive.attributes.JOINTS_0, undefined)
    assert.notEqual(primitive.attributes.WEIGHTS_0, undefined)
  }
  console.log(JSON.stringify({ bytes: bytes.length, bones: report.bones, textures: json.images.length }))
})
