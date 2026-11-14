// 道に止まっているカラス（v22）の検査: 群れの数と置き場所・近づくと飛び立つ（何 m で）・バイクに当たらない・出し直しで戻る・fps（鳥あり／なし）・画面
// node tools/birdtest.mjs [OUT=画像の頭]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.BTPORT || '5795'
await import('../server.mjs')
const OUT = process.env.OUT || 'shots/birds'
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const out = []
for (const dev of ['pc', 'phone']) {
  const ctx = await br.newContext(dev === 'pc' ? { viewport: { width: 1280, height: 720 } } : { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); await muteContext(ctx)
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
  await page.evaluate(() => window.sky.startRun('stage1'))
  await page.waitForFunction(() => window.sky.birds && window.sky.birds.ready, null, { timeout: 30000 })
  const info = await page.evaluate(() => { const B = window.sky.birds, P = window.sky.course.path; const zs = {}; for (const f of B.flocks) { const z = P[f.i].zone; zs[z] = (zs[z] || 0) + 1 } return { flocks: B.flocks.length, birds: B.total, zones: zs } })
  if (dev === 'pc') out.push(['群れ ' + info.flocks + ' か所・' + info.birds + ' 羽（区間ごと ' + JSON.stringify(info.zones) + '）', info.flocks >= 15 && info.flocks <= 25])
  // 群れの 14m 手前から、アクセルだけで近づく（ゲームと同じ入力の流れ）
  const fl = +(process.env.FLOCK || 3)
  const r = await page.evaluate(async fl => {
    const G = window.sky, A = G.api, f = G.birds.flocks[fl], P = G.course.path
    let i = f.i, d = 0; while (i > 0 && d < 14) { d += Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[2] - P[i - 1].p[2]); i-- }
    const q = P[i], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); A.placeBike(b)
    G.running = true
    const ev0 = G.birdEv || 0
    G.testInput = () => ({ thr: 1, brk: 0, lean: 0, steer: 0, nitro: 0 })
    let flushD = null, minD = 1e9
    const t0 = performance.now()
    while (performance.now() - t0 < 4000) {
      await new Promise(r => requestAnimationFrame(r))
      const dd = Math.hypot(G.bike.p[0] - f.p[0], G.bike.p[2] - f.p[2]); minD = Math.min(minD, dd)
      if (flushD == null && f.state !== 'perch') flushD = dd
    }
    G.testInput = null
    return { flushD, minD, ev: (G.birdEv || 0) - ev0, crashed: !!G.bike.crashed, speed: G.bike.speed }
  }, fl)
  out.push([`${dev}: 近づくと飛び立つ（群れ ${fl}: ${r.flushD == null ? '飛ばない' : r.flushD.toFixed(1) + 'm で'}・羽音の合図 ${r.ev}）`, r.flushD != null && r.ev >= 1])
  out.push([`${dev}: 群れの所を通り抜けても当たらない（いちばん近くで ${r.minD.toFixed(1)}m・転倒 ${r.crashed}・速さ ${r.speed.toFixed(1)}）`, !r.crashed && r.speed > 3])
  // 出し直すと止まっている
  const back = await page.evaluate(fl => { const G = window.sky; G.api.retryCp(true); return G.birds.flocks[fl].state }, fl)
  out.push([`${dev}: 出し直すとまた止まっている（${back}）`, back === 'perch'])
  // fps: 群れの近く（全部の群れが止まっている時）で、鳥あり／なしを 3 秒ずつ
  const fps = await page.evaluate(async fl => {
    const G = window.sky, A = G.api, f = G.birds.flocks[fl], P = G.course.path
    const q = P[Math.max(0, f.i - 10)], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); A.placeBike(b)
    const meas = async () => { let n = 0; const t0 = performance.now(); while (performance.now() - t0 < 3000) { await new Promise(r => requestAnimationFrame(r)); n++ } return n / 3 }
    await meas()
    const on = await meas(); G.birds.body.visible = false; G.birds.wings.visible = false; const saved = G.birds; G.birds = null
    const off = await meas(); G.birds = saved; saved.body.visible = true; saved.wings.visible = true
    return { on, off }
  }, fl)
  out.push([`${dev}: fps 鳥あり ${fps.on.toFixed(0)}・なし ${fps.off.toFixed(0)}`, fps.on > fps.off * 0.9])
  // 画面: 止まっている群れを横から・飛び立つ所
  await page.evaluate(fl => { const G = window.sky, A = G.api, f = G.birds.flocks[fl]; G.state = 'debug'; G.birds.reset(); const cam = A.camera; cam.position.set(f.p[0] - Math.cos(f.yaw) * 3.4 + Math.sin(f.yaw) * 0.8, f.p[1] + 1.1, f.p[2] + Math.sin(f.yaw) * 3.4 + Math.cos(f.yaw) * 0.8); cam.lookAt(f.p[0], f.p[1] + 0.25, f.p[2]); cam.fov = 45; cam.updateProjectionMatrix() }, fl)
  await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}_${dev}_perch.jpg`, quality: 80 })
  await page.evaluate(fl => { const G = window.sky, f = G.birds.flocks[fl]; G.birds.update(0.016, { p: [f.p[0] + 1, f.p[1] + 0.8, f.p[2]], speed: 2 }, null) }, fl)
  await page.waitForTimeout(350); await page.screenshot({ path: `${OUT}_${dev}_fly.jpg`, quality: 80 }); await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}_${dev}_fly2.jpg`, quality: 80 })
  if (errs.length) out.push([`${dev}: エラー ${errs.slice(0, 2).join(' / ')}`, false])
  await ctx.close()
}
for (const [n, ok] of out) console.log(ok ? 'ok  ' : 'FAIL', n)
await br.close(); process.exit(0)
