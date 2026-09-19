import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const url = process.env.TEST_URL ?? 'http://127.0.0.1:4181'
const output = new URL('../node_modules/.cache/runway-realism/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'] })
const page = await browser.newPage()
const errors = []
const loaded = new Set()
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => {
  if (response.url().includes('/assets/realism/')) {
    if (response.ok() || response.status() === 304) loaded.add(new URL(response.url()).pathname)
    else errors.push(`${response.status()} ${response.url()}`)
  }
})
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((button) => button.checkVisibility() && button.textContent.includes(label)), {}, text)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, label) => element.checkVisibility() && element.textContent.includes(label), text)) { await button.click(); return }
  }
  throw new Error(`Missing button: ${text}`)
}
async function start(width, height) {
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(width / 2, height / 2)
  await click('START RUNWAY')
  await page.waitForSelector('canvas')
  await page.waitForNetworkIdle({ idleTime: 700 })
  await wait(1800)
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
}
async function capture(name) { await page.screenshot({ path: `${output}${name}.png` }) }
async function pixels() {
  const canvas = await page.$('canvas')
  assert.ok(canvas)
  const png = await canvas.screenshot({ encoding: 'base64' })
  return page.evaluate(async (encoded) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const surface = document.createElement('canvas')
    surface.width = surface.height = 64
    const context = surface.getContext('2d')
    context.drawImage(image, 0, 0, 64, 64)
    return [...context.getImageData(0, 0, 64, 64).data]
  }, png)
}
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await start(1440, 900)
  await capture('workspace-wide')
  const initial = await pixels()
  assert.ok(new Set(initial).size > 32)
  await page.mouse.move(500, 430)
  await page.mouse.down()
  await page.mouse.move(815, 375, { steps: 20 })
  await page.mouse.up()
  await wait(500)
  await capture('facade-detail')
  await click('RESET POSITION')
  await page.keyboard.down('w')
  await wait(3200)
  await page.keyboard.up('w')
  await page.mouse.move(720, 420)
  await page.mouse.down()
  await page.mouse.move(720, 465, { steps: 10 })
  await page.mouse.up()
  await wait(500)
  await capture('furniture-detail')
  assert.equal(loaded.size, 3, 'Facade, chair and table loaded')
  assert.deepEqual(errors, [])
  const report = { result: 'PASS', loaded: [...loaded], errors: [...errors], fallback: null }
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await start(390, 844)
  await capture('narrow-workspace')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  assert.deepEqual(errors, [])
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false })
  let blocked = 0
  await page.setCacheEnabled(false)
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    if (request.url().includes('/assets/realism/')) { blocked++; void request.abort() }
    else void request.continue()
  })
  await start(1440, 900)
  assert.equal(blocked, 3, 'All added asset failures tested')
  assert.equal(await page.evaluate(() => document.body.textContent.includes('The 3D world could not start.')), false)
  const fallback = await pixels()
  assert.ok(new Set(fallback).size > 32, 'Fallback canvas is rendered')
  assert.notDeepEqual(initial, fallback, 'Loaded asset view differs from fallback')
  await page.keyboard.down('d')
  await wait(700)
  await page.keyboard.up('d')
  const position = await page.$eval('canvas', (canvas) => canvas.dataset.position)
  assert.ok(Number(position.split(',')[0]) > 1)
  await capture('asset-failure-fallback')
  report.fallback = { blocked, position, expectedErrorCount: errors.length }
  await writeFile(`${output}report.json`, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
} catch (error) {
  await capture('failure').catch(() => {})
  console.error(JSON.stringify({ errors, loaded: [...loaded] }))
  throw error
} finally {
  await browser.close()
}
