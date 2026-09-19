import * as THREE from 'three'

export const MATERIAL = {
  sky: '#bdcfd0', fog: '#b9c7bc', sun: '#ffe4bd', ambient: '#c9dcdf', ground: '#686550',
  brick: '#927463', plaster: '#c7c0ad', concrete: '#b0aca0', stone: '#b6b1a0', metal: '#303b3c',
  wood: '#987451', soil: '#4c5030', grass: '#668044', leaf: '#55683c', bark: '#665240',
  paper: '#dedccc', screen: '#68c6ba', dark: '#172629', warm: '#ffce83', alarm: '#f15a4d',
  win: '#70bd93', devin: '#8daeff', skin: '#c99371', hair: '#332b28', trouser: '#28343a',
}

export function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

export function surfaceTexture(kind: 'brick' | 'wood' | 'concrete' | 'soil') {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')!
  const random = seededRandom(381 + kind.length)
  ctx.fillStyle = MATERIAL[kind]
  ctx.fillRect(0, 0, 512, 512)
  if (kind === 'brick') {
    ctx.fillStyle = MATERIAL.concrete
    ctx.fillRect(0, 0, 512, 512)
    for (let row = 0; row < 8; row++) {
      for (let col = -1; col < 5; col++) {
        const light = 36 + random() * 17
        ctx.fillStyle = `hsl(21 22% ${light}%)`
        ctx.fillRect(col * 128 + (row % 2) * 64 + 3, row * 64 + 3, 122, 58)
      }
    }
  }
  if (kind === 'wood') {
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = `rgba(43, 25, 10, ${random() * 0.12})`
      ctx.fillRect(random() * 512, random() * 512, 12 + random() * 180, 0.5 + random())
    }
    ctx.fillStyle = MATERIAL.bark
    for (let y = 0; y < 512; y += 128) ctx.fillRect(0, y, 512, 2)
  }
  const image = ctx.getImageData(0, 0, 512, 512)
  for (let i = 0; i < image.data.length; i += 4) {
    const noise = (random() - 0.5) * (kind === 'soil' ? 54 : 25)
    image.data[i] += noise
    image.data[i + 1] += noise
    image.data[i + 2] += noise
  }
  ctx.putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.userData.kind = kind
  texture.anisotropy = 8
  return texture
}

export function signTexture(title: string, subtitle: string, dark = false) {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = dark ? MATERIAL.dark : MATERIAL.paper
  ctx.fillRect(0, 0, 1024, 256)
  ctx.fillStyle = dark ? MATERIAL.paper : MATERIAL.dark
  ctx.font = '600 74px sans-serif'
  ctx.fillText(title, 48, 115)
  ctx.font = '24px monospace'
  ctx.fillText(subtitle, 52, 186)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
