import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const url = process.env.TEST_URL ?? 'http://127.0.0.1:5174'
const output = new URL('../node_modules/.cache/runway-environment/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: true,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
const errors = []
const requests = new Set()
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => {
  if (response.url().includes('/assets/environment/')) {
    requests.add(new URL(response.url()).pathname)
    if (!response.ok()) errors.push(`${response.status()} ${response.url()}`)
  }
})
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((button) => button.textContent.includes(label) && button.checkVisibility()), {}, text)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, label) => element.textContent.includes(label) && element.checkVisibility(), text)) { await button.click(); return }
  }
  throw new Error(`Missing button: ${text}`)
}
async function capture(name) { await page.screenshot({ path: `${output}${name}.png` }) }
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForSelector('canvas')
  await page.waitForNetworkIdle({ idleTime: 1000 })
  await wait(2500)
  await click('DRAG-TO-LOOK MODE')
  await wait(500)
  await capture('courtyard')
  await page.mouse.move(500, 430)
  await page.mouse.down()
  await page.mouse.move(815, 375, { steps: 20 })
  await page.mouse.up()
  await wait(500)
  await capture('tree-and-facade')
  const timing = await page.evaluate(() => new Promise((resolve) => {
    const frames = []
    let previous = performance.now()
    const sample = (now) => {
      frames.push(now - previous)
      previous = now
      if (frames.length < 120) requestAnimationFrame(sample)
      else {
        const sorted = frames.slice(10).sort((a, b) => a - b)
        resolve({ fps: 1000 / (sorted.reduce((sum, value) => sum + value, 0) / sorted.length), p95: sorted[Math.floor(sorted.length * 0.95)] })
      }
    }
    requestAnimationFrame(sample)
  }))
  assert.equal(requests.size, 8, 'Six surface maps, HDR, and tree loaded locally')
  assert.deepEqual(errors, [])
  const report = { result: 'PASS', requests: [...requests], timing, errors: [...errors], fallback: null }
  let blocked = 0
  await page.setCacheEnabled(false)
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url().includes('/assets/environment/')) { blocked++; void request.abort() }
    else void request.continue()
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await wait(2000)
  await click('DRAG-TO-LOOK MODE')
  await wait(500)
  assert.ok(blocked >= 3, 'Surface, lighting and tree failure paths were exercised')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('The 3D world could not start.')), false)
  const canvas = await page.$('canvas')
  const png = await canvas.screenshot({ encoding: 'base64' })
  const levels = await page.evaluate(async (encoded) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const sample = document.createElement('canvas')
    sample.width = sample.height = 64
    const context = sample.getContext('2d')
    context.drawImage(image, 0, 0, 64, 64)
    const pixels = context.getImageData(0, 0, 64, 64).data
    return new Set([...pixels].filter((_, i) => i % 4 !== 3).map((value) => Math.floor(value / 8))).size
  }, png)
  assert.ok(levels > 16, `Fallback world rendered: ${levels} channel levels`)
  await page.keyboard.down('d')
  await wait(700)
  await page.keyboard.up('d')
  const fallbackPosition = await page.$eval('canvas', (element) => element.dataset.position)
  assert.ok(Number(fallbackPosition.split(',')[0]) > 1, 'Fallback world still accepts movement')
  await capture('asset-failure-fallback')
  report.fallback = { blocked, levels, position: fallbackPosition, expectedErrorCount: errors.length }
  await writeFile(`${output}report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} finally { await browser.close() }
