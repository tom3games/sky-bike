// コースの元データ。ここで作る形の一覧から、見た目のメッシュと物理の当たりを両方作る（同じデータ）。
import * as Z from './zones.js?v=47'
import * as P16 from './parts16.js?v=47'
import { makeWorldX, addSupports, makeFork } from './world.js?v=47'
import { lab16 } from './parts16.js?v=47'
import * as P17 from './parts17.js?v=47'
import { finale } from './finale.js?v=47'
import { v36traps } from './traps.js?v=47'
import { makeBox, makeCyl, makeArc, makeSph, dsin, dcos, datan2, pendState, hingeAng, dropState, gustK, liftPos } from './physics.js?v=47'

const DEG = Math.PI / 180
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

export class Builder {
  constructor(start = [0, 0, 0], yaw = 0) {
    this.shapes = []; this.winds = []; this.cps = []; this.path = []; this.signs = []; this.decor = []; this.notes = []; this.torches = []; this.tuts = []; this.hazards = []; this.waters = []; this.flags = []; this.risers = []
    this.t = { p: start.slice(), yaw }
    this.last = null // 直前の道（同じ向き・同じ傾きなら重ねてつなぐ）
    // 区間（景色）の切り替わりを道の点の番号で覚える（明るさ・霧・音を区間ごとに変えるため）
    this.zoneMarks = []
    Object.defineProperty(this, 'zone', { get() { return this._zone }, set(z) { this._zone = z; this.zoneMarks.push({ i: this.path.length, zone: z }) } })
    this.zone = 'ground'
    this.base = -0.6 // solid の道は、この高さまで詰める
  }
  dir(yaw, slope = 0) { return [dcos(yaw) * dcos(slope), dsin(slope), -dsin(yaw) * dcos(slope)] }
  upv(yaw, slope = 0) { return [-dcos(yaw) * dsin(slope), dcos(slope), dsin(yaw) * dsin(slope)] }
  right(yaw) { return [dsin(yaw), 0, dcos(yaw)] }
  box(o) { const s = makeBox(o); s.zone = o.zone || this.zone; this.shapes.push(s); return s }
  cyl(o) { const s = makeCyl(o); if (o.mov) s.mov = o.mov; s.zone = o.zone || this.zone; this.shapes.push(s); return s }
  arc(o) { const s = makeArc(o); s.zone = o.zone || this.zone; this.shapes.push(s); return s }

  // 道: 今の位置（上面の中心）から len 進む。slope は上り（ラジアン）。thick は板の厚さ
  road(len, o = {}) {
    const slope = o.slope || 0, w = o.w ?? 3.2, t = this.t
    let thick = o.thick ?? 1.2
    if (this.solid) { const yTop = Math.max(t.p[1], t.p[1] + len * dsin(slope)); thick = Math.max(thick, (yTop - this.base) / dcos(slope)) }
    const f = this.dir(t.yaw, slope), up = this.upv(t.yaw, slope)
    const same = this.last && this.last.slope === slope && this.last.yaw === t.yaw && this.last.w >= w && !o.noOverlap
    // 谷になる継ぎ目（傾きが上向きに変わる）は、後の板を前の板の下へ少し差し込む。継ぎ目のすき間（くさび）を作らない
    const valley = this.last && this.last.yaw === t.yaw && slope > this.last.slope + 1e-6 && !o.noOverlap
    const back = o.back ?? (same ? 0.6 : valley ? 0.8 : 0)
    const mid = add3(t.p, f, (len - back) / 2)
    const c = add3(mid, up, -thick / 2)
    const s = this.box({ c, h: [(len + back) / 2, thick / 2, w / 2], yaw: t.yaw, pitch: slope, roll: o.roll || 0, mat: o.mat || 'dirt', mu: o.mu, tag: 'road' })
    for (let d = 0; d < len; d += 1) this.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope, w, kind: o.kind || 'road', speed: o.speed })
    if (this.pendingDoor) { const k = Math.min(this.path.length - 1, this.pendingDoor.i + Math.max(0, Math.round(this.pendingDoor.at) - 1)); this.path[k].door = this.pendingDoor.v; this.pendingDoor = null }
    t.p = add3(t.p, f, len)
    this.last = { slope, yaw: t.yaw, w }
    return s
  }
  // 四角い踊り場。今の位置から size の板を置き、真ん中で向きを変える
  pad(size, turn = 0, o = {}) {
    const t = this.t, f = this.dir(t.yaw)
    let thick = o.thick ?? 1.2
    if (this.solid) thick = Math.max(thick, t.p[1] - this.base)
    const back = 0.6, c0 = add3(t.p, f, size / 2 - back)
    this.box({ c: [c0[0], c0[1] - thick / 2, c0[2]], h: [size / 2, thick / 2, (o.wide ?? size) / 2], yaw: t.yaw, mat: o.mat || 'stone', mu: o.mu, tag: 'pad' })
    for (let d = 0; d < size / 2 - back; d += 1) this.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope: 0, w: size, kind: 'pad' })
    t.p = c0; t.yaw += turn
    this.last = null
  }
  gap(len, dy = 0, kind = 'gap') {
    const t = this.t, f = this.dir(t.yaw)
    this.path.push({ p: t.p.slice(), yaw: t.yaw, slope: 0, w: 0, kind, len, dy })
    t.p = add3(t.p, f, len); t.p[1] += dy; this.last = null
  }
  step(dy) { this.t.p[1] += dy; this.last = null; this.path.push({ p: this.t.p.slice(), yaw: this.t.yaw, slope: 0, w: 0, kind: dy > 0 ? 'stepUp' : 'stepDown', dy }) }
  // 道の上に丸太（横向きの円柱）を寝かせる。今の位置から at 進んだ所
  log(at, r, w = 3.2, mat = 'log') {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw)
    const c = add3(add3(t.p, f, at), [0, 1, 0], r)
    this.cyl({ a: add3(c, R, -w / 2 + 0.1), b: add3(c, R, w / 2 - 0.1), r, mat, mu: 0.9, tag: 'log' })
    // bot 用: 丸太の手前で少し速さを落とす印
    const at0 = add3(t.p, f, at)
    let k = this.path.length; this.path.push({ p: at0, yaw: t.yaw, slope: 0, w, kind: 'bump', dy: r * 2 })
  }
  // v36 取った丸太の代わりの道の点（道の点の数と並びを変えない）
  logGone(at) { const t = this.t, f = this.dir(t.yaw); this.path.push({ p: add3(t.p, f, at), yaw: t.yaw, slope: 0, w: 3.2, kind: 'road' }) }
  // v36 段の手前の小さな坂（道の上に置く斜めの板。今の位置で高さ h になる）
  rampUp(h, len, o = {}) {
    const t = this.t, f = this.dir(t.yaw), ang = Math.atan2(h, len), L2 = Math.hypot(h, len), th = 0.3
    const fr = this.dir(t.yaw, ang), up = this.upv(t.yaw, ang), start = add3(t.p, f, -len)
    this.box({ c: add3(add3(start, fr, L2 / 2), up, -th / 2), h: [L2 / 2, th / 2, (o.w ?? 4) / 2], yaw: t.yaw, pitch: ang, mat: o.mat || 'cobble', mu: 1.0, tag: 'road' })
  }
  // ジャンプ台: 今の位置で lip が終わるように、手前に傾けた板を置く（道の上に乗る）
  kicker(len, ang, o = {}) {
    const t = this.t, f = this.dir(t.yaw), w = o.w ?? 2.6, thick = o.thick ?? 0.9
    const fr = this.dir(t.yaw, ang), up = this.upv(t.yaw, ang)
    const run = len * dcos(ang), rise = len * dsin(ang)
    const start = add3(t.p, f, -run)
    const mid = add3(start, fr, len / 2)
    this.box({ c: add3(mid, up, -thick / 2), h: [len / 2, thick / 2, w / 2], yaw: t.yaw, pitch: ang, mat: o.mat || 'wood', mu: 1.0, tag: 'kicker' }).launch = true
    this.path.push({ p: t.p.slice(), yaw: t.yaw, slope: ang, w, kind: 'lip', rise })
    return rise
  }
  cp(name, o = {}) {
    this.closeMark()
    const t = this.t, R = this.right(t.yaw), w = o.w ?? (this.last ? this.last.w : 3.2)
    const p = t.p.slice()
    this.cps.push({ p, yaw: t.yaw, w, name, zone: this.zone, finish: !!o.finish, rest: !!o.rest })
    if (o.noGate) return
    // 休憩所（セーブ）: 道の左に、色あせて黄ばんだ布の旗。通ると旗が少し明るくなる
    if (o.rest) {
      const base = add3(p, R, -(w / 2 + 0.45))
      this.cyl({ a: add3(base, [0, 1, 0], -1.6), b: add3(base, [0, 1, 0], 3.6), r: 0.07, mat: 'pole', tag: 'gate' })
      this.flags.push({ p: base, h: 3.6, yaw: t.yaw, cp: this.cps.length - 1 })
      return
    }
    // 門: 道の両脇に火鉢の柱（当たりあり）。火は柱の上
    const hgt = o.finish ? 3.2 : 1.25
    for (const sg of [-1, 1]) {
      const base = add3(p, R, sg * (w / 2 + 0.34))
      this.cyl({ a: add3(base, [0, 1, 0], -1.6), b: add3(base, [0, 1, 0], hgt), r: o.finish ? 0.3 : 0.24, mat: o.finish ? 'castle' : 'iron', tag: 'gate' })
      this.torches.push([base[0], base[1] + hgt + 0.3, base[2], 1])
    }
  }
  // 看板: 道の左の縁に立つ柱と、頭より高い板（どちらも当たりあり）。文字は板の面にぴったり重ねて描く
  sign(text, o = {}) {
    const t = this.t, R = this.right(t.yaw), f = this.dir(t.yaw), w = this.last ? this.last.w : 3.2
    const base = add3(add3(t.p, f, o.at ?? 2), R, -(w / 2 - 0.15))
    const top = 2.95
    this.cyl({ a: base, b: add3(base, [0, 1, 0], top), r: 0.06, mat: 'pole', tag: 'sign' })
    const yaw = t.yaw + 0.6 // 近づく人の方へ少し向ける
    const c = add3(add3(base, [0, 1, 0], 2.55), [dsin(yaw) * 0.5, 0, dcos(yaw) * 0.5])
    const s = this.box({ c, h: [0.04, 0.32, 0.95], yaw, mat: 'signboard', tag: 'sign' })
    this.signs.push({ text, shape: s })
  }
  // 曲がる道: 半径 R（道の中心）で ang だけ曲がる（正=左回り、負=右回り）。rise だけ上がる。形は arc（らせんの板）
  curve(R, ang, o = {}) {
    const t = this.t, w = o.w ?? 4, left = ang > 0, A = Math.abs(ang), rise = o.rise || 0
    const Rv = this.right(t.yaw), sg = left ? -1 : 1
    const c = [t.p[0] + Rv[0] * R * sg, 0, t.p[2] + Rv[2] * R * sg]
    const phS = left ? t.yaw - Math.PI / 2 : t.yaw + Math.PI / 2, phE = left ? phS + A : phS - A
    const yS = t.p[1], yE = yS + rise
    let thick = o.thick ?? 1.0
    if (this.solid) thick = Math.max(thick, Math.max(yS, yE) - this.base)
    let s = null
    if (!o.noShape) {
      const base = { cx: c[0], cz: c[2], r1: R - w / 2, r2: R + w / 2, thick, mat: o.mat || 'stone', mu: o.mu, tag: 'road' }
      s = left ? this.arc({ ...base, phi0: phS, phi1: phE, y0: yS, b: rise / A }) : this.arc({ ...base, phi0: phE, phi1: phS, y0: yE, b: -rise / A })
      if (o.side) s.side = o.side
    }
    const n = Math.max(2, Math.ceil(R * A))
    const slope = Math.atan2(rise, R * A)
    for (let k = 0; k < n; k++) { const u = k / n, ph = phS + (phE - phS) * u; this.path.push({ p: [c[0] + R * dcos(ph), yS + rise * u, c[2] - R * dsin(ph)], yaw: t.yaw + ang * u, slope, w: o.pw ?? w, kind: o.kind || 'curve', curv: (left ? 1 : -1) / R, vJump: o.vJump }) }
    if (this.pendingDoor) { const k = Math.min(this.path.length - 1, this.pendingDoor.i + Math.max(0, Math.round(this.pendingDoor.at) - 1)); this.path[k].door = this.pendingDoor.v; this.pendingDoor = null }
    t.p = [c[0] + R * dcos(phE), yE, c[2] - R * dsin(phE)]; t.yaw += ang; this.last = null
    return s
  }
  // 松明（道の横に立つ柱と火。柱は当たりあり、火は頭より高い所）。side: 1 右・-1 左、at: 何 m 先
  torch(side, at = 0, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), w = o.w ?? (this.last ? this.last.w : 4)
    const base = add3(add3(t.p, f, at), R, side * (w / 2 + 0.28))
    const h = o.h ?? 2.1
    this.cyl({ a: add3(base, [0, 1, 0], -(o.down ?? 0.9)), b: add3(base, [0, 1, 0], h), r: 0.11, mat: 'iron', tag: 'post' })
    this.torches.push([base[0], base[1] + h + 0.25, base[2]])
  }
  // 鎖の手すり: 道の点 i0..i1 に沿って、両脇に柱と鎖（どちらも当たりのある円柱）
  chainRails(i0, i1, w, every = 6.5) {
    const pts = []
    let acc = every
    for (let i = i0; i <= i1; i++) { const q = this.path[i]; if (!q || !q.p || !q.w || q.kind === 'jump') { acc = every * 0.6; continue } if (i > i0) acc += Math.hypot(q.p[0] - this.path[i - 1].p[0], q.p[2] - this.path[i - 1].p[2]); if (acc >= every || i === i1) { pts.push(q); acc = 0 } }
    for (const sg of [-1, 1]) {
      let prev = null
      for (const q of pts) {
        const R = this.right(q.yaw), b = add3(q.p, R, sg * (w / 2 + 0.12))
        this.cyl({ a: add3(b, [0, 1, 0], -0.45), b: add3(b, [0, 1, 0], 1.0), r: 0.07, mat: 'iron', tag: 'post' })
        const top = add3(b, [0, 1, 0], 0.92)
        if (prev) { this.cyl({ a: prev, b: top, r: 0.035, mat: 'chain', tag: 'rail' }); this.decor.push({ kind: 'chain', a: prev, b: top, sag: 0.0 }) }
        prev = top
      }
    }
  }
  tut(key) { this.tuts.push({ i: this.path.length, key }) }
  sph(o) { const s = makeSph(o); s.zone = o.zone || this.zone; this.shapes.push(s); return s }
  // 振り子の鉄球: 今の位置から at 進んだ所の上に支点。道を横切って振れる。当たると横へ弾き飛ばされる
  pendulum(at, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), w = o.w ?? (this.last ? this.last.w : 4)
    const base = add3(t.p, f, at), L = o.L ?? 5.5, r = o.r ?? 0.6
    const top = base[1] + 1.0 + L, reach = w / 2 + 2.6, amp = Math.asin(Math.min(0.92, reach / L))
    const m = { type: 'pend', pivot: [base[0], top, base[2]], across: R, L, amp, w: 2 * Math.PI / (o.T ?? 3.4), ph: o.ph || 0 }
    const ball = this.sph({ c: [base[0], top - L, base[2]], r, mat: 'iron', tag: 'ball', mov: m, knock: o.knock ?? 7 })
    // 支える梁（頭よりずっと上）と、振れる範囲の外の2本の柱
    const pw = reach + r + 0.9, ends = [-1, 1].map(sg => add3(base, R, sg * pw))
    for (const e of ends) this.cyl({ a: [e[0], e[1] - 2.5, e[2]], b: [e[0], top + 0.35, e[2]], r: 0.2, mat: 'iron', tag: 'post' })
    this.cyl({ a: [ends[0][0], top + 0.35, ends[0][2]], b: [ends[1][0], top + 0.35, ends[1][2]], r: 0.16, mat: 'iron', tag: 'post' })
    this.decor.push({ kind: 'pendChain', ball, pivot: m.pivot.slice() })
    const half = r + 0.3
    // 道が鉄球の振れる面と交わる区間で、鉄球が道の上にある間は危ない
    this.hazards.push({ kind: 'pend', p: base, yaw: t.yaw, half, w, m, ball, unsafe: tt => { const x = pendState(m, tt).x; return Math.abs(x) < w / 2 + r + 0.15 } })
    return ball
  }
  // 湧き水の流れが道を横切る区間: 面が横へ動く（立ち止まると流される）。sgn 1 で右へ、-1 で左へ流れる
  waterRun(len, o = {}) {
    const t = this.t, R = this.right(t.yaw), u = (o.u ?? 1.7) * (o.sgn ?? 1)
    const s = this.road(len, { ...o, mat: o.mat || 'wetstone', mu: o.mu ?? 0.7, kind: 'water', noOverlap: true })
    s.flow = [R[0] * u, 0, R[2] * u]
    for (let k = this.path.length - Math.ceil(len); k < this.path.length; k++) this.path[k].flowU = u
    const c = add3(add3(t.p, this.dir(t.yaw), -len / 2), [0, 1, 0], 0.03)
    this.waters.push({ c, yaw: t.yaw, len, w: o.w ?? (this.last ? this.last.w : 4), u, sgn: o.sgn ?? 1 })
    this.last = null
    return s
  }
  // 泥の登り坂: 車輪が沈んで重い。勢いをつけて入らないと止まる
  mudRun(len, slope, o = {}) {
    const s = this.road(len, { ...o, slope, mat: 'mud', mu: o.mu ?? 0.6, kind: 'mud', noOverlap: true })
    s.mud = o.mud ?? 240
    return s
  }
  // 跳ね橋: 今の位置から len の切れ目に板を渡す。向こう側の蝶番で手前が持ち上がる（上がっている間は渡れない）
  drawbridge(len, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), w = o.w ?? 3, th = 0.35
    const hinge = add3(add3(t.p, f, len), [0, 1, 0], -th / 2)
    const c = add3(add3(t.p, f, len / 2), [0, 1, 0], -th / 2)
    const m = { type: 'hinge', hinge, right: R, sgn: 1, up: -(o.up ?? 1.15), dwell: o.dwell ?? 2.4, move: o.move ?? 1.1, ph: o.ph || 0 }
    const sh = this.box({ c, h: [len / 2 + 0.02, th / 2, w / 2], yaw: t.yaw, mat: 'bridgeplank', mu: 1.0, tag: 'road', mov: m })
    this.path.push({ p: t.p.slice(), yaw: t.yaw, slope: 0, w: 0, kind: 'draw', len })
    for (let d = 1; d < len; d += 1) this.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope: 0, w, kind: 'draw' })
    this.hazards.push({ kind: 'draw', p: add3(t.p, f, len / 2), yaw: t.yaw, half: len / 2 + 0.9, w, m, shape: sh, unsafe: tt => hingeAng(m, tt).a < -0.04 })
    // 両脇の滑車の柱と鎖（見た目）
    for (const sg of [-1, 1]) { const b0 = add3(add3(t.p, f, len + 0.2), R, sg * (w / 2 + 0.35)); this.cyl({ a: [b0[0], b0[1] - 1, b0[2]], b: [b0[0], b0[1] + 3.2, b0[2]], r: 0.18, mat: 'iron', tag: 'post' }); this.decor.push({ kind: 'drawChain', top: [b0[0], b0[1] + 3.0, b0[2]], shape: sh, sg }) }
    t.p = add3(t.p, f, len); this.last = null
    return sh
  }
  // ---------------- v13 の仕掛け
  // シーソーの橋: 今の位置から len の切れ目に、真ん中で支えた板。手前が下がっている。ゆっくり乗ると重さで傾いて向こうへ下りる。
  // 速いと、上がったままの向こうの端から飛び出して、短い向こうの足場を越えて落ちる
  seesaw(len, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), w = o.w ?? 3, th = 0.3, a = o.ang ?? 0.2
    const pivot = add3(add3(t.p, f, len / 2), [0, 1, 0], (len / 2) * dsin(a) - th / 2)
    const m = { type: 'seesaw', pivot, right: R, ang0: a, ang: a, w: 0, min: -a, max: a, I: o.I ?? 1400, k: o.k ?? 260, damp: o.damp ?? 900 }
    const sh = this.box({ c: pivot.slice(), h: [len / 2, th / 2, w / 2], yaw: t.yaw, pitch: 0, mat: 'bridgeplank', mu: 1.0, tag: 'road', mov: m })
    // 支点の柱（板の下）
    this.cyl({ a: add3(pivot, [0, 1, 0], -6), b: add3(pivot, [0, 1, 0], -0.25), r: 0.28, mat: 'iron', tag: 'post' })
    this.path.push({ p: t.p.slice(), yaw: t.yaw, slope: a, w, kind: 'seesaw', len })
    for (let d = 1; d < len; d += 1) this.path.push({ p: add3(add3(t.p, f, d), [0, 1, 0], Math.min(d, len - d) * dsin(a)), yaw: t.yaw, slope: 0, w, kind: 'seesaw' })
    this.decor.push({ kind: 'seesaw', shape: sh })
    // 向こうの足場の上の低い梁: 上がったままの端から飛び出すと、頭を打つ（ゆっくり傾けて下りれば下を通れる）
    if (o.beam !== false) { const bc = add3(add3(t.p, f, len + 0.6), [0, 1, 0], 2.55); this.box({ c: bc, h: [0.35, 0.3, w / 2 + 0.5], yaw: t.yaw, mat: 'beam', tag: 'ceiling' }) }
    t.p = add3(t.p, f, len); this.last = null
    return sh
  }
  // 壊せる扉: 今の位置から at 進んだ所に、道をふさぐ朽ちた扉。breakV m/s 以上で体当たりすると壊れる（遅いと跳ね返る）。6 秒で元に戻る
  door(at, o = {}) {
    const t = this.t, f = this.dir(t.yaw), w = o.w ?? (this.last ? this.last.w : 4), hgt = o.h ?? 2.6
    const c = add3(add3(t.p, f, at), [0, 1, 0], hgt / 2 + 0.02)
    const sh = this.box({ c, h: [0.12, hgt / 2, w / 2 + 0.1], yaw: t.yaw, mat: o.mat || 'bridgeplank', mu: 0.8, tag: 'door', mov: { type: 'brk', back: o.back ?? 6 } })
    sh.breakV = o.breakV ?? 6.5
    // 枠（道の外。当たりあり）
    for (const sg of [-1, 1]) { const b0 = add3(add3(t.p, f, at), this.right(t.yaw), sg * (w / 2 + 0.3)); this.cyl({ a: [b0[0], b0[1] - 1, b0[2]], b: [b0[0], b0[1] + hgt + 0.4, b0[2]], r: 0.2, mat: 'iron', tag: 'post' }) }
    this.doors = this.doors || []; this.doors.push({ shape: sh, at: add3(t.p, f, at), breakV: sh.breakV })
    this.pendingDoor = { at, v: sh.breakV, i: this.path.length } // 次に作る道の、at の所の点に印を付ける
    return sh
  }
  // 動く床（前後・上下・横）。ax: 'fwd'（切れ目を前後に渡す）/'up'（上の段へ運ぶ）/'side'（切れ目の上を横切る）
  mover(kind, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), w = o.w ?? 3, L = o.size ?? 3
    if (kind === 'fwd') {
      // 切れ目 len を、L の床が手前の端（lo）と向こうの端（hi）の間を行き来する
      const len = o.len ?? 8, amp = (len - L) / 2, c = add3(add3(t.p, f, len / 2), [0, 1, 0], -0.2)
      const m = { type: 'lift', axis: f, amp, dwell: o.dwell ?? 1.8, move: o.move ?? 2.6, ph: o.ph || 0 }
      const sh = this.box({ c, h: [L / 2, 0.2, w / 2], yaw: t.yaw, mat: 'liftdeck', mu: 1.05, tag: 'road', mov: m })
      for (let d = 0; d < len; d += 1) this.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope: 0, w, kind: 'lift', lift: { mov: m, shape: sh }, start: t.p.slice(), len })
      this.decor.push({ kind: 'rail', a: add3(add3(t.p, [0, 1, 0], -0.45), R, -w / 2 - 0.1), b: add3(add3(add3(t.p, f, len), [0, 1, 0], -0.45), R, -w / 2 - 0.1) }, { kind: 'rail', a: add3(add3(t.p, [0, 1, 0], -0.45), R, w / 2 + 0.1), b: add3(add3(add3(t.p, f, len), [0, 1, 0], -0.45), R, w / 2 + 0.1) })
      t.p = add3(t.p, f, len); this.last = null
      return sh
    }
    if (kind === 'up') {
      // 上下する床: 今の位置の先 L の床が、下（今の高さ）と上（+rise）を行き来する。上で降りた先は、また高い段のこともある
      const rise = o.rise ?? 3, amp = rise / 2, c = add3(add3(t.p, f, L / 2 + 0.05), [0, 1, 0], -0.2 + amp)
      const m = { type: 'lift', axis: [0, 1, 0], amp, dwell: o.dwell ?? 2.0, move: o.move ?? 2.4, ph: o.ph || 0 }
      const sh = this.box({ c, h: [L / 2, 0.2, w / 2], yaw: t.yaw, mat: 'liftdeck', mu: 1.05, tag: 'road', mov: m })
      for (let d = 0; d < L; d += 1) this.path.push({ p: add3(add3(t.p, f, d), [0, 1, 0], d > L / 2 ? rise : 0), yaw: t.yaw, slope: 0, w, kind: 'lift', lift: { mov: m, shape: sh }, start: t.p.slice(), len: L, up: rise })
      for (const sg of [-1, 1]) { const b0 = add3(add3(t.p, f, L / 2), R, sg * (w / 2 + 0.35)); this.cyl({ a: [b0[0], b0[1] - 2, b0[2]], b: [b0[0], b0[1] + rise + 2.6, b0[2]], r: 0.14, mat: 'iron', tag: 'post' }); this.decor.push({ kind: 'liftChain', top: [b0[0], b0[1] + rise + 2.5, b0[2]], shape: sh, sg }) }
      t.p = add3(add3(t.p, f, L + 0.1), [0, 1, 0], rise); this.last = null
      return sh
    }
    // 'side': 切れ目 len の真ん中を、床が横に行き来する（sin）。助走して跳び移る
    // 道の真上で止まる（lo）→ 横へ離れる → 離れた所で止まる（hi）→ 戻る、をくり返す。真上で止まっている間に着地する
    const len = o.len ?? 5, amp = (o.amp ?? 3), plen = o.plen ?? 3, c = add3(add3(add3(t.p, f, len - plen / 2 - 0.05), [0, 1, 0], (o.dy ?? 0) - 0.2), R, amp) // 床は切れ目の向こうの端（降りたらすぐ向こうの足場）
    const m = { type: 'lift', axis: R, amp, dwell: o.dwell ?? 2.4, move: o.move ?? 2.0, ph: o.ph || 0 }
    const sh = this.box({ c, h: [plen / 2, 0.2, w / 2], yaw: t.yaw, mat: 'liftdeck', mu: 1.05, tag: 'road', mov: m })
    this.path.push({ p: t.p.slice(), yaw: t.yaw, slope: 0, w: 0, kind: 'jump', len, vJump: o.vJump })
    for (let d = 1; d < len; d += 1) this.path.push({ p: add3(add3(t.p, f, d), [0, 1, 0], o.dy ?? 0), yaw: t.yaw, slope: 0, w, kind: 'slide' })
    this.hazards.push({ kind: 'slide', vGo: o.vGo ?? 7.5, runup: o.runup ?? 11, p: add3(t.p, f, len - plen / 2), yaw: t.yaw, half: 0.4, w, m, entryOnly: true, unsafe: tt => { const st = liftPos(m, tt); return st.at !== 'lo' || st.left < 0.7 || st.left > m.dwell - 0.5 } }) // 止まっている間の真ん中あたりに着く
    this.decor.push({ kind: 'rail', a: add3(add3(c, R, -amp * 2 - w / 2), [0, 1, 0], -0.5), b: add3(add3(c, R, w / 2), [0, 1, 0], -0.5) })
    t.p = add3(add3(t.p, f, len), [0, 1, 0], o.dy ?? 0); this.last = null
    return sh
  }
  // 回る橋: 切れ目 len に渡した板が、真ん中の軸で水平に回る。道の向きにそろった一瞬に、勢いで渡り切る
  spinBridge(len, o = {}) {
    const t = this.t, f = this.dir(t.yaw), w = o.w ?? 3.4, rate = o.rate ?? 0.3
    const c = add3(add3(t.p, f, len / 2), [0, 1, 0], -0.2)
    const m = { type: 'spin', rate }
    const sh = this.box({ c, h: [len / 2 - 0.1, 0.2, w / 2], yaw: t.yaw, mat: 'bridgeplank', mu: 1.0, tag: 'road', mov: m })
    this.cyl({ a: add3(c, [0, 1, 0], -6), b: add3(c, [0, 1, 0], -0.3), r: 0.35, mat: 'iron', tag: 'post' })
    for (let d = 0; d < len; d += 1) this.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope: 0, w, kind: 'spin' })
    // 道とそろうのは、角度が 0 と π の近く（半回転ごと）
    this.hazards.push({ kind: 'spin', vGo: o.vGo ?? 8, runup: o.runup ?? 9, p: add3(t.p, f, 0.5), yaw: t.yaw, half: 0.6, w, m, entryOnly: true, unsafe: tt => { let a = (rate * tt + 0.12) % Math.PI; if (a < 0) a += Math.PI; return a > 0.24 } }) // 乗る瞬間に、そろう少し前〜そろった所（渡る間に回る分を見込む）
    t.p = add3(t.p, f, len); this.last = null
    return sh
  }
  // 逆に流れる水路: 道の進む向きと逆へ流れる（止まると押し戻される）。坂を登りながら
  channel(len, slope, o = {}) {
    const t = this.t, f = this.dir(t.yaw, 0), u = o.u ?? 2.2
    const s = this.road(len, { ...o, slope, mat: 'wetstone', mu: o.mu ?? 0.75, kind: 'water', noOverlap: true })
    s.flow = [-f[0] * u, 0, -f[2] * u]
    this.waters.push({ box: s, u: -u })
    this.last = null
    return s
  }
  // 天井の低い道: 今の位置から len の間、頭のすぐ上（路面から hgt）に天井。ウィリーすると頭を打つ
  ceiling(len, o = {}) {
    const t = this.t, f = this.dir(t.yaw, o.slope || 0), w = (o.w ?? (this.last ? this.last.w : 4)) + 1.4, hgt = o.h ?? 2.35
    const c = add3(add3(t.p, f, len / 2), [0, 1, 0], hgt + 0.6)
    this.box({ c, h: [len / 2, 0.6, w / 2], yaw: t.yaw, pitch: o.slope || 0, mat: 'ruinwall', tag: 'ceiling' })
    for (const sg of [-1, 1]) { const c2 = add3(add3(t.p, f, len / 2), this.right(t.yaw), sg * (w / 2 + 0.2)); this.box({ c: add3(c2, [0, 1, 0], hgt / 2 + 0.3), h: [len / 2, hgt / 2 + 0.9, 0.2], yaw: t.yaw, pitch: o.slope || 0, mat: 'ruinwall', tag: 'wall' }) }
    this.lowAt = (this.lowAt || []).concat([{ i: this.path.length, len }])
  }
  // 積み上げた障害物（木箱）を段として登る: heights の段を続けて。gap は段の間の平らな所
  crates(heights, gap = 2.6, o = {}) {
    for (const h of heights) { this.step(h); this.road(gap, { w: o.w ?? (this.last ? this.last.w : 4), mat: 'crate', thick: 1, noOverlap: true, kind: 'crate' }) }
  }
  // 跳ね橋（2点の間に渡す。塔のまわりの道の切れ目用）
  drawbridgeAt(p0, p1, o = {}) {
    const d = [p1[0] - p0[0], 0, p1[2] - p0[2]], len = Math.hypot(d[0], d[2]), yaw = datan2(-d[2], d[0]), w = o.w ?? 3, th = 0.35
    const f = this.dir(yaw), R = this.right(yaw)
    const hinge = add3(p1, [0, 1, 0], -th / 2), c = add3(add3(p0, f, len / 2), [0, 1, 0], -th / 2)
    const m = { type: 'hinge', hinge, right: R, sgn: 1, up: -(o.up ?? 1.15), dwell: o.dwell ?? 2.4, move: o.move ?? 1.1, ph: o.ph || 0 }
    const sh = this.box({ c, h: [len / 2 + 0.25, th / 2, w / 2], yaw, mat: 'bridgeplank', mu: 1.0, tag: 'road', mov: m })
    this.hazards.push({ kind: 'draw', p: add3(p0, f, len / 2), yaw, half: len / 2 + 0.9, w, m, shape: sh, unsafe: tt => hingeAng(m, tt).a < -0.04 })
    for (const sg of [-1, 1]) { const b0 = add3(add3(p1, f, 0.3), R, sg * Math.max(w / 2 + 0.3, (o.roadW ?? w) / 2 + 0.35)); this.cyl({ a: [b0[0], b0[1] - 1, b0[2]], b: [b0[0], b0[1] + 3.2, b0[2]], r: 0.16, mat: 'iron', tag: 'post' }); this.decor.push({ kind: 'drawChain', top: [b0[0], b0[1] + 3.0, b0[2]], shape: sh, sg }) }
    return sh
  }
  // 落石: 今の位置から at 進んだ所に、上から周期的に岩が落ちる（落ちる前に小石と砂ぼこり）
  rockfall(at, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw)
    const base = add3(add3(t.p, f, at), R, o.lat || 0), r = o.r ?? 0.75, hd = o.hd ?? 11
    const m = { type: 'drop', T: o.T ?? 3.6, fall: o.fall ?? 1.0, warn: o.warn ?? 1.5, hd, ph: o.ph || 0 }
    const rock = this.sph({ c: [base[0], base[1] + r * 0.6, base[2]], r, mat: 'boulder', tag: 'rock', mov: m, knock: o.knock ?? 6 })
    const w = o.w ?? (this.last ? this.last.w : 4)
    this.hazards.push({ kind: 'rock', p: base, yaw: t.yaw, half: r + 0.4, w, m, rock, unsafe: tt => { const st = dropState(m, tt); return !st.hidden && st.y < 2.8 } })
    return rock
  }
  // 突風: 今の位置から len の区間に、横から間をおいて強い風が吹く（細い所で吹かれると落ちる）
  gust(len, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), sg = o.sgn ?? 1
    const pts = [t.p, add3(t.p, f, len)], w = o.w ?? 4
    const mn = [0, 1, 2].map(k => Math.min(pts[0][k], pts[1][k]) - w), mx = [0, 1, 2].map(k => Math.max(pts[0][k], pts[1][k]) + w)
    mn[1] = Math.min(pts[0][1], pts[1][1]) - 1; mx[1] = Math.max(pts[0][1], pts[1][1]) + 4
    const g = { min: mn, max: mx, f: [R[0] * sg * (o.a ?? 9), 0, R[2] * sg * (o.a ?? 9)], w: 2 * Math.PI / (o.T ?? 4.2), ph: o.ph || 0, pulse: true }
    this.winds.push(g)
    this.hazards.push({ kind: 'gust', vGo: o.vGo ?? 7, p: add3(t.p, f, len / 2), yaw: t.yaw, half: len / 2 + 1, w, g, unsafe: tt => gustK(g, tt) > 0.25 })
    return g
  }
  // 技の区間の始まり（tools/tech.mjs が区間ごとに試す）。次の mark か門で閉じる
  mark(name) { this.closeMark(); this.marks = this.marks || []; this.openMark = { name, i0: this.path.length }; this.noDeco = Math.max(this.noDeco || 0, /回廊/.test(name) ? 0 : 4) } // 区間の仕掛けの周りには、抜ける床などを仕込まない
  closeMark() { const m = this.openMark; if (!m) return; this.openMark = null; const i1 = this.path.length - 1; if (i1 <= m.i0) return; let k = i1; while (k > m.i0 && (!this.path[k].p || !this.path[k].w || this.path[k].kind === 'jump')) k--; this.marks.push({ name: m.name, i0: m.i0, i1, end: this.path[k].p.slice() }) }
  // 浮いた広場で U ターン（u: 1 左回り・-1 右回り）。広場は平らな箱、道の線は半径 Ru の半円
  uturn(Ru, u, o = {}) {
    const t = this.t, f = this.dir(t.yaw), R = this.right(t.yaw), w = 4, m = o.margin ?? 2.4, side = u > 0 ? -1 : 1
    const l0 = Math.min(0, side * 2 * Ru) - w / 2 - m, l1 = Math.max(0, side * 2 * Ru) + w / 2 + m
    const d0 = -0.4, d1 = Ru + w / 2 + m
    const c = add3(add3(t.p, f, (d0 + d1) / 2), R, (l0 + l1) / 2)
    const thick = o.platThick ?? 1.6
    this.box({ c: [c[0], t.p[1] - thick / 2, c[2]], h: [(d1 - d0) / 2, thick / 2, (l1 - l0) / 2], yaw: t.yaw, mat: o.plat || 'cobble', tag: 'pad' })
    this.plats.push({ c: [c[0], t.p[1], c[2]], h: [(d1 - d0) / 2, (l1 - l0) / 2], yaw: t.yaw, zone: this.zone, thick })
    const at = (dd, ll) => add3(add3(t.p, f, dd), R, ll), mid = (l0 + l1) / 2
    // 奥の角に松明、奥のふちに折れた柱と像（どれも当たりのある円柱。道の線から 2m 以上離す）
    for (const [dd, ll] of [[d1 - 0.7, l0 + 0.7], [d1 - 0.7, l1 - 0.7]]) { const q = at(dd, ll); this.cyl({ a: [q[0], q[1] - thick, q[2]], b: [q[0], q[1] + 2.1, q[2]], r: 0.11, mat: 'iron', tag: 'post' }); this.torches.push([q[0], q[1] + 2.35, q[2]]) }
    for (const [dd, ll, hh] of [[d1 - 0.8, l0 + 3.0, 3.4], [d1 - 0.8, l1 - 3.0, 1.7]]) { const q = at(dd, ll); this.cyl({ a: [q[0], q[1] - 0.05, q[2]], b: [q[0], q[1] + hh, q[2]], r: 0.42, mat: 'marble', tag: 'pillar' }); this.props.push({ kind: 'column', p: q, h: hh }) }
    { const q = at(d1 - 0.75, mid); this.cyl({ a: [q[0], q[1] - 0.05, q[2]], b: [q[0], q[1] + 2.3, q[2]], r: 0.7, mat: 'statue', tag: 'statue' }); this.props.push({ kind: 'statue', p: q, yaw: t.yaw + Math.PI }) }
    // 樽（入口の外側。当たりは円柱、見た目は同じ大きさの樽の模型）
    for (const [dd, ll] of [[0.9, l0 + 0.8], [1.7, l0 + 0.9], [1.2, l1 - 0.8]]) { const q = at(dd, ll); this.cyl({ a: [q[0], q[1], q[2]], b: [q[0], q[1] + 0.88, q[2]], r: 0.29, mat: 'barrel', tag: 'barrel' }); this.props.push({ kind: 'barrel', p: q, rot: dd * 1.7 + ll }) }
    { const q = at(1.3, l0 + 0.85); q[1] += 0.88; this.cyl({ a: [q[0], q[1], q[2]], b: [q[0], q[1] + 0.88, q[2]], r: 0.29, mat: 'barrel', tag: 'barrel' }); this.props.push({ kind: 'barrel', p: q, rot: 2.3 }) } // v31 本人「その上にあるドラム缶も爆発させたい」: 2 つ並んだ樽の上に 1 つ積む（爆発する樽なら連鎖する）
    this.curve(Ru, u * Math.PI, { noShape: true, pw: 2 * Ru, kind: 'uturn' })
    this.last = { slope: 0, yaw: this.t.yaw, w: 2 * Ru }
  }
  // 崩れる板の列（乗っている時間がたまると落ち、6 秒で戻る）
  // 前輪を引っ掛けて耐える高い縁（v15）: 今の所に高さ h の壁、上に len の道。壁の角に前輪を掛けて耐え、前体重＋アクセルで登る
  // o.max 耐えられる秒数（縁が欠けるまで）
  hangLedge(h, len, o = {}) {
    const t = this.t, w = o.w ?? (this.last ? this.last.w : 4), f = this.dir(t.yaw), R = this.right(t.yaw)
    this.path.push({ p: t.p.slice(), yaw: t.yaw, slope: 0, w: 0, kind: 'hang', dy: h, hangMax: o.max ?? 8 })
    this.t.p[1] += h; this.last = null
    const e = t.p.slice()
    const thick = o.thick ?? (h + 0.6)
    const s = this.road(len, { w, mat: o.mat || 'stone', thick, noOverlap: true, back: 0, kind: 'road' })
    s.hang = { a: add3(e, R, -w / 2 + 0.2), b: add3(e, R, w / 2 - 0.2), n: [-f[0], 0, -f[2]], max: o.max ?? 8, easy: !!o.easy }
    // 角の石（欠けていく縁の見た目。当たりなし）
    this.decor.push({ kind: 'hangLip', a: s.hang.a, b: s.hang.b, n: s.hang.n })
    return s
  }
  // まっすぐな道の、急に抜ける床（近づくと小石がこぼれて抜け落ちる。速さで越える）
  trapStraight(o = {}) {
    const len = 1.8, s = this.road(len, { ...o, kind: 'trap', noOverlap: true, back: 0, thick: Math.min(o.thick ?? 0.6, 0.6) })
    s.mov = { type: 'trap', trig: 6.5, warn: 0.45 }; s.tag = 'road'
    this.last = null; return s
  }
  // 燃料の缶（ニトロが半分たまる）: 今の所から at 先の道の上
  can(at = 0) {
    const t = this.t, f = this.dir(t.yaw), p = add3(t.p, f, at)
    this.cans = this.cans || []; this.cans.push({ p, t: null })
  }
  crumbleRun(len, n, w, delay = 0.5) {
    const t = this.t, f = this.dir(t.yaw)
    for (let i = 0; i < n; i++) { const c0 = add3(add3(t.p, f, len / n * (i + 0.5)), [0, 1, 0], -0.15); this.box({ c: c0, h: [len / n / 2 - 0.04, 0.15, w / 2], yaw: t.yaw, mat: 'plankold', tag: 'road', mov: { type: 'crumble', delay, back: 6 } }) }
    for (let d = 0; d < len; d += 1) this.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope: 0, w, kind: 'crumble' })
    t.p = add3(t.p, f, len); this.last = null
  }
}

// ============================================================ 練習場
export function practice() {
  const B = new Builder([0, 0, 0], 0)
  B.zone = 'ground'
  // 地面（広い原っぱ）。道は地面の上に載る板
  B.box({ c: [120, -9, 0], h: [900, 3, 900], mat: 'grass', tag: 'ground' })
  B.solid = true; B.base = -6.6
  B.t.p = [0, 0.6, 0]
  B.road(14, { w: 5, mat: 'concrete', thick: 0.6 }); B.cp('スタート', { w: 5 }); B.sign({ touch: '↑ アクセル  ↓ ブレーキ  ←→ 体重', pc: '左クリック アクセル  右クリック ブレーキ  A D 体重' }, { at: 3 })
  B.road(10, { w: 5, mat: 'concrete', thick: 0.6 })
  // 1 低い段（勢いで越える）
  B.step(0.22); B.road(8, { w: 5, mat: 'concrete', thick: 0.82, noOverlap: true }); B.step(-0.22); B.road(10, { w: 5, mat: 'concrete', thick: 0.6, noOverlap: true })
  // 2 高い段（ウィリーで前輪を上げてから）
  B.cp('段差', { w: 5 }); B.sign({ touch: '高い段は ← 後ろ体重で前輪を上げる', pc: '高い段は A 後ろ体重で前輪を上げる' }, { at: 1 })
  B.road(10, { w: 5, mat: 'concrete', thick: 0.6 })
  B.step(0.5); B.road(6, { w: 5, mat: 'concrete', thick: 1.1, noOverlap: true })
  B.step(0.5); B.road(8, { w: 5, mat: 'concrete', thick: 1.6, noOverlap: true })
  // 3 坂を下りて登る
  B.road(12, { w: 5, slope: -8 * DEG, mat: 'concrete', thick: 1.6 })
  B.road(6, { w: 5, mat: 'concrete', thick: 0.6 })
  B.cp('坂', { w: 5 })
  B.road(18, { w: 5, slope: 16 * DEG, mat: 'concrete', thick: 1.2 })
  B.road(6, { w: 5, mat: 'concrete', thick: 1.2 })
  B.road(16, { w: 5, slope: -16 * DEG, mat: 'concrete', thick: 1.2 })
  B.road(10, { w: 5, mat: 'concrete', thick: 0.6 })
  // 3.5 急な登りと急な下り（登りは → で前に、下りは ← で後ろに）
  B.cp('急な坂', { w: 5 }); B.sign({ touch: '登りは → 前体重 下りは ← 後ろ体重', pc: '登りは D 前体重 下りは A 後ろ体重' }, { at: 1 })
  B.road(8, { w: 5, mat: 'concrete', thick: 0.6 })
  B.road(5, { w: 4, slope: 30 * DEG, mat: 'concrete', thick: 1.2 })
  B.road(2, { w: 4, mat: 'concrete', thick: 1.2 })
  B.road(5, { w: 4, slope: -28 * DEG, mat: 'concrete', thick: 1.2 })
  B.road(6, { w: 5, mat: 'concrete', thick: 0.6 })
  // 3.6 段の連続（勢いで越えるか、← のあとすぐ → で跳ねる）
  B.cp('段の連続', { w: 5 }); B.sign({ touch: '← のあとすぐ → で跳ねる', pc: 'A のあとすぐ D で跳ねる' }, { at: 1 })
  B.road(8, { w: 5, mat: 'concrete', thick: 0.6 })
  for (let i = 0; i < 3; i++) { B.step(0.28); B.road(2.3, { w: 5, mat: 'concrete', thick: 0.9 + i * 0.3, noOverlap: true }) }
  B.road(4, { w: 5, mat: 'concrete', thick: 1.5 })
  // 4 ジャンプ台 → すき間 → 下り坂に着地
  B.cp('ジャンプ台', { w: 5 }); B.sign({ touch: '空中は ←→ で角度を合わせる', pc: '空中は A D で角度を合わせる' }, { at: 1 })
  B.road(22, { w: 5, mat: 'concrete', thick: 0.6 })
  const rise = B.kicker(4, 20 * DEG, { w: 3.4 })
  B.gap(7, rise - 0.6, 'jump')
  B.road(14, { w: 5, slope: -12 * DEG, mat: 'wood', thick: 1.2 })
  B.road(8, { w: 5, mat: 'concrete', thick: 0.6 })
  // 5 細い足場（低速でまっすぐ）
  B.cp('細い足場', { w: 5 }); B.sign('細い所はゆっくり', { at: 1 })
  B.road(8, { w: 5, mat: 'concrete', thick: 0.6 })
  B.solid = false
  B.road(14, { w: 0.42, mat: 'beam', thick: 0.3, kind: 'narrow' })
  B.solid = true
  B.road(4, { w: 5, mat: 'concrete', thick: 0.6 })
  // 6 曲がり角（ハンドルは自動。速すぎると曲がり切れずに外へ出る）
  B.cp('曲がり角', { w: 5 }); B.sign({ touch: '曲がる前は ↓ で減速', pc: '曲がる前は 右クリック で減速' }, { at: 1 })
  B.road(6, { w: 5, mat: 'concrete', thick: 0.6 })
  B.curve(6, 90 * DEG, { w: 3.2, mat: 'concrete', thick: 0.6 })
  B.road(3, { w: 3.2, mat: 'concrete', thick: 0.6 })
  B.curve(6, -90 * DEG, { w: 3.2, mat: 'concrete', thick: 0.6 })
  B.road(4, { w: 5, mat: 'concrete', thick: 0.6 })
  B.cp('ゴール', { w: 5, finish: true })
  B.road(10, { w: 5, mat: 'concrete', thick: 0.6 })
  return finishCourse(B, { id: 'practice', name: '練習場', killBelow: 6, spawnBack: 3 })
}

// ============================================================ 第1面 奈落から天空へ
// 溶岩の底から、巨大な塔のまわりを登る1本の道。区間ごとに景色が変わる:
//   溶岩の底（玄武岩の道）→ 廃墟（崩れた石の張り出しと朽ちた木の橋）→ 工場（さびた鉄骨）→ 氷 → 塔の屋上 → 谷を跳んで天空城
// 塔のまわりは左回りと右回りを交互に登る。向きを変える所は、塔から外へ張り出した道の先の浮いた広場で U ターンし、
// 行きの道の真上を通って塔へ戻る（下を見ると、今まで登ってきた道が見える）。上の周から落ちると下の周に落ちる。
export function stage1() {
  const B = new Builder([0, 0, 0], 0)
  B.plats = []; B.props = []
  B.lavaY = -32; B.lavaKill = -4
  // ---------------- A 塔の根もとの地面（石畳の広場から出発。道は地面より一段高い石の道）
  B.zone = 'ground'; B.solid = true; B.base = -0.5
  B.t.p = [0, 0.5, 0]
  B.box({ c: [27, 0.5 - 0.6, 0], h: [36, 0.6, 15], mat: 'cobble', tag: 'pad' }).plaza = true // 出発の広場（大きいジャンプ台まで含む。外れても落ちない）
  B.plazaStart = true
  const L = { w: 5, mat: 'cobble', thick: 0.6 }
  B.road(16, L)
  B.cp('塔の根もと', { w: 5, rest: true })
  B.tut('thr')
  B.torch(-1, -2, { down: 3 }); B.torch(1, -2, { down: 3 })
  // 大きいジャンプ台（テーブル型）: 登り 24° → 平らな台 → ゆるい下り。遅いと台の上、全開だと下り坂の先まで飛ぶ
  B.mark('出発の大ジャンプ')
  B.road(4, L)
  { const ramp = B.road(6, { ...L, slope: 24 * DEG, mat: 'plank', kind: 'ramp' }); ramp.launch = true
    // ジャンプ台の見た目: 縁の鉄の帯（板の中に半分埋める）と、両脇の支えの柱・松明
    const f = B.dir(B.t.yaw), R = B.right(B.t.yaw), up = B.t.p, w = L.w
    const lipA = add3(up, R, -w / 2 + 0.05), lipB = add3(up, R, w / 2 - 0.05)
    B.cyl({ a: add3(lipA, [0, 1, 0], -0.05), b: add3(lipB, [0, 1, 0], -0.05), r: 0.08, mat: 'edgesteel', tag: 'kicker' })
    const base = add3(up, f, -6 * Math.cos(24 * DEG)); base[1] = up[1] - 6 * Math.sin(24 * DEG)
    for (const sg of [-1, 1]) {
      const e0 = add3(base, R, sg * (w / 2 - 0.05)), e1 = add3(up, R, sg * (w / 2 - 0.05))
      B.cyl({ a: add3(e0, [0, 1, 0], -0.04), b: add3(e1, [0, 1, 0], -0.04), r: 0.08, mat: 'edgesteel', tag: 'kicker' })
      for (const t of [0.35, 0.75]) { const q = [e0[0] + (e1[0] - e0[0]) * t, e0[1] + (e1[1] - e0[1]) * t, e0[2] + (e1[2] - e0[2]) * t]; const o = add3(q, R, sg * 0.18); B.cyl({ a: [o[0], 0.5, o[2]], b: [o[0], q[1] - 0.1, o[2]], r: 0.12, mat: 'beam', tag: 'post' }) }
    }
    B.torch(-1, -3, { down: 3, w: w + 0.6 }); B.torch(1, -3, { down: 3, w: w + 0.6 })
  }
  B.path[B.path.length - 1].kind = 'lip'; B.path[B.path.length - 1].vNeed = 11
  // 速さの帯: 遅いと切れ目の底（地面）へ落ちてすぐ出発に戻る。ちょうどだと着地の坂。速すぎると向こうの高い段の壁に当たる
  { const lip = B.t.p.slice(), f = B.dir(B.t.yaw)
    B.box({ c: [lip[0] + f[0] * 4, lip[1] - 3.2, lip[2] + f[2] * 4], h: [4.2, 0.4, 3.5], yaw: B.t.yaw, mat: 'ground', tag: 'ground' })
    B.gap(5.5, -0.6, 'jump') } // v29 本人「戻して」: v27 の着地坂・短い坂をやめて v26 の形（切れ目 5.5m・着地の坂 9m・0.75m の段）に戻した
  B.road(9, { ...L, slope: -Math.atan2(1.1, 9), mat: 'cobble', kind: 'landing', back: 0 })
  const LW = { ...L, w: 6.6 } // v38: 着地の先〜低い段の練習の手前の道を 5→6.6m に（曲がりの外の縁から落ちていた。道の線と長さは同じ）
  B.road(1.5, LW)
  B.torch(-1, -1, { down: 3 }); B.torch(1, -1, { down: 3 })
  B.step(0.75); B.road(4, { ...LW, noOverlap: true })
  B.log(1.5, 0.09, 4.6); B.road(4, LW) // v36 本人「最初のジャンプ台のあとのでこぼこ、難しすぎ」: 丸太を低く（0.16→0.09）
  B.curve(14, 32 * DEG, { ...LW, pw: 5 }) // v38: 出発の曲がりを広く（道の線は同じ。外へふくらんで縁から落ちていた）
  B.road(4, LW)
  B.step(0.18); B.road(6, { ...LW, noOverlap: true })
  B.torch(1, 2, { down: 3 })
  B.tut('back')
  B.log(2, 0.08, 4.6); B.road(5, LW) // v36: 0.14→0.08
  B.rampUp(0.42, 1.8, LW); B.step(0.42); // v36: 0.42m の段の手前に小さな坂（段で止まらない）
  B.road(6, { ...LW, noOverlap: true })
  B.curve(14, -64 * DEG, { ...LW, pw: 5 }) // v38: 同上
  B.logGone(1.5); B.road(4, LW) // v36: 坂の登り口の丸太を取った
  B.tut('fwd')
  B.road(9, { ...LW, slope: 18 * DEG })
  B.logGone(3); B.road(6, LW) // v36: 坂の上の丸太を取った（道の点は同じ数のまま）
  B.torch(-1, 3, { down: 3 })
  B.curve(14, 32 * DEG, { ...LW, pw: 5 }) // v38: 出発の曲がりを広く（道の線は同じ。外へふくらんで縁から落ちていた）
  B.tut('air')
  B.road(9, LW)
  { const rise = B.kicker(3, 11 * DEG, { w: 4.6, mat: 'basalt', thick: 0.8 }); B.gap(3.0, rise - 0.6, 'jump') } // v38: 15→11 度・切れ目 3.0m（0.25 秒遅れでも跳び出しで前へ回りすぎない） // v37 本人「でこぼこ難しすぎ」: 切れ目 5.5→3.8m（その分、着地の道を長く。先の道の位置は同じ）
  { const t = B.t, f = B.dir(t.yaw), ang = Math.atan2(0.5, 6), L2 = Math.hypot(0.5, 6), up = B.upv(t.yaw, -ang), fr = B.dir(t.yaw, -ang), st = add3(t.p, [0, 1, 0], 0.5)
    B.box({ c: add3(add3(st, fr, L2 / 2), up, -0.15), h: [L2 / 2, 0.15, 3.2], yaw: t.yaw, pitch: -ang, mat: 'cobble', mu: 1.0, tag: 'road' }) } // 着地の 6m はゆるい下り（広さ 6.4m）
  B.road(12.5, { ...L, w: 6.4, back: 0 })
  B.torch(1, 4, { down: 3 }); B.torch(-1, 4, { down: 3 })
  B.log(2.5, 0.09, 4.6); B.logGone(5.5); B.mudRun(6, 0, /* v36: 続けて並んでいた 2 本を 1 本に・低く */ { ...L, mud: 110 }); B.road(2, L) // v26 本人「結構最初の方に泥一個置いて」: 平らな泥 6m（長さは前の道 8m と同じにして、先の道の位置を変えない）。抜けると「ブリュッ」
  // 高い段（車輪の径くらい）: ゆっくりウィリーで前輪を段の上へ掛け、前体重＋アクセルで後輪を引き上げる
  // v22 本人「出だしの段差やさしくして」: 高い縁の前に、低い順に段を 2 つ（0.5m はふつうのウィリーで、0.75m は前輪を掛ける練習。どちらも降りて元の高さへ）
  B.mark('低い段の練習')
  B.road(3, L)
  B.step(0.5); B.road(5, { ...L, noOverlap: true }); B.step(-0.5); B.road(5, { ...L, noOverlap: true })
  B.step(0.75); B.road(5, { ...L, noOverlap: true }); B.step(-0.75); B.road(4, { ...L, noOverlap: true })
  B.tut('climb')
  B.cp('高い縁の前', { w: 5, rest: true }) // 失敗してもすぐここから
  B.road(6, L)
  B.mark('高い段をよじ登る')
  B.hangLedge(1.6, 10, { w: 5, mat: 'cobble', max: 20, easy: true }) // v15: 高い縁（1.6m）。前輪を掛けて耐え、前体重＋アクセルで登る（歩く人では登れない）。v22: 最初の縁だけ、掛かる幅・釣り合い・ずり落ち・欠けるまでの時間に余裕
  B.cp('高い段の上', { w: 5, rest: true })
  B.road(6, L)
  // 振り子の鉄球（1つ）: 道を横切って振れる。当たると横へ弾き飛ばされる。振れる間を見て通り抜ける
  B.mark('振り子の鉄球')
  B.road(4, L)
  // 鉄球の手前に高い段: 段をよじ登ってから、鉄球が外へ振れた間に抜ける（段の上で待てる）
  B.hangLedge(1.6, 6, { w: 5, mat: 'cobble', max: 10 })
  B.pendulum(-5.4, { w: 5, T: 6.0 }) // 縁の上を横切る鉄球: 縁に前輪を掛けて耐え、頭の上を通り過ぎてから登る
  B.log(4, 0.16, 4.6); B.road(12, L)
  B.torch(-1, -2, { down: 3 }); B.torch(1, -2, { down: 3 })
  B.log(3, 0.16, 4.6); B.log(9, 0.17, 4.6); B.road(16, L)

  // ---------------- 見極めの台（速さで着地先が変わる）
  // 下の道（低い張り出し）を走って U ターン → ゆるく登って戻り → もう一度 U ターンして、下の道の真上の助走路へ。
  // 助走路の先のジャンプ台から: 遅いと下の道へ落ちてもう一周、ちょうどだと向こうの高い張り出し、速すぎると曲がり切れずに地面へ落ちる
  B.cp('見極めの台', { w: 5, rest: true })
  {
    const HC = 4.8, yL = B.t.p[1]
    B.mark('見極めの台')
    B.road(5, { ...L, kind: 'lowledge' }); B.log(1.5, 0.15, 4.6); B.road(7, { ...L, kind: 'lowledge' }); B.trapStraight({ ...L, w: 5 }); B.road(20, { ...L, kind: 'lowledge', back: 0 })
    B.torch(1, -4, { down: 3 }); B.torch(-1, -4, { down: 3 })
    B.solid = false
    B.uturn(4, -1, { plat: 'cobble', platThick: 0.8 })
    for (let k = 0; k < 4; k++) { B.road(11, { w: 4, mat: 'cobble', thick: 0.7, slope: Math.atan2(HC, 44), back: k ? 0.6 : 0 }); if (k < 3) B.log(0.3, 0.14, 3.6) } // 坂の途中に丸太（v16）
    B.uturn(4, -1, { plat: 'cobble', platThick: 0.8 })
    // 助走路（長さが見えるように、6m ごとに両脇の松明）
    B.sign('速さで 着地が変わる', { at: 1 })
    const ru0 = B.path.length
    B.road(18, { w: 4, mat: 'cobble', thick: 0.6, back: 0, kind: 'runway' })
    for (const a of [-17, -11, -5]) { B.torch(1, a, { w: 4, down: 0.6 }); B.torch(-1, a, { w: 4, down: 0.6 }) }
    const rise = B.kicker(3, 20 * DEG, { w: 3.6, mat: 'plank', thick: 0.7 })
    B.path[B.path.length - 1].vNeed = 10
    const lip = B.t.p.slice(), f = B.dir(B.t.yaw)
    B.notes.push({ kind: 'speedRamp', lip, ru0, yL, yU: lip[1] - 0.4, lipTop: lip[1] + rise })
    // 向こうの高い張り出し: 短い着地の坂 → 四角い踊り場で左へ曲がる。その先は何もない（跳びすぎると下の道へ落ちる）
    B.path.push({ p: lip.slice(), yaw: B.t.yaw, slope: 0, w: 0, kind: 'jump', len: 8 })
    B.t.p = [lip[0] + f[0] * 8, lip[1] - 0.4 + 0.4, lip[2] + f[2] * 8]; B.last = null
    B.road(4, { w: 5, mat: 'plank', thick: 0.5, slope: -Math.atan2(0.4, 4), back: 0, kind: 'landing' })
    const wi0 = B.path.length - 4
    B.pad(6, 90 * DEG, { mat: 'cobble', thick: 0.8, wide: 6 })
    B.road(3, { w: 4.2, mat: 'cobble', thick: 0.8, back: 0 })
    for (let k = wi0; k < B.path.length; k++) B.path[k].wide = true // 見極めの場所: ここの直角は自動では減速しない（速すぎると曲がれずに落ちる）
    B.road(12, { w: 4.2, mat: 'cobble', thick: 0.8 })
    B.gap(1.6, 0, 'jump'); B.path[B.path.length - 1].vJump = 5.5 // 横切る溝（遅いと落ちる）
    B.road(16, { w: 4.2, mat: 'cobble', thick: 0.8, back: 0 })
    B.torch(1, -6, { w: 4.2, down: 1 }); B.torch(-1, -14, { w: 4.2, down: 1 })
    B.curve(9, -90 * DEG, { w: 4.2, mat: 'cobble', thick: 0.8 })
    B.road(8, { w: 4.2, mat: 'cobble', thick: 0.8 })
    B.solid = true
    B.log(2.5, 0.15, 3.8); B.road(6, { ...L, w: 4.2 })
  }

  // ================= v16 広い世界: 塔がいくつもある廃墟の世界を、塔から塔へ渡っていく
  // 谷底の街 → 墓所の塔（溶岩に追われて半周）→ 崖沿いの墓所の道 → 水道橋で廃墟の塔へ → 鎖でつないだ浮き島 → 工場の鉄骨と歯車の塔
  // → 鐘楼 → 氷の尖塔（屋上から谷を跳ぶ）→ 雲の上の城。1 つの塔のまわりは 1 周しない。
  const W = 4.2
  const x = makeWorldX(B, { W })
  x.P = P16; x.P17 = P17; x.fork = makeFork(x, P16)
  const { orbit, otorch } = x
  // 谷底の街の地面（出発の広場から墓所の塔の根もとまで）。その外は崖で、下は溶岩の谷
  { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const q of B.path) if (q.p) { x0 = Math.min(x0, q.p[0]); x1 = Math.max(x1, q.p[0]); z0 = Math.min(z0, q.p[2]); z1 = Math.max(z1, q.p[2]) }
    x0 -= 24; x1 += 50; z0 -= 40; z1 += 30
    B.box({ c: [(x0 + x1) / 2, -4, (z0 + z1) / 2], h: [(x1 - x0) / 2, 4, (z1 - z0) / 2], mat: 'ground', tag: 'ground', zone: 'ground' }) }
  B.solid = false
  B.decoOn = true // ここから先の道には、抜ける床・溝・崩れる敷石を仕込む
  Z.crypt(x)
  Z.ruins(x)
  Z.ruinsMore(x)
  Z.storm(x)
  Z.factory(x)
  Z.factoryMore(x)
  Z.belfry(x)
  Z.ice(x)

  // ---------------- E 氷の尖塔の屋上（休憩所）→ 助走 → ジャンプ台 → 谷を越えて浮き島 → 天空城
  const TT = B.towers[B.towers.length - 1], cx = TT.cx, cz = TT.cz, TR = TT.r
  x.closeTower()
  B.zone = 'roof'
  const yT = B.t.p[1]
  TT.top = yT; TT.roof = true
  B.tower = TT
  B.curve(6, B.orbitSign * 90 * DEG, { w: 4, mat: 'castle', thick: 0.3 })
  B.cp('塔の屋上', { w: 4, rest: true })
  B.mark('助走して谷を飛ぶ')
  {
    const P0 = B.t.p, d = B.dir(B.t.yaw), CP = [cx - P0[0], 0, cz - P0[2]]
    const tc = CP[0] * d[0] + CP[2] * d[2], ex = CP[0] - d[0] * tc, ez = CP[2] - d[2] * tc
    const far = tc + Math.sqrt(Math.max(0, TR * TR - ex * ex - ez * ez))
    B.solid = true; B.base = yT - 0.4
    B.road(far + 0.3, { w: 3, mat: 'castle', thick: 0.3, kind: 'runway' })
    B.solid = false
    B.road(9, { w: 3, mat: 'plank', thick: 0.4, kind: 'runway' })
    B.torch(1, -1, { w: 3, down: 1.5 }); B.torch(-1, -1, { w: 3, down: 1.5 })
  }
  const lipRise = B.kicker(3.6, 20 * DEG, { w: 2.8, mat: 'plank', thick: 0.6 })
  const lip = B.t.p.slice()
  B.path[B.path.length - 1].vNeed = 15
  B.zone = 'sky'; B.solid = false
  const fJ = B.dir(B.t.yaw), rJ = B.right(B.t.yaw), yawJ = B.t.yaw
  const Y1 = lip[1] - 1.6, Y2 = lip[1] - 5.6
  const at = (al, lat, y) => [lip[0] + fJ[0] * al + rJ[0] * lat, y, lip[2] + fJ[2] * al + rJ[2] * lat]
  B.path.push({ p: lip.slice(), yaw: B.t.yaw, slope: 0, w: 0, kind: 'jump', len: 15 })
  // 浮き島1（ふつうに跳べば届く）
  B.t.p = at(15, 0, Y1); B.last = null
  B.road(5.5, { w: 6, mat: 'snowrock', thick: 1.2, back: 0 })
  floatIsland(B, at(17.75, 0, Y1), yawJ, 2.8, 3.0)
  B.cp('浮き島', { w: 6, noGate: true })
  // ふつうの道: 右へ回り、細い板を渡って下り、浮き島2の横から入る（近道の着地坂とは 10m 以上離す）
  // 曲がりは小さめ（半径 4m）。全開で跳んだ人が、この曲がりの縁に引っかからずに近道の着地坂まで届くように
  // v16: 浮き島1 の上を、曲がる所まで広い平らな板にする（踏み切り 15.5〜16m/s で、曲がる道の縁や島の下の岩に当たっていた）
  { const c0 = at(23.15, 0.5, Y1 - 0.6); B.box({ c: c0, h: [2.65, 0.6, 3.5], yaw: yawJ, mat: 'snowrock', tag: 'road' })
    // 板の向こうはそのまま近道の下り坂（段も切れ目もなし。速いまま曲がれずに走り抜けても落ちない。v15 は 15.5〜16m/s で曲がる道の縁に当たって落ちた）
  }
  B.curve(4, -90 * DEG, { noShape: true, pw: 2.6, kind: 'pad' })
  B.road(4, { w: 1.8, mat: 'plank', thick: 0.3, kind: 'narrow', back: 0 })
  B.curve(5, 90 * DEG, { w: 2.6, mat: 'plank', thick: 0.4, rise: -0.4 })
  B.road(10, { w: 1.8, mat: 'plank', thick: 0.35, slope: -Math.atan2(2.6, 10) })
  B.road(3, { w: 2.2, mat: 'snowrock', thick: 0.6 })
  {
    const remain = B.t.p[1] - Y2
    B.curve(5, 90 * DEG, { w: 2.6, mat: 'plank', thick: 0.4, rise: -remain })
  }
  // 浮き島2（近道: 速く跳ぶと屋上から直接ここへ届く。手前は着地用の下り坂）
  {
    const latNow = (B.t.p[0] - lip[0]) * rJ[0] + (B.t.p[2] - lip[2]) * rJ[2]
    const alNow = (B.t.p[0] - lip[0]) * fJ[0] + (B.t.p[2] - lip[2]) * fJ[2]
    B.road(Math.max(0.5, latNow - 6.5), { w: 2.2, mat: 'snowrock', thick: 0.5 })
    const isl2 = at(alNow, 0, Y2)
    B.box({ c: [isl2[0], Y2 - 0.6, isl2[2]], h: [7, 0.6, 7], yaw: yawJ, mat: 'snowrock', tag: 'island' })
    floatIsland(B, [isl2[0], Y2 - 1.2, isl2[2]], yawJ, 6, 5.5)
    B.curve(4.5, -90 * DEG, { noShape: true, pw: 6, kind: 'pad' })
    // 着地用の下り坂（近道で跳んできた人がここに降りる）
    const st = at(25.75, 1.75, Y1) // 浮き島1の曲がる道の下に入らない所から（頭の上の空きを取る）
    const landLen = alNow - 7 - 25.75
    const S2 = new Builder(); S2.shapes = B.shapes; S2.path = []; S2.zone = 'sky'
    S2.t = { p: st, yaw: yawJ }
    S2.road(landLen + 0.4, { w: 8.5, slope: -Math.atan2(Y1 - Y2, landLen), mat: 'snowrock', thick: 1.0, back: 0, kind: 'landing' })
    B.notes.push({ kind: 'shortcut', name: '屋上から浮き島2へ跳ぶ', p: lip, isl2, landAt: st })
    B.branches = (B.branches || []).concat([S2.path.map(q => ({ ...q, branch: true, zone: 'sky' }))]) // 近道の着地坂も道の線に入れる（自動ハンドルが上の周の道へ引っぱらない）
    B.cp('浮き島2', { w: 8, noGate: true })
    { const jm = B.marks.find(m => m.name === '助走して谷を飛ぶ'); if (jm) { jm.ends = [jm.end, B.cps[B.cps.length - 1].p.slice()]; jm.drop = 9 } }
    const al2 = (B.t.p[0] - lip[0]) * fJ[0] + (B.t.p[2] - lip[2]) * fJ[2]
    B.road(Math.max(0.5, alNow + 7 - al2), { w: 3, mat: 'snowrock', thick: 0.6 })
  }
  // 位相をずらした3つの鉄球（城の手前の細い道）
  B.road(3, { w: 3, mat: 'castle', thick: 1.2 })
  B.cp('城の手前', { w: 3, rest: true })
  B.mark('三つの鉄球')
  B.road(2, { w: 3, mat: 'castle', thick: 1.2 })
  for (let k = 0; k < 3; k++) B.pendulum(2.5 + k * 4.5, { w: 3, T: 3.0, ph: -k * (2 * Math.PI / 3.0) * 0.9 }) // 5m/s で通ると、どれも同じ間合いで抜けられる（その速さを見つけるのが工夫）
  B.road(16, { w: 3, mat: 'castle', thick: 1.2 })
  // 城へ: 急な登り（前重心）→ 跳ねる段 → 城の門
  B.road(3, { w: 3, mat: 'castle', thick: 1.2 })
  B.road(3, { w: 2.8, slope: 19 * DEG, mat: 'castle', thick: 0.9, kind: 'ramp' })
  B.road(11, { w: 2.8, slope: 36.5 * DEG, mat: 'castle', thick: 0.9, kind: 'steep' }) // 36.5 度の急な登り（勢いで一気に。歩く人は 35 度まで）
  B.road(3, { w: 2.8, slope: 19 * DEG, mat: 'castle', thick: 0.9, kind: 'ramp' })
  B.road(3, { w: 2.8, mat: 'castle', thick: 0.9 }); B.torch(1, 1, { w: 2.8, down: 1 }); B.torch(-1, 1, { w: 2.8, down: 1 })
  for (let i = 0; i < 3; i++) { B.step(0.28); B.road(2.4, { w: 2.8, mat: 'castle', thick: 1.0, noOverlap: true }) }
  finale(B) // v32 崩れ落ちる空中回廊・天空城への大ジャンプ（js/finale.js）
  B.road(8, { w: 10, mat: 'castle', thick: 2.6 })
  B.cp('天空城 外門', { w: 10, finish: true })
  B.road(12, { w: 10, mat: 'castle', thick: 3.0 })
  // 門の前の広場も「浮いた広場」として、下に岩・持ち送り・垂れる鎖を付ける
  for (const sh of B.shapes.slice(-12)) if (sh.type === 'box' && sh.tag === 'road' && sh.mat === 'castle' && sh.h[2] >= 2) B.plats.push({ c: [sh.c[0] + sh.ax[1][0] * sh.h[1], sh.c[1] + sh.h[1], sh.c[2] + sh.ax[1][2] * sh.h[1]], h: [sh.h[0], sh.h[2]], yaw: sh.base.yaw, zone: 'castle', thick: sh.h[1] * 2 })
  castle(B)
  v36traps(B) // v36 単調な道の罠と猿の追いかけ（js/traps.js）
  addFlagsBefore(B, [['ウィリーの溝', '溝の手前'], ['崩れていく石の橋', '石の橋の手前']]) // v36 難所の前に旗（tools/flagneed.mjs: 旗から 40 秒以上かかり、人の速さ bot がくり返し失敗していた所）
  addSupports(B)
  towerDressing(B)
  return finishCourse(B, { id: 'stage1', name: '第1面 奈落から天空へ', killBelow: 10, spawnBack: 2, climb: true, groundKill: true })
}
// 塔の壁の柱（当たりあり。ほとんど壁に埋まり、張り出しの内側へ 0.15m だけ出る）と、張り出しの外の縁の欠けた低い石の縁（当たりあり）
function towerDressing(B) {
  let sd = 77; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
  B.pillars = []
  // v16: 塔ごとに本体の円柱と柱。塔の頭は、道が離れた高さより crown だけ上（屋上を走る最後の塔は屋上の高さ）
  for (const T of B.towers) {
    T.top2 = T.roof ? T.top : T.top + T.crown
    B.cyl({ a: [T.cx, B.lavaY - 4, T.cz], b: [T.cx, T.top2, T.cz], r: T.r, mat: 'tower', tag: 'tower', zone: 'tower' })
    T.pillars = []
    const n = Math.max(9, Math.round(T.r * 0.87))
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + (rr() - 0.5) * 0.16
      const x = T.cx + dcos(a) * (T.r - 0.17), z = T.cz - dsin(a) * (T.r - 0.17) // 道の内側へ出るのは 0.15m だけ
      B.cyl({ a: [x, B.lavaY - 2, z], b: [x, T.top2 - 0.35, z], r: 0.32, mat: 'tower', tag: 'pillar', zone: 'tower' })
      T.pillars.push(a)
    }
  }
  B.pillars = B.towers.length ? B.towers[0].pillars : []
  const onTowerArc = s => B.towers.some(T => Math.abs(s.cx - T.cx) < 0.01 && Math.abs(s.cz - T.cz) < 0.01 && Math.abs(s.r1 - T.r) < 0.01)
  const towerOf = s => B.towers.find(T => Math.abs(s.cx - T.cx) < 0.01 && Math.abs(s.cz - T.cz) < 0.01)
  // 欠けた石の縁: 張り出し（塔のまわりの arc）の外の 0.3m に、長さ・高さ・すき間がばらばらの石の塊
  // 道の点を 3m の格子に入れて、近くだけ調べる（遅い端末でも読み込みを速く）
  const PG = new Map(), pk = (x, z) => Math.floor(x / 3) * 100003 + Math.floor(z / 3)
  for (const q of B.path) if (q.p) { const k = pk(q.p[0], q.p[2]); let L = PG.get(k); if (!L) PG.set(k, L = []); L.push(q) }
  const nearPts = (p, rh, fn) => { const r = Math.ceil(rh / 3); const i0 = Math.floor(p[0] / 3), k0 = Math.floor(p[2] / 3); for (let di = -r; di <= r; di++) for (let dk = -r; dk <= r; dk++) for (const q of PG.get((i0 + di) * 100003 + (k0 + dk)) || []) if (fn(q)) return true; return false }
  const near = (p, kinds, rh) => nearPts(p, rh, q => kinds.includes(q.kind) && Math.hypot(q.p[0] - p[0], q.p[2] - p[2]) < rh && Math.abs(q.p[1] - p[1]) < 1.6)
  // 張り出しの外の、一段低い崩れた石の縁（幅 2.6m・道より 0.45m 低い）。上の周から落ちた時に、ここへ着地して登り直せる
  const APRON = 2.6, ADROP = 0.45
  // 区間の中で下の周ほど幅を広くする（段々の張り出し）。上の周から外へ落ちても、すぐ下の周の縁に届く
  const ztop = {}; for (const q of B.path) if (q.p) ztop[q.zone || B.zoneOf?.(q)] = Math.max(ztop[q.zone] ?? -1e9, q.p[1])
  const zoneAt = i => { let z = 'ground'; for (const m of B.zoneMarks) if (m.i <= i) z = m.zone; return z }
  { const zt = {}; B.path.forEach((q, i) => { if (!q.p) return; const z = zoneAt(i); zt[z] = Math.max(zt[z] ?? -1e9, q.p[1]) }); Object.assign(ztop, zt) }
  for (const s of B.shapes.slice()) {
    if (s.type !== 'arc' || s.tag !== 'road' || !onTowerArc(s)) continue
    const ym = s.y0 + s.b * (s.phi1 - s.phi0) / 2, top = ztop[s.zone] ?? ym
    const APRW = Math.min(9, APRON + 0.2 * Math.max(0, top - ym))
    const a = B.arc({ cx: s.cx, cz: s.cz, r1: s.r2, r2: s.r2 + APRW, phi0: s.phi0, phi1: s.phi1, y0: s.y0 - ADROP, b: s.b, thick: 0.7, mat: 'ruinwall', tag: 'apron', zone: s.zone })
    a.apronOf = s.id
  }
  for (const s of B.shapes.slice()) for (const edge of ['out', 'in']) {
    if (s.type !== 'arc' || (s.tag !== 'road' && s.tag !== 'apron')) continue
    const onTower = onTowerArc(s)
    if (s.tag === 'apron' && edge === 'in') continue
    if (onTower && s.tag === 'road') continue // 道の外の縁の石は、一段低い縁の外側へ移した
    if (!onTower && s.tag !== 'apron' && (s.r2 - s.r1 < 2.4 || towerOf(s))) continue
    const rp = edge === 'out' ? s.r2 - 0.16 : s.r1 + 0.16, L = (s.phi1 - s.phi0) * rp
    let d = 0.4 + rr() * 1.2
    while (d < L - 0.8) {
      const len = 0.9 + rr() * 1.8, ph = s.phi0 + (d + len / 2) / rp
      if ((d + len) > L - 0.3) break
      const y = s.y0 + s.b * (ph - s.phi0), p = [s.cx + dcos(ph) * rp, y, s.cz - dsin(ph) * rp]
      // 別の道が近くを横切る所（屋上の助走路が下の張り出しの上を通る所など）には置かない
      const tang = ph + Math.PI / 2, cross = nearPts(p, 2.8, q => q.yaw != null && Math.hypot(q.p[0] - p[0], q.p[2] - p[2]) < 2.8 && Math.abs(q.p[1] - y) < 2.4 && Math.abs(Math.sin(q.yaw - tang)) > 0.35)
      if (!cross && !near(p, ['jump', 'stepUp', 'stepDown', 'lip', 'bump', 'water', 'mud', 'draw'], 1.6) && !near(p, ['bump', 'curve'], 2.6)) { // 丸太は曲がりの中で道の縁より外へ出るので広めに・屋上へ曲がる道（curve）の横にも置かない（v17）
        const h = 0.32 + rr() * 0.3, slope = Math.atan2(s.b, rp)
        const yaw = ph + Math.PI / 2
        const mat = s.mat === 'grate' ? 'rust' : s.mat === 'ice' || s.mat === 'snowrock' ? 'snowrock' : s.mat === 'basalt' ? 'basalt' : s.mat === 'plank' ? 'plankold' : 'ruinwall'
        B.box({ c: [p[0], y + h / 2 - 0.12, p[2]], h: [len / 2, h / 2 + 0.06, 0.15], yaw, pitch: slope, roll: (rr() - 0.5) * 0.06, mat, tag: 'parapet', zone: s.zone })
      }
      d += len + 0.25 + rr() * 0.8
    }
  }
}
function datanYaw(d) { return datan2(-d[2], d[0]) }

// H 形の鉄骨（上のフランジが走る面）。今の位置から len
export function hbeam(B, len, w, slope, kind) {
  const t = B.t, f = B.dir(t.yaw, slope), up = B.upv(t.yaw, slope)
  const p0 = t.p.slice()
  B.road(len, { w, slope, mat: 'girder', thick: 0.12, kind: kind || 'narrow', back: 0 })
  const mid = add3(p0, f, len / 2)
  B.box({ c: add3(mid, up, -0.12 - 0.3), h: [len / 2, 0.3, 0.05], yaw: t.yaw, pitch: slope, mat: 'girder', tag: 'web' })
  B.box({ c: add3(mid, up, -0.12 - 0.6 - 0.06), h: [len / 2, 0.06, w / 2], yaw: t.yaw, pitch: slope, mat: 'girder', tag: 'flange' })
}
// 浮き島: 上の平らな面（top）と、下に重ねた岩の塊
export function floatIsland(B, p, yaw, a, b, deep = 2) {
  // 浮き島: 上の平らな面と、下に重ねた岩の塊（deep 段。下の道に届かない深さにする）
  B.box({ c: [p[0], p[1] - 0.15, p[2]], h: [a, 0.15, b], yaw, mat: 'rock', tag: 'island' })
  B.box({ c: [p[0], p[1] - 0.3 - 1.6, p[2]], h: [a * 0.9, 1.6, b * 0.9], yaw, mat: 'rockdark', tag: 'island' })
  if (deep > 1) B.box({ c: [p[0], p[1] - 0.3 - 3.2 - 1.2, p[2]], h: [a * 0.6, 1.2, b * 0.55], yaw: yaw + 0.3, mat: 'rockdark', tag: 'island' })
}
function addCliffWall(B, c0, len) {
  // 崖沿いの道の左側に、地面から立ち上がる岩壁。道の左の縁にぴったり付ける（道の上には出さない）
  const f = B.dir(c0.yaw), L = B.right(c0.yaw)
  for (let i = 0; i * 9 < len; i++) {
    const c = add3(add3(c0.p, f, 4.5 + i * 9), L, -(1.3 + 3))
    const top = c0.p[1] + 2.4 + i * 9 * 0.1 + 5
    B.box({ c: [c[0], (top - 1) / 2, c[2]], h: [4.6, (top + 1) / 2, 3], yaw: c0.yaw, mat: 'rockdark', tag: 'wall' })
  }
}
// 近道③: 浮き島2の滑走路からジャンプ台で跳び、パイプの先の台へ
function makeRunway(B, rs) {
  const S = new Builder(); S.shapes = B.shapes; S.path = []; S.zone = 'pipe'
  const L = S.right(rs.yaw)
  S.t = { p: add3(rs.p, L, -4.6), yaw: rs.yaw }
  S.road(20, { w: 2.2, slope: 6 * DEG, mat: 'wood', thick: 0.3, back: 0, kind: 'runway' })
  // 支柱（島まで）
  for (const d of [6, 13, 19]) { const f = S.dir(rs.yaw, 6 * DEG), p = add3(add3(rs.p, L, -4.6), f, d); for (const sg of [-1, 1]) { const q = add3(p, L, sg * 0.9); S.cyl({ a: [q[0], rs.p[1] - 1, q[2]], b: [q[0], q[1] - 0.3, q[2]], r: 0.1, mat: 'pole', tag: 'post' }) } }
  S.kicker(2.6, 18 * DEG, { w: 2.0, mat: 'wood', thick: 0.3 })
  B.notes.push({ kind: 'shortcut', name: '滑走路から跳ぶ', p: S.t.p.slice() })
  return S.path
}
function makeGapJump(B, fork, target) {
  // 分かれ道から真っすぐ、外門の前の門まで: 道 → ジャンプ台 → すき間 → 着地の板
  const S = new Builder(); S.shapes = B.shapes; S.path = []; S.zone = 'sky'
  S.t = { p: fork.p.slice(), yaw: fork.yaw }
  const f = S.dir(fork.yaw)
  const dist = (target[0] - fork.p[0]) * f[0] + (target[2] - fork.p[2]) * f[2]
  S.road(3.5, { w: 1.6, mat: 'asphalt', thick: 0.45, back: 0 })
  const rise = S.kicker(2.4, 14 * DEG, { w: 1.6, mat: 'steel' })
  const land = dist - 3.5 - 12
  S.gap(land, 0, 'jump')
  S.road(12 - 1.6, { w: 2.2, mat: 'steel', thick: 0.45 })
  B.notes.push({ kind: 'shortcut', name: '空中道路のすき間', p: fork.p.slice() })
  return S.path
}
// 天空城（ゴールの先）。全部当たりのある形で作る（近づけば見た目どおりに当たる）
function castle(B) {
  const t = B.t, f = B.dir(t.yaw), R = B.right(t.yaw)
  const base = add3(t.p, f, 14)
  const at = (fw, side, up) => add3(add3(add3(base, f, fw), R, side), [0, 1, 0], up)
  B.zone = 'castle'
  // 城の土台の岩（逆さの山）
  B.box({ c: at(10, 0, -3), h: [26, 3, 26], yaw: t.yaw, mat: 'stone', tag: 'castle' })
  if (B.plats) { const c0 = at(10, 0, 0); B.plats.push({ c: c0, h: [26, 26], yaw: t.yaw, zone: 'castle', thick: 6 }) }
  B.box({ c: at(10, 0, -12), h: [20, 6, 20], yaw: t.yaw + 0.4, mat: 'rockdark', tag: 'castle' })
  B.box({ c: at(10, 0, -24), h: [12, 6, 12], yaw: t.yaw + 0.9, mat: 'rockdark', tag: 'castle' })
  B.box({ c: at(10, 0, -34), h: [5, 5, 5], yaw: t.yaw + 1.3, pitch: 0.3, mat: 'rockdark', tag: 'castle' })
  // 外壁と門
  for (const s of [-1, 1]) B.box({ c: at(0, s * 9, 6), h: [1.5, 6, 6.5], yaw: t.yaw, mat: 'castle', tag: 'castle' })
  B.box({ c: at(0, 0, 10.5), h: [1.5, 1.5, 2.5], yaw: t.yaw, mat: 'castle', tag: 'castle' })
  for (const s of [-1, 1]) B.cyl({ a: at(0, s * 16, 0), b: at(0, s * 16, 16), r: 3, mat: 'castle', tag: 'castle' })
  // 奥の天守と塔
  B.box({ c: at(14, 0, 9), h: [8, 9, 10], yaw: t.yaw, mat: 'castle', tag: 'castle' })
  B.cyl({ a: at(14, 0, 18), b: at(14, 0, 34), r: 5, mat: 'castle', tag: 'castle' })
  B.cyl({ a: at(22, 10, 0), b: at(22, 10, 28), r: 3.4, mat: 'castle', tag: 'castle' })
  B.cyl({ a: at(22, -10, 0), b: at(22, -10, 24), r: 3.4, mat: 'castle', tag: 'castle' })
  B.cyl({ a: at(6, -16, 16), b: at(6, -16, 22), r: 2.2, mat: 'castle', tag: 'castle' })
  B.decor.push({ kind: 'roof', p: at(14, 0, 34), r: 6.2, h: 9 }, { kind: 'roof', p: at(22, 10, 28), r: 4.2, h: 7 }, { kind: 'roof', p: at(22, -10, 24), r: 4.2, h: 7 }, { kind: 'roof', p: at(0, 16, 16), r: 3.8, h: 6 }, { kind: 'roof', p: at(0, -16, 16), r: 3.8, h: 6 })
  B.castleAt = at(14, 0, 20)
}

// v36 区間（mark）の始まりの少し手前の、平らでまっすぐな道の点に休憩所の旗を足す（道は変えない）。旗の番号がずれるので、旗の飾りの番号も直す
function addFlagsBefore(B, list) {
  B.closeMark()
  const P = B.path, cpI = q => { let bi = 0, bd = 1e18; P.forEach((z, k) => { if (!z.p) return; const d = (z.p[0] - q.p[0]) ** 2 + (z.p[2] - q.p[2]) ** 2 + ((z.p[1] - q.p[1]) * 2) ** 2; if (d < bd) { bd = d; bi = k } }); return bi }
  const idx = B.cps.map(cpI)
  for (const [mark, name] of list) {
    const m = (B.marks || []).find(x => x.name === mark); if (!m) continue
    // v39: 旗のすぐ先（12 点以内）に切れ目・縁があると助走が取れない（石の橋の手前の旗が切れ目の 4m 手前で、出し直すと跳び切れず転び続けた）
    const runOk = i => { for (let k = i + 1; k <= i + 12 && k < m.i0; k++) if (P[k] && ['jump', 'lip', 'hang'].includes(P[k].kind)) return false; return true }
    let i = m.i0 - 2; while (i > m.i0 - 45 && !(P[i] && P[i].p && P[i].w >= 3 && ['road', 'orbit', 'pad', 'curve'].includes(P[i].kind) && Math.abs(P[i].slope || 0) < 0.08 && ['road', 'orbit', 'pad', 'curve', 'water'].includes((P[i + 3] || {}).kind) && ['road', 'orbit', 'pad', 'curve'].includes((P[i - 3] || {}).kind) && runOk(i))) i--
    const q = P[i], at = idx.findIndex(k => k > i), pos = at < 0 ? B.cps.length : at
    const R = B.right(q.yaw), w = q.w, base = add3(q.p, R, -(w / 2 + 0.45))
    B.cps.splice(pos, 0, { p: q.p.slice(), yaw: q.yaw, w, name, zone: q.zone || B.zone, rest: true, added: true }); idx.splice(pos, 0, i)
    for (const f of B.flags) if (f.cp >= pos) f.cp++
    B.cyl({ a: add3(base, [0, 1, 0], -1.6), b: add3(base, [0, 1, 0], 3.6), r: 0.07, mat: 'pole', tag: 'gate' })
    B.flags.push({ p: base, h: 3.6, yaw: q.yaw, cp: pos })
  }
}
function finishCourse(B, o) {
  const shapes = B.shapes
  // 落ちたと見なす高さ: 門ごとに、その区間のいちばん低い道の面より killBelow 下
  const cps = B.cps
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i].p, nxt = cps[i + 1] ? cps[i + 1].p : a
    cps[i].kill = Math.min(a[1], nxt[1]) - o.killBelow
  }
  const sp = cps[0]
  B.closeMark()
  // 枝道（近道の着地坂など）は、道の線の一番最後に足す（本線の並びは変えない）
  for (const br of B.branches || []) B.path.push(...br)
  // 道の点ごとの区間
  { let k = 0; const zm = B.zoneMarks || []; for (let i = 0; i < B.path.length; i++) { while (k + 1 < zm.length && zm[k + 1].i <= i) k++; if (!(B.path[i].branch && B.path[i].zone)) B.path[i].zone = zm[k] ? zm[k].zone : 'ground' } }
  // 道の点ごとの曲がり具合（1/半径）。曲がる板は curv、直角の踊り場などは向きの変わり方から（前後 2 点で）
  const P = B.path, wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 2)], c = P[Math.min(P.length - 1, i + 2)]
    let k = Math.abs(P[i].curv || 0)
    if (a.p && c.p && a.yaw != null && c.yaw != null && a.kind !== 'jump' && c.kind !== 'jump') { const ds = Math.hypot(c.p[0] - a.p[0], c.p[2] - a.p[2]); if (ds > 0.5) k = Math.max(k, Math.abs(wrapA(c.yaw - a.yaw)) / ds) }
    P[i].kap = k
  }
  return { ...o, boulder: B.boulder || null, towers: B.towers || [], pillars: B.pillars || [], torches: B.torches, tuts: B.tuts, plats: B.plats || [], props: B.props || [], lavaY: B.lavaY, lavaKill: B.lavaKill, marks: B.marks || [], winds: B.winds || [], risers: B.risers || [], doors: B.doors || [], hazards: B.hazards || [], waters: B.waters || [], flags: B.flags || [], shapes, cps, path: B.path, signs: B.signs, decor: B.decor, notes: B.notes, cans: B.cans || [], drums: B.drums || [], traps: B.traps || [], chases: B.chases || [], v37: B.v37 || null, v37added: B.v37added || 0, tower: B.tower, castleAt: B.castleAt, spawn: { p: sp.p, yaw: sp.yaw } }
}
export const COURSES = { practice, stage1, lab16, lab17: P17.lab17 }
