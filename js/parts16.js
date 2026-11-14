// SKY BIKE v16 の仕掛け: 回る歯車・ウィリーの溝・揺れる鎖の吊り橋・倒れる煙突・跳ね板・道を選ぶ横に動く床。
// どれも course.js の Builder（B）の今の位置（B.t）から作り、B.t を仕掛けの先へ進める（Builder のメソッドと同じ約束）。
// 見た目と当たりは同じ形の一覧（B.shapes）から。動く物は physics.js の mov（gear / wave / topple / kick / shuttle）。
import { Builder } from './course.js?v=31'
import { dsin, dcos, datan2, shuttlePos, kickPos, toppleAng } from './physics.js?v=31'

const DEG = Math.PI / 180
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const UP = [0, 1, 0]

// ------------------------------------------------------------ 1 回る歯車の上を走る
// 寝かせた大きな歯車（縦の軸の円柱）の上の面を走る。道の線は歯車の中心から横にずれた弦を通るので、
// 面は道の向きに u m/s で動く（u>0 = 乗ると運ばれて速くなる・u<0 = 逆らう向き。歯にタイヤが噛むので、止まると押し戻され、全開でも 2m/s ほどしか進めない）。
// 歯車の間は空いていて（下は何もない）、跳び移る。次の歯車は少し低い（遅いと届かず、速すぎると小さい歯車を跳び越えて落ちる）。
// o.gears: [{ R 半径, u 道の向きの面の速さ, chord 道が通る長さ, gap 手前の歯車からの切れ目, drop 手前の歯車より低い高さ }]（1 個目の gap/drop は道からの分）
// o: { vIn=10（上手い bot が歯車に入る速さ。9〜11 で届く）, w=3.2（道の点の幅）, thick=1.1, exit=7（出口の道の長さ）, exitGap=2.4, exitDrop=1.0, grip=170, mat='rust' }
// 道の点: 歯車の上 'gear'（gear: {u}）、切れ目 'jump'（vJump 要る速さ・vMax 跳び越えない速さ）、出口 'landing'
export const GEARS_DEFAULT = [
  { R: 4.2, u: 4.5, chord: 5.0, gap: 0.12, drop: 0 }, // 乗ると運ばれる歯車
  { R: 3.2, u: -6.5, chord: 3.2, gap: 0.15, drop: 0 }, // 逆らう歯車（止まると押し戻される。勢いのまま渡る）
  { R: 2.6, u: 5.0, chord: 2.8, gap: 2.4, drop: 1.2, beam: true }, // 跳び移る小さい歯車（速すぎると奥の梁に頭）
]
export function gearRun(B, o = {}) {
  const t = B.t, f = B.dir(t.yaw), R = B.right(t.yaw), w = o.w ?? 3.2, thick = o.thick ?? 1.1, grip = o.grip ?? 170
  const specs = o.gears || GEARS_DEFAULT, g = 9.81, out = []
  let side = o.side ?? 1, jump = null
  const flush = sp => { // 跳ぶ所（跳び越える歯車を含む）の道の点
    const dropT = Math.max(0.05, jump.drop), tf = Math.sqrt(2 * dropT / g)
    const vJ = jump.drop > 0.3 ? (jump.len + 0.4) / tf : 2.0 + jump.len * 1.9, vMax = jump.drop > 0.3 ? (jump.len + sp.chord - 1.6) / tf : 99
    B.path.push({ p: jump.p, yaw: t.yaw, slope: 0, w: 0, kind: 'jump', len: jump.len, dy: -jump.drop, vJump: vJ, vMax, gearJump: true })
    jump = null
  }
  for (let k = 0; k < specs.length; k++) {
    const sp = specs[k], half = sp.chord / 2, e = Math.sqrt(Math.max(0.5, sp.R * sp.R - half * half))
    if ((k > 0 || sp.gap > 0.2) && !jump) jump = { p: t.p.slice(), len: 0, drop: 0 }
    if (jump) { jump.len += sp.gap; jump.drop += sp.drop }
    t.p = add3(add3(t.p, f, sp.gap), UP, -sp.drop)
    const c = add3(add3(t.p, f, half), R, -side * e) // 中心は道の線の左（side=1）か右
    const om = sp.u / (e * side)
    const disc = B.cyl({ a: add3(c, UP, -thick), b: c, r: sp.R, mat: o.mat || 'rust', mu: 1.0, tag: 'road', mov: { type: 'gear', rate: om, om: [0, om, 0], u: sp.u, grip } })
    B.cyl({ a: add3(c, UP, -thick - (o.axle ?? 1.8)), b: add3(c, UP, -thick + 0.05), r: 0.55, mat: "iron", tag: "post" }) // 軸（円板の下。下を通る道に届かない長さ o.axle）
    B.decor.push({ kind: 'gear', disc, c: c.slice(), R: sp.R, thick, rate: om })
    out.push({ disc, c, R: sp.R, u: sp.u, om, skip: !!sp.skip })
    if (sp.skip) { jump.len += sp.chord; t.p = add3(t.p, f, sp.chord) }
    else {
      if (jump) flush(sp)
      for (let d = 0; d < sp.chord - 0.01; d += 1) B.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope: 0, w, kind: 'gear', gear: { u: sp.u, k, vIn: o.vIn ?? 10 } })
      t.p = add3(t.p, f, sp.chord)
      // 跳び越えた先の歯車の奥の端の上に、低い鉄骨の梁（速すぎて歯車の上を跳び越すと頭を打つ。ちょうどの速さなら下を通れる）
      if ((sp.beam || (out.length > 1 && out[out.length - 2].skip)) && o.beam !== false) { const bc = add3(add3(t.p, f, -0.5), UP, (o.beamH ?? 2.4) + 0.3); B.box({ c: bc, h: [0.3, 0.3, sp.R + 0.6], yaw: t.yaw, mat: 'girder', tag: 'ceiling' }); for (const sg of [-1, 1]) { const q = add3(add3(t.p, f, -0.5), R, sg * (sp.R + 0.9)); B.cyl({ a: add3(q, UP, -thick - 1.2), b: add3(q, UP, (o.beamH ?? 2.4) + 0.6), r: 0.22, mat: 'girder', tag: 'post' }) } }
    }
    side = -side // 次の歯車は反対側に（かみ合う歯車のように回る向きが互い違い）
  }
  // 出口の道
  const eg = o.exitGap ?? 2.4, ed = o.exitDrop ?? 1.0
  const fE = B.dir(t.yaw)
  if (eg > 0.2) { const tf = Math.sqrt(2 * Math.max(0.05, ed) / g); B.path.push({ p: t.p.slice(), yaw: t.yaw, slope: 0, w: 0, kind: 'jump', len: eg, dy: -ed, vJump: ed > 0.3 ? (eg + 0.9) / tf : 2.0 + eg * 1.9 }) }
  t.p = add3(add3(t.p, fE, eg), UP, -ed); B.last = null
  B.road(o.exit ?? 7, { w: o.exitW ?? 4, mat: o.exitMat || 'grate', thick: 0.6, back: 0, kind: 'landing' })
  B.last = null
  return out
}

// ------------------------------------------------------------ 共通: 道の点の配列の後始末（course.js の finishCourse と同じ。lab16 用）
export function finish16(B, o) {
  const cps = B.cps
  for (let i = 0; i < cps.length; i++) { const a = cps[i].p, nxt = cps[i + 1] ? cps[i + 1].p : a; cps[i].kill = Math.min(a[1], nxt[1]) - o.killBelow }
  const sp = cps[0]
  B.closeMark()
  for (const br of B.branches || []) B.path.push(...br)
  for (const mk of B.marks || []) if (mk.branchOf) { const off = B.path.indexOf(mk.branchOf[0]); mk.i0 += off; mk.i1 += off; delete mk.branchOf }
  { let k = 0; const zm = B.zoneMarks || []; for (let i = 0; i < B.path.length; i++) { while (k + 1 < zm.length && zm[k + 1].i <= i) k++; B.path[i].zone = zm[k] ? zm[k].zone : 'ground' } }
  const P = B.path, wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 2)], c = P[Math.min(P.length - 1, i + 2)]
    let k = Math.abs(P[i].curv || 0)
    if (a.p && c.p && a.yaw != null && c.yaw != null && a.kind !== 'jump' && c.kind !== 'jump' && !a.br === !c.br && a.br === c.br) { const ds = Math.hypot(c.p[0] - a.p[0], c.p[2] - a.p[2]); if (ds > 0.5) k = Math.max(k, Math.abs(wrapA(c.yaw - a.yaw)) / ds) }
    P[i].kap = k
  }
  return { ...o, towers: [], pillars: [], torches: B.torches, tuts: B.tuts, plats: B.plats || [], props: B.props || [], lavaY: B.lavaY, lavaKill: B.lavaKill, marks: B.marks || [], winds: B.winds || [], risers: [], doors: B.doors || [], hazards: B.hazards || [], waters: B.waters || [], flags: B.flags || [], forks: B.forks || [], shapes: B.shapes, cps, path: B.path, signs: B.signs, decor: B.decor, notes: B.notes, cans: B.cans || [], spawn: { p: sp.p, yaw: sp.yaw } }
}

// ------------------------------------------------------------ 2 ウィリーでしか渡れない溝
// 今の位置から、道を横切る溝を n 本。溝の幅は前輪がちょうど落ちる幅（sw=0.66）。前輪で入ると溝の向こうの角に当たって止まる（前へつんのめる）。
// 前輪を上げたまま（ウィリー）、後輪だけで溝を越える。後輪は駆動しているので、溝に落ちても向こうの角をよじ登れる。
// 速さが出せない所に置く（高い縁を登った直後: o.hang=1.6 で手前に縁を作る / 坂の途中: o.slope）。o.slip で油の浮いた面（歩く人はすべる）
// o: { n=5（o.long で 9）, sw=0.66, depth=0.3, lip=0.16（向こうの縁の帯の高さ）, land=0.62（溝の間の板）, w=3.2, slope=0, hang=0, mat='grate', mu, lead=2.0（縁があれば 2.4。入口から最初の溝まで） }
// 道の点: 'groove'（溝の手前の点に groove: { sw }）。B.t は最後の溝の先 o.after（1.5m）
export function wheelieGrooves(B, o = {}) {
  const w = o.w ?? 3.2, n = o.n ?? (o.long ? 9 : 5), sw = o.sw ?? 0.66, lipH = o.lip ?? (o.slope ? 0.1 : 0.16), vg = o.vg ?? (o.slope ? 4.5 : 3.7), depth = o.depth ?? 0.3, land = o.land ?? 0.62, slope = o.slope ?? 0, mat = o.mat || 'grate'
  if (o.hang) B.hangLedge(o.hang, 0.01, { w, mat: o.ledgeMat || 'cobble', max: o.hangMax ?? 10 }) // 手前の高い縁（前輪を掛けて登る）。上の道は溝の板が続ける
  const t = B.t, f = B.dir(t.yaw, slope), fl = B.dir(t.yaw), up = B.upv(t.yaw, slope)
  const thick = o.thick ?? 0.5, i0 = B.path.length
  const plank = (len, kind) => { const s = B.road(len, { w, slope, mat, mu: o.mu, thick, back: 0, noOverlap: true, kind }); return s }
  plank(o.lead ?? (o.hang ? 2.4 : 2.0), 'groove')
  const pits = []
  for (let k = 0; k < n; k++) {
    const p0 = t.p.slice()
    B.path.push({ p: p0, yaw: t.yaw, slope, w: 0, kind: 'groove', groove: { sw, k, n, vg, slope }, len: sw })
    // 溝の底（深さ 0.55。暗い穴。当たりあり。前輪が底に着く前に溝の両側の角で止まる）
    const pc = add3(add3(p0, f, sw / 2), up, -depth - 0.1)
    pits.push(B.box({ c: pc, h: [sw / 2 + 0.02, 0.1, w / 2], yaw: t.yaw, pitch: slope, mat: 'iron', tag: 'pit' }))
    t.p = add3(t.p, f, sw); B.last = null
    if (lipH > 0) { const lc = add3(add3(t.p, f, 0.08), up, lipH / 2 - 0.05); B.box({ c: lc, h: [0.08, lipH / 2 + 0.05, w / 2], yaw: t.yaw, pitch: slope, mat: 'edgesteel', tag: 'lip' }) } // 溝の向こうの縁の鉄の帯（少し高い。前輪が落ちると当たる）
    plank(k === n - 1 ? (o.after ?? 1.5) : land, 'groove')
  }
  for (let k = i0; k < B.path.length; k++) B.path[k].grooveRun = { i0, n, sw, vg, slope }
  B.last = null
  return pits
}

// ------------------------------------------------------------ 3 揺れる鎖の吊り橋
// 今の位置から len の切れ目に、鎖で吊った板の橋。板は 1 枚ずつ動く床（mov 'wave'）で、乗っているバイクを運ぶ。
//  ・重さで沈む（バイクの下が少し沈んで、いつも少し登り）・速さで波打つ（速いほど大きく波打ち、波の山から跳ね上げられて横へ落ちる）
//  ・乗っている時間がたつほど横揺れが大きくなる（遅いと、揺れに投げ出されて横へ落ちる）。o.wind で突風（揺れが急に大きくなり、横から押される）
// o: { w=2.4, sag=0.45, A0=0.12, grow=0.24（1 秒ごとの横揺れの増え）, tJolt=len/6.5（この秒数より長く乗っていると大きくあおられて投げ出される＝平均 6.5m/s より遅いと渡れない）, Amax=1.4, T=1.8（横揺れの周期）, wa=0.026（速さ 1m/s ごとの波の高さ）, wind=false }
// 道の点: 'swing'（swing: { vMin, vMax } ちょうどよい速さ）。B.t は橋の向こうの端（同じ高さ）
export function swingBridge(B, len, o = {}) {
  const t = B.t, f = B.dir(t.yaw), R = B.right(t.yaw), W = o.w ?? 2.4, n = Math.max(6, Math.round(len / 0.55)), pl = len / n
  const br = { p0: t.p.slice(), f, R, L: len, W, sag: o.sag ?? 0.45, dip: o.dip ?? 0.28, lam: 2.2, wa: o.wa ?? 0.16, v0w: o.v0w ?? 7.2, swv: o.swv ?? 0.24, waMax: 0.4, k: 2 * Math.PI / (o.waveLen ?? 5), om: 2 * Math.PI / 1.3,
    A0: o.A0 ?? 0.12, grow: o.grow ?? 0.24, tJolt: o.tJolt ?? len / 6.5, Amax: o.Amax ?? 1.4, oms: 2 * Math.PI / (o.T ?? 1.8), ph: o.ph || 0, rollK: 0.16, tOn: null, sb: 0, vs: 0, dw: 0, planks: [] }
  if (o.wind) { br.gust = { w: 2 * Math.PI / (o.windT ?? 7.5), ph: o.windPh || 0 }; br.windA = o.windA ?? 0.32 }
  for (let i = 0; i < n; i++) {
    const s0 = (i + 0.5) * pl, c = add3(add3(t.p, f, s0), UP, -br.sag * Math.sin(Math.PI * s0 / len) - 0.09)
    const sh = B.box({ c, h: [pl / 2 - 0.03, 0.09, W / 2], yaw: t.yaw, mat: i % 7 === 3 ? 'plankold' : 'bridgeplank', mu: o.mu ?? 1.0, tag: 'road', mov: { type: 'wave', br, s: s0, ext: [br.Amax + 1, 1.6, br.Amax + 1] } })
    br.planks.push(sh)
  }
  // 両端の柱（当たりあり）と、柱の上の横木
  for (const s0 of [0, len]) { for (const sg of [-1, 1]) { const q = add3(add3(t.p, f, s0), R, sg * (W / 2 + 1.0)); B.cyl({ a: add3(q, UP, -1.4), b: add3(q, UP, 2.6), r: 0.18, mat: 'beam', tag: 'post' }) } }
  B.decor.push({ kind: 'swingBridge', br })
  const vMin = o.vMin ?? 6.6, vMax = o.vMax ?? 8.6
  for (let d = 0; d < len; d += 1) B.path.push({ p: add3(add3(t.p, f, d), UP, -br.sag * Math.sin(Math.PI * d / len)), yaw: t.yaw, slope: 0, w: W, kind: 'swing', swing: { vMin, vMax, br } })
  if (o.wind) B.gust(len, { sgn: o.windSgn ?? 1, a: o.windF ?? 1.8, T: o.windT ?? 7.5, ph: o.windPh || 0, w: W, vGo: (vMin + vMax) / 2 })
  t.p = add3(t.p, f, len); B.last = null
  return br
}

// ------------------------------------------------------------ 4 倒れていく煙突を全開で駆け上がる
// 今の位置（助走路の終わり）を根もとに、倒れかけた工場の煙突（四角いれんがの柱）が a0 の角度で斜めに架かる。
// 乗ると根もとを軸に倒れ始め（落ちる物と同じに加速して tFall 秒で寝る）、上の端がどんどん下がる。
// 全開＋ニトロで駆け上がり、上の端から向こうの足場（land m）へ跳ぶ。遅いと上の端が下がって届かない。降りて back 秒で元に戻る（時刻 0 でも）。
// 助走路の後ろ o.nitroRun m の道の点に nitro: true を付ける（上手い bot がニトロを使う）。手前に燃料の缶は呼ぶ側で B.can を置く
// o: { lead=3（根もとの瓦礫の坂 18 度）, L=16, ang=38（度）, w=2.6, thick=2.4, tFall=3.4, gap=2.6, dy=-0.6（足場の高さ。煙突の上の端から）, land=12, mu=0.8, back=2.5, nitroRun=24 }
// 道の点: 'chimney'（nitro）、上の端 'jump'（vJump）、足場 'landing'。B.t は足場の終わり
export function chimney(B, o = {}) {
  const t = B.t, yaw = t.yaw, a0 = (o.ang ?? 38) * DEG, L = o.L ?? 16, W = o.w ?? 2.6, T = o.thick ?? 2.4
  const fS = B.dir(yaw, a0), uS = B.upv(yaw, a0), f = B.dir(yaw), R = B.right(yaw)
  for (let k = B.path.length - 1, d = 0; k >= 0 && d < (o.nitroRun ?? 24); k--) { const q = B.path[k]; if (!q.p) break; q.nitro = true; if (k > 0 && B.path[k - 1].p) d += Math.hypot(q.p[0] - B.path[k - 1].p[0], q.p[2] - B.path[k - 1].p[2]) }
  if ((o.lead ?? 3) > 0) B.road(o.lead ?? 3, { w: W + 0.8, slope: (o.leadAng ?? 18) * DEG, mat: 'rockdark', thick: 1.2, back: 0, kind: 'ramp', nitro: true }) // 根もとの瓦礫の坂（平らな所から急に 38 度にしない）
  B.path.slice(-Math.ceil(o.lead ?? 3)).forEach(q => { q.nitro = true })
  const hinge = t.p.slice()
  const c = add3(add3(hinge, fS, L / 2), uS, -T / 2)
  const m = { type: 'topple', hinge, right: R, a0, aEnd: (o.aEnd ?? 3) * DEG, tFall: o.tFall ?? 3.4, rise: o.rise ?? 2.5, back: o.back ?? 2.5, trig: null, ext: [L + 2, L + 2, L + 2] }
  const sh = B.box({ c, h: [L / 2, T / 2, W / 2], yaw, pitch: a0, mat: o.mat || 'ruinwall', mu: o.mu ?? 0.8, tag: 'road', mov: m })
  B.decor.push({ kind: 'chimney', shape: sh, L, W, T })
  for (let d = 0; d < L - 0.01; d += 1) B.path.push({ p: add3(hinge, fS, d), yaw, slope: a0, w: W, kind: 'chimney', nitro: true, chimney: { m, shape: sh } })
  const top = add3(hinge, fS, L), gap = o.gap ?? 2.6, dy = o.dy ?? -0.6
  B.path.push({ p: top.slice(), yaw, slope: a0, w: 0, kind: 'jump', len: gap, dy, vJump: o.vJump ?? 12, nitro: true })
  // 根もとの瓦礫（当たりあり。煙突の下。道より低い）と、倒れる先の空き
  B.box({ c: add3(add3(hinge, f, 1.6), UP, -1.8), h: [1.8, 1.2, W / 2 + 0.6], yaw: yaw + 0.15, mat: 'rockdark', tag: 'rubble' })
  t.p = add3(add3(top, f, gap), UP, dy); B.last = null
  B.road(o.land ?? 12, { w: o.landW ?? 4, mat: o.landMat || 'grate', thick: 0.8, back: 0, kind: 'landing' })
  B.last = null
  return sh
}

// ------------------------------------------------------------ 5 踏むと跳ね上がる板
// 今の位置から、道と同じ高さの板（バネ仕掛け）。後輪が板の奥まで乗ると、板が跳ね上がって（mov 'kick'）バイクを上へ放り出す。
// 入った速さが速いほど強く跳ねる（高く・遠く）。向こうの高い所に、下りの着地坂（ang 度）。空中で車体の傾きを坂に合わせないと、着いた瞬間に弾かれて転ぶ（landTol）。
// 跳びすぎると坂の上の鉄骨の梁に頭を打つ。弱いと坂の裏に当たって落ちる。
// o: { len=3.8（板の長さ）, w=3, gap=3.2（板の先から坂の上の端まで）, rise=2.4（坂の上の端の高さ）, ang=30, rampLen=9, tol=20（度）, k0=3.6, kv=0.45（跳ね上がる速さ = k0 + kv×入る速さ）, v=7.4（上手い bot の入る速さ。6〜9 で届く）, beam=true }
// 道の点: 'kick'、跳ぶ所 'jump'（vJump・vMax）、着地坂 'landing'（landTol）。B.t は坂の下の平らな道（o.after m）の終わり
export function springPlank(B, o = {}) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), Lp = o.len ?? 3.8, W = o.w ?? 3
  const start = t.p.slice()
  const m = { type: 'kick', axis: UP, stroke: o.stroke ?? 0.6, k0: o.k0 ?? 3.6, kv: o.kv ?? 0.45, vmax: 13, hold: 0.7, back: 1.0, trigAt: o.trigAt ?? 1.5, start, f, ext: [0.2, 1.2, 0.2], trig: null }
  const sh = B.box({ c: add3(add3(start, f, Lp / 2), UP, -0.12), h: [Lp / 2 - 0.015, 0.12, W / 2], yaw, mat: 'plank', mu: 1.05, tag: 'road', mov: m })
  // 板の下の穴（バネが見える。当たりあり。板より 0.75 下）と両脇の枠
  B.box({ c: add3(add3(start, f, Lp / 2), UP, -0.95), h: [Lp / 2, 0.1, W / 2], yaw, mat: 'iron', tag: 'pit' })
  for (const sg of [-1, 1]) B.box({ c: add3(add3(add3(start, f, Lp / 2), R, sg * (W / 2 + 0.18)), UP, -0.35), h: [Lp / 2 + 0.2, 0.42, 0.16], yaw, mat: 'girder', tag: 'post' })
  B.decor.push({ kind: 'kick', shape: sh, Lp, W })
  for (let d = 0; d < Lp - 0.01; d += 0.5) B.path.push({ p: add3(start, f, d), yaw, slope: 0, w: W, kind: 'kick', kick: { m, shape: sh } })
  const ang = (o.ang ?? 30) * DEG, gap = o.gap ?? 3.2, rise = o.rise ?? 2.4, rl = o.rampLen ?? 9, g = 9.81
  const lip = add3(start, f, Lp)
  // 要る速さ（板の上で）: 跳ね上がりの速さ vy = k0 + kv v、坂の上の端を越える
  const reach = v => { const vy = Math.min(13, m.k0 + m.kv * v), tt = (vy + Math.sqrt(Math.max(0, vy * vy - 2 * g * (rise - 0.3)))) / g; return v * tt }
  let vJ = 3; while (vJ < 14 && reach(vJ) < gap + 0.8) vJ += 0.1
  let vM = vJ; while (vM < 16 && reach(vM) < gap + rl * dcos(ang) - 0.5) vM += 0.1
  B.path.push({ p: lip.slice(), yaw, slope: 0, w: 0, kind: 'jump', len: gap, dy: rise, vJump: o.v ?? 7.4, vMax: o.vMax ?? 9, vMinCalc: +vJ.toFixed(1), vMaxCalc: +vM.toFixed(1), kickJump: true })
  const top = add3(add3(lip, f, gap), UP, rise)
  t.p = top; B.last = null
  const ramp = B.road(rl, { w: o.rampW ?? 4, slope: -ang, mat: o.rampMat || 'plank', thick: 0.7, back: 0, kind: 'landing' })
  ramp.landTol = (o.tol ?? 20) * DEG
  for (let k = B.path.length - Math.ceil(rl); k < B.path.length; k++) B.path[k].landTol = ramp.landTol
  // 坂の上の端の上の鉄骨の梁（跳びすぎると頭を打つ）。柱は坂の幅の外
  if (o.beam !== false) { const bh = o.beamH ?? 3.4, bc = add3(add3(top, f, o.beamAt ?? 2.0), UP, bh + 0.3); B.box({ c: bc, h: [0.3, 0.3, (o.rampW ?? 4) / 2 + 0.6], yaw, mat: 'girder', tag: 'ceiling' }); for (const sg of [-1, 1]) { const q = add3(add3(top, f, o.beamAt ?? 2.0), R, sg * ((o.rampW ?? 4) / 2 + 0.75)); B.cyl({ a: add3(q, UP, -1.5), b: add3(q, UP, bh + 0.6), r: 0.2, mat: 'girder', tag: 'post' }) } }
  // 坂の下の柱（坂を支える。坂の下）
  B.road(o.after ?? 5, { w: o.rampW ?? 4, mat: o.rampMat || 'plank', thick: 0.7, kind: 'landing' })
  B.last = null
  return sh
}

// ------------------------------------------------------------ 6 道を選ぶ横に動く床
// 今の位置（入口の道の終わり、向き B.t.yaw）の先の長さ gap の切れ目に、横（-amp..+amp）へ往復する床。端で dwell 秒止まり、真ん中は動きながら通る。
// 真ん中を通る時に乗り、床に運ばれて、左の端で前へ降りれば左の道・右の端なら右の道。
// 返り: { L: {p, yaw}, R: {p, yaw} } = 切れ目の向こうの、左右の出口の道の始まり（上面の中心）。B.t は o.main（'L' / 'R'）側の出口の始まり（本線はそちらへ続ける）
// もう一方の道は forkBranch(B, その出口) で作る別の Builder に作り、forkJoin(B, S, 合流する本線の点の番号) で枝道として登録する
// o: { gap=5, amp=6, pw=4（床の幅）, w=3（入口の道の幅）, dwell=2.6, move=5.6, ph=0, main='L' }
// 道の点: 'fork'（入口から床の真ん中まで。fork: 仕掛けの情報）、'forkRide'（床の真ん中から出口の側の端まで。運ばれる間）
export function forkPlatform(B, o = {}) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), gap = o.gap ?? 5, amp = o.amp ?? 6, pw = o.pw ?? 4, main = o.main || 'L'
  const p0 = t.p.slice(), mid = add3(p0, f, gap / 2)
  const m = { type: 'shuttle', axis: R, amp, dwell: o.dwell ?? 2.6, move: o.move ?? 5.6, ta: 0.9, ph: o.ph || 0, ext: [amp + 1, 0.6, amp + 1] }
  const sh = B.box({ c: add3(mid, UP, -0.2), h: [gap / 2 - 0.1, 0.2, pw / 2], yaw, mat: 'liftdeck', mu: 1.05, tag: 'road', mov: m })
  const exits = { L: { p: add3(add3(p0, f, gap), R, -amp), yaw }, R: { p: add3(add3(p0, f, gap), R, amp), yaw } }
  const fork = { p0, yaw, gap, amp, pw, main, shape: sh, mov: m, exits, mid, i0: B.path.length, branchPath: null }
  B.forks = B.forks || []; B.forks.push(fork)
  // 下のレール（横に動く範囲）と、両端の止め金具（見た目だけ。床より下）
  B.decor.push({ kind: 'rail', a: add3(add3(mid, R, -amp - pw / 2), UP, -0.55), b: add3(add3(mid, R, amp + pw / 2), UP, -0.55) })
  B.decor.push({ kind: 'forkPlat', fork })
  for (let d = 0.5; d <= gap / 2 + 0.01; d += 1) B.path.push({ p: add3(p0, f, d), yaw, slope: 0, w: Math.min(o.w ?? 3, pw), kind: 'fork', fork })
  const ride = (sg, arr) => { for (let l = 1.5; l < amp + 0.01; l += 1.5) arr.push({ p: add3(mid, R, sg * l), yaw, slope: 0, w: pw, kind: 'forkRide', fork, side: sg < 0 ? 'L' : 'R' }) }
  ride(main === 'L' ? -1 : 1, B.path)
  fork.iMainExit = B.path.length
  t.p = exits[main].p.slice(); B.last = null
  return exits
}
// 枝道を作る Builder（形・松明・飾り・危ない物の一覧は本線と同じ物を使い、道の点だけ別）。start が分かれ道の出口なら、床の上の点も先に入れる
export function forkBranch(B, start) {
  const S = new Builder(start.p.slice(), start.yaw)
  for (const k of ['shapes', 'winds', 'signs', 'decor', 'notes', 'torches', 'tuts', 'hazards', 'waters', 'flags', 'risers', 'plats', 'props']) if (B[k]) S[k] = B[k]
  S.cps = []; S.path = []; S.zone = B.zone; S.base = B.base; S.solid = false; S.cans = B.cans = B.cans || []; S.doors = B.doors = B.doors || []; S.marks = []
  S.zoneMarks = [] // 枝道の区間は本線の点の番号で決まるので、ここでは使わない
  for (const fk of B.forks || []) for (const side of ['L', 'R']) {
    const e = fk.exits[side]; if (side === fk.main || Math.hypot(e.p[0] - start.p[0], e.p[2] - start.p[2]) > 0.3) continue
    const sg = side === 'L' ? -1 : 1
    for (let l = 1.5; l < fk.amp + 0.01; l += 1.5) S.path.push({ p: add3(fk.mid, B.right(fk.yaw), sg * l), yaw: fk.yaw, slope: 0, w: fk.pw, kind: 'forkRide', fork: fk, side })
    fk.branchPath = S.path; fk.branchSide = side
  }
  return S
}
// 枝道を登録する: 点に branch: true と枝の番号 br を付け、最後の点に nx（合流する本線の点の番号）を付けて、B.branches に入れる（道の線の一番最後に足される）
export function forkJoin(B, S, mergeIndex) {
  B.branches = B.branches || []
  const id = B.branches.length + 1
  for (const q of S.path) { q.branch = true; q.br = id }
  if (S.path.length) S.path[S.path.length - 1].nx = mergeIndex
  if (S.marks && S.marks.length) { B.marks = B.marks || []; for (const mk of S.marks) B.marks.push({ ...mk, branchOf: S.path }) }
  B.branches.push(S.path)
  return S.path
}

// ============================================================ 試しのコース（v16 の仕掛けを 1 つずつ。間に休憩所の旗）
export function lab16() {
  const B = new Builder([0, 20, 0], 0)
  B.plats = []; B.props = []
  B.zone = 'factory'
  const G = { w: 4, mat: 'grate', thick: 0.8 }
  B.road(18, G); B.cp('試しの入口', { w: 4, rest: true })
  B.torch(-1, -2, { w: 4 }); B.torch(1, -2, { w: 4 })
  // 1 回る歯車
  B.mark('回る歯車'); B.road(18, G)
  gearRun(B, {})
  B.road(6, G); B.cp('歯車の先', { w: 4, rest: true })
  // 2 ウィリーの溝（高い縁の上）
  B.road(8, G); B.mark('ウィリーの溝'); B.road(3, G)
  wheelieGrooves(B, { hang: 1.6, w: 4 })
  B.road(6, G); B.cp('溝の先', { w: 4, rest: true })
  // 2b 坂の途中の長い溝（油の浮いた登り）
  B.road(8, G); B.mark('坂の長い溝'); B.road(3, G)
  wheelieGrooves(B, { slope: 0.16, n: 7, w: 4, mat: 'rust', hang: 1.6 })
  B.road(6, G); B.cp('坂の溝の先', { w: 4, rest: true })
  // 3 揺れる鎖の吊り橋
  B.mark('揺れる吊り橋'); B.road(16, G)
  swingBridge(B, 22, {})
  B.road(6, G); B.cp('吊り橋の先', { w: 4, rest: true })
  // 3b 風の吊り橋
  B.mark('風の吊り橋'); B.road(16, G)
  swingBridge(B, 22, { wind: true, windSgn: 1 })
  B.road(6, G); B.cp('風の橋の先', { w: 4, rest: true })
  // 4 倒れる煙突（手前に燃料の缶）
  B.road(6, G); B.can(3); B.road(6, G); B.mark('倒れる煙突'); B.road(26, G)
  chimney(B, {})
  B.road(4, G); B.cp('煙突の先', { w: 4, rest: true })
  // 5 跳ね板
  B.road(12, G); B.mark('跳ね板'); B.road(10, G)
  springPlank(B, {})
  B.road(6, G); B.cp('跳ね板の先', { w: 4, rest: true })
  // 6 道を選ぶ床: 左は 0.7m の段 → 急な坂、右は 3m の切れ目。先の広場で合流
  B.mark('道を選ぶ床'); B.road(10, { ...G, w: 3 })
  const ex = forkPlatform(B, { main: 'L', w: 3 })
  // 左（本線）
  B.step(0.7); B.road(8, { w: 3, mat: 'grate', thick: 1.5, noOverlap: true }); B.road(4.5, { w: 3, mat: 'rust', slope: 36 * DEG, thick: 1.2, kind: 'steep' }); B.road(5, { w: 3, mat: 'grate', thick: 1.2 })
  const yL = B.t.p[1], fL = B.dir(B.t.yaw), alongL = (B.t.p[0] - ex.L.p[0]) * fL[0] + (B.t.p[2] - ex.L.p[2]) * fL[2]
  // 右（枝道）: 2.4m の切れ目を跳ぶ → 急な坂 → 登り
  const S = forkBranch(B, ex.R)
  S.gap(2.4, -0.4, 'jump'); S.path[S.path.length - 1].vJump = 6.8
  S.road(5, { w: 3, mat: 'grate', thick: 0.8, back: 0 })
  S.road(4.5, { w: 3, mat: 'rust', slope: 36 * DEG, thick: 1.2, kind: 'steep' })
  { const ls = alongL - 2.4 - 5 - 4.5 * Math.cos(36 * DEG); S.road(ls, { w: 3, mat: 'grate', thick: 0.8, slope: Math.atan2(yL - S.t.p[1], ls) }) }
  // 合流の広場（左右の道の線をどちらも含む）
  const f = B.dir(B.t.yaw), Rv = B.right(B.t.yaw)
  const plazaC = add3(add3(B.t.p, f, 12), Rv, 6)
  B.box({ c: [plazaC[0], yL - 0.6, plazaC[2]], h: [12, 0.6, 9.5], yaw: B.t.yaw, mat: 'cobble', tag: 'pad' })
  // 右の道の続き: 広場の上を斜めに、左の道の線へ寄せる（14m で 12m 寄る）
  const dyaw = Math.atan2(12, 14)
  for (let d = 0.5; d < 14; d += 1) S.path.push({ p: add3(add3(B.t.p, f, d), Rv, 12 * (1 - d / 14)), yaw: B.t.yaw + dyaw, slope: 0, w: 6, kind: 'pad' })
  const mergeI = B.path.length + 16
  forkJoin(B, S, mergeI)
  for (let d = 0; d < 24; d += 1) B.path.push({ p: add3(B.t.p, f, d), yaw: B.t.yaw, slope: 0, w: 6, kind: 'pad' })
  B.t.p = add3(B.t.p, f, 24); B.last = null
  B.road(10, G); B.cp('合流の広場の先', { w: 4, rest: true })
  B.road(8, G); B.cp('試しの出口', { w: 4, finish: true }); B.road(10, G)
  return finish16(B, { id: 'lab16', name: 'v16 の仕掛けの試し', killBelow: 12, spawnBack: 2, climb: true })
}
