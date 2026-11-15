// v51 三つの歯車を、ゲームの画面（いつものカメラ）で人の速さの bot に走らせて、決まった間隔で撮る。旗「歯車の前」から「風車の前」まで
// node tools/vgearfilm.mjs <出力のフォルダ>  （VW/VH=画面の大きさ、EVERY=何コマおきに撮るか、T0=始める時刻）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.FPORT || '5391'
await import('../server.mjs')
const out = process.argv[2] || 'shots/vgearfilm', W = +(process.env.VW || 1280), H = +(process.env.VH || 720), EVERY = +(process.env.EVERY || 60)
mkdirSync(out, { recursive: true })
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ locale: 'ja-JP', viewport: { width: W, height: H }, deviceScaleFactor: W < 600 ? 2 : 1, isMobile: W < 600, hasTouch: W < 600 }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.addInitScript(() => { try { localStorage.setItem('sky-tut-done', '1') } catch (e) {} })
await page.goto(`http://localhost:${PORT}/?stay=1`)
await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
const v = '50' // js/ を直接読む（dist とは別の複製。bot は状態を外に持たない）
await page.evaluate(async ([v, t0]) => {
  const G = window.sky, A = G.api
  const B = await import('./js/bot.js?v=' + v)
  G.startRun('stage1')
  const ci = G.course.cps.findIndex(q => q.name === '歯車の前'); A.spawnAt(ci)
  G.world.setTime(t0)
  const bot = B.createBot(G.course, { skill: 'good', react: 12 }); bot.world = G.world; B.resetBot(bot, G.bike)
  G.testInput = () => B.botInput(bot, G.bike)
  G.hold = true; G.running = true; G.acc = 0
  A.buildAll()
}, [v, +(process.env.T0 || 0)])
await page.waitForTimeout(1500)
const n0 = await page.evaluate(() => window.sky.course.notes.find(n => n.kind === 'vgear'))
let shots = 0, res = null
for (let f = 0; f < 60 * 60; f += 2) {
  const st = await page.evaluate(() => { const G = window.sky, A = G.api; for (let k = 0; k < 2; k++) A.fixedStep(); G.acc = 0; const b = G.bike, n = G.course.notes.find(n => n.kind === 'vgear'), f0 = [Math.cos(n.yaw), 0, -Math.sin(n.yaw)]; return { x: (b.p[0] - n.A[0]) * f0[0] + (b.p[2] - n.A[2]) * f0[2], y: b.p[1] - n.A[1], crashed: !!b.crashed, t: G.world.time, span: n.D.span, faults: G.R ? G.R.faults : null } })
  if (f % EVERY === 0) { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); await page.screenshot({ path: `${out}/f${String(shots).padStart(3, '0')}.jpg`, quality: 72 }); shots++ }
  if (st.x > st.span + 4) { res = { ok: true, ...st }; break }
  if (st.y < -4) { res = { ok: false, why: 'fall', ...st }; break }
}
const mute = await page.evaluate(() => window.__muteOk ? window.__muteOk() : 'n/a')
console.log(W + 'x' + H, JSON.stringify(res), 'shots', shots, 'mute', mute, 'errors', errs.length ? errs.slice(0, 5) : 'none')
await br.close(); process.exit(0)
