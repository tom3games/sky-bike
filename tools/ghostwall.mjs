// 「見た目はあるが当たりがない」物の検査: 飾り（当たりと別に作る見た目）の頂点・辺の中点・面の中心のうち、
// バイクが通る所（道の線から横に 幅/2+0.3m 以内・路面から 0.15〜2.2m）に入っている点で、近くに当たりの形が無い点を数える
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5383'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 640, height: 360 } }); await muteContext(ctx)
const page = await ctx.newPage(); page.on('pageerror', e => console.log('ERR', e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 40000 })
await page.evaluate(() => window.sky.startRun(window.__COURSE || 'stage1')); await page.waitForTimeout(2500)
const r = await page.evaluate(() => {
  const G = window.sky, A = G.api, THREE = A.three, scene = A.scene, c = G.course, w = G.world
  const SKIPN = new Set(['course', 'sky', 'lava', 'foglayers', 'far', 'flames', 'grass', 'cards', 'signs'])
  // 道の点を 2m の格子に
  const grid = new Map(), key = (x, z) => Math.floor(x / 2) * 100000 + Math.floor(z / 2)
  c.path.forEach((q, i) => { if (!q.p || !q.w || q.kind === 'jump') return; const k = key(q.p[0], q.p[2]); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(q) })
  const inCorr = (x, y, z) => {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const q of grid.get(key(x + dx * 2, z + dz * 2)) || []) {
      const ex = x - q.p[0], ez = z - q.p[2], al = ex * Math.cos(q.yaw) - ez * Math.sin(q.yaw), lat = -ex * Math.sin(q.yaw) - ez * Math.cos(q.yaw), up = y - q.p[1]
      if (Math.abs(al) < 0.6 && Math.abs(lat) < Math.min(q.w, 6) / 2 + 0.3 && up > 0.15 && up < 2.2) return q
    }
    return null
  }
  const O = { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }
  const hasPhys = (x, y, z) => { for (const id of w.near(x, y, z, 0.6)) { const s = w.shapes[id]; A.closest; const o = A.closest(s, x, y, z); if (o.d < 0.35) return true } return false }
  const ng = new Map(); let pts = 0
  const v = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), cc = new THREE.Vector3(), m4 = new THREE.Matrix4(), mi = new THREE.Matrix4()
  const test = (p, label) => { pts++; const q = inCorr(p.x, p.y, p.z); if (!q) return; if (hasPhys(p.x, p.y, p.z)) return; const k = label + '@' + Math.round(p.x) + ',' + Math.round(p.y) + ',' + Math.round(p.z); if (!ng.has(k)) ng.set(k, { label, p: [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)], kind: q.kind }) }
  const visit = (o, label) => {
    if (!o.visible || o.name === 'water') return // 水の幕・滝は通り抜けてよい（水）
    if ((o.isMesh || o.isInstancedMesh) && !(o.material && o.material.depthWrite === false)) { // 光のにじみ（光るだけの板）は数えない
      const g = o.geometry, P = g.attributes.position; if (!P) return
      const idx = g.index ? g.index.array : null, nTri = (idx ? idx.length : P.count) / 3
      const nInst = o.isInstancedMesh ? o.count : 1
      for (let k = 0; k < nInst; k++) {
        m4.copy(o.matrixWorld); if (o.isInstancedMesh) { o.getMatrixAt(k, mi); m4.multiply(mi) }
        for (let t = 0; t < nTri; t++) {
          const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2
          a.fromBufferAttribute(P, i0).applyMatrix4(m4); b.fromBufferAttribute(P, i1).applyMatrix4(m4); cc.fromBufferAttribute(P, i2).applyMatrix4(m4)
          test(a, label); v.copy(a).add(b).add(cc).divideScalar(3); test(v, label); v.copy(a).add(b).multiplyScalar(0.5); test(v, label)
        }
      }
    }
    for (const ch of o.children) visit(ch, label + (ch.name ? '/' + ch.name : ch.material && ch.material.name ? '/' + ch.material.name : ''))
  }
  for (const o of scene.children) { if (SKIPN.has(o.name) || o === A.bikeView?.root || o.isLight || o.isPoints || o.isSprite) continue; if (A.bikeView && (o === A.bikeView.root)) continue; visit(o, o.name || o.type) }
  return { pts, ng: [...ng.values()] }
})
console.log(`見た目だけの点（道の上の通る所に、当たりの無い飾り）: ${r.ng.length} か所（調べた点 ${r.pts}）`)
const by = {}; for (const e of r.ng) by[e.label] = (by[e.label] || 0) + 1
console.log(JSON.stringify(by))
for (const e of r.ng.slice(0, 20)) console.log(' ', JSON.stringify(e))
await br.close(); process.exit(0)
