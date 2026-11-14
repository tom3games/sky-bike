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
{ // 最初の方の平らな泥（v26）: 泥の 4 点手前に置いて全開で抜ける
  const info = await page.evaluate(() => { const G = window.sky, P = G.course.path, i = P.findIndex(q => q.kind === 'mud'); if (i < 0) return null
    const q0 = P[Math.max(0, i - 4)], q = G.course.cps[1]; G._cpBak = { p: q.p.slice(), yaw: q.yaw }; q.p = q0.p.slice(); q.yaw = q0.yaw
    G.R.rest = 1; G.R.cp = 1; G.api.retryCp(true); G.mudFarts = 0; return { i, keys: Object.keys(q0) } })
  console.log('泥の点', JSON.stringify(info))
  await page.keyboard.down('ArrowUp'); let mx = 0
  for (let k = 0; k < 40; k++) { await page.waitForTimeout(200); const r = await page.evaluate(() => { const b = window.sky.bike; const sh = b.cn[0] && b.g[0] ? window.sky.world.shapes[b.cn[0].id] : null; return [!!b._wasMud, +b.speed.toFixed(1), +(b._mudT || 0).toFixed(2), +(b._offMud || 0).toFixed(2), sh ? sh.tag + ':' + (sh.mud || 0) : 'air', window.sky.mudFarts || 0] }); if (r[0]) mx++; if (k % 2 == 0) console.log('  ', JSON.stringify(r)) }
  await page.keyboard.up('ArrowUp')
  const n = await page.evaluate(() => { const G = window.sky, q = G.course.cps[1]; q.p = G._cpBak.p; q.yaw = G._cpBak.yaw; return G.mudFarts || 0 })
  console.log('最初の泥', '泥の上', mx, '鳴った', n)
}
for (const dir of [-1, 1]) { // 泥の弧を両方の向きに走る
  await page.evaluate(dir => { const G = window.sky, s = G.world.shapes.find(x => x.mud && x.type === 'arc'), r = (s.r1 + s.r2) / 2
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
