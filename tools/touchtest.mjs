// スマホのボタン: 押している間だけ効く・指がボタンの外へずれても切れない・2本指で同時に押せる（Chromium のタッチを直接送る）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = '5381'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 40000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(600)
const box = async k => { const r = await page.locator(`.tb[data-k="${k}"]`).boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 } }
const cdp = await ctx.newCDPSession(page)
const T = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: p.id ?? i })) })
const st = () => page.evaluate(() => ({ ...window.sky.touch, inp: window.sky.inp && window.sky.inp.thr }))
const thr = await box('thr'), fwd = await box('fwd')
const out = []
await T('touchStart', [{ ...thr, id: 1 }]); await page.waitForTimeout(150); out.push(['アクセルを押している', (await st()).thr === true])
await T('touchMove', [{ x: thr.x - 90, y: thr.y - 60, id: 1 }]); await page.waitForTimeout(150); out.push(['指をボタンの外へずらしても入ったまま', (await st()).thr === true])
await T('touchStart', [{ x: thr.x - 90, y: thr.y - 60, id: 1 }, { ...fwd, id: 2 }]); await page.waitForTimeout(150); const s2 = await st(); out.push(['別の指で前体重を同時に押せる', s2.thr === true && s2.fwd === true])
await T('touchEnd', [{ x: thr.x - 90, y: thr.y - 60, id: 1 }]); await page.waitForTimeout(150); const s3 = await st(); out.push(['アクセルの指を離すと切れる（前体重はそのまま）', s3.thr === false && s3.fwd === true])
await T('touchEnd', []); await page.waitForTimeout(150); out.push(['全部離すと全部切れる', (await st()).fwd === false])
await T('touchStart', [{ ...thr, id: 3 }]); await T('touchEnd', []); await page.waitForTimeout(150); out.push(['1回押して離したら切れている（切り替え式ではない）', (await st()).thr === false])
for (const [n, ok] of out) console.log(ok ? 'ok  ' : 'FAIL', n)
console.log('errors', errs.length ? errs : 'none')
await br.close(); process.exit(0)
