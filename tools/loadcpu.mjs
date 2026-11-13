// CPU を 4 倍遅くした時の「準備完了まで」の秒数。LIVE=1 で公開URLを 3Mbps（遅延 40ms）で読む。ふだんは手元（通信は速い。CPU の重さだけを見る）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.env.PORT = process.env.PORT || '5397'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
for (let k = 0; k < 2; k++) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await muteContext(ctx)
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  if (process.env.LIVE) { await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 40, downloadThroughput: 3e6 / 8, uploadThroughput: 1e6 / 8 }) }
  const t0 = Date.now(); await p.goto(process.env.LIVE ? 'https://tom3games.github.io/sky-bike/?stay=1&t=' + Date.now() : `http://localhost:${process.env.PORT}/?stay=1`, { timeout: 90000 }); await p.waitForFunction('window.__skyReady', null, { timeout: 90000 })
  const marks = await p.evaluate(() => window.__loadMarks || null)
  console.log('CPU 4倍遅: 準備完了', ((Date.now() - t0) / 1000).toFixed(1), '秒', marks ? JSON.stringify(marks) : '')
  await ctx.close()
}
await br.close(); process.exit(0)
