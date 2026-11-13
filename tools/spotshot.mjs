// 道の点の番号の所にバイクを置いて、ゲームのカメラで撮る（新しい形の見た目の確認）。
// node tools/spotshot.mjs <tag> '<kind or index>,...'   kind: gal（屋根のある回廊）/hang（高い縁）/can（燃料の缶）/steep/hop
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || '6321'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 960, height: 540 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() }); await page.waitForTimeout(600)
const want = (process.argv[3] || 'gal,hang,can').split(',')
for (const [n, w] of want.entries()) {
  const idx = await page.evaluate(w => {
    const G = window.sky, P = G.course.path
    if (/^\d+$/.test(w)) return +w
    if (w === 'gal') { const s = G.course.shapes.find(s => s.tag === 'roof'); let bi = 0, bd = 1e9; P.forEach((q, i) => { if (!q.p) return; const ph = Math.atan2(-(q.p[2] - s.cz), q.p[0] - s.cx); const d = Math.abs(q.p[1] - (s.y0 - 3.95)) + Math.abs(Math.hypot(q.p[0] - s.cx, q.p[2] - s.cz) - (s.r1 + 2.4)); if (d < bd) { bd = d; bi = i } }); return Math.max(0, bi - 6) }
    if (w === 'can') { const cn = G.course.cans[0]; let bi = 0, bd = 1e9; P.forEach((q, i) => { if (!q.p) return; const d = Math.hypot(q.p[0] - cn.p[0], q.p[1] - cn.p[1], q.p[2] - cn.p[2]); if (d < bd) { bd = d; bi = i } }); return Math.max(0, bi - 8) }
    const k = P.findIndex((q, i) => q.kind === w && i > 200); return Math.max(0, k - 6)
  }, w)
  await page.evaluate(i => { const G = window.sky, A = G.api, q = G.course.path[i]; A.placeBike(A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw })); G.state = 'play' }, idx)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `shots/spot_${process.argv[2] || 'x'}_${w}.png` })
}
// ニトロ: 出発の広場で全開＋ニトロ
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(300)
await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1200); await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(500)
await page.screenshot({ path: `shots/spot_${process.argv[2] || 'x'}_nitro.png` })
const st = await page.evaluate(() => ({ v: window.sky.bike.speed, n: window.sky.bike.nitro, on: window.sky.bike.nitroOn }))
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('ArrowUp')
console.log('nitro', JSON.stringify(st)); console.log('errors', errs.length, errs.slice(0, 4))
await br.close(); process.exit(0)
