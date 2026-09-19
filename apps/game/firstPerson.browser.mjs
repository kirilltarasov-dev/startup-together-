import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const url = process.env.TEST_URL ?? 'http://127.0.0.1:5174'
const output = new URL('./node_modules/.cache/runway-first-person/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: true,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
const errors = []
const failedAssets = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
page.on('response', (response) => { if (response.url().startsWith(url) && response.status() >= 400) failedAssets.push(`${response.status()} ${response.url()}`) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((button) => button.textContent.includes(text) && button.checkVisibility()), { timeout: 20000 }, label)
  const buttons = await page.$$('button')
  for (const button of buttons) {
    if (await button.evaluate((element, text) => element.textContent.includes(text) && element.checkVisibility(), label)) { await button.click(); return }
  }
  throw new Error(`Missing button: ${label}`)
}
async function screenshot(name) {
  await page.screenshot({ path: `${output}${name}.png` })
  console.log(`Screenshot: ${output}${name}.png`)
}
async function sampleCanvas() {
  const canvas = await page.$('canvas')
  assert.ok(canvas, 'WebGL canvas exists')
  const png = await canvas.screenshot({ encoding: 'base64' })
  return page.evaluate(async (encoded) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 96
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0, 96, 96)
    return [...context.getImageData(0, 0, 96, 96).data]
  }, png)
}
function difference(a, b, center = false) {
  let total = 0, count = 0
  for (let y = center ? 36 : 0; y < (center ? 60 : 96); y++) {
    for (let x = center ? 36 : 0; x < (center ? 60 : 96); x++) {
      const i = (y * 96 + x) * 4
      total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
      count += 3
    }
  }
  return total / count
}
async function choose(label) { await click(label); await wait(300); await click('CONTINUE'); await wait(500) }

try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForSelector('canvas')
  await wait(1800)
  await screenshot('desktop-story')
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
  await wait(500)
  await screenshot('desktop-world')
  const initial = await sampleCanvas()
  const colors = new Set(initial.filter((_, i) => i % 4 !== 3).map((value) => Math.floor(value / 8)))
  assert.ok(colors.size > 16, `Canvas is nonblank (${colors.size} channel levels)`)
  await page.keyboard.down('d')
  await wait(1050)
  await page.keyboard.up('d')
  await wait(300)
  const position = await page.$eval('canvas', (canvas) => canvas.dataset.position)
  assert.ok(Number(position.split(',')[0]) > 1.2, `Player moved into grass: ${position}`)
  assert.ok(difference(initial, await sampleCanvas()) > 3, 'Movement changes rendered world pixels')
  await page.mouse.move(720, 400)
  await page.mouse.down()
  await page.mouse.move(720, 660, { steps: 20 })
  await page.mouse.up()
  await page.keyboard.down('c')
  await wait(700)
  await screenshot('grass-before')
  const beforeGrass = await sampleCanvas()
  await page.keyboard.down('e')
  await page.waitForSelector('output[data-brushing="true"]')
  await wait(600)
  await screenshot('grass-touch')
  const brushDifference = difference(beforeGrass, await sampleCanvas(), true)
  assert.ok(brushDifference > 0.3, `Grass contact changes central canvas pixels: ${brushDifference}`)
  await page.keyboard.up('e')
  await page.waitForSelector('output[data-brushing="false"]')
  await wait(1700)
  await screenshot('grass-released')
  assert.ok(difference(beforeGrass, await sampleCanvas(), true) < brushDifference / 2, 'Grass springs back after release')
  await page.keyboard.up('c')
  await page.keyboard.press('Escape')
  await page.waitForSelector('[data-exploring="false"]')
  await click('EXPLORE IN FIRST PERSON')
  await page.waitForFunction(() => document.pointerLockElement?.tagName === 'CANVAS')
  await page.waitForSelector('[data-exploring="true"]')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.pointerLockElement === null)
  await choose('Founders only')
  await choose('Test the launch')
  await click('OF COURSE')
  await wait(1200)
  await screenshot('debrecen-story')
  await choose('Save every forint')
  await choose('Disable the feed')
  await click('WALK THERE')
  await wait(1200)
  await screenshot('investor-story')
  await choose('Take the bridge')
  await screenshot('ending')
  await click('RESTART')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await wait(600)
  await page.mouse.click(195, 422)
  await click('START RUNWAY')
  await wait(1500)
  await screenshot('mobile-story')
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'No horizontal overflow')
  await click('DRAG-TO-LOOK MODE')
  await wait(500)
  await screenshot('mobile-world')
  assert.equal(await page.$eval('[aria-label="Touch movement controls"]', (element) => getComputedStyle(element).display), 'grid')
  const rightButton = await page.$('[aria-label="Right"]')
  const rightBounds = await rightButton.boundingBox()
  const session = await page.createCDPSession()
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: rightBounds.x + rightBounds.width / 2, y: rightBounds.y + rightBounds.height / 2 }] })
  await wait(750)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await wait(250)
  const touchPosition = await page.$eval('canvas', (canvas) => canvas.dataset.position)
  assert.ok(Number(touchPosition.split(',')[0]) > 1, `Touch controls move the player: ${touchPosition}`)
  await screenshot('mobile-movement')
  console.log(JSON.stringify({ result: 'PASS', position, touchPosition, brushDifference, errors, failedAssets }, null, 2))
  assert.deepEqual(failedAssets, [], 'No missing local assets')
  assert.deepEqual(errors, [], 'No browser errors')
} catch (error) {
  await screenshot('failure').catch(() => {})
  console.error(JSON.stringify({ errors, failedAssets }, null, 2))
  throw error
} finally {
  await browser.close()
}
