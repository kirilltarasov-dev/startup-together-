import { useGLTF } from '@react-three/drei'
import { useEffect, useMemo, type RefObject } from 'react'
import { Mesh, type Material, SkinnedMesh } from 'three'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { EcctrlHandle } from 'ecctrl'
import { CharacterAnimator } from './CharacterAnimator'
import { characterAsset, type CharacterId } from './CharacterCustomization'

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
  return <group position={[0, -0.9, 0]} name="player-human">
    <primitive object={instance.root} dispose={null} />
    <CharacterAnimator model={instance.root} clips={animations} controller={controller} paused={paused} />
  </group>
}
