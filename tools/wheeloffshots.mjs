// v51 下山の脱輪を実画面で: 外れた瞬間（吹き出し・転がる前輪）・ウィリーで小屋まで・何もしないと頭から転ぶ。node tools/wheeloffshots.mjs（無音）
// ENGINE=webkit / TOUCH=1 W=390 H=844 / OUT=保存先
import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync } from 'node:fs'
const PORT = process.env.PORT = process.env.VPORT || String(6100 + Math.floor(Math.random() * 800))
await import('../server.mjs')
const ENG = process.env.ENGINE || 'chromium', W = +(process.env.W || 1280), H = +(process.env.H || 720), TAG = ENG + '_' + W + 'x' + H
const OUT = (process.env.OUT || 'shots/wheeloff') + '/'; mkdirSync(OUT, { recursive: true })
const br = ENG === 'webkit' ? await webkit.launch(MUTE_LAUNCH) : await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1&bot=good`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); if (window.sky.story) window.sky.story.t0 = null })
const sh = n => page.screenshot({ path: OUT + n + '_' + TAG + '.png' })
const rafs = n => page.evaluate(async n => { for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)) }, n)
const until = (fn, ms = 60000) => page.waitForFunction(fn, null, { timeout: ms, polling: 16 })
// 下山を始めて、最後の区間「下山 小屋へ」の始まりへ置く（旗はその区間の旗）。lazy=true なら前輪が外れた後は何もしない（アクセルだけ）
const go = lazy => page.evaluate(lazy => {
  const G = window.sky, A = G.api, c = G.course, E = c.epi
  G.state = 'result'; G.resDone = 0; A.startEpi(() => { G.resDone = (G.resDone || 0) + 1 })
  const fl = E.cps[E.cps.length - 1]; G.R.cp = G.R.rest = fl
  const m = c.marks.find(x => x.name === '下山 小屋へ'), q = c.path[m.i0]
  const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let n = 0; n < 30; n++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); b.v = [Math.cos(q.yaw) * 6, 0, -Math.sin(q.yaw) * 6]; A.placeBike(b); G.running = true
  const base = G.__ti0 || (G.__ti0 = G.testInput)
  G.testInput = lazy ? () => { const i = base(); return G.bike.noFront ? { ...i, thr: 1, brk: 0, lean: 0, nitro: 0 } : i } : base
  G.wheelOffs = 0
}, lazy)
const R = {}
// 1) ウィリーで小屋まで
await go(false)
await until(() => window.sky.wheelOffs >= 1); await rafs(3); await sh('1_off')
R.line = await page.evaluate(() => ({ on: document.getElementById('talk').classList.contains('on'), txt: document.getElementById('talkTxt').textContent, nx: document.getElementById('talkNx').textContent, prop: window.sky.wheelProp.root.visible, front: window.sky.api.bikeView.wheels[1].visible }))
await rafs(25); await sh('2_rolling')
await until(() => window.sky.bike.noFront && window.sky.bike.noFront.t > 3.2); await sh('3_wheelie')
R.wheelie = await page.evaluate(() => ({ th: +(window.sky.bike.th * 57.3).toFixed(0), v: +window.sky.bike.speed.toFixed(1), crashed: !!window.sky.bike.crashed }))
await until(() => window.sky.epi && window.sky.epi.ph === 'end'); await rafs(40); await sh('4_cabin')
await until(() => window.sky.resDone >= 1, 20000).catch(() => {})
R.end = await page.evaluate(() => ({ res: window.sky.resDone, state: window.sky.state, th: +(window.sky.bike.th * 57.3).toFixed(0), crashed: !!window.sky.bike.crashed }))
// 2) 何もしない → 頭から
await page.evaluate(() => { document.getElementById('letter').classList.remove('on', 'quiet') })
await go(true)
await until(() => window.sky.wheelOffs >= 1)
await until(() => window.sky.bike.noFront && window.sky.bike.noFront.t > 2.15); await sh('5_tipping')
await until(() => window.sky.bike.crashed && (window.__cw = window.sky.bike.crashed.why)); await rafs(4); await sh('6_crash')
R.crash = await page.evaluate(() => ({ why: window.__cw, txt: document.getElementById('why').textContent }))
await until(() => !window.sky.bike.crashed && !window.sky.bike.noFront, 15000); await rafs(20); await sh('7_respawn')
R.respawn = await page.evaluate(() => ({ front: window.sky.api.bikeView.wheels[1].visible, prop: window.sky.wheelProp.root.visible, talk: document.getElementById('talk').classList.contains('on'), cp: window.sky.course.cps[window.sky.R.cp].name }))
R.mute = await page.evaluate(() => window.__muteOk ? window.__muteOk() : 'n/a')
console.log(TAG, JSON.stringify(R)); console.log('errors', errs.length, errs.slice(0, 6))
await br.close(); process.exit(0)
