// SKY BIKE v27 隠し部屋と近道（3 か所: 序盤・中盤・終盤）。
// 本道の道の点 a の横に、高い縁（1.6m・前輪を掛けて登る。歩く人は登れない）で入る小部屋。中に変な置物と一言の看板。
// 部屋の奥の出口から細い梁を渡り、最後に切れ目を跳んで、ずっと先の本道の点 b に降りる（本道で 120m 以上先）。落ちると下の道へ。
// 場所は本道が出来上がってから、本道どうしが近い所（横に 14〜34m・b が 2〜9m 高い）を探して決める。本道の並び・形は変えない。
// 部屋と梁が他の形にめり込む所は使わない（当たりの形の一覧で調べる）。
import { World, closest } from './physics.js?v=69'
import { forkBranch, forkJoin } from './parts16.js?v=69'

const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const UP = [0, 1, 0]
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }

// 部屋ごとの置物と一言（看板）。prop: game.js が描く物（錆びたバイク・樽・像）
const ROOMS = [
  { name: '隠し部屋 1', zones: ['ground', 'crypt'], mat: 'cobble', wall: 'ruinwall', sign: 'ここで力尽きた先人。バイクだけ残っている', prop: 'rustbike' },
  { name: '隠し部屋 2', zones: ['crypt', 'ruin', 'storm', 'factory'], mat: 'rust', wall: 'ruinwall', sign: 'ここまで来たのは君で3人目（2人は帰ってこない）', prop: 'barrels' },
  { name: '隠し部屋 3', zones: ['bell', 'ice', 'roof'], dhMax: 70, wide: true, mat: 'snowrock', wall: 'ruinwall', sign: '待ち合わせ相手は、まだ来ない（300年）', prop: 'statue' },
]
const ROOM_L = 7, ROOM_W = 3.4, ROOM_H = 2.9, LEDGE = 1.6, GAP = 1.8, PLAT = 2.4

export function addSecrets(B) {
  const P = B.path, N = P.length
  const cum = [0]; for (let i = 1; i < N; i++) cum.push(cum[i - 1] + (P[i].p && P[i - 1].p ? Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[2] - P[i - 1].p[2]) : 0))
  const okK = q => q && q.p && q.w >= 3 && ['road', 'orbit', 'curve', 'pad', 'landing'].includes(q.kind) && Math.abs(q.slope || 0) < 0.08
  const W0 = new World(B.shapes.slice())
  const used = []
  const out = []
  for (const R of ROOMS) {
    const cands = []
    for (let i = 30; i < N; i += 2) {
      const a = P[i]; if (!okK(a) || !R.zones.includes(a.zone || zoneOf(B, i))) continue
      { let bad = false; for (let k = i - 16; k <= i + 4; k++) if (!okK(P[k]) || P[k].branch) { bad = true; break } if (bad) continue } // 手前 16m と先 4m はふつうの平らな道（止まって入れる）
      for (let j = i + 80; j < N; j += 2) {
        const b = P[j]; if (!okK(b) || !okK(P[j - 3]) || !okK(P[j + 3])) continue
        if (zoneOf(B, j) === 'sky' || zoneOf(B, j) === 'roof') break // 屋上の大ジャンプ（谷を飛ぶ）は飛ばさない
        const saved = cum[j] - cum[i]; if (saved < 100 || saved > (R.wide ? 900 : 520)) continue
        const dx = b.p[0] - a.p[0], dz = b.p[2] - a.p[2], dh = Math.hypot(dx, dz), dy = b.p[1] - a.p[1]
        if (dh < 12 || dh > (R.dhMax || 45) || dy < 0.5 || dy > 14) continue
        const yawU = Math.atan2(-dz, dx)
        const offA = Math.abs(wrap(yawU - a.yaw)), offB = Math.abs(wrap(yawU - b.yaw))
        if (offA < (R.wide ? 0.3 : 0.5) || offA > (R.wide ? 2.9 : 2.6) || offB < (R.wide ? 0.2 : 0.3) || offB > (R.wide ? 1.35 : 1.2)) continue // a からは横へ出る・b へは斜めに入る（b の道の向きへ曲がれる角度）
        cands.push({ i, j, saved, dh, dy, yawU })
      }
    }
    cands.sort((p, q) => q.saved - p.saved)
    if (globalThis.__secDbg) console.log(R.name, 'cands', cands.length)
    let pick = null
    const why = { used: 0, plan: 0, clear: 0 }
    for (const cd of cands.slice(0, 400)) { if (used.some(u => Math.abs(u - cd.i) < 200)) { why.used++; continue } const g = plan(B, cd); if (!g) { why.plan++; continue } if (clear(W0, g, P[cd.i], P[cd.j])) { pick = { ...cd, g }; break } why.clear++ }
    if (globalThis.__secDbg) console.log(R.name, JSON.stringify(why))
    if (globalThis.__secDbg) console.log(R.name, 'pick', !!pick, pick && pick.i, pick && pick.j)
    if (!pick) continue
    used.push(pick.i)
    out.push(build(B, R, pick))
  }
  B.secrets = out
  return out
}
function zoneOf(B, i) { let z = 'ground'; for (const m of B.zoneMarks || []) if (m.i <= i) z = m.zone; return z }

// 部屋と梁の置き方（形はまだ作らない）
function plan(B, cd) {
  const P = B.path, a = P[cd.i], b = P[cd.j]
  const u = [Math.cos(cd.yawU), 0, -Math.sin(cd.yawU)]
  const sinA = Math.abs(Math.sin(wrap(cd.yawU - a.yaw))), edgeA = Math.min(3, (a.w / 2) / Math.max(0.35, sinA)) + 0.05
  const e0 = add3(a.p, u, edgeA) // 縁の壁（本道の端）
  const roomEnd = add3(add3(e0, u, ROOM_L), UP, LEDGE)
  const sinB = Math.abs(Math.sin(wrap(cd.yawU - b.yaw))), edgeB = Math.min(3.2, (b.w / 2) / Math.max(0.35, sinB))
  const land = add3(b.p, u, -edgeB + 0.6) // b の道の上（端から 0.6m 内側）
  const toLand = Math.hypot(land[0] - roomEnd[0], land[2] - roomEnd[2])
  // 高さが足りない分は、梁の途中に高い縁（1.6m・前輪を掛けて登る。上に 2.4m の踊り場）を k 個はさむ
  let k = 0, beamL, slope
  for (; k <= 3; k++) { beamL = toLand - GAP - 0.6 - k * PLAT; if (beamL < 4) return null; slope = Math.atan2(land[1] - roomEnd[1] - k * LEDGE, beamL); if (Math.abs(slope) <= 0.2) break }
  if (k > 3) return null
  // 梁は部屋の出口から着地点へまっすぐ（部屋の向きから 35 度まで）
  const by = Math.atan2(-(land[2] - roomEnd[2]), land[0] - roomEnd[0])
  if (Math.abs(wrap(by - cd.yawU)) > 0.6) { if (globalThis.__secDbg) console.log(' turn', wrap(by - cd.yawU).toFixed(2)); return null }
  const ub = [Math.cos(by), 0, -Math.sin(by)]
  return { u, ub, by, e0, roomEnd, land, beamL, slope, edgeA, k }
}
// 部屋・梁の通る所に、他の形がないか（本道 a・b の近くの道の板は除く）
function clear(W0, g, a, b) {
  const pts = []
  const u = g.u, R = [-u[2], 0, u[0]]
  for (let s = 0.4; s <= ROOM_L; s += 0.6) for (const l of [-ROOM_W / 2 - 0.3, 0, ROOM_W / 2 + 0.3]) for (const h of [0.3, 1.2, 2.2]) pts.push(add3(add3(add3(g.e0, u, s), R, l), UP, LEDGE + h))
  { const Rb = [-g.ub[2], 0, g.ub[0]]; for (let s = 0.3; s <= g.beamL + GAP - 0.3; s += 0.6) for (const l of [-0.8, 0, 0.8]) for (const h of [0.3, 1.2, 2.2]) pts.push(add3(add3(add3(g.roomEnd, g.ub, s), Rb, l), UP, (g.land[1] - g.roomEnd[1]) * Math.min(1, s / (g.beamL + g.k * PLAT)) + h)) }
  for (const p of pts) {
    const nearA = Math.hypot(p[0] - a.p[0], p[2] - a.p[2]) < 4 && p[1] < a.p[1] + 0.6, nearB = Math.hypot(p[0] - b.p[0], p[2] - b.p[2]) < 4.5
    for (const id of W0.near(p[0], p[1], p[2], 0.6)) {
      const s = W0.shapes[id]
      if (nearB && s.tag === 'road') continue
      if (nearA && s.tag === 'road') continue
      if (s.tag === 'post' && s.mat === 'iron') { g.posts = g.posts || new Set(); g.posts.add(id); continue } // 松明の柱は取り払う（build で）
      const o = closest(s, p[0], p[1], p[2], { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 })
      if (o.d < 0.35) { if (globalThis.__secDbg) console.log(' block', s.tag, s.mat, 'dy', (p[1] - a.p[1]).toFixed(1), 'dA', Math.hypot(p[0] - a.p[0], p[2] - a.p[2]).toFixed(1), 'dB', Math.hypot(p[0] - b.p[0], p[2] - b.p[2]).toFixed(1), 'top-a', (s.max[1] - a.p[1]).toFixed(1)); return false }
    }
    // 下の道の真上すぎないか（頭の上の空き）: 部屋の床の下 2.6m 以内に別の道の面があるとだめ
  }
  return true
}

function build(B, R, pk) {
  const P = B.path, a = P[pk.i], b = P[pk.j], g = pk.g, u = g.u, yaw = pk.yawU
  const Rv = [Math.sin(yaw), 0, Math.cos(yaw)]
  // 部屋と梁にかかる松明の柱は取り払う（柱の当たりを遠くへ・火も消す）
  for (const id of g.posts || []) { const sh = B.shapes[id]; if (!sh) continue; const top = sh.b.slice(); sh.a = [sh.a[0], -9999, sh.a[2]]; sh.b = [sh.b[0], -9998, sh.b[2]]; sh.min[1] = -10000; sh.max[1] = -9997; sh.hidden = true
    B.torches = B.torches.filter(t => Math.hypot(t[0] - top[0], t[2] - top[2]) > 0.6) }
  const S = forkBranch(B, { p: g.e0.slice(), yaw })
  S.zone = a.zone; S.omat = R.mat
  // 本道から縁の壁まで: 割れ目の少し手前で止まると、ハンドルがこの道に切り替わる（game.js）。止まった所から道の反対の端へ寄り、斜めに壁へ向かう
  { const ia = pk.i, q7 = P[ia - 7], q4 = P[ia - 4], sgRoom = Math.sign(Math.sin(wrap(yaw - a.yaw))) || 1 // 部屋は道の右（+）か左
    const Rq = q => [Math.sin(q.yaw), 0, Math.cos(q.yaw)]
    const far = add3(q4.p, Rq(q4), sgRoom * (q4.w / 2 - 0.9))
    const toE = Math.atan2(-(g.e0[2] - far[2]), g.e0[0] - far[0])
    S.path.unshift({ p: q7.p.slice(), yaw: q7.yaw, slope: 0, w: q7.w, kind: 'road' }, { p: far, yaw: toE, slope: 0, w: 2, kind: 'road' })
    g.trig = q7.p.slice() }
  // 縁（前輪を掛けて登る）→ 部屋の床
  S.hangLedge(LEDGE, ROOM_L, { w: ROOM_W, mat: R.mat, max: 10, thick: LEDGE + 0.8 })
  const fl = add3(g.e0, UP, LEDGE) // 床の入口（上面）
  const mid = add3(fl, u, ROOM_L / 2)
  // 壁と屋根（当たりあり。見た目も同じ箱）。入口と出口は開いている
  for (const sg of [-1, 1]) S.box({ c: add3(add3(mid, Rv, sg * (ROOM_W / 2 + 0.25)), UP, ROOM_H / 2), h: [ROOM_L / 2, ROOM_H / 2 + 0.05, 0.25], yaw, mat: R.wall, tag: 'wall' })
  // 屋根は、上に別の道が無い時だけ（あれば、その道の裏が屋根になる）
  { const roofC = add3(mid, UP, ROOM_H + 0.3); let free = true; const W1 = new World(B.shapes.slice()); for (const id of W1.near(roofC[0], roofC[1], roofC[2], ROOM_L / 2 + 1)) { const sh = W1.shapes[id]; if (sh.tag === 'road' && sh.min[1] < roofC[1] + 0.4 && sh.max[1] > roofC[1] - 0.4) { const o = closest(sh, roofC[0], roofC[1], roofC[2], { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); if (o.d < ROOM_L / 2) free = false } }
    if (free) S.box({ c: roofC, h: [ROOM_L / 2 + 0.2, 0.3, ROOM_W / 2 + 0.5], yaw, mat: R.wall, tag: 'ceiling' }) }
  // 置物と看板（部屋の左の壁ぎわ）
  const propAt = add3(add3(fl, u, ROOM_L * 0.55), Rv, -(ROOM_W / 2 - 0.55))
  const props = []
  if (R.prop === 'rustbike') { props.push({ kind: 'rustbike', p: propAt, yaw: yaw + 0.5 }); S.box({ c: add3(propAt, UP, 0.5), h: [0.75, 0.5, 0.22], yaw: yaw + 0.5, mat: 'rust', tag: 'post', noDraw: true }) }
  if (R.prop === 'barrels') { for (const [dx, dl, dy] of [[0, 0, 0], [0.62, 0, 0], [0.31, 0, 0.88]]) { const q = add3(add3(add3(propAt, u, dx - 0.3), Rv, dl), UP, dy); S.cyl({ a: q, b: add3(q, UP, 0.88), r: 0.29, mat: 'barrel', tag: 'barrel' }); B.props.push({ kind: 'barrel', p: q, rot: dx * 3 + dy }) } }
  if (R.prop === 'statue') { S.cyl({ a: propAt, b: add3(propAt, UP, 2.3), r: 0.55, mat: 'statue', tag: 'statue' }); B.props.push({ kind: 'statue', p: propAt, yaw: yaw - Math.PI / 2 }) }
  S.t = { p: add3(fl, u, 1.0), yaw }; S.last = null
  S.sign(R.sign, { at: 1.6 })
  // 出口: 細い梁（技: 細い所を渡る）→ 切れ目を跳んで本道 b へ
  S.t = { p: g.roomEnd.slice(), yaw: g.by }; S.last = null
  for (let k = 0; k <= g.k; k++) {
    S.road(g.beamL / (g.k + 1), { w: 0.8, slope: g.slope, mat: 'beam', thick: 0.35, kind: 'narrow', back: 0 })
    if (k < g.k) { S.road(0.8, { w: 2.4, mat: R.mat, thick: 0.6, back: 0, noOverlap: true }); S.hangLedge(LEDGE, PLAT - 0.8, { w: 2.4, mat: R.mat, max: 10, thick: LEDGE + 0.6 }); S.last = null }
  }
  S.gap(GAP, g.land[1] - S.t.p[1] - 0.0, 'jump'); S.path[S.path.length - 1].vJump = 6.2
  // 着地点（本道 b の上）から b の向きへ
  S.path.push({ p: g.land.slice(), yaw: g.by, slope: 0, w: 3, kind: 'landing' })
  for (const q of S.path) q.zone = q.zone || a.zone
  const brPath = forkJoin(B, S, pk.j)
  B.decor.push(...props.map(p => ({ kind: 'secretProp', ...p })))
  return { name: R.name, br: brPath[0].br, trig: g.trig, room: add3(mid, UP, 0.1), i: pk.i, j: pk.j, saved: Math.round(pk.saved), prop: R.prop, sign: R.sign, entry: g.e0.slice(), land: g.land.slice() }
}
