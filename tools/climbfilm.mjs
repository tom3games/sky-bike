// 高い縁の登りを、ゲームの画面（いつものカメラ）で 30fps の連番に撮る。人の速さ（0.2 秒遅れ）の bot で。
// node tools/climbfilm.mjs <出力のフォルダ> [L=縁の番号 0] → <フォルダ>/f000.jpg … と sheet.jpg（並べた一覧）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
const PORT = process.env.PORT = process.env.FPORT || '5386'
await import('../server.mjs')
const out = process.argv[2] || 'shots/climb', L = +(process.env.L || 0)
mkdirSync(out, { recursive: true })
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ locale: 'ja-JP', viewport: { width: 640, height: 360 }, deviceScaleFactor: 1 }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`)
await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
const v = await page.evaluate(() => [...document.scripts].map(s => s.src).find(s => /game\.js/.test(s)).split('v=')[1])
await page.evaluate(async ([L, v]) => {
  const G = window.sky, A = G.api
  const B = await import('./js/bot.js?v=' + v)
  G.startRun('stage1')
  const P = G.course.path, led = []; for (let i = 1; i < P.length; i++) if (P[i].kind === 'hang' && !P[i].branch) led.push(i)
  const li = led[L]; let k = li, d = 0; while (k > 0 && d < 9 && P[k - 1].p && P[k - 1].w) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- }
  const q = P[k], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })
  for (let s = 0; s < 30; s++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
  b.v = [Math.cos(q.yaw) * 2, 0, -Math.sin(q.yaw) * 2]
  A.placeBike(b)
  const bot = B.createBot(G.course, { skill: 'good', react: 12 }); bot.world = G.world; B.resetBot(bot, G.bike)
  G.testInput = () => B.botInput(bot, G.bike)
  G.hold = true; G.running = true; G.acc = 0
  G.__ledge = P[li]
}, [L, v])
await page.waitForTimeout(1500)
let n = 0, upAt = null, started = false
for (let f = 0; f < 600 && n < 150; f++) {
  const st = await page.evaluate(() => { const G = window.sky, A = G.api; for (let k = 0; k < 2; k++) A.fixedStep(); G.acc = 0; const b = G.bike, q = G.__ledge; return { hang: !!b.hang, d: Math.hypot(b.p[0] - q.p[0], b.p[2] - q.p[2]), y: b.p[1] - q.p[1], th: b.th * 57.3 } })
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
  if (!started && (st.hang || st.d < 2.6)) started = true
  if (started && !st.hang && st.y > 1.2 && upAt == null) upAt = n
  if (started) { await page.screenshot({ path: `${out}/f${String(n).padStart(3, '0')}.jpg`, quality: 70 }); n++ }
  if (upAt != null && n - upAt > 30) break
}
// 並べた一覧（6 枚ごとに 1 枚 = 0.2 秒おき）
const files = readdirSync(out).filter(f => /^f\d+\.jpg$/.test(f)).sort()
const pick = files.filter((_, i) => i % 3 === 0).slice(0, 40)
const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(5,256px);gap:2px">${pick.map(f => `<div style="position:relative"><img src="data:image/jpeg;base64,${readFileSync(out + '/' + f).toString('base64')}" style="width:256px;display:block"><span style="position:absolute;left:4px;top:2px;color:#fff;font:12px sans-serif;text-shadow:0 0 3px #000">${f}</span></div>`).join('')}</body>`
const p2 = await ctx.newPage(); await p2.setViewportSize({ width: 5 * 258, height: Math.ceil(pick.length / 5) * 146 }); await p2.setContent(html); await p2.waitForTimeout(300)
await p2.screenshot({ path: `${out}/sheet.jpg`, quality: 75, fullPage: true })
console.log('frames', n, 'up at frame', upAt, 'errors', errs.length, errs.slice(0, 3))
await br.close(); process.exit(0)
