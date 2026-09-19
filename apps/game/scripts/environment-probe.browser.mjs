// Quick single-scene probe: loads S1 in first-person, moves to the desk camera and dumps the lighting snapshot.
import puppeteer from 'puppeteer-core'
import { mkdir } from 'node:fs/promises'
const url = process.env.TEST_URL ?? 'http://127.0.0.1:4202'
const output = new URL('../node_modules/.cache/runway-environment-polish/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
async function click(text) { await page.waitForFunction((l) => [...document.querySelectorAll('button')].some((b) => b.textContent.includes(l) && b.checkVisibility()), { timeout: 60000 }, text); for (const b of await page.$$('button')) if (await b.evaluate((e, l) => e.textContent.includes(l) && e.checkVisibility(), text)) { await b.click(); return } }
try {
  await page.setViewport({ width: 1440, height: 900 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(`${url}/?world=first-person`, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450); await click('START RUNWAY')
  await page.waitForSelector('canvas'); await page.waitForNetworkIdle({ idleTime: 1500, timeout: 90000 }).catch(() => {}); await wait(2500)
  await click('DRAG-TO-LOOK MODE'); await wait(500)
  for (const view of (process.env.VIEW ?? 'desk,faceKirill,faceSadman,faceSergio,side').split(',')) {
    await page.evaluate((v) => window.__runwayCamera?.(v), view); await wait(1000)
    await page.screenshot({ path: `${output}probe-${view}.png` })
    const png = await (await page.$('canvas')).screenshot({ encoding: 'base64' })
    const lum = await page.evaluate(async (encoded) => { const image = new Image(); image.src = `data:image/png;base64,${encoded}`; await image.decode(); const s = document.createElement('canvas'); s.width = s.height = 32; const x = s.getContext('2d'); x.drawImage(image, image.width * 0.4, image.height * 0.4, image.width * 0.2, image.height * 0.2, 0, 0, 32, 32); const d = x.getImageData(0, 0, 32, 32).data; let sum = 0; for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; return +(sum / (d.length / 4)).toFixed(1) }, png)
    console.log(view, 'center luminance', lum)
  }
  console.log(JSON.stringify(await page.evaluate(() => window.__runwayLighting?.()), null, 1).slice(0, 600))
  console.log('errors', errors)
} finally { await browser.close() }
