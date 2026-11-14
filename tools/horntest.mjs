// クラクションのカラス（v28）: 居座る群れに向かってアクセルだけで近づくと、手前で自動で止まり、クラクションが 1 回鳴り、ライトが光り、1.2 秒後に群れが飛ぶ。転ばない。
// 出し直すと群れが戻り、2 回目も同じ。画面を撮る。 node tools/horntest.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.HNPORT || '5871'
await import('../server.mjs')
const OUT = process.env.OUT || 'shots/horn'
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForFunction(() => window.sky.birds && window.sky.birds.ready, null, { timeout: 30000 })
const approach = (far) => page.evaluate(async far => {
  const G = window.sky, A = G.api, f = G.birds.blocker, P = G.course.path
  let i = f.i, d = 0; while (i > 0 && d < far) { d += Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[2] - P[i - 1].p[2]); i-- }
  const q = P[i], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); A.placeBike(b)
  G.running = true; G.keys.add('thr')
  const h0 = G.hornN || 0; let minAhead = 1e9, maxLamp = 0, lampOn = 0, prevOn = false, flewAt = null, hornAt = null, stopV = null, t0 = performance.now(), shotDone = false
  const hx = Math.cos(f.yaw), hz = -Math.sin(f.yaw)
  while (performance.now() - t0 < 9000) {
    await new Promise(r => requestAnimationFrame(r))
    const b = G.bike, ahead = (f.p[0] - b.p[0]) * hx + (f.p[2] - b.p[2]) * hz
    if (f.state === 'perch') minAhead = Math.min(minAhead, ahead)
    const L = G.api.bikeView && G.api.bikeView.lampM ? G.api.bikeView.lampM.emissiveIntensity : 0
    maxLamp = Math.max(maxLamp, L); const on = L > 1; if (on && !prevOn) lampOn++; prevOn = on
    if (hornAt == null && (G.hornN || 0) > h0) { hornAt = performance.now() - t0; stopV = [ahead, b.speed] }
    if (flewAt == null && f.state !== 'perch') window.__flyAhead = [ahead, b.speed, f.state]
    if (flewAt == null && f.state !== 'perch') flewAt = performance.now() - t0
        if (flewAt != null && performance.now() - t0 - flewAt > 2500) break
  }
  G.keys.delete('thr')
  return { horns: (G.hornN || 0) - h0, minAhead, lampFlashes: lampOn, maxLamp, hornAt, flewAt, gap: flewAt != null && hornAt != null ? (flewAt - hornAt) / 1000 : null, crashed: !!G.bike.crashed, stopV, flyA: window.__flyAhead, past: ((G.bike.p[0] - f.p[0]) * hx + (G.bike.p[2] - f.p[2]) * hz) }
}, far)
const out = [], dbg = []
for (const [k, far] of [[1, 22], [2, 22], [3, 25.5]]) {
  const r = await approach(far); dbg.push([r.stopV, r.flyA])
  out.push([`${k} 回目（${far}m 手前から全開）: 群れの手前で止まる（群れの真ん中まで最も近くて ${r.minAhead.toFixed(1)}m）・クラクション ${r.horns} 回・ライト ${r.lampFlashes} 回（明るさ最大 ${r.maxLamp.toFixed(1)}）・鳴ってから ${r.gap && r.gap.toFixed(2)} 秒で飛ぶ・転倒 ${r.crashed}・その後 ${r.past.toFixed(1)}m 進んだ`, r.minAhead > 2.6 && r.horns === 1 && r.lampFlashes === 2 && r.gap > 1.0 && r.gap < 1.5 && !r.crashed && r.past > 3])
  const back = await page.evaluate(() => { const G = window.sky; G.api.retryCp(true); return G.birds.blocker.state })
  out.push([`${k} 回目の後、出し直すと群れが戻る（${back}）`, back === 'perch'])
}
// 画面: ライトが光った瞬間（バイクの前の斜めから）
await page.evaluate(() => { const G = window.sky, A = G.api, f = G.birds.blocker, P = G.course.path; let i = f.i, d = 0; while (i > 0 && d < 9) { d += Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[2] - P[i - 1].p[2]); i-- } const q = P[i], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); A.placeBike(b); G.running = true; G.keys.add('thr') })
await page.waitForFunction(() => window.sky.horn && window.sky.horn.on && window.sky.horn.t > 0.03, null, { timeout: 8000 })
await page.screenshot({ path: `${OUT}_flash.jpg`, quality: 80 })
await page.waitForTimeout(1300); await page.screenshot({ path: `${OUT}_fly.jpg`, quality: 80 })
await page.evaluate(() => window.sky.keys.delete('thr'))
for (const [nm, ok] of out) console.log(ok ? 'ok  ' : 'FAIL', nm)
console.log('debug', JSON.stringify(dbg))
console.log('errors', errs.length ? errs.slice(0, 3) : 'none')
await br.close(); process.exit(0)
