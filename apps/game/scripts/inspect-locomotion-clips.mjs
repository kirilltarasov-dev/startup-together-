// Clip inventory + stride calibration for a rigged GLB (no dependencies, forward kinematics on the JSON chunk).
// CLI: node scripts/inspect-locomotion-clips.mjs [path/to/model.glb]
// Module: import { inspectLocomotionClips } from './scripts/inspect-locomotion-clips.mjs'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

const COMPONENT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array }
const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }

function applyQuat(v, q) {
  const [x, y, z] = v, [qx, qy, qz, qw] = q
  const ix = qw * x + qy * z - qz * y, iy = qw * y + qz * x - qx * z, iz = qw * z + qx * y - qy * x, iw = -qx * x - qy * y - qz * z
  return [ix * qw + iw * -qx + iy * -qz - iz * -qy, iy * qw + iw * -qy + iz * -qx - ix * -qz, iz * qw + iw * -qz + ix * -qy - iy * -qx]
}
function mulQuat(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b
  return [ax * bw + aw * bx + ay * bz - az * by, ay * bw + aw * by + az * bx - ax * bz, az * bw + aw * bz + ax * by - ay * bx, aw * bw - ax * bx - ay * by - az * bz]
}
const round = (value, digits = 4) => Number(value.toFixed(digits))

export async function inspectLocomotionClips(path) {
  const bytes = await readFile(path)
  const jsonLength = bytes.readUInt32LE(12)
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'))
  const binary = bytes.subarray(28 + jsonLength)
  const readAccessor = (index) => {
    const accessor = gltf.accessors[index]
    const view = gltf.bufferViews[accessor.bufferView]
    const Type = COMPONENT[accessor.componentType]
    const size = SIZE[accessor.type]
    const start = binary.byteOffset + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const stride = view.byteStride ?? size * Type.BYTES_PER_ELEMENT
    const data = new Float64Array(accessor.count * size)
    for (let i = 0; i < accessor.count; i++) {
      const element = new Type(binary.buffer, start + i * stride, size)
      for (let c = 0; c < size; c++) data[i * size + c] = element[c]
    }
    return { data, count: accessor.count, size }
  }
  const parentOf = new Map()
  gltf.nodes.forEach((node, index) => node.children?.forEach((child) => parentOf.set(child, index)))
  const worldPosition = (index, pose) => {
    let position = [0, 0, 0], rotation = [0, 0, 0, 1], scale = [1, 1, 1]
    const chain = []
    for (let n = index; n !== undefined; n = parentOf.get(n)) chain.unshift(n)
    for (const n of chain) {
      const node = gltf.nodes[n], local = pose.get(n) ?? {}
      const t = local.translation ?? node.translation ?? [0, 0, 0], r = local.rotation ?? node.rotation ?? [0, 0, 0, 1], s = local.scale ?? node.scale ?? [1, 1, 1]
      const rotated = applyQuat([t[0] * scale[0], t[1] * scale[1], t[2] * scale[2]], rotation)
      position = [position[0] + rotated[0], position[1] + rotated[1], position[2] + rotated[2]]
      rotation = mulQuat(rotation, r)
      scale = [scale[0] * s[0], scale[1] * s[1], scale[2] * s[2]]
    }
    return position
  }
  const sample = (track, time) => {
    const { input, output } = track, n = input.count
    if (time <= input.data[0]) return Array.from(output.data.subarray(0, output.size))
    if (time >= input.data[n - 1]) return Array.from(output.data.subarray((n - 1) * output.size, n * output.size))
    let i = 0
    while (input.data[i + 1] < time) i++
    const t = (time - input.data[i]) / (input.data[i + 1] - input.data[i])
    const a = output.data.subarray(i * output.size, (i + 1) * output.size), b = output.data.subarray((i + 1) * output.size, (i + 2) * output.size)
    const out = Array.from(a, (v, k) => v + (b[k] - v) * t)
    if (output.size === 4) { const l = Math.hypot(...out); return out.map((v) => v / l) }
    return out
  }
  const find = (needle) => gltf.nodes.findIndex((node) => node.name === needle || node.name.endsWith(`:${needle}`) || node.name.endsWith(`_${needle}`))
  const HIPS = find('Hips'), LEFT = find('LeftFoot'), RIGHT = find('RightFoot'), LTOE = find('LeftToeBase'), HEAD = find('HeadTop_End')
  if (HIPS < 0 || LEFT < 0 || RIGHT < 0) throw new Error('Hips/LeftFoot/RightFoot joints not found')

  const meshBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] }
  for (const mesh of gltf.meshes) for (const primitive of mesh.primitives) {
    const accessor = gltf.accessors[primitive.attributes.POSITION]
    accessor.min.forEach((v, i) => { meshBounds.min[i] = Math.min(meshBounds.min[i], v) })
    accessor.max.forEach((v, i) => { meshBounds.max[i] = Math.max(meshBounds.max[i], v) })
  }
  const joints = gltf.skins?.[0]?.joints ?? []
  const restPose = new Map()
  const rest = { hips: worldPosition(HIPS, restPose), leftFoot: worldPosition(LEFT, restPose), rightFoot: worldPosition(RIGHT, restPose), leftToe: LTOE >= 0 ? worldPosition(LTOE, restPose) : null, headTop: HEAD >= 0 ? worldPosition(HEAD, restPose) : null }

  const clips = (gltf.animations ?? []).map((animation) => {
    const tracks = animation.channels.map((channel) => {
      const sampler = animation.samplers[channel.sampler]
      return { node: channel.target.node, path: channel.target.path, input: readAccessor(sampler.input), output: readAccessor(sampler.output) }
    })
    const duration = Math.max(...tracks.map((track) => track.input.data[track.input.count - 1]))
    const steps = 120
    const series = []
    for (let k = 0; k <= steps; k++) {
      const time = duration * k / steps
      const pose = new Map()
      for (const track of tracks) {
        if (track.path !== 'translation' && track.path !== 'rotation' && track.path !== 'scale') continue
        const entry = pose.get(track.node) ?? {}
        entry[track.path] = sample(track, time)
        pose.set(track.node, entry)
      }
      series.push({ time, hips: worldPosition(HIPS, pose), left: worldPosition(LEFT, pose), right: worldPosition(RIGHT, pose) })
    }
    const range = (key, axis) => { const values = series.map((s) => s[key][axis]); return [round(Math.min(...values)), round(Math.max(...values))] }
    const hipsTranslation = tracks.find((track) => track.node === HIPS && track.path === 'translation')
    const hipsLocalTranslationRange = hipsTranslation ? [0, 1, 2].map((axis) => { const values = []; for (let i = 0; i < hipsTranslation.output.count; i++) values.push(hipsTranslation.output.data[i * 3 + axis]); return [round(Math.min(...values)), round(Math.max(...values))] }) : null
    // Stride: peak-to-peak forward excursion of a foot relative to the hips (in-place clip => hips do not travel).
    const relative = (foot) => series.map((s) => [s[foot][0] - s.hips[0], s[foot][2] - s.hips[2]])
    const spanOf = (values) => Math.max(...values) - Math.min(...values)
    const left = relative('left')
    const forwardAxis = spanOf(left.map((v) => v[0])) > spanOf(left.map((v) => v[1])) ? 0 : 1
    const excursion = (foot) => spanOf(relative(foot).map((v) => v[forwardAxis]))
    // Mid-stride pose: the sample where the feet are furthest apart along the forward axis (double-support pose).
    const separation = series.map((s) => Math.abs(s.left[forwardAxis * 2] - s.right[forwardAxis * 2]))
    const widest = separation.indexOf(Math.max(...separation))
    return {
      name: animation.name, duration: round(duration), channels: animation.channels.length, targets: new Set(tracks.map((t) => t.node)).size,
      hipsLocalTranslationRange, hipsWorldY: range('hips', 1),
      leftFootWorld: { x: range('left', 0), y: range('left', 1), z: range('left', 2) },
      rightFootWorld: { x: range('right', 0), y: range('right', 1), z: range('right', 2) },
      forwardAxis: forwardAxis === 0 ? 'x' : 'z',
      strideLeft: round(excursion('left')), strideRight: round(excursion('right')),
      footLift: round(Math.max(spanOf(series.map((s) => s.left[1])), spanOf(series.map((s) => s.right[1])))),
      lowestFootY: round(Math.min(...series.map((s) => Math.min(s.left[1], s.right[1])))),
      midStrideTime: round(series[widest].time), midStrideSeparation: round(separation[widest]),
    }
  })
  const walk = clips.find((clip) => /walk/i.test(clip.name))
  const stepMetres = walk ? (walk.strideLeft + walk.strideRight) / 2 : null
  return {
    file: path.split('/').pop(), joints: joints.length, jointPrefix: joints.length ? gltf.nodes[joints[0]].name.split(':')[0] : null,
    meshBounds: { min: meshBounds.min.map((v) => round(v)), max: meshBounds.max.map((v) => round(v)) }, heightMetres: round(meshBounds.max[1] - meshBounds.min[1]),
    rest: Object.fromEntries(Object.entries(rest).map(([k, v]) => [k, v?.map((n) => round(n)) ?? null])),
    clips,
    // One loop swings each foot forward once => two steps per cycle => travel per cycle = 2 * step.
    walk: walk ? { stepMetres: round(stepMetres), travelPerCycleMetres: round(stepMetres * 2), cycleSeconds: walk.duration, naturalSpeedMps: round(stepMetres * 2 / walk.duration), midStrideTime: walk.midStrideTime } : null,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2] ?? new URL('../public/assets/characters/sergio-player.glb', import.meta.url).pathname
  console.log(JSON.stringify(await inspectLocomotionClips(path), null, 2))
}
