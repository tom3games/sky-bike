// v67 縁石の曲がりに速すぎた時の一連（滑る → 縁に当たる → 投げ出される／道の外へ落ちる）を実画面でコマ撮りする。
//   node tools/curbshots.mjs <tag> [場所の名前] [nitro=1]   → shots/curb/<tag>_NN.png と一覧 shots/curb/<tag>.png
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const TAG = process.argv[2] || 'now', NAME = process.argv[3] || '見極めの台', NIT = process.argv[4] !== '0'
const PORT = process.env.PORT = process.env.PORT || '6217'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 960, height: 540 }, locale: 'ja-JP' }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1&bot=good`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); if (window.sky.story) window.sky.story.t0 = null })
mkdirSync('shots/curb', { recursive: true })
const info = await page.evaluate(([NAME, NIT]) => {
  const G = window.sky, A = G.api, c = G.course, P = c.path
  const nm = i => { let n = ''; for (const m of c.marks || []) if (i >= m.i0) n = m.name; return n }
  const D = (c.decor || []).filter(d => d.kind === 'curb').find(d => nm(d.i0) === NAME); if (!D) return null
  let i0 = D.i0; for (let n = 0, d = 0; n < 40 && i0 > 1 && d < 24; n++) { const a = P[i0], z = P[i0 - 1]; if (!z.p || z.kind === 'jump' || z.kind === 'lip') break; d += Math.hypot(a.p[0] - z.p[0], a.p[2] - z.p[2]); i0-- }
  const q = P[i0], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let n = 0; n < 30; n++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 })
  b.v = [Math.cos(q.yaw) * 11, 0, -Math.sin(q.yaw) * 11]; A.placeBike(b); G.running = true; G.spawnHold = false
  const base = G.testInput; G.testInput = () => { const i = base(); if (NIT) G.bike.nitro = 1; return { ...i, thr: 1, brk: 0, lean: 0, nitro: NIT ? 1 : 0 } }
  G.__why = ''; return { i0, d0: D.i0, d1: D.i1 }
}, [NAME, NIT])
if (!info) { console.log('場所が無い', NAME); process.exit(1) }
const rafs = n => page.evaluate(async n => { for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)) }, n)
const log = []
for (let k = 0; k < 20; k++) {
  await page.screenshot({ path: `shots/curb/${TAG}_${String(k).padStart(2, '0')}.png` })
  log.push(await page.evaluate(() => { const G = window.sky, b = G.bike; return `v${b.speed.toFixed(1)}${b.crashed ? ' 転倒:' + b.crashed.why : ''} y${b.p[1].toFixed(1)} ${(document.getElementById('why') || {}).textContent || ''}` }))
  await rafs(9)
}
console.log(log.map((s, k) => k + ': ' + s).join('\n')); console.log('errors', errs.length, errs.slice(0, 3))
console.log('mute', await page.evaluate(() => window.__muteOk ? window.__muteOk() : 'なし'))

await br.close(); process.exit(0)
