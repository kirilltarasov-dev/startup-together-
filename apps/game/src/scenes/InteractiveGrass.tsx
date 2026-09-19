import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { isGrass } from '../engine/firstPerson'
import { MATERIAL, seededRandom } from './sceneMaterials'

export interface GrassInteraction {
  player: THREE.Vector2
  brush: THREE.Vector2
  strength: number
  brushing: boolean
}

export function InteractiveGrass({ interactionRef, reducedMotion }: { interactionRef: RefObject<GrassInteraction>; reducedMotion: boolean }) {
  const { geometry, material, uniforms } = useMemo(() => {
    const count = 64000
    const random = seededRandom(7319)
    const geometry = new THREE.InstancedBufferGeometry()
    const vertices: number[] = []
    const indices: number[] = []
    for (let segment = 0; segment <= 4; segment++) {
      const t = segment / 4
      const width = (1 - t) * 0.5 + 0.015
      vertices.push(-width, t, 0, width, t, 0)
      if (segment < 4) {
        const i = segment * 2
        indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
      }
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const offsets = new Float32Array(count * 3)
    const shapes = new Float32Array(count * 4)
    for (let i = 0; i < count; i++) {
      let x: number, z: number
      do { x = (random() - 0.5) * 14.3; z = 2.15 + random() * 9.95 } while (!isGrass(x, z))
      offsets.set([x, 0.015, z], i * 3)
      shapes.set([random() * Math.PI * 2, 0.12 + random() ** 2 * 0.32, 0.008 + random() * 0.012, random()], i * 4)
    }
    geometry.setAttribute('bladeOffset', new THREE.InstancedBufferAttribute(offsets, 3))
    geometry.setAttribute('bladeShape', new THREE.InstancedBufferAttribute(shapes, 4))
    geometry.instanceCount = count
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.4, 7), 11)
    const uniforms = {
      grassTime: { value: 0 },
      grassWind: { value: 1 },
      playerPosition: { value: new THREE.Vector2(0, 5) },
      brushPosition: { value: new THREE.Vector2(0, 5) },
      brushStrength: { value: 0 },
    }
    const material = new THREE.MeshStandardMaterial({ color: MATERIAL.grass, roughness: 0.92, side: THREE.DoubleSide })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = `
        attribute vec3 bladeOffset;
        attribute vec4 bladeShape;
        uniform float grassTime;
        uniform float grassWind;
        uniform vec2 playerPosition;
        uniform vec2 brushPosition;
        uniform float brushStrength;
        varying float bladeHeight;
        varying float bladeVariation;
      ` + shader.vertexShader
      shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
        vec3 objectNormal = normalize(vec3(-sin(bladeShape.x), position.y * 0.6, cos(bladeShape.x)));
      `)
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        float h = position.y;
        bladeHeight = h;
        bladeVariation = bladeShape.w;
        float angle = bladeShape.x;
        vec3 transformed = vec3(position.x * bladeShape.z * cos(angle), h * bladeShape.y, position.x * bladeShape.z * sin(angle));
        float wind = sin(grassTime * 1.6 + bladeOffset.x * 0.65 + bladeOffset.z * 0.42) * 0.045;
        wind += sin(grassTime * 2.7 + bladeOffset.z * 1.8) * 0.018;
        transformed.xz += vec2(cos(angle), sin(angle)) * (0.04 + bladeShape.w * 0.1) * h * h;
        transformed.xz += vec2(0.75, 0.4) * wind * grassWind * h * h;
        vec2 footDelta = bladeOffset.xz - playerPosition;
        float footDistance = length(footDelta);
        float footBend = (1.0 - smoothstep(0.1, 0.72, footDistance)) * 0.38;
        vec2 brushDelta = bladeOffset.xz - brushPosition;
        float brushDistance = length(brushDelta);
        float brushBend = (1.0 - smoothstep(0.05, 0.75, brushDistance)) * brushStrength * 0.48;
        transformed.xz += (footDelta / max(footDistance, 0.01) * footBend + brushDelta / max(brushDistance, 0.01) * brushBend) * h * h;
        transformed.y *= 1.0 - min(0.7, (footBend + brushBend) * 1.4) * h;
        transformed += bladeOffset;
      `)
      shader.fragmentShader = 'varying float bladeHeight; varying float bladeVariation;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(vec3(0.3, 0.38, 0.23), vec3(1.12, 1.08, 0.72), bladeHeight);
        diffuseColor.rgb *= 0.78 + bladeVariation * 0.42;
      `)
    }
    material.customProgramCacheKey = () => 'runway-reactive-grass-v1'
    return { geometry, material, uniforms }
  }, [])
  const uniformsRef = useRef(uniforms)
  useEffect(() => () => { geometry.dispose(); material.dispose() }, [geometry, material])
  useFrame((_, delta) => {
    uniformsRef.current.grassTime.value += Math.min(delta, 0.05)
    uniformsRef.current.grassWind.value = reducedMotion ? 0 : 1
    uniformsRef.current.playerPosition.value.copy(interactionRef.current.player)
    uniformsRef.current.brushPosition.value.copy(interactionRef.current.brush)
    uniformsRef.current.brushStrength.value = interactionRef.current.strength
  })
  return <mesh geometry={geometry} material={material} receiveShadow />
}
