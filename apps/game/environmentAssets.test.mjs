import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'

const root = new URL('./public/assets/environment/', import.meta.url)

test('environment maps are local, verified CC0 files within the transfer budget', () => {
  const manifest = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8'))
  assert.equal(manifest.provider, 'Poly Haven')
  let bytes = 0
  for (const file of manifest.files.filter((file) => file.file.startsWith('public/'))) {
    const data = readFileSync(new URL(file.file, import.meta.url))
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256)
    assert.equal(file.license, 'CC0-1.0')
    bytes += data.length
  }
  assert.ok(bytes < 10_000_000, `Surface and lighting budget: ${bytes}`)
  for (const kind of ['brick', 'concrete']) {
    const color = readFileSync(new URL(`${kind}-color.jpg`, root))
    const normal = readFileSync(new URL(`${kind}-normal.jpg`, root))
    const roughness = readFileSync(new URL(`${kind}-roughness.jpg`, root))
    assert.notDeepEqual(normal, color)
    assert.notDeepEqual(roughness, color)
  }
})

test('tree is a self-contained optimized model, not the source high-poly export', () => {
  const data = readFileSync(new URL('courtyard-tree.glb', root))
  assert.equal(data.readUInt32LE(0), 0x46546c67)
  assert.ok(statSync(new URL('courtyard-tree.glb', root)).size < 8_000_000)
  const length = data.readUInt32LE(12)
  const gltf = JSON.parse(data.subarray(20, 20 + length).toString())
  let triangles = 0
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    triangles += gltf.accessors[primitive.indices].count / 3
  }
  assert.ok(triangles > 1000 && triangles < 150000, `Tree triangles: ${triangles}`)
  assert.ok(gltf.images.length > 0)
  assert.ok(gltf.images.every((image) => image.bufferView !== undefined && !image.uri))
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri))
  const evidence = JSON.parse(readFileSync(new URL('courtyard-tree.json', root), 'utf8'))
  assert.equal(createHash('sha256').update(data).digest('hex'), evidence.sha256)
  assert.equal(triangles, evidence.triangles)
  const leaves = gltf.materials.find((material) => material.name.toLowerCase().includes('lea'))
  assert.ok(leaves?.pbrMetallicRoughness.baseColorTexture)
  assert.ok(['BLEND', 'MASK'].includes(leaves.alphaMode))
  const leafImage = gltf.images[gltf.textures[leaves.pbrMetallicRoughness.baseColorTexture.index].source]
  assert.equal(leafImage.mimeType, 'image/png', 'Leaf cutout alpha is retained')
  const binary = data.subarray(28 + length)
  const sizes = gltf.images.map((image) => {
    const view = gltf.bufferViews[image.bufferView]
    const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    if (image.mimeType === 'image/png') return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
    assert.equal(image.mimeType, 'image/jpeg')
    let offset = 2
    while (offset < bytes.length) {
      assert.equal(bytes[offset], 0xff)
      const marker = bytes[offset + 1]
      offset += 2
      if ([0xc0, 0xc1, 0xc2].includes(marker)) return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)]
      offset += bytes.readUInt16BE(offset)
    }
    throw new Error('Missing JPEG dimensions')
  })
  assert.ok(sizes.every((size) => size.every((dimension) => dimension <= 512)))
  console.log(JSON.stringify({ treeBytes: data.length, triangles, textures: sizes }))
})
