// 実際のゲームの画面で、動く床の上のバイクを見る: 床に載せて何もしない 5 秒。見た目のバイク（描いた物）と見た目の床（描いた物）の
// ずれを、床の向きで測る。画面も撮る（shots/moverview_*.png）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = '6131'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 960, height: 540 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
console.log('muted', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() }); await page.waitForTimeout(800)
const kinds = await page.evaluate(() => { const G = window.sky, out = {}; for (const m of G.api.built.movers) { const s = m.userData.shape; if (s.type !== 'box' || !['lift', 'spin', 'slide'].includes(s.mov.type)) continue; const k = s.mov.type + (s.mov.axis ? (Math.abs(s.mov.axis[1]) > 0.5 ? '_up' : '_flat') : ''); if (!out[k]) out[k] = s.id } return out })
const rows = []
for (const [k, id] of Object.entries(kinds)) for (const pol of ['idle', 'slow', 'brake']) {
  const r = await page.evaluate(async ([id, pol]) => {
    const G = window.sky, A = G.api, s = G.world.shapes[id], mesh = A.built.movers.find(m => m.userData.shape === s)
    const top = [s.c[0] + s.ax[1][0] * s.h[1], s.c[1] + s.ax[1][1] * s.h[1], s.c[2] + s.ax[1][2] * s.h[1]]
    const yaw = Math.atan2(-s.ax[0][2], s.ax[0][0])
    A.placeBike(A.createBike({ p: [top[0], top[1] + 0.8, top[2]], yaw })); G.running = true; G.state = 'play'
    G.testInput = () => { const v = G.bike.speed; return pol === 'idle' ? { thr: 0, brk: 0, lean: 0, steer: 0 } : pol === 'brake' ? { thr: 0, brk: 1, lean: 0.4, steer: 0 } : { thr: v < 0.6 ? 0.4 : 0, brk: v > 0.9 ? 0.3 : 0, lean: 0, steer: 0 } }
    const T = A.three, inv = new T.Matrix4(), wp = new T.Vector3()
    // 見た目のバイクの位置を、見た目の床の座標で
    const loc = () => { mesh.updateMatrixWorld(); inv.copy(mesh.matrixWorld).invert(); A.bikeView.root.getWorldPosition(wp); return wp.clone().applyMatrix4(inv) }
    await new Promise(r => setTimeout(r, 600)); const l0 = loc(); let mx = 0, fell = false
    const t0 = performance.now()
    while (performance.now() - t0 < 4500) { await new Promise(r => requestAnimationFrame(r)); const l = loc(); if (pol === 'slow' && Math.abs(l.x) > s.h[0] - 1.2) break; mx = Math.max(mx, pol === 'slow' ? Math.abs(l.z - l0.z) : Math.hypot(l.x - l0.x, l.z - l0.z)); if (G.bike.p[1] < top[1] - 4) { fell = true; break } }
    return { mx: +mx.toFixed(2), fell, steps: G.steps }
  }, [id, pol])
  rows.push({ 床: k, 操作: pol, 見た目のずれm: r.mx, 落ちた: r.fell })
  if (pol === 'idle') await page.screenshot({ path: `shots/moverview_${k}.png` })
}
await page.evaluate(() => { window.sky.testInput = null })
console.table(rows); console.log('errors', errs.length, errs.slice(0, 3))
await br.close(); process.exit(0)
