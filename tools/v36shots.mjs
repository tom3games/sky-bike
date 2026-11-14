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
// 鉄骨（1 か所目）: 全開で近づく → 影 → 落ちる
{ const g = traps.find(t => t.kind === 'girder'); await atPath(g.i, 34, 8); await page.evaluate(() => window.sky.keys.add('thr'))
  let ph = []; for (let n = 0; n < 140; n++) { await rafs(2); const s = await page.evaluate(() => { const G = window.sky, m = G.course.traps.find(t => t.kind === 'girder').shape.mov; return { t0: m.t0, now: G.world.time, cr: !!(G.bike.crashed) } }); if (s.t0 != null) { const tt = s.now - s.t0; if (!ph.includes('w') && tt > 1.2) { ph.push('w'); await sh('girder1_shadow') } if (!ph.includes('f') && tt > 3.25) { ph.push('f'); await sh('girder2_fall') } } if (s.cr && !ph.includes('c')) { ph.push('c'); await rafs(10); await sh('girder3_hit') } if (ph.length >= 3) break }
  R.girder = ph; await page.evaluate(() => window.sky.keys.clear()) }
// 油
{ const o = traps.find(t => t.kind === 'oil'); await atPath(o.i, 12, 5); await rafs(20); await sh('oil1'); R.oil = true }
// 落とし扉: 開いている時
{ const d = traps.find(t => t.kind === 'door'); await atPath(d.i, 10, 0); await page.waitForFunction(() => { const G = window.sky, T = G.course.traps.find(t => t.kind === 'door'); return T.shape.ax && Math.abs(T.shape.ax[0][1]) > 0.8 }, null, { timeout: 15000 }); await rafs(5); await sh('door_open') }
// プレス機
{ const p = traps.find(t => t.kind === 'press'); await atPath(p.i, 14, 7); await page.evaluate(() => window.sky.keys.add('thr')); let done = false; for (let n = 0; n < 100 && !done; n++) { await rafs(2); done = await page.evaluate(() => { const G = window.sky, t = G.course.traps.find(t => t.kind === 'press'), b = G.bike, hx = Math.cos(t.yaw), hz = -Math.sin(t.yaw); return (t.p[0] - b.p[0]) * hx + (t.p[2] - b.p[2]) * hz < 0.6 }) } await rafs(8); await sh('press_down'); R.press = await page.evaluate(() => ({ crashed: !!window.sky.bike.crashed, v: +window.sky.bike.speed.toFixed(1) })); await page.evaluate(() => window.sky.keys.clear()) }
// 猿 2 か所目: 予告 → 追う → アクセルだけで追いつかれてはたかれる
{ const ci = await page.evaluate(() => window.sky.course.chases[1].i0); await atPath(ci, 40, 9); await page.evaluate(() => window.sky.keys.add('thr'))
  const seen = []; for (let n = 0; n < 400; n++) { await rafs(2); const s = await page.evaluate(() => { const G = window.sky, st = G.R.ch && G.R.ch[1]; return { ph: st && st.ph, cr: G.bike.crashed && G.bike.crashed.why, rid: !!(G.api.bikeView && G.api.bikeView.fly) } })
    if (s.ph === 'warn' && !seen.includes('warn')) { seen.push('warn'); await rafs(30); await sh('imp1_warn') }
    if (s.ph === 'run' && !seen.includes('run')) { seen.push('run'); await rafs(70); await sh('imp2_chase') }
    if (s.ph === 'caught' && !seen.includes('caught')) { seen.push('caught'); await rafs(25); await sh('imp3_knocked'); await rafs(40); await sh('imp4_falling'); R.knock = s; break } }
  R.imp = seen; await page.evaluate(() => window.sky.keys.clear()) }
// 壁画 4 枚（走りながら見える位置）
{ const ms = await page.evaluate(() => window.sky.murals.spots.map(s => ({ k: s.k, i: s.i }))); R.murals = ms.length; for (const m of ms) { await atPath(m.i, 1, 0); await rafs(50); await sh('mural' + m.k) } }
// 2 か所目の猿の先の兄の跡
{ const t = await page.evaluate(() => { const x = window.sky.v35.traces.find(t => t.kind === 'claw'); return x && x.i }); if (t) { await page.evaluate(() => { document.getElementById('story').classList.remove('on'); window.sky.story.seen = {} }); await atPath(t, 12, 6); await page.evaluate(() => window.sky.keys.add('thr')); await rafs(40); await sh('trace_claw'); R.claw = await page.evaluate(() => document.getElementById('story').textContent) } }
console.log(JSON.stringify(R)); console.log('errors', errs.length, errs.slice(0, 6))
await br.close(); process.exit(0)
