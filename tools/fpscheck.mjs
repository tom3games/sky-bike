// PC（1280x720）の描画の速さ: いくつかの区間にバイクを置いて 4 秒ずつ、ゲームが数えている fps を読む（手元の GPU・ANGLE なので目安）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.env.PORT = process.env.PORT || '6131'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, headless: process.env.HEADED ? false : true, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const p = await ctx.newPage(); await p.goto(`http://localhost:${process.env.PORT}/?stay=1`); await p.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await p.evaluate(() => window.sky.startRun('stage1')); await p.waitForTimeout(3000)
for (const name of ['出発の大ジャンプ', '朽ちた扉を破る', '工場の回廊', '鐘楼の回廊', '嵐の回廊', '三つの鉄球']) {
  await p.evaluate(name => { const G = window.sky, A = G.api, c = G.course, m = c.marks.find(m => m.name === name); const q = c.path[m.i0 + 3]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); A.placeBike(b); G.running = true }, name)
  await p.waitForTimeout(4000)
  console.log(name, 'fps', (await p.evaluate(() => window.sky.fps)).toFixed(0))
}
await br.close(); process.exit(0)
