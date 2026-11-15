// SKY BIKE v64 斜めの跳ね板から跳ね板へ（跳ね板の三段登りの後、天空城への大ジャンプの前）
// 本人「少し斜め前に傾いたはねいた→はねいた→道って感じのところも」: 前が低く傾いた 1 枚目で前上へ跳び、道を挟まずに 1 段上の 2 枚目へ着く。
// 2 枚目は空中から後輪が着いた瞬間に跳ね、さらに 1 段上の道へ。どちらも跳ねる速さはバイクに直接与える（physics.js v16Track の m.chain）。
// 1 枚目: 跳ね上がる速さ vy = k0 + kv × 入った速さ、前へも fwd × vy 押す。板に対して水平〜軽いウィリーなら狙い通り、立てすぎると後ろへ回されて弱くなる。
//   遅いと 2 枚目の台の壁に当たって下の広場へ、速すぎると 2 枚目を越えて上の道の壁に当たる（広場で止まると旗から）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
const UP = [0, 1, 0]
const G = k => globalThis['__kc' + k]
export const KC = {
  w: 3.6, run0: +(G('run0') ?? 6), pre: +(G('pre') ?? 4), tilt: +(G('tilt') ?? 10) * DEG, tilt2: +(G('tilt2') ?? 0) * DEG, L1: 3.8, L2: 5.2,
  x2: +(G('x2') ?? 9), h1: +(G('h1') ?? 1.5), gap2: +(G('gap2') ?? 4), h2: +(G('h2') ?? 3.2),
  k1: +(G('k1') ?? 5.9), kv1: +(G('kv1') ?? 0.22), fwd: +(G('fwd') ?? 0.18), vfCap: +(G('vfCap') ?? 7.5), vfK: +(G('vfK') ?? 0.2), trig1: +(G('trig1') ?? 1.4),
  pT1: +(G('pT1') ?? 8) * DEG, pTol1: +(G('pTol1') ?? 12) * DEG,
  k2: +(G('k2') ?? 7.2), kv2: +(G('kv2') ?? 0.15), vmin2: +(G('vmin2') ?? 10.5), fwd2: +(G('fwd2') ?? 0),
  pK: +(G('pK') ?? 10), pL: +(G('pL') ?? 0.9),
  vIn: +(G('vIn') ?? 7.5),
}

// 跳ね板（pitch: 前が低い角度。返り: 板の情報）
function plankC(B, n, o) {
  const t = B.t, yaw = t.yaw, pitch = -(o.tilt || 0), f = B.dir(yaw), fs = B.dir(yaw, pitch), us = B.upv(yaw, pitch), R = B.right(yaw), Lp = o.len, W = KC.w
  const start = t.p.slice()
  const ax = o.tilt ? us : UP /* 斜めの板は板に垂直に跳ね上がる */
  const m = { type: 'kick', chain: true, axis: ax, stroke: 0.5, k0: o.k0, kv: o.kv, vmin: o.vmin || 0, vmax: 13, hold: 0.6, back: 1.0, trigAt: o.trigAt, start, f, ext: [0.3, 1.2, 0.3], trig: null, anyWheel: !!o.anyWheel,
    pitchT: o.pT, pitchTol: o.pTol, pitchK: KC.pK, pitchLoss: KC.pL, pitch0: pitch, fwd: o.fwd || 0, vfCap: o.vfCap, vfK: o.vfK, kc: n }
  const mid = add3(start, fs, Lp / 2)
  const sh = B.box({ c: add3(mid, us, -0.12), h: [Lp / 2 - 0.015, 0.12, W / 2], yaw, pitch, mat: 'plank', mu: 1.05, tag: 'road', mov: m })
  B.box({ c: add3(mid, us, -0.95), h: [Lp / 2, 0.1, W / 2], yaw, pitch, mat: 'iron', tag: 'pit' })
  for (const sg of [-1, 1]) B.box({ c: add3(add3(mid, R, sg * (W / 2 + 0.18)), us, -0.35), h: [Lp / 2 + 0.2, 0.42, 0.16], yaw, pitch, mat: 'girder', tag: 'post' })
  B.decor.push({ kind: 'kick', shape: sh, Lp, W })
  const info = { m, shape: sh, n, start, f, yaw, lip: add3(start, fs, Lp), Lp }
  for (let d = 0; d < Lp - 0.01; d += 0.5) B.path.push({ p: add3(start, fs, d), yaw, slope: pitch, w: W, kind: 'kick', kc: info })
  t.p = info.lip.slice(); B.last = null
  return info
}

export function kickChain(B) {
  const D = { w: 4.2, mat: 'castle', thick: 1.2 }, L = { w: KC.w, mat: 'castle', thick: 0.8, back: 0 }
  B.zone = 'castle'
  B.road(3, D)
  B.cp('斜めの跳ね板', { w: 4.2, rest: true })
  B.mark('斜めの跳ね板から跳ね板へ')
  const y0 = B.t.p[1], yaw0 = B.t.yaw, f0 = B.dir(yaw0), R0 = B.right(yaw0)
  B.sign('速すぎず 2 枚続けて', { at: 3 })
  B.road(KC.run0, { ...L, back: 0.6 })
  const P0 = B.t.p.slice(), at = (x, l, y) => [P0[0] + f0[0] * x + R0[0] * l, y, P0[2] + f0[2] * x + R0[2] * l] // x: 下り始めから前へ・l: 右へ
  B.road(KC.pre, { ...L, slope: -KC.tilt, kind: 'road' }) // 板と同じ傾きの短い下り（速く入っても板の上で浮かない）
  const xs1 = KC.pre * Math.cos(KC.tilt), ys1 = y0 - KC.pre * Math.sin(KC.tilt) // 1 枚目の始まり
  const p1 = plankC(B, 1, { tilt: KC.tilt, len: KC.L1, k0: KC.k1, kv: KC.kv1, fwd: KC.fwd, vfCap: KC.vfCap, vfK: KC.vfK, trigAt: KC.trig1, pT: KC.pT1, pTol: KC.pTol1 })
  // 1 枚目の先から 2 枚目へ（道なし）。2 枚目も同じに前が低い（1 枚目から跳んだ向きのまま着く）
  const x1 = xs1 + KC.L1 * Math.cos(KC.tilt), yL1 = ys1 - KC.L1 * Math.sin(KC.tilt), xs2 = xs1 + KC.x2, ys2 = ys1 + KC.h1
  B.path.push({ p: p1.lip.slice(), yaw: yaw0, slope: 0, w: 0, kind: 'jump', len: xs2 - x1, dy: ys2 - yL1, vJump: KC.vIn, kcJump: p1 })
  B.t.p = at(xs2, 0, ys2); B.last = null
  const p2 = plankC(B, 2, { tilt: KC.tilt2, len: KC.L2, k0: KC.k2, kv: KC.kv2, vmin: KC.vmin2, fwd: KC.fwd2, trigAt: -0.8, pT: 0, pTol: 22 * DEG, anyWheel: true })
  const x2e = xs2 + KC.L2 * Math.cos(KC.tilt2), y2e = ys2 - KC.L2 * Math.sin(KC.tilt2)
  const x3 = x2e + KC.gap2, y3 = ys2 + KC.h2
  B.path.push({ p: p2.lip.slice(), yaw: yaw0, slope: 0, w: 0, kind: 'jump', len: KC.gap2, dy: y3 - y2e, vJump: KC.vIn, kcJump: p2 })
  B.t.p = at(x3, 0, y3); B.last = null
  B.road(10, { ...L, kind: 'landing' })
  B.road(8, { ...D, back: 0 })
  // 下の広場（落ちたらここ。止まると旗から）・2 枚目の台・上の道の下の壁
  { const yF = ys1 - 1.8, xa = -KC.run0 - 1, xb = x3 + 3, la = -KC.w / 2 - 3.5, lb = KC.w / 2 + 3.5
    const c = at((xa + xb) / 2, (la + lb) / 2, 0)
    const pl = B.box({ c: [c[0], yF - 0.5, c[2]], h: [(xb - xa) / 2, 0.5, (lb - la) / 2], yaw: yaw0, mat: 'cobble', tag: 'ground3' }); pl.plaza = true
    const yP = y2e - 1.1, c2 = at((xs2 + x2e) / 2, 0, 0)
    B.box({ c: [c2[0], (yF + yP) / 2, c2[2]], h: [(x2e - xs2) / 2 + 0.2, (yP - yF) / 2, KC.w / 2 + 0.35], yaw: yaw0, mat: 'castle', tag: 'wall' })
    const yU = y3 - 0.8, c3 = at(x3 + 2, 0, 0)
    B.box({ c: [c3[0], (yF + yU) / 2, c3[2]], h: [2, (yU - yF) / 2, KC.w / 2], yaw: yaw0, mat: 'ruinwall', tag: 'wall' })
    const q = at((xs1 + x1) / 2 - 1, 0, 0); B.box({ c: [q[0], (yF + yL1 - 1.1) / 2, q[2]], h: [(x1 - xs1) / 2 + 1, (yL1 - 1.1 - yF) / 2, KC.w / 2 - 0.3], yaw: yaw0, mat: 'castle', tag: 'pillar' })
    for (const sg of [-1, 1]) { const tq = at(x2e, sg * (KC.w / 2 + 0.6), 0); B.torches.push([tq[0], ys2 + 1.6, tq[2]]) }
  }
  B.v64 = { y0, yaw0, P0 }
  B.closeMark()
}
