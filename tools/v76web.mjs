// v76 を実画面で確かめる（無音）: 同じ入力の指紋（node・Chromium・WebKit）／本物の入力（キー ↑＋↓・マウス 左＋右・スマホの境目の帯）でローラーが回るか／ボタンの位置が前と同じか
// node tools/v76web.mjs   （ENG=chromium だけ等。SRC=0 で dist を読む）
import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { World, createBike, stepBike, hashBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || String(6900 + Math.floor(Math.random() * 90))
await import('../server.mjs')
const SRC = process.env.SRC === '0' ? '' : '&src=1'
// 同じ入力で走らせる筋書き（石を押す → ボタン → 門／ローラーの上で同時押し → 離す → 進む）。指紋は バイクの状態 と 石・門・格子の数字
const SCN = (A, c) => {
  const V = c.v76, out = []
  const at = (w, G, s) => { const f = G.kind === 'A' ? G.ax : G.f, b = A.createBike({ p: [G.a[0] + f[0] * s, G.a[1] + 0.79, G.a[2] + f[2] * s], yaw: G.yaw }); for (let k = 0; k < 20; k++) A.stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); return b }
  { const w = new A.World(c.shapes); w.winds = c.winds || []; const b = at(w, V.A, 0.5)
    for (let k = 0; k < 420; k++) { w.tick(); A.stepBike(w, b, { thr: 1, brk: 0, lean: k > 200 && k < 230 ? -1 : 0, steer: 0 }) }
    out.push(A.hashBike(b), V.A.x, V.A.h, V.A.k) }
  { const w = new A.World(c.shapes); w.winds = c.winds || []; const b = at(w, V.A, V.A.sPlate)
    for (let k = 0; k < 300; k++) { w.tick(); A.stepBike(w, b, { thr: k > 150 ? 1 : 0, brk: 0, lean: 0, steer: 0, nitro: k > 150 ? 1 : 0 }) }
    out.push(A.hashBike(b), V.A.h, b.crashed ? b.crashed.why : '-') }
  { const w = new A.World(c.shapes); w.winds = c.winds || []; const b = at(w, V.B, V.B.sRoll + 0.7)
    for (let k = 0; k < 300; k++) { w.tick(); A.stepBike(w, b, k < 130 ? { thr: 1, brk: 1, lean: 0, steer: 0 } : k < 160 ? { thr: 0, brk: 0, lean: 0, steer: 0 } : { thr: 1, brk: 0, lean: 0, steer: 0 }) }
    out.push(A.hashBike(b), V.B.prog, V.B.h, b.crashed ? b.crashed.why : '-') }
  return out.join('|')
}
const NODE = SCN({ World, createBike, stepBike, hashBike }, COURSES.lab76()) // 第1面は道の作りに Math.sin・atan2 を使っていて、道の座標そのものが node と画面で 1e-12 ずれる（v75 から）。指紋はまっすぐな試し用コース lab76 で比べる
const out = [], ENG = (process.env.ENG || 'chromium,webkit').split(',')
const ok = (n, c, info) => out.push([c ? 'ok  ' : 'NG  ', n, info ?? ''])
for (const name of ENG) {
  const br = name === 'webkit' ? await webkit.launch() : await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
  // ---- PC（1280x720）
  { const ctx = await br.newContext({ viewport: { width: 1280, height: 720 }, locale: 'ja-JP' }); await muteContext(ctx)
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    await page.goto(`http://localhost:${PORT}/?stay=1${SRC}`); await page.waitForFunction('window.__skyReady', null, { timeout: 120000 })
    const h = await page.evaluate(async src => { const P = await import('/js/physics.js?v=76'), C = await import('/js/course.js?v=76'); return new Function('return ' + src)()(P, C.COURSES.lab76()) }, SCN.toString()) // 画面の中で同じ試し用コースを組んで走らせる（ゲームには読み込まない）
    ok(`${name}: 同じ入力なら node と同じ結果（石・門・ローラーの指紋）`, h === NODE, h === NODE ? h.slice(0, 60) + '…' : `page ${h} / node ${NODE}`)
    await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.story.t0 = null }); await page.waitForTimeout(700)
    const place = (K, key) => page.evaluate(([K, key]) => { const G = window.sky, A = G.api, V = G.course.v76[K], f = V.kind === 'A' ? V.ax : V.f, s = { roll: V.sRoll + 0.7, flag: 0.5 }[key]; G.world.setTime(0); const b = A.createBike({ p: [V.a[0] + f[0] * s, V.a[1] + 0.8, V.a[2] + f[2] * s], yaw: V.yaw }); A.placeBike(b); G.state = 'play'; G.running = true; G.spawnHold = false }, [K, key])
    const stB = () => page.evaluate(() => { const G = window.sky, V = G.course.v76.B, b = G.bike; return { prog: +V.prog.toFixed(2), burn: !!b.burn, v: +b.speed.toFixed(1), moved: +((b.p[0] - V.a[0]) * V.f[0] + (b.p[2] - V.a[2]) * V.f[2] - 0.7 - V.sRoll).toFixed(2), thr: G.inp.thr, brk: G.inp.brk } })
    await place('B', 'roll'); await page.waitForTimeout(500); await page.keyboard.down('ArrowUp'); await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1500); let s1 = await stB(); await page.waitForTimeout(2600); let s2 = await stB(); await page.keyboard.up('ArrowDown'); await page.keyboard.up('ArrowUp')
    ok(`${name}: キーボード ↑＋↓ でローラーが回り、格子が上がり切る`, s1.burn && s1.prog > 0.2 && s2.prog === 1 && Math.abs(s2.moved) < 0.3, JSON.stringify([s1, s2]))
    if (name === 'chromium') {
      await place('B', 'roll'); await page.waitForTimeout(500); await page.mouse.move(640, 300); await page.mouse.down({ button: 'left' }); await page.mouse.down({ button: 'right' }); await page.waitForTimeout(1500); s1 = await stB(); await page.waitForTimeout(2600); s2 = await stB(); await page.mouse.up({ button: 'right' }); await page.mouse.up({ button: 'left' })
      ok(`${name}: マウス 左クリック＋右クリック でローラーが回り、格子が上がり切る`, s1.burn && s1.prog > 0.2 && s2.prog === 1, JSON.stringify([s1, s2])) }
    await place('B', 'roll'); await page.waitForTimeout(500); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700); s1 = await stB(); await page.keyboard.up('ArrowUp')
    ok(`${name}: ↑ だけでは回らない（走り出す）`, s1.prog === 0 && !s1.burn && s1.moved > 0.5, JSON.stringify(s1))
    await place('A', 'flag'); await page.waitForTimeout(500); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(5200); const sa = await page.evaluate(() => { const V = window.sky.course.v76.A; return { x: +V.x.toFixed(2), h: +V.h.toFixed(2), k: V.k, crash: window.sky.bike.crashed ? window.sky.bike.crashed.why : '' } }); await page.keyboard.up('ArrowUp')
    ok(`${name}: 旗から ↑ を押し続けると石が溝の端まで進み、ボタンが沈んで門が上がり切る`, sa.x >= 4.99 && sa.k === 1 && sa.h > 2 && !sa.crash, JSON.stringify(sa))
    ok(`${name}: PC の画面でエラーが出ない`, errs.length === 0, errs.slice(0, 3).join(' | '))
    await ctx.close() }
  // ---- スマホ（縦 390x844・タッチ）
  { const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP', hasTouch: true, isMobile: name !== 'webkit' ? true : undefined }); await muteContext(ctx)
    const page = await ctx.newPage(), errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
    await page.goto(`http://localhost:${PORT}/?stay=1${SRC}`); await page.waitForFunction('window.__skyReady', null, { timeout: 120000 })
    await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.story.t0 = null }); await page.waitForTimeout(700)
    await page.evaluate(() => { const G = window.sky, A = G.api, V = G.course.v76.B, s = V.sRoll + 0.7; G.world.setTime(0); const b = A.createBike({ p: [V.a[0] + V.f[0] * s, V.a[1] + 0.8, V.a[2] + V.f[2] * s], yaw: V.yaw }); A.placeBike(b); G.state = 'play'; G.running = true; G.spawnHold = false; document.getElementById('touch').hidden = false }); await page.waitForTimeout(500)
    const bb = async k => { const r = await page.locator(`.tb[data-k="${k}"]`).boundingBox(); return r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } }
    const B = { brk: await bb('brk'), thr: await bb('thr'), both: await bb('both'), nit: await bb('nit') }
    ok(`${name}: スマホ縦: ブレーキとアクセルの位置と大きさは前と同じ（ブレーキ 60px・アクセル 84px・間 12px）`, B.brk && B.thr && B.brk.w === 60 && B.thr.w === 84 && B.thr.x - (B.brk.x + B.brk.w) === 12, JSON.stringify(B))
    ok(`${name}: 境目の帯が 2 つのボタンの両方に重なる`, B.both && B.both.x <= B.brk.x + B.brk.w - 5 && B.both.x + B.both.w >= B.thr.x + 5 && B.both.y >= B.brk.y && B.both.y + B.both.h <= B.brk.y + B.brk.h, JSON.stringify(B.both))
    const stT = () => page.evaluate(() => { const G = window.sky, V = G.course.v76.B, b = G.bike; return { thr: G.touch.thr, brk: G.touch.brk, burn: !!b.burn, prog: +V.prog.toFixed(2), inp: [G.inp.thr, G.inp.brk] } })
    const c = k => ({ x: B[k].x + B[k].w / 2, y: B[k].y + B[k].h / 2 })
    const ev = (type, k, id = 1) => page.evaluate(([type, x, y, id, k]) => { const el = document.querySelector(`.tb[data-k="${k}"]`); el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, cancelable: true, isPrimary: id === 1 })) }, [type, c(k).x, c(k).y, id, k])
    // 帯を 1 本の指で押す（その位置にある要素が帯であること＝本物の指でも帯に届く）
    const hitEl = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); const t = el && el.closest('.tb'); return t ? t.dataset.k : (el && el.id) }, [c('both').x, c('both').y])
    ok(`${name}: 境目の真ん中に触ると帯に当たる`, hitEl === 'both', hitEl)
    if (name === 'chromium') { const cdp = await ctx.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c('both').x, y: c('both').y, id: 1 }] }); await page.waitForTimeout(1200); const s1 = await stT(); await page.waitForTimeout(2800); const s2 = await stT(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200); const s3 = await stT()
      ok(`${name}: 帯を親指 1 本で押す（本物のタッチ）→ ブレーキとアクセルが両方入り、後輪が空転して格子が上がり切る`, s1.thr && s1.brk && s1.burn && s2.prog === 1 && !s3.thr && !s3.brk, JSON.stringify([s1, s2, s3]))
      await page.evaluate(() => window.sky.world.setTime(0)); await page.evaluate(() => { const G = window.sky, A = G.api, V = G.course.v76.B, s = V.sRoll + 0.7; const b = A.createBike({ p: [V.a[0] + V.f[0] * s, V.a[1] + 0.8, V.a[2] + V.f[2] * s], yaw: V.yaw }); A.placeBike(b); G.running = true; G.spawnHold = false }); await page.waitForTimeout(400)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c('brk').x - 8, y: c('brk').y, id: 1 }, { x: c('thr').x + 10, y: c('thr').y, id: 2 }] }); await page.waitForTimeout(1500); const t1 = await stT(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(200); const t2 = await stT()
      ok(`${name}: 2 本の指でブレーキとアクセルを別々に押しても同じ（空転して回る）`, t1.thr && t1.brk && t1.burn && t1.prog > 0.2 && !t2.thr && !t2.brk, JSON.stringify([t1, t2]))
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c('thr').x + 10, y: c('thr').y, id: 3 }] }); await page.waitForTimeout(300); const u1 = await stT(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150)
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c('brk').x - 8, y: c('brk').y, id: 4 }] }); await page.waitForTimeout(300); const u2 = await stT(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(150); const u3 = await stT()
      ok(`${name}: アクセルだけ・ブレーキだけのボタンは今まで通り（片方だけ入り、離すと切れる）`, u1.thr && !u1.brk && u2.brk && !u2.thr && !u3.thr && !u3.brk, JSON.stringify([u1, u2, u3])) }
    else { await ev('pointerdown', 'both'); await page.waitForTimeout(1200); const s1 = await stT(); await page.waitForTimeout(2800); const s2 = await stT(); await ev('pointerup', 'both'); await page.waitForTimeout(200); const s3 = await stT()
      ok(`${name}: 帯を押す（pointer の出来事）→ 両方入り、空転して格子が上がり切る`, s1.thr && s1.brk && s1.burn && s2.prog === 1 && !s3.thr && !s3.brk, JSON.stringify([s1, s2, s3])) }
    await page.screenshot({ path: (process.env.OUT || 'shots') + '/v76_touch_' + name + '.jpg', type: 'jpeg', quality: 80 })
    ok(`${name}: スマホの画面でエラーが出ない・音が出ていない`, errs.length === 0 && await page.evaluate(() => !window.__muteOk || window.__muteOk()), errs.slice(0, 3).join(' | '))
    await ctx.close() }
  await br.close()
}
for (const [a, b, c] of out) console.log(a, b, ' ', String(c).slice(0, 420))
const ng = out.filter(o => o[0].startsWith('NG')).length; console.log('\nNG', ng, '/', out.length); process.exit(ng ? 1 : 0)
