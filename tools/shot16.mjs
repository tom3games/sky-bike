// v16 の仕掛けを実際の画面で見る: 上手い bot に走らせて、仕掛けごとに数枚撮る。コンソールのエラーも集める
//   COURSE=lab16 OUT=<出力の頭> node tools/shot16.mjs [仕掛けの名前の一部,...]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5391'
await import('../server.mjs')
const out = process.env.OUT || 'shots/v16', cid = process.env.COURSE || 'lab16', only = (process.argv[2] || '').split(',').filter(Boolean)
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1&course=${cid}&bot=good`)
await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.api.buildAll())
const marks = await page.evaluate(() => window.sky.course.marks.map(m => ({ name: m.name, i0: m.i0 })))
for (const m of marks) {
  if (only.length && !only.some(n => m.name.includes(n))) continue
  await page.evaluate(i0 => {
    const G = window.sky, A = G.api, path = G.course.path
    let i = i0; while (i > 0 && (!path[i].w || path[i].kind !== 'road')) i--
    const q = path[i], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 20; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    b.v = [Math.cos(q.yaw) * 3, 0, -Math.sin(q.yaw) * 3]; b.nitro = 1
    A.placeBike(b); G.running = true
  }, m.i0)
  const times = (process.env.T || '1800,3200,4600').split(',').map(Number)
  let last = 0
  for (const [k, t] of times.entries()) { await page.waitForTimeout(t - last); last = t; await page.screenshot({ path: `${out}_${m.name}_${k}.png` }) }
}
console.log('errors', errs.length, errs.slice(0, 8))
await br.close(); process.exit(0)
