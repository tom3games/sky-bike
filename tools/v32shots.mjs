// v32 の見た目: 崩れ落ちる空中回廊（塔が倒れる・道が落ちる）・カラスの体当たり・天空城への大ジャンプ（飛んでいる所・着地）を、ゲームの画面で撮る
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = String(6000 + Math.floor(Math.random() * 2000)); await import('../server.mjs')
const OUT = process.env.OUT || 'shots/v32'
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); await page.addInitScript(() => { try { localStorage.setItem('sky-tut-done', '1') } catch (e) {} })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForFunction(() => window.sky.birds && window.sky.birds.ready, null, { timeout: 60000 }); await page.waitForTimeout(1000)
const at = cpName => page.evaluate(n => { const G = window.sky, A = G.api, c = G.course, k = c.cps.findIndex(q => q.name === n), q = c.cps[k]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let i = 0; i < 30; i++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); A.placeBike(b); A.buildAll(); G.running = true; G.keys.add('thr') }, cpName)
const shot = async (nm, ms) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${OUT}_${nm}.jpg`, quality: 80 }) }
await at('崩れる回廊の手前'); await shot('collapse1', 2600); await shot('collapse2', 900); await shot('collapse3', 1400); await shot('collapse4', 2500)
const st = await page.evaluate(() => ({ strikes: window.sky.strikeN || 0 }))
await page.evaluate(() => window.sky.keys.delete('thr'))
await at('大ジャンプの助走'); await shot('jump1', 3200); await shot('jump2', 1200); await shot('jump3', 1500); await shot('jump4', 1800); await shot('jump5', 2000)
const fin = await page.evaluate(() => ({ state: window.sky.state, crashed: !!(window.sky.bike && window.sky.bike.crashed) }))
console.log(JSON.stringify(st), JSON.stringify(fin), 'errors', errs.length ? errs.slice(0, 3) : 'none'); await br.close(); process.exit(0)
