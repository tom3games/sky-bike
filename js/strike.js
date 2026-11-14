// SKY BIKE v32 横から飛んできたカラスがライダーに当たる（1 回の走りで 1 回だけ。出し直すと戻る）
// 場所: 終盤（道の点の 78〜96%）の、前後 16 点がまっすぐ平らで広い道（縁・切れ目・細い道のない所）
// 当たり: バイクがその点を通った瞬間に、横へ 2.3m/s・前への速さを 1 割落とす（転ばない・道から落ちない量）。バイクの状態だけで決まる（ゴーストも同じ）
export function strikerSpot(course) {
  const P = course.path, N = P.findIndex(q => q.branch) > 0 ? P.findIndex(q => q.branch) : P.length
  const ok = q => q && q.p && !q.branch && q.w >= 4 && ['road', 'orbit', 'pad'].includes(q.kind) && Math.abs(q.slope || 0) < 0.07 && (q.kap || 0) < 0.035 && !q.door
  for (let i = Math.floor(N * 0.78); i < N * 0.96; i++) {
    let good = true; for (let k = i - 16; k <= i + 16; k++) if (!ok(P[k])) { good = false; break }
    if (!good) continue
    const q = P[i]
    return { p: q.p.slice(), yaw: q.yaw, i, w: q.w, strike: true, side: 1 }
  }
  return null
}
export const STRIKE_DV = 2.3
// 返り: 'hit'（今当たった）・'near'（もうすぐ。見た目の飛び出しの合図。along は残りの m）・null
export function crowPush(b, S) {
  if (!S || b._strikeDone || b.crashed || b.ghostNo) return null
  const hx = Math.cos(S.yaw), hz = -Math.sin(S.yaw), rx = Math.sin(S.yaw), rz = Math.cos(S.yaw)
  const dx = b.p[0] - S.p[0], dz = b.p[2] - S.p[2], along = dx * hx + dz * hz, lat = dx * rx + dz * rz, dy = b.p[1] - 0.8 - S.p[1]
  if (Math.abs(lat) > S.w / 2 + 1 || Math.abs(dy) > 2.5 || along < -30 || along > 4) return null
  if (along < 0) return { t: 'near', along }
  if (!b.g[0] && !b.g[1]) { if (along > 3) b._strikeDone = true; return null } // 跳ねて浮いている間は待つ（3m 過ぎたら出さない）
  b._strikeDone = true
  const vf = b.v[0] * hx + b.v[2] * hz
  b.v[0] += -S.side * rx * STRIKE_DV - hx * vf * 0.1; b.v[2] += -S.side * rz * STRIKE_DV - hz * vf * 0.1
  return { t: 'hit', h: [hx, hz] }
}
