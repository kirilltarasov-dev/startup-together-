// Headless smoke test: loads the game, clicks through, reports console errors + screenshots.
// usage: node scripts/smoke.mjs [url]
import puppeteer from 'puppeteer-core'

const url = process.argv[2] ?? 'http://localhost:5173'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: true,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--window-size=1440,900'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const errors = []
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`) })
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack ?? ''}`))
page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()} ${r.failure()?.errorText}`))

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise((r) => setTimeout(r, 1500))
await page.screenshot({ path: '/tmp/runway-1-opening.png' })
const text1 = await page.evaluate(() => document.body.innerText.slice(0, 300))
console.log('OPENING TEXT:', JSON.stringify(text1))

// skip title cards, click start
await page.mouse.click(720, 450)
await new Promise((r) => setTimeout(r, 1500))
const btn = await page.$('button')
if (btn) { await btn.click(); await new Promise((r) => setTimeout(r, 3500)) }
await page.screenshot({ path: '/tmp/runway-2-play.png' })
const text2 = await page.evaluate(() => document.body.innerText.slice(0, 400))
console.log('PLAY TEXT:', JSON.stringify(text2))
const canvas = await page.evaluate(() => { const c = document.querySelector('canvas'); return c ? { w: c.width, h: c.height } : null })
console.log('CANVAS:', canvas)

console.log('\nERRORS/WARNINGS:', errors.length)
for (const e of errors) console.log(e)
await browser.close()
