// 風車の羽根と帆が、草原の島の見た目（緑・崖の面）に刺さっていないかを、羽根 1 回転ぶん数える。あわせて上から・斜めから 1 回転のコマを撮る。node tools/millslot.mjs <出力フォルダ>（無音）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || String(6900 + Math.floor(Math.random() * 90))
await import('../server.mjs')
const OUT = (process.argv[2] || 'shots/slot').replace(/\/$/, '') + '/'
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 }, locale: 'ja-JP' }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); window.sky.story.t0 = null }); await page.waitForTimeout(600)
await page.evaluate(() => { const G = window.sky, A = G.api, P = G.course.path, i = P.findIndex(q => q.kind === 'blade') - 6, q = P[i]; A.placeBike(A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw })); G.state = 'play' }); await page.waitForTimeout(3200)
const res = await page.evaluate(() => {
  const G = window.sky, T = G.api.three, I = G.v37.isl, n = G.course.notes.find(n => n.kind === 'windmill'), w = n.blades[0].mov.w, per = 2 * Math.PI / Math.abs(w), e = 0.6
  const solid = p => { const dx = p.x - I.ctr[0], dz = p.z - I.ctr[2], al = dx * I.f[0] + dz * I.f[2] + I.ctrAl, la = dx * I.r[0] + dz * I.r[2]; if (p.y < I.y0 || p.y > I.y1 || al < I.a0 || al > I.a1 || Math.abs(la) > I.W / 2) return false; if (I.pit && al > I.pit[0] && al < I.pit[1]) return false; if (I.slot && al > I.slot.s0 && al < I.slot.s1 && la > I.slot.l0 && la < I.slot.l1) return false; return true }
  const sails = []; G.v37.group.traverse(o => { if (o.isMesh && o.geometry && o.geometry.parameters && o.geometry.parameters.width === 9.5) sails.push(o) })
  let hit = 0, pts = 0, below = 0; const v = new T.Vector3(), t0 = G.world.time
  for (let k = 0; k < 240; k++) { const t = t0 + per * k / 240; G.world.setTime(t); G.v37.update(0, t, G.api.camera.position, G.world, 'meadow'); G.v37.group.updateMatrixWorld(true)
    for (const s of n.blades) { const sh = G.world.shapes[s.id]; for (let a = -1; a <= 1; a += 0.1) for (const b of [-1, 1]) for (const c of [-1, 1]) { v.set(sh.c[0] + sh.ax[0][0] * sh.h[0] * a + sh.ax[1][0] * sh.h[1] * b + sh.ax[2][0] * sh.h[2] * c, sh.c[1] + sh.ax[0][1] * sh.h[0] * a + sh.ax[1][1] * sh.h[1] * b + sh.ax[2][1] * sh.h[2] * c, sh.c[2] + sh.ax[0][2] * sh.h[0] * a + sh.ax[1][2] * sh.h[1] * b + sh.ax[2][2] * sh.h[2] * c); pts++; if (v.y < I.y1) below++; if (solid(v)) hit++ } }
    for (const m of sails) { const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); pts++; if (v.y < I.y1) below++; if (solid(v)) hit++ } } }
  G.world.setTime(t0)
  return { 調べた点: pts, 地面より下に来た点: below, 島の見た目に刺さった点: hit, 帆: sails.length, slot: I.slot, 周期: +per.toFixed(1) }
})
console.log(JSON.stringify(res))
// 斜め上から 1 回転を 8 コマ（羽根が緑から出てこないことを目で見る）
const cam = await page.evaluate(() => { const G = window.sky, I = G.v37.isl, n = G.course.notes.find(n => n.kind === 'windmill'); return { hub: n.hub, f: I.f, r: I.r, per: 2 * Math.PI / Math.abs(n.blades[0].mov.w) } })
for (const [nm, off] of [['a', [-16, 13, 12]], ['b', [-9, 20, -14]]]) for (let k = 0; k < 4; k++) {
  await page.evaluate(([cam, off, k]) => { const G = window.sky, cm = G.api.camera; G.state = 'debug'; G.world.setTime(G.world.time + cam.per / 16 * (k ? 1 : 0)); G.v37.update(0, G.world.time, cm.position, G.world, 'meadow'); cm.position.set(cam.hub[0] + cam.f[0] * off[0] + cam.r[0] * off[2], cam.hub[1] + off[1], cam.hub[2] + cam.f[2] * off[0] + cam.r[2] * off[2]); cm.lookAt(cam.hub[0], cam.hub[1] - 2, cam.hub[2]) }, [cam, off, k])
  await page.waitForTimeout(350); await page.screenshot({ path: OUT + nm + k + '.jpg', type: 'jpeg', quality: 72 }) }
console.log('errors', errs.length, errs.slice(0, 4), 'mute', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await br.close(); process.exit(0)
