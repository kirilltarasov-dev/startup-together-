import { readFile, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const root = new URL('../node_modules/.cache/runway-environment-source/', import.meta.url)
const color = await readFile(new URL('textures/tree_small_02_leaves_diff_1k.png', root))
const alpha = await readFile(new URL('textures/tree_small_02_leaves_alpha_1k.png', root))
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true })
try {
  const page = await browser.newPage()
  const result = await page.evaluate(async (colorBytes, alphaBytes) => {
    const decode = async (bytes) => {
      const image = new Image()
      image.src = `data:image/png;base64,${bytes}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, 512, 512)
      return { canvas, context, pixels: context.getImageData(0, 0, 512, 512) }
    }
    const color = await decode(colorBytes)
    const alpha = await decode(alphaBytes)
    for (let i = 0; i < color.pixels.data.length; i += 4) color.pixels.data[i + 3] = alpha.pixels.data[i]
    color.context.putImageData(color.pixels, 0, 0)
    return color.canvas.toDataURL('image/png').split(',')[1]
  }, color.toString('base64'), alpha.toString('base64'))
  const png = Buffer.from(result, 'base64')
  await writeFile(new URL('tree-leaves-rgba.png', root), png, { flag: 'wx' })
  console.log(JSON.stringify({ leafTextureBytes: png.length, dimensions: [512, 512], colorSpace: 'sRGB' }))
} finally { await browser.close() }
