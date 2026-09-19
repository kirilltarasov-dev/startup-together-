import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { MeshoptDecoder as RuntimeMeshoptDecoder } from 'three-stdlib'

const root = new URL('./public/assets/environment/', import.meta.url)

test('environment maps are local, verified CC0 files within the transfer budget', () => {
  const manifest = JSON.parse(readFileSync(new URL('sources.json', root), 'utf8'))
  assert.equal(manifest.provider, 'Poly Haven')
  let bytes = 0
  for (const file of manifest.files.filter((file) => file.file.startsWith('public/'))) {
    const data = readFileSync(new URL(file.file, import.meta.url))
    assert.equal(createHash('sha256').update(data).digest('hex'), file.sha256)
    assert.equal(file.license, 'CC0-1.0')
    assert.match(file.sourceSha256, /^[0-9a-f]{64}$/, 'upstream download hash retained next to the served re-encode')
    bytes += data.length
  }
  assert.ok(bytes < 2_500_000, `Surface and lighting budget after re-encode: ${bytes}`)
  const hdr = readFileSync(new URL('courtyard.hdr', root)).toString('latin1', 0, 200)
  assert.match(hdr, /FORMAT=32-bit_rle_rgbe/)
  assert.match(hdr, /-Y 256 \+X 512/, 'lighting map is the 512x256 downsample')
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
  assert.ok(statSync(new URL('courtyard-tree.glb', root)).size < 3_000_000, 'quantized + meshopt tree stays under 3 MB')
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
  for (const name of ['KHR_mesh_quantization', 'EXT_meshopt_compression']) assert.ok(gltf.extensionsRequired.includes(name), name)
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

test('compressed tree geometry decodes with the runtime meshopt decoder and keeps its bounds', async () => {
  // Same decoder drei's useGLTF hands to GLTFLoader (it rejects the newer vertex codec v1, so this guards the encoder settings).
  const MeshoptDecoder = typeof RuntimeMeshoptDecoder === 'function' ? RuntimeMeshoptDecoder() : RuntimeMeshoptDecoder
  await MeshoptDecoder.ready
  const data = readFileSync(new URL('courtyard-tree.glb', root))
  const length = data.readUInt32LE(12)
  const gltf = JSON.parse(data.subarray(20, 20 + length).toString())
  const binary = data.subarray(28 + length)
  const node = gltf.nodes.find((entry) => entry.mesh === 0)
  let min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const primitive of gltf.meshes[0].primitives) {
    const accessor = gltf.accessors[primitive.attributes.POSITION]
    const view = gltf.bufferViews[accessor.bufferView]
    const ext = view.extensions.EXT_meshopt_compression
    const out = new Uint8Array(ext.count * ext.byteStride)
    MeshoptDecoder.decodeGltfBuffer(out, ext.count, ext.byteStride, binary.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), ext.mode, ext.filter)
    const positions = Buffer.from(out.buffer)
    for (let i = 0; i < ext.count; i++) for (let c = 0; c < 3; c++) {
      const value = positions.readUInt16LE(i * ext.byteStride + c * 2) * node.scale[c] + node.translation[c]
      min[c] = Math.min(min[c], value); max[c] = Math.max(max[c], value)
    }
    assert.ok(!('TEXCOORD_1' in primitive.attributes) || gltf.materials[primitive.material].pbrMetallicRoughness.baseColorTexture.texCoord === 1, 'second UV set only where the material samples it')
  }
  // Source LOD1 bounds (metres): x -1.31..1.60, y -0.03..4.55, z -1.36..2.88
  assert.ok(Math.abs(min[1] - -0.0255) < 0.01 && Math.abs(max[1] - 4.5517) < 0.01, `tree height preserved: ${min[1]}..${max[1]}`)
  assert.ok(Math.abs(min[0] - -1.3103) < 0.01 && Math.abs(max[2] - 2.8848) < 0.01, `tree footprint preserved: ${min}..${max}`)
})
