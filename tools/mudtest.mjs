// 泥から抜けた時の「ブリュッ」が鳴るか（v24）。泥の手前の旗から全開で走り、G.mudFarts を数える
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.MDPORT || '5793'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1&q=low`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(500)
let total = 0
for (const dir of [-1, 1]) { // 泥の弧を両方の向きに走る
  await page.evaluate(dir => { const G = window.sky, s = G.world.shapes.find(x => x.mud), r = (s.r1 + s.r2) / 2
    const ph = dir < 0 ? s.phi1 - 0.004 : s.phi0 + 0.004, y = s.y0 + s.b * (ph - s.phi0)
    const q = G.course.cps[1]; G._cpBak = { p: q.p.slice(), yaw: q.yaw }
    q.p = [s.cx + r * Math.cos(ph), y, s.cz - r * Math.sin(ph)]; q.yaw = dir < 0 ? ph - Math.PI / 2 : ph + Math.PI / 2
    G.mudFarts = 0; G.R.rest = 1; G.R.cp = 1; G.api.retryCp(true) }, dir)
  await page.waitForTimeout(150); await page.keyboard.down('ArrowUp'); let seen = 0, mt = 0
  for (let k = 0; k < 40; k++) { await page.waitForTimeout(200); const r = await page.evaluate(() => { const b = window.sky.bike; return [b._wasMud ? 1 : 0, b._mudT || 0] }); seen += r[0]; mt = Math.max(mt, r[1]) }
  await page.keyboard.up('ArrowUp')
  const n = await page.evaluate(() => { const G = window.sky, q = G.course.cps[1]; q.p = G._cpBak.p; q.yaw = G._cpBak.yaw; return G.mudFarts || 0 })
  total += n; console.log('向き', dir, '泥の上', seen, '泥の時間', mt.toFixed(2), '鳴った', n)
}
console.log('合計', total, 'errors', errs.slice(0, 3))
await br.close(); process.exit(0)
