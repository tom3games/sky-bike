// PC（1280x720）の描画の速さ: 区間ごとにバイクを置いて 4 秒ずつ、ゲームが数えている fps と描画の数（draw call・三角形）を読む（手元の GPU・ANGLE なので目安）
//   ZONES=crypt,ruin で区間を絞る
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.env.PORT = process.env.PORT || '6131'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, headless: process.env.HEADED ? false : true, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message))
await p.goto(`http://localhost:${process.env.PORT}/?stay=1`); await p.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await p.evaluate(() => window.sky.startRun('stage1')); await p.waitForTimeout(3000)
const zones = process.env.ZONES ? process.env.ZONES.split(',') : ['ground', 'crypt', 'ruin', 'storm', 'factory', 'bell', 'ice', 'roof', 'castle']
for (const z of zones) {
  const ok = await p.evaluate(z => { const G = window.sky, A = G.api, c = G.course; const idx = c.path.map((q, i) => q.p && q.zone === z ? i : -1).filter(i => i >= 0); if (!idx.length) return false; const q = c.path[idx[Math.floor(idx.length * 0.4)]]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); A.placeBike(b); G.running = true; return true }, z)
  if (!ok) continue
  await p.waitForTimeout(4000)
  const r = await p.evaluate(() => { const i = window.sky.api.renderer.info.render; return { fps: window.sky.fps, calls: i.calls, tri: i.triangles } })
  console.log(z.padEnd(8), 'fps', r.fps.toFixed(0), 'calls', r.calls, 'tri', (r.tri / 1000).toFixed(0) + 'k')
}
await br.close(); process.exit(0)
