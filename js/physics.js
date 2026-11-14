// SKY BIKE — 物理（ブラウザと node の両方で動く。three に依存しない）
// 決まった刻み: 入力 60Hz × 8 分割 = 480Hz。Math.sin/cos/atan2/pow/hypot を使わない（端末差を出さない）。
// ステージの形は box（傾けた箱）/ cyl（円柱）/ arc（らせんの道の板）だけ。見た目も同じデータから作る。

export const DT = 1 / 60, SUB = 8, H = DT / SUB
// ハンドルの切れる量の上限 = STEER_DK / 速さ²（速いほど少し）。v11 で 20 → 32（全開でも塔のまわりの道を曲がれる）
export const STEER_DK = 32
const PI = 3.141592653589793, TAU = 6.283185307179586, HALF_PI = 1.5707963267948966

// ------------------------------------------------------------ 決定的な三角関数
export function dsin(x) {
  x = x - TAU * Math.round(x / TAU)
  if (x > HALF_PI) x = PI - x; else if (x < -HALF_PI) x = -PI - x
  const x2 = x * x
  return x * (1 + x2 * (-1 / 6 + x2 * (1 / 120 + x2 * (-1 / 5040 + x2 * (1 / 362880 + x2 * (-1 / 39916800 + x2 * (1 / 6227020800 + x2 * (-1 / 1307674368000))))))))
}
export const dcos = x => dsin(x + HALF_PI)
function datanUnit(x) { // |x| <= 1
  let off = 0
  if (x > 0.41421356237309503) { off = PI / 4; x = (x - 1) / (x + 1) }
  else if (x < -0.41421356237309503) { off = -PI / 4; x = (x + 1) / (1 - x) }
  const x2 = x * x
  let s = 0, p = x
  for (let k = 0; k < 14; k++) { s += p / (2 * k + 1) * (k & 1 ? -1 : 1); p *= x2 }
  return off + s
}
export function datan2(y, x) {
  if (x === 0 && y === 0) return 0
  const ax = x < 0 ? -x : x, ay = y < 0 ? -y : y
  let a = ay <= ax ? datanUnit(ay / ax) : HALF_PI - datanUnit(ax / ay)
  if (x < 0) a = PI - a
  return y < 0 ? -a : a
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v

// ------------------------------------------------------------ 形
// box: c 中心, h 半分の大きさ [前後, 上下, 左右], yaw/pitch/roll（度ではなくラジアン）
export function makeBox(o) {
  const cy = dcos(o.yaw || 0), sy = dsin(o.yaw || 0), cp = dcos(o.pitch || 0), sp = dsin(o.pitch || 0), cr = dcos(o.roll || 0), sr = dsin(o.roll || 0)
  const f = [cy * cp, sp, -sy * cp]
  const u0 = [-cy * sp, cp, sy * sp]
  const r0 = [sy, 0, cy]
  const up = [u0[0] * cr + r0[0] * sr, u0[1] * cr + r0[1] * sr, u0[2] * cr + r0[2] * sr]
  const rt = [r0[0] * cr - u0[0] * sr, r0[1] * cr - u0[1] * sr, r0[2] * cr - u0[2] * sr]
  const s = { type: 'box', c: o.c.slice(), h: o.h.slice(), ax: [f, up, rt], mat: o.mat || 'rock', mu: o.mu ?? 1.05, tag: o.tag || '', base: { c: o.c.slice(), yaw: o.yaw || 0, pitch: o.pitch || 0, roll: o.roll || 0 }, mov: o.mov || null }
  s.bb = [0, 1, 2].map(k => Math.abs(f[k]) * s.h[0] + Math.abs(up[k]) * s.h[1] + Math.abs(rt[k]) * s.h[2])
  s.min = [s.c[0] - s.bb[0], s.c[1] - s.bb[1], s.c[2] - s.bb[2]]
  s.max = [s.c[0] + s.bb[0], s.c[1] + s.bb[1], s.c[2] + s.bb[2]]
  return s
}
export function makeCyl(o) {
  const a = o.a, b = o.b, d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const L = Math.sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2])
  const s = { type: 'cyl', a: a.slice(), b: b.slice(), d: [d[0] / L, d[1] / L, d[2] / L], L, r: o.r, mat: o.mat || 'metal', mu: o.mu ?? 0.95, tag: o.tag || '' }
  s.min = [0, 1, 2].map(k => Math.min(a[k], b[k]) - o.r); s.max = [0, 1, 2].map(k => Math.max(a[k], b[k]) + o.r)
  return s
}
// arc: 中心 (cx,cz) の周りの、内側 r1・外側 r2 の板。角度 phi0→phi1（左回り＝上から見て反時計）、
//      上面の高さ y0（phi0 の所）から 1 ラジアンにつき b 上がる。厚さ thick
export function makeArc(o) {
  const s = { type: 'arc', cx: o.cx, cz: o.cz, r1: o.r1, r2: o.r2, phi0: o.phi0, phi1: o.phi1, y0: o.y0, b: o.b || 0, thick: o.thick || 0.8, mat: o.mat || 'stone', mu: o.mu ?? 1.05, tag: o.tag || '' }
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
  for (let i = 0; i <= 24; i++) {
    const ph = s.phi0 + (s.phi1 - s.phi0) * i / 24
    for (const r of [s.r1, s.r2]) {
      const x = s.cx + r * dcos(ph), z = s.cz - r * dsin(ph), y = s.y0 + s.b * (ph - s.phi0)
      mn[0] = Math.min(mn[0], x); mx[0] = Math.max(mx[0], x); mn[2] = Math.min(mn[2], z); mx[2] = Math.max(mx[2], z)
      mn[1] = Math.min(mn[1], y - s.thick * 1.2); mx[1] = Math.max(mx[1], y)
    }
  }
  const pad = s.r2 * (1 - dcos((s.phi1 - s.phi0) / 48)) + 0.05
  s.min = [mn[0] - pad, mn[1] - 0.05, mn[2] - pad]; s.max = [mx[0] + pad, mx[1] + 0.05, mx[2] + pad]
  return s
}

// closest(sh, p) → out: q（形の表面の一番近い点）, n（q から p へ。中なら外向き）, d（符号つき距離。中は負）, feat（0中 1面 2辺 3角）
const OUT = { q: [0, 0, 0], n: [0, 1, 0], d: 0, feat: 1 }
function closestBox(s, px, py, pz, o) {
  const dx = px - s.c[0], dy = py - s.c[1], dz = pz - s.c[2]
  const A = s.ax, h = s.h
  const l = [dx * A[0][0] + dy * A[0][1] + dz * A[0][2], dx * A[1][0] + dy * A[1][1] + dz * A[1][2], dx * A[2][0] + dy * A[2][1] + dz * A[2][2]]
  if (l[0] <= h[0] && l[0] >= -h[0] && l[1] <= h[1] && l[1] >= -h[1] && l[2] <= h[2] && l[2] >= -h[2]) {
    let k = 0, best = h[0] - Math.abs(l[0])
    for (let i = 1; i < 3; i++) { const g = h[i] - Math.abs(l[i]); if (g < best) { best = g; k = i } }
    const sg = l[k] >= 0 ? 1 : -1
    o.n[0] = A[k][0] * sg; o.n[1] = A[k][1] * sg; o.n[2] = A[k][2] * sg
    o.q[0] = px + o.n[0] * best; o.q[1] = py + o.n[1] * best; o.q[2] = pz + o.n[2] * best
    o.d = -best; o.feat = 0
    return o
  }
  let feat = 0
  for (let i = 0; i < 3; i++) { if (l[i] > h[i]) { l[i] = h[i]; feat++ } else if (l[i] < -h[i]) { l[i] = -h[i]; feat++ } }
  const qx = s.c[0] + A[0][0] * l[0] + A[1][0] * l[1] + A[2][0] * l[2]
  const qy = s.c[1] + A[0][1] * l[0] + A[1][1] * l[1] + A[2][1] * l[2]
  const qz = s.c[2] + A[0][2] * l[0] + A[1][2] * l[1] + A[2][2] * l[2]
  const vx = px - qx, vy = py - qy, vz = pz - qz, d = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9
  o.q[0] = qx; o.q[1] = qy; o.q[2] = qz; o.n[0] = vx / d; o.n[1] = vy / d; o.n[2] = vz / d; o.d = d; o.feat = feat
  return o
}
function perp(d) { // d に垂直な単位ベクトル
  const x = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  const c = [d[1] * x[2] - d[2] * x[1], d[2] * x[0] - d[0] * x[2], d[0] * x[1] - d[1] * x[0]]
  const L = Math.sqrt(c[0] * c[0] + c[1] * c[1] + c[2] * c[2]); return [c[0] / L, c[1] / L, c[2] / L]
}
function closestCyl(s, px, py, pz, o) {
  const ax = px - s.a[0], ay = py - s.a[1], az = pz - s.a[2], D = s.d
  const t = ax * D[0] + ay * D[1] + az * D[2]
  let wx = ax - D[0] * t, wy = ay - D[1] * t, wz = az - D[2] * t
  let rho = Math.sqrt(wx * wx + wy * wy + wz * wz)
  if (rho < 1e-9) { const p = perp(D); wx = p[0]; wy = p[1]; wz = p[2]; rho = 0 } else { wx /= rho; wy /= rho; wz /= rho }
  if (t >= 0 && t <= s.L && rho <= s.r) {
    const gs = s.r - rho, ga = t, gb = s.L - t
    if (gs <= ga && gs <= gb) { o.n[0] = wx; o.n[1] = wy; o.n[2] = wz; o.d = -gs }
    else if (ga <= gb) { o.n[0] = -D[0]; o.n[1] = -D[1]; o.n[2] = -D[2]; o.d = -ga }
    else { o.n[0] = D[0]; o.n[1] = D[1]; o.n[2] = D[2]; o.d = -gb }
    o.q[0] = px - o.n[0] * o.d; o.q[1] = py - o.n[1] * o.d; o.q[2] = pz - o.n[2] * o.d; o.feat = 0
    return o
  }
  let feat = 0
  const tc = t < 0 ? (feat++, 0) : t > s.L ? (feat++, s.L) : t
  const rc = rho > s.r ? (feat++, s.r) : rho
  const qx = s.a[0] + D[0] * tc + wx * rc, qy = s.a[1] + D[1] * tc + wy * rc, qz = s.a[2] + D[2] * tc + wz * rc
  const vx = px - qx, vy = py - qy, vz = pz - qz, d = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9
  o.q[0] = qx; o.q[1] = qy; o.q[2] = qz; o.n[0] = vx / d; o.n[1] = vy / d; o.n[2] = vz / d; o.d = d; o.feat = feat
  return o
}
// arc の座標: 角度 ph, 半径 r, 上面からの高さ hh（上が正）
export function arcPoint(s, ph, r, hh) {
  const g = Math.sqrt(1 + (s.b / r) * (s.b / r))
  return [s.cx + r * dcos(ph), s.y0 + s.b * (ph - s.phi0) + hh * g, s.cz - r * dsin(ph)]
}
function closestArc(s, px, py, pz, o) {
  const dx = px - s.cx, dz = pz - s.cz
  let r = Math.sqrt(dx * dx + dz * dz); if (r < 1e-6) r = 1e-6
  let ph = datan2(-dz, dx)
  const mid = (s.phi0 + s.phi1) / 2
  ph += TAU * Math.round((mid - ph) / TAU)
  const g = Math.sqrt(1 + (s.b / r) * (s.b / r))
  const hh = (py - (s.y0 + s.b * (ph - s.phi0))) / g
  const sl = (ph - s.phi0) * r, sL = (s.phi1 - s.phi0) * r
  if (sl >= 0 && sl <= sL && r >= s.r1 && r <= s.r2 && hh <= 0 && hh >= -s.thick) {
    const gaps = [sl, sL - sl, r - s.r1, s.r2 - r, -hh, s.thick + hh]
    let k = 0; for (let i = 1; i < 6; i++) if (gaps[i] < gaps[k]) k = i
    const best = gaps[k], cph = dcos(ph), sph = dsin(ph)
    let n
    if (k === 0) n = [sph, 0, cph]            // phi0 側の端（φ が減る向き）
    else if (k === 1) n = [-sph, 0, -cph]     // phi1 側の端（φ が増える向き）
    else if (k === 2) n = [-cph, 0, sph]      // 内側
    else if (k === 3) n = [cph, 0, -sph]      // 外側
    else { const gx = -s.b * dz / (r * r), gz = s.b * dx / (r * r), L = Math.sqrt(gx * gx + 1 + gz * gz); n = k === 4 ? [gx / L, 1 / L, gz / L] : [-gx / L, -1 / L, -gz / L] }
    o.n[0] = n[0]; o.n[1] = n[1]; o.n[2] = n[2]; o.d = -best
    o.q[0] = px + n[0] * best; o.q[1] = py + n[1] * best; o.q[2] = pz + n[2] * best; o.feat = 0
    return o
  }
  // 上の面の真上（角度と半径は板の中）: 坂の傾きのとおりの向き（v13 まではまっすぐ上で、急な坂でも滑らなかった）
  if (sl >= 0 && sl <= sL && r >= s.r1 && r <= s.r2 && hh > 0) {
    const gx = -s.b * dz / (r * r), gz = s.b * dx / (r * r), L = Math.sqrt(gx * gx + 1 + gz * gz)
    o.n[0] = gx / L; o.n[1] = 1 / L; o.n[2] = gz / L; o.d = hh
    o.q[0] = px - o.n[0] * hh; o.q[1] = py - o.n[1] * hh; o.q[2] = pz - o.n[2] * hh; o.feat = 1
    return o
  }
  let feat = 0
  const phc = ph < s.phi0 ? (feat++, s.phi0) : ph > s.phi1 ? (feat++, s.phi1) : ph
  const rc = r < s.r1 ? (feat++, s.r1) : r > s.r2 ? (feat++, s.r2) : r
  const hc = hh > 0 ? (feat++, 0) : hh < -s.thick ? (feat++, -s.thick) : hh
  const q = arcPoint(s, phc, rc, hc)
  const vx = px - q[0], vy = py - q[1], vz = pz - q[2], d = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9
  o.q[0] = q[0]; o.q[1] = q[1]; o.q[2] = q[2]; o.n[0] = vx / d; o.n[1] = vy / d; o.n[2] = vz / d; o.d = d; o.feat = feat
  return o
}
export function makeSph(o) {
  const s = { type: 'sph', c: o.c.slice(), r: o.r, mat: o.mat || 'iron', mu: o.mu ?? 0.6, tag: o.tag || '', base: { c: o.c.slice() }, mov: o.mov || null, knock: o.knock || 0 }
  s.min = s.c.map(v => v - o.r); s.max = s.c.map(v => v + o.r)
  return s
}
function closestSph(s, px, py, pz, o) {
  const vx = px - s.c[0], vy = py - s.c[1], vz = pz - s.c[2], L = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1e-9
  o.n[0] = vx / L; o.n[1] = vy / L; o.n[2] = vz / L; o.d = L - s.r
  o.q[0] = s.c[0] + o.n[0] * s.r; o.q[1] = s.c[1] + o.n[1] * s.r; o.q[2] = s.c[2] + o.n[2] * s.r; o.feat = o.d < 0 ? 0 : 1
  return o
}
export function closest(s, px, py, pz, o = OUT) {
  return s.type === 'box' ? closestBox(s, px, py, pz, o) : s.type === 'cyl' ? closestCyl(s, px, py, pz, o) : s.type === 'sph' ? closestSph(s, px, py, pz, o) : closestArc(s, px, py, pz, o)
}
// 点 q が形 s の「面の中ほど」に乗っているか（辺や角でない）。埋もれていれば 2
const T2 = { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }
export function surfaceKind(s, q) {
  closest(s, q[0], q[1], q[2], T2)
  if (T2.d < -0.003) return 2
  if (T2.d > 0.003) return 0
  // 境界に乗っている軸の数を数える
  let on = 0
  if (s.type === 'sph') return 1
  if (s.type === 'box') {
    const dx = q[0] - s.c[0], dy = q[1] - s.c[1], dz = q[2] - s.c[2]
    for (let i = 0; i < 3; i++) { const l = dx * s.ax[i][0] + dy * s.ax[i][1] + dz * s.ax[i][2]; if (Math.abs(l) > s.h[i] - 0.002) on++ }
  } else if (s.type === 'cyl') {
    const ax = q[0] - s.a[0], ay = q[1] - s.a[1], az = q[2] - s.a[2], D = s.d
    const t = ax * D[0] + ay * D[1] + az * D[2]
    const wx = ax - D[0] * t, wy = ay - D[1] * t, wz = az - D[2] * t, rho = Math.sqrt(wx * wx + wy * wy + wz * wz)
    if (t < 0.002 || t > s.L - 0.002) on++; if (rho > s.r - 0.002) on++
  } else {
    const dx = q[0] - s.cx, dz = q[2] - s.cz, r = Math.sqrt(dx * dx + dz * dz)
    let ph = datan2(-dz, dx); ph += TAU * Math.round(((s.phi0 + s.phi1) / 2 - ph) / TAU)
    const g = Math.sqrt(1 + (s.b / r) * (s.b / r)), hh = (q[1] - (s.y0 + s.b * (ph - s.phi0))) / g
    if ((ph - s.phi0) * r < 0.002 || (s.phi1 - ph) * r < 0.002) on++
    if (r < s.r1 + 0.002 || r > s.r2 - 0.002) on++
    if (hh > -0.002 || hh < -s.thick + 0.002) on++
  }
  return on <= 1 ? 1 : 0
}

// 上下する足場: 下で dwell 秒止まる → move 秒で上がる → 上で dwell 秒止まる → 下がる。k は -amp..amp
export function liftPos(m, t) {
  const P = 2 * (m.dwell + m.move), ph = t - P * Math.floor(t / P)
  if (ph < m.dwell) return { k: -m.amp, v: 0, at: 'lo', left: m.dwell - ph }
  if (ph < m.dwell + m.move) { const u = (ph - m.dwell) / m.move; return { k: -m.amp * dcos(PI * u), v: m.amp * PI / m.move * dsin(PI * u), at: 'up' } }
  if (ph < 2 * m.dwell + m.move) return { k: m.amp, v: 0, at: 'hi', left: 2 * m.dwell + m.move - ph }
  const u = (ph - 2 * m.dwell - m.move) / m.move; return { k: m.amp * dcos(PI * u), v: -m.amp * PI / m.move * dsin(PI * u), at: 'down' }
}

// 振り子: 支点から長さ L、横へ振れる角 a = amp·sin(w t + ph)。x は横のずれ、y は支点からの下がり
export function pendState(m, t) {
  const a = m.amp * dsin(m.w * t + (m.ph || 0)), da = m.amp * m.w * dcos(m.w * t + (m.ph || 0)), sa = dsin(a), ca = dcos(a)
  return { a, x: m.L * sa, y: m.L * ca, vx: m.L * ca * da, vy: -m.L * sa * da }
}
// 跳ね橋: 下りて dwell 秒 → move 秒で上がる → 上で dwell 秒 → 下がる。a は 0（下）..up（上がった角）
export function hingeAng(m, t) {
  const st = liftPos({ dwell: m.dwell, move: m.move, amp: 1 }, t + (m.ph || 0))
  return { a: m.up * (st.k + 1) / 2, w: m.up * st.v / 2, at: st.at, left: st.left }
}
// 落石: 周期 T。warn 秒の予兆（まだ見えない）→ fall 秒で hd だけ落ちる → 砕けて消える
export function dropState(m, t) {
  const T = m.T, ph = t + (m.ph || 0) - T * Math.floor((t + (m.ph || 0)) / T)
  if (ph < m.fall) { const u = ph / m.fall; return { y: m.hd * (1 - u * u), v: -2 * m.hd * u / m.fall, hidden: false, warn: 0, ph } }
  const left = T - ph
  return { y: m.hd, v: 0, hidden: true, warn: left < m.warn ? 1 - left / m.warn : 0, ph }
}

// 塔のまわりの道を外へ流れる水の速さ（道の板の中心から外向き）
function flowRad(sh, q) { const dx = q[0] - sh.cx, dz = q[2] - sh.cz, L = Math.sqrt(dx * dx + dz * dz) || 1; return [dx / L * sh.flowR, 0, dz / L * sh.flowR] }
// 壊せる扉・柵: 速さ breakV 以上でぶつかると壊れる（遅いと、ただの壁）
function smash(world, b, con, velAt, ev) {
  const sh = world.shapes[con.id]; if (!sh.breakV || sh.gone || b.ghost) return false
  const v = velAt(con.q), n = con.n || con.nw, vn = -(v[0] * n[0] + v[1] * n[1] + v[2] * n[2])
  if (vn < sh.breakV) return false
  sh.gone = true; sh.goneAt = world.time
  b.v[0] *= 0.85; b.v[2] *= 0.85
  if (ev) ev.push({ t: 'break', id: sh.id, v: vn })
  return true
}
// シーソーの板の姿勢（支点のまわりに ang だけ回す）
function seesawPose(s) {
  const m = s.mov, B0 = s.base, a = m.ang || 0, nb = makeBox({ c: B0.c, h: s.h, yaw: B0.yaw, pitch: B0.pitch + a, roll: B0.roll })
  const H0 = m.pivot, d0 = [B0.c[0] - H0[0], B0.c[1] - H0[1], B0.c[2] - H0[2]], R0 = m.right, ca = dcos(a), sa = dsin(a)
  const kd = R0[0] * d0[0] + R0[1] * d0[1] + R0[2] * d0[2], cr = [R0[1] * d0[2] - R0[2] * d0[1], R0[2] * d0[0] - R0[0] * d0[2], R0[0] * d0[1] - R0[1] * d0[0]]
  s.c = [0, 1, 2].map(k => H0[k] + d0[k] * ca + cr[k] * sa + R0[k] * kd * (1 - ca)); s.ax = nb.ax
}
// 落ちて登り直した時（出し直し）に、抜けた床と一度きりで崩れた道を元に戻す
export function resetFallen(world) { for (const s of world.moving) { const m = s.mov; if (m.type === 'trap' || (m.type === 'crumble' && m.once)) { s.gone = false; s.touch = 0; s.warnT = null } } }
// 乗ると一緒に運ばれる動く床の種類
const CARRY = new Set(['lift', 'slide', 'spin', 'seesaw', 'pend', 'hinge', 'wave', 'kick', 'shuttle', 'topple'])
// v16: 床の加速を体に感じる（床の座標系の見かけの力）。止まる跳ね板から飛び出す・揺れる吊り橋から投げ出される
const FICT = new Set(['wave', 'kick', 'shuttle', 'topple'])
const NOIDLE = new Set(['wave', 'kick', 'topple']) // 何もしない時に床と一緒に止める補助を使わない（橋・跳ね板・煙突はふつうの路面と同じに転がる）
// 止まってブレーキを押し続けて下がり始めるまでの時間（動く床の上では長押し）
function revHold(b) { return b.onMov ? 1e9 : 0.45 } // 動く床の上では下がらない（ブレーキは床と一緒に止まっているだけ）
// 塔のまわりの道に沿って流れる水（flowT: 左回りの向きを正とする速さ）
function flowTan(sh, q) { const dx = q[0] - sh.cx, dz = q[2] - sh.cz, L = Math.sqrt(dx * dx + dz * dz) || 1; return [dz / L * sh.flowT, 0, -dx / L * sh.flowT] }
// 突風の強さ 0..1（周期の 3 割ほどだけ強く吹く。ほかは凪）
export function gustK(g, t) { const v = dsin(t * g.w + g.ph); return v > 0.55 ? ((v - 0.55) / 0.45) : 0 }

// ------------------------------------------------------------ 世界（形の一覧と格子）
const CELL = 4
const key = (i, j, k) => (i + 1024) * 4194304 + (j + 1024) * 2048 + (k + 1024)
export class World {
  constructor(shapes) {
    this.shapes = shapes
    this.grid = new Map()
    this.stamp = new Int32Array(shapes.length); this.st = 0
    this.big = []; this.moving = []; this.winds = []; this.traps = []; this.hangs = []; this.trigs = []; this.bridges = []; this.time = 0
    shapes.forEach((s, id) => {
      s.id = id
      if (s.mov && s.mov.type === 'wave' && !this.bridges.includes(s.mov.br)) this.bridges.push(s.mov.br)
      if (s.hang) this.hangs.push(s)
      if (s.mov && s.type === 'cyl') { s.c = [(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2]; this.moving.push(s) }
      else if (s.mov) {
        // 動く足場: 動く範囲を全部含む箱で当たりの候補に入れる
        const R = s.type === 'sph' ? s.r : s.type === 'arc' ? 0 : Math.sqrt(s.h[0] * s.h[0] + s.h[1] * s.h[1] + s.h[2] * s.h[2])
        const m = s.mov, ex = m.ext ? m.ext : m.type === 'slide' || m.type === 'lift' ? [Math.abs(m.axis[0]) * m.amp, Math.abs(m.axis[1]) * m.amp, Math.abs(m.axis[2]) * m.amp]
          : m.type === 'pend' ? [m.L, m.L, m.L] : m.type === 'hinge' || m.type === 'seesaw' ? [R * 2, R * 2, R * 2] : m.type === 'drop' ? [0, m.hd, 0] : [0, 0, 0]
        if (s.type !== 'arc') { s.min = [0, 1, 2].map(k => s.base.c[k] - R - ex[k]); s.max = [0, 1, 2].map(k => s.base.c[k] + R + ex[k]) }
        s.touch = 0; s.gone = false
        if (m.type === 'kick' || m.type === 'topple') this.trigs.push(s)
        if (m.type === 'trap') { s.tc = s.type === 'arc' ? arcPoint(s, (s.phi0 + s.phi1) / 2, (s.r1 + s.r2) / 2, 0) : s.c.slice(); this.traps.push(s) }
        this.moving.push(s); this.big.push(id); return
      }
      const a = s.min.map(v => Math.floor(v / CELL)), b = s.max.map(v => Math.floor(v / CELL))
      if ((b[0] - a[0] + 1) * (b[1] - a[1] + 1) * (b[2] - a[2] + 1) > 4000) { this.big.push(id); return }
      for (let i = a[0]; i <= b[0]; i++) for (let j = a[1]; j <= b[1]; j++) for (let k = a[2]; k <= b[2]; k++) {
        const K = key(i, j, k); let L = this.grid.get(K); if (!L) this.grid.set(K, L = []); L.push(id)
      }
    })
    this.buf = []
    this.setTime(0)
  }
  // 時刻 t（秒）の位置に動く足場を置く。決まった式なので、同じ時刻なら同じ位置
  setTime(t) {
    const dtT = t - this.time
    this.time = t
    if (t === 0) for (const br of this.bridges) { br.tOn = null; br.on = false; br.sb = 0; br.vs = 0; br.lastOn = -1e9 }
    for (const s of this.moving) {
      const m = s.mov, B0 = s.base
      if (m.type === 'slide') { const k = m.amp * dsin(t * m.w + (m.ph || 0)); s.c = [B0.c[0] + m.axis[0] * k, B0.c[1] + m.axis[1] * k, B0.c[2] + m.axis[2] * k] }
      else if (m.type === 'lift') { const k = liftPos(m, t).k; s.c = [B0.c[0] + m.axis[0] * k, B0.c[1] + m.axis[1] * k, B0.c[2] + m.axis[2] * k] }
      else if (m.type === 'spin' && s.type === 'box') { const nb = makeBox({ c: B0.c, h: s.h, yaw: B0.yaw + m.rate * t, pitch: B0.pitch, roll: B0.roll }); s.ax = nb.ax }
      else if (m.type === 'pend') { const st = pendState(m, t); s.c = [m.pivot[0] + m.across[0] * st.x, m.pivot[1] - st.y, m.pivot[2] + m.across[2] * st.x]; if (s.type === 'sph') { s.min = s.c.map(v => v - s.r); s.max = s.c.map(v => v + s.r) } }
      else if (m.type === 'hinge') { const a = hingeAng(m, t).a, nb = makeBox({ c: B0.c, h: s.h, yaw: B0.yaw, pitch: B0.pitch + a, roll: B0.roll }); const H0 = m.hinge, d0 = [B0.c[0] - H0[0], B0.c[1] - H0[1], B0.c[2] - H0[2]], R0 = m.right, ca = dcos(a), sa = dsin(a)
        // 蝶番の軸（右向き）のまわりに a だけ回す（ロドリゲスの式）
        const kd = R0[0] * d0[0] + R0[1] * d0[1] + R0[2] * d0[2], cr = [R0[1] * d0[2] - R0[2] * d0[1], R0[2] * d0[0] - R0[0] * d0[2], R0[0] * d0[1] - R0[1] * d0[0]]
        s.c = [0, 1, 2].map(k => H0[k] + d0[k] * ca + cr[k] * sa * m.sgn + R0[k] * kd * (1 - ca)); s.ax = nb.ax }
      else if (m.type === 'seesaw') { if (t === 0) { m.ang = m.ang0 || 0; m.w = 0 } seesawPose(s) }
      else if (m.type === 'brk') { if (s.gone && t - s.goneAt > m.back) s.gone = false; if (t === 0) s.gone = false }
      else if (m.type === 'drop') { const st = dropState(m, t); s.c = [B0.c[0], B0.c[1] + st.y, B0.c[2]]; s.gone = st.hidden; s.min = s.c.map(v => v - s.r); s.max = s.c.map(v => v + s.r) }
      else if (m.type === 'trap') { if (t === 0) { s.gone = false; s.warnT = null } }
      else if (m.type === 'crumble') { if (t === 0) { s.gone = false; s.touch = 0; s.goneAt = -1e9 } }
      else if (m.type === 'wave' || m.type === 'kick' || m.type === 'shuttle' || m.type === 'topple') v16Pose(s, t, dtT)
      if (m.type === 'crumble') { if (s.gone && t - s.goneAt > m.back) { s.gone = false; s.touch = 0 } else if (!s.gone && s.touch > 0 && s.lastTouch !== undefined && t - s.lastTouch > 1.5) s.touch = 0 }
    }
  }
  tick() {
    // シーソー: 前の 1 コマにバイクから受けた回す力で、8 回に分けて傾ける（重さで傾く。乗っていなければゆっくり元へ戻る）
    for (const s of this.moving) { const m = s.mov; if (m.type !== 'seesaw') continue
      const tq = m.tqN ? m.tqSum / m.tqN : 0; m.tqSum = 0; m.tqN = 0
      for (let k = 0; k < SUB; k++) {
        m.w += (tq + (m.ang0 - m.ang) * m.k - m.w * m.damp) / m.I * H; m.ang += m.w * H
        if (m.ang < m.min) { m.ang = m.min; if (m.w < 0) m.w = 0 } if (m.ang > m.max) { m.ang = m.max; if (m.w > 0) m.w = 0 }
      } }
    this.setTime(this.time + DT)
  }
  // 動く足場の、点 q での速さ
  shapeVel(s, q) {
    const m = s.mov; if (!m) return null
    if (m.type === 'slide') { const k = m.amp * m.w * dcos(this.time * m.w + (m.ph || 0)); return [m.axis[0] * k, m.axis[1] * k, m.axis[2] * k] }
    if (m.type === 'lift') { const k = liftPos(m, this.time).v; return [m.axis[0] * k, m.axis[1] * k, m.axis[2] * k] }
    if (m.type === 'pend') { const st = pendState(m, this.time); return [m.across[0] * st.vx, -st.vy, m.across[2] * st.vx] }
    if (m.type === 'hinge') { const w = hingeAng(m, this.time).w * m.sgn, R0 = m.right, r = [q[0] - m.hinge[0], q[1] - m.hinge[1], q[2] - m.hinge[2]]; return [w * (R0[1] * r[2] - R0[2] * r[1]), w * (R0[2] * r[0] - R0[0] * r[2]), w * (R0[0] * r[1] - R0[1] * r[0])] }
    if (m.type === 'drop') { return [0, dropState(m, this.time).v, 0] }
    if (m.type === 'seesaw') { const w = m.w || 0, R0 = m.right, r = [q[0] - m.pivot[0], q[1] - m.pivot[1], q[2] - m.pivot[2]]; return [w * (R0[1] * r[2] - R0[2] * r[1]), w * (R0[2] * r[0] - R0[0] * r[2]), w * (R0[0] * r[1] - R0[1] * r[0])] }
    if (m.type === 'spin') { const dx = q[0] - s.c[0], dz = q[2] - s.c[2]; return [m.rate * dz, 0, -m.rate * dx] }
    if (m.type === 'gear') { const o = m.om, r = [q[0] - s.a[0], q[1] - s.a[1], q[2] - s.a[2]]; return [o[1] * r[2] - o[2] * r[1], o[2] * r[0] - o[0] * r[2], o[0] * r[1] - o[1] * r[0]] }
    if (m.type === 'topple') { const w = m.wNow || 0, R0 = m.right, r = [q[0] - m.hinge[0], q[1] - m.hinge[1], q[2] - m.hinge[2]]; return [w * (R0[1] * r[2] - R0[2] * r[1]), w * (R0[2] * r[0] - R0[0] * r[2]), w * (R0[0] * r[1] - R0[1] * r[0])] }
    if (m.type === 'wave' || m.type === 'kick' || m.type === 'shuttle') return s.vel ? s.vel.slice() : [0, 0, 0]
    return null
  }
  near(x, y, z, rad) {
    const out = this.buf; out.length = 0; this.st++
    for (const id of this.big) { const s = this.shapes[id]; if (s.gone) continue; if (x + rad < s.min[0] || x - rad > s.max[0] || y + rad < s.min[1] || y - rad > s.max[1] || z + rad < s.min[2] || z - rad > s.max[2]) continue; this.stamp[id] = this.st; out.push(id) }
    const i0 = Math.floor((x - rad) / CELL), i1 = Math.floor((x + rad) / CELL)
    const j0 = Math.floor((y - rad) / CELL), j1 = Math.floor((y + rad) / CELL)
    const k0 = Math.floor((z - rad) / CELL), k1 = Math.floor((z + rad) / CELL)
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (let k = k0; k <= k1; k++) {
      const L = this.grid.get(key(i, j, k)); if (!L) continue
      for (const id of L) {
        if (this.stamp[id] === this.st) continue; this.stamp[id] = this.st
        const s = this.shapes[id]
        if (x + rad < s.min[0] || x - rad > s.max[0] || y + rad < s.min[1] || y - rad > s.max[1] || z + rad < s.min[2] || z - rad > s.max[2]) continue
        out.push(id)
      }
    }
    return out
  }
  // 埋もれた辺（他の形の面の中ほどに乗っている辺）を当たりから外す
  ghost(q, selfId, ids) {
    for (const id of ids) {
      if (id === selfId) continue
      const s = this.shapes[id]
      if (q[0] < s.min[0] - 0.01 || q[0] > s.max[0] + 0.01 || q[1] < s.min[1] - 0.01 || q[1] > s.max[1] + 0.01 || q[2] < s.min[2] - 0.01 || q[2] > s.max[2] + 0.01) continue
      if (surfaceKind(s, q)) return true
    }
    return false
  }
  // 球の接触を集める（ドーナツの車輪は rim 点の球として呼ぶ）。返り: 一番深い接触
  sphere(px, py, pz, r, ids, res) {
    let best = null
    for (const id of ids) {
      const s = this.shapes[id]
      closest(s, px, py, pz, OUT)
      const depth = r - OUT.d
      if (depth <= 0) continue
      if (OUT.feat >= 2) { const q = OUT.q.slice(), n = OUT.n.slice(), d = OUT.d; if (this.ghost(q, id, ids)) continue; OUT.q = q; OUT.n = n; OUT.d = d }
      if (!best || depth > best.depth) best = { depth, n: OUT.n.slice(), q: OUT.q.slice(), id, mu: s.mu }
    }
    return best
  }
  // ドーナツ（車輪の円 中心 c・軸 a・半径 R、太さ rt）の接触。一番深い接触の点と、深さで重みを付けた向き
  // filt = { ax, min, side }: side=false なら n·ax >= min の接触（下から支える）だけ、true ならそれ以外（横・前から当たる）だけ
  torus(c, a, R, rt, ids, filt) {
    let best = null, nx = 0, ny = 0, nz = 0
    for (const id of ids) {
      const s = this.shapes[id]
      closest(s, c[0], c[1], c[2], OUT)
      // 押し返す向き: 形の上で車輪の中心に一番近い点 → 中心（円と箱の当たりの向き。深く沈んでも横向きに化けない）
      const n0 = OUT.d > 1e-6 ? [OUT.n[0], OUT.n[1], OUT.n[2]] : OUT.n.slice()
      let mx = c[0], my = c[1], mz = c[2]
      for (let it = 0; it < 2; it++) {
        const vx = c[0] - OUT.q[0], vy = c[1] - OUT.q[1], vz = c[2] - OUT.q[2]
        const k = vx * a[0] + vy * a[1] + vz * a[2]
        const px = vx - a[0] * k, py = vy - a[1] * k, pz = vz - a[2] * k
        const L = Math.sqrt(px * px + py * py + pz * pz)
        if (L < 1e-6) { mx = c[0]; my = c[1]; mz = c[2] } else { mx = c[0] - px * R / L; my = c[1] - py * R / L; mz = c[2] - pz * R / L }
        closest(s, mx, my, mz, OUT)
      }
      const depth = rt - OUT.d
      if (depth <= 0) continue
      const q = OUT.q.slice(), feat = OUT.feat
      // 車輪の横（軸の向き）から当たる時は、タイヤの縁の球の向きで押す（沈んだ分を確実に戻す）
      const na = n0[0] * a[0] + n0[1] * a[1] + n0[2] * a[2]
      const n = (na > 0.4 || na < -0.4) ? OUT.n.slice() : n0
      if (filt) { const d = n[0] * filt.ax[0] + n[1] * filt.ax[1] + n[2] * filt.ax[2]; if ((d >= filt.min) === filt.side) continue }
      if (feat >= 2 && this.ghost(q, id, ids)) continue
      const wgt = depth * depth
      nx += n[0] * wgt; ny += n[1] * wgt; nz += n[2] * wgt
      if (!best || depth > best.depth) best = { depth, n, q, id, mu: s.mu, feat, rim: [mx, my, mz] }
    }
    if (best) { const L = Math.sqrt(nx * nx + ny * ny + nz * nz); if (L > 1e-9) best.nw = [nx / L, ny / L, nz / L]; else best.nw = best.n }
    return best
  }
  // 上から下への光線（検査とカメラ用）。球を少しずつ進める
  rayDown(x, z, yTop, yBot = -500) {
    // 符号つき距離が負（形の中）になった所と、その直前の外の点の間を二分法で詰める
    let best = -Infinity, bid = -1
    // 縦の列の格子だけ見る（全部の形を調べない）
    this.st++
    const cand = []
    for (const id of this.big) { const s = this.shapes[id]; if (!s.gone) cand.push(s) }
    const i = Math.floor(x / CELL), k = Math.floor(z / CELL), j0 = Math.floor(Math.max(yBot, -60) / CELL), j1 = Math.floor(Math.min(yTop, 2000) / CELL)
    for (let j = j0; j <= j1; j++) { const L = this.grid.get(key(i, j, k)); if (!L) continue; for (const id of L) { if (this.stamp[id] === this.st) continue; this.stamp[id] = this.st; cand.push(this.shapes[id]) } }
    for (const s of cand) {
      if (x < s.min[0] || x > s.max[0] || z < s.min[2] || z > s.max[2]) continue
      let y = Math.min(yTop, s.max[1] + 0.1), prev = y
      const end = Math.max(yBot, s.min[1] - 0.1)
      while (y > end) {
        closest(s, x, y, z, OUT)
        if (OUT.d < 0) {
          let hi = prev, lo = y
          for (let i = 0; i < 40; i++) { const m = (hi + lo) / 2; closest(s, x, m, z, OUT); if (OUT.d < 0) lo = m; else hi = m }
          if (hi > best) { best = hi; bid = s.id }
          break
        }
        prev = y
        y -= Math.min(0.25, Math.max(OUT.d * 0.9, 0.002))
      }
    }
    return { y: best, id: bid }
  }
  // 任意の向きの光線（カメラの壁よけ）
  ray(o, dir, maxT, ids) {
    let t = 0
    while (t < maxT) {
      const x = o[0] + dir[0] * t, y = o[1] + dir[1] * t, z = o[2] + dir[2] * t
      let m = Infinity
      for (const id of ids) { closest(this.shapes[id], x, y, z, OUT); if (OUT.d < m) m = OUT.d }
      if (m < 0.02) return t
      t += Math.max(m * 0.8, 0.02)
    }
    return maxT
  }
}

// ------------------------------------------------------------ バイク
export const BRK_HOLD = 0.25 // v23: 急ブレーキで後輪を持ち上げるのは、ブレーキ全開をこの秒数（0.25 秒）より長く押し続けた時だけ
export const BIKE = {
  m: 180, Ip: 60, g: 9.81,
  R: 0.25, rt: 0.11,                       // 車輪の円の半径とタイヤの太さ（外径 0.36）
  rear: [-0.70, -0.50], front: [0.72, -0.50], // 伸び切った時の車輪の中心（重心から。前, 上）
  travel: 0.28, rake: 0.42,                 // ストロークと前のフォークの寝かせ（ラジアン）
  ks: 9000, cs: 1300, pre: 250,             // サスペンション
  kr: 70000, cr: 4500,                     // 底づき後の硬い当たり
  drive: 1150, power: 24000, vmax: 40,
  lean: 0.18, leanTorqueGround: 70, leanTorqueAir: 300,
  frame: [[-0.35, -0.16, 0.13], [0, -0.22, 0.13], [0.36, -0.12, 0.13]],
  rider: [[-0.10, 0.22, 0.17, 0.22], [-0.02, 0.52, 0.17, 0.25], [0.02, 0.86, 0.15, 0.28]], // [前, 上, 半径, 重心で前へ動く量]
  hardLand: 9.5,
  nitroTop: 21, nitroDrive: 2.1, nitroPower: 2.2, nitroThrust: 700, nitroUse: 0.4, // v15 ニトロ: 押している間は最高速度 20m/s・押す力 2 倍。満タンで 2.5 秒
  vtop: 13.5, vfade: 2, // v15: 13 → 13.5（本人「ほんの少しだけ上げて」）。 // v12: 最高速度（11m/s から効きが弱まり 13m/s で止まる）。ジャンプ台の踏み切りでは launchV で v11 と同じ飛び出しの速さに戻す
  wheelieEase: 0.47,
}

const v3 = (x, y, z) => [x, y, z]
export function createBike(spawn) {
  return {
    p: spawn.p.slice(), v: [0, 0, 0], th: 0, w: 0, psi: spawn.yaw || 0, psiRate: 0,
    delta: 0, lean: 0, s: [0, 0], sv: [0, 0], g: [false, false], cn: [null, null], side: [null, null],
    pre: 0, tBack: 9, hopCool: 0, crashed: null, steps: 0, frame: [0, 0], wheelRot: [0, 0], scrape: 0,
    impact: 0, landV: 0, airT: 0, speed: 0, nitro: 1, nitroOn: false,
  }
}
export function basis(b) {
  const cy = dcos(b.psi), sy = dsin(b.psi), cp = dcos(b.th), sp = dsin(b.th)
  const h = [cy, 0, -sy], R = [sy, 0, cy]
  const f = [cy * cp, sp, -sy * cp], u = [-cy * sp, cp, sy * sp]
  return { h, R, f, u }
}
const bodyPt = (b, B, x, y) => [b.p[0] + B.f[0] * x + B.u[0] * y, b.p[1] + B.f[1] * x + B.u[1] * y, b.p[2] + B.f[2] * x + B.u[2] * y]
// 車輪の中心（圧縮 s）。i=0 後ろ, 1 前
export function wheelCenter(b, B, i, s) {
  const P = BIKE, sh = -b.lean * P.lean
  const base = i ? P.front : P.rear
  const c = bodyPt(b, B, base[0] + sh, base[1])
  const ax = i ? axisF(B) : axisR(B)
  return [c[0] + ax[0] * s, c[1] + ax[1] * s, c[2] + ax[2] * s]
}
function axisR(B) { const c = 0.98006657784124, s = 0.19866933079506 /* 0.2rad */; return [B.u[0] * c - B.f[0] * s, B.u[1] * c - B.f[1] * s, B.u[2] * c - B.f[2] * s] }
function axisF(B) { const c = dcos(BIKE.rake), s = dsin(BIKE.rake); return [B.u[0] * c - B.f[0] * s, B.u[1] * c - B.f[1] * s, B.u[2] * c - B.f[2] * s] }
export function riderPts(b, B) { return BIKE.rider.map(([x, y, r, k]) => ({ c: bodyPt(b, B, x + b.lean * k, y), r })) }
export function framePts(b, B) { return BIKE.frame.map(([x, y, r]) => ({ c: bodyPt(b, B, x, y), r })) }

// 入力 inp = { thr 0..1, brk 0..1, lean -1(後ろ)..1(前), steer -1(左)..1(右) }
export function stepBike(world, b, inp, ev) {
  // v29 登り坂で止まりかけてブレーキを押している時は、前体重を効かせない（前輪で立たず、そのまま下がれる。本人「ジャンプ台に乗ったままバックできない」）
  { const cn = b.cn[0] || b.cn[1], hx = Math.cos(b.psi), hz = -Math.sin(b.psi)
    b._upBrk = !!(cn && inp.brk > 0 && inp.thr <= 0 && b.speed < 1.0 && -(cn.n[0] * hx + cn.n[2] * hz) > 0.14)
    if (b._upBrk && inp.lean > 0) inp = { ...inp, lean: 0 } }
  // 急に抜け落ちる床（trap）: バイクが近づくと、ひびと小石の予兆のあと抜け落ちる。落ちた床は、出し直した時か 12 秒後に戻る
  if (!b.ghost && world.traps.length) for (const s of world.traps) {
    if (s.gone) { if (world.time - s.goneAt > 12) { s.gone = false; s.warnT = null } continue }
    const dx = s.tc[0] - b.p[0], dy = s.tc[1] - b.p[1], dz = s.tc[2] - b.p[2], d = Math.sqrt(dx * dx + dz * dz)
    if (s.warnT == null && d < s.mov.trig && Math.abs(dy) < 3) { s.warnT = world.time; if (ev) ev.push({ t: 'trapwarn', p: s.tc.slice() }) }
    if (s.warnT != null && world.time - s.warnT > s.mov.warn) { s.gone = true; s.goneAt = world.time; if (ev) ev.push({ t: 'trapfall', p: s.tc.slice() }) }
  }
  // ニトロ: アクセルと一緒に押している間だけ。曲がりの手前の自動の減速が入った時・空になった時は切れる
  { const on = !b.crashed && !!inp.nitro && inp.thr > 0.5 && !(inp.ab > 0) && !(inp.brk > 0) && b.nitro > 0
    if (on && !b.nitroOn && ev) ev.push({ t: 'nitro' })
    if (!on && b.nitroOn && ev) ev.push({ t: 'nitroOff', empty: b.nitro <= 0 })
    b.nitroOn = on
    if (on) b.nitro = Math.max(0, b.nitro - BIKE.nitroUse * DT)
    else if (inp.nitro && inp.thr > 0.5 && b.nitro <= 0 && ev && !b._nEmptyT) { ev.push({ t: 'nitroEmpty' }); b._nEmptyT = 40 }
    if (b._nEmptyT) b._nEmptyT-- }
  if (b.hang) { hangStep(world, b, inp, ev); b.steps++; return }
  for (let k = 0; k < SUB; k++) sub(world, b, inp, ev)
  if (!b.crashed && !b.ghost && world.hangs.length) hangCatch(world, b, inp, ev)
  if (!b.ghost) v16Track(world, b, ev)
  b.steps++
}
const ZERO = { thr: 0, brk: 0, lean: 0, steer: 0 }
function sub(world, b, inpIn, ev) {
  const P = BIKE, inp = b.crashed ? ZERO : inpIn
  // 体の動き（重心の前後とハンドル）はなめらかに
  const lt = clamp(inp.lean, -1, 1)
  b.lean += clamp(lt - b.lean, -6 * H, 6 * H)
  const sp = b.speed
  const dmax = Math.min(0.6, STEER_DK / Math.max(1, sp * sp))
  b.delta += clamp(-inp.steer * dmax - b.delta, -3 * H, 3 * H) // 右へ切る = psi を減らす（キーを短く押せば少しだけ切れる）

  const B = basis(b)
  let fx = 0, fy = -P.m * P.g, fz = 0, tau = 0
  const addF = (F, at, tag) => {
    fx += F[0]; fy += F[1]; fz += F[2]
    const rx = at[0] - b.p[0], ry = at[1] - b.p[1], rz = at[2] - b.p[2]
    const tx = ry * F[2] - rz * F[1], ty = rz * F[0] - rx * F[2], tz = rx * F[1] - ry * F[0]
    const tq = tx * B.R[0] + ty * B.R[1] + tz * B.R[2]
    tau += tq
    if (globalThis.__dbgF) globalThis.__dbgF(tag, F, tq)
  }
  // 点の速さ（ピッチの回転とヨーの回転を含む）
  const W = [B.R[0] * b.w, B.R[1] * b.w + b.psiRate, B.R[2] * b.w]
  const velAt0 = q => { const rx = q[0] - b.p[0], ry = q[1] - b.p[1], rz = q[2] - b.p[2]; return [b.v[0] + W[1] * rz - W[2] * ry, b.v[1] + W[2] * rx - W[0] * rz, b.v[2] + W[0] * ry - W[1] * rx] }
  // 動く足場の上では、足場に対する速さで摩擦と当たりを計算する
  let curId = -1
  // 動く床に乗っている間は、床の座標系で動かす: 位置に床の動きを毎刻み足し（下の積分の後）、b.v は床に対する速さとして扱う
  { const pick = i => { const cn = b.cn[i]; if (!cn) return -1; const sh = world.shapes[cn.id]; return sh && sh.mov && CARRY.has(sh.mov.type) && !sh.gone ? cn.id : -1 }
    const nc = !b.crashed && (b.g[0] || b.g[1]) ? Math.max(pick(0), pick(1)) : -1
    if (nc !== (b.carryId ?? -1)) {
      if (b.carryId >= 0) { const u = world.shapeVel(world.shapes[b.carryId], b.p) || [0, 0, 0]; b.v[0] += u[0]; b.v[1] += u[1]; b.v[2] += u[2] } // 床を離れる時: 床の速さを持って出る
      if (nc >= 0) { const u = world.shapeVel(world.shapes[nc], b.p) || [0, 0, 0]; b.v[0] -= u[0]; b.v[1] -= u[1]; b.v[2] -= u[2] } // 乗った時: 床に対する速さにする
      b.carryId = nc
    } }
  const velAt = q => { const v = velAt0(q); if (curId < 0 || curId === b.carryId) return v; const sh = world.shapes[curId]; const u = sh.mov ? world.shapeVel(sh, q) : sh.flow || (sh.flowR ? flowRad(sh, q) : sh.flowT ? flowTan(sh, q) : null); return u ? [v[0] - u[0], v[1] - u[1], v[2] - u[2]] : v } // 湧き水の流れの上は、水と一緒に動く面として扱う
  if (b.carryId >= 0) { const sh = world.shapes[b.carryId]; if (sh.mov && FICT.has(sh.mov.type)) { const a = frameAcc(sh, b.p); fx -= P.m * a[0]; fy -= P.m * a[1]; fz -= P.m * a[2] } }
  const ids = world.near(b.p[0], b.p[1], b.p[2], 2.4)
  // 深く沈んだ接触は、沈む向きの速さをその場で打ち消す（強い着地でも面の奥へ入り込ませない）
  const stopSink = (q, n, depth) => {
    if (depth < 0.05) return
    const vq = velAt(q), vn = vq[0] * n[0] + vq[1] * n[1] + vq[2] * n[2]
    if (vn >= 0) return
    const rx = q[0] - b.p[0], ry = q[1] - b.p[1], rz = q[2] - b.p[2]
    const cx = ry * n[2] - rz * n[1], cy = rz * n[0] - rx * n[2], cz = rx * n[1] - ry * n[0]
    const rn = cx * B.R[0] + cy * B.R[1] + cz * B.R[2]
    const j = -vn / (1 / P.m + rn * rn / P.Ip) * Math.min(1, (depth - 0.05) / 0.04 + 0.25)
    b.v[0] += n[0] * j / P.m; b.v[1] += n[1] * j / P.m; b.v[2] += n[2] * j / P.m
    b.w += rn * j / P.Ip
  }

  // ---- 車輪
  // 接触は2種類に分ける。下から支える接触（向きがサスの軸に近い）はサスペンションで受け、
  // 横や前から当たる接触（段の面・道の横の面）はタイヤの硬さで受ける
  const wheelForce = (i, con, N, ax) => {
    const n = con.nw || con.n, q = con.q
    curId = con.id
    const vq = velAt(q)
    let t = [B.f[0] - n[0] * (B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2]), 0, 0]
    t[1] = B.f[1] - n[1] * (B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2]); t[2] = B.f[2] - n[2] * (B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2])
    let tl = Math.sqrt(t[0] * t[0] + t[1] * t[1] + t[2] * t[2])
    if (tl < 1e-4) t = B.h.slice(), tl = 1
    t = [t[0] / tl, t[1] / tl, t[2] / tl]
    const lat = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]]
    const vt = vq[0] * t[0] + vq[1] * t[1] + vq[2] * t[2]
    const vl = vq[0] * lat[0] + vq[1] * lat[1] + vq[2] * lat[2]
    const lim = con.mu * N
    let Ft = 0
    if (i === 0) {
      // 低いギア: 段の角や壁を後輪で登る時（接地の向きが立っている時）は力が増える
      const nR = Math.abs(n[0] * B.R[0] + n[1] * B.R[1] + n[2] * B.R[2]), nF = n[0] * B.f[0] + n[1] * B.f[1] + n[2] * B.f[2]
      const climb = n[1] < 0.9 && nR < 0.5 && nF < 0 ? 1 + 0.9 * Math.min(1, (0.9 - n[1]) / 0.5) : 1
      if (inp.thr > 0) {
        const nk = b.nitroOn ? 1 : 0
        const drv = P.drive * climb, pwr = P.power, top = nk ? P.nitroTop : P.vtop
        let fd = inp.thr * Math.min(drv, pwr / Math.max(1, vt))
        // 最高速度で絞った分を「最高速度がなかったら出ていた速さ」として覚えておく（ジャンプ台の踏み切りで戻す）
        const vx = b.vx || 0, fdFree = nk ? 0 : inp.thr * Math.min(drv, pwr / Math.max(1, vt + vx))
        fd *= clamp((top - vt) / P.vfade, 0, 1)
        // ニトロ中: 増えた分の押す力は車体の重心を押す（車輪の接地点で押すと前輪が上がって後ろへ回るので、回す力にしない）。タイヤの滑らない範囲で
        if (nk) { const fx2 = inp.thr * Math.min(drv * P.nitroDrive, pwr * P.nitroPower / Math.max(1, vt)) * clamp((top - vt) / P.vfade, 0, 1), ex = Math.max(0, Math.min(fx2 - fd, lim * 1.1 - fd)); if (ex > 0) addF([t[0] * ex, t[1] * ex, t[2] * ex], b.p, 'nitro') }
        // ウィリーの上限（v12）: 後輪だけで 34 度を超えたら、アクセルの押す力を弱めて 35〜45 度あたりで止まるようにする（後ろへ宙返りしない）
        b.vxAcc = (b.vxAcc || 0) + Math.max(0, Math.min(fdFree, lim) - Math.min(fd, lim))
        if (b.creep && b.standOn) fd *= clamp((1.2 - vt) * 2, 0, 1) * 0.6 // ゆっくり進むウィリーは歩く速さまで
        if (b.wasRev && vt < -0.3) fd = 0 // v29: ブレーキで下がっている間にアクセルを押した時は、まず止めるだけ（後ろへ下がりながら全開で押すと、前輪が跳ね上がって後ろへ宙返りしていた）
        Ft += fd
        // ウィリーで 26 度を超えたら、アクセルで後ろへ起き上がる回す力を弱める（前へ進む力はそのまま）。後ろへ回っていく速さが遅くなり、保てる角度の幅が少し広がる
        if (!b.g[1] && b.th > 0.45) { const rx = q[0] - b.p[0], ry = q[1] - b.p[1], rz = q[2] - b.p[2], F = [t[0] * fd, t[1] * fd, t[2] * fd]; tau -= P.wheelieEase * ((ry * F[2] - rz * F[1]) * B.R[0] + (rz * F[0] - rx * F[2]) * B.R[1] + (rx * F[1] - ry * F[0]) * B.R[2]) }
      }
      if (inp.brk > 0 && inp.thr <= 0 && vt < 0.6 && b.revT > revHold(b)) { b.wasRev = true; Ft -= (vt > -3.3 ? 1500 : vt > -3.6 ? 250 : 0) * inp.brk }
      if (vt > 0.2) b.wasRev = false // 止まって 0.45 秒ブレーキを押し続けると下がる（歩くより少し速い 3.5m/s まで）
    }
    // ブレーキは後輪寄り。前輪を強く効かせるのは前体重と同時に押した時だけ（ジャックナイフ）。前に傾き始めたら前輪は効かせない
    const spd = Math.abs(b.speed), fb = inp.lean > 0.3 ? 1 : (b.th < -((b.brkV0 || 0) > 0 ? Math.max(0.2, Math.min(1.15, 0.067 * Math.max(spd, (b.brkT || 0) < 1.3 ? b.brkV0 : 0))) : Math.max(0.2, Math.min(0.5, 0.034 * spd))) /* v20: 全速で約50度まで前輪を効かせる。v23: 急ブレーキ（押し続けた時）だけ。ふつうのブレーキは v19 のまま */ ? 0 : 0.85 + 0.15 * Math.min(1, spd / 15)) // v15: 前輪をしっかり効かせる（遅い時に前が少し沈んだだけで前ブレーキが抜けていた） // 速いほど前輪が効いて後輪が浮く（15m/s で約30度まで）
    // v27: 下がっている時にアクセルを押したら、両輪で後ろへの動きをすぐ止める（ブレーキで下がった後、アクセルを押しても 0.5 秒前へ出なかった）
    if (inp.thr > 0 && vt < -0.15 && b.wasRev) Ft += clamp(-vt * 3000, 0, 1) * 0.7 * lim * inp.thr // ブレーキで下がっていた時だけ（段に当たって戻された時などは今まで通り）
    // 曲がりの手前の自動の減速（後輪だけ。前に傾かない）。steer.js の assist が入れる
    if (i === 0 && inp.ab > 0 && vt > 0.5) Ft -= 0.9 * lim * inp.ab
    if (inp.brk > 0 && !(i === 0 && vt < 0.6 && !b.onMov) && !(b.revT > revHold(b) && vt < 0.6)) Ft += -clamp(vt * 3000, -1, 1) * (i ? fb : 0.95) * lim * inp.brk
    Ft -= vt * 6 + (vt > 0 ? 1 : -1) * 0.012 * N // 転がり
    if (b.carryId >= 0 && con.id === b.carryId && inp.thr <= 0.05 && inp.brk <= 0.05 && !NOIDLE.has(world.shapes[con.id].mov.type)) Ft -= clamp(vt * 900, -0.6 * lim, 0.6 * lim) // 動く床の上で何もしない時は、床と一緒に止まる（転がって取り残されない）
    { const sh = world.shapes[con.id]; if (sh.mud) Ft -= clamp(vt, -3, 3) * sh.mud } // 泥: 車輪が沈んで重い
    { const sh = world.shapes[con.id]; if (sh.mov && sh.mov.type === 'gear') Ft -= clamp(vt * sh.mov.grip, -0.9 * lim, 0.9 * lim) } // v16 歯車: 歯にタイヤが噛んで、面の速さに引っぱられる（逆らうと進めない）
    let Fl = -clamp(vl * 2600, -lim, lim)
    const tot = Math.sqrt(Ft * Ft + Fl * Fl)
    if (tot > lim) { Ft *= lim / tot; Fl *= lim / tot }
    const Fw = [n[0] * N + t[0] * Ft + lat[0] * Fl, n[1] * N + t[1] * Ft + lat[1] * Fl, n[2] * N + t[2] * Ft + lat[2] * Fl]
    addF(Fw, q, 'w' + i + (con.side ? 's' : ''))
    { const sh = world.shapes[con.id], m = sh.mov; if (m && m.type === 'seesaw' && !b.ghost) { const r = [q[0] - m.pivot[0], q[1] - m.pivot[1], q[2] - m.pivot[2]]; m.tqSum = (m.tqSum || 0) - ((r[1] * Fw[2] - r[2] * Fw[1]) * m.right[0] + (r[2] * Fw[0] - r[0] * Fw[2]) * m.right[1] + (r[0] * Fw[1] - r[1] * Fw[0]) * m.right[2]); m.tqN = (m.tqN || 0) + 0.5 } }
    return vt
  }
  for (let i = 0; i < 2; i++) {
    const ax = i ? axisF(B) : axisR(B)
    const SUP = { ax, min: 0.35, side: false }, SIDE = { ax, min: 0.35, side: true }
    const c0 = wheelCenter(b, B, i, 0)
    const cAt = s => [c0[0] + ax[0] * s, c0[1] + ax[1] * s, c0[2] + ax[2] * s]
    let con = world.torus(c0, B.R, P.R, P.rt, ids, SUP), s = 0, bottom = 0
    if (con) {
      const top = world.torus(cAt(P.travel), B.R, P.R, P.rt, ids, SUP)
      if (top) { s = P.travel; con = top; bottom = top.depth }
      else {
        let lo = 0, hi = P.travel
        for (let it = 0; it < 8; it++) { const m = (lo + hi) / 2; if (world.torus(cAt(m), B.R, P.R, P.rt, ids, SUP)) lo = m; else hi = m }
        s = hi
        con = world.torus(cAt(Math.max(0, hi - 0.004)), B.R, P.R, P.rt, ids, SUP) || con
      }
    }
    if (con && smash(world, b, con, velAt0, ev)) con = null // 速くぶつかった扉は、車輪が触れた瞬間に壊れる
    const side = world.torus(cAt(s), B.R, P.R, P.rt, ids, SIDE)
    const svRaw = (s - b.s[i]) / H
    b.sv[i] = clamp(svRaw, -6, 6)
    b.s[i] = s; b.g[i] = !!con; b.cn[i] = con || side; b.side[i] = side
    if (globalThis.__dbg) globalThis.__dbg(i, s, bottom, con, c0, side)
    let vt = 0
    if (con) {
      curId = con.id
      const n = con.nw, vq = velAt(con.q)
      const vn = vq[0] * n[0] + vq[1] * n[1] + vq[2] * n[2]
      const cosA = Math.max(0.5, n[0] * ax[0] + n[1] * ax[1] + n[2] * ax[2])
      // 減衰は速い動きで弱まる（実際のサスと同じ。角に当たった瞬間に車体が蹴られすぎない）
      const sv = b.sv[i], asv = Math.abs(sv), damp = P.cs * (asv < 1.2 ? sv : Math.sign(sv) * (1.2 + (asv - 1.2) * 0.15))
      let N = Math.max(0, P.pre + P.ks * s + damp) / cosA
      if (bottom > 0) {
        N += Math.min(16000, Math.max(0, P.kr * bottom - P.cr * vn))
        // 6cm を超えて沈む分は上限なしで押し返す（見た目で地面にめり込ませない）
        if (bottom > 0.06) N += 200000 * (bottom - 0.06) + Math.max(0, -vn) * 3000
        if (-vn > P.hardLand && !b.crashed && ev && !(b.thudT > 0)) { ev.push({ t: 'thud', v: -vn }); b.thudT = 0.3 } // 強い着地でも転ばない（揺れと音だけ）
      }
      if (-vn > b.impact) b.impact = -vn
      vt = wheelForce(i, con, Math.min(N, 400000), ax)
      if (bottom > 0) stopSink(con.q, con.nw, bottom)
    }
    let sideHit = side
    if (side && smash(world, b, side, velAt0, ev)) sideHit = null
    if (sideHit) {
      curId = side.id
      const n = side.n, vq = velAt(side.q)
      const vn = vq[0] * n[0] + vq[1] * n[1] + vq[2] * n[2]
      let N = Math.min(16000, Math.max(0, P.kr * side.depth - P.cr * vn))
      if (side.depth > 0.06) N += 200000 * (side.depth - 0.06) + Math.max(0, -vn) * 3000
      if (side.depth > 0.05) { stopSink(side.q, n, side.depth); if (side.depth > 0.07 && n[1] < 0.3) { const k = (side.depth - 0.07) * 0.5; b.p[0] += n[0] * k; b.p[1] += n[1] * k; b.p[2] += n[2] * k } }
      if (-vn > 13 && !b.crashed && ev && !(b.thudT > 0)) { ev.push({ t: 'thud', v: -vn }); b.thudT = 0.3 }
      const v2 = wheelForce(i, side, N, ax)
      stopSink(side.q, side.n, side.depth)
      if (!con) vt = v2
    }
    b.wheelRot[i] += vt * H / (P.R + P.rt)
    if (i === 0) b.vtRel = (con || side) ? vt : null
  }
  // ---- v16 傾いた着地点（landTol の付いた面）: 空中から降りた瞬間、車体の傾きが面と合っていなければ転倒（弾かれて落ちる）
  if (!b.crashed && b.airT > 0.25) for (let i = 0; i < 2; i++) { const cn = b.cn[i]; if (!cn || !b.g[i]) continue; const sh = world.shapes[cn.id]; if (!sh.landTol) continue
    const n = cn.nw || cn.n, sa = B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2]; if (Math.abs(sa) > dsin(sh.landTol)) { crash(b, 'land', 0, ev); b.v[0] += n[0] * 2.5; b.v[1] += n[1] * 2.5; b.v[2] += n[2] * 2.5; break } }
  // ---- 最高速度がなかった時の速さとの差 vx（v11 と同じ走りをした時の速さ - 今の速さ）。アクセルを離す・ブレーキで消える
  { const v = Math.max(0, b.speed), vx = b.vx || 0
    let d = (b.vxAcc || 0) / P.m * H - 0.35 * ((v + vx) * (v + vx) - v * v) / P.m * H
    b.vxAcc = 0
    if (inp.brk > 0 || inp.ab > 0 || inp.thr <= 0) d -= vx * 12 * H // 減速した時は、最高速度がなくても同じだけ遅くなっていたので消す
    b.vx = Math.max(0, vx + d) }
  // ---- ジャンプ台の踏み切り: 台（launch の付いた形）から両輪が離れた瞬間に、v11 と同じ飛び出しの速さに戻す（飛ぶ距離を変えない）
  { const onL = [0, 1].some(i => b.cn[i] && world.shapes[b.cn[i].id].launch)
    if (onL) b.launchT = 0.25; else b.launchT = Math.max(0, (b.launchT || 0) - H) // 台の端の継ぎ目に一瞬触れても、台から跳んだと見なす
    if (b.launchT > 0 && !b.g[0] && !b.g[1]) { b.launchT = 0; const v = Math.sqrt(b.v[0] * b.v[0] + b.v[1] * b.v[1] + b.v[2] * b.v[2]), k = (v + (b.vx || 0)) / Math.max(1e-6, v); b.vx = 0; b.v[0] *= k; b.v[1] *= k; b.v[2] *= k; if (ev && k > 1.001) ev.push({ t: 'launch', v, to: v * k }) }
}
  // ---- 止まってブレーキを押し続けた時間（下がるかどうか）
  // 動く床の上か（床の速さに対する速さで止まっているかを見る。床の上では、止まっているブレーキは床と一緒に運ばれるだけ。下がるのは長押しした時だけ）
  { const sh0 = b.cn[0] && world.shapes[b.cn[0].id], sh1 = b.cn[1] && world.shapes[b.cn[1].id]; const still = sh => sh.mov.type === 'crumble' || sh.mov.type === 'brk' || (sh.mov.type === 'kick' && sh.mov.trig == null) // v29: 下りて止まっている跳ね板の上はふつうの床（ブレーキ長押しで下がれる）
    b.onMov = !!((sh0 && sh0.mov && !still(sh0)) || (sh1 && sh1.mov && !still(sh1))) }
  const vr = b.vtRel != null ? b.vtRel : b.speed
  // v29 本人「ジャンプ台に乗ったままバックできない」: 登り坂（車体が 8 度より上を向いている）では、前体重のままでも・少し動いていても下がれる
  { const up = !!b._upBrk
    if (inp.brk > 0 && inp.thr <= 0 && (inp.lean <= 0.3 || up) && b.g[0] && b.g[1] && vr < (up ? 1.0 : 0.6) && (b.revT > 0 || Math.abs(vr) < (up ? 1.0 : 0.6))) b.revT = (b.revT || 0) + H; else b.revT = 0 }
  // ---- 崩れる足場: 乗っている時間がたまると落ちる（ゴーストは崩さない）
  if (!b.ghost) for (let i = 0; i < 2; i++) { const cn = b.cn[i]; if (!cn) continue; const sh = world.shapes[cn.id]; if (sh.mov && sh.mov.type === 'crumble' && !sh.gone) { if (!(sh.touch > 0) && ev) ev.push({ t: 'crumbleTouch', id: sh.id, v: b.speed }); if (!(sh.touch > 0)) { b._crList = b._crList || []; if (!b._crList.includes(sh.id)) b._crList.push(sh.id) } sh.touch += H / 2; sh.lastTouch = world.time; if (sh.touch > sh.mov.delay) { sh.gone = true; sh.goneAt = world.time; if (ev) ev.push({ t: 'crumble', id: sh.id }) } } }
  // v31 本人「落ちる板が、最高速度で進んでると反応してない」: 速く走り抜けた板も、離れた直後（0.12 秒）に後ろで崩れ落ちる（渡り切れるのはそのまま。遅い時は今まで通り乗っている間に落ちる）
  if (!b.ghost && b._crList && b._crList.length) b._crList = b._crList.filter(id => { const sh = world.shapes[id]; if (sh.gone) return false; const dt = world.time - (sh.lastTouch ?? -1e9); if (dt > 1.0) return false
    const away = closest(sh, b.p[0], b.p[1], b.p[2]).d
    if (dt > 0.12 && away > 1.3 && b.speed > 0.5 && (!b.cn[0] || b.cn[0].id !== id) && (!b.cn[1] || b.cn[1].id !== id)) { /* 板を越えて前へ進んだ時だけ（手前で止まって下がった時は崩さない） */ sh.gone = true; sh.goneAt = world.time; if (ev) ev.push({ t: 'crumble', id: sh.id, fast: true }); return false } return true })
  // ---- 風（決まった強弱で吹く）
  for (const wd of world.winds) {
    if (b.p[0] < wd.min[0] || b.p[0] > wd.max[0] || b.p[1] < wd.min[1] || b.p[1] > wd.max[1] || b.p[2] < wd.min[2] || b.p[2] > wd.max[2]) continue
    const k = P.m * (wd.pulse ? gustK(wd, world.time) : 0.55 + 0.45 * dsin(world.time * wd.w + wd.ph))
    fx += wd.f[0] * k; fy += wd.f[1] * k; fz += wd.f[2] * k
  }
  // ---- ニトロの噴射（空中でも少し押す。谷越えの最後のひと伸び）
  if (b.nitroOn && !b.g[0] && !b.g[1]) { fx += B.h[0] * P.nitroThrust; fz += B.h[2] * P.nitroThrust }
  // ---- 車体の下（こする）と人（当たると転倒）
  b.scrape = 0
  for (const fp of framePts(b, B)) {
    const con = world.sphere(fp.c[0], fp.c[1], fp.c[2], fp.r, ids)
    if (!con) continue
    if (smash(world, b, con, velAt0, ev)) continue
    curId = con.id
    const vq = velAt(con.q), n = con.n, vn = vq[0] * n[0] + vq[1] * n[1] + vq[2] * n[2]
    const N = Math.max(0, P.kr * con.depth - P.cr * vn)
    const vt = [vq[0] - n[0] * vn, vq[1] - n[1] * vn, vq[2] - n[2] * vn], vtl = Math.sqrt(vt[0] * vt[0] + vt[1] * vt[1] + vt[2] * vt[2]) || 1
    const Ff = Math.min(0.5 * N, vtl * 3000)
    addF([n[0] * N - vt[0] / vtl * Ff, n[1] * N - vt[1] / vtl * Ff, n[2] * N - vt[2] / vtl * Ff], con.q, 'frame')
    b.scrape = Math.max(b.scrape, con.depth)
    stopSink(con.q, n, con.depth + 0.03)
    if (-vn > P.hardLand * 0.8 && !b.crashed && ev && !(b.thudT > 0)) { ev.push({ t: 'thud', v: -vn }); b.thudT = 0.3 }
  }
  // ---- 弾き飛ばす物（振り子の鉄球・落石）: 人・車体・車輪のどこかに当たったら、当たった向きへ強く押し出す（転ばせない）
  b.knockT = Math.max(0, (b.knockT || 0) - H)
  if (!b.crashed && !(b.knockT > 0)) {
    const pts = riderPts(b, B).concat(framePts(b, B), [{ c: wheelCenter(b, B, 0, b.s[0]), r: P.R + P.rt }, { c: wheelCenter(b, B, 1, b.s[1]), r: P.R + P.rt }])
    for (const id of ids) {
      const sh = world.shapes[id]; if (!sh.knock || sh.gone) continue
      let hit = null
      for (const pt of pts) { closest(sh, pt.c[0], pt.c[1], pt.c[2], OUT); if (OUT.d < pt.r) { hit = { n: OUT.n.slice(), q: OUT.q.slice() }; break } }
      if (!hit) continue
      const vs = world.shapeVel(sh, hit.q) || [0, 0, 0]
      let nx = hit.n[0], nz = hit.n[2]; const L = Math.sqrt(nx * nx + nz * nz) || 1; nx /= L; nz /= L
      const vn = b.v[0] * nx + b.v[2] * nz
      const k = sh.knock
      b.v[0] += nx * (k - Math.min(0, vn)) + vs[0] * 0.9; b.v[2] += nz * (k - Math.min(0, vn)) + vs[2] * 0.9; b.v[1] = Math.max(b.v[1], 0) + k * 0.3 + Math.max(0, vs[1]) * 0.5
      b.knockT = 0.5
      if (ev) ev.push({ t: 'knock', v: Math.sqrt(vs[0] * vs[0] + vs[2] * vs[2]) + k, tag: sh.tag })
      break
    }
  }
  if (!b.crashed) {
    const rp = riderPts(b, B)
    for (let k = 0; k < rp.length; k++) {
      const con = world.sphere(rp[k].c[0], rp[k].c[1], rp[k].c[2], rp[k].r, ids)
      if (con && con.depth > 0.01 && !world.shapes[con.id].knock && !smash(world, b, con, velAt0, ev)) { crash(b, k === 2 ? 'head' : 'body', 0, ev); break }
    }
  } else {
    // 転倒後は人の当たりも柔らかく入れる（車体が地面に沈まないように）
    for (const fp of riderPts(b, B)) {
      const con = world.sphere(fp.c[0], fp.c[1], fp.c[2], fp.r, ids); if (!con) continue
      curId = con.id
      const vq = velAt(con.q), n = con.n, vn = vq[0] * n[0] + vq[1] * n[1] + vq[2] * n[2]
      const N = Math.max(0, 60000 * con.depth - 2500 * vn)
      const vt = [vq[0] - n[0] * vn, vq[1] - n[1] * vn, vq[2] - n[2] * vn], vtl = Math.sqrt(vt[0] * vt[0] + vt[1] * vt[1] + vt[2] * vt[2]) || 1
      const Ff = Math.min(0.6 * N, vtl * 2000)
      addF([n[0] * N - vt[0] / vtl * Ff, n[1] * N - vt[1] / vtl * Ff, n[2] * N - vt[2] / vtl * Ff], con.q)
    }
  }
  // ---- 空気
  const vv = Math.sqrt(b.v[0] * b.v[0] + b.v[1] * b.v[1] + b.v[2] * b.v[2])
  fx -= b.v[0] * vv * 0.35; fy -= b.v[1] * vv * 0.35; fz -= b.v[2] * vv * 0.35
  // ---- 重心の前後で回す力
  const air = !b.g[0] && !b.g[1]
  tau -= b.lean * (air ? P.leanTorqueAir : P.leanTorqueGround) * (b.crashed ? 0 : 1) // 後ろ重心(-1)で前が上がる
  // ---- ウィリーの上がり始め（v12）: 後ろ体重＋アクセルで、前輪を素早く浮かせる。26 度から先は今まで通り（後ろへ回る速さは変えない）
  if (!b.crashed && b.g[0] && inp.lean < -0.6 && inp.thr > 0.5 && b.th < 0.42 && !b.creep) {
    const wT = b.th < 0.22 ? 1.7 : 1.7 - (b.th - 0.22) / 0.2 * 1.0 // 上がり始めは速く、26 度に近づくほど今までの速さへ
    if (b.w < wT) tau += (wT - b.w) * 1400
    b.popT = 1.0
  }
  // 素早く上げた勢いが、30 度から先の後ろへ回る速さに残らないように（今までの約 73 度/秒に合わせる）
  b.popT = Math.max(0, (b.popT || 0) - H)
  if (b.popT > 0 && !b.crashed && b.th > 0.3 && b.th < 1.2 && b.w > 1.2) tau -= (b.w - 1.2) * 1200
  // 後ろへ回りすぎ（後輪で立って、地面から約 78 度を超えた）は転倒（v13 で戻した）
  if (!b.crashed && b.g[0] && !b.g[1] && b.cn[0] && b.cn[0].feat !== 2 && b.cn[0].feat !== 3) { const n = b.cn[0].nw || b.cn[0].n, rel = B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2]; if (rel > 0.98 && b.th > 1.2) crash(b, 'back', 0, ev) }
  // ---- 前に転ばない補助: 前輪だけが着いていて、車体が地面へ突っ込む向きに傾いたら、前へ回るのを止める。
  //      前体重とブレーキを同時に押している時（ジャックナイフの技）は、約 40 度まで前へ傾けてよい（そこから先は止める）
  if (!b.crashed && b.g[1] && !b.g[0] && b.cn[1]) {
    const n = b.cn[1].nw || b.cn[1].n, rel = B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2] // 地面に対する前の傾き（負＝突っ込む）
    // ブレーキだけの浮きは速さの分だけ（遅くなると戻る）。前体重＋ブレーキは、遅い時は約 37 度で保つ（ジャックナイフ）が、速い時（4m/s 超）は守らない（前へ回って転ぶ）
    const lim = (b.brkV0 || 0) > 14.5 && inp.brk > 0.5 ? -9 : inp.lean > 0.3 && inp.brk > 0 ? (Math.abs(b.speed) > 4 ? -9 : -0.64) : -Math.max(0.3, (b.brkV0 || 0) > 0 ? Math.min(0.8, 0.057 * Math.abs(b.speed) + 0.03) : Math.min(0.56, 0.036 * Math.abs(b.speed) + 0.04), 0.77 * clamp(((b.brkV0 || 0) - 4) / 9, 0, 1) * clamp(Math.abs(b.speed) / 3, 0, 1) * clamp(1.3 - (b.brkT || 0), 0, 1)) /* v20: 全速（13m/s）からの急ブレーキで後輪が約50度まで浮く（本人「全速からの急ブレーキは50度で」） */
    b.noseT = rel < -0.94 && b.w < 0.3 ? (b.noseT || 0) + H : 0
    if (b.noseT > 0.12) crash(b, 'front', 0, ev) // 前輪だけで、地面から 70 度より前へ傾いたまま（前へ回っていく）
    if (rel < lim) { tau += (lim - rel) * 9000; if (b.w < 0) tau -= b.w * 1400 }
    else if (rel < lim + 0.15 && b.w < -1.5) tau -= (b.w + 1.5) * 900 // 限界の手前で、前へ回る勢いを弱めておく（速い時の急ブレーキで回り切らない）
  }
  // ---- v20 急ブレーキの後輪上げ（本人「全速からの急ブレーキは50度で」）: ブレーキだけを押した時の速さで目標を決め（13m/s 以上で 50 度、4m/s 以下は 0）、
  //      前輪が着いている間だけ毎秒約 90 度で後輪を持ち上げる。速さが落ちると上の lim が下がって戻る
  // v23: ブレーキ全開を BRK_HOLD 秒以上押し続けた時だけ持ち上げる（段の前の軽い減速・短い踏み直しでは浮かない）。持ち上げる強さは押し始めの速さで決める
  if (!b.crashed && inp.brk > 0.5 && inp.thr <= 0.05 && inp.lean <= 0.3) { if (!(b.brkHold > 0)) b.brkVs = Math.abs(b.speed); b.brkHold = (b.brkHold || 0) + H } else b.brkHold = 0
  if (!b.crashed && inp.brk > 0.5 && inp.thr <= 0.05 && inp.lean <= 0.3 && b.g[1] && b.brkHold >= BRK_HOLD) {
    if (!(b.brkV0 > 0)) { b.brkV0 = Math.max(Math.abs(b.speed), b.brkVs || 0); b.brkT = 0 } else if (Math.abs(b.speed) > b.brkV0 + 0.05) { b.brkV0 = Math.abs(b.speed); b.brkT = 0 } else b.brkT = (b.brkT || 0) + H // 速さが上がった時（止まったまま押していた後に押し出された等）は数え直す
    const flip = b.brkV0 > 14.5 // v20b: ニトロ並みの速さ（最高速度13.5を超えた）からの急ブレーキは、ゆっくり前へ回って転ぶ（本人「ニトロ中の急ブレーキはゆっくり転ぶように」）
    const tgt = flip ? 1.5 : clamp(1.3 - b.brkT, 0, 1) * 0.873 * clamp((b.brkV0 - 4) / 9, 0, 1) * clamp(Math.abs(b.speed) / 3, 0, 1)
    { const wT = flip ? 0.6 : Math.min(1.6, (b.th + tgt) * 5); if (flip && b.w < -wT) tau += (-wT - b.w) * 1600 /* ゆっくり回る（約1.5秒で転ぶ） */; if (flip && b.th < -1.3) crash(b, 'front', 0, ev) /* 約75度で転ぶ */; if ((flip || b.th < -0.2) && b.th > -tgt && b.w > -wT) tau -= (b.w + wT) * 1400 } /* 自然に 11 度以上浮いた時だけ（氷・濡れた石では浮かない）。目標に近づくほどゆっくり */
  } else { b.brkV0 = 0; b.brkT = 0 }
  // ---- 止まったままのウィリー（トライアルのスタンディングウィリー）: 速さがほぼ 0・アクセルなしで後ろ体重なら、
  //      前輪を約 33 度まで持ち上げてそこで保つ。前体重＋ブレーキなら、前輪で立って約 33 度まで前へ傾けて保つ。
  //      ここを超えて後ろへ回るのは、アクセルを足して押し続けた時だけ
  // 止まったまま体重を 0.35 秒押し続けた時だけ（走りながらの技の邪魔をしない）
  // 後ろ体重をはっきり（-0.6 より強く）押してブレーキなし、または前体重をはっきり押してブレーキ。走りながらの技やバックの邪魔をしない
  // ゆっくり進むウィリー: 後ろ体重をはっきり押してアクセルを足すと、歩く速さ（1.2m/s まで）で前輪を約 33 度に上げたまま進める（高い段に前輪を掛ける時）
  const creep = !b.crashed && inp.thr > 0.05 && inp.brk <= 0.05 && inp.lean < -0.6 && b.speed > -0.3 && b.speed < 1.8 && b.g[0]
  b.creep = creep
  const standing = creep || (!b.crashed && Math.abs(b.speed) < 0.9 && ((inp.thr <= 0.05 && inp.brk <= 0.05 && inp.lean < -0.6) || (inp.brk > 0.3 && inp.lean > 0.6)))
  b.standT = standing ? (b.standT || 0) + H : 0
  if (standing && (b.standT > 0.35 || b.standOn || creep)) {
    let con = null, tgt = 0
    if (b.g[0] && inp.lean < -0.6) { con = b.cn[0]; tgt = 0.6 * Math.min(1, -inp.lean) }
    else if (b.g[1] && inp.lean > 0.6) { con = b.cn[1]; tgt = -0.58 * Math.min(1, inp.lean) }
    b.standOn = !!con
    if (con) {
      const n = con.nw || con.n, rel = B.f[0] * n[0] + B.f[1] * n[1] + B.f[2] * n[2] // 地面に対する傾き（正＝前が上）
      tau += (tgt - rel) * 7000 - b.w * 650
    }
  } else b.standOn = false
  b.standAgo = b.standOn ? 0 : (b.standAgo ?? 9) + H // ウィリーで立てていた直後は、前体重に移しても跳ねない（段に前輪を掛けたまま）
  // ---- 高い段によじ登る: 前輪が段の上に掛かり、後輪が段の面に当たっている時、前体重＋アクセルで後輪を引き上げる
  //      （人が前へ体を投げ出して、後輪で段の面を駆け上がる動き）。濡れてすべる段では弱い
  b.hook = false
  b.hookT = Math.max(0, (b.hookT || 0) - H)
  if (!b.crashed && inp.lean > 0.3 && inp.thr > 0.2 && b.g[1] && b.cn[1]) {
    const rc = wheelCenter(b, B, 0, b.s[0]), top = b.cn[1].q[1]
    let face = false
    if (b.cn[0]) { const sn = b.cn[0].nw || b.cn[0].n; face = sn[1] < 0.6 && -(sn[0] * B.h[0] + sn[2] * B.h[2]) > 0.5 }
    if (face && top - (rc[1] - P.R - P.rt) > 0.3) { b.hookT = 0.25; b.hookMu = Math.min(world.shapes[b.cn[0].id].mu, world.shapes[b.cn[1].id].mu) }
    // 後輪の中心が段の角より上に出るまで引き上げる（途中で面から少し離れても続ける）
    if (b.hookT > 0 && rc[1] < top + 0.3) {
      const k = clamp((b.hookMu - 0.35) / 0.7, 0, 1)
      const vq = velAt0(rc), F = clamp((1.1 - vq[1]) * 2600, 0, P.m * P.g * 1.05) * inp.thr * k
      addF([B.h[0] * F * 0.25, F, B.h[2] * F * 0.25], rc, 'hook')
      b.hook = F > 0
    }
  }
  // ---- 跳ねる（後ろに乗ってから素早く前へ）
  if (!b.crashed) {
    if (b.g[0] && b.g[1] && inp.lean < -0.6) { b.pre = Math.min(1, b.pre + H / 0.22); b.tBack = 0 }
    else { b.tBack += H; if (inp.lean > -0.6) b.pre = Math.max(0, b.pre - H * 0.8) }
    b.hopCool = Math.max(0, b.hopCool - H)
    if (inp.lean > 0.3 && b.tBack < 0.3 && b.pre > 0.3 && b.g[0] && b.g[1] && b.hopCool <= 0 && !(b.standAgo < 0.5)) {
      const dv = 2.5 * b.pre
      b.v[0] += B.u[0] * dv; b.v[1] += B.u[1] * dv; b.v[2] += B.u[2] * dv; b.pre = 0; b.hopCool = 0.5
      if (ev) ev.push({ t: 'hop', dv })
    }
  }
  // ---- 積分
  b.v[0] += fx / P.m * H; b.v[1] += fy / P.m * H; b.v[2] += fz / P.m * H
  const vl2 = Math.sqrt(b.v[0] * b.v[0] + b.v[1] * b.v[1] + b.v[2] * b.v[2])
  if (vl2 > P.vmax + 6) { const k = (P.vmax + 6) / vl2; b.v[0] *= k; b.v[1] *= k; b.v[2] *= k }
  b.w += tau / P.Ip * H
  if (air) b.w *= 1 - 0.35 * H
  // v32 上昇気流の中（天空城への大ジャンプ）で体重を動かしていない時は、車体がゆっくり着地坂の傾きへ戻る（何もしなくても前へ回りすぎない。後ろ体重を続ければ宙返りできる）
  if (air && !b.crashed && Math.abs(b.lean) < 0.15) for (const wd of world.winds) { if (!wd.updraft || b.p[0] < wd.min[0] || b.p[0] > wd.max[0] || b.p[1] < wd.min[1] || b.p[1] > wd.max[1] || b.p[2] < wd.min[2] || b.p[2] > wd.max[2]) continue
    let d = b.th - (wd.lvl ?? -0.35); d = Math.atan2(Math.sin(d), Math.cos(d)); b.w += (-d * 4 - b.w * 2.2) * H; break }
  b.w = clamp(b.w, -14, 14)
  // v29 前輪が段の面に当たった直後（0.8 秒）は、後ろへ回る勢いを 1.2 rad/s までにする（速いまま段に当たると跳ね上げられて後ろへ宙返りしていた。水の中の木箱）
  const wet = c => { const sh = c && world.shapes[c.id]; return !!(sh && (sh.flow || sh.flowR || sh.flowT)) } // 水の流れの中の段だけ（水の中の木箱。ほかの段・ジャンプ台の当たり方は変えない）
  const vNow = b.v[0] * B.h[0] + b.v[2] * B.h[2], hitDrop = b.speed - vNow > 1.2 // この刻みで前向きの速さが急に落ちた（段の面に当たった。ジャンプ台の坂に乗っただけでは落ちない）
  { const c1 = b.cn[1], n1 = c1 && (c1.nw || c1.n); if (hitDrop && n1 && wet(c1) && -(n1[0] * B.h[0] + n1[2] * B.h[2]) > 0.25 && n1[1] < 0.97) b._faceT = 0.8; else if (b._faceT) b._faceT = Math.max(0, b._faceT - H)
    if (b._faceT > 0 && !b.hang && b.w > 1.2) b.w = 1.2 }
  // 後輪が段の面に当たった直後（0.8 秒）は、前へ回る勢いを 1.2 rad/s までにする（ウィリーのまま後輪が段に当たると前へ投げ出されていた）
  { const c0 = b.cn[0], n0 = c0 && (c0.nw || c0.n); if (hitDrop && n0 && wet(c0) && -(n0[0] * B.h[0] + n0[2] * B.h[2]) > 0.25 && n0[1] < 0.97) b._faceR = 0.8; else if (b._faceR) b._faceR = Math.max(0, b._faceR - H)
    if (b._faceR > 0 && !b.hang && b.w < -1.2) b.w = -1.2 }
  b.p[0] += b.v[0] * H; b.p[1] += b.v[1] * H; b.p[2] += b.v[2] * H
  if (b.carryId >= 0) { const sh = world.shapes[b.carryId], u = world.shapeVel(sh, b.p) || [0, 0, 0]; b.p[0] += u[0] * H; b.p[1] += u[1] * H; b.p[2] += u[2] * H; if (sh.mov.type === 'spin') { const a = sh.mov.rate * H, ca = dcos(a), sa = dsin(a), vx = b.v[0], vz = b.v[2]; b.psi += a; b.v[0] = vx * ca + vz * sa; b.v[2] = -vx * sa + vz * ca } } // 回る床の上では、床に対する速さの向きも一緒に回す
  b.th += b.w * H
  b.speed = b.v[0] * B.h[0] + b.v[2] * B.h[2]
  // ---- 向き（ヨー）。前輪だけ接地＝前輪を軸に（ジャックナイフ）、後輪だけ＝後輪を軸に
  let rate = 0, pivot = null
  const st = b.crashed ? 0 : -inp.steer
  if (b.g[0] && b.g[1]) rate = b.speed * dsin(b.delta) / dcos(b.delta) / (P.front[0] - P.rear[0])
  else if (b.g[1] && !b.g[0]) { rate = st * 2.3; pivot = b.cn[1].q }
  else if (b.g[0] && !b.g[1]) { rate = st * 1.2 + b.speed * dsin(b.delta) / dcos(b.delta) / 1.42 * 0.5; pivot = b.cn[0].q }
  else rate = st * 0.5
  // 横風は接地中も前輪をあおって向きを変える（タイヤは横には滑らないが、ハンドルが取られる）
  if (!b.crashed && (b.g[0] || b.g[1])) for (const wd of world.winds) {
    if (b.p[0] < wd.min[0] || b.p[0] > wd.max[0] || b.p[1] < wd.min[1] || b.p[1] > wd.max[1] || b.p[2] < wd.min[2] || b.p[2] > wd.max[2]) continue
    const k = wd.pulse ? gustK(wd, world.time) : 0.55 + 0.45 * dsin(world.time * wd.w + wd.ph)
    const lat = (wd.f[0] * B.R[0] + wd.f[2] * B.R[2]) * k // 右向きの風は正
    rate -= lat * 0.21
  }
  // 横に傾いた面では、前輪が下り側へ取られる
  if (!b.crashed && b.g[1] && b.cn[1]) {
    const n = b.cn[1].nw || b.cn[1].n, side = n[0] * B.R[0] + n[1] * B.R[1] + n[2] * B.R[2]
    if (side > 0.24 || side < -0.24) rate -= (side - Math.sign(side) * 0.2) * 0.6 * Math.min(1, Math.abs(b.speed) / 3)
  }
  // 横から当たっている車輪を、その面へ押し込む向きには回さない（ハンドルで壁にめり込ませない）
  if (rate !== 0) {
    const pv = pivot || b.p
    for (let i = 0; i < 2; i++) {
      const sd = b.side[i]; if (!sd || sd.depth < 0.005) continue
      const n = sd.n, q = sd.q
      // ヨーで q が動く速さ = rate * (Y × (q - pivot))
      const dx = q[0] - pv[0], dz = q[2] - pv[2]
      const vx = rate * dz, vz = -rate * dx
      if (vx * n[0] + vz * n[2] < 0) { rate = 0; break }
    }
  }
  b.psiRate = rate
  const dpsi = rate * H
  if (dpsi !== 0) {
    b.psi += dpsi
    if (pivot) {
      const c = dcos(dpsi), s = dsin(dpsi)
      const rx = b.p[0] - pivot[0], rz = b.p[2] - pivot[2]
      b.p[0] = pivot[0] + rx * c + rz * s; b.p[2] = pivot[2] - rx * s + rz * c
      const vx = b.v[0], vz = b.v[2]; b.v[0] = vx * c + vz * s; b.v[2] = -vx * s + vz * c
    }
  }
  if (air) b.airT += H; else { if (b.airT > 0.25 && ev) ev.push({ t: 'land', air: b.airT, impact: b.impact }); b.airT = 0 }
  if (b.crashed) b.crashed.t += H
  if (b.thudT > 0) b.thudT -= H
}
function crash(b, why, v, ev) {
  b.crashed = { why, v, t: 0, at: b.p.slice() }
  if (ev) ev.push({ t: 'crash', why, v })
}

// 状態の指紋（同じ入力なら同じ結果か、を比べる）
export function hashBike(b) {
  const a = new Float64Array([...b.p, ...b.v, b.th, b.w, b.psi, b.delta, b.lean, ...b.s])
  const u = new Uint32Array(a.buffer); let h = 2166136261
  for (let i = 0; i < u.length; i++) { h ^= u[i]; h = Math.imul(h, 16777619) >>> 0 }
  return h.toString(16)
}

// ============================================================ 縁に前輪を引っ掛けて耐える（v15）
// 高い縁（1.5m 以上・shape.hang = { a, b, n（縁から手前へ出る水平の向き）, max（耐えられる秒数） }）の角に、前輪が下から・横から近づいたら引っ掛かる。
// 引っ掛かっている間は、前輪を縁の角に乗せ、車体は壁沿いにほぼ立つ。
//   ・体の釣り合い x（-1 後ろ〜+1 前）は放っておくと倒れていく。体重の前後で直す。風・鉄球の風圧で揺さぶられる。|x| > 1 で落ちる（前は転倒、後ろは下へ落ちる）
//   ・ブレーキを離すと前輪が少しずつずり落ちる（slip が 0.5 で落ちる）
//   ・耐えられる時間には限りがある（縁が欠けていく）。残り 2 秒で小石がこぼれる
//   ・前体重＋アクセルで後輪で壁を駆け上がり、上へ乗る（0.8 秒）
const HANG_TH = 1.36 // 引っ掛かった時の車体の傾き（約 78 度）
function hangEdge(sh, p) {
  const H = sh.hang, ax = [H.b[0] - H.a[0], H.b[1] - H.a[1], H.b[2] - H.a[2]], L2 = ax[0] * ax[0] + ax[1] * ax[1] + ax[2] * ax[2]
  const u = clamp(((p[0] - H.a[0]) * ax[0] + (p[1] - H.a[1]) * ax[1] + (p[2] - H.a[2]) * ax[2]) / L2, 0.05, 0.95)
  return { e: [H.a[0] + ax[0] * u, H.a[1] + ax[1] * u, H.a[2] + ax[2] * u], u }
}
function hangCatch(world, b, inp, ev) {
  const B = basis(b), fc = wheelCenter(b, B, 1, b.s[1]), rc = wheelCenter(b, B, 0, b.s[0])
  for (const sh of world.hangs) {
    if (sh.gone) continue
    const H = sh.hang, { e } = hangEdge(sh, fc)
    const dh = (fc[0] - e[0]) * H.n[0] + (fc[2] - e[2]) * H.n[2], dv = fc[1] - e[1]
    const into = -(B.h[0] * H.n[0] + B.h[2] * H.n[2])
    // v17: 掛かる幅を少し広く（前輪が縁の角の少し下・少し手前でも掛かる）。縁より下から近づく時だけ
    const ez = H.easy ? 1.35 : 1 // v22: 最初の縁は掛かる幅をさらに広く
    if (into < (H.easy ? 0.45 : 0.6) || dh < -0.16 * ez || dh > 0.72 * ez || dv < -0.62 * ez || dv > 0.36 * ez || rc[1] > e[1] - 0.15) continue
    const lat = Math.abs((fc[0] - e[0]) * H.n[2] - (fc[2] - e[2]) * H.n[0]); if (lat > 3) continue
    // 掛かった瞬間の車体の位置・角度・向きを覚え、HANG_BLEND 秒かけて縁の姿勢へ移す（1 刻みで飛ばさない）
    b.hang = { id: sh.id, t: 0, x: clamp((b.w || 0) * -0.15, -0.3, 0.3), xv: 0, slip: 0, climb: 0, psi: Math.atan2(H.n[2], -H.n[0]), warned: false, bl: 0, th0: b.th, psi0: b.psi, fc0: fc.slice(), s0: b.s.slice() }
    b.w = 0; b.psiRate = 0 // 速さは次の刻みで、動きから決め直す（ここで 0 にすると 1 刻みの飛びに見える）
    if (ev) ev.push({ t: 'hang', p: e.slice() })
    hangPose(world, b)
    return
  }
}
const HANG_BLEND = 0.5, CLIMB_T = 1.3
const smooth01 = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u) }
const wrapA = a => a - TAU * Math.round(a / TAU)
// 前輪の中心が fc に来るように、角度 th・向き psi で車体を置く
function placeByFront(b, th, psi, fc, sF = 0) {
  b.th = th; b.psi = psi
  const B = basis(b), w0 = wheelCenter(b, B, 1, sF)
  b.p = [b.p[0] + fc[0] - w0[0], b.p[1] + fc[1] - w0[1], b.p[2] + fc[2] - w0[2]]
}
// 後輪が縁の壁（角の下の面と上の面）にめり込む深さ（壁の外なら 0 以下）
function rearIntoWall(b, e, n) {
  const B = basis(b), rc = wheelCenter(b, B, 0, 0), r = BIKE.R + BIKE.rt
  const h = (rc[0] - e[0]) * n[0] + (rc[2] - e[2]) * n[2], v = rc[1] - e[1]
  const d = h > 0 && v > 0 ? Math.sqrt(h * h + v * v) : h > 0 ? h : v > 0 ? v : -Math.min(-h, -v)
  return r - d
}
function hangPose(world, b) {
  const sh = world.shapes[b.hang.id], H = sh.hang, hg = b.hang
  b.lean = clamp(b.lean, -1, 1)
  const { e } = hangEdge(sh, b.p)
  const r = BIKE.R + BIKE.rt
  if (hg.cl) {
    // 登る: 前輪は縁の角から上の面へ転がり、後輪は壁を駆け上がって角を越える。車体はだんだん寝て、最後は縁の上の姿勢（出口の姿勢）にぴったり着く
    const C = hg.cl, uc = clamp(hg.climb, 0, 1), u = uc * uc * (2 - uc) // 始めはゆっくり、終わりは縁の上を進む速さのまま（出口で速さが飛ばない）
    const q = u * (C.tab.length - 1), i0 = Math.min(C.tab.length - 2, Math.floor(q)), a = q - i0, A = C.tab[i0], Bq = C.tab[i0 + 1]
    const Fh = A.F[0] + (Bq.F[0] - A.F[0]) * a, Fv = A.F[1] + (Bq.F[1] - A.F[1]) * a, n = C.n
    const fc = [C.e[0] + n[0] * Fh, C.e[1] + Fv, C.e[2] + n[2] * Fh]
    b.s = [b.s[0] * (1 - u), b.s[1] * (1 - u)]
    placeByFront(b, A.th + (Bq.th - A.th) * a, C.psi, fc, b.s[1])
    b.g = [u > 0.55, true]
  } else {
    const thT = HANG_TH + hg.x * 0.2 - hg.slip * 0.25
    // 前輪の中心は縁の角の少し手前・上（ずり落ちた分だけ下がって手前へ）
    const fcT = [e[0] + H.n[0] * (r * 0.62 + hg.slip * 0.25), e[1] + r * 0.78 - hg.slip * 0.5, e[2] + H.n[2] * (r * 0.62 + hg.slip * 0.25)]
    const k = smooth01(hg.bl)
    // サスペンションの縮みも一緒に移す（一気に伸ばすと車輪が飛ぶ）
    b.s = [hg.s0[0] * (1 - k), hg.s0[1] + (0.04 - hg.s0[1]) * k]
    if (k < 1) {
      const fc = [hg.fc0[0] + (fcT[0] - hg.fc0[0]) * k, hg.fc0[1] + (fcT[1] - hg.fc0[1]) * k, hg.fc0[2] + (fcT[2] - hg.fc0[2]) * k]
      placeByFront(b, hg.th0 + (thT - hg.th0) * k, hg.psi0 + wrapA(hg.psi - hg.psi0) * k, fc, b.s[1])
    } else placeByFront(b, thT, hg.psi, fcT, b.s[1])
    b.g = [false, true]
  }
  b.cn = [null, { id: sh.id, q: e.slice(), n: [0, 1, 0], nw: [0, 1, 0], depth: 0, mu: 1 }]; b.side = [null, null]
  b.airT = 0
}
// 登り始める: 今の姿勢と、縁の上の出口の姿勢（後輪が角から 0.25m 奥・少し前上がり）を覚える
// 登りの道筋（縁の角の断面の 2 次元。h = 壁から外へ、v = 角から上）。
// 後輪: 掛かった所 → 壁に着く → 壁を駆け上がる → 角を転がる（角を中心の円）→ 縁の上を少し奥へ。
// 前輪: 角の上を転がって（角を中心の円）縁の上の面へ出て、後輪から車輪の間の長さ Lw を保って前へ進む。
// 両輪の位置から車体の角度が決まる。どの刻みも前の刻みからなめらかにつながる（瞬間移動しない）
function startClimb(world, b) {
  const sh = world.shapes[b.hang.id], H = sh.hang, hg = b.hang, n = H.n, { e } = hangEdge(sh, b.p)
  const B0 = basis(b), fw = wheelCenter(b, B0, 1, b.s[1]), rw = wheelCenter(b, B0, 0, b.s[0]), r = BIKE.R + BIKE.rt
  const toL = q => [(q[0] - e[0]) * n[0] + (q[2] - e[2]) * n[2], q[1] - e[1]]
  const F0 = toL(fw), R0 = toL(rw), Lw = Math.hypot(F0[0] - R0[0], F0[1] - R0[1])
  const off = datan2(F0[1] - R0[1], R0[0] - F0[0]) - b.th // 車輪を結ぶ線と車体の角度の差
  // 後輪の道筋（折れ線）
  const pts = [R0], hW = Math.max(r, R0[0])
  pts.push([hW, Math.min(-0.05, R0[1] + 0.12)])
  for (let k = 1; k <= 8; k++) pts.push([hW, pts[1][1] * (1 - k / 8)])
  for (let k = 1; k <= 12; k++) { const a = HALF_PI * k / 12; pts.push([hW * dcos(a), r * dsin(a)]) }
  const vR = r - 0.035 // 縁の上でタイヤが少しつぶれた高さ
  for (let k = 1; k <= 4; k++) pts.push([-0.3 * k / 4, r + (vR - r) * k / 4])
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
  const rearAt = d => { let i = 1; while (i < pts.length - 1 && cum[i] < d) i++; const a = (d - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * a, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * a] }
  // 前輪の道筋: 角を中心の円（半径は掛かった時の距離）→ 縁の上の面
  const rF = Math.hypot(F0[0], F0[1]), a0 = datan2(F0[1], F0[0]), arcL = Math.max(0, (HALF_PI - a0) * rF)
  const frontAt = f => f < arcL ? [rF * dcos(a0 + f / rF), rF * dsin(a0 + f / rF)] : [-(f - arcL), rF + (vR - rF) * Math.min(1, (f - arcL) / 0.4)]
  const N = 60, tab = []
  let fPrev = 0
  for (let i = 0; i <= N; i++) {
    const R = rearAt(cum[cum.length - 1] * i / N)
    // 前輪は後輪から Lw の所（前の刻みより先）
    let lo = fPrev, hi = fPrev + 3
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2, F = frontAt(m); if (Math.hypot(F[0] - R[0], F[1] - R[1]) < Lw) lo = m; else hi = m }
    fPrev = i === 0 ? 0 : lo
    const F = frontAt(fPrev)
    tab.push({ F, th: datan2(F[1] - R[1], R[0] - F[0]) - off })
  }
  // 登る時間: 後輪の道筋の長さから、登り切った時の速さが縁の上を進む速さ（約 2.5m/s）になるように。v18: 1.6m/s（約 1.3 秒）だと縁の上を通る鐘のすき間（約 1 秒）に登り切れなかった（出口で速さが飛ばない）
  hg.cl = { e: e.slice(), n, tab, psi: hg.psi, lat: [e[0], e[2]], T: clamp(cum[cum.length - 1] / 2.5, 0.7, 1.8) }
}
function hangStep(world, b, inp, ev) {
  const hg = b.hang, sh = world.shapes[hg.id], H = sh.hang
  const p0 = b.p.slice(), th0 = b.th
  hg.t += DT; hg.bl = Math.min(1, hg.bl + DT / HANG_BLEND)
  b.lean += clamp(clamp(inp.lean, -1, 1) - b.lean, -6 * DT, 6 * DT)
  const exit = why => {
    const n = H.n
    b.hang = null
    if (why === 'up') {
      // 縁の上へ: 登りの動きの終わりの姿勢のまま、前へ進ませる（位置は動かさない）
      // 速さは登りの動きの終わりの速さ（前へ。上下の動きは消す）
      const vx = (b.p[0] - p0[0]) / DT, vz = (b.p[2] - p0[2]) / DT, vh = Math.max(1.6, Math.hypot(vx, vz)) // 登りの終わりの速さ（約 1.6m/s。遅いと縁の先の溝でウィリーに入れない）
      b.w = 0; b.v = [-n[0] * vh, 0, -n[2] * vh]; b.sv = [0, 0]
      if (ev) ev.push({ t: 'hangUp' })
      return
    }
    if (why === 'front') { crash(b, 'front', 0, ev); b.v = [-n[0] * 1.5, 0.5, -n[2] * 1.5]; if (ev) ev.push({ t: 'hangFall', why }); return }
    // 後ろへ・ずり落ちた・縁が欠けた: 壁から離れる向きへ動きながら下へ落ちる（位置は飛ばさない）
    b.v = [n[0] * 1.2, -0.5, n[2] * 1.2]; b.w = -1.2; b.g = [false, false]; b.cn = [null, null]
    if (ev) ev.push({ t: 'hangFall', why })
  }
  const max = H.max || 8
  if (hg.cl) {
    // 登り始めたら、釣り合いでは落ちない。前体重＋アクセルの間だけ進み、離すとその姿勢で止まる（縁が欠けるまで）
    if (inp.lean > 0.3 && inp.thr > 0.3) hg.climb += DT / (hg.cl.T || CLIMB_T)
    if (hg.climb >= 1) { hg.climb = 1; hangPose(world, b); exit('up') }
    else if (hg.t > max) { if (ev) ev.push({ t: 'hangBreak', p: b.cn[1] ? b.cn[1].q.slice() : b.p.slice() }); exit('edge') }
    else hangPose(world, b)
  } else {
    // 揺さぶり: 決まった揺れ（時刻の式）＋風の強さ＋近くを通る鉄球の風圧
    let dist = 0.55 * dsin(world.time * 2.3 + hg.id) + 0.35 * dsin(world.time * 3.7 + 1.3)
    for (const wd of world.winds) if (b.p[0] > wd.min[0] - 2 && b.p[0] < wd.max[0] + 2 && b.p[2] > wd.min[2] - 2 && b.p[2] < wd.max[2] + 2 && b.p[1] > wd.min[1] - 3 && b.p[1] < wd.max[1] + 3) dist += (wd.pulse ? gustK(wd, world.time) : 0.5) * 2.2 * (wd.f[0] * H.n[0] + wd.f[2] * H.n[2] >= 0 ? -1 : 1)
    for (const s2 of world.moving) if (s2.knock && !s2.gone && s2.c) { const d = Math.hypot(s2.c[0] - b.p[0], s2.c[1] - b.p[1], s2.c[2] - b.p[2]); if (d < 3.5) dist += (3.5 - d) * 0.9 * Math.sign(dsin(world.time * 5 + s2.id)) }
    // 体の釣り合い（放っておくと倒れる）。前体重で前へ、後ろ体重で後ろへ。掛かった直後（姿勢を移している間）は倒れない
    if (hg.bl >= 1) { const ez = H.easy ? 0.55 : 1; hg.xv += (2.2 * ez * hg.x + 2.6 * b.lean + dist * 0.6 * ez - 1.6 * hg.xv) * DT; hg.x += hg.xv * DT } // v22: 最初の縁は倒れていくのがゆっくり
    // ブレーキを離すと、前輪がずり落ちる
    // ブレーキを離すと、前輪がずり落ちる（v17: 0.28 → 0.22/秒。少しだけ余裕）
    if (inp.brk > 0.5) hg.slip = Math.max(0, hg.slip - 0.05 * DT); else hg.slip += (H.easy ? 0.1 : 0.22) * DT // v22: 最初の縁はずり落ちがゆっくり
    if (!hg.warned && hg.t > max - 2) { hg.warned = true; if (ev) ev.push({ t: 'hangWarn', p: b.cn[1] ? b.cn[1].q.slice() : b.p.slice() }) }
    // 登る: 前体重＋アクセル（釣り合いがとれている時）。v17: 釣り合いの幅を広く（0.75→0.85）、ずり落ちかけでも（0.35→0.42）
    if (inp.lean > 0.5 && inp.thr > 0.5 && Math.abs(hg.x) < (H.easy ? 0.95 : 0.85) && hg.slip < 0.42 && hg.bl >= 1) { startClimb(world, b); hg.climb = DT / CLIMB_T; hangPose(world, b) }
    else if (hg.x > 1) exit('front')
    else if (hg.x < -1) exit('back')
    else if (hg.slip > 0.5) exit('slip')
    else if (hg.t > max) { if (ev) ev.push({ t: 'hangBreak', p: b.cn[1] ? b.cn[1].q.slice() : b.p.slice() }); exit('edge') }
    else hangPose(world, b)
  }
  // 動きの速さ（見た目の補間・カメラ・次の刻みのため。位置は 1 刻みで飛ばない）
  if (b.hang) { b.v = [(b.p[0] - p0[0]) / DT, (b.p[1] - p0[1]) / DT, (b.p[2] - p0[2]) / DT]; b.w = (b.th - th0) / DT }
  b.speed = Math.hypot(b.v[0], b.v[2])
}

// ============================================================ v16 の仕掛けの動き（時刻と、乗っているバイクの位置だけで決まる）
// 横に往復する床（道を選ぶ床）: 端で dwell 秒止まる → move 秒で反対の端へ（加速 ta 秒・あとは一定の速さ）。k は -amp..amp
export function shuttlePos(m, t) {
  const P = 2 * (m.dwell + m.move), ph = (t + (m.ph || 0)) - P * Math.floor((t + (m.ph || 0)) / P), D = 2 * m.amp, ta = m.ta ?? 0.8
  const vc = D / (m.move - ta), a = vc / ta
  const run = u => u < ta ? [0.5 * a * u * u, a * u] : u < m.move - ta ? [0.5 * a * ta * ta + vc * (u - ta), vc] : [D - 0.5 * a * (m.move - u) * (m.move - u), a * (m.move - u)]
  if (ph < m.dwell) return { k: -m.amp, v: 0, at: 'lo', left: m.dwell - ph }
  if (ph < m.dwell + m.move) { const [x, v] = run(ph - m.dwell); return { k: -m.amp + x, v, at: 'up', left: m.dwell + m.move - ph } }
  if (ph < 2 * m.dwell + m.move) return { k: m.amp, v: 0, at: 'hi', left: 2 * m.dwell + m.move - ph }
  const [x, v] = run(ph - 2 * m.dwell - m.move); return { k: m.amp - x, v: -v, at: 'down', left: P - ph }
}
// 跳ね板: 踏まれてから τ 秒の持ち上がり（0..stroke）。入った速さ ve で跳ね上がる速さが変わる
export function kickPos(m, t) {
  if (m.trig == null || t < m.trig) return 0
  const tau = t - m.trig, vpk = Math.min(m.vmax ?? 14, m.k0 + m.kv * (m.ve || 0)), T1 = m.stroke * PI / (2 * vpk)
  if (tau < T1) return m.stroke * (1 - dcos(PI * tau / T1)) / 2
  if (tau < T1 + m.hold) return m.stroke
  const u = (tau - T1 - m.hold) / m.back
  if (u < 1) return m.stroke * (1 + dcos(PI * u)) / 2
  return 0
}
// 倒れていく煙突: 踏まれてから、落ちる物と同じく加速して倒れる（a0 → aEnd を tFall 秒）。倒れ切ってバイクが離れて back 秒で、rise 秒かけて元へ
export function toppleAng(m, t) {
  if (m.trig == null || t < m.trig) return { a: m.a0, w: 0, al: 0, st: 'up' }
  const al = 2 * (m.a0 - m.aEnd) / (m.tFall * m.tFall), tau = t - m.trig
  if (m.resetAt != null && t >= m.resetAt) { const u = Math.min(1, (t - m.resetAt) / m.rise), k = u * u * (3 - 2 * u), dk = 6 * u * (1 - u) / m.rise; return { a: m.aEnd + (m.a0 - m.aEnd) * k, w: (m.a0 - m.aEnd) * dk, al: 0, st: u >= 1 ? 'done' : 'rise' } }
  const a = m.a0 - 0.5 * al * tau * tau
  if (a > m.aEnd) return { a, w: -al * tau, al: -al, st: 'fall' }
  return { a: m.aEnd, w: 0, al: 0, st: 'down' }
}
// 鎖の吊り橋: 板の中心の、橋の始まりからの距離 sI での形。重さで沈む・速さで波打つ・乗っている時間で横揺れが大きくなる（風でも）
export function bridgePose(br, sI, t) {
  const L = br.L, e = s => dsin(PI * Math.max(0, Math.min(L, s)) / L)
  const tOn = br.tOn != null && t >= br.tOn ? t - br.tOn : 0
  const Aw = Math.min(br.waMax ?? 0.35, br.wa * Math.max(0, (br.vs || 0) - (br.v0w ?? 6.5)))
  const yAt = s => { const es = e(s), d = (s - (br.sb || 0)) / br.lam; return -br.sag * es - br.dip * (br.dw || 0) * es * Math.exp(-d * d) + Aw * es * dsin(br.k * s + br.om * t * 0.15) }
  const gk = br.gust ? gustK(br.gust, t) : 0
  const As = br.A0 + Math.min(br.Amax - br.A0, br.grow * tOn + (br.swv || 0) * Math.max(0, (br.vs || 0) - (br.v0w ?? 6.5)) + (br.tJolt && tOn > br.tJolt ? (tOn - br.tJolt) * 4 : 0)) + (br.windA || 0) * gk // 長く乗っていると大きくあおられる（tJolt 秒から）
  const sw = dsin(br.oms * t + (br.ph || 0)), es = Math.min(1, 1.6 * e(sI)) // 横揺れは橋のほとんど全体で大きい（両端の柱の近くだけ小さい）
  const lat = As * es * sw
  const y = yAt(sI), dy = (yAt(sI + 0.3) - yAt(sI - 0.3)) / 0.6
  return { y, lat, slope: datan2(dy, 1), roll: (br.rollK ?? 0.18) * lat }
}
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
function setPose(s, c, pitch, roll, dtT) {
  const nb = makeBox({ c, h: s.h, yaw: s.base.yaw, pitch, roll })
  const ok = dtT > 1e-6 && dtT < 0.1 && s.c
  const vel = ok ? sub3(c, s.c).map(v => v / dtT) : [0, 0, 0]
  s.acc = ok && s.vel ? sub3(vel, s.vel).map(v => v / dtT) : [0, 0, 0]
  s.vel = vel; s.c = nb.c; s.ax = nb.ax
}
function v16Pose(s, t, dtT) {
  const m = s.mov, B0 = s.base
  if (t === 0) { m.trig = null; m.resetAt = null; m.ve = 0; m.armed = true; m.lastTouch = -1e9; s.vel = [0, 0, 0]; s.acc = [0, 0, 0] }
  if (m.type === 'shuttle') { const k = shuttlePos(m, t).k; setPose(s, [B0.c[0] + m.axis[0] * k, B0.c[1] + m.axis[1] * k, B0.c[2] + m.axis[2] * k], B0.pitch, B0.roll, dtT) }
  else if (m.type === 'kick') { if (m.trig != null && t < m.trig) m.trig = null; const k = kickPos(m, t); if (m.trig != null && k === 0 && t - m.trig > 1) m.trig = null; setPose(s, [B0.c[0] + m.axis[0] * k, B0.c[1] + m.axis[1] * k, B0.c[2] + m.axis[2] * k], B0.pitch, B0.roll, dtT) }
  else if (m.type === 'wave') {
    const br = m.br, st = bridgePose(br, m.s, t), f = br.f, R = br.R
    const c = [br.p0[0] + f[0] * m.s + R[0] * st.lat, br.p0[1] + st.y - s.h[1], br.p0[2] + f[2] * m.s + R[2] * st.lat]
    setPose(s, c, st.slope, st.roll, dtT)
  } else if (m.type === 'topple') {
    if (m.trig != null && t < m.trig) { m.trig = null; m.resetAt = null }
    if (m.trig != null && m.resetAt == null) { const st0 = toppleAng(m, t); if (st0.st === 'down' && t - (m.lastTouch ?? -1e9) > m.back) m.resetAt = t }
    const st = toppleAng(m, t); if (st.st === 'done') { m.trig = null; m.resetAt = null }
    m.aNow = st.a; m.wNow = st.w; m.alNow = st.al
    const d = st.a - m.a0, H0 = m.hinge, d0 = sub3(B0.c, H0), R0 = m.right, ca = dcos(d), sa = dsin(d)
    const kd = R0[0] * d0[0] + R0[1] * d0[1] + R0[2] * d0[2], cr = [R0[1] * d0[2] - R0[2] * d0[1], R0[2] * d0[0] - R0[0] * d0[2], R0[0] * d0[1] - R0[1] * d0[0]]
    const nb = makeBox({ c: B0.c, h: s.h, yaw: B0.yaw, pitch: B0.pitch + d, roll: B0.roll })
    s.c = [0, 1, 2].map(k => H0[k] + d0[k] * ca + cr[k] * sa + R0[k] * kd * (1 - ca)); s.ax = nb.ax
  }
}
// 乗っている床の、点 p での加速（見かけの力に使う）
function frameAcc(sh, p) {
  const m = sh.mov
  if (m.type !== 'topple') return sh.acc || [0, 0, 0]
  const w = m.wNow || 0, al = m.alNow || 0, R0 = m.right, r = sub3(p, m.hinge), kd = R0[0] * r[0] + R0[1] * r[1] + R0[2] * r[2]
  const rp = [r[0] - R0[0] * kd, r[1] - R0[1] * kd, r[2] - R0[2] * kd], cr = [R0[1] * r[2] - R0[2] * r[1], R0[2] * r[0] - R0[0] * r[2], R0[0] * r[1] - R0[1] * r[0]]
  return [al * cr[0] - w * w * rp[0], al * cr[1] - w * w * rp[1], al * cr[2] - w * w * rp[2]]
}
// 1 コマごと: 跳ね板・煙突の引き金と、吊り橋に乗っているか
function v16Track(world, b, ev) {
  const T = world.time
  for (const s of world.trigs) {
    const m = s.mov, on0 = b.cn[0] && b.cn[0].id === s.id, on1 = b.cn[1] && b.cn[1].id === s.id
    if (m.type === 'topple') {
      if (on0 || on1) { m.lastTouch = T; if (m.trig == null && !b.crashed) { m.trig = T; if (ev) ev.push({ t: 'topple', p: s.c.slice() }) } }
    } else if (m.type === 'kick') {
      if (on0 || on1) m.lastTouch = T
      if (m.trig == null && on0 && b.g[0] && on1 && b.g[1] && !b.crashed && (m.armed ?? true)) {
        const along = (b.p[0] - m.start[0]) * m.f[0] + (b.p[2] - m.start[2]) * m.f[2]
        if (along > m.trigAt) { m.trig = T; m.ve = Math.max(0, b.speed); m.armed = false; if (ev) ev.push({ t: 'kick', p: s.c.slice(), v: m.ve }) }
      }
      if (!on0 && !on1 && m.trig == null && T - (m.lastTouch ?? -1e9) > 0.3) m.armed = true
      // v29 本人「一回しか跳ねへん」: 板に乗ったままでも、板が下りた後に引き金の手前まで下がれば、もう一度跳ねる
      if ((on0 || on1) && m.trig == null && !m.armed) { const al2 = (b.p[0] - m.start[0]) * m.f[0] + (b.p[2] - m.start[2]) * m.f[2]; if (al2 < m.trigAt - 0.6) m.armed = true }
    }
  }
  if (world.bridges.length) {
    const sh = b.carryId >= 0 ? world.shapes[b.carryId] : null, cur = sh && sh.mov && sh.mov.type === 'wave' ? sh.mov.br : null
    for (const br of world.bridges) {
      if (br === cur && !b.crashed) {
        br.sb = (b.p[0] - br.p0[0]) * br.f[0] + (b.p[2] - br.p0[2]) * br.f[2]
        br.vs = (br.vs || 0) + (Math.abs(b.speed) - (br.vs || 0)) * 0.08
        if (br.tOn == null) { br.tOn = T; if (ev) ev.push({ t: 'bridgeOn', p: b.p.slice() }) }
        br.lastOn = T; br.on = true
      } else if (br.on && T - (br.lastOn ?? -1e9) > 0.6) { br.on = false; br.tOn = null }
      if (!br.on) br.vs = (br.vs || 0) * 0.97
      br.dw = Math.max(0, Math.min(1, (br.dw || 0) + (br.on ? 0.05 : -0.03)))
    }
  }
}
