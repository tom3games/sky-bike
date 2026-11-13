// バイクと乗り手の寄りの絵（横・斜め後ろ）。node tools/closeup.mjs <出力の頭> [lean]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5378'
await import('../server.mjs')
const out = process.argv[2] || 'shots/close'
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ locale: 'ja-JP', viewport: { width: 900, height: 600 }, deviceScaleFactor: 1 })
await muteContext(ctx)
const page = await ctx.newPage(); const errs = []
page.on('pageerror', e => errs.push('pageerror ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`)
await page.waitForFunction('window.__skyReady && window.sky.api.bikeView.ready', null, { timeout: 40000 })
await page.evaluate(() => { const G = window.sky, A = G.api; G.startRun('stage1'); const q = G.course.path[+(new URLSearchParams(location.search).get('pi') || 52)]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); G.bike = b; G.prev = null })
await page.waitForTimeout(500)
for (const [name, lean, ang, up] of [['side', 0, -Math.PI / 2, 0.9], ['back', 0, 2.5, 1.2], ['leanB', -1, -Math.PI / 2, 0.9], ['leanF', 1, -Math.PI / 2, 0.9]]) {
  await page.evaluate(([lean, ang, up]) => {
    const G = window.sky, A = G.api, b = G.bike
    G.state = 'debug'; b.lean = lean
    const cam = A.camera, yaw = b.psi
    cam.position.set(b.p[0] + Math.cos(yaw + ang) * 3.2, b.p[1] + up, b.p[2] - Math.sin(yaw + ang) * 3.2)
    cam.lookAt(b.p[0], b.p[1] + 0.35, b.p[2]); cam.fov = 40; cam.updateProjectionMatrix()
  }, [lean, ang, up])
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${out}_${name}.png` })
}
console.log('errors', errs.length, errs.slice(0, 5))
await br.close(); process.exit(0)
