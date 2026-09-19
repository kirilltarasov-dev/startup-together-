import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { MATERIAL } from './sceneMaterials'
import { GRASS_WIND_AMPLITUDE, createGrassField, grassBounds, type GroundCoverKind } from './grassField'
import { WIND_GLSL, getWindUniforms, useWindDriver } from './wind'

declare global {
  interface Window { __runwayRendererInfo?: () => Record<string, number> }
}

export interface GrassInteraction {
  player: THREE.Vector2
  brush: THREE.Vector2
  strength: number
  brushing: boolean
}

function groundCoverGeometry(kind: GroundCoverKind) {
  const geometry = new THREE.InstancedBufferGeometry()
  const vertices: number[] = []
  const indices: number[] = []
  if (kind === 'clover') {
    for (let leaf = 0; leaf < 3; leaf++) {
      const angle = leaf * Math.PI * 2 / 3
      const start = vertices.length / 3
      vertices.push(Math.cos(angle) * 0.4, 0.86, Math.sin(angle) * 0.4)
      for (let edge = 0; edge < 8; edge++) {
        const theta = edge / 8 * Math.PI * 2
        const radial = 0.4 + Math.cos(theta) * 0.38
        const lateral = Math.sin(theta) * 0.24
        vertices.push(Math.cos(angle) * radial - Math.sin(angle) * lateral, 0.82 + Math.cos(theta) * 0.12, Math.sin(angle) * radial + Math.cos(angle) * lateral)
        indices.push(start, start + 1 + edge, start + 1 + (edge + 1) % 8)
      }
    }
  } else {
    const heights = kind === 'seed' ? [0, 0.65, 0.72, 0.8, 0.88, 0.96, 1] : [0, 0.25, 0.5, 0.75, 1]
    for (let segment = 0; segment < heights.length; segment++) {
      const t = heights[segment]
      const width = kind === 'seed' ? (t < 0.7 ? 0.028 : Math.sin((t - 0.7) / 0.3 * Math.PI) * 0.24 + 0.005) : Math.sin((t * 0.85 + 0.15) * Math.PI) * 0.5 + 0.002
      vertices.push(-width, t, 0, width, t, 0)
      if (segment < heights.length - 1) {
        const i = segment * 2
        indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2)
      }
    }
  }
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const field = createGrassField(kind)
  geometry.setAttribute('bladeOffset', new THREE.InstancedBufferAttribute(field.offsets, 3))
  geometry.setAttribute('bladeShape', new THREE.InstancedBufferAttribute(field.shapes, 4))
  geometry.instanceCount = field.count
  // Animated bounds: every root + tallest tip + the largest wind/foot/brush displacement (see grassBounds).
  const bounds = grassBounds(field)
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(...bounds.center), bounds.radius)
  return geometry
}

/** Vertex deformation shared by the lit material AND the depth material so shadows/depth agree with the blades. */
function meadowVertex(shader: THREE.WebGLProgramParametersWithUniforms, uniforms: Record<string, THREE.IUniform>) {
  Object.assign(shader.uniforms, uniforms, getWindUniforms())
  shader.vertexShader = WIND_GLSL + `
    attribute vec3 bladeOffset;
    attribute vec4 bladeShape;
    uniform vec2 playerPosition;
    uniform vec2 brushPosition;
    uniform float brushStrength;
    varying float bladeHeight;
    varying float bladeVariation;
    varying float bladeAcross;
  ` + shader.vertexShader
  shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
    vec3 objectNormal = normalize(vec3(-sin(bladeShape.x) * 0.45, 0.65 + position.y * 0.35, cos(bladeShape.x) * 0.45));
  `)
  shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
    float h = position.y;
    bladeHeight = h;
    bladeVariation = bladeShape.w;
    bladeAcross = position.x;
    float angle = bladeShape.x;
    vec3 transformed = vec3((position.x * cos(angle) - position.z * sin(angle)) * bladeShape.z, h * bladeShape.y, (position.x * sin(angle) + position.z * cos(angle)) * bladeShape.z);
    transformed.xz += vec2(cos(angle), sin(angle)) * bladeShape.y * (0.12 + bladeShape.w * 0.28) * h * h;
    transformed.y -= bladeShape.y * 0.12 * h * h * h;
    // Shared wind: traveling wave along uWindDir, tips (h²) flex more than roots, far grass fades out.
    float windFade = 1.0 - smoothstep(12.0, 32.0, distance(bladeOffset.xz, cameraPosition.xz));
    transformed += windDisplace(bladeOffset.xz, h, 0.0, ${GRASS_WIND_AMPLITUDE.toFixed(3)} * windFade, bladeShape.w);
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
}

export function InteractiveGrass({ interactionRef, reducedMotion }: { interactionRef: RefObject<GrassInteraction>; reducedMotion: boolean }) {
  // The grass hosts the single wind driver for the canvas; other consumers just read getWindUniforms().
  useWindDriver(reducedMotion)
  const { layers, uniforms } = useMemo(() => {
    const uniforms = {
      playerPosition: { value: new THREE.Vector2(0, 5) },
      brushPosition: { value: new THREE.Vector2(0, 5) },
      brushStrength: { value: 0 },
    }
    const layers = (['grass', 'seed', 'clover'] as const).map((kind) => {
      const geometry = groundCoverGeometry(kind)
      const material = new THREE.MeshStandardMaterial({ roughness: 0.94, side: THREE.DoubleSide })
      const colors = {
        meadowRoot: { value: new THREE.Color(MATERIAL.soil).multiplyScalar(0.62) },
        meadowLeaf: { value: new THREE.Color(kind === 'seed' ? MATERIAL.wood : kind === 'clover' ? MATERIAL.leaf : MATERIAL.grass) },
        meadowTip: { value: new THREE.Color(kind === 'seed' ? MATERIAL.wood : MATERIAL.grass).lerp(new THREE.Color(MATERIAL.paper), kind === 'seed' ? 0.5 : 0.14) },
      }
      material.onBeforeCompile = (shader) => {
        meadowVertex(shader, uniforms)
        Object.assign(shader.uniforms, colors)
        shader.fragmentShader = `
          varying float bladeHeight;
          varying float bladeVariation;
          varying float bladeAcross;
          uniform vec3 meadowRoot;
          uniform vec3 meadowLeaf;
          uniform vec3 meadowTip;
        ` + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
        shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          vec3 meadowColor = mix(meadowRoot, meadowLeaf, smoothstep(0.0, 0.55, bladeHeight));
          meadowColor = mix(meadowColor, meadowTip, smoothstep(0.45, 1.0, bladeHeight) * (0.35 + bladeVariation * 0.65));
          float vein = 1.0 - smoothstep(0.0, 0.075, abs(bladeAcross));
          diffuseColor.rgb *= meadowColor * (0.82 + bladeVariation * 0.3 + vein * 0.08);
        `)
      }
      material.customProgramCacheKey = () => 'runway-reactive-meadow-v4'
      // Depth pass uses the identical deformation (only matters when a blade layer casts shadows or a depth prepass runs).
      const depthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide })
      depthMaterial.onBeforeCompile = (shader) => meadowVertex(shader, uniforms)
      depthMaterial.customProgramCacheKey = () => 'runway-reactive-meadow-v4-depth'
      return { kind, geometry, material, depthMaterial }
    })
    return { layers, uniforms }
  }, [])
  const uniformsRef = useRef(uniforms)
  const gl = useThree((state) => state.gl)
  useEffect(() => () => layers.forEach(({ geometry, material, depthMaterial }) => { geometry.dispose(); material.dispose(); depthMaterial.dispose() }), [layers])
  useEffect(() => {
    // Debug/verification hook (scripts/grass-reference.browser.mjs): renderer stats + static grass budget.
    const instances = layers.reduce((sum, { geometry }) => sum + geometry.instanceCount, 0)
    const triangles = layers.reduce((sum, { geometry }) => sum + geometry.instanceCount * (geometry.index?.count ?? 0) / 3, 0)
    window.__runwayRendererInfo = () => ({ calls: gl.info.render.calls, triangles: gl.info.render.triangles, geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, grassInstances: instances, grassTriangles: triangles })
    return () => { delete window.__runwayRendererInfo }
  }, [layers, gl])
  useFrame(() => {
    uniformsRef.current.playerPosition.value.copy(interactionRef.current.player)
    uniformsRef.current.brushPosition.value.copy(interactionRef.current.brush)
    uniformsRef.current.brushStrength.value = interactionRef.current.strength
  })
  return <group>{layers.map(({ kind, geometry, material, depthMaterial }) => <mesh key={kind} name={`Meadow-${kind}`} geometry={geometry} material={material} customDepthMaterial={depthMaterial} receiveShadow />)}</group>
}
