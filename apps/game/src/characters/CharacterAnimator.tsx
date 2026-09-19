import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { AnimationMixer, type AnimationAction, type AnimationClip, type Object3D } from 'three'
import type { EcctrlHandle } from 'ecctrl'

export function CharacterAnimator({ model, clips, controller, paused }: { model: Object3D; clips: AnimationClip[]; controller: RefObject<EcctrlHandle | null>; paused: boolean }) {
  const mixer = useMemo(() => new AnimationMixer(model), [model])
  const current = useRef<AnimationAction | null>(null)
  const actions = useMemo(() => {
    const clip = (name: string) => clips.find((item) => item.name.toLowerCase().includes(name.toLowerCase()))
    return { idle: clip('Idle') ? mixer.clipAction(clip('Idle')!) : null, walk: clip('Walk') ? mixer.clipAction(clip('Walk')!) : null }
  }, [clips, mixer])
  useEffect(() => () => { mixer.stopAllAction(); mixer.uncacheRoot(model) }, [mixer, model])
  useFrame((_, delta) => {
    const body = controller.current
    const target = body?.isMoving && body.isOnGround ? actions.walk : actions.idle
    if (target && target !== current.current) {
      target.reset().fadeIn(0.18).play()
      current.current?.fadeOut(0.18)
      current.current = target
    }
    if (current.current) current.current.timeScale = body?.runActive && body.isOnGround ? 1.5 : 1
    if (!paused && !document.hidden) mixer.update(Math.min(delta, 0.05))
    else if (current.current && mixer.time === 0) mixer.update(0.001)
  })
  return null
}
