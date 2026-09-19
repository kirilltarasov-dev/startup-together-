import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useState, type RefObject } from 'react'
import { Mesh, type AnimationClip, type Material, SkinnedMesh } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { EcctrlHandle } from 'ecctrl'
import { CharacterAnimator } from './CharacterAnimator'
import { characterAsset, type CharacterId } from './CharacterCustomization'
import { loadManifestClips } from './animationManifest'
import { MODEL_OFFSET_Y } from './playerBody'

export function CharacterModel({ selected, controller, paused }: { selected: CharacterId; controller: RefObject<EcctrlHandle | null>; paused: boolean }) {
  const asset = characterAsset(selected)
  const { scene, animations } = useGLTF(asset.url)
  const instance = useMemo(() => {
    const root = clone(scene)
    const materials = new Set<Material>()
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return
      object.castShadow = true
      object.receiveShadow = true
      const copy = (original: Material) => { const material = original.clone(); materials.add(material); return material }
      object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material)
    })
    return { root, materials }
  }, [scene])
  useEffect(() => () => {
    instance.materials.forEach((material) => material.dispose())
    instance.root.traverse((object) => { if (object instanceof SkinnedMesh) object.skeleton.dispose() })
  }, [instance])
  // Optional licensed drop-in clips (public/assets/animations/manifest.json); empty manifest -> no network beyond the JSON.
  const [extraClips, setExtraClips] = useState<AnimationClip[]>([])
  useEffect(() => {
    let cancelled = false
    loadManifestClips(instance.root).then((clips) => { if (!cancelled) setExtraClips(clips) })
    return () => { cancelled = true }
  }, [instance])
  const clips = useMemo(() => [...animations, ...extraClips], [animations, extraClips])
  return <group position={[0, MODEL_OFFSET_Y, 0]} name="player-human">
    <primitive object={instance.root} dispose={null} />
    <CharacterAnimator model={instance.root} clips={clips} controller={controller} paused={paused} />
  </group>
}
