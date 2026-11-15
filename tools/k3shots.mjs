// v60 跳ね板の三段登りを実画面で撮る。旗から人の速さの bot で登る回（成功）と、ウィリーせずに水平で板に乗る回（失敗）。
// node tools/k3shots.mjs [幅x高さ]  → shots/k3_<幅x高さ>_*.jpg
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { mkdirSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || '8741'
await import('../server.mjs')
const [W, H] = (process.argv[2] || '1280x720').split('x').map(Number), mobile = W < 600
mkdirSync('shots', { recursive: true })
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
const v = await page.evaluate(() => ([...document.scripts].map(s => s.src).find(s => /game\.js/.test(s)) || '').split('v=')[1] || '59')
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() }); await page.waitForTimeout(800)
const tag = `${W}x${H}`
async function ride(name, level, shots) {
  await page.evaluate(async ([v, level]) => {
    const G = window.sky, A = G.api, B = await import('./js/bot.js?v=' + v)
    globalThis.__k3level = level ? 1 : 0
    const P = G.course.path, m = G.course.marks.find(x => x.name === '跳ね板の三段登り'), q = P[m.i0]
    const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })
    for (let s = 0; s < 30; s++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    b.v = [Math.cos(q.yaw) * 3, 0, -Math.sin(q.yaw) * 3]
    A.placeBike(b)
    const bot = B.createBot(G.course, { skill: 'good', react: 12 }); bot.world = G.world; B.resetBot(bot, G.bike)
    G.testInput = () => B.botInput(bot, G.bike)
    G.hold = true; G.running = true; G.acc = 0; G.__k3 = { kicks: 0, air: false, landN: 0 }
  }, [v, level])
  const taken = new Set()
  for (let f = 0; f < 60 * 28; f++) {
    const st = await page.evaluate(() => { const G = window.sky, A = G.api; A.fixedStep(); G.acc = 0; const b = G.bike, K = G.__k3; const air = !b.g[0] && !b.g[1]; if (b._k3 && b._k3.t !== K.lastT) { K.lastT = b._k3.t; K.kicks++; K.f0 = 0 } if (K.f0 != null) K.f0++; return { kicks: K.kicks, f0: K.f0, air, th: b.th * 57.3, crashed: !!b.crashed, y: b.p[1] } })
    await page.evaluate(() => new Promise(r => requestAnimationFrame(r)))
    for (const s of shots) { const key = s.name; if (taken.has(key)) continue; if (s.when(st)) { taken.add(key); await page.screenshot({ path: `shots/k3_${tag}_${name}_${key}.jpg`, quality: 80 }) } }
    if (taken.size === shots.length) break
  }
  return [...taken]
}
const good = await ride('ok', false, [
  { name: '1approach', when: s => s.kicks === 0 && s.th > 25 },
  { name: '2air1', when: s => s.kicks === 1 && s.f0 === 30 },
  { name: '3air2', when: s => s.kicks === 2 && s.f0 === 30 },
  { name: '4air3', when: s => s.kicks === 3 && s.f0 === 34 },
  { name: '5top', when: s => s.kicks === 3 && s.f0 === 150 },
])
const bad = await ride('bad', true, [
  { name: '1level', when: s => s.kicks === 1 && s.f0 === 12 },
  { name: '2spin', when: s => s.kicks === 1 && s.f0 === 36 },
  { name: '3after', when: s => s.kicks === 1 && s.f0 === 75 },
])
console.log(tag, 'ok', good, 'bad', bad, 'errors', errs.length, errs.slice(0, 5), 'mute', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await br.close(); process.exit(0)
