// Focused locomotion checks: clip inventory/stride calibration, state machine edges, unified collider spec,
// Mixamo drop-in retargeting. Run: node --test locomotion.test.ts   (Node 22.18+ type stripping)
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AnimationClip, Bone, Group, QuaternionKeyframeTrack, VectorKeyframeTrack } from 'three'
import { inspectLocomotionClips } from './scripts/inspect-locomotion-clips.mjs'
import { CAMERA, DEG, LOCOMOTION, MODEL_OFFSET_Y, PLAYER_BODY, PLAYER_CENTER_HEIGHT, SPAWN_POSITION, WALK_CLIP, pickCameraSwing } from './src/characters/playerBody.ts'
import { DEFAULT_RULES, LocomotionMachine } from './src/characters/locomotionState.ts'
import { CAMERA_BLOCKING_MIN_HEIGHT, CAMERA_COLLIDERS, COLLIDER_SPECS, DOORWAY, FLOOR_TOP_Y, PHYSICS_COLLIDERS, ROOM_FOOTPRINT, S2_FALSE_CEILING, S3_INVESTOR_CHAIRS, colliderCenter, overlapsXZ, sceneExtraColliders, type ColliderScene } from './src/world/colliderSpec.ts'
import { SCENE_COLLIDERS } from './src/engine/firstPerson.ts'
import { hipsFrame, retargetClip, skeletonBoneMap } from './src/characters/animationManifest.ts'

const GLB = new URL('./public/assets/characters/sergio-player.glb', import.meta.url).pathname
const report = await inspectLocomotionClips(GLB)
const close = (actual: number, expected: number, tolerance: number, label: string) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected} ±${tolerance}`)

test('clip inventory: 4 authored clips on a 67-joint mixamorig skeleton, no run/jump/fall/land', () => {
  assert.equal(report.joints, 67)
  assert.equal(report.jointPrefix, 'mixamorig')
  assert.deepEqual(report.clips.map((clip) => clip.name).sort(), ['Face_Blink_And_Speech', 'Idle', 'Talking', 'Walk'])
  const byName = Object.fromEntries(report.clips.map((clip) => [clip.name, clip]))
  assert.equal(byName.Idle.duration, 3)
  assert.equal(byName.Walk.duration, 1)
  assert.equal(byName.Idle.targets, 67)
  assert.equal(byName.Walk.targets, 67)
  assert.equal(byName.Face_Blink_And_Speech.channels, 1)
  for (const clip of report.clips) assert.equal(clip.hipsWorldY[0], clip.hipsWorldY[1], `${clip.name}: hips do not translate (in-place)`)
  assert.ok(!report.clips.some((clip) => /run|jump|fall|land/i.test(clip.name)), 'missing slots must stay missing, not renamed')
})

test('model scale: 1.83 m human with soles at y=0, capsule + float envelope matches it', () => {
  close(report.heightMetres, PLAYER_BODY.modelHeight, 0.005, 'mesh height')
  assert.equal(report.meshBounds.min[1], 0, 'soles at the model origin')
  close(report.rest.hips[1], 0.9947, 0.002, 'rest hips height')
  close(report.rest.leftFoot[1], 0.117, 0.002, 'ankle height')
  close(report.rest.leftToe[1], 0.016, 0.005, 'toe height')
  const envelope = 2 * (PLAYER_BODY.capsuleHalfHeight + PLAYER_BODY.capsuleRadius) + PLAYER_BODY.floatHeight
  close(envelope, 1.8, 0.001, 'capsule + float')
  assert.equal(MODEL_OFFSET_Y, -PLAYER_CENTER_HEIGHT, 'model root hangs exactly one centre-height below the body')
  close(SPAWN_POSITION.y, FLOOR_TOP_Y + PLAYER_CENTER_HEIGHT + 0.02, 1e-9, 'spawn at floating equilibrium')
  assert.ok(!PHYSICS_COLLIDERS.some((box) => overlapsXZ(box, { x: SPAWN_POSITION.x, z: SPAWN_POSITION.z, width: 2 * PLAYER_BODY.capsuleRadius, depth: 2 * PLAYER_BODY.capsuleRadius })), 'spawn footprint is free of colliders')
})

test('walk stride calibration matches the constants the animator uses', () => {
  assert.ok(report.walk)
  close(report.walk.stepMetres, WALK_CLIP.stepMetres, 0.002, 'step')
  assert.equal(report.walk.cycleSeconds, WALK_CLIP.cycleSeconds)
  close(report.walk.naturalSpeedMps, WALK_CLIP.naturalSpeed, 0.004, 'natural speed')
  close(report.walk.midStrideTime, WALK_CLIP.midStrideTime, 0.01, 'mid-stride time')
  // Honest limitation: the authored loop is a shuffle, so foot-matched playback saturates at the 1.6x clamp above 0.3 m/s.
  assert.ok(WALK_CLIP.naturalSpeed * 1.6 < LOCOMOTION.walkThreshold + 0.05)
  console.log(JSON.stringify({ height: report.heightMetres, rest: report.rest, walk: report.walk, clips: report.clips.map((clip) => ({ name: clip.name, duration: clip.duration, stride: [clip.strideLeft, clip.strideRight], footLift: clip.footLift })) }))
})

const frames = (machine: LocomotionMachine, count: number, sample: { speed: number; grounded: boolean; verticalVelocity?: number; runActive?: boolean }) => {
  const events: string[] = []
  let last = machine.state
  for (let i = 0; i < count; i++) {
    const step = machine.update({ speed: sample.speed, grounded: sample.grounded, verticalVelocity: sample.verticalVelocity ?? 0, runActive: sample.runActive ?? false, dt: 1 / 60 })
    if (step.event) events.push(step.event)
    last = step.state
  }
  return { events, state: last }
}

test('state machine: speed-driven idle/walk/run, wall push stays idle, run needs Shift and speed', () => {
  const machine = new LocomotionMachine({ ...DEFAULT_RULES, walkThreshold: LOCOMOTION.walkThreshold, runThreshold: LOCOMOTION.runThreshold })
  assert.equal(frames(machine, 5, { speed: 0.05, grounded: true }).state, 'idle', 'pushing into a wall (~0 planar speed) is idle')
  assert.equal(frames(machine, 5, { speed: 2.1, grounded: true }).state, 'walk')
  assert.equal(frames(machine, 5, { speed: 4.4, grounded: true, runActive: false }).state, 'walk', 'fast without Shift is still walk')
  assert.equal(frames(machine, 5, { speed: 3.0, grounded: true, runActive: true }).state, 'walk', 'Shift below the midpoint speed is walk')
  assert.equal(frames(machine, 5, { speed: 4.4, grounded: true, runActive: true }).state, 'run')
  assert.equal(frames(machine, 5, { speed: 0.25, grounded: true }).state, 'walk', 'hysteresis: stays walking between 0.18 and 0.3')
  assert.equal(frames(machine, 5, { speed: 0.1, grounded: true }).state, 'idle')
  const blend = machine.update({ speed: 0.15, grounded: true, verticalVelocity: 0, runActive: false, dt: 1 / 60 }).walkBlend
  close(blend, 0.5, 1e-9, 'blend is speed / walkThreshold')
})

test('state machine: one takeoff and one landing per physical jump, jitter debounced, never idle in the air', () => {
  const machine = new LocomotionMachine(DEFAULT_RULES)
  frames(machine, 10, { speed: 2, grounded: true })
  const takeoff = frames(machine, 1, { speed: 2, grounded: false, verticalVelocity: 4 })
  assert.deepEqual(takeoff.events, ['takeoff'], 'jump edge accepted immediately')
  assert.equal(takeoff.state, 'jump_takeoff')
  const air = frames(machine, 30, { speed: 2, grounded: false, verticalVelocity: -1 })
  assert.deepEqual(air.events, [])
  assert.equal(air.state, 'airborne')
  // Rapier jitter: 2 frames grounded then airborne again must not land
  const jitter = frames(machine, 2, { speed: 2, grounded: true })
  assert.deepEqual(jitter.events, [])
  assert.equal(frames(machine, 3, { speed: 2, grounded: false, verticalVelocity: -2 }).state, 'airborne')
  const landing = frames(machine, 8, { speed: 2, grounded: true })
  assert.deepEqual(landing.events, ['land'], 'landing accepted after the 80 ms debounce')
  assert.equal(landing.state, 'land')
  assert.equal(frames(machine, 20, { speed: 2, grounded: true }).state, 'walk', 'locomotion resumes after the land window')
  assert.equal(machine.takeoffs, 1)
  assert.equal(machine.landings, 1)
  // falling off an edge (no upward velocity) needs the debounce and goes straight to airborne
  const fall = frames(machine, 6, { speed: 1, grounded: false, verticalVelocity: -0.5 })
  assert.deepEqual(fall.events, ['takeoff'])
  assert.equal(fall.state, 'airborne')
  assert.equal(machine.takeoffs, 2)
})

test('collider spec: every volume has a positive explicit height, both consumers share it, doorway is open', () => {
  assert.equal(COLLIDER_SPECS.filter((spec) => spec.kind !== 'door' && spec.kind !== 'fence').length, SCENE_COLLIDERS.length, 'one spec per scene footprint')
  for (const spec of COLLIDER_SPECS) {
    assert.ok(spec.height > 0, `${spec.kind} at ${spec.x},${spec.z} has height ${spec.height}`)
    assert.ok(spec.width > 0 && spec.depth > 0)
    assert.equal(spec.blocksCamera, !spec.traversable && spec.kind !== 'fence' && spec.height >= CAMERA_BLOCKING_MIN_HEIGHT, 'camera obstruction derives from the same height (invisible perimeter excepted)')
  }
  assert.ok(CAMERA_COLLIDERS.every((spec) => PHYSICS_COLLIDERS.includes(spec)), 'camera meshes are a subset of the physics volumes')
  assert.ok(CAMERA_COLLIDERS.every((spec) => spec.height >= CAMERA_BLOCKING_MIN_HEIGHT))
  assert.ok(PHYSICS_COLLIDERS.filter((spec) => spec.kind === 'furniture' || spec.kind === 'crate').every((spec) => !spec.blocksCamera), 'low furniture never pulls the camera in')
  assert.ok(DOORWAY.traversable && !DOORWAY.blocksCamera)
  assert.ok(DOORWAY.width >= 0.9, 'doorway is at least 0.9 m wide')
  assert.ok(!PHYSICS_COLLIDERS.includes(DOORWAY))
  assert.ok(!PHYSICS_COLLIDERS.some((spec) => overlapsXZ(spec, DOORWAY)), 'no physics volume intrudes into the doorway')
  const glass = COLLIDER_SPECS.filter((spec) => spec.kind === 'glass').sort((a, b) => a.x - b.x)
  assert.equal(glass.length, 2)
  close(glass[1].x - glass[1].width / 2 - (glass[0].x + glass[0].width / 2), DOORWAY.width, 1e-9, 'doorway width equals the gap between the glass walls')
  const walls = COLLIDER_SPECS.filter((spec) => spec.kind === 'wall')
  assert.equal(walls.length, 3)
  assert.ok(walls.every((spec) => spec.height === 3.8))
})

test('scene extras: S2/devin false ceiling over the room footprint, S3 investor chairs, doorway stays open everywhere', () => {
  // the room footprint really is the span of the wall colliders
  const walls = COLLIDER_SPECS.filter((spec) => spec.kind === 'wall')
  const glass = COLLIDER_SPECS.filter((spec) => spec.kind === 'glass')
  close(Math.min(...walls.map((w) => w.x)), ROOM_FOOTPRINT.x - ROOM_FOOTPRINT.width / 2, 1e-9, 'left wall at the footprint edge')
  close(Math.max(...walls.map((w) => w.x)), ROOM_FOOTPRINT.x + ROOM_FOOTPRINT.width / 2, 1e-9, 'right wall at the footprint edge')
  close(Math.min(...walls.map((w) => w.z)), ROOM_FOOTPRINT.z - ROOM_FOOTPRINT.depth / 2, 1e-9, 'back wall at the footprint edge')
  close(glass[0].z, ROOM_FOOTPRINT.z + ROOM_FOOTPRINT.depth / 2, 1e-9, 'glass front at the footprint edge')
  for (const scene of ['S2', 'devin'] as ColliderScene[]) {
    const extras = sceneExtraColliders(scene)
    assert.deepEqual(extras, [S2_FALSE_CEILING], `${scene}: exactly the false ceiling`)
    assert.equal(S2_FALSE_CEILING.kind, 'ceiling')
    close(S2_FALSE_CEILING.y ?? 0, 2.5, 1e-9, 'ceiling underside at 2.5 m')
    assert.ok((S2_FALSE_CEILING.y ?? 0) > 2 * (PLAYER_BODY.capsuleHalfHeight + PLAYER_BODY.capsuleRadius) + PLAYER_BODY.floatHeight, 'the standing player fits under it')
    assert.ok(S2_FALSE_CEILING.y! + 0.02 >= 2.485, 'not below the visual slab underside (SceneEnvironment ceiling 2.56 - 0.075)')
    assert.ok(S2_FALSE_CEILING.blocksCamera, 'the orbit camera must stay under the apartment ceiling')
    assert.equal(S2_FALSE_CEILING.width, 12); assert.equal(S2_FALSE_CEILING.depth, 8)
    assert.deepEqual(colliderCenter(S2_FALSE_CEILING), [0, 2.5 + S2_FALSE_CEILING.height / 2, -4], 'cuboid centre honours the elevated bottom')
  }
  const s3 = sceneExtraColliders('S3')
  assert.deepEqual(s3, S3_INVESTOR_CHAIRS)
  assert.equal(s3.length, 2)
  assert.deepEqual(s3.map((c) => c.x).sort((a, b) => a - b), [-1.8, 1.8])
  for (const chair of s3) {
    assert.equal(chair.z, -3.9)
    assert.deepEqual([chair.width, chair.depth, chair.height], [0.6, 0.6, 0.9])
    assert.equal(chair.kind, 'furniture')
    assert.equal(chair.blocksCamera, false, 'waist-high chairs never pull the camera in')
    assert.equal(chair.traversable, false)
    assert.ok(!PHYSICS_COLLIDERS.some((spec) => overlapsXZ(spec, chair)), 'chairs sit clear of the conference table and founder chairs')
    assert.deepEqual(colliderCenter(chair), [chair.x, 0.45, -3.9], 'floor-standing volumes keep their centre at height / 2')
  }
  assert.deepEqual(sceneExtraColliders('S1'), [], 'the coworking space has no extras')
  assert.ok(!sceneExtraColliders('S1').some((s) => s.kind === 'ceiling') && !sceneExtraColliders('S3').some((s) => s.kind === 'ceiling'), 'ceiling only in the apartment')
  assert.ok(!sceneExtraColliders('S2').some((s) => s.z === -3.9) && !sceneExtraColliders('devin').some((s) => s.z === -3.9), 'chairs only in the investor room')
  for (const scene of ['S1', 'S2', 'S3', 'devin'] as ColliderScene[]) {
    const all = [...PHYSICS_COLLIDERS, ...sceneExtraColliders(scene)]
    assert.ok(!all.some((spec) => spec.kind !== 'ceiling' && overlapsXZ(spec, DOORWAY)), `${scene}: nothing on the floor intrudes into the doorway`)
    assert.ok(!all.some((spec) => overlapsXZ(spec, { x: SPAWN_POSITION.x, z: SPAWN_POSITION.z, width: 2 * PLAYER_BODY.capsuleRadius, depth: 2 * PLAYER_BODY.capsuleRadius }) && (spec.y ?? 0) < 2), `${scene}: spawn footprint stays free`)
    const keys = all.map((spec) => `${spec.kind}:${spec.x},${spec.z}`)
    assert.equal(new Set(keys).size, keys.length, `${scene}: WorldColliders keys stay unique`)
  }
})

/**
 * Synthetic clearance for `pickCameraSwing`: the player stands `wallDistance` in front of an infinite wall and the
 * camera sits on the wall side at azimuth 0 (the Phase 1 glass-corner route: 0.375 m from the glass, polar 1.15).
 * Optional `ceiling` caps every direction (the S2 false ceiling at 2.5 m above a 1.35 m target, polar 1.15 -> 2.82 m).
 */
function wallClearance({ wallDistance, polar = CAMERA.defaultPolar, preferred = CAMERA.distance, ceiling = Infinity }: { wallDistance: number; polar?: number; preferred?: number; ceiling?: number }) {
  return (offsetRad: number) => {
    const horizontal = Math.sin(polar)
    const toward = horizontal * Math.cos(offsetRad)      // component of the unit orbit direction toward the wall
    const wall = toward > 1e-9 ? wallDistance / toward : Infinity
    const ceilingHit = Math.cos(polar) > 1e-9 ? ceiling / Math.cos(polar) : Infinity
    return Math.min(preferred, wall, ceilingHit)
  }
}

test('camera swing-around: hugging a wall picks the smallest clear azimuth, open space stays put, no mid-swing reversal', () => {
  assert.deepEqual(CAMERA.swingOffsetsDeg, [20, 40, 60, 80, 90])
  close(CAMERA.swingRate, Math.PI / 2, 1e-12, 'bounded at 90 deg/s')
  assert.ok(CAMERA.riseMinPolar >= 0.55 && CAMERA.riseMinPolar < CAMERA.defaultPolar, 'automatic rise stops at a side view')
  // Phase 1 corner: 0.375 m from the glass; cos(offset) must drop below 0.375 / (3.2 sin 1.15) = 0.128 -> only 90 deg clears fully
  const corner = wallClearance({ wallDistance: 0.375 })
  assert.ok(corner(0) < CAMERA.minObstructedDistance, 'the straight-on view is inside the character (hard obstruction)')
  assert.ok(corner(60 * DEG) < CAMERA.minDistance, '+-60 deg cannot clear a hugged wall (why the probe list runs to 90 deg)')
  const pick = pickCameraSwing(corner, CAMERA.distance)
  assert.equal(pick, 90 * DEG, 'first sign tried is +, smallest fully clear offset is 90 deg')
  // once swinging with -, the picker never flips to + mid-way
  assert.equal(pickCameraSwing(corner, CAMERA.distance, -1), -90 * DEG)
  // a little further from the wall (1.2 m) the 80 deg probe clears at 3.2 m: pick the smaller offset
  assert.equal(pickCameraSwing(wallClearance({ wallDistance: 1.2 }), CAMERA.distance), 80 * DEG)
  // 0.8 m from the wall: 60 deg gives only 1.75 m, 80 deg the full 3.2 m -> 80 (full clearance beats a smaller partial offset)
  assert.equal(pickCameraSwing(wallClearance({ wallDistance: 0.8 }), CAMERA.distance), 80 * DEG)
  // open space: nothing beats the current view
  assert.equal(pickCameraSwing(() => CAMERA.distance, CAMERA.distance), null)
  // camera already wall-parallel (offset 0 fully clear): stays
  assert.equal(pickCameraSwing((o) => (Math.abs(o) < 1e-9 ? CAMERA.distance : 1), CAMERA.distance), null)
  // S2 false ceiling caps every direction at 2.82 m: an unobstructed apartment view never starts a swing
  const apartment = wallClearance({ wallDistance: Infinity, ceiling: 2.5 - PLAYER_BODY.cameraTargetHeight })
  close(apartment(0), (2.5 - 1.35) / Math.cos(1.15), 1e-6, 'ceiling-limited orbit radius')
  assert.equal(pickCameraSwing(apartment, CAMERA.distance), null)
  // ...but a wall under that ceiling still triggers the swing through the 60% acceptance pass: nothing reaches 3.2 m,
  // 80 deg already gives 0.375 / (sin 1.15 cos 80) = 2.37 m >= 1.92 -> the smaller acceptable offset wins over 90
  const apartmentCorner = (o: number) => Math.min(wallClearance({ wallDistance: 0.375 })(o), apartment(o))
  assert.equal(pickCameraSwing(apartmentCorner, CAMERA.distance), 80 * DEG)
  // the swing gain: a probe only marginally better than the current view is ignored
  assert.equal(pickCameraSwing((o) => (Math.abs(o) < 1e-9 ? 1.9 : 1.93), CAMERA.distance), null)
})

function fakeSkeleton() {
  const root = new Group()
  const armature = new Group()
  armature.rotation.x = Math.PI / 2   // Blender-style export: local -Z is world up
  armature.scale.setScalar(0.01)
  const hips = new Bone(); hips.name = 'mixamorigHips'; hips.position.set(0, 0, -100)
  const spine = new Bone(); spine.name = 'mixamorigSpine'; spine.position.set(0, 10, 0)
  const head = new Bone(); head.name = 'mixamorigHead'
  hips.add(spine); spine.add(head); armature.add(hips); root.add(armature)
  return { root, hips }
}

test('mixamo drop-in: bone names normalised, hips bob rescaled along the rig up axis, X/Z pinned, poor coverage rejected', () => {
  const { root } = fakeSkeleton()
  const map = skeletonBoneMap(root)
  assert.equal(map.get('hips'), 'mixamorigHips')
  const frame = hipsFrame(root, 'mixamorigHips')!
  close(frame.restHeight, 1, 1e-6, 'rest hips at 1 m')
  close(frame.upLocal.z, -100, 1e-6, 'world up is local -Z in rig units')
  const fbxRestHipsY = 96
  const source = new AnimationClip('mixamo.com', 1, [
    new VectorKeyframeTrack('mixamorig:Hips.position', [0, 0.5, 1], [3, 96, -7, 5, 100, -9, 3, 96, -7]),
    new QuaternionKeyframeTrack('mixamorig:Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new QuaternionKeyframeTrack('mixamorig:Spine.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new QuaternionKeyframeTrack('mixamorig:Head.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1]),
    new VectorKeyframeTrack('mixamorig:Spine.position', [0, 1], [0, 10, 0, 0, 10, 0]),
  ])
  const result = retargetClip(source, 'run', map, frame, fbxRestHipsY)
  assert.ok(result.clip)
  assert.equal(result.clip.name, 'manifest:run')
  assert.equal(result.clip.userData.slot, 'run')
  assert.equal(result.coverage, 1)
  assert.deepEqual(result.dropped, ['mixamorig:Spine.position'], 'non-hips position tracks are dropped')
  const hipsTrack = result.clip.tracks.find((track) => track.name === 'mixamorigHips.position')!
  const values = Array.from(hipsTrack.values)
  assert.deepEqual(values.slice(0, 3), [0, 0, -100], 'frame 0 at rest: X/Z pinned, no root travel')
  close(values[3], 0, 1e-9, 'x pinned')
  close(values[4], 0, 1e-9, 'y (forward in this rig) pinned')
  close(values[5], -100 - 4 * (1 / 96) * 100, 1e-3, '4 cm bob -> 4/96 of rest height along -Z (Float32 track)')
  assert.ok(result.clip.tracks.some((track) => track.name === 'mixamorigSpine.quaternion'))
  const stranger = new AnimationClip('other', 1, [
    new QuaternionKeyframeTrack('mixamorig:Hips.quaternion', [0], [0, 0, 0, 1]),
    new QuaternionKeyframeTrack('Bip01_Pelvis.quaternion', [0], [0, 0, 0, 1]),
    new QuaternionKeyframeTrack('Bip01_Spine.quaternion', [0], [0, 0, 0, 1]),
  ])
  const rejected = retargetClip(stranger, 'idle', map, frame, fbxRestHipsY)
  assert.equal(rejected.clip, null)
  close(rejected.coverage, 1 / 3, 1e-9, 'coverage reported for the warning')
})
