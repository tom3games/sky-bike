// 水の上に止めて置き、実画面で何 m 流されるかと見た目を撮る。 node tools/watershots.mjs <tag> <道の点,...>
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const TAG = process.argv[2] || 'now', PTS = (process.argv[3] || '1587').split(',').map(Number)
const PORT = process.env.PORT = process.env.PORT || '6231'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 960, height: 540 }, locale: 'ja-JP' }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1&bot=good`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); if (window.sky.story) window.sky.story.t0 = null })
mkdirSync('shots/water', { recursive: true })
const rafs = n => page.evaluate(async n => { for (let k = 0; k < n; k++) await new Promise(r => requestAnimationFrame(r)) }, n)
for (const i of PTS) {
  await page.evaluate(i => { const G = window.sky, A = G.api, q = G.course.path[i]
    const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let n = 0; n < 30; n++) A.stepBike(G.world, b, { thr: 0, brk: 0, lean: 0, steer: 0 }); b.v = [0, 0, 0]; A.placeBike(b); G.running = true; G.spawnHold = false
    G.testInput = () => ({ thr: 0, brk: 0, lean: 0, steer: 0, nitro: 0 }); G.__p0 = G.bike.p.slice(); G.__q = q }, i)
  const log = []
  for (let k = 0; k < 4; k++) { await page.screenshot({ path: `shots/water/${TAG}_${i}_${k}.png` }); log.push(await page.evaluate(() => { const G = window.sky, b = G.bike, q = G.__q, R = [Math.sin(q.yaw), Math.cos(q.yaw)]; return '右へ' + ((b.p[0] - G.__p0[0]) * R[0] + (b.p[2] - G.__p0[2]) * R[1]).toFixed(2) + ' 落' + (G.__p0[1] - b.p[1]).toFixed(1) + (G.spawnHold ? ' HOLD' : '') })); await rafs(30) }
  console.log(i, log.join(' | '))
}
console.log('errors', errs.length, errs.slice(0, 2)); await br.close(); process.exit(0)
