// Shrinks the served courtyard assets without touching sources or characters:
//   1. courtyard-tree.glb: KHR_mesh_quantization (u16 positions, i8 normals, u16 UVs), drops the unused
//      second UV set on leaves/trunk, reorders vertices for locality and applies EXT_meshopt_compression
//      with the already-installed `meshoptimizer` encoder. Runtime decoding uses the MeshoptDecoder that
//      drei's useGLTF wires into GLTFLoader by default; textures are left as they are (already <= 512px).
//   2. courtyard.hdr: 2x box-filtered downsample of the RGBE lighting map (1024x512 -> 512x256), written as
//      run-length encoded RGBE. It is used for lighting/reflections only, not as visible background.
// Refuses to overwrite unless `--overwrite` is passed. Inputs are the Blender export / Poly Haven download; pass
// `--source <dir>` (default: public/assets/environment/) when the served files are already optimized — the script
// refuses compressed input. Evidence: node_modules/.cache/runway-environment-polish/shrink-report.json. Update
// sources.json/courtyard-tree.json afterwards (hash + bytes).
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { MeshoptEncoder } from 'meshoptimizer'

const root = new URL('../public/assets/environment/', import.meta.url)
const sourceIndex = process.argv.indexOf('--source')
const source = sourceIndex > 0 ? new URL(`${process.argv[sourceIndex + 1].replace(/\/?$/, '/')}`, `file://${process.cwd()}/`) : root
const cache = new URL('../node_modules/.cache/runway-environment-polish/', import.meta.url)
const overwrite = process.argv.includes('--overwrite')
await mkdir(cache, { recursive: true })
const sha = (data) => createHash('sha256').update(data).digest('hex')
const align4 = (n) => (n + 3) & ~3

// ---------------------------------------------------------------- GLB ---------------------------------------
function readGlb(data) {
  if (data.readUInt32LE(0) !== 0x46546c67) throw new Error('Not a GLB')
  const jsonLength = data.readUInt32LE(12)
  const json = JSON.parse(data.subarray(20, 20 + jsonLength).toString())
  const binLength = data.readUInt32LE(20 + jsonLength)
  const bin = data.subarray(28 + jsonLength, 28 + jsonLength + binLength)
  return { json, bin }
}
function writeGlb(json, bin) {
  let text = Buffer.from(JSON.stringify(json))
  while (text.length % 4) text = Buffer.concat([text, Buffer.from(' ')])
  const binPadded = Buffer.concat([bin, Buffer.alloc(align4(bin.length) - bin.length)])
  const header = Buffer.alloc(12)
  header.writeUInt32LE(0x46546c67, 0)
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + 8 + text.length + 8 + binPadded.length, 8)
  const jsonHeader = Buffer.alloc(8)
  jsonHeader.writeUInt32LE(text.length, 0)
  jsonHeader.writeUInt32LE(0x4e4f534a, 4)
  const binHeader = Buffer.alloc(8)
  binHeader.writeUInt32LE(binPadded.length, 0)
  binHeader.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, jsonHeader, text, binHeader, binPadded])
}
const COMPONENT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }
function readAccessor(gltf, bin, index) {
  const accessor = gltf.accessors[index]
  const view = gltf.bufferViews[accessor.bufferView]
  const Type = COMPONENT[accessor.componentType]
  const components = SIZE[accessor.type]
  const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  if (view.byteStride && view.byteStride !== components * Type.BYTES_PER_ELEMENT) throw new Error('Interleaved source accessors are not handled')
  return { data: new Type(bin.buffer.slice(bin.byteOffset + offset, bin.byteOffset + offset + accessor.count * components * Type.BYTES_PER_ELEMENT)), components, accessor }
}

async function shrinkTree(report) {
  const input = new URL('courtyard-tree.glb', source)
  const sourceBytes = await readFile(input)
  const { json: gltf, bin } = readGlb(sourceBytes)
  if (gltf.extensionsUsed?.includes('EXT_meshopt_compression')) throw new Error(`${input.pathname} is already meshopt-compressed; point --source at the Blender export`)
  await MeshoptEncoder.ready
  const mesh = gltf.meshes[0]
  const node = gltf.nodes.find((entry) => entry.mesh === 0)
  if (gltf.meshes.length !== 1 || !node || node.translation || node.scale || node.rotation || node.matrix) throw new Error('Expected one untransformed tree node')

  // Global bounds so every primitive shares one node transform.
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (const primitive of mesh.primitives) {
    const { accessor } = readAccessor(gltf, bin, primitive.attributes.POSITION)
    for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], accessor.min[i]); max[i] = Math.max(max[i], accessor.max[i]) }
  }
  const extent = Math.max(...max.map((value, i) => value - min[i]))
  const step = extent / 65535
  node.translation = min
  node.scale = [step, step, step]

  const chunks = [] // { bytes: Buffer(compressed), view: bufferView def }
  const fallbackOffsets = { total: 0 }
  const accessors = []
  const bufferViews = []
  let binParts = []
  let binOffset = 0
  const pushBin = (bytes) => {
    const offset = binOffset
    binParts.push(bytes, Buffer.alloc(align4(bytes.length) - bytes.length))
    binOffset += align4(bytes.length)
    return offset
  }
  // Keep every non-geometry bufferView (images) verbatim.
  const imageViews = new Map()
  for (const image of gltf.images) {
    const view = gltf.bufferViews[image.bufferView]
    const bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
    const offset = pushBin(Buffer.from(bytes))
    imageViews.set(image.bufferView, bufferViews.length)
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: view.byteLength })
  }
  for (const image of gltf.images) image.bufferView = imageViews.get(image.bufferView)

  const addCompressed = ({ bytes, count, stride, mode, target }) => {
    // Vertex codec version 0: the MeshoptDecoder bundled in three-stdlib (used by drei's useGLTF) predates the v1 vertex format.
    const encoded = mode === 'TRIANGLES' ? MeshoptEncoder.encodeIndexBuffer(bytes, count, stride) : MeshoptEncoder.encodeVertexBufferLevel(bytes, count, stride, 2, 0)
    const offset = pushBin(Buffer.from(encoded))
    const view = { buffer: 1, byteOffset: fallbackOffsets.total, byteLength: count * stride, target, extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: offset, byteLength: encoded.length, byteStride: stride, count, mode } } }
    if (mode !== 'TRIANGLES') view.byteStride = stride
    fallbackOffsets.total += align4(count * stride)
    bufferViews.push(view)
    chunks.push({ raw: count * stride, compressed: encoded.length, mode })
    return bufferViews.length - 1
  }

  for (const primitive of mesh.primitives) {
    const material = gltf.materials[primitive.material]
    const usedSets = new Set()
    for (const info of [material.pbrMetallicRoughness?.baseColorTexture, material.pbrMetallicRoughness?.metallicRoughnessTexture, material.normalTexture, material.occlusionTexture, material.emissiveTexture]) if (info) usedSets.add(info.texCoord ?? 0)
    const position = readAccessor(gltf, bin, primitive.attributes.POSITION)
    const normal = readAccessor(gltf, bin, primitive.attributes.NORMAL)
    const indices = readAccessor(gltf, bin, primitive.indices)
    const count = position.accessor.count
    const uvSets = Object.keys(primitive.attributes).filter((name) => name.startsWith('TEXCOORD_')).filter((name) => usedSets.has(Number(name.slice(9))) || name === 'TEXCOORD_0')
    const uvs = uvSets.map((name) => ({ name, ...readAccessor(gltf, bin, primitive.attributes[name]) }))

    // Vertex reorder for locality (better compression and cache behaviour); remap every attribute.
    const [remap, unique] = MeshoptEncoder.reorderMesh(new Uint32Array(indices.data), true, false)
    const remapped = (data, components, Type) => {
      const out = new Type(unique * components)
      for (let i = 0; i < count; i++) {
        const target = remap[i]
        if (target === 0xffffffff) continue
        for (let c = 0; c < components; c++) out[target * components + c] = data[i * components + c]
      }
      return out
    }
    const positions = remapped(position.data, 3, Float32Array)
    const normals = remapped(normal.data, 3, Float32Array)
    const newIndices = new Uint32Array(indices.data.length)
    for (let i = 0; i < indices.data.length; i++) newIndices[i] = remap[indices.data[i]]

    // Positions: u16 grid relative to node translation/scale. Stride 8 (6 bytes + pad) keeps 4-byte alignment.
    const positionBytes = Buffer.alloc(unique * 8)
    const qmin = [65535, 65535, 65535], qmax = [0, 0, 0]
    for (let i = 0; i < unique; i++) for (let c = 0; c < 3; c++) {
      const q = Math.max(0, Math.min(65535, Math.round((positions[i * 3 + c] - min[c]) / step)))
      positionBytes.writeUInt16LE(q, i * 8 + c * 2)
      qmin[c] = Math.min(qmin[c], q); qmax[c] = Math.max(qmax[c], q)
    }
    const positionView = addCompressed({ bytes: positionBytes, count: unique, stride: 8, mode: 'ATTRIBUTES', target: 34962 })
    primitive.attributes.POSITION = accessors.push({ bufferView: positionView, componentType: 5123, count: unique, type: 'VEC3', min: qmin, max: qmax }) - 1

    // Normals: normalized int8 with a padding byte.
    const normalBytes = Buffer.alloc(unique * 4)
    for (let i = 0; i < unique; i++) {
      const x = normals[i * 3], y = normals[i * 3 + 1], z = normals[i * 3 + 2]
      const length = Math.hypot(x, y, z) || 1
      normalBytes.writeInt8(Math.round(x / length * 127), i * 4)
      normalBytes.writeInt8(Math.round(y / length * 127), i * 4 + 1)
      normalBytes.writeInt8(Math.round(z / length * 127), i * 4 + 2)
    }
    const normalView = addCompressed({ bytes: normalBytes, count: unique, stride: 4, mode: 'ATTRIBUTES', target: 34962 })
    primitive.attributes.NORMAL = accessors.push({ bufferView: normalView, componentType: 5120, normalized: true, count: unique, type: 'VEC3' }) - 1

    for (const name of Object.keys(primitive.attributes)) if (name.startsWith('TEXCOORD_') && !uvSets.includes(name)) delete primitive.attributes[name]
    for (const uv of uvs) {
      const data = remapped(uv.data, 2, Float32Array)
      let inUnit = true
      for (const value of data) if (value < 0 || value > 1) { inUnit = false; break }
      if (inUnit) {
        const bytes = Buffer.alloc(unique * 4)
        for (let i = 0; i < unique * 2; i++) bytes.writeUInt16LE(Math.round(data[i] * 65535), i * 2)
        const view = addCompressed({ bytes, count: unique, stride: 4, mode: 'ATTRIBUTES', target: 34962 })
        primitive.attributes[uv.name] = accessors.push({ bufferView: view, componentType: 5123, normalized: true, count: unique, type: 'VEC2' }) - 1
      } else {
        const bytes = Buffer.from(data.buffer)
        const view = addCompressed({ bytes, count: unique, stride: 8, mode: 'ATTRIBUTES', target: 34962 })
        primitive.attributes[uv.name] = accessors.push({ bufferView: view, componentType: 5126, count: unique, type: 'VEC2' }) - 1
      }
    }

    const wide = unique > 65535
    const indexBytes = wide ? Buffer.from(newIndices.buffer) : Buffer.from(Uint16Array.from(newIndices).buffer)
    const indexView = addCompressed({ bytes: indexBytes, count: newIndices.length, stride: wide ? 4 : 2, mode: 'TRIANGLES', target: 34963 })
    primitive.indices = accessors.push({ bufferView: indexView, componentType: wide ? 5125 : 5123, count: newIndices.length, type: 'SCALAR' }) - 1
  }

  const binBuffer = Buffer.concat(binParts)
  gltf.accessors = accessors
  gltf.bufferViews = bufferViews
  gltf.buffers = [{ byteLength: binBuffer.length }, { byteLength: fallbackOffsets.total, extensions: { EXT_meshopt_compression: { fallback: true } } }]
  gltf.extensionsUsed = [...new Set([...(gltf.extensionsUsed ?? []), 'KHR_mesh_quantization', 'EXT_meshopt_compression'])]
  gltf.extensionsRequired = [...new Set([...(gltf.extensionsRequired ?? []), 'KHR_mesh_quantization', 'EXT_meshopt_compression'])]
  gltf.asset.generator = `${gltf.asset.generator}; RUNWAY shrink-environment-assets.mjs (quantized + meshopt)`
  const output = writeGlb(gltf, binBuffer)
  let triangles = 0
  for (const primitive of mesh.primitives) triangles += gltf.accessors[primitive.indices].count / 3
  report.tree = { before: sourceBytes.length, after: output.length, sha256Before: sha(sourceBytes), sha256After: sha(output), triangles, extent, positionStepMeters: step, chunks }
  return { input: new URL('courtyard-tree.glb', root), output }
}

// ---------------------------------------------------------------- HDR ---------------------------------------
function parseRgbe(buffer) {
  let offset = 0
  const readLine = () => {
    let end = offset
    while (buffer[end] !== 0x0a) end++
    const line = buffer.subarray(offset, end).toString('latin1')
    offset = end + 1
    return line
  }
  const header = []
  for (let line = readLine(); line !== ''; line = readLine()) header.push(line)
  const resolution = readLine().match(/^-Y (\d+) \+X (\d+)$/)
  if (!resolution || !header.includes('FORMAT=32-bit_rle_rgbe')) throw new Error(`Unsupported HDR header: ${header.join(' | ')}`)
  const height = Number(resolution[1]), width = Number(resolution[2])
  const pixels = new Uint8Array(width * height * 4)
  const scanline = new Uint8Array(width * 4)
  for (let y = 0; y < height; y++) {
    if (buffer[offset] === 2 && buffer[offset + 1] === 2 && ((buffer[offset + 2] << 8) | buffer[offset + 3]) === width) {
      offset += 4
      for (let channel = 0; channel < 4; channel++) {
        let x = 0
        while (x < width) {
          let count = buffer[offset++]
          if (count > 128) {
            count -= 128
            const value = buffer[offset++]
            for (let i = 0; i < count; i++) scanline[(x++) * 4 + channel] = value
          } else {
            for (let i = 0; i < count; i++) scanline[(x++) * 4 + channel] = buffer[offset++]
          }
        }
      }
    } else {
      scanline.set(buffer.subarray(offset, offset + width * 4))
      offset += width * 4
    }
    pixels.set(scanline, y * width * 4)
  }
  return { width, height, pixels, header }
}
const rgbeToFloat = (r, g, b, e) => e === 0 ? [0, 0, 0] : [r, g, b].map((value) => value * 2 ** (e - 136))
function floatToRgbe(r, g, b) {
  const peak = Math.max(r, g, b)
  if (peak < 1e-32) return [0, 0, 0, 0]
  const exponent = Math.ceil(Math.log2(peak))
  const scale = 2 ** (8 - exponent)
  return [Math.min(255, Math.floor(r * scale)), Math.min(255, Math.floor(g * scale)), Math.min(255, Math.floor(b * scale)), exponent + 128]
}
function encodeRgbe(width, height, pixels, header) {
  const parts = [Buffer.from(`${header.join('\n')}\n\n-Y ${height} +X ${width}\n`, 'latin1')]
  for (let y = 0; y < height; y++) {
    const line = Buffer.alloc(4 + width * 8)
    let length = 0
    line[length++] = 2; line[length++] = 2; line[length++] = width >> 8; line[length++] = width & 255
    for (let channel = 0; channel < 4; channel++) {
      let x = 0
      while (x < width) {
        let run = 1
        while (x + run < width && run < 127 && pixels[(y * width + x + run) * 4 + channel] === pixels[(y * width + x) * 4 + channel]) run++
        if (run >= 3) {
          line[length++] = 128 + run
          line[length++] = pixels[(y * width + x) * 4 + channel]
          x += run
        } else {
          let literal = 1
          while (x + literal < width && literal < 128) {
            const at = (y * width + x + literal) * 4 + channel
            if (x + literal + 2 < width && pixels[at] === pixels[at + 4] && pixels[at] === pixels[at + 8]) break
            literal++
          }
          line[length++] = literal
          for (let i = 0; i < literal; i++) line[length++] = pixels[(y * width + x + i) * 4 + channel]
          x += literal
        }
      }
    }
    parts.push(line.subarray(0, length))
  }
  return Buffer.concat(parts)
}
async function shrinkHdr(report) {
  const input = new URL('courtyard.hdr', source)
  const sourceBytes = await readFile(input)
  const { width, height, pixels, header } = parseRgbe(sourceBytes)
  if (width <= 512) { report.hdr = { skipped: `already ${width}x${height}` }; return null }
  const w = width / 2, h = height / 2
  const out = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sum = [0, 0, 0]
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = ((y * 2 + dy) * width + x * 2 + dx) * 4
      const rgb = rgbeToFloat(pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3])
      for (let c = 0; c < 3; c++) sum[c] += rgb[c] / 4
    }
    out.set(floatToRgbe(...sum), (y * w + x) * 4)
  }
  const cleanHeader = header.filter((line) => !line.startsWith('# Made with'))
  cleanHeader.splice(1, 0, '# Downsampled 2x by RUNWAY shrink-environment-assets.mjs (lighting only)')
  const output = encodeRgbe(w, h, out, cleanHeader)
  report.hdr = { before: sourceBytes.length, after: output.length, from: `${width}x${height}`, to: `${w}x${h}`, sha256Before: sha(sourceBytes), sha256After: sha(output) }
  return { input: new URL('courtyard.hdr', root), output }
}

const report = {}
const results = [await shrinkTree(report), await shrinkHdr(report)].filter(Boolean)
for (const { input, output } of results) {
  const target = new URL(input.href)
  if (existsSync(target) && !overwrite) {
    const preview = new URL(input.pathname.split('/').pop(), cache)
    await writeFile(preview, output)
    console.log(`Would overwrite ${target.pathname}; wrote preview to ${preview.pathname}. Re-run with --overwrite.`)
  } else {
    await writeFile(target, output)
    console.log(`Wrote ${target.pathname}`)
  }
}
await writeFile(new URL('shrink-report.json', cache), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
