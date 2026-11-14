// v36 の画面: 鉄骨の影と落下・油と樽・落とし扉・プレス機・猿（予告・追う・はたかれる）・壁画 4 枚・兄の跡「あれに追われた」。node tools/v36shots.mjs（無音）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.VPORT || String(6100 + Math.floor(Math.random() * 800))
await import('../server.mjs')
const OUT = 'shots/v36/', W = +(process.env.W || 1280), H = +(process.env.H || 720)
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); window.sky.story.t0 = null })
await page.waitForFunction(() => window.sky.v36.imps.ready, null, { timeout: 30000 })
const sh = n => page.screenshot({ path: OUT + n + (process.env.TOUCH ? '_sp' : '') + '.png' })
const rafs = n => page.evaluate(async n => { for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)) }, n)
const atPath = (i, back = 0, v = 0) => page.evaluate(([i, back, v]) => { const G = window.sky, A = G.api, P = G.course.path; let k = i, d = 0; while (k > 0 && d < back) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- } const q = P[k], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let n = 0; n < 30; n++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); b.v = [Math.cos(q.yaw) * v, 0, -Math.sin(q.yaw) * v]; A.placeBike(b); G.running = true; return k }, [i, back, v])
const R = {}
const ONLYM = !!process.env.ONLYM
const traps = await page.evaluate(() => window.sky.course.traps.map(t => ({ kind: t.kind, i: t.i, T: t.T })))
for (const [nm, mark, back, keys, wait] of [['tunnel1', '真っ暗な通路', -10, true, 40], ['tunnel2', '真っ暗な通路', -30, true, 30], ['meadow1', '明るい草原', 0, true, 150], ['meadow2', '明るい草原', -25, true, 60], ['mill1', '風車の羽根', -2, false, 40], ['cable1', 'ワイヤーの綱渡り', -6, false, 30]]) {
  const i = await page.evaluate(([mark, back]) => { const G = window.sky, m = G.course.marks.find(x => x.name === mark); return m.i0 - back }, [mark, back])
  await atPath(i, 0, keys ? 6 : 0); if (keys) await page.evaluate(() => window.sky.keys.add('thr')); await rafs(wait); await page.screenshot({ path: 'shots/v37/' + nm + '.png' }); await page.evaluate(() => window.sky.keys.clear())
  R[nm] = await page.evaluate(() => ({ zone: window.sky.course.path[window.sky.steer.i].zone, mk: +window.sky.v37.meadowK.toFixed(2), lamp: window.sky.api.bikeView.lampLight.intensity }))
}
console.log(JSON.stringify(R)); console.log('errors', errs.length, errs.slice(0, 6))
await br.close(); process.exit(0)
