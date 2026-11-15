// 水の見た目（模様の動く向き）と、物理で押す向きが合っているかを実画面で比べる。 node tools/waterdir.mjs
//   模様の動き: 2 つの時刻の map の行列から、同じ模様の点がメッシュの上でどちらへ動いたかを出す。cos が 1 に近ければ同じ向き、-1 なら逆、0 なら直角
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || '6233'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 640, height: 360 } }); await muteContext(ctx)
const page = await ctx.newPage()
await page.goto(`http://localhost:${PORT}/?stay=1&bot=good${process.env.SRC ? '&src=1' : ''}`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); window.sky.running = true })
const snap = () => page.evaluate(() => { const out = []; window.sky.api.scene.traverse(o => { if (o.isMesh && o.name === 'water' && o.material.map && o.geometry.index && o.visible) { const m = o.material.map; m.updateMatrix(); out.push({ id: o.id, M: m.matrix.elements.slice() }) } }); return out })
const a = await snap(); await page.waitForTimeout(700); const b = await snap()
const rows = await page.evaluate(([a, b]) => {
  const G = window.sky, T = G.api.three, res = []
  const inv3 = e => new T.Matrix3().fromArray(e).invert()
  G.api.scene.traverse(o => { const A = a.find(x => x.id === o.id), B = b.find(x => x.id === o.id); if (!A || !B) return
    o.updateMatrixWorld(true); const g = o.geometry, P = g.attributes.position, U = g.attributes.uv, ix = g.index, n = Math.floor(ix.count / 6) * 3 // 真ん中あたりの三角
    const [i0, i1, i2] = [ix.getX(n), ix.getX(n + 1), ix.getX(n + 2)], wp = i => new T.Vector3().fromBufferAttribute(P, i).applyMatrix4(o.matrixWorld), uv = i => new T.Vector2().fromBufferAttribute(U, i)
    const p0 = wp(i0), e1 = wp(i1).sub(p0), e2 = wp(i2).sub(p0), u0 = uv(i0), d1 = uv(i1).sub(u0), d2 = uv(i2).sub(u0), det = d1.x * d2.y - d1.y * d2.x
    // 同じ模様の点: Ma*uv0 = Mb*uv1 → uv1 = Mb^-1 Ma uv0
    const t = new T.Vector2(u0.x, u0.y).applyMatrix3(new T.Matrix3().fromArray(A.M)), u1 = t.applyMatrix3(inv3(B.M)), du = u1.x - u0.x, dv = u1.y - u0.y
    const s1 = (du * d2.y - dv * d2.x) / det, s2 = (dv * d1.x - du * d1.y) / det, mv = e1.clone().multiplyScalar(s1).add(e2.clone().multiplyScalar(s2))
    // 物理の押す向き: この点の真下の面
    let best = null, bd = 1e9; for (const sh of G.world.shapes) { if (!(sh.flow || sh.flowR || sh.flowT)) continue; const d = G.api.closest(sh, p0.x, p0.y, p0.z).d; if (d < bd) { bd = d; best = sh } }
    if (!best || bd > 1 || Math.abs(mv.y) > Math.hypot(mv.x, mv.z)) return // 滝・噴き出す水（縦の幕）は比べない
    let u; if (best.flow) u = best.flow; else { const dx = p0.x - best.cx, dz = p0.z - best.cz, L = Math.hypot(dx, dz) || 1; u = best.flowR ? [dx / L * best.flowR, 0, dz / L * best.flowR] : [dz / L * best.flowT, 0, -dx / L * best.flowT] }
    const ml = Math.hypot(mv.x, mv.z), ul = Math.hypot(u[0], u[2]); let pi = 0, pd = 1e9; G.course.path.forEach((q, k) => { if (!q.p) return; const d = Math.hypot(q.p[0] - p0.x, q.p[2] - p0.z) + Math.abs(q.p[1] - p0.y) * 2; if (d < pd) { pd = d; pi = k } })
    res.push({ 道の点: pi, 種: best.flow ? '箱（まっすぐ）' : best.flowR ? '横切る' : '道に沿う', 模様の速さ: +(ml / 0.7).toFixed(2), 押す速さ: +ul.toFixed(2), cos: ml > 1e-4 ? +((mv.x * u[0] + mv.z * u[2]) / ml / ul).toFixed(2) : null }) })
  return res
}, [a, b])
console.table(rows.sort((x, y) => x.道の点 - y.道の点)); const ng = rows.filter(r => r.cos == null || r.cos < 0.9).length; console.log('見た目と押す向きが合わない NG', ng, '/', rows.length)
await br.close(); process.exit(ng ? 1 : 0)
