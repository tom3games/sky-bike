// 同じ場面のスクショ（作り直しの前後で比べる）。node tools/scenes.mjs <出力の頭>
// 場面: タイトル / 走り出し / 第1面の道の 25%・50%・75%・95% の地点（そこへ置いて少し走らせる）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5377'
await import('../server.mjs')
const out = process.argv[2] || 'shots/scene'
const W = +(process.env.W || 1280), H = +(process.env.H || 720)
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ locale: process.env.LOC || 'ja-JP', viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH })
await muteContext(ctx)
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`)
await page.waitForFunction('window.__skyReady', null, { timeout: 40000 })
await page.waitForTimeout(1500)
await page.screenshot({ path: out + '_0title.png' })
await page.evaluate(() => window.sky.startRun('stage1'))
await page.waitForTimeout(600)
await page.screenshot({ path: out + '_1start.png' })
for (const f of (process.env.FR || '0.25,0.5,0.75,0.95').split(',').map(Number)) {
  await page.evaluate(f => {
    const G = window.sky, A = G.api, path = G.course.path
    let i = Math.floor(path.length * f); const bad = j => !path[j].p || !path[j].w || [path[j - 3], path[j - 2], path[j - 1], path[j], path[j + 1], path[j + 2], path[j + 3], path[j + 4]].some(q => q && (q.kind === 'jump' || q.kind === 'stepUp')); while (bad(i)) i++
    const q = path[i]
    const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 20; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    A.placeBike(b); G.running = true
    G.testInput = null; G.keys.add('thr')
  }, f)
  await page.waitForTimeout(1600)
  await page.evaluate(() => { window.sky.keys.delete('thr'); window.sky.keys.add('brk') })
  await page.waitForTimeout(300)
  await page.evaluate(() => window.sky.keys.delete('brk'))
  await page.screenshot({ path: `${out}_${Math.round(f * 100)}.png` })
}
console.log('errors', errs.length, errs.slice(0, 5))
await br.close(); process.exit(0)
