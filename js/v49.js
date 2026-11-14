// SKY BIKE v49 後輪だけで乗る感知式の床（幅 0.42m・長さ 0.6m）。
// 道の端の先の奈落に、小さな鉄の台。ウィリーで前輪を上げたまま後輪だけを台に乗せると、感知して動き出し（横・上・前、route のとおり。区間の間で一度止まる）、
// 向こうの足場の手前で止まる。前体重で前輪を足場に下ろして降りる。前輪まで乗せると前輪が台の先から落ちる。乗るのに失敗したら、台はそのまま待つ。
// 誰も乗らなくなると 1.5 秒で元へ戻る。旗からの出し直しで元へ（physics.js resetFallen）。動きは physics.js senseAt / senseTrack
import { Builder } from './course.js?v=50'
import { finish16 } from './parts16.js?v=50'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const SENSE = { L: 0.6, W: 0.46, TH: 0.22, gap: 0.04, exitGap: 0.25, v: 1.3, vUp: 0.4, pause: 0.9 }

// route: [[前, 横(右+), 上], ...]（台の中心が順に動く先。今の位置からの合計のずれ）。beams: [{ at: 区間の番号, u: 0..1, h: 台の面からの高さ }]
export function senseLift(B, o = {}) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), U = [0, 1, 0], S = SENSE
  const start = t.p.slice()
  const c0 = add3(add3(start, f, S.gap + S.L / 2), U, -S.TH / 2)
  const off = ([a, s, u]) => [f[0] * a + R[0] * s, u, f[2] * a + R[2] * s]
  const pts = [[0, 0, 0], ...(o.route || [[0, 6, 0]]).map(off)]
  const segT = []; for (let j = 0; j + 1 < pts.length; j++) segT.push(Math.max(2.2, Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][2] - pts[j][2]) / S.v, Math.abs(pts[j + 1][1] - pts[j][1]) / (globalThis.__vUp ?? S.vUp))) // 上下はゆっくり（速く下がると後輪が浮いてウィリーが崩れる）
  const ext = [0, 1, 2].map(k => Math.max(...pts.map(p => Math.abs(p[k]))) + 0.2)
  const m = { type: 'sense', pts, segT, pause: o.pause ?? S.pause, ext }
  const sh = B.box({ c: c0, h: [S.L / 2, S.TH / 2, S.W / 2], yaw, mat: 'liftdeck', mu: 1.25, tag: 'road', mov: m })
  B.decor = B.decor || []; B.decor.push({ kind: 'sense', shape: sh, m, yaw })
  const top0 = add3(start, f, S.gap + S.L / 2)
  const gl = { m, shape: sh, start, f, R, yaw, top0, pts }
  // 道の点: 台の中心の通り道（向きは道の向きのまま）
  for (let k = 0; k < (o.pathN ?? 3); k++) B.path.push({ p: add3(start, f, o.pathN ? k : k * 0.5), yaw, slope: 0, w: S.W, kind: 'sense', sense: gl }) // 乗る所だけ（運ばれる間はハンドルを切らない。道の線を横へ引くと、乗る前にハンドルがそちらへ切れる）
  // 低い梁（台の動く途中。前輪を上げたままの頭の高さより少し上。前へ体重を移して体を起こすと頭が当たる）
  for (const bm of o.beams || []) { const a = pts[bm.at], b = pts[bm.at + 1], p = add3(top0, add3(a, [b[0] - a[0], b[1] - a[1], b[2] - a[2]], bm.u)); const d = [b[0] - a[0], b[2] - a[2]], dl = Math.hypot(...d) || 1
    const across = [-d[1] / dl, 0, d[0] / dl]; const hb = bm.h + 0.12
    B.box({ c: add3(p, U, hb), h: [0.16, 0.12, 1.6], yaw: Math.atan2(-d[1], d[0]), mat: 'girder', tag: 'ceiling' }); for (const sg of [-1, 1]) { const q = add3(p, across, sg * 1.7); B.cyl({ a: add3(q, U, -3), b: add3(q, U, hb + 0.3), r: 0.12, mat: 'girder', tag: 'post' }) } }
  // 向こうの足場: 止まった台の先（前）に
  const end = add3(top0, pts[pts.length - 1])
  B.t.p = add3(end, f, S.L / 2 + S.exitGap); B.last = null
  gl.exit = B.t.p.slice()
  B.road(o.exitLen ?? 5, { w: o.exitW ?? 3, mat: o.exitMat || 'rust', thick: 0.6, back: 0, noOverlap: true, kind: 'landing' })
  B.last = null
  return gl
}

export function lab49() {
  const B = new Builder([0, 20, 0], 0)
  B.plats = []; B.props = []
  B.zone = 'factory'
  const G = { w: 4, mat: 'grate', thick: 0.8 }
  B.road(18, G); B.cp('試しの入口', { w: 4, rest: true })
  B.mark('感知する台 横'); B.road(10, { ...G, w: 3 })
  senseLift(B, { route: [[0, 7, 0]] })
  B.road(8, G); B.cp('台の先', { w: 4, rest: true })
  B.mark('感知する台 上と梁'); B.road(10, { ...G, w: 3 })
  senseLift(B, { route: [[0, -5, 0], [0, -5, 3], [4, -5, 3]], beams: [{ at: 2, u: 0.5, h: +(globalThis.__beamH ?? 1.72) }] })
  B.road(8, G); B.cp('試しの出口', { w: 4, finish: true }); B.road(10, G)
  return finish16(B, { id: 'lab49', name: 'v49 感知する台の試し', killBelow: 12, spawnBack: 2, climb: true })
}
