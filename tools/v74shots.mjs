// v74 の見た目の確認: 兄の録音機（手前へ動かした所）・腕のある大きい歯車（止まって見る 3 枚＋押しっぱなしで入る 6 枚）。node tools/v74shots.mjs <出力フォルダ> [幅x高さ]（無音）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || String(6700 + Math.floor(Math.random() * 200))
await import('../server.mjs')
const OUT = (process.argv[2] || 'shots/v74').replace(/\/$/, '') + '/', [W, H] = (process.argv[3] || '1280x720').split('x').map(Number)
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', hasTouch: H > W, isMobile: H > W }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); window.sky.story.t0 = null }); await page.waitForTimeout(800)
const tag = H > W ? '_sp' : ''
const place = (i, back = 0) => page.evaluate(([i, back]) => { const G = window.sky, A = G.api, P = G.course.path; let k = i, d = 0; while (k > 0 && d < back) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- } const q = P[k]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); A.placeBike(b); G.state = 'play'; G.running = true; return k }, [i, back])
const info = await page.evaluate(() => { const G = window.sky; return { rec: G.recorder ? G.recorder.i : -1, gear: G.course.path.findIndex(q => q.kind === 'gear'), crow: G.birds && G.birds.blocker ? G.birds.blocker.i : -1 } })
await place(info.rec, 8); await page.waitForTimeout(1500); await page.screenshot({ path: OUT + 'recorder' + tag + '.jpg', type: 'jpeg', quality: 75 })
await place(info.gear, 5); for (let k = 0; k < 3; k++) { await page.waitForTimeout(k ? 2500 : 1500); await page.screenshot({ path: OUT + 'gear_wait' + k + tag + '.jpg', type: 'jpeg', quality: 75 }) }
await place(info.gear, 5); await page.waitForTimeout(600); await page.keyboard.down('ArrowUp'); const log = []
for (let k = 0; k < 8; k++) { await page.waitForTimeout(450); await page.screenshot({ path: OUT + 'gear_hold' + k + tag + '.jpg', type: 'jpeg', quality: 75 }); log.push(await page.evaluate(() => { const G = window.sky; return [G.steer.i, G.course.path[G.steer.i].kind, +G.bike.speed.toFixed(1), G.bike.crashed ? G.bike.crashed.why : ''].join(' ') })) }
await page.keyboard.up('ArrowUp')
console.log(JSON.stringify(info), log.join(' | ')); console.log('errors', errs.length, errs.slice(0, 5), 'mute', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await br.close(); process.exit(0)
