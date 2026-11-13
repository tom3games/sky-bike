// 手元で、CPU を 4 倍遅くした時の「準備完了まで」の秒数（通信は手元なので速い。CPU の重さだけを見る）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.env.PORT = process.env.PORT || '5397'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
for (let k = 0; k < 2; k++) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await muteContext(ctx)
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const t0 = Date.now(); await p.goto(`http://localhost:${process.env.PORT}/?stay=1`); await p.waitForFunction('window.__skyReady', null, { timeout: 90000 })
  const marks = await p.evaluate(() => window.__loadMarks || null)
  console.log('CPU 4倍遅: 準備完了', ((Date.now() - t0) / 1000).toFixed(1), '秒', marks ? JSON.stringify(marks) : '')
  await ctx.close()
}
await br.close(); process.exit(0)
