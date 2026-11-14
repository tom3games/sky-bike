// SKY BIKE v37 終盤の 4 区間（finale の回る筒の後、天空城への大ジャンプの前）:
//  1 真っ暗な通路（塔の中。ヘッドライトだけ。穴と段が直前まで見えない）
//  2 明るい草原の浮き島（霧を抜けると急に昼。違和感 3 つ・錆びた古いトライアルバイク 3 台・草に隠れた穴 1 つ・跳ね台）
//  3 風車の羽根に乗って運ばれる（ゆっくり回る羽根の上を根元から先へ。羽根が傾くので体重で耐え、先で次の足場へ）
//  4 ワイヤーの綱渡り（谷に張った太いケーブルの上をタイヤで渡る。たわみ・横風。落ちたら手前の旗）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
export const BLADE = { L: 12.6, r0: 0.8, W: 3.0, TH: 0.3, w: 0.27, n: 4, aBoard: -18 * DEG, aTop: 22 * DEG, x0: 2.2 }

export function v37(B) {
  const D = { w: 4.2, mat: 'castle', thick: 1.2 }
  B.decor = B.decor || []; B.v37 = {}
  // ---------------- 1 真っ暗な通路
  B.zone = 'tunnel'
  B.road(6, { ...D, mat: 'stone' })
  B.cp('暗い通路の入口', { w: 4.2, rest: true })
  B.mark('真っ暗な通路')
  { const p0 = B.t.p.slice(), yaw = B.t.yaw
    B.road(4, { ...D, mat: 'stone' })
    const tStart = B.t.p.slice()
    B.road(12, { ...D, mat: 'stone', kind: 'dark' })
    B.gap(1.9, 0, 'jump'); B.path[B.path.length - 1].vJump = 6.5; B.path[B.path.length - 1].dark = true // 穴（速さで越える）
    B.road(9, { ...D, mat: 'stone', kind: 'dark', back: 0 })
    B.step(0.26); B.road(8, { ...D, mat: 'stone', kind: 'dark', noOverlap: true }) // 段（速さのまま越えられる低さ。見えないと前輪が取られる）
    B.gap(2.3, -0.3, 'jump'); B.path[B.path.length - 1].vJump = 7.5
    B.road(10, { ...D, mat: 'stone', kind: 'dark', back: 0 })
    B.step(0.3); B.road(6, { ...D, mat: 'stone', kind: 'dark', noOverlap: true })
    B.step(-0.5); B.road(9, { ...D, mat: 'stone', kind: 'dark', noOverlap: true })
    const tEnd = B.t.p.slice(), f = B.dir(yaw), R = B.right(yaw), len = Math.hypot(tEnd[0] - tStart[0], tEnd[2] - tStart[2]) + 2
    // 通路の天井と壁（塔の中。当たりあり）: 天井は道より 4.8m 上（カメラが天井の上に出ない高さ）
    const top = Math.max(tStart[1], tEnd[1]) + 4.8, mid = add3(tStart, f, len / 2 - 1)
    B.box({ c: [mid[0], top + 0.6, mid[2]], h: [len / 2 + 1, 0.6, 3.4], yaw, mat: 'ruinwall', tag: 'ceiling' })
    for (const sg of [-1, 1]) B.box({ c: add3([mid[0], (top + Math.min(tStart[1], tEnd[1]) - 8) / 2, mid[2]], R, sg * 2.6), h: [len / 2 + 1, (top - Math.min(tStart[1], tEnd[1]) + 8) / 2, 0.5], yaw, mat: 'ruinwall', tag: 'wall' })
    B.v37.tunnel = { a: tStart, b: tEnd, yaw, f, len, top }
  }
  B.road(4, { ...D, mat: 'stone' })
  B.closeMark()
  // ---------------- 2 明るい草原の浮き島（霧を抜けた先）
  B.zone = 'meadow'
  const G = { w: 6, mat: 'dirt', thick: 1.0 }
  B.road(10, { ...G, kind: 'road' })
  B.cp('草原', { w: 6, rest: true })
  B.mark('明るい草原')
  const m0 = B.t.p.slice(), myaw = B.t.yaw
  for (const [len, sl] of [[8, 4], [8, -4], [6, 0]]) B.road(len, { ...G, slope: sl * DEG })
  { const rise = B.kicker(2.6, 13 * DEG, { w: 3.4, mat: 'plank', thick: 0.6 }); B.gap(3.6, rise - 0.45, 'jump'); B.path[B.path.length - 1].vJump = 7 } // 跳ね台
  B.road(10, { ...G, back: 0 })
  for (const [len, sl] of [[7, -3], [7, 5], [6, 0]]) B.road(len, { ...G, slope: sl * DEG })
  const holeAt = B.t.p.slice()
  B.gap(1.7, 0, 'jump'); B.path[B.path.length - 1].vJump = 6; B.path[B.path.length - 1].hidden = true // 草に隠れた穴
  B.road(12, { ...G, back: 0 })
  const m1 = B.t.p.slice()
  B.v37.meadow = { a: m0, b: m1, yaw: myaw, hole: holeAt }
  // ---------------- 3 風車の羽根（草原の端の風車）
  B.road(6, { ...G })
  B.cp('風車の前', { w: 6, rest: true })
  B.closeMark()
  B.mark('風車の羽根')
  B.road(4, { w: 3.4, mat: 'plank', thick: 0.5 })
  // 羽根の回る面の横から入る（羽根は下から来て、待っているバイクをすくい上げる。羽根が頭の上から来ることはない）
  B.pad(3.4, -90 * DEG, { mat: 'grate', thick: 0.5, wide: 3.4 })
  windmill(B)
  B.closeMark()
  // ---------------- 4 ワイヤーの綱渡り
  B.zone = 'sky'
  B.road(2, { w: 4, mat: 'castle', thick: 1.2 })
  B.cp('綱渡りの前', { w: 4, rest: true })
  B.mark('ワイヤーの綱渡り')
  B.road(4, { w: 4, mat: 'castle', thick: 1.2 })
  cable(B, 28)
  B.road(8, { w: 4.2, mat: 'castle', thick: 1.2, kind: 'landing', back: 0 })
  B.closeMark()
  B.zone = 'castle'
}

// 風車: 今の位置（横から入った待ちの足場の真ん中）の 2.2m 後ろに羽根の軸。羽根 4 枚が、前の羽根の先が上がる向きにゆっくり回る（BLADE.w rad/s）。
// 羽根は足場の下から上がってきて、足場で待つバイクをすくい上げる（羽根が -18 度の時に足場の高さ）。羽根の上を先へ走り、先が +22 度の時の高さの次の足場へ
function windmill(B) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), Bl = BLADE
  const hub = add3(add3(t.p, f, -Bl.x0), [0, 1, 0], Bl.x0 * Math.tan(-Bl.aBoard))
  // 乗れる羽根は 1 枚（残りの 3 枚は見た目だけ。乗れる羽根と一緒に回る）。待っている間は足場と同じ高さで止まっていて、乗ると回り始め、先が +22 度で止まる。降りて 1.5 秒で元へ戻る
  const m = { type: 'blade', hub: hub.slice(), yaw, aBoard: Bl.aBoard, aTop: Bl.aTop, w: Bl.w, rc: Bl.r0 + Bl.L / 2, th: Bl.TH, ext: [Bl.L + 2, Bl.L + 2, Bl.L + 2], t0: null, tBack: null }
  const blades = [B.box({ c: bladeCenter(m, Bl.aBoard), h: [Bl.L / 2, Bl.TH / 2, Bl.W / 2], yaw, pitch: Bl.aBoard, mat: 'plankold', mu: 1.1, tag: 'road', mov: m })]
  // 軸の柱（羽根の横。道の外）と、軸の箱（羽根より横）
  for (const sg of [-1, 1]) { const q = add3(hub, R, sg * (Bl.W / 2 + 0.7)); B.cyl({ a: [q[0], hub[1] - 40, q[2]], b: [q[0], hub[1] + 0.6, q[2]], r: 0.5, mat: 'girder', tag: 'post' }) }
  // 道の点: 羽根の上（kind 'blade'）。羽根が aTop の時の線に沿わせる
  const n = Math.round(Bl.L - Bl.x0)
  for (let k = 1; k <= n; k++) { const r = Bl.x0 / Math.cos(Bl.aBoard) + k * (Bl.L + Bl.r0 - Bl.x0 / Math.cos(Bl.aBoard)) / n, a = Bl.aBoard + (Bl.aTop - Bl.aBoard) * k / n; B.path.push({ p: add3(hub, [f[0] * Math.cos(a) * r, Math.sin(a) * r, f[2] * Math.cos(a) * r]), yaw, slope: a, w: Bl.W, kind: 'blade', blade: true }) }
  // 次の足場: 羽根の先が aTop の時の先のすぐ先、高さはその時の羽根の先
  const tipR = Bl.L + Bl.r0, tip = add3(hub, [f[0] * Math.cos(Bl.aTop) * tipR, Math.sin(Bl.aTop) * tipR, f[2] * Math.cos(Bl.aTop) * tipR])
  B.t.p = add3(tip, f, 0.25); B.last = null
  B.road(8, { w: 4, mat: 'castle', thick: 0.8, back: 0, kind: 'landing' })
  B.decor.push({ kind: 'windmill', hub, yaw, blades: blades.map(s => s), f, R })
  B.notes = B.notes || []; B.notes.push({ kind: 'windmill', hub, yaw, blades })
  B.hazards.push({ kind: 'blade', custom: true, hub, yaw, blades, p: add3(hub, f, Bl.x0), half: 1, w: Bl.W })
}
export function bladeCenter(m, a) {
  const cy = Math.cos(m.yaw), sy = Math.sin(m.yaw), f = [cy * Math.cos(a), Math.sin(a), -sy * Math.cos(a)], u = [-cy * Math.sin(a), Math.cos(a), sy * Math.sin(a)]
  return [m.hub[0] + f[0] * m.rc - u[0] * m.th / 2, m.hub[1] + f[1] * m.rc - u[1] * m.th / 2, m.hub[2] + f[2] * m.rc - u[2] * m.th / 2]
}
// 太いケーブル: たわみ（中ほどが 1.2m 下がる）・横風（間をおいて吹く）。当たりは円柱を 4 本つなぐ
function cable(B, span) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), r = 0.34, p0 = add3(t.p, [0, 1, 0], -r), sag = 1.2, N = 6, pts = []
  for (let k = 0; k <= N; k++) { const u = k / N; pts.push(add3(add3(p0, f, span * u), [0, 1, 0], -sag * 4 * u * (1 - u))) }
  for (let k = 0; k < N; k++) B.cyl({ a: pts[k], b: pts[k + 1], r, mat: 'chain', mu: 1.15, tag: 'cable' })
  for (let d = 0; d < span; d += 1) { const u = d / span; B.path.push({ p: add3(add3(t.p, f, d), [0, 1, 0], -sag * 4 * u * (1 - u)), yaw, slope: Math.atan(-sag * 4 * (1 - 2 * u) / span), w: 0.36, kind: 'narrow', cable: true }) }
  // 両端の柱（道の外）
  for (const e of [pts[0], pts[N]]) for (const sg of [-1, 1]) { const q = add3(e, B.right(yaw), sg * 2.5); B.cyl({ a: [q[0], q[1] - 6, q[2]], b: [q[0], q[1] + 2.6, q[2]], r: 0.22, mat: 'iron', tag: 'post' }) }
  { const t0 = B.t.p.slice(); B.t.p = add3(t0, f, span * 0.25); B.gust(span * 0.5, { a: 2.2, T: 5.2, sgn: 1, w: 1.5 }); B.t.p = t0 } // 横風は真ん中の半分だけ（間をおいて吹く）
  B.decor.push({ kind: 'cable', pts, r })
  t.p = add3(t.p, f, span); B.last = null
}
