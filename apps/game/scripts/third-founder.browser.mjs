import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const output = new URL('../node_modules/.cache/runway-third-founder/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'] })
const page = await browser.newPage()
const errors = []
const assets = new Set()
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => { if (response.url().includes('/assets/founders/') && response.ok()) assets.add(new URL(response.url()).pathname) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((b) => b.checkVisibility() && b.textContent.includes(label)), {}, text)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((b, label) => b.checkVisibility() && b.textContent.includes(label), text)) { await button.click(); return }
  }
  throw new Error('Button missing: ' + text)
}
async function walk(key, axis, value) {
  await page.keyboard.down(key)
  try {
    await page.waitForFunction((axis, value) => Number(document.querySelector('canvas')?.dataset.position?.split(',')[axis]) < value, { timeout: 10000 }, axis, value)
  } finally { await page.keyboard.up(key) }
}
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:4183', { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForNetworkIdle({ idleTime: 800 })
  await wait(1500)
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
  await walk('w', 2, -3.4)
  await walk('a', 0, -1.75)
  await wait(400)
  await page.screenshot({ path: `${output}third-founder-desktop.png` })
  const sample = async () => {
    const png = await page.screenshot({ clip: { x: 640, y: 500, width: 170, height: 140 }, encoding: 'base64' })
    return page.evaluate(async (data) => {
      const image = new Image()
      image.src = `data:image/png;base64,${data}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = 170; canvas.height = 140
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0)
      return [...context.getImageData(0, 0, 170, 140).data]
    }, png)
  }
  const still = await sample()
  await wait(600)
  assert.deepEqual(await sample(), still, 'Reduced-motion character stays still')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
  await wait(1600)
  const breathing = await sample()
  assert.notDeepEqual(breathing, still, 'Breathing changes visible character pixels')
  await page.screenshot({ path: `${output}third-founder-breathing.png` })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await wait(400)
  await page.screenshot({ path: `${output}third-founder-narrow.png` })
  assert.ok(assets.has('/assets/founders/sadman-seated.glb'))
  assert.ok(assets.has('/assets/founders/remy-seated.glb'))
  assert.ok(assets.has('/assets/founders/sergio-seated.glb'))
  assert.deepEqual(errors, [])
  const report = { result: 'PASS', assets: [...assets], errors }
  await writeFile(`${output}report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report))
} catch (error) {
  await page.screenshot({ path: `${output}failure.png` }).catch(() => {})
  console.error(JSON.stringify({ errors, assets: [...assets] }))
  throw error
} finally { await browser.close() }
