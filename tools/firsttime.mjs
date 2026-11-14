// 「最初の1回だけ止まる」の検査（v31）: スマホ相当（844×390・DPR3・CPU 4倍遅）で、途中で初めて出る物ごとに
// 新しく作られたシェーダの数と、50ms 以上の止まり（longtask）を数える。ニトロ（1回目・2回目）・燃料の缶・爆発するドラム缶・クラクションのカラス・普通のカラス。
// node tools/firsttime.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = String(6000 + Math.floor(Math.random() * 2000)); await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.addInitScript(() => { try { localStorage.setItem('sky-tut-done', '1') } catch (e) {} window.__lt = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]) }).observe({ type: 'longtask', buffered: true }) } catch (e) {} })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForFunction(() => window.sky.birds && window.sky.birds.ready, null, { timeout: 60000 }); await page.waitForTimeout(2500)
const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
const place = (where) => page.evaluate(where => {
  const G = window.sky, A = G.api, P = G.course.path, c = G.course
  const near = p => { let bi = 0, bd = 1e9; P.forEach((q, i) => { if (!q.p || q.branch) return; const d = Math.hypot(q.p[0] - p[0], q.p[1] - p[1], q.p[2] - p[2]); if (d < bd) { bd = d; bi = i } }); return bi }
  let i = 12
  if (where === 'can') i = near(c.cans[0].p) - 10
  if (where === 'boom') i = G.boom.i - 12
  if (where === 'horn') i = G.birds.blocker.i - 14
  if (where === 'crow') i = G.birds.flocks[0].i - 14
  if (where.startsWith('trap:')) i = c.traps.find(t => t.kind === where.slice(5)).i - 30 // v36
  if (where === 'chase') i = c.chases[1].i0 - 30
  if (where === 'hermit') i = G.v35.hermit.spot.i - 30
  if (where === 'lady') i = G.ladyV.spot.i - 30
  if (where === 'boulder') i = c.boulder.slopeI0 - 8
  if (where === 'drum') i = c.path.findIndex(q => q.kind === 'drum') - 30
  if (where.startsWith('mark:')) i = c.marks.find(m => m.name === where.slice(5)).i0 - 4
  const q = P[Math.max(1, i)], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); A.placeBike(b); A.buildAll()
}, where)
const rows = []
const ONLYF = process.env.ONLY
for (const [nm, where, keys, sec] of [['ニトロ 1回目', 'start', ['thr', 'nit'], 2], ['ニトロ 2回目', 'start', ['thr', 'nit'], 2], ['燃料の缶', 'can', ['thr'], 4], ['爆発するドラム缶', 'boom', ['thr'], 4], ['クラクションのカラス', 'horn', ['thr'], 5], ['普通のカラス', 'crow', ['thr'], 4], ['v36 鉄骨', 'trap:girder', ['thr'], 5], ['v36 油', 'trap:oil', ['thr'], 3], ['v36 落とし扉', 'trap:door', ['thr'], 3], ['v36 プレス機', 'trap:press', ['thr'], 4], ['v36 猿', 'chase', ['thr'], 6], ['v40 お姉さん', 'lady', ['thr'], 6], ['v41 落石の坂', 'boulder', ['thr'], 7], ['v35 廃墟の男', 'hermit', ['thr'], 5], ['v35 回る筒', 'drum', ['thr'], 6], ['v37 暗い通路', 'mark:真っ暗な通路', ['thr'], 5], ['v37 草原', 'mark:明るい草原', ['thr'], 6], ['v37 風車', 'mark:風車の羽根', ['thr'], 5], ['v37 綱渡り', 'mark:ワイヤーの綱渡り', ['thr'], 4]]) {
  if (ONLYF && !nm.includes(ONLYF)) continue
  await place(where); await page.waitForTimeout(1500)
  const r = await page.evaluate(async ([keys, sec]) => { const G = window.sky, R = G.api.renderer, n0 = R.info.programs.length; window.__lt = []; const t0 = performance.now(); G.running = true; for (const k of keys) G.keys.add(k)
    while (performance.now() - t0 < sec * 1000) await new Promise(r => requestAnimationFrame(r))
    for (const k of keys) G.keys.delete(k); const lt = window.__lt.filter(x => x[0] >= t0).map(x => Math.round(x[1])); return { progs: R.info.programs.length - n0, lt, max: lt.length ? Math.max(...lt) : 0, nitro: G.bike.nitroOn } }, [keys, sec])
  rows.push([nm, r]); console.log(nm, `新しいシェーダ ${r.progs}・止まり 50ms 以上 ${r.lt.length} 回（最大 ${r.max}ms）`)
}
console.log('errors', errs.length ? errs.slice(0, 3) : 'none'); await br.close(); process.exit(0)
