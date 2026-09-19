import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const url = process.env.TEST_URL ?? 'http://127.0.0.1:5174'
const label = process.env.CAPTURE_LABEL ?? 'remy'
const output = new URL('../node_modules/.cache/runway-characters/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const browser = await puppeteer.launch({
  executablePath: process.env.BROWSER_PATH ?? '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  headless: true,
  args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check'],
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(label) {
  await page.waitForFunction((text) => [...document.querySelectorAll('button')].some((b) => b.textContent.includes(text) && b.checkVisibility()), {}, label)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((element, text) => element.textContent.includes(text) && element.checkVisibility(), label)) {
      await button.click()
      return
    }
  }
}
try {
  await page.setViewport({ width: 1440, height: 900 })
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(720, 450)
  await click('START RUNWAY')
  await wait(2500)
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
  await wait(600)
  await page.screenshot({ path: `${output}${label}-wide.png` })
  await page.keyboard.down('w')
  await page.waitForFunction(() => Number(document.querySelector('canvas')?.dataset.position?.split(',')[2]) < -3.3, { timeout: 20000 })
  await page.keyboard.up('w')
  await wait(300)
  await page.screenshot({ path: `${output}${label}-close.png` })
  const performance = await page.evaluate(async () => {
    const frames = []
    await new Promise((resolve) => {
      const sample = (now) => {
        frames.push(now)
        if (frames.length >= 121) resolve()
        else requestAnimationFrame(sample)
      }
      requestAnimationFrame(sample)
    })
    const intervals = frames.slice(1).map((time, index) => time - frames[index]).sort((a, b) => a - b)
    return {
      fps: 120000 / (frames.at(-1) - frames[0]),
      frameP95Ms: intervals[Math.floor(intervals.length * 0.95)],
      modelTransfers: performance.getEntriesByType('resource').filter((r) => r.name.endsWith('.glb')).map((r) => ({ url: r.name, bytes: r.encodedBodySize, transferBytes: r.transferSize })),
    }
  })
  async function walk(key, axis, threshold, increasing) {
    await page.keyboard.down(key)
    await page.waitForFunction((axis, threshold, increasing) => {
      const position = Number(document.querySelector('canvas')?.dataset.position?.split(',')[axis])
      return increasing ? position > threshold : position < threshold
    }, { timeout: 20000 }, axis, threshold, increasing)
    await page.keyboard.up(key)
  }
  await walk('d', 0, 3.25, true)
  await walk('w', 2, -7.2, false)
  await walk('a', 0, 0.85, false)
  await walk('s', 2, -6.3, true)
  await page.mouse.move(1050, 420)
  await page.mouse.down()
  await page.mouse.move(785, 545, { steps: 20 })
  await page.mouse.up()
  await wait(400)
  await page.screenshot({ path: `${output}${label}-unobstructed.png` })
  await page.setViewport({ width: 390, height: 844 })
  await wait(500)
  await page.screenshot({ path: `${output}${label}-narrow.png` })
  console.log(JSON.stringify({ label, output, performance, errors }, null, 2))
  assert.deepEqual(errors, [])
} finally {
  await browser.close()
}
