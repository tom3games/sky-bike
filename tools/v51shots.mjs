// v51 の見た目の確認: レーザーの床（手前・突き上げ）、爆発で消える床（爆発の瞬間）、風車、移した壁画、を実画面で撮る
// node tools/v51shots.mjs [幅x高さ] [webkit]   → shots/v51_*.png
import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || '6351'
await import('../server.mjs')
const [W, H] = (process.argv[2] || '1280x720').split('x').map(Number), wk = process.argv[3] === 'webkit'
const br = wk ? await webkit.launch() : await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP' }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() }); await page.waitForTimeout(800)
const tag = `${wk ? 'wk' : 'cr'}_${W}x${H}`
const place = (i, back = 0, v = 0) => page.evaluate(([i, back, v]) => { const G = window.sky, A = G.api, P = G.course.path; let k = i, d = 0; while (k > 0 && d < back) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- } const q = P[k]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); b.v = [Math.cos(q.yaw) * v, 0, -Math.sin(q.yaw) * v]; A.placeBike(b); G.state = 'play'; return k }, [i, back, v])
const info = await page.evaluate(() => { const c = window.sky.course; return { lasers: c.v51.lasers.map(x => x.i), blasts: c.v51.blasts.map(x => x.i), mill: c.path.findIndex(q => q.kind === 'blade') } })
// レーザー: 手前で止まって見る → 全開で突っ込む（前輪で切る）
await place(info.lasers[1], 7, 0); await page.waitForTimeout(1500)
await page.screenshot({ path: `shots/v51_${tag}_laser.png` })
await place(info.lasers[1], 12, 6); await page.keyboard.down('ArrowUp')
for (let k = 0; k < 40; k++) { await page.waitForTimeout(50); const t = await page.evaluate(() => window.sky.bike.spiked); if (t) break }
await page.waitForTimeout(250); await page.screenshot({ path: `shots/v51_${tag}_spiked.png` }); await page.keyboard.up('ArrowUp')
// 爆発: 全開で近づいて、爆発した瞬間
await place(info.blasts[0], 22, 10); await page.keyboard.down('ArrowUp')
for (let k = 0; k < 80; k++) { await page.waitForTimeout(40); const t = await page.evaluate(() => (window.sky.world.blasts || []).some(G => G.t0 != null)); if (t) break }
await page.waitForTimeout(120); await page.screenshot({ path: `shots/v51_${tag}_blast.png` }); await page.keyboard.up('ArrowUp')
// 風車
await place(info.mill, 14, 0); await page.waitForTimeout(2500); await page.screenshot({ path: `shots/v51_${tag}_mill.png` })
// 移した壁画（④）
const mi = await page.evaluate(() => { const s = window.sky.murals && window.sky.murals.spots ? window.sky.murals.spots.find(x => x.wall) : null; return s ? s.i : null })
if (mi != null) { await place(mi, 2, 0); await page.waitForTimeout(1500); await page.screenshot({ path: `shots/v51_${tag}_mural.png` }) }
console.log(tag, 'mural', mi, 'errors', errs.length, errs.slice(0, 5), 'mute', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await br.close(); process.exit(0)
