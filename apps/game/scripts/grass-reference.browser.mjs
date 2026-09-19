import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const output = new URL('../node_modules/.cache/runway-grass/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const label = process.argv[2] ?? 'after'
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((b) => b.checkVisibility() && b.textContent.includes(label)), {}, text)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((b, label) => b.checkVisibility() && b.textContent.includes(label), text)) { await button.click(); return }
  }
  throw new Error('Missing button: ' + text)
}
try {
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5174', { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await page.waitForSelector('canvas')
  await wait(1800)
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
  await page.waitForSelector('canvas')
  await wait(1200)
  await page.keyboard.down('d')
  await wait(1200)
  await page.keyboard.up('d')
  await page.mouse.move(720, 430)
  await page.mouse.down()
  await page.mouse.move(1190, 500, { steps: 25 })
  await page.mouse.up()
  await wait(700)
  await page.screenshot({ path: `${output}${label}-courtyard.png` })
  await page.mouse.move(720, 430)
  await page.mouse.down()
  await page.mouse.move(720, 615, { steps: 15 })
  await page.mouse.up()
  await page.keyboard.down('c')
  await wait(600)
  await page.screenshot({ path: `${output}${label}-grass.png` })
  await page.keyboard.up('c')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:5174', { waitUntil: 'networkidle0' })
  await page.mouse.click(195, 422)
  await click('START RUNWAY')
  await page.waitForSelector('canvas')
  await wait(1800)
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
  await page.keyboard.down('d')
  await wait(900)
  await page.keyboard.up('d')
  await page.mouse.move(195, 300)
  await page.mouse.down()
  await page.mouse.move(195, 480, { steps: 15 })
  await page.mouse.up()
  await wait(600)
  await page.screenshot({ path: `${output}${label}-narrow.png` })
  assert.ok(await page.$('canvas'), 'World must remain mounted throughout capture')
  assert.ok(await page.$('[data-exploring="true"]'), 'Capture must show the world, not a reloaded title screen')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify({ label, output, errors }))
} catch (error) {
  await page.screenshot({ path: `${output}${label}-failure.png` }).catch(() => {})
  console.error(JSON.stringify({ errors }))
  throw error
} finally {
  await browser.close()
}
