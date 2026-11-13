import './mute-auto.mjs'
// og.png（1200x630）: タイトルと同じ構図（右に塔と松明、左に霧の谷と浮いた廃墟）＋ 題名
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
process.env.PORT = process.env.VPORT || '5394'
await import('./server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'ja-JP' })
await muteContext(ctx)
const p = await ctx.newPage()
await p.goto(`http://localhost:${process.env.PORT}/?stay=1`)
await p.waitForFunction(() => window.__skyReady && window.sky.api.bikeView.ready, null, { timeout: 40000 })
await p.waitForTimeout(5500)
await p.evaluate(() => { for (const s of ['.t-menu', '.t-foot']) document.querySelector(s).style.visibility = 'hidden' })
await p.waitForTimeout(300)
await p.screenshot({ path: 'og.png' })
await br.close(); process.exit(0)
