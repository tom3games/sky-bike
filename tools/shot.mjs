import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
const PORT = process.env.PORT = process.env.PORT || '5371'
await import('../server.mjs')
const eng = process.env.ENG === 'webkit' ? webkit : chromium
const br = await eng.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const W = +(process.env.W || 1280), H = +(process.env.H || 720)
const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message))
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text()) })
const url = `http://localhost:${PORT}/${process.env.Q || ''}`
await page.goto(url)
await page.waitForFunction('window.__skyReady', null, { timeout: 30000 })
await page.waitForTimeout(800)
const out = process.env.OUT || 'shots/t'
await page.screenshot({ path: out + '_title.png' })
if (process.env.SCRIPT) {
  const steps = JSON.parse(process.env.SCRIPT)
  for (const s of steps) {
    if (s.eval) await page.evaluate(s.eval)
    if (s.wait) await page.waitForTimeout(s.wait)
    if (s.shot) await page.screenshot({ path: out + '_' + s.shot + '.png' })
    if (s.log) console.log(s.log, JSON.stringify(await page.evaluate(s.expr)))
  }
}
console.log('errors', errs.length, errs.slice(0, 8))
await br.close(); process.exit(0)
