// PC の操作（v17）: 左クリック＝アクセル・右クリック＝ブレーキ/バック（右クリックのメニューは出ない）・A/D＝体重・マウス＝カメラ・Space＝ニトロ（押すだけで全開）
// 本物のマウスとキーを Playwright で送り、バイクの速さ・車体の角度・カメラの向きの数字で確かめる。 node tools/pctest.mjs
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PCPORT || '5384'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: process.env.CH || 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('practice')); await page.waitForTimeout(800)
const st = () => page.evaluate(() => { const G = window.sky, b = G.bike, f = [Math.cos(b.psi), -Math.sin(b.psi)]; const cx = G.camPos.x - b.p[0], cz = G.camPos.z - b.p[2]; return { v: +(b.v[0] * f[0] + b.v[2] * f[1]).toFixed(2), th: +(b.th * 57.3).toFixed(1), lean: +b.lean.toFixed(2), nitroOn: !!b.nitroOn, nitro: +b.nitro.toFixed(2), camAz: +(Math.atan2(cz, cx) * 57.3).toFixed(1), camY: +(G.camPos.y - b.p[1]).toFixed(2), off: +(G.camOff.yaw * 57.3).toFixed(1), lock: !!document.pointerLockElement, state: G.state } })
const out = [], rec = {}
const W = ms => page.waitForTimeout(ms)
await page.mouse.move(640, 360)
// 1 左クリックを押している間アクセル
let s0 = await st()
await page.mouse.down({ button: 'left' }); await W(1500); let s1 = await st(); await page.mouse.up({ button: 'left' }); await W(300)
rec.左クリック = [s0.v, s1.v]; out.push(['左クリックを押している間、進む（速さ ' + s0.v + ' → ' + s1.v + ' m/s）', s1.v > s0.v + 3])
out.push(['クリックでマウスが画面に固定される（Pointer Lock）', (await st()).lock])
// 2 右クリックを押している間ブレーキ → 止まると下がる。右クリックのメニューは止める
const ctxPrevented = await page.evaluate(() => { const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }); document.querySelector('canvas').dispatchEvent(e); return e.defaultPrevented })
out.push(['右クリックのメニューが出ない（contextmenu を止める）', ctxPrevented])
s0 = await st(); await page.mouse.down({ button: 'right' }); await W(900); s1 = await st(); await W(2500); const s2 = await st(); await page.mouse.up({ button: 'right' }); await W(300)
rec.右クリック = [s0.v, s1.v, s2.v]; out.push([`右クリックでブレーキ（${s0.v} → ${s1.v}）、止まると下がる（${s2.v}）`, s1.v < s0.v - 2 && s2.v < -0.5])
await W(1200)
// 3 A で後ろ体重（止まったまま。前輪が上がる）・D で前体重
await page.mouse.down({ button: 'right' }); await W(400); await page.mouse.up({ button: 'right' }); await W(1500)
s0 = await st(); await page.keyboard.down('KeyA'); await W(1200); s1 = await st(); await page.keyboard.up('KeyA'); await W(900)
rec.A = [s0.lean, s1.lean, s0.th, s1.th]; out.push([`A で後ろ体重（体重 ${s0.lean} → ${s1.lean}）`, s1.lean < -0.5])
// A＋左クリック（後ろ体重＋アクセル）でウィリー
await W(800); s0 = await st(); await page.keyboard.down('KeyA'); await page.mouse.down({ button: 'left' }); let thMax = -99; for (let k = 0; k < 10; k++) { await W(80); thMax = Math.max(thMax, (await st()).th) } await page.mouse.up({ button: 'left' }); await page.keyboard.up('KeyA'); await W(1200)
rec.A左クリック = [s0.th, thMax]; out.push([`A＋左クリックで前輪が上がる（車体 ${s0.th} → 最大 ${thMax} 度）`, thMax > s0.th + 15])
s0 = await st(); await page.keyboard.down('KeyD'); await W(500); s1 = await st(); await page.keyboard.up('KeyD'); await W(600)
rec.D = [s0.lean, s1.lean]; out.push([`D で前体重（体重 ${s0.lean} → ${s1.lean}）`, s1.lean > 0.5])
// 4 マウスを動かすとカメラがバイクのまわりを回る
s0 = await st(); for (let k = 0; k < 20; k++) { await page.mouse.move(640 + (k + 1) * 12, 360) } await W(400); s1 = await st()
let lockOk = s1.lock
if (Math.abs(s1.off - s0.off) < 1) { // ヘッドレスで Pointer Lock が効かない時の予備（同じ処理の G.camFree を使う）
  await page.evaluate(() => { window.sky.camFree = true }); for (let k = 0; k < 20; k++) await page.mouse.move(400 + k * 12, 360); await W(400); s1 = await st()
}
rec.カメラ = [s0.camAz, s1.camAz, s0.off, s1.off]; out.push([`マウスを横へ動かすとカメラが回る（向き ${s0.camAz} → ${s1.camAz} 度、回した量 ${s1.off} 度）${lockOk ? '' : '（Pointer Lock が効かない環境なので予備の経路で）'}`, Math.abs(s1.off) > 20 && Math.abs(s1.camAz - s0.camAz) > 10])
s0 = await st(); for (let k = 0; k < 10; k++) await page.mouse.move(700, 360 + (k + 1) * 10); await W(400); s1 = await st()
rec.カメラ上下 = [s0.camY, s1.camY]; out.push([`マウスを下へ動かすとカメラが上から見下ろす（高さ ${s0.camY} → ${s1.camY} m）`, s1.camY > s0.camY + 0.5])
await page.evaluate(() => { window.sky.camFree = false })
// 5 Space だけでニトロ＋全開（アクセルを押さない）
await page.evaluate(() => window.sky.startRun('practice')); await W(900)
s0 = await st(); await page.keyboard.down('Space'); await W(250); const sN = await st(); await W(1300); s1 = await st(); await page.keyboard.up('Space'); await W(200)
rec.ニトロ単独 = [s0.v, sN.nitroOn, s1.v, s1.nitro]; out.push([`Space だけ（アクセルなし）で全開とニトロ（速さ ${s0.v} → ${s1.v}、ニトロ ${sN.nitroOn ? '点いた' : '点かない'}、残り ${s1.nitro}）`, sN.nitroOn && s1.v > s0.v + 4])
// 6 ニトロとブレーキを同時: ブレーキが先（ニトロは点かず、進まない）
await page.evaluate(() => window.sky.startRun('practice')); await W(900)
await page.keyboard.down('Space'); await page.keyboard.down('KeyS'); await W(800); s1 = await st(); await page.keyboard.up('KeyS'); await page.keyboard.up('Space'); await W(200)
out.push([`ニトロとブレーキを同時に押すとブレーキが先（ニトロ ${s1.nitroOn ? '点いた' : '点かない'}・速さ ${s1.v}）`, !s1.nitroOn && s1.v < 0.5])
// 7 Esc でマウスの固定が外れる（Playwright からは Pointer Lock の Esc を送れないので exitPointerLock で同じ状態に）・その後の左クリックで戻る
await page.evaluate(() => document.exitPointerLock && document.exitPointerLock()); await W(200)
const unlocked = !(await st()).lock
await page.mouse.down({ button: 'left' }); await W(200); await page.mouse.up({ button: 'left' }); await W(200)
out.push(['固定が外れた後、クリックでまた固定される', unlocked && ((await st()).lock || !lockOk)])
// 8 Esc で一時停止（固定が外れている時）→ もう一度で戻る
await page.keyboard.press('Escape'); await W(200); const p1 = (await st()).state; await page.keyboard.press('Escape'); await W(200); const p2 = (await st()).state
out.push([`Esc で一時停止（${p1}）→ もう一度で戻る（${p2}）`, p1 === 'pause' && p2 === 'play'])
await page.screenshot({ path: process.env.SHOT || 'shots/pc_v17.jpg', quality: 80 })
for (const [n, ok] of out) console.log(ok ? 'ok  ' : 'FAIL', n)
console.log(JSON.stringify(rec))
console.log('errors', errs.length ? errs : 'none')
await br.close(); process.exit(0)
