// 歯車（工場の区間）の見た目: 同じカメラで 近く・中・遠 の 3 枚。 OUT=出力の頭 node tools/gearshot.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.GSPORT || '6231'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(800)
// 1 つ目の歯車の並び（回る歯車）の 2 枚目の歯車を見る。バイクを手前に置いて、まわりを作らせる
const info = await page.evaluate(() => {
  const G = window.sky, A = G.api, P = G.course.path
  const gs = G.course.decor.filter(d => d.kind === 'gear'); const g = gs[1]
  const i = P.findIndex(q => q.kind === 'gear'); const q = P[Math.max(0, i - 8)]
  const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); A.placeBike(b)
  A.buildAll(); return { c: g.c, R: g.R, yaw: q.yaw, n: gs.length }
})
const { c, R, yaw } = info, f = [Math.cos(yaw), 0, -Math.sin(yaw)], r = [Math.sin(yaw), 0, Math.cos(yaw)]
const cams = { near: [3.2, 1.6, 2.2], mid: [8, 4, 6], far: [22, 10, 16] }
for (const [nm, [bk, up, sd]] of Object.entries(cams)) {
  const cam = [c[0] - f[0] * bk + r[0] * sd, c[1] + up, c[2] - f[2] * bk + r[2] * sd], tgt = [c[0], c[1] - 0.3, c[2]]
  await page.evaluate(([cam, tgt]) => { const G = window.sky, cm = G.api.camera; G.state = 'debug'; cm.position.set(...cam); cm.lookAt(...tgt); G.api.lodAll && G.api.lodAll(false) }, [cam, tgt])
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${process.env.OUT || 'shots/gear'}_${nm}.jpg`, quality: 88 })
}
const fps = await page.evaluate(async () => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < 2000) { await new Promise(r => requestAnimationFrame(r)); n++ } return Math.round(n / 2) })
console.log('gears', info.n, 'fps(far)', fps, 'errors', errs.length ? errs.slice(0, 3) : 'none')
await br.close(); process.exit(0)
