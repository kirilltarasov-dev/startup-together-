import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { useMemo } from 'react'

export interface Surface {
  map: THREE.Texture
  normalMap?: THREE.Texture
  roughnessMap?: THREE.Texture
  /** Physical size of one texture repeat in metres (width, height). */
  meters: [number, number]
  /** Base roughness when no roughness map is present. */
  roughness?: number
  /** Scale for the normal map (default 1). */
  normalScale?: number
}

const SURFACES = ['brick', 'concrete'] as const
const CHANNELS = ['color', 'normal', 'roughness'] as const

/**
 * Real-world texture scale, measured from the 1K Poly Haven maps (row/column autocorrelation):
 * brick_wall_02 has 20 courses per repeat -> one repeat is 1.5 m for a 7.5 cm course;
 * concrete_pavement has 6 slabs per repeat -> 3.3 m gives 0.55 m slabs.
 */
export const SURFACE_METERS = { brick: [1.5, 1.5] as [number, number], concrete: [3.3, 3.3] as [number, number], wood: [1.2, 1.2] as [number, number] }

export function useEnvironmentSurfaces(): Record<'brick' | 'concrete', Surface> {
  const textures = useTexture(SURFACES.flatMap((kind) => CHANNELS.map((channel) => `/assets/environment/${kind}-${channel}.jpg`)))
  return useMemo(() => {
    textures.forEach((texture, i) => {
      // Base colour is sRGB; normal and roughness are linear data.
      texture.colorSpace = i % 3 === 0 ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 8
      texture.needsUpdate = true
    })
    return {
      brick: { map: textures[0], normalMap: textures[1], roughnessMap: textures[2], meters: SURFACE_METERS.brick, normalScale: 0.9 },
      concrete: { map: textures[3], normalMap: textures[4], roughnessMap: textures[5], meters: SURFACE_METERS.concrete, normalScale: 0.7 },
    }
  }, [textures])
}

export const MATERIAL = {
  sky: '#bdcfd0', fog: '#b9c7bc', sun: '#ffe4bd', ambient: '#c9dcdf', ground: '#686550',
  brick: '#927463', plaster: '#c7c0ad', concrete: '#b0aca0', stone: '#b6b1a0', metal: '#303b3c',
  wood: '#987451', soil: '#4c5030', grass: '#668044', leaf: '#55683c', bark: '#665240',
  paper: '#dedccc', screen: '#68c6ba', dark: '#172629', warm: '#ffce83', alarm: '#f15a4d',
  win: '#70bd93', devin: '#8daeff', skin: '#c99371', hair: '#332b28', trouser: '#28343a',
  // Location palettes
  ochre: '#c9bb99', ochreDark: '#a89a78', linen: '#e9e4d6', gallery: '#e6e4de', charcoal: '#3b3e43',
  oak: '#c8b28f', laminate: '#e2ded4', steel: '#8d9398', cardboard: '#b48a5a', can: '#c9d1d9',
}

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D, random: () => number) => void, seed = 1, colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  draw(ctx, seededRandom(seed))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = colorSpace
  texture.anisotropy = 8
  return texture
}

export function surfaceTexture(kind: 'brick' | 'wood' | 'concrete' | 'soil' | 'plaster') {
  const texture = canvasTexture(512, 512, (ctx, random) => {
    // Plaster is a near-white grain carrier: the wall paint colour is applied as the material tint.
    ctx.fillStyle = kind === 'plaster' ? '#e6e2d8' : MATERIAL[kind]
    ctx.fillRect(0, 0, 512, 512)
    if (kind === 'brick') {
      ctx.fillStyle = MATERIAL.concrete
      ctx.fillRect(0, 0, 512, 512)
      for (let row = 0; row < 20; row++) {
        for (let col = -1; col < 8; col++) {
          const light = 34 + random() * 16
          ctx.fillStyle = `hsl(${18 + random() * 8} ${20 + random() * 10}% ${light}%)`
          ctx.fillRect(col * 73 + (row % 2) * 36 + 2, row * 25.6 + 2, 69, 21.6)
        }
      }
    }
    if (kind === 'wood') {
      // Eight 15 cm parquet planks per 1.2 m repeat, staggered, each with its own tone and grain.
      const plank = 64
      for (let column = 0; column < 8; column++) {
        let y = -random() * 200
        while (y < 512) {
          const length = 160 + random() * 200
          const tone = 26 + random() * 12
          ctx.fillStyle = `hsl(${26 + random() * 8} ${36 + random() * 10}% ${tone}%)`
          ctx.fillRect(column * plank, y, plank, length)
          for (let i = 0; i < 70; i++) {
            ctx.fillStyle = `rgba(35, 20, 8, ${random() * 0.16})`
            ctx.fillRect(column * plank + random() * plank, y + random() * length, 0.6 + random() * 1.4, 8 + random() * 60)
          }
          ctx.fillStyle = 'rgba(20, 12, 6, 0.75)'
          ctx.fillRect(column * plank, y + length - 1.5, plank, 2)
          y += length
        }
        ctx.fillStyle = 'rgba(20, 12, 6, 0.7)'
        ctx.fillRect(column * plank - 1, 0, 2, 512)
      }
    }
    const image = ctx.getImageData(0, 0, 512, 512)
    for (let i = 0; i < image.data.length; i += 4) {
      const noise = (random() - 0.5) * (kind === 'soil' ? 54 : kind === 'wood' ? 12 : kind === 'plaster' ? 14 : 25)
      image.data[i] += noise
      image.data[i + 1] += noise
      image.data[i + 2] += noise
    }
    ctx.putImageData(image, 0, 0)
  }, 381 + kind.length)
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.userData.kind = kind
  return texture
}

let tintMask: THREE.Texture | null = null
/** 64px low-frequency value noise, tiled at a multi-metre scale to break texture repetition. Linear data. */
export function tintMaskTexture() {
  if (tintMask) return tintMask
  tintMask = canvasTexture(64, 64, (ctx, random) => {
    const size = 64
    const image = ctx.createImageData(size, size)
    const coarse = Array.from({ length: 64 }, () => random())
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // Bilinear blend of an 8x8 lattice (wrapping) plus a little fine grain.
      const gx = x / 8, gy = y / 8
      const x0 = Math.floor(gx) % 8, y0 = Math.floor(gy) % 8, x1 = (x0 + 1) % 8, y1 = (y0 + 1) % 8
      const fx = gx - Math.floor(gx), fy = gy - Math.floor(gy)
      const top = coarse[y0 * 8 + x0] * (1 - fx) + coarse[y0 * 8 + x1] * fx
      const bottom = coarse[y1 * 8 + x0] * (1 - fx) + coarse[y1 * 8 + x1] * fx
      const value = (top * (1 - fy) + bottom * fy) * 0.85 + random() * 0.15
      const i = (y * size + x) * 4
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.round(value * 255)
      image.data[i + 3] = 255
    }
    ctx.putImageData(image, 0, 0)
  }, 907, THREE.NoColorSpace)
  tintMask.wrapS = tintMask.wrapT = THREE.RepeatWrapping
  tintMask.minFilter = tintMask.magFilter = THREE.LinearFilter
  tintMask.generateMipmaps = false
  return tintMask
}

/**
 * Adds a large-scale albedo tint and roughness variation to a textured standard material by sampling the
 * tint mask at a fraction of the map UVs (Box UVs are in texture repeats, so `repeatsPerMask` converts a
 * metre period into UV space). Small shader patch, one shared program for every patched material.
 */
export function applySurfaceVariation(material: THREE.MeshStandardMaterial, repeatsPerMask: number, strength = 0.11, roughnessSpread = 0.12) {
  const mask = tintMaskTexture()
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rwTintMask = { value: mask }
    shader.uniforms.rwTintScale = { value: 1 / repeatsPerMask }
    shader.uniforms.rwTintStrength = { value: strength }
    shader.uniforms.rwTintRoughness = { value: roughnessSpread }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D rwTintMask; uniform float rwTintScale; uniform float rwTintStrength; uniform float rwTintRoughness;\nfloat rwTint = 0.0;')
      .replace('#include <map_fragment>', '#include <map_fragment>\n#ifdef USE_MAP\nrwTint = texture2D(rwTintMask, vMapUv * rwTintScale + vec2(0.37, 0.61)).r - 0.5;\ndiffuseColor.rgb *= 1.0 + rwTint * rwTintStrength * 2.0;\n#endif')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = clamp(roughnessFactor + rwTint * rwTintRoughness * 2.0, 0.04, 1.0);')
  }
  material.customProgramCacheKey = () => 'runway-surface-variation'
  return material
}

export function signTexture(title: string, subtitle: string, dark = false) {
  return canvasTexture(1024, 256, (ctx) => {
    ctx.fillStyle = dark ? MATERIAL.dark : MATERIAL.paper
    ctx.fillRect(0, 0, 1024, 256)
    ctx.fillStyle = dark ? MATERIAL.paper : MATERIAL.dark
    ctx.font = '600 74px sans-serif'
    ctx.fillText(title, 48, 115)
    ctx.font = '24px monospace'
    ctx.fillText(subtitle, 52, 186)
  })
}

/** A4-ish poster: coloured field, big lines, tape corners. Portrait 2:3. */
export function posterTexture(lines: string[], background: string, foreground: string, accent?: string) {
  return canvasTexture(512, 768, (ctx, random) => {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, 512, 768)
    if (accent) {
      ctx.fillStyle = accent
      ctx.fillRect(0, 0, 512, 110)
      ctx.beginPath()
      ctx.arc(256 + (random() - 0.5) * 120, 560 + (random() - 0.5) * 80, 120 + random() * 40, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = foreground
    lines.forEach((line, index) => {
      const size = index === 0 ? 92 : 40
      ctx.font = `${index === 0 ? 800 : 500} ${size}px sans-serif`
      ctx.fillText(line, 40, 230 + index * (index === 0 ? 120 : 62), 432)
    })
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let i = 0; i < 1600; i++) ctx.fillRect(random() * 512, random() * 768, 2, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.55)'
    for (const [x, y] of [[8, 8], [456, 8], [8, 720], [456, 720]]) ctx.fillRect(x, y, 48, 40)
  }, lines.join('').length * 31)
}

/** Whiteboard: marker scribbles, arrows and a couple of boxes; deliberately no readable text. */
export function scribbleTexture() {
  return canvasTexture(1024, 640, (ctx, random) => {
    ctx.fillStyle = '#f4f5f2'
    ctx.fillRect(0, 0, 1024, 640)
    ctx.fillStyle = 'rgba(120,125,130,0.08)'
    for (let i = 0; i < 40; i++) ctx.fillRect(random() * 1024, random() * 640, 60 + random() * 200, 3)
    const colors = ['#2f4a8a', '#c43d3d', '#2d7a4f', '#1f1f24']
    ctx.lineCap = 'round'
    for (let i = 0; i < 14; i++) {
      ctx.strokeStyle = colors[i % colors.length]
      ctx.lineWidth = 4 + random() * 3
      ctx.beginPath()
      let x = 80 + random() * 860, y = 80 + random() * 480
      ctx.moveTo(x, y)
      for (let j = 0; j < 6; j++) { x += (random() - 0.5) * 160; y += (random() - 0.5) * 60; ctx.lineTo(x, y) }
      ctx.stroke()
    }
    ctx.strokeStyle = colors[0]
    ctx.lineWidth = 5
    for (const [x, y, w, h] of [[120, 120, 220, 130], [620, 110, 260, 150], [380, 360, 240, 150]]) ctx.strokeRect(x, y, w, h)
    ctx.beginPath(); ctx.moveTo(340, 185); ctx.lineTo(600, 185); ctx.lineTo(580, 170); ctx.moveTo(600, 185); ctx.lineTo(580, 200); ctx.stroke()
    ctx.strokeStyle = colors[1]
    ctx.beginPath(); ctx.moveTo(240, 250); ctx.quadraticCurveTo(300, 420, 380, 430); ctx.stroke()
  }, 4421)
}

/** Slide for the projector / wall screen: dark field, headline bar, three chart bars. */
export function slideTexture(title: string, subtitle: string, accent: string, dark = true) {
  return canvasTexture(1024, 576, (ctx) => {
    ctx.fillStyle = dark ? '#111a22' : '#f5f4ef'
    ctx.fillRect(0, 0, 1024, 576)
    ctx.fillStyle = accent
    ctx.fillRect(64, 88, 18, 120)
    ctx.fillStyle = dark ? '#e8f0f2' : '#1c2226'
    ctx.font = '800 84px sans-serif'
    ctx.fillText(title, 104, 160, 860)
    ctx.font = '500 34px monospace'
    ctx.fillStyle = dark ? '#9fb4bd' : '#5a6469'
    ctx.fillText(subtitle, 104, 214, 860)
    for (let i = 0; i < 6; i++) {
      const height = 60 + ((i * 97) % 200)
      ctx.fillStyle = i === 5 ? accent : dark ? '#2c3b46' : '#c9ccc9'
      ctx.fillRect(140 + i * 130, 500 - height, 90, height)
    }
  })
}

/** Transparent floor scuff strip: dark streaks along the walking direction, fading to the edges. */
export function scuffTexture() {
  const texture = canvasTexture(256, 512, (ctx, random) => {
    ctx.clearRect(0, 0, 256, 512)
    for (let i = 0; i < 260; i++) {
      const x = 128 + (random() - 0.5) * (random() - 0.5) * 380
      const alpha = 0.05 + random() * 0.22 * (1 - Math.abs(x - 128) / 128)
      ctx.fillStyle = `rgba(20, 16, 12, ${alpha})`
      const length = 30 + random() * 220
      ctx.fillRect(x, random() * 512, 1 + random() * 3, length)
    }
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(30, 26, 20, ${0.06 + random() * 0.1})`
      ctx.beginPath()
      ctx.ellipse(128 + (random() - 0.5) * 160, random() * 512, 6 + random() * 18, 3 + random() * 8, random() * Math.PI, 0, Math.PI * 2)
      ctx.fill()
    }
  }, 2210)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.RepeatWrapping
  return texture
}
