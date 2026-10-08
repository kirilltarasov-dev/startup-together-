import { Quaternion, type Object3D } from 'three'

/** Remove our previous offset before the mixer runs: constant tracks need not rewrite a bone. */
export class BreathingPose {
  private base = new Quaternion()
  private offset = new Quaternion()
  private applied = false

  private joint: Object3D

  constructor(joint: Object3D) { this.joint = joint }

  restore(): void {
    if (this.applied) this.joint.quaternion.copy(this.base)
    this.applied = false
  }

  apply(angle: number): void {
    this.restore()
    this.base.copy(this.joint.quaternion)
    this.offset.set(Math.sin(angle / 2), 0, 0, Math.cos(angle / 2))
    this.joint.quaternion.multiply(this.offset)
    this.applied = true
  }
}
