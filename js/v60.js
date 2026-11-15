// SKY BIKE v60 跳ね板の三段登り（崩れる頂上の後、天空城への大ジャンプの前）
// 壁ぞいに、跳ね板 3 枚でしか登れない 3 段（1 段 K3.h）。
//   1 枚目: 前へ跳んで段 A → 段 A の奥で U ターン（右）→ 2 枚目: 来た向きへ（後ろへ）跳んで段 B（1 枚目の真上）→ 段 B の奥で U ターン → 3 枚目: 前へ跳んで頂上（段 A の真上）
// 跳ね板は後輪が引き金を過ぎた瞬間に跳ねる（physics.js v16Track の pitchT）。跳ねた瞬間の車体の角度が、目標のウィリー（pitchT ± pitchTol）から
// 外れた分だけ回される。水平・前輪から入ると前へ、立てすぎると後ろへ。惰性で後ろ体重（約 33 度で止まる）のまま入ればまっすぐ跳ぶ。
// 速すぎると奥の壁・遠くへ、遅いと段の縁に届かず下の広場へ落ちる（広場で止まると旗から）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
const UP = [0, 1, 0]
export const K3 = {
  h: +(globalThis.__k3h ?? 4.3), Ru: 3, w: 3.6, run0: 12, run: +(globalThis.__k3run ?? 6), gap: +(globalThis.__k3gap ?? 1.6), ledge: 9, ledgeB: 13.8, // 段 B は長い（3 枚目を 1 枚目の真上から後ろへずらす。1 枚目でゆっくり跳んでも頭が 3 枚目の裏に当たらない）
  k0: +(globalThis.__k3k0 ?? 10.0), kv: +(globalThis.__k3kv ?? 0.35), trigAt: +(globalThis.__k3trig ?? 1.6),
  pitchT: +(globalThis.__k3pT ?? 30) * DEG, pitchTol: +(globalThis.__k3pTol ?? 10) * DEG, pitchK: +(globalThis.__k3pK ?? 14), pitchLoss: +(globalThis.__k3pL ?? 0.9),
  vIn: +(globalThis.__k3vIn ?? 3.7),
}

// 跳ね板（前輪が浮いていても跳ねる。着地の坂なし）。返り: 板の先端（lip）
function plank3(B, n) {
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), R = B.right(yaw), Lp = 3.8, W = K3.w
  const start = t.p.slice()
  const m = { type: 'kick', axis: UP, stroke: 0.6, k0: K3.k0, kv: K3.kv, vmax: 13, hold: 0.7, back: 1.0, trigAt: K3.trigAt, start, f, ext: [0.2, 1.2, 0.2], trig: null, pitchT: K3.pitchT, pitchTol: K3.pitchTol, pitchK: K3.pitchK, pitchLoss: K3.pitchLoss, k3: n }
  const sh = B.box({ c: add3(add3(start, f, Lp / 2), UP, -0.12), h: [Lp / 2 - 0.015, 0.12, W / 2], yaw, mat: 'plank', mu: 1.05, tag: 'road', mov: m })
  B.box({ c: add3(add3(start, f, Lp / 2), UP, -0.95), h: [Lp / 2, 0.1, W / 2], yaw, mat: 'iron', tag: 'pit' })
  for (const sg of [-1, 1]) B.box({ c: add3(add3(add3(start, f, Lp / 2), R, sg * (W / 2 + 0.18)), UP, -0.35), h: [Lp / 2 + 0.2, 0.42, 0.16], yaw, mat: 'girder', tag: 'post' })
  B.decor.push({ kind: 'kick', shape: sh, Lp, W })
  const info = { m, shape: sh, n, start, f, yaw, lip: add3(start, f, Lp) }
  for (let d = 0; d < Lp - 0.01; d += 0.5) B.path.push({ p: add3(start, f, d), yaw, slope: 0, w: W, kind: 'kick', kick: { m, shape: sh }, k3: info })
  t.p = info.lip.slice(); B.last = null
  return info
}
// 跳ぶ所（gap 先の h 上へ）
function hop(B, info) {
  const t = B.t, f = B.dir(t.yaw)
  B.path.push({ p: t.p.slice(), yaw: t.yaw, slope: 0, w: 0, kind: 'jump', len: K3.gap, dy: K3.h, vJump: K3.vIn, k3jump: info })
  t.p = add3(add3(t.p, f, K3.gap), UP, K3.h); B.last = null
}
// 段の奥の U ターン（右回り）: 両方の道をまたぐ平らな板と奥の低い壁。道の線は半径 Ru の半円
function turnPad(B) {
  const t = B.t, f = B.dir(t.yaw), R = B.right(t.yaw), Ru = K3.Ru, th = 1.2
  const d0 = -0.3, d1 = Ru + 2.2, l0 = -K3.w / 2 - 0.4, l1 = 2 * Ru + K3.w / 2 + 0.4
  const c = add3(add3(t.p, f, (d0 + d1) / 2), R, (l0 + l1) / 2)
  B.box({ c: [c[0], t.p[1] - th / 2, c[2]], h: [(d1 - d0) / 2, th / 2, (l1 - l0) / 2], yaw: t.yaw, mat: 'castle', tag: 'pad' })
  B.plats.push({ c: [c[0], t.p[1], c[2]], h: [(d1 - d0) / 2, (l1 - l0) / 2], yaw: t.yaw, zone: B.zone, thick: th })
  // 奥の胸壁（高さ 1.1m。跳びすぎるとここに当たる）
  const wc = add3(add3(t.p, f, d1 + 0.3), R, (l0 + l1) / 2)
  B.box({ c: [wc[0], t.p[1] + 0.55 - 0.6, wc[2]], h: [0.3, 1.15, (l1 - l0) / 2 + 0.3], yaw: t.yaw, mat: 'ruinwall', tag: 'parapet' })
  B.torches.push([wc[0] + R[0] * ((l1 - l0) / 2), t.p[1] + 1.4, wc[2] + R[2] * ((l1 - l0) / 2)])
  B.curve(Ru, -Math.PI, { noShape: true, pw: 2 * Ru, kind: 'uturn' })
  B.last = null
}

export function kick3(B) {
  const D = { w: 4.2, mat: 'castle', thick: 1.2 }, L = { w: K3.w, mat: 'castle', thick: 0.8, back: 0 }
  B.zone = 'castle'
  B.road(3, D)
  B.cp('跳ね板の三段登り', { w: 4.2, rest: true })
  B.mark('跳ね板の三段登り')
  const y0 = B.t.p[1], yaw0 = B.t.yaw, f0 = B.dir(yaw0), R0 = B.right(yaw0)
  B.sign('ウィリーのまま 跳ね板へ', { at: 3 })
  B.road(K3.run0, { ...L, back: 0.6 })
  const P0 = B.t.p.slice(), at = (x, l, y) => [P0[0] + f0[0] * x + R0[0] * l, y, P0[2] + f0[2] * x + R0[2] * l] // x: 1 枚目の始まりから前へ・l: 右へ
  const p1 = plank3(B, 1)
  const lip1 = p1.lip.slice()
  hop(B, p1)
  B.road(K3.ledge, { ...L, kind: 'ledge3' })
  turnPad(B)
  B.road(K3.run, { ...L, kind: 'ledge3' })
  const p2 = plank3(B, 2)
  hop(B, p2)
  B.road(K3.ledgeB, { ...L, kind: 'ledge3' })
  turnPad(B)
  B.road(K3.run, { ...L, kind: 'ledge3' })
  const p3 = plank3(B, 3)
  hop(B, p3)
  B.road(10, { ...L, kind: 'landing' })
  B.road(8, { ...D, back: 0 })
  // 下の広場（落ちたらここ。止まると旗から）と、塔の側（左）の壁
  { const xa = Math.min(-K3.run0 - 1, 3.8 + K3.run - 3.8 - K3.gap - K3.ledgeB - K3.Ru - 3), xb = 3.8 + K3.gap + K3.ledge + K3.Ru + 3, la = -K3.w / 2 - 1.5, lb = 2 * K3.Ru + K3.w / 2 + 1.5, yF = y0 - 1.6
    const c = at((xa + xb) / 2, (la + lb) / 2, 0)
    const pl = B.box({ c: [c[0], yF - 0.5, c[2]], h: [(xb - xa) / 2, 0.5, (lb - la) / 2], yaw: yaw0, mat: 'cobble', tag: 'ground3' }); pl.plaza = true
    const wc = at((xa + xb) / 2, la - 0.5, 0), yB = yF - 1, yT = y0 + 3 * K3.h + 1.2
    B.box({ c: [wc[0], (yB + yT) / 2, wc[2]], h: [(xb - xa) / 2, (yT - yB) / 2, 0.5], yaw: yaw0, mat: 'ruinwall', tag: 'wall' })
    // 外側（右）の段の下の柱（段 A・段 B の右の道と U ターンの板を支える。跳ぶ所の下は避ける）
    const lo = 2 * K3.Ru + K3.w / 2 - 0.5, xA = 3.8 + K3.gap + K3.ledge, xP2 = xA - K3.run - 3.8 // 段 A の奥の端・2 枚目の先端
    for (const [x, y] of [[xA - 2.5, K3.h], [xA + K3.Ru + 1.2, K3.h], [xP2 - K3.gap - 4.5, 2 * K3.h], [xP2 - K3.gap - K3.ledgeB + 1.5, 2 * K3.h], [xP2 - K3.gap - K3.ledgeB - K3.Ru - 1.2, 2 * K3.h]]) {
      const q = at(x, lo, 0); B.cyl({ a: [q[0], yF - 0.2, q[2]], b: [q[0], y0 + y - 0.75, q[2]], r: 0.45, mat: 'castle', tag: 'pillar' })
    }
  }
  B.v60 = { lip1, y0, yaw0 }
  B.closeMark()
}
