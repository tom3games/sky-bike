// 爆発するドラム缶（v27）: 近くを通ると 1 回だけ爆発し、バイクの速さ・向き・位置は爆発しない時とまったく同じ（押さない・転ばない）。出し直すと缶が戻る。画面を撮る
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.BMPORT || '5861'
await import('../server.mjs')
const OUT = process.env.OUT || 'shots/boom'
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(2500)
const ride = (withBoom, shot) => page.evaluate(async ([withBoom, shot]) => {
  const G = window.sky, A = G.api, P = G.course.path, B = G.boom
  const q = P[Math.max(0, B.i - 14)], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); A.placeBike(b)
  const saved = G.boom; if (!withBoom) G.boom = null
  G.running = true; G.hold = true; G.acc = 0
  G.testInput = () => ({ thr: 1, brk: 0, lean: 0, steer: 0, nitro: 0 })
  const tr = []; let shotAt = null
  for (let s = 0; s < 200; s++) { A.fixedStep(); if (s % 2 === 0) await new Promise(r => requestAnimationFrame(r)); tr.push([G.bike.p[0], G.bike.p[1], G.bike.p[2], G.bike.speed]); if (shot && saved.done && shotAt == null) { shotAt = s; break } }
  G.testInput = null; G.hold = false; if (!withBoom) G.boom = saved
  return { tr, n: G.boomN || 0, crashed: !!G.bike.crashed, done: saved.done, shotAt }
}, [withBoom, shot])
const ch0 = await page.evaluate(() => window.sky.boomChain || 0)
const a = await ride(true), n1 = a.n
await page.waitForTimeout(1200)
const chain = await page.evaluate(ch0 => { const G = window.sky, B = G.boom; return { ups: (B.ups || []).length, n: (G.boomChain || 0) - ch0, delays: (B.ups || []).map(u => u.delay), rose: (B.ups || []).map(u => u.mesh ? +(u.mesh.position.y - u.home.p.y).toFixed(1) : null), gone: (B.ups || []).map(u => G.world.shapes[u.si].a[1] < -100) } }, ch0)
const b = await ride(false)
let maxd = 0; for (let i = 0; i < Math.min(a.tr.length, b.tr.length); i++) maxd = Math.max(maxd, Math.hypot(a.tr[i][0] - b.tr[i][0], a.tr[i][1] - b.tr[i][1], a.tr[i][2] - b.tr[i][2]), Math.abs(a.tr[i][3] - b.tr[i][3]))
const out = []
out.push(['近くを通ると爆発する（回数 ' + n1 + '）', n1 === 1])
out.push(['バイクは転ばない', !a.crashed])
out.push([`上に積んだ缶も連鎖して爆発し上へ飛ぶ（${JSON.stringify(chain)}）`, chain.ups > 0 && chain.n === chain.ups && chain.delays.every(d => d >= 0.2 && d <= 0.4) && chain.gone.every(Boolean) && chain.rose.every(r => r == null || r > 1)])
out.push([`爆発してもバイクの位置・速さは爆発しない時と同じ（ずれの最大 ${maxd.toFixed(4)}）`, maxd < 1e-6])
const back = await page.evaluate(() => { const G = window.sky; G.api.retryCp(true); const sh = G.world.shapes[G.boom.si]; return { done: G.boom.done, y: sh.a[1], vis: G.boom.mesh ? G.boom.mesh.visible : null, ups: (G.boom.ups || []).map(u => !u.done && G.world.shapes[u.si].a[1] > -100 && (!u.mesh || (u.mesh.visible && Math.abs(u.mesh.position.y - u.home.p.y) < 1e-6))) } })
out.push([`出し直すと缶が戻る・上の缶も戻る（${JSON.stringify(back)}）`, !back.done && back.y > -100 && back.vis !== false && back.ups.every(Boolean)])
// 画面: 爆発の瞬間を横から
const c2 = await ride(true, true)
await page.evaluate(() => { const G = window.sky, A = G.api, B = G.boom, cam = A.camera; G.state = 'debug'; cam.position.set(B.a[0] - 7, B.a[1] + 3.5, B.a[2] + 6); cam.lookAt(B.a[0], B.a[1] + 1, B.a[2]); cam.fov = 55; cam.updateProjectionMatrix() })
for (const [k, ms] of [[0, 60], [1, 250], [2, 450], [3, 600]]) { await page.waitForTimeout(ms); await page.screenshot({ path: `${OUT}_${k}.jpg`, quality: 80 }) }
for (const [nm, ok] of out) console.log(ok ? 'ok  ' : 'FAIL', nm)
console.log('errors', errs.length ? errs.slice(0, 3) : 'none')
await br.close(); process.exit(0)
