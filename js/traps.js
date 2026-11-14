// SKY BIKE v36 アクセルだけで抜けられる単調な道の罠（道の形は変えない。今ある道に重ねる・道の板を切って扉を入れる）
// 置き場所は tools/_v36spots.mjs / _v36b.mjs（全開と判断の空き 4 秒以上の洗い出し）から。出だしの 5 分（道の 23% まで）には置かない
//  girder  影が落ちてくる鉄骨: 近づくと道に影が広がり、T 秒後に上から鉄骨が落ちる（1 か所目 3 秒・2 か所目 2 秒）。全開で着くと落ちる所に重なる
//  door    開け閉めする落とし扉: 床の扉が一定のリズムで開く（向こうの端の蝶番で手前が下がる）。閉じている間に乗る。開く前にきしむ
//  oil     油だまり: 油の上で何か押す（アクセル・ブレーキ・体重）と後輪が滑って道から外れる。何も押さずに惰性で抜ければ大丈夫。手前に油の滴る倒れた樽
//  press   下がってくる天井（プレス機）: 演出だけ。通ると頭の 25cm 上でガクンと止まる。当たりなし
//  chase   小さな猿のような生き物の追いかけ（js/run.js の judge が動かす。ここは場所と速さだけ）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const DOOR_CYC = { closed: 2.4, move: 0.35, open: 2.8 } // 閉じている 2.4 秒 → 0.35 秒で開く → 2.8 秒開いている → 0.35 秒で閉じる
export function doorAng(m, t) { // 0 = 閉じている、m.up = 開いた角度
  const C = DOOR_CYC, P = C.closed + C.open + 2 * C.move, ph = ((t + (m.ph || 0)) % P + P) % P
  if (ph < C.closed) return { a: 0, w: 0, at: 'lo', left: C.closed - ph }
  if (ph < C.closed + C.move) { const u = (ph - C.closed) / C.move; return { a: m.up * u, w: m.up / C.move, at: 'up' } }
  if (ph < C.closed + C.move + C.open) return { a: m.up, w: 0, at: 'hi', left: C.closed + C.move + C.open - ph }
  const u = (ph - C.closed - C.move - C.open) / C.move; return { a: m.up * (1 - u), w: -m.up / C.move, at: 'down' }
}

// 道の点 i から先へ、条件に合う最初の点
function findFrom(P, i0, n, ok) { for (let i = i0; i < Math.min(P.length, i0 + n); i++) if (ok(i)) return i; return -1 }
const straight = (P, i, len) => { for (let j = i; j < i + len; j++) { const q = P[j]; if (!q || !q.p || !q.w || ['jump', 'lip', 'hang', 'stepUp', 'stepDown', 'lift', 'seesaw', 'spin', 'slide', 'draw', 'trap', 'crumble', 'fork', 'gear', 'drum'].includes(q.kind) || Math.abs(q.slope || 0) > 0.06 || Math.abs((P[j + 1] && P[j + 1].yaw != null ? P[j + 1].yaw : q.yaw) - q.yaw) > 0.03) return false } return true }
// 手前の道に、ほかの仕掛け（跳ぶ・段・縁・動く床・歯車・抜ける床）が無い
const clean = (P, a, z) => { for (let j = Math.max(0, a); j < z; j++) { const q = P[j]; if (!q || !q.p || ['jump', 'lip', 'hang', 'lift', 'seesaw', 'spin', 'slide', 'draw', 'trap', 'crumble', 'fork', 'gear', 'drum', 'kick', 'groove', 'swing', 'chimney', 'water', 'mud', 'narrow'].includes(q.kind) || (q.kind === 'stepUp' && q.dy > 0.3) || q.door) return false } return true }
// 道の点の真下の、道の板（回らない箱）
function roadBoxAt(B, q) {
  for (const s of B.shapes) {
    if (s.type !== 'box' || s.tag !== 'road' || s.mov || Math.abs(s.base.pitch) > 0.01) continue
    const d = [q.p[0] - s.c[0], q.p[1] - s.c[1], q.p[2] - s.c[2]], l = [0, 1, 2].map(k => d[0] * s.ax[k][0] + d[1] * s.ax[k][1] + d[2] * s.ax[k][2])
    if (Math.abs(l[0]) <= s.h[0] - 0.01 && Math.abs(l[1] - s.h[1]) < 0.05 && Math.abs(l[2]) <= s.h[2] + 0.01) return { s, x: l[0] }
  }
  return null
}

export function v36traps(B) {
  const P = B.path, N = P.length
  B.traps = []
  const hz = B.hazards
  // ---------------- 影が落ちてくる鉄骨（道の 44% の嵐の回廊で 3 秒、64% の工場で 2 秒。手前 42m に別の仕掛けが無い所。ほかの単調な道は急な坂の後で着く時間が読めないか、猿・油と重なった）
  // trigD: 手前が曲がりで全開でも速さが 7m/s ほどに落ちる所は、全開で着く時間を測って決めた距離（tools/_gird2.mjs）
  for (const [t0, T, trigD] of [[0.443, 3, +(globalThis.__gD1 || 30)], [0.643, 2, +(globalThis.__gD2 || 19.5)]]) {
    const i = findFrom(P, Math.floor(N * t0), 300, k => P[k].w >= 3 && clean(P, k - 42, k + 8)) // 手前が急な坂だと着く時間が読めない
    if (i < 0) continue
    const q = P[i], f = B.dir(q.yaw), w = q.w, H0 = 9
    const sh = B.box({ c: add3(q.p, [0, 1, 0], H0), h: [0.28, 0.26, w / 2 + 0.7], yaw: q.yaw, mat: 'girder', tag: 'girder', mov: { type: 'girder', T, H0, top: q.p[1] + 0.26, trigT: T + 1.0, trigD, at: q.p.slice(), yaw: q.yaw, w, ext: [0, H0 + 1, 0], i } })
    sh.mov.self = null
    B.traps.push({ kind: 'girder', i, p: q.p.slice(), yaw: q.yaw, w, T, shape: sh })
    // bot 用: 落ちてくる間と、落ちて道に転がっている間は危ない（落ちる前は安全）。遠くから見る（全開から止まれるように）
    const m = sh.mov
    hz.push({ kind: 'girder', p: q.p.slice(), yaw: q.yaw, half: 0.8, w, vGo: 12, look: 62, m, unsafe: tt => m.t0 != null && tt > m.t0 + T - 0.25 && tt < m.t0 + T + 1.9, maybe: () => m.t0 == null })
  }
  // ---------------- 開け閉めする落とし扉（道の 81%、氷の区間の直線の板）
  { const i = findFrom(P, Math.floor(N * 0.805), 120, k => P[k].kind === 'road' && straight(P, k - 6, 14) && (() => { const h = roadBoxAt(B, P[k]); return h && h.s.h[0] - Math.abs(h.x) > 3.7 })())
    if (i >= 0) {
      const q = P[i], hit = roadBoxAt(B, q), s = hit.s, L = 6.5, x0 = hit.x - L / 2, x1 = hit.x + L / 2
      // 板を手前・扉・向こうの 3 つに分ける（道の形は同じ）
      const f = s.ax[0], th = s.h[1] * 2, top = add3(s.c, s.ax[1], s.h[1])
      const keep = (a, b2) => { if (b2 - a < 0.05) return; const c = add3(s.c, f, (a + b2) / 2); B.shapes.push({ ...JSON.parse(JSON.stringify({ ...s, mov: null })), c, h: [(b2 - a) / 2, s.h[1], s.h[2]], base: { ...s.base, c }, min: [0, 1, 2].map(k => c[k] - Math.abs(f[k]) * (b2 - a) / 2 - Math.abs(s.ax[1][k]) * s.h[1] - Math.abs(s.ax[2][k]) * s.h[2]), max: [0, 1, 2].map(k => c[k] + Math.abs(f[k]) * (b2 - a) / 2 + Math.abs(s.ax[1][k]) * s.h[1] + Math.abs(s.ax[2][k]) * s.h[2]) }) }
      keep(-s.h[0], x0); keep(x1, s.h[0])
      B.shapes.splice(B.shapes.indexOf(s), 1)
      const dth = 0.18, R = B.right(q.yaw), dc = add3(add3(top, f, hit.x), [0, 1, 0], -dth / 2)
      const hinge = add3(add3(top, f, x1), [0, 1, 0], -dth / 2)
      const m = { type: 'hinge', door: true, hinge, right: R, sgn: 1, up: 1.45, ph: 0.4, dwell: 1, move: 1 }
      const dsh = B.box({ c: dc, h: [L / 2 - 0.02, dth / 2, s.h[2]], yaw: q.yaw, mat: 'liftdeck', mu: 1.0, tag: 'road', mov: m })
      for (let k = Math.max(0, i - 2); k <= Math.min(N - 1, i + 2); k++) P[k].trapDoor = true
      B.traps.push({ kind: 'door', i, p: q.p.slice(), yaw: q.yaw, w: s.h[2] * 2, L, shape: dsh, m, depth: th })
      hz.push({ kind: 'door', custom: true, i, p: add3(top, f, hit.x), yaw: q.yaw, half: L / 2 + 0.3, w: s.h[2] * 2, vGo: 10, look: 40, m, unsafe: tt => doorAng(m, tt).a > 0.03 })
    } }
  // ---------------- 油だまり（道の 39% の嵐の広場。53% の工場は倒れる煙突の助走と重なったのでやめた）
  { const i = findFrom(P, Math.floor(N * 0.393), 200, k => P[k].w >= 3 && clean(P, k - 20, k + 14) && P.slice(k - 2, k + 11).every(z => ['road', 'pad'].includes(z.kind) && Math.abs(z.slope || 0) < 0.06 && z.w >= 3 && Math.abs(z.yaw - P[k].yaw) < 0.02)) // 平らで、手前 25m に別の仕掛けが無い
    if (i >= 0) {
      const q = P[i], f = B.dir(q.yaw), L = 9, w = q.w
      const c = add3(add3(q.p, f, L / 2), [0, 1, 0], 0.004)
      const sh = B.box({ c, h: [L / 2, 0.004, w / 2 - 0.05], yaw: q.yaw, mat: 'oil', mu: 0.35, tag: 'oilslick' }); sh.oil = true
      for (let k = i; k < i + L; k++) P[k].oil = true
      // 手前の、油の滴る倒れた樽（道の脇。当たりは道の外の円柱）
      const R = B.right(q.yaw), bp = add3(add3(q.p, f, -3), R, -(w / 2 + 0.55))
      B.cyl({ a: add3(bp, [0, 1, 0], 0.3), b: add3(add3(bp, f, 0.85), [0, 1, 0], 0.3), r: 0.29, mat: 'barrel', tag: 'barrel' })
      B.traps.push({ kind: 'oil', i, p: q.p.slice(), yaw: q.yaw, w, L, barrel: bp })
    } }
  // ---------------- 下がってくる天井（道の 30% の廃墟。演出だけ）
  { const i = findFrom(P, Math.floor(N * 0.297), 200, k => P[k].w >= 3 && clean(P, k - 10, k + 6))
    if (i >= 0) { const q = P[i]; B.traps.push({ kind: 'press', i, p: q.p.slice(), yaw: q.yaw, w: q.w }) } }
  // ---------------- 小さな猿のような生き物の追いかけ（74% の鐘楼の回廊・93% の崩れ落ちる回廊。1 か所目はゆるく。中盤 30〜67% は難所が続き、人の速さ bot が猿なしでも落ちる所ばかりだった）
  B.chases = []
  for (const [t0, d0, dv, len, k0] of [[+(globalThis.__chT1 || 0.742), +(globalThis.__chD1 || 8), +(globalThis.__chV1 || 2.3), 85], [0.927, +(globalThis.__chD2 || 9), +(globalThis.__chV2 || 2.8), 75]]) { // d0 追われ始めの間（m）・dv バイクより速い分（m/s）
    const i0 = findFrom(P, Math.floor(N * t0), 60, k => ['road', 'orbit'].includes(P[k].kind) && P[k].w >= 3 && !P.slice(k - 6, k + 1).some(z => ['landing', 'jump', 'lip'].includes(z.kind))) // 跳んでいる途中から追わない
    if (i0 < 0) continue
    B.chases.push({ i0, i1: Math.min(N - 1, i0 + len), d0, dv })
    for (let k = i0 + 24; k < Math.min(N, i0 + 40); k++) P[k].nitro = true // 上手い bot は追われ始めにニトロ（逃げる手の 1 つ。bot は 26m 手前から点ける）
    B.can(0); B.cans[B.cans.length - 1].p = add3(P[i0 + 3].p, [0, 0, 0]) // 追われ始めの少し先に燃料の缶
  }
}
