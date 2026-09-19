// Courtyard grass / ambient-motion reference capture.
//   TEST_URL=http://localhost:4203 node scripts/grass-reference.browser.mjs [label]
// Optional: PERF_SECONDS=60 samples requestAnimationFrame deltas along a fixed courtyard route and prints
// p50/p95/max/hitches (>50 ms). BROWSER_PATH overrides the Chromium executable (default: Google Chrome).
// Screenshots land in node_modules/.cache/runway-grass/. Asserts: grass pixels change between t=0 and t=3 s
// (shared wind), birds (when mounted, window.__runwayBirds) stay above y=8, and the world survives capture.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const output = new URL('../node_modules/.cache/runway-grass/', import.meta.url).pathname
await mkdir(output, { recursive: true })
const label = process.argv[2] ?? 'after'
const perfSeconds = Number(process.env.PERF_SECONDS ?? 0)
const base = new URL(process.env.TEST_URL ?? 'http://127.0.0.1:5174')
if (!base.searchParams.has('world')) base.searchParams.set('world', 'first-person')
const url = base.toString()
const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required'] })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function click(text) {
  await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((b) => b.checkVisibility() && b.textContent.includes(label)), { timeout: 30000 }, text)
  for (const button of await page.$$('button')) {
    if (await button.evaluate((b, label) => b.checkVisibility() && b.textContent.includes(label), text)) { await button.click(); return }
  }
  throw new Error('Missing button: ' + text)
}
/** Downsampled RGB of the canvas region (fractions of the viewport), for pixel-change assertions. */
async function sampleCanvas(region = { x: 0, y: 0, w: 1, h: 1 }, size = 96) {
  const canvas = await page.$('canvas')
  assert.ok(canvas, 'WebGL canvas exists')
  const png = await canvas.screenshot({ encoding: 'base64' })
  return page.evaluate(async (encoded, region, size) => {
    const image = new Image()
    image.src = `data:image/png;base64,${encoded}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const context = canvas.getContext('2d')
    context.drawImage(image, image.width * region.x, image.height * region.y, image.width * region.w, image.height * region.h, 0, 0, size, size)
    return [...context.getImageData(0, 0, size, size).data]
  }, png, region, size)
}
function difference(a, b) {
  let total = 0, count = 0, changed = 0
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])
    total += d
    count++
    if (d > 24) changed++
  }
  return { mean: total / count / 3, changedFraction: changed / count }
}
async function enterWorld(viewport) {
  await page.setViewport(viewport)
  await page.goto(url, { waitUntil: 'networkidle0' })
  await page.mouse.click(viewport.width / 2, viewport.height / 2)
  await click('START RUNWAY')
  await page.waitForSelector('[data-world="first-person"] canvas')
  await wait(1800)
  await click('DRAG-TO-LOOK MODE')
  await page.waitForSelector('[data-exploring="true"]')
  await page.waitForSelector('canvas')
}
async function drag(from, to, steps = 20) {
  await page.mouse.move(from[0], from[1])
  await page.mouse.down()
  await page.mouse.move(to[0], to[1], { steps })
  await page.mouse.up()
}
async function hold(key, ms) {
  await page.keyboard.down(key)
  await wait(ms)
  await page.keyboard.up(key)
}
async function sampleFrames(seconds) {
  return page.evaluate((seconds) => new Promise((resolve) => {
    const deltas = []
    let previous = performance.now()
    const end = previous + seconds * 1000
    const tick = (now) => {
      deltas.push(now - previous)
      previous = now
      if (now < end) requestAnimationFrame(tick)
      else resolve(deltas)
    }
    requestAnimationFrame(tick)
  }), seconds)
}
const summary = { label, url, output, errors }
try {
  // 1. Motion enabled: courtyard wind capture at t=0 and t=3 s, plus birds when they are mounted.
  await enterWorld({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await wait(1200)
  await hold('d', 1200)
  await drag([720, 430], [1190, 500], 25)
  await drag([720, 430], [720, 560], 12)
  await wait(700)
  const grassRegion = { x: 0.1, y: 0.55, w: 0.8, h: 0.42 }
  const topRegion = { x: 0.1, y: 0.02, w: 0.8, h: 0.12 } // toolbar + horizon: expected static
  const t0 = await sampleCanvas(grassRegion)
  const top0 = await sampleCanvas(topRegion)
  await page.screenshot({ path: `${output}${label}-wind-t0.png` })
  await wait(3000)
  const t3 = await sampleCanvas(grassRegion)
  const top3 = await sampleCanvas(topRegion)
  await page.screenshot({ path: `${output}${label}-wind-t3.png` })
  const grassChange = difference(t0, t3)
  const topChange = difference(top0, top3)
  summary.wind = { grass: grassChange, top: topChange }
  const levels = new Set(t0.filter((_, i) => i % 4 !== 3).map((value) => Math.floor(value / 8)))
  assert.ok(levels.size > 16, `grass region is nonblank (${levels.size} levels)`)
  assert.ok(grassChange.changedFraction > 0.02, `grass pixels must change between t=0 and t=3 s with wind on (changed ${(grassChange.changedFraction * 100).toFixed(1)}%)`)
  assert.ok(grassChange.changedFraction > topChange.changedFraction, 'the grass moves more than the (static) top band')
  const birdsMounted = await page.evaluate(() => typeof window.__runwayBirds === 'function')
  summary.birds = { mounted: birdsMounted }
  if (birdsMounted) {
    const samples = []
    for (let i = 0; i < 20; i++) {
      samples.push(await page.evaluate(() => window.__runwayBirds()))
      await wait(150)
    }
    const flat = samples.flat()
    assert.ok(flat.length > 0, 'birds report positions')
    const minY = Math.min(...flat.map((p) => p.y))
    const minRadius = Math.min(...flat.map((p) => Math.hypot(p.x, p.z)))
    const moved = samples[0].some((p, i) => Math.hypot(p.x - samples.at(-1)[i].x, p.y - samples.at(-1)[i].y, p.z - samples.at(-1)[i].z) > 1)
    summary.birds = { mounted: true, count: samples[0].length, minY, minRadius, moved }
    assert.ok(minY >= 8, `birds stay above y=8 (min ${minY.toFixed(2)})`)
    assert.ok(minRadius > 20, `birds stay outside the courtyard (min radius ${minRadius.toFixed(1)})`)
    assert.ok(moved, 'birds move over three seconds')
    // Look up over the workspace roof (the open sky sector; facades hide the other directions) for a bird frame.
    // Walk deeper into the courtyard first: from the spawn the workspace ceiling edge hides everything below ~23°.
    await click('RESET POSITION')
    await hold('s', 1600)
    await drag([720, 430], [720, 250], 15)
    // Wait (up to 40 s) for a bird to enter the open-sky sector over the workspace roof (-z, within ±40°).
    let waited = 0
    while (waited < 40000) {
      const birds = await page.evaluate(() => window.__runwayBirds())
      if (birds.some((p) => p.z < -12 && Math.abs(p.x) < -p.z * 0.85)) break
      await wait(500)
      waited += 500
    }
    summary.birds.waitedForSectorMs = waited
    await wait(300)
    const skyA = await sampleCanvas({ x: 0, y: 0.05, w: 1, h: 0.5 }, 360)
    await page.screenshot({ path: `${output}${label}-sky-birds.png` })
    await wait(600)
    const skyB = await sampleCanvas({ x: 0, y: 0.05, w: 1, h: 0.5 }, 360)
    // Static camera: only the birds change between the two sky samples (informational; they may be behind the roofline).
    summary.birds.movingSkyPixels = Math.round(difference(skyA, skyB).changedFraction * 360 * 360)
  }
  if (perfSeconds > 0) {
    // Fixed route: interior look -> walk to the courtyard -> look at grass -> brush -> return; sampled in parallel.
    const framesPromise = sampleFrames(perfSeconds)
    const route = async () => {
      const start = Date.now()
      while (Date.now() - start < perfSeconds * 1000) {
        await drag([720, 430], [300, 430], 20)
        await hold('w', 1500)
        await drag([720, 430], [720, 620], 12)
        await page.keyboard.down('e')
        await wait(1200)
        await page.keyboard.up('e')
        await drag([720, 430], [720, 300], 12)
        await hold('s', 1500)
        await drag([720, 430], [1140, 430], 20)
        await hold('a', 800)
        await wait(600)
      }
    }
    await route()
    const frames = (await framesPromise).slice(5)
    const sorted = [...frames].sort((a, b) => a - b)
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))]
    summary.perf = { seconds: perfSeconds, frames: frames.length, p50: at(0.5), p95: at(0.95), max: sorted.at(-1), hitches: frames.filter((d) => d > 50).length, fps: 1000 / (frames.reduce((s, v) => s + v, 0) / frames.length) }
    const info = await page.evaluate(() => window.__runwayRendererInfo?.() ?? null)
    if (info) summary.renderer = info
  }
  // 2. Reduced motion: stable reference frames for visual comparison (unchanged from the original capture).
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await enterWorld({ width: 1440, height: 900, deviceScaleFactor: 1 })
  await wait(1200)
  await hold('d', 1200)
  await drag([720, 430], [1190, 500], 25)
  await wait(700)
  await page.screenshot({ path: `${output}${label}-courtyard.png` })
  await drag([720, 430], [720, 615], 15)
  await page.keyboard.down('c')
  await wait(600)
  await page.screenshot({ path: `${output}${label}-grass.png` })
  await page.keyboard.up('c')
  await enterWorld({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
  await hold('d', 900)
  await drag([195, 300], [195, 480], 15)
  await wait(600)
  await page.screenshot({ path: `${output}${label}-narrow.png` })
  assert.ok(await page.$('canvas'), 'World must remain mounted throughout capture')
  assert.ok(await page.$('[data-exploring="true"]'), 'Capture must show the world, not a reloaded title screen')
  assert.deepEqual(errors, [])
  console.log(JSON.stringify(summary))
} catch (error) {
  await page.screenshot({ path: `${output}${label}-failure.png` }).catch(() => {})
  console.error(JSON.stringify({ ...summary, errors }))
  throw error
} finally {
  await browser.close()
}
