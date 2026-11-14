// v36 爆発する缶の山: 山の手前の旗「見極めの台」からアクセルを押してふつうに道を走り、缶の山の横を通る。爆発の前と後を撮り、山の缶の模型が全部消えたか（見えている数）を数える
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.BPORT || String(6100 + Math.floor(Math.random() * 800))
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForFunction('window.sky.api.built && window.sky.api.built.props', null, { timeout: 90000 })
// 缶の山の手前の旗「見極めの台」から、アクセルを押して道を走る（置き直さない）
await page.evaluate(() => { const G = window.sky; G.api.spawnAt(G.course.cps.findIndex(q => q.name === '見極めの台')); G.running = true; G.keys.add('thr') })
const count = () => page.evaluate(() => { const G = window.sky, B = G.boom, all = [B, ...(B.ups || [])]; return all.map(u => { let m = null, bd = 1e9; G.api.built.props.children.forEach(o => { const d = Math.hypot(o.position.x - u.a[0], o.position.y - u.a[1], o.position.z - u.a[2]); if (d < bd) { bd = d; m = o } }); return m && bd < 0.3 && m.visible ? 1 : 0 }).reduce((a, b) => a + b, 0) })
const n0 = await count()
await page.waitForFunction(() => { const G = window.sky, B = G.boom, b = G.bike; return b && Math.hypot(b.p[0] - B.a[0], b.p[2] - B.a[2]) < 9 }, null, { timeout: 400000, polling: 50 })
await page.screenshot({ path: 'shots/v36/boom_before.png' })
await page.waitForFunction(() => window.sky.boom.done, null, { timeout: 20000, polling: 30 })
await page.waitForTimeout(450); await page.screenshot({ path: 'shots/v36/boom_mid.png' })
await page.waitForTimeout(2500)
const n1 = await count()
await page.evaluate(() => { const G = window.sky, B = G.boom; G.paused = true; G.api.camera.position.set(B.a[0] + 5, B.a[1] + 3, B.a[2] + 5); G.api.camera.lookAt(B.a[0], B.a[1] + 0.5, B.a[2]) })
await page.screenshot({ path: 'shots/v36/boom_after.png' })
console.log(JSON.stringify({ pile: 1 + (await page.evaluate(() => window.sky.boom.ups.length)), visibleBefore: n0, visibleAfter: n1, chain: await page.evaluate(() => window.sky.boomChain) }), 'errors', errs.length, errs.slice(0, 4))
await br.close(); process.exit(0)
