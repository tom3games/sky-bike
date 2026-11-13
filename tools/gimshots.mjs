// 仕掛けの区間ごとのスクショ。node tools/gimshots.mjs <出力の頭>  （MARKS=名前,名前 で絞る。DT=秒 で待つ時間）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5378'
await import('../server.mjs')
const out = process.argv[2] || 'shots/gim'
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ locale: 'ja-JP', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })
await muteContext(ctx)
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message))
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`)
await page.waitForFunction('window.__skyReady', null, { timeout: 40000 })
await page.evaluate(() => window.sky.startRun('stage1'))
await page.waitForTimeout(800)
const names = (process.env.MARKS || '高い段をよじ登る,振り子の鉄球,見極めの台,泥の坂,湧き水の流れ,跳ね橋,落石,突風の細い張り出し,三つの鉄球').split(',')
for (const [k, name] of names.entries()) {
  const ok = await page.evaluate(([name, back]) => {
    const G = window.sky, A = G.api, c = G.course, m = c.marks.find(m => m.name === name); if (!m) return false
    const q = c.path[Math.max(0, m.i0 - back)]
    const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let j = 0; j < 20; j++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    A.placeBike(b); G.running = true; G.keys.clear(); return true
  }, [name, +(process.env.BACK || 2)])
  if (!ok) { console.log('なし', name); continue }
  await page.waitForTimeout(+(process.env.DT || 1.6) * 1000)
  await page.screenshot({ path: `${out}_${k}.png` })
  console.log(`${out}_${k}.png`, name)
}
console.log('errors', errs.length ? errs.slice(0, 5) : 'none')
await br.close(); process.exit(0)
