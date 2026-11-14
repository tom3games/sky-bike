// ニトロを使い切った瞬間に「プスッ」が1回鳴るか（v25）。最初の旗からアクセル＋ニトロを押し続ける
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PSPORT || '5795'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1&q=low`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(500)
await page.evaluate(() => { const G = window.sky; G.pusus = 0; G.bike.nitro = 0.3 })
await page.keyboard.down('Shift'); await page.waitForTimeout(4000)
const r = await page.evaluate(() => ({ n: window.sky.pusus || 0, left: window.sky.bike.nitro }))
await page.waitForTimeout(2000); await page.keyboard.up('Shift')
const r2 = await page.evaluate(() => window.sky.pusus || 0)
console.log('使い切るまで', JSON.stringify(r), '押し続けた後', r2, 'errors', errs.slice(0, 3))
await br.close(); process.exit(0)
