// 旗からの復活の検査（ゲームの画面で。v19）: どの旗でも、旗からやり直してアクセルだけ 2 秒押すと、道の進む向きへ前に進み、
// カメラも進む向きを見ているか。押し方は キーボード（↑）・PC の左クリック・スマホのアクセルのボタン の 3 つ。
// やり直す前にマウスでカメラを後ろへ回しておく（PC で回したまま転んだ時と同じ）。 node tools/flagweb.mjs [ONLY=旗の番号,..]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.FWPORT || '5791'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const rows = []
let bad = 0
for (const mode of ['key', 'mouse', 'touch']) {
  const touch = mode === 'touch'
  const ctx = await br.newContext(touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
  await page.goto(`http://localhost:${PORT}/?stay=1&q=low`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
  await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(500)
  const cdp = touch ? await ctx.newCDPSession(page) : null
  const thrBox = touch ? await page.locator('.tb[data-k="thr"]').boundingBox() : null
  const n = await page.evaluate(() => window.sky.course.cps.length)
  const only = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null
  for (let i = 0; i < n; i++) {
    if (only && !only.includes(i)) continue
    if (await page.evaluate(i => window.sky.course.cps[i].finish, i)) continue // ゴールの門からは出し直さない（通るとゴール）
    // カメラを後ろへ回して、旗からやり直す
    const p0 = await page.evaluate(i => { const G = window.sky; G.camOff.yaw = 2.6; G.camOff.idle = 0; G.R.rest = i; G.R.cp = i; G.api.retryCp(true); return G.bike.p.slice() }, i)
    await page.waitForTimeout(150)
    if (mode === 'key') await page.keyboard.down('ArrowUp')
    if (mode === 'mouse') { await page.mouse.move(640, 300); await page.mouse.down({ button: 'left' }) }
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: thrBox.x + thrBox.width / 2, y: thrBox.y + thrBox.height / 2, id: 1 }] })
    await page.waitForTimeout(2000)
    const r = await page.evaluate(([i, p0]) => { const G = window.sky, b = G.bike, q = G.course.cps[i], f = [Math.cos(q.yaw), -Math.sin(q.yaw)]
      const cf = [G.camTgt.x - G.camPos.x, G.camTgt.z - G.camPos.z], cl = Math.hypot(...cf)
      return { fwd: (b.p[0] - p0[0]) * f[0] + (b.p[2] - p0[2]) * f[1], cam: (cf[0] * f[0] + cf[1] * f[1]) / cl, inp: G.inp, st: G.state } }, [i, p0])
    if (mode === 'key') await page.keyboard.up('ArrowUp')
    if (mode === 'mouse') await page.mouse.up({ button: 'left' })
    if (touch) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(100)
    const ok = r.fwd > 2 && r.cam > 0.3
    if (!ok) bad++
    if (!ok || process.env.LIST) rows.push({ 押し方: mode, 旗: i, '2秒で前へm': +r.fwd.toFixed(1), 'カメラの向き(1=進む向き)': +r.cam.toFixed(2), 入力: JSON.stringify(r.inp) })
  }
  if (errs.length) console.log(mode, 'errors', errs.slice(0, 3))
  await ctx.close()
}
console.table(rows)
console.log('前へ進まない・カメラが後ろ向き', bad)
await br.close(); process.exit(0)
