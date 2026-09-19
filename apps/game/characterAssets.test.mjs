import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import test from 'node:test'

const bytes = await readFile(new URL('./public/assets/founders/remy-seated.glb', import.meta.url))
const report = JSON.parse(await readFile(new URL('./public/assets/founders/remy-seated.json', import.meta.url), 'utf8'))
const jsonLength = bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
const binary = bytes.subarray(28 + jsonLength)

function imageSize(image) {
  const view = gltf.bufferViews[image.bufferView]
  const data = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  if (image.mimeType === 'image/png') return [data.readUInt32BE(16), data.readUInt32BE(20)]
  assert.equal(image.mimeType, 'image/jpeg')
  let offset = 2
  while (offset < data.length) {
    if (data[offset] !== 0xff) throw new Error('Invalid JPEG marker')
    const marker = data[offset + 1]
    offset += 2
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return [data.readUInt16BE(offset + 5), data.readUInt16BE(offset + 3)]
    offset += data.readUInt16BE(offset)
  }
  throw new Error('JPEG dimensions missing')
}

test('Remy GLB is self-contained and matches conversion evidence', () => {
  assert.equal(bytes.readUInt32LE(0), 0x46546c67)
  assert.equal(bytes.readUInt32LE(4), 2)
  assert.equal(bytes.readUInt32LE(8), bytes.length)
  assert.equal(createHash('sha256').update(bytes).digest('hex'), report.outputSha256)
  assert.equal(bytes.length, report.outputBytes)
  assert.ok(bytes.length < 8 * 1024 * 1024)
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri))
  assert.ok(gltf.images.every((image) => image.bufferView !== undefined && !image.uri))
})

test('Imported skinning and authored texture channels are retained', () => {
  assert.equal(gltf.meshes.length, 7)
  assert.ok(gltf.skins.length >= 1)
  assert.ok(gltf.skins.every((skin) => skin.joints.length >= 60))
  for (const mesh of gltf.meshes) {
    for (const primitive of mesh.primitives) {
      assert.notEqual(primitive.attributes.JOINTS_0, undefined)
      assert.notEqual(primitive.attributes.WEIGHTS_0, undefined)
    }
  }
  for (const material of gltf.materials) {
    assert.ok(material.pbrMetallicRoughness.baseColorTexture)
    assert.ok(material.normalTexture)
    assert.equal(material.pbrMetallicRoughness.metallicFactor, 0)
  }
  for (const name of ['Hairmat', 'Eyelashmat']) {
    const material = gltf.materials.find((item) => item.name === name)
    assert.equal(material.alphaMode, 'BLEND')
    const texture = gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index]
    assert.equal(gltf.images[texture.source].mimeType, 'image/png')
  }
})

test('Textures fit the budget and no animation is misrepresented', () => {
  assert.equal(gltf.animations?.length ?? 0, 0)
  for (const image of gltf.images) {
    const size = imageSize(image)
    assert.ok(size.every((dimension) => dimension <= 1024), `${image.name}: ${size.join('x')}`)
  }
  console.log(JSON.stringify({ bytes: bytes.length, meshes: gltf.meshes.length, textures: gltf.images.length, sizes: gltf.images.map(imageSize) }))
})
