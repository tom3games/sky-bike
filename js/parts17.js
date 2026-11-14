// SKY BIKE v17 の仕掛け: 動く床の上のウィリー・片輪しか乗らない杭。
// course.js の Builder（B）の今の位置（B.t）から作り、B.t を仕掛けの先へ進める（parts16.js と同じ約束）。
// 見た目と当たりは同じ形の一覧（B.shapes）から。動く床は physics.js の mov 'lift'（前後に往復）。
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const UP = [0, 1, 0]

// ------------------------------------------------------------ 1 段のある動く床
// 切れ目 len の上を、長い床（長さ Ld）が前後に往復する（手前の端で dwell 秒止まる → move 秒で向こうへ → 向こうで dwell 秒 → 戻る）。
// 床の途中に、前輪を上げないと当たる段（stepH。車輪の半径より高い）。段の上の平らな所は短く（upper）、速さで段にぶつけて越えると止まり切れずに床から落ちる。
// 手前で止まっている床に乗り、歩く速さのウィリーで前輪を段に掛け、前体重で後輪を引き上げ、段の上で止まって運ばれる。
// 床が向こうで止まったら、高い縁（hang）に前輪を掛けて登る。床が向こうに着く前に先の端から出ると落ちる。乗り遅れると床は向こうへ行ってしまう（戻るまで待つ）。
// o: { w=3.2, lead=2.6（段の手前）, stepH=0.5, upper=3.4（段の上）, travel=4.5, dwell=5.0, move=3.0, hang=1.6, exit=5, mat='liftdeck' }
// 道の点: 'glift'（glift: 床の情報）。B.t は縁の上の道の終わり
export function stepLift(B, o = {}) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), W = o.w ?? 3.2
  const lead = o.lead ?? 2.6, stepH = o.stepH ?? 0.5, upper = o.upper ?? 3.4, Ld = lead + upper, travel = o.travel ?? 4.5, amp = travel / 2, len = Ld + travel + 0.05
  const m = { type: 'lift', axis: f, amp, dwell: o.dwell ?? 5.0, move: o.move ?? 3.0, ext: [Math.abs(f[0]) * amp + 0.1, 0.1, Math.abs(f[2]) * amp + 0.1] }
  const start = t.p.slice()
  // 床の形は「k = 0（真ん中）の時」の位置で置く。手前の端で止まった時（k = -amp）に、床の後ろの端が start に来る
  const at = (s, y = 0) => add3(add3(start, f, amp + s), UP, y)
  const deck = []
  deck.push(B.box({ c: at(lead / 2, -0.2), h: [lead / 2, 0.2, W / 2], yaw, mat: o.mat || 'liftdeck', mu: 1.05, tag: 'road', mov: m }))
  // 段の上の板（厚い。段の面は鉄の帯で縁取る）
  const thU = stepH + 0.4
  deck.push(B.box({ c: at(lead + upper / 2, stepH - thU / 2), h: [upper / 2, thU / 2, W / 2], yaw, mat: o.mat || 'liftdeck', mu: 1.05, tag: 'road', mov: m }))
  deck.push(B.box({ c: at(lead + 0.04, stepH - 0.06), h: [0.05, 0.06, W / 2 + 0.01], yaw, mat: 'edgesteel', tag: 'lip', mov: m }))
  for (const sg of [-1, 1]) B.decor.push({ kind: 'rail', a: add3(add3(start, UP, -0.5), R, sg * (W / 2 + 0.1)), b: add3(add3(add3(start, f, len), UP, -0.5), R, sg * (W / 2 + 0.1)) })
  for (const d of [0, len]) for (const sg of [-1, 1]) { const q = add3(add3(start, f, d), R, sg * (W / 2 + 0.45)); B.cyl({ a: add3(q, UP, -2.5), b: add3(q, UP, 1.1 + (d ? stepH : 0)), r: 0.16, mat: 'iron', tag: 'post' }) }
  const gl = { m, start, f, amp, Ld, len, W, lead, stepH, stepS: lead, vIn: o.vIn ?? 3.0, deck }
  B.decor.push({ kind: 'glift', gl })
  for (let d = 0; d < len - 0.01; d += 1) B.path.push({ p: add3(start, f, d), yaw, slope: 0, w: W, kind: 'glift', glift: gl })
  t.p = add3(add3(start, f, len), UP, stepH); B.last = null
  B.hangLedge(o.hang ?? 1.6, o.exit ?? 5, { w: o.exitW ?? W, mat: o.exitMat || 'rust', max: o.hangMax ?? 9, thick: o.exitThick })
  B.last = null
  return gl
}

// ------------------------------------------------------------ 2 片輪しか乗らない杭の列
// 今の位置（道の終わり）から、奈落の上に石の杭を n 本。杭の頭は短く（pl、車輪の間 1.42m より短い）、杭の間は前輪がちょうど落ちる幅（pg）。
// 杭は 1 本ごとに rise 高い（登っていく）。前輪で入ると、前輪が杭の間に落ちて次の杭の角に当たり、前へつんのめって落ちる。
// ウィリーで前輪を上げたまま、後輪だけで杭から杭へ乗り継ぐ（後輪は駆動しているので、次の杭の角をよじ登れる）。
// o: { w=2.4, n=6, pl=0.45, pg=0.66, rise=0.2, deep=5, after=4, afterW=3.2, vg=3.6, mat='ruinwall' }
// 道の点: 'peg'（杭の頭と杭の間。groove: 溝と同じ技の情報）。B.t は降りた先の道（after）の終わり
export function pegRow(B, o = {}) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), W = o.w ?? 2.4
  const n = o.n ?? 6, pl = o.pl ?? 0.45, pg = o.pg ?? 0.66, rise = o.rise ?? 0.2, deep = o.deep ?? 5, vg = o.vg ?? 3.6
  const slope = Math.atan2(rise, pl + pg)
  const i0 = B.path.length, pegs = []
  for (let k = 0; k <= n; k++) {
    B.path.push({ p: t.p.slice(), yaw, slope: 0, w: W, kind: 'peg', groove: { sw: pg, k, n: n + 1, vg, slope }, len: pg })
    t.p = add3(add3(t.p, f, pg), UP, rise)
    if (k === n) break
    // 杭: 頭の短い石の柱（当たりあり。下は奈落）
    const c = add3(add3(t.p, f, pl / 2), UP, -deep / 2)
    pegs.push(B.box({ c, h: [pl / 2, deep / 2, W / 2], yaw, mat: o.mat || 'ruinwall', mu: 1.1, tag: 'road' }))
    B.path.push({ p: add3(t.p, f, 0.1), yaw, slope: 0, w: W, kind: 'peg', pegTop: true })
    t.p = add3(t.p, f, pl)
  }
  for (let k = i0; k < B.path.length; k++) B.path[k].grooveRun = { i0, n: n + 1, sw: pg, vg, slope, peg: true }
  B.last = null
  B.road(o.after ?? 4, { w: o.afterW ?? 3.2, mat: o.afterMat || 'cobble', thick: 0.9, back: 0, noOverlap: true, kind: 'landing' })
  B.last = null
  return pegs
}

// ============================================================ 試しのコース（v17 の仕掛けを 1 つずつ）
import { Builder } from './course.js?v=41'
import { finish16 } from './parts16.js?v=41'
export function lab17() {
  const B = new Builder([0, 20, 0], 0)
  B.plats = []; B.props = []
  B.zone = 'factory'
  const G = { w: 4, mat: 'grate', thick: 0.8 }
  B.road(18, G); B.cp('試しの入口', { w: 4, rest: true })
  B.mark('段のある動く床'); B.road(8, { ...G, w: 3.2 })
  stepLift(B, {})
  B.road(6, G); B.cp('動く床の先', { w: 4, rest: true })
  B.mark('片輪の杭'); B.road(10, { ...G, w: 3.2 })
  B.hangLedge(1.6, 2.2, { w: 3.2, mat: 'cobble', max: 10 })
  pegRow(B, {})
  B.road(6, G); B.cp('杭の先', { w: 4, rest: true })
  B.road(8, G); B.cp('試しの出口', { w: 4, finish: true }); B.road(10, G)
  return finish16(B, { id: 'lab17', name: 'v17 の仕掛けの試し', killBelow: 12, spawnBack: 2, climb: true })
}
