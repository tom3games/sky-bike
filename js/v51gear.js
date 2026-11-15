// SKY BIKE v51 三つの歯車（草原の端の機械の穴。風車の手前）
// 本人「縦に回る歯車に乗る場所もいいかも。で、いいタイミングで降りる」「回転の向きが違うものを3つ並べて、タイミングを見極めて次のところに進む」
// 縦に回る大きな歯車 3 つが噛み合って並ぶ（噛み合うので回る向きが 1 つおきに逆）。歯車の上の山をタイヤで越える。
// どの歯車も歯が 4 分の 1 欠けていて、欠けた所が上に来ている間に乗ると落ちる。歯車の間の短い鉄の足場で止まって、欠けが過ぎるのを見てから次へ。
// 手前に戻る向きの歯車（2 つ目）は、欠けが向こうから頭の上を越えて足元へ来る。全開で抜けようとすると、どれかの欠けに必ず落ちる並び
import { dsin, dcos } from './physics.js?v=62' // 形の位置は端末で同じに（Math.cos は端末で末尾が違うことがある）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
// R: 歯先の半径（走る面）・N: 歯の数・M: 欠けた歯の数・SUB: 歯 1 枚あたりの当たりの板の数（多角形の角で車輪が引っかからない細かさ）・W: 幅・TH: 縁の厚さ・PHI: 足場の端が山にかかる角度（真上から）・GAP: 噛み合う深さ・w: 回る速さ（rad/s）
export const VGEAR = { R: 3.6, N: 28, M: 7, SUB: 3, W: 3.0, TH: 0.3, PHI: (globalThis.__gPhi ?? 25) * DEG, MESH: 0.3, w: 0.33, BEAM: 2.6, TB: 0.35, TL: 0.06 }
// 欠けの真ん中が真上に来る時刻（周期の中の秒）。1 つ目の欠けが過ぎた直後に出ると 2 つ目の欠けが来て、2 つ目が過ぎた直後に出ると 3 つ目の欠けが来る
const TOP_T = [0, 7, 15]
export const vgearPeriod = () => 2 * Math.PI / VGEAR.w
// 足場の端（板の本体と薄い縁）: 歯車の円に食い込まない所まで
export function vgearDims() {
  const G = VGEAR, yp = G.R * dcos(G.PHI), d = 2 * G.R - G.MESH
  const xBody = Math.sqrt(G.R * G.R - (yp - G.TB) ** 2) + 0.04, xLip = Math.sqrt(G.R * G.R - (yp - G.TL) ** 2) + 0.03
  return { yp, d, xBody, xLip, span: 2 * xBody + 2 * d }
}
// 歯車 k（0..2）の欠けの真ん中の角度（道の前を 0、上を 90 度とする角度）が時刻 t にどこか
export function holeAng(g, t) { let a = g.holeA0 + g.w * t; a = a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI)); return a }
// 時刻 t に、欠けが上の山（足場の間の、タイヤが乗る所）にかかっているか
export function holeOnTop(g, t, marg = 8 * DEG) { const a = holeAng(g, t), half = VGEAR.M / VGEAR.N * Math.PI; return Math.abs(a - Math.PI / 2) < half + VGEAR.PHI + marg }

// 今の位置（B.t.p）から歯車の区間を作る。終わりは B.t.p = 3 つ目の歯車の向こうの足場の本体の始まり（同じ高さ）
export function vgears(B) {
  const G = VGEAR, t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), UP = [0, 1, 0], D = vgearDims()
  const y0 = t.p[1], A = t.p.slice() // A: 手前の道の端（本体）
  const gears = []
  const segL = 2 * G.R * dsin(Math.PI / (G.N * G.SUB)) / dcos(Math.PI / (G.N * G.SUB)) + 0.02 // 縁の一枚の長さ（となりと少し重ねる）
  const T = vgearPeriod()
  // 歯の並び: 噛み合う相手と半歯ずらす（鏡に映した並び＋半歯）
  let base = 0
  for (let k = 0; k < 3; k++) {
    const c = add3(add3(A, f, D.xBody + k * D.d), UP, -D.yp)
    const w = (k % 2 === 0 ? -1 : 1) * G.w // 前へ回る（上が前へ動く）のは 1・3 つ目
    if (k > 0) base = Math.PI - base + Math.PI / G.N
    // 欠けの最初の歯 h0: 欠けの真ん中が TOP_T[k] 秒に真上（90 度）に来る
    const holeMid = Math.PI / 2 - w * TOP_T[k] // t=0 の時の欠けの真ん中の角度
    const kMid = Math.round((holeMid - base) / (2 * Math.PI / G.N) - (G.M - 1) / 2)
    const h0 = ((kMid % G.N) + G.N) % G.N
    const holeA0 = base + (h0 + (G.M - 1) / 2) * 2 * Math.PI / G.N
    const segs = []
    for (let j = 0; j < G.N; j++) for (let u = 0; u < G.SUB; u++) {
      if (((j - h0 + G.N) % G.N) < G.M) continue
      const ph = base + (j + (u - (G.SUB - 1) / 2) / G.SUB) * 2 * Math.PI / G.N
      const m = { type: 'blade', cont: true, seg: true, ph, w, hub: c.slice(), yaw, aBoard: 0, aTop: 0, rc: G.R - G.TH / 2, th: G.TH, solidSin: dsin(20 * DEG), bound: Math.hypot(segL / 2, G.TH / 2, G.W / 2) + 0.05, ext: [2 * G.R + 1, 2 * G.R + 1, 2 * G.R + 1], t0: null, tBack: null, gear: k, gid: k }
      const s = B.box({ c: [c[0] + f[0] * dcos(ph) * m.rc, c[1] + dsin(ph) * m.rc, c[2] + f[2] * dcos(ph) * m.rc], h: [segL / 2, G.TH / 2, G.W / 2], yaw, pitch: ph - Math.PI / 2, mat: 'rust', mu: 1.1, tag: 'road', mov: m })
      s.noView = true; segs.push(s)
    }
    // 軸（止まった円柱。欠けから落ちた時に真ん中を素通りして見えないように）
    B.cyl({ a: add3(c, R, -(G.W / 2 + 0.6)), b: add3(c, R, G.W / 2 + 0.6), r: 0.5, mat: 'iron', tag: 'post' })
    const g = { k, c, w, base, h0, holeA0, segs, yaw, T }
    gears.push(g)
  }
  // 道の点: 手前の縁 → 歯車の山 → 足場 → …（高さは山の形）
  const along = x => { const k = Math.max(0, Math.min(2, Math.round((x - D.xBody) / D.d))), dx = x - (D.xBody + k * D.d); return { k, dx } }
  const topY = x => { const { dx } = along(x); const h = Math.sqrt(Math.max(0, G.R * G.R - dx * dx)) - D.yp; return Math.max(0, h) }
  for (let x = 0.5; x < D.span; x += 1) {
    const { k, dx } = along(x), onGear = Math.abs(dx) < G.R * Math.sin(G.PHI) + 0.1
    const sl = onGear ? Math.atan2(-dx, Math.sqrt(Math.max(0.01, G.R * G.R - dx * dx))) : 0
    B.path.push({ p: add3(add3(A, f, x), UP, topY(x)), yaw, slope: sl, w: G.W, kind: onGear ? 'vgear' : 'road', vgear: onGear ? k : undefined, gearSec: true })
  }
  // 足場（歯車の間の鉄の板）と縁の薄い板
  const plate = (x0, x1, th, mat) => { const L = x1 - x0, cc = add3(add3(A, f, (x0 + x1) / 2), UP, -th / 2); return B.box({ c: cc, h: [L / 2, th / 2, G.W / 2 + 0.1], yaw, mat, mu: 1.1, tag: 'road' }) }
  for (let k = 0; k < 2; k++) {
    const a0 = D.xBody + k * D.d, a1 = a0 + D.d
    plate(a0 + D.xBody, a1 - D.xBody, G.TB, 'iron') // 本体
    plate(a0 + D.xLip, a0 + D.xBody, G.TL, 'grate') // 手前の歯車側の縁
    plate(a1 - D.xBody, a1 - D.xLip, G.TL, 'grate') // 向こうの歯車側の縁
  }
  plate(-0.02, D.xBody - D.xLip, G.TL, 'grate') // 入口の縁（手前の道の端から 1 つ目の歯車へ）
  plate(D.span - (D.xBody - D.xLip), D.span + 0.02, G.TL, 'grate') // 出口の縁
  // 足場と軸を支える両脇の鉄骨（道の外。歯車の横）
  // 軸を受ける両脇の長い鉄骨: 手前の崖から向こうの崖まで（軸の高さ。下へ垂れる柱にしない）
  for (const sg of [-1, 1]) { const q = add3(add3(A, f, D.span / 2), R, sg * (G.W / 2 + 0.6)); B.box({ c: add3(q, UP, -D.yp), h: [D.span / 2 + 1.4, 0.3, 0.22], yaw, mat: 'girder', tag: 'post' }) }
  // 足場の上の低い鉄の梁（両脇の柱にかかる）: ふつうに越えれば頭の上 0.5m あく。全開で歯車の山から跳ぶと頭が当たる（欠けを跳び越えて抜けられない）
  for (let k = 0; k < 2; k++) { const x = D.xBody + (k + 0.5) * D.d, cc = add3(add3(A, f, x), UP, G.BEAM + 0.14)
    B.box({ c: cc, h: [0.12, 0.14, G.W / 2 + 0.75], yaw, mat: 'girder', tag: 'beam' })
    for (const sg of [-1, 1]) { const q = add3(add3(A, f, x), R, sg * (G.W / 2 + 0.6)); B.cyl({ a: add3(q, UP, -D.yp), b: add3(q, UP, G.BEAM + 0.28), r: 0.14, mat: 'girder', tag: 'post' }) } }
  B.decor = B.decor || []
  B.decor.push({ kind: 'vgear', gears, yaw, f, R: R.slice(), A, D })
  B.notes = B.notes || []; B.notes.push({ kind: 'vgear', gears, yaw, A, D })
  // bot 用の危ない物: 歯車ごとに、欠けが山にかかっている間は通らない（次の歯車は、その前の足場から見る）
  for (const g of gears) B.hazards.push({ kind: 'vgear', custom: true, p: add3(g.c, UP, D.yp), yaw, half: 1.6, w: G.W, vGo: g.w < 0 ? 2.2 : 3.4, look: 6.2, runup: 1.2, g, unsafe: tt => holeOnTop(g, tt) })
  t.p = add3(A, f, D.span); t.p[1] = y0; B.last = null
  return gears
}
