// v51 三つの歯車（縦に回る）の見た目: 横から・旗の後ろから・上から。PC と スマホ。0.6 秒あけて 2 枚撮り、回る向きを比べる
// OUT=出力の頭 VW=幅 VH=高さ node tools/vgearshot.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.GSPORT || '6237'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const W = +(process.env.VW || 1280), H = +(process.env.VH || 720), OUT = process.env.OUT || 'shots/vgear'
const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1, isMobile: W < 600, hasTouch: W < 600 }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.addInitScript(() => { try { localStorage.setItem('sky-tut-done', '1') } catch (e) {} }); await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(800)
// 旗「歯車の前」にバイクを置いて、まわりを作らせる
const info = await page.evaluate(() => {
  const G = window.sky, A = G.api, n = G.course.notes.find(n => n.kind === 'vgear'), cp = G.course.cps.find(q => q.name === '歯車の前')
  const b = A.createBike({ p: [cp.p[0], cp.p[1] + 0.79, cp.p[2]], yaw: cp.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); A.placeBike(b)
  A.buildAll(); return { A: n.A, yaw: n.yaw, span: n.D.span, c: n.gears.map(g => g.c), cp: cp.p }
})
const f = [Math.cos(info.yaw), 0, -Math.sin(info.yaw)], r = [Math.sin(info.yaw), 0, Math.cos(info.yaw)]
const at = (al, lat, up) => [info.A[0] + f[0] * al + r[0] * lat, info.A[1] + up, info.A[2] + f[2] * al + r[2] * lat]
const mid = info.span / 2
const views = {
  side: [at(mid, 17, 3.5), at(mid, 0, -0.8)], // 右の横から（3 つの回る向き）
  behind: [at(-6.5, -1.2, 3.2), at(7, 0, 0)], // 旗のあたりから（乗る人の目）
  close: [at(5.5, 5.5, 2.4), at(9.1, 0, -0.3)], // 2 つ目の歯車の近く
}
for (const [nm, [cam, tgt]] of Object.entries(views)) {
  for (const k of [0, 1]) { // 0: 1 つ目の欠けが真上（t=0）・1: 2 つ目の欠けが真上（t=7）
    await page.evaluate(([cam, tgt, tt]) => { const G = window.sky, cm = G.api.camera; G.state = 'debug'; G.world.setTime(tt); cm.position.set(...cam); cm.lookAt(...tgt); G.api.lodAll && G.api.lodAll(false) }, [cam, tgt, k ? 7 : 0.8])
    await page.waitForTimeout(k ? 600 : 1500)
    await page.screenshot({ path: `${OUT}_${nm}${k}.jpg`, quality: 86 })
  }
}
const t = await page.evaluate(() => window.sky.world.time)
const fps = await page.evaluate(async () => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < 2000) { await new Promise(r => requestAnimationFrame(r)); n++ } return Math.round(n / 2) })
const mute = await page.evaluate(() => window.__muteOk ? window.__muteOk() : 'n/a')
console.log(W + 'x' + H, 'world.time', t.toFixed(1), 'fps', fps, 'mute', mute, 'errors', errs.length ? errs.slice(0, 5) : 'none')
await br.close(); process.exit(0)
