// v76 の見た目の確認: 押す石と門（A）・ローラーの巻き上げ機（B）。node tools/v76shots.mjs <出力フォルダ> [幅x高さ] [場面,場面…]（無音）
// 場面: aview（旗から 3 つが 1 画面に入るか）apush（全開で石を押す）ahead（ボタンから全開 → 頭が当たる瞬間）bview bburn（ローラーの上で同時押し）bpass（通るだけ）
import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || String(6700 + Math.floor(Math.random() * 200))
await import('../server.mjs')
const OUT = (process.argv[2] || 'shots/v76').replace(/\/$/, '') + '/', [W, H] = (process.argv[3] || '1280x720').split('x').map(Number), ONLY = (process.argv[4] || '').split(',').filter(Boolean)
mkdirSync(OUT, { recursive: true })
const SRC = process.env.SRC === '0' ? '' : '&src=1'
const br = process.env.WK ? await webkit.launch() : await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', hasTouch: H > W, isMobile: H > W }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1${SRC}`); await page.waitForFunction('window.__skyReady', null, { timeout: 120000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); window.sky.story.t0 = null }); await page.waitForTimeout(800)
const tag = (H > W ? '_sp' : '') + (process.env.WK ? '_wk' : '')
const shot = n => page.screenshot({ path: OUT + n + tag + '.jpg', type: 'jpeg', quality: 78 })
// 仕掛け K（'A' か 'B'）の旗から s m の所に置く（world は作り直さないので、石・門・格子は time 0 に戻す）
const place = (K, s, reset = true) => page.evaluate(([K, s, reset]) => { const G = window.sky, A = G.api, V = G.course.v76[K], f = V.kind === 'A' ? V.ax : V.f; if (reset) G.world.setTime(0); if (typeof s === 'string') s = { plate: V.sPlate, roll: V.sRoll + 0.7, bfar: V.sRoll - 4.6, bnear: V.sRoll - 4 }[s]; const b = A.createBike({ p: [V.a[0] + f[0] * s, V.a[1] + 0.8, V.a[2] + f[2] * s], yaw: V.yaw }); A.placeBike(b); G.state = 'play'; G.running = true; G.spawnHold = false }, [K, s, reset])
const st = K => page.evaluate(K => { const G = window.sky, V = G.course.v76[K], b = G.bike, f = V.kind === 'A' ? V.ax : V.f; return { s: +((b.p[0] - V.a[0]) * f[0] + (b.p[2] - V.a[2]) * f[2]).toFixed(2), v: +b.speed.toFixed(1), crash: b.crashed ? b.crashed.why : '', x: V.x, h: +(V.h || 0).toFixed(2), k: V.k, prog: V.prog, burn: !!b.burn } }, K)
const want = n => !ONLY.length || ONLY.includes(n)
const log = {}
if (want('aview')) { await place('A', 0.5); await page.waitForTimeout(1800); await shot('a_view'); log.aview = await st('A') }
if (want('apush')) { await place('A', 0.5); await page.waitForTimeout(700); await page.keyboard.down('ArrowUp'); log.apush = []; for (let k = 0; k < 7; k++) { await page.waitForTimeout(650); await shot('a_push' + k); log.apush.push(await st('A')) } await page.keyboard.up('ArrowUp') }
if (want('ahead')) { await place('A', 'plate'); await page.waitForTimeout(3200); await shot('a_onbtn'); log.onbtn = await st('A'); await page.keyboard.down('ArrowUp'); log.ahead = []; for (let k = 0; k < 9; k++) { await page.waitForTimeout(k === 0 ? 900 : 140); await shot('a_head' + k); log.ahead.push(await st('A')) } await page.keyboard.up('ArrowUp') }
// 頭が当たる瞬間を 1 コマずつ進めて撮る: ボタンの上で門が上がり切ってから mode（full / nitro / slow）で走り、頭が門の 0.6m 手前・当たる直前・当たった直後・0.4 秒後
for (const mode of ['full', 'nitro', 'slow']) if (want('ahit') || want('ahit_' + mode)) {
  await place('A', 'plate'); await page.waitForTimeout(2600)
  const r = await page.evaluate(async mode => { const G = window.sky, A = G.api, V = G.course.v76.A; G.hold = true; G.testInput = () => ({ thr: mode === 'slow' ? (G.bike.speed < 6 ? 1 : 0) : 1, brk: 0, lean: 0, steer: 0, nitro: mode === 'nitro' ? 1 : 0 })
    const s = () => (G.bike.p[0] - V.a[0]) * V.ax[0] + (G.bike.p[2] - V.a[2]) * V.ax[2]; let n = 0; while (s() < V.sGate - 1.0 && n++ < 900) A.fixedStep(); return { s: +s().toFixed(2), v: +G.bike.speed.toFixed(1), h: +V.h.toFixed(3) } }, mode)
  await page.waitForTimeout(250); await shot('a_hit_' + mode + '_0'); const seq = [r]
  for (const [k, lab] of [[0, '1'], [1, '2'], [24, '3']]) { const q = await page.evaluate(k => { const G = window.sky, A = G.api, V = G.course.v76.A; const s = () => (G.bike.p[0] - V.a[0]) * V.ax[0] + (G.bike.p[2] - V.a[2]) * V.ax[2]; let n = 0; if (k === 0) { while (!G.bike.crashed && s() < V.sGate + 2 && n++ < 200) { const snap = { s: s(), v: G.bike.speed, h: V.h }; A.fixedStep(); if (G.bike.crashed) return { before: { s: +snap.s.toFixed(2), v: +snap.v.toFixed(1), h: +snap.h.toFixed(3) }, crash: G.bike.crashed.why } } } else for (let i = 0; i < k; i++) A.fixedStep(); return { s: +s().toFixed(2), v: +G.bike.speed.toFixed(1), h: +V.h.toFixed(3), crash: G.bike.crashed ? G.bike.crashed.why : '' } }, k); seq.push(q); await page.waitForTimeout(250); await shot('a_hit_' + mode + '_' + lab) }
  await page.evaluate(() => { const G = window.sky; G.hold = false; G.testInput = null }); log['ahit_' + mode] = seq
}
if (want('bview')) { await place('B', 'bfar'); await page.waitForTimeout(1800); await shot('b_view'); log.bview = await st('B') }
if (want('bclose')) { await place('B', 'bnear'); await page.waitForTimeout(1500); await shot('b_close') }
if (want('aclose')) { await place('A', 3.5); await page.waitForTimeout(1500); await shot('a_close') }
if (want('bpass')) { await place('B', 'bfar'); await page.waitForTimeout(600); await page.keyboard.down('ArrowUp'); for (let k = 0; k < 4; k++) { await page.waitForTimeout(450); await shot('b_pass' + k) } await page.keyboard.up('ArrowUp'); log.bpass = await st('B') }
if (want('bburn')) { await place('B', 'roll'); await page.waitForTimeout(900); await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowDown'); log.bburn = []; for (let k = 0; k < 6; k++) { await page.waitForTimeout(650); await shot('b_burn' + k); log.bburn.push(await st('B')) } await page.keyboard.up('ArrowDown'); await page.keyboard.up('ArrowUp'); await page.waitForTimeout(600); await shot('b_open') }
console.log(JSON.stringify(log)); console.log('errors', errs.length, errs.slice(0, 5), 'mute', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await br.close(); process.exit(0)
