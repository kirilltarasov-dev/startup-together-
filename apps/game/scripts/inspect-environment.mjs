import { readFile, mkdir, writeFile } from 'node:fs/promises'
const bytes = await readFile(new URL('../public/assets/environment/courtyard-tree.glb', import.meta.url))
const jsonLength = bytes.readUInt32LE(12)
const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString())
const binary = bytes.subarray(28 + jsonLength)
const output = new URL('../node_modules/.cache/runway-environment/', import.meta.url)
await mkdir(output, { recursive: true })
for (const material of gltf.materials) {
  console.log(JSON.stringify(material))
  if (!material.name.includes('lea')) continue
  const texture = gltf.textures[material.pbrMetallicRoughness.baseColorTexture.index]
  const image = gltf.images[texture.source]
  const view = gltf.bufferViews[image.bufferView]
  const pixels = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  await writeFile(new URL('leaf-texture.png', output), pixels)
}
console.log(JSON.stringify(gltf.meshes.map((mesh) => mesh.primitives.map((primitive) => ({ attributes: primitive.attributes, material: primitive.material }))), null, 2))
