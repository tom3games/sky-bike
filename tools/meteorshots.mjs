// v77 隕石の画面確認（無音）: node tools/meteorshots.mjs <出力フォルダ> [幅x高さ] [道の点,道の点…]
// 高い所の道の上に置いて前体重で止まり続ける → 兆し（2.5・3.5 秒）・落下（4.3・4.75 秒）・着弾（5.05 秒）・吹き飛ぶ（5.3・5.7・6.3 秒）・焦げ跡（出し直し前 7.6 秒）を撮る
// 動いている時（全開で走る 8 秒）に兆しが出ないことも数える
import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || String(6900 + Math.floor(Math.random() * 90))
await import('../server.mjs')
const OUT = (process.argv[2] || 'shots/v77').replace(/\/$/, '') + '/', [W, H] = (process.argv[3] || '1280x720').split('x').map(Number), SPOTS = (process.argv[4] || '4042,5148').split(',').map(Number)
mkdirSync(OUT, { recursive: true })
const SRC = process.env.SRC === '1' ? '&src=1' : ''
const br = process.env.WK ? await webkit.launch() : await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', hasTouch: H > W, isMobile: H > W }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) }); page.on('requestfailed', r => errs.push('fail ' + r.url()))
await page.goto(`http://localhost:${PORT}/?stay=1${SRC}`); await page.waitForFunction('window.__skyReady', null, { timeout: 120000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); if (window.sky.story) window.sky.story.t0 = null }); await page.waitForTimeout(1500)
const tag = (H > W ? '_sp' : '') + (process.env.WK ? '_wk' : '')
const shot = n => page.screenshot({ path: OUT + n + tag + '.jpg', type: 'jpeg', quality: 80 })
const place = (i, inp) => page.evaluate(([i, inp]) => { const G = window.sky, A = G.api, q = G.course.path[i]; let r = 0; G.course.cps.forEach((c, k) => { if (c.rest && c.p[1] <= q.p[1] + 1 && k < 59) r = k }); G.R.rest = G.R.cp = r; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); A.placeBike(b); G.state = 'play'; G.running = true; G.spawnHold = false; G.testInput = () => inp; G.meteorSigns = 0; G.meteorHits = 0; return { y: +(q.p[1] - G.course.cps[0].p[1]).toFixed(1), rest: r } }, [i, inp])
const st = () => page.evaluate(() => { const G = window.sky, b = G.bike, M = G.R.mt || {}, bv = G.api.bikeView, S = typeof Snd !== 'undefined' ? Snd : null; const sc = G.meteorV && G.meteorV.group.children.filter(o => o.visible && o.renderOrder === 5).map(o => { const v = o.position.clone().project(G.api.camera); return [Math.round((v.x + 1) / 2 * innerWidth), Math.round((1 - v.y) / 2 * innerHeight)] }); return { sc, ph: M.ph, n: M.n, crashed: b.crashed && b.crashed.why, bike: b.p.map(v => +v.toFixed(2)), rider: bv && bv.fly ? [bv.rider.position.x, bv.rider.position.y, bv.rider.position.z].map(v => +v.toFixed(2)) : null, signs: G.meteorSigns, hits: G.meteorHits, hitMs: G.meteorHitMs, played: S && { boom: S.played.boom, whoosh: S.played.whoosh, scream: S.played.scream }, mute: window.__muteOk ? window.__muteOk() : null, ctx: S && S.ctx ? S.ctx.state : null } })
const log = { spots: {} }
for (const i of SPOTS) {
  const at = await place(i, { thr: 0, brk: 0, lean: 1, steer: 0 })
  const t0 = Date.now(), L = []
  for (const [t, n] of [[2.5, 'sign1'], [3.5, 'sign2'], [4.1, 'fall0'], [4.45, 'fall1'], [4.8, 'fall2'], [5.05, 'hit'], [5.3, 'blast1'], [5.7, 'blast2'], [6.3, 'blast3'], [7.6, 'scorch']]) {
    const w = t * 1000 - (Date.now() - t0); if (w > 0) await page.waitForTimeout(w)
    await shot(`m${i}_${n}`); L.push({ n, t: +((Date.now() - t0) / 1000).toFixed(2), ...(await st()) })
  }
  log.spots[i] = { at, seq: L }
  // 走っている間は出ない
  await place(i, { thr: 1, brk: 0, lean: 0, steer: 0 })
  await page.waitForTimeout(8000)
  log.spots[i].moving = await st()
}
log.errs = errs
writeFileSync(OUT + 'log' + tag + '.json', JSON.stringify(log, null, 1))
console.log(JSON.stringify(log).slice(0, 3000))
await br.close(); process.exit(0)
