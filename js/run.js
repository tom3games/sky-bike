// 遊びのルール（ゲームと検査で同じものを使う）
// 練習場: 門（チェックポイント）からやり直す。
// 第1面（climb）: 落ちた所・転んだ所から登り直す。休憩所は一度触れたら、そこより大きく下に落ちた時だけ戻す。
import { createBike, stepBike, resetFallen } from './physics.js?v=14'

export const NET_DROP = 14 // 休憩所より何 m 下まで落ちたら休憩所へ戻すか

export function settle(world, b) { for (let k = 0; k < 20; k++) stepBike(world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); b.steps = 0; return b }
export function spawnAtCp(world, course, i) {
  const q = course.cps[i]
  return settle(world, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
}
// 転んだ所の近くの、コースの上の点（なければ真下の面）
export function spotNear(world, course, at, maxI = 1e9) {
  let best = null, bd = 1e9
  for (let i = 0; i < Math.min(course.path.length, maxI + 1); i++) {
    const q = course.path[i]
    if (!q.p || !q.w || q.kind === 'jump' || q.kind === 'crumble' || q.kind === 'trap' || q.kind === 'lift' || q.kind === 'lip' || Math.abs(q.slope || 0) > 0.3) continue
    const dx = q.p[0] - at[0], dz = q.p[2] - at[2], dy = q.p[1] - at[1]
    if (dy > 1.5 || dy < -6) continue
    const d = dx * dx + dz * dz + dy * dy * 0.5
    if (d < bd) { bd = d; best = q }
  }
  if (best && bd < 36) return { p: best.p.slice(), yaw: best.yaw }
  const r = world.rayDown(at[0], at[2], at[1] + 1, at[1] - 200)
  if (isFinite(r.y)) return { p: [at[0], r.y, at[2]], yaw: null }
  return null
}
function nearI(course, p, from) {
  const P = course.path
  let best = 1e18, bi = from ?? 0
  const scan = (a, z) => { for (let i = Math.max(0, a); i < Math.min(P.length, z); i++) { const q = P[i]; if (!q.p) continue; const d = (q.p[0] - p[0]) ** 2 + (q.p[2] - p[2]) ** 2 + ((q.p[1] + 0.8 - p[1]) * 2) ** 2; if (d < best) { best = d; bi = i } } }
  if (from != null) scan(from - 40, from + 60)
  if (from == null || best > 16) scan(0, P.length)
  return bi
}
// 出し直してよい道の点か: すぐ先 16 m に跳ぶ所・抜ける床・崩れる板が無く、真下が動かない床で、急な坂でない
const NOSPAWN = new Set(['jump', 'lip', 'crumble', 'lift', 'seesaw', 'spin', 'slide', 'water', 'draw', 'trap', 'landing'])
const NOAHEAD = new Set(['jump', 'lip', 'trap', 'crumble'])
export function goodSpot(world, course, i) {
  const P = course.path, q = P[i]
  if (!q || !q.p || !q.w || q.branch || NOSPAWN.has(q.kind) || Math.abs(q.slope || 0) > 0.25) return false
  // 後ろ 3 m（後輪の下）とすぐ先 16 m に跳ぶ所・抜ける床・崩れる板が無い。シーソーは 8 m 先まで無い（傾いたままの端に当たる）
  for (let k = Math.max(0, i - 3); k < Math.min(P.length, i + 16); k++) if (NOAHEAD.has(P[k].kind) || (P[k].kind === 'seesaw' && k < i + 8)) return false
  // 前輪・真ん中・後輪の 3 か所の真下が、道の高さの動かない床
  const a = P[Math.max(0, i - 1)].p || q.p, z = P[Math.min(P.length - 1, i + 1)].p || q.p
  let dx = z[0] - a[0], dz = z[2] - a[2]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L
  for (const d of [-0.85, 0, 0.85]) {
    const r = world.rayDown(q.p[0] + dx * d, q.p[2] + dz * d, q.p[1] + 1.5, q.p[1] - 3)
    if (!(Math.abs(r.y - q.p[1]) < 0.35) || r.id < 0) return false
    const sh = world.shapes[r.id]
    if (sh.mov && sh.mov.type !== 'brk') return false
  }
  return true
}
function backSpot(world, course, from, stop) {
  let first = null
  for (let k = from - 4; k >= Math.max(stop, from - 160); k--) {
    if (!goodSpot(world, course, k)) continue
    if (Math.abs(course.path[k].slope || 0) < 0.12) return k
    if (first == null) first = k
  }
  return first
}
function cpPathI(course, ci) {
  course._cpI = course._cpI || {}
  if (course._cpI[ci] == null) { const q = course.cps[ci]; let bd = 1e18; course.path.forEach((z, k) => { if (!z.p) return; const d = (z.p[0] - q.p[0]) ** 2 + (z.p[2] - q.p[2]) ** 2 + ((z.p[1] - q.p[1]) * 2) ** 2; if (d < bd) { bd = d; course._cpI[ci] = k } }) }
  return course._cpI[ci]
}
export function spawnAt(world, spot, yaw) {
  return settle(world, createBike({ p: [spot.p[0], spot.p[1] + 0.79, spot.p[2]], yaw: spot.yaw ?? yaw ?? 0 }))
}
// 1 刻みぶんのルール判定。状態 R = { cp, rest, hard, fallTop } を持ち回る
export function judge(world, course, R, b, prevP) {
  const out = { finish: false, respawn: null, net: false, gate: null }
  const cps = course.cps
  // 門・休憩所・ゴール
  for (let i = 1; i < cps.length; i++) {
    const q = cps[i]
    if (course.climb && !q.finish) {
      if (i > R.cp && !b.crashed && (b.g[0] || b.g[1]) && Math.hypot(b.p[0] - q.p[0], b.p[2] - q.p[2]) < Math.max(3, q.w / 2 + 1) && Math.abs(b.p[1] - 0.79 - q.p[1]) < 1.5) { R.cp = i; if (q.rest) R.rest = i; out.gate = i }
      continue
    }
    if (i <= R.cp) continue
    const hx = Math.cos(q.yaw), hz = -Math.sin(q.yaw)
    const d0 = (prevP[0] - q.p[0]) * hx + (prevP[2] - q.p[2]) * hz, d1 = (b.p[0] - q.p[0]) * hx + (b.p[2] - q.p[2]) * hz
    if (d0 < 0 && d1 >= 0) {
      const lat = Math.abs(-(b.p[0] - q.p[0]) * hz + (b.p[2] - q.p[2]) * hx), dy = b.p[1] - q.p[1]
      if (lat < q.w / 2 + 1.2 && dy > -1 && dy < 4.5 && !b.crashed) { R.cp = i; out.gate = i; if (q.finish) { out.finish = true; return out } }
    }
  }
  // 落ち始めの高さ（何 m 落ちたかを出すため）
  if (b.g[0] || b.g[1]) R.fallTop = b.p[1]; else R.fallTop = Math.max(R.fallTop ?? b.p[1], b.p[1])
  if (!course.climb) {
    const q = cps[R.cp]
    if (b.crashed && b.crashed.t > 1.5) out.respawn = { cp: R.cp }
    else if (b.p[1] < q.kill - 8) out.respawn = { cp: R.cp, fell: true }
    return out
  }
  // 道の上で最後に走っていた所（転んだ時に、そこより先へ戻さないため。跳んで届かなかった所の先へ出さない）
  if ((b.g[0] || b.g[1]) && !b.crashed) R.onI = nearI(course, b.p, R.onI)
  // 少し前の安全な地点（両輪が道に着いて、車体がほぼ道に沿っていた所）を 0.25 秒ごとに覚える
  R.safeT = (R.safeT || 0) + 1
  if (!b.crashed && b.g[0] && b.g[1] && R.safeT >= 15 && R.onI != null) {
    const q = course.path[R.onI]
    if (q && q.p && q.w && !['jump', 'lip', 'crumble', 'lift', 'seesaw', 'spin', 'slide', 'water', 'draw', 'trap'].includes(q.kind) && Math.abs(b.th - (q.slope || 0)) < 0.35 && Math.abs(b.p[1] - 0.79 - q.p[1]) < 1.2) {
      R.safe = R.safe || []; R.safe.push({ p: q.p.slice(), yaw: q.yaw, t: world.time, i: R.onI }); if (R.safe.length > 24) R.safe.shift(); R.safeT = 0
    }
  }
  if (b.crashed && b.crashed.t > 0.8) {
    // 転んだら: 数秒前に車輪が着いていた安全な地点から出し直す（旗までは戻さない）。フォルト 1
    const at = b.crashed.at, L = R.lastCrash
    R.crashRep = L && Math.hypot(at[0] - L[0], at[1] - L[1], at[2] - L[2]) < 2.5 ? (R.crashRep || 0) + 1 : 0; R.lastCrash = at.slice()
    if (R.crashRep >= 3) { R.crashRep = 0; R.safe = []; out.respawn = { cp: R.rest || 0 }; return out } // 同じ所で何度も転んだら旗から
    // 出し直す所は、すぐ先に跳ぶ所・抜ける床・崩れる板がない所（助走が取れる所）にする
    const old = (R.safe || []).filter(e => e.t <= world.time - 2.2 - b.crashed.t && goodSpot(world, course, e.i))
    // 新しい順に 3 つまで見て、平らな所を選ぶ（坂の途中で止まった所から出すと、下がったり登れなかったりする）
    let sp = null
    for (let k = old.length - 1; k >= Math.max(0, old.length - 3); k--) if (Math.abs(course.path[old[k].i].slope || 0) < 0.12) { sp = old[k]; break }
    sp = sp || (old.length ? old[old.length - 1] : null)
    if (sp) { R.safe = R.safe.filter(e => e.t <= sp.t); out.respawn = { safe: { p: sp.p, yaw: sp.yaw } }; return out }
    // 覚えた所が無い（休憩所を出てすぐ・跳ぶ所が続く所）: 旗まで戻さず、転んだ所から道を後ろへたどって出せる所を探す
    const k = backSpot(world, course, R.onI ?? nearI(course, at, null), cpPathI(course, R.rest || 0))
    out.respawn = k != null ? { safe: { p: course.path[k].p.slice(), yaw: course.path[k].yaw } } : { cp: R.rest || 0 }
    return out
  }
  // 道から地面に落ちたら（地面に車輪が着いて 0.5 秒）、休憩所へ
  if (course.groundKill) { const on = [0, 1].some(i => b.cn[i] && world.shapes[b.cn[i].id].tag === 'ground'); R.groundT = on ? (R.groundT || 0) + 1 / 60 : 0; if (R.groundT > 0.5) { R.groundT = 0; out.respawn = { cp: R.rest || 0, fell: true }; out.net = true; return out } }
  // 下から上がってくる溶岩（追われて登る）: 始まりの点を過ぎると上がり始め、追いつかれたら休憩所へ。休憩所から出し直すと最初から
  for (const [k, rs] of (course.risers || []).entries()) {
    R.rise = R.rise || {}
    if (R.rise[k] == null && R.onI != null && R.onI >= rs.i0 && R.onI < rs.i1) R.rise[k] = world.time
    if (R.rise[k] != null && R.onI != null && R.onI >= rs.i1) R.rise[k] = -1 // 逃げ切った
    if (R.rise[k] > 0 || R.rise[k] === 0) {
      const y = riserY(rs, world.time - R.rise[k])
      if (b.p[1] - 0.6 < y) { R.rise[k] = null; out.respawn = { cp: R.rest || 0, fell: true }; out.net = true; out.lava = true; return out }
    }
  }
  // 溶岩に落ちたら休憩所へ
  if (course.lavaKill != null && b.p[1] < course.lavaKill) { out.respawn = { cp: R.rest || 0, fell: true }; out.net = true; return out }
  const rest = cps[R.rest || 0]
  // 道の外へ落ちても、下の道や足場に着地すれば、そこから登り直し（旗へは戻さない。溶岩・谷底・地面だけは旗へ）
  if (b.p[1] < -30) out.respawn = { cp: 0, fell: true }
  return out
}
// respawn の指示から新しいバイクを作る
export function doRespawn(world, course, R, rs) {
  resetFallen(world) // 抜けた床・崩れた敷石を元に戻す（戻らないと登れなくなる）
  for (const s of world.moving) if (s.mov.type === 'seesaw') { s.mov.ang = s.mov.ang0 || 0; s.mov.w = 0 } // 傾いたままのシーソーも元へ（出し直した所の先で、上がった端に当たらない）
  if (rs.safe) { const b = spawnAt(world, { p: rs.safe.p, yaw: rs.safe.yaw }); if (!b.crashed) return b; R.safe = []; return spawnAtCp(world, course, R.rest || 0) } // 出した所で転んでいたら旗から
  if (rs.cp != null) { R.rise = {}; R.onI = null; return spawnAtCp(world, course, rs.cp) } // 休憩所からやり直すと、上がってくる溶岩も最初から
  const sp = spotNear(world, course, rs.at, rs.maxI)
  if (sp) return spawnAt(world, sp)
  return spawnAtCp(world, course, R.rest || 0)
}

// 上がってくる溶岩の高さ（始まってから t 秒）
export function riserY(rs, t) { return Math.min(rs.yTop, rs.y0 + Math.max(0, t - (rs.delay ?? 1.5)) * rs.rate) }
