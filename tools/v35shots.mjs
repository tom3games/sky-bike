// v35 の画面と動き: 回る筒（全開で一周・口の板が回る）・廃墟の男（自動で止まる・3 行・ハンカチ）・兄の跡 8 か所・門の前の手紙と結果の持ち物
// node tools/v35shots.mjs（無音。shots/v35/ に撮る）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.VPORT || '5872'
await import('../server.mjs')
const OUT = 'shots/v35/'
const W = +(process.env.W || 1280), H = +(process.env.H || 720)
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1${process.env.LANG2 ? '' : ''}`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
if (process.env.EN) await page.evaluate(() => window.sky.api.setLang('en'))
await page.evaluate(() => window.sky.startRun('stage1'))
await page.evaluate(() => window.sky.api.buildAll())
const sh = n => page.screenshot({ path: OUT + n + (process.env.TOUCH ? '_sp' : '') + (process.env.EN ? '_en' : '') + '.png' })
const atPath = (i, back = 0) => page.evaluate(([i, back]) => { const G = window.sky, A = G.api, P = G.course.path; let k = i, d = 0; while (k > 0 && d < back) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- } const q = P[k], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let n = 0; n < 30; n++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); A.placeBike(b); G.running = true; return k }, [i, back])
const rafs = n => page.evaluate(async n => { for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)) }, n)
const R = {}
// ---------------- 1 筒
if (!process.env.SKIP1) {
  await page.evaluate(() => { const G = window.sky; G.api.spawnAt(G.course.cps.findIndex(q => q.name === '回る筒の手前')); G.running = true; G.keys.add('thr') })
  const t0 = Date.now(); let shots = 0; const log = []
  while (Date.now() - t0 < 16000) {
    await rafs(2)
    const s = await page.evaluate(() => { const G = window.sky, b = G.bike, D = G.world.drums[0], dx = b.p[0] - D.c[0], dy = b.p[1] - D.c[1], dz = b.p[2] - D.c[2], fw = dx * D.f[0] + dz * D.f[2]; return { fw, dy, open: D.open, cr: !!b.crashed, k: G.drumK || 0, sp: b.speed } })
    log.push(s)
    if (shots === 0 && s.fw > -16) { await sh('drum1_approach'); shots++ }
    if (shots === 1 && s.fw > -1 && s.dy < -4) { await sh('drum2_in'); shots++ }
    if (shots === 2 && s.dy > 3.5) { await sh('drum3_top'); shots++ }
    if (shots === 3 && s.open && s.dy < -4 && s.fw > 0.5) { await sh('drum4_out'); shots++ }
    if (shots === 4 && s.fw > 14) { await sh('drum5_after'); shots++; break }
  }
  R.drum = { shots, opened: log.some(s => s.open), crashed: log.some(s => s.cr), maxCamK: Math.max(...log.map(s => s.k)).toFixed(2) }
  await page.evaluate(() => window.sky.keys.clear())
}
// ---------------- 2 廃墟の男
if (!process.env.SKIP2) {
  await page.evaluate(() => { const G = window.sky; G.hank = false; G.hm = { ph: 'wait' }; G.api.spawnAt(G.course.cps.findIndex(q => q.name === '廃墟の回廊の入口')); G.running = true; G.keys.add('thr') })
  await page.waitForFunction(() => window.sky.v35.hermit.ready, null, { timeout: 20000 })
  const t0 = Date.now(), seen = []; let stopAt = null, shot = 0
  while (Date.now() - t0 < 30000) {
    await rafs(2)
    const s = await page.evaluate(() => { const G = window.sky, H = G.v35.hermit, sp = H.spot, b = G.bike, hx = Math.cos(sp.yaw), hz = -Math.sin(sp.yaw); return { ph: G.hm.ph, st: H.state, ahead: (sp.p[0] - b.p[0]) * hx + (sp.p[2] - b.p[2]) * hz, v: b.speed, txt: document.getElementById('talk').classList.contains('on') ? document.getElementById('talkTxt').textContent : '' } })
    if (s.txt && seen[seen.length - 1] !== s.txt) seen.push(s.txt)
    if (shot === 0 && s.st === 'out') { await rafs(40); await sh('hm1_out'); shot++ }
    if (shot === 1 && s.ph === 'talk') { stopAt = [s.ahead.toFixed(2), s.v.toFixed(2)]; await rafs(10); await sh('hm2_talk1'); shot++; await page.waitForTimeout(600); await page.keyboard.press('ArrowRight') }
    if (shot === 2 && seen.length === 3) { await rafs(30); await sh('hm3_give'); shot++ }
    if (shot === 3 && s.ph === 'item') { await rafs(10); await sh('hm4_item'); shot++ }
    if (shot === 4 && s.ph === 'done') { await rafs(60); await sh('hm5_after'); shot++; break }
  }
  R.hermit = { stopAt, lines: seen, hank: await page.evaluate(() => window.sky.hank) }
  // 出し直して、もう一度近づく（止まらずに手を振るだけ）
  await page.evaluate(() => { const G = window.sky; G.keys.clear(); G.api.spawnAt(G.course.cps.findIndex(q => q.name === '廃墟の回廊の入口')); G.running = true; G.keys.add('thr') })
  let st2 = [], minV = 99
  for (let k = 0; k < 120; k++) { await rafs(3); const s = await page.evaluate(() => { const G = window.sky, H = G.v35.hermit, sp = H.spot, b = G.bike, hx = Math.cos(sp.yaw), hz = -Math.sin(sp.yaw); return { st: H.state, ph: G.hm.ph, ahead: (sp.p[0] - b.p[0]) * hx + (sp.p[2] - b.p[2]) * hz, v: b.speed } }); if (!st2.includes(s.st)) st2.push(s.st); if (s.ahead < 20 && s.ahead > 0) minV = Math.min(minV, s.v); if (k === 40) await sh('hm6_bye'); if (s.ahead < -5) break }
  R.hermit2 = { states: st2, minSpeedNear: minV.toFixed(1) }
  await page.evaluate(() => window.sky.keys.clear())
}
// ---------------- 3 兄の跡
if (!process.env.SKIP3) {
  await page.evaluate(() => { window.sky.story.t0 = null })
  const tr = await page.evaluate(() => window.sky.v35.traces.map(t => ({ i: t.i, k: t.k, kind: t.kind, ja: t.ja })))
  R.traces = []
  for (const t of tr) {
    await atPath(t.i, 13); await rafs(30); await sh('look' + t.k + '_' + t.kind)
    await page.evaluate(() => document.getElementById('story').classList.remove('on'))
    await atPath(t.i, 7)
    await page.evaluate(() => { const b = window.sky.bike; b.v = [Math.cos(b.psi) * 6, 0, -Math.sin(b.psi) * 6] })
    await page.evaluate(() => window.sky.keys.add('thr'))
    let cap = ''; for (let n = 0; n < 90; n++) { await rafs(2); cap = await page.evaluate(() => document.getElementById('story').classList.contains('on') ? document.getElementById('story').textContent : ''); if (cap) break }
    await rafs(4); await sh('trace' + t.k + '_' + t.kind)
    await page.evaluate(() => window.sky.keys.clear())
    const dbg = await page.evaluate(() => { const G = window.sky, b = G.bike; return { si: G.steer.i, st: G.state, cr: !!b.crashed, v: +b.speed.toFixed(1) } })
    R.traces.push({ k: t.k, kind: t.kind, i: t.i, ok: cap === t.ja, cap, dbg })
  }
}
// ---------------- 4 門の前の手紙と結果
if (!process.env.SKIP4) {
  await page.evaluate(() => { window.sky.hank = true })
  const fi = await page.evaluate(() => { const G = window.sky, q = G.course.cps.find(c => c.finish); let bi = 0, bd = 1e9; G.course.path.forEach((z, i) => { if (!z.p || z.branch) return; const d = Math.hypot(z.p[0] - q.p[0], z.p[1] - q.p[1], z.p[2] - q.p[2]); if (d < bd) { bd = d; bi = i } }); return bi })
  await atPath(fi, 14); await page.evaluate(() => window.sky.keys.add('thr'))
  await rafs(20); await sh('gate1_helmet')
  await page.waitForFunction(() => window.sky.state === 'result', null, { timeout: 20000 })
  await page.waitForTimeout(1500); await sh('gate2_letter')
  await page.waitForTimeout(2600); await sh('gate3_tracks')
  R.tracksVisible = await page.evaluate(() => window.sky.v35.tracks.visible)
  await page.waitForTimeout(3600); await sh('gate4_result')
  R.result = await page.evaluate(() => ({ item: document.getElementById('rItemTxt').textContent, shown: getComputedStyle(document.getElementById('rItem')).display, letter: document.getElementById('letterTxt').textContent }))
}
console.log(JSON.stringify(R, null, 1))
console.log('errors', errs.length, errs.slice(0, 6))
await br.close(); process.exit(0)
