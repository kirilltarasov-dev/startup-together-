import assert from 'node:assert/strict'
import test from 'node:test'
import { AnimationClip, AnimationMixer, Bone, Quaternion, QuaternionKeyframeTrack } from 'three'
import { BreathingPose } from './src/characters/breathingPose.ts'

test('constant animation tracks cannot accumulate idle breathing over repeated cycles', () => {
  const joint = new Bone()
  joint.name = 'Spine1'
  const rest = new Quaternion().setFromAxisAngle({ x: 1, y: 0, z: 0 }, 0.12)
  joint.quaternion.copy(rest)
  const track = new QuaternionKeyframeTrack('Spine1.quaternion', [0, 4], [...rest.toArray(), ...rest.toArray()])
  const mixer = new AnimationMixer(joint)
  mixer.clipAction(new AnimationClip('Idle', 4, [track])).play()
  const breathing = new BreathingPose(joint)
  for (let i = 0; i < 60 * 120; i++) {
    breathing.restore()
    mixer.update(1 / 60)
    breathing.apply(Math.sin(i / 60 * Math.PI / 2) * Math.PI / 180)
    assert.ok(joint.quaternion.angleTo(rest) <= Math.PI / 180 + 1e-5, `spine drift at frame ${i}`)
  }
  breathing.restore()
  assert.ok(joint.quaternion.angleTo(rest) < 1e-3)
})

test('breathing restores an unanimated bone and preserves a newly mixed pose', () => {
  const joint = new Bone()
  const breathing = new BreathingPose(joint)
  for (let i = 0; i < 1000; i++) breathing.apply(0.01)
  assert.ok(joint.quaternion.angleTo(new Quaternion()) < 0.011)
  breathing.restore()
  const walkingPose = new Quaternion().setFromAxisAngle({ x: 0, y: 1, z: 0 }, 0.2)
  joint.quaternion.copy(walkingPose)
  breathing.apply(0.005)
  breathing.restore()
  assert.ok(joint.quaternion.angleTo(walkingPose) < 1e-7)
})
