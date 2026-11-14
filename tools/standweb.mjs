// ゲームの入力で、止まった所から前輪立ち（v32）: スマホのボタン（前体重＋ブレーキ）・PC（D＋右クリック）・キーボード（D＋↓）。出発の平らな所で 3 秒押して角度を見る
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = String(6000 + Math.floor(Math.random() * 2000)); await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium' })
let fails = 0
for (const mode of ['スマホのボタン', 'PC（D＋右クリック）', 'キーボード（D＋↓）']) {
  const phone = mode.startsWith('スマホ')
  const ctx = await br.newContext(phone ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
  const page = await ctx.newPage(); await page.addInitScript(() => { try { localStorage.setItem('sky-tut-done', '1') } catch (e) {} })
  await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
  await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(1500)
  const cdp = phone ? await ctx.newCDPSession(page) : null
  if (phone) { const f = await page.locator('.tb[data-k="fwd"]').boundingBox(), b = await page.locator('.tb[data-k="brk"]').boundingBox(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: f.x + f.width / 2, y: f.y + f.height / 2, id: 1 }, { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 2 }] }) }
  else if (mode.startsWith('PC')) { await page.mouse.move(640, 360); await page.keyboard.down('d'); await page.mouse.down({ button: 'right' }) }
  else { await page.keyboard.down('d'); await page.keyboard.down('ArrowDown') }
  const r = await page.evaluate(async () => { const G = window.sky, x0 = G.bike.p.slice(); let mx = 0; const t0 = performance.now(); while (performance.now() - t0 < 3000) { await new Promise(r => requestAnimationFrame(r)); mx = Math.max(mx, -G.bike.th * 57.3) } return { mx, end: -G.bike.th * 57.3, moved: Math.hypot(G.bike.p[0] - x0[0], G.bike.p[2] - x0[2]), crashed: !!G.bike.crashed } })
  const ok = r.end > 20 && r.end < 50 && r.moved < 0.6 && !r.crashed; if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', `${mode}: 最大 ${r.mx.toFixed(0)} 度・3 秒後 ${r.end.toFixed(0)} 度・動いた ${r.moved.toFixed(2)}m・転倒 ${r.crashed}`)
  await ctx.close()
}
await br.close(); process.exit(fails ? 1 : 0)
