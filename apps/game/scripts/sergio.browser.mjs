import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const url = process.env.TEST_URL ?? 'http://127.0.0.1:5174'
const output = new URL('../node_modules/.cache/runway-sergio/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'] })
const page = await browser.newPage()
const errors = []
const assets = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => { if (response.url().includes('/assets/founders/')) assets.push({ url: response.url(), status: response.status() }) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((button) => button.textContent.includes(label) && button.checkVisibility()), {}, text)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, label) => element.textContent.includes(label) && element.checkVisibility(), text)) { await button.click(); return }
  }
  throw new Error(`Missing button: ${text}`)
}
async function walk(key, axis, threshold, increasing) {
  await page.keyboard.down(key)
  try {
    await page.waitForFunction((axis, threshold, increasing) => {
      const value = Number(document.querySelector('canvas')?.dataset.position?.split(',')[axis])
      return increasing ? value > threshold : value < threshold
    }, { timeout: 12000 }, axis, threshold, increasing)
  } finally { await page.keyboard.up(key) }
}
async function start() {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForNetworkIdle({ idleTime: 800 })
  await wait(1000)
  await click('DRAG-TO-LOOK MODE')
}
async function capture(name) { await page.screenshot({ path: `${output}${name}.png` }) }
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await start()
  await capture('wide')
  await walk('w', 2, -3.4, false)
  await walk('d', 0, 1.75, true)
  await wait(300)
  await capture('front')
  await walk('d', 0, 3.25, true)
  await walk('w', 2, -6.05, false)
  await page.mouse.move(1030, 420)
  await page.mouse.down()
  await page.mouse.move(710, 470, { steps: 20 })
  await page.mouse.up()
  await wait(400)
  await capture('seated-outfit')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.waitForSelector('[data-exploring="true"] canvas')
  await wait(400)
  assert.ok(Number((await page.$eval('canvas', (element) => element.dataset.position)).split(',')[0]) > 3)
  await capture('narrow')
  assert.ok(assets.some((asset) => asset.url.endsWith('/sergio-seated.glb') && asset.status === 200))
  assert.ok(assets.some((asset) => asset.url.endsWith('/remy-seated.glb') && asset.status === 200))
  assert.ok(assets.every((asset) => asset.status < 400))
  assert.deepEqual(errors, [])
  const report = { result: 'PASS', assets, errors: [...errors], fallback: false }
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.setCacheEnabled(false)
  await page.setRequestInterception(true)
  page.on('request', (request) => { if (request.url().endsWith('/sergio-seated.glb')) void request.abort(); else void request.continue() })
  await start()
  await walk('w', 2, -3.4, false)
  await wait(300)
  await capture('sergio-load-fallback')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('The 3D world could not start.')), false)
  assert.ok(Number((await page.$eval('canvas', (element) => element.dataset.position)).split(',')[2]) < -3.4)
  report.fallback = true
  await writeFile(`${output}report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await capture('failure').catch(() => {})
  console.error(JSON.stringify({ errors, assets }, null, 2))
  throw error
} finally { await browser.close() }
