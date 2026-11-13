// スマホ縦（390x844）で走っている画面（操作ボタンが写る）のスクショ。node tools/phoneshot.mjs <出力.png>
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5386'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: process.env.LOC || 'ja-JP' }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 40000 })
await page.click('.course[data-course="stage1"]'); await page.waitForTimeout(+(process.env.WAIT || 800))
await page.dispatchEvent('.tb[data-k="thr"]', 'pointerdown', { pointerId: 3, isPrimary: true, pointerType: 'touch' }); await page.waitForTimeout(1200)
await page.screenshot({ path: process.argv[2] || 'shots/phone.png' })
console.log('errors', errs.length ? errs : 'none')
await br.close(); process.exit(0)
