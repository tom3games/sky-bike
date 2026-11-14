// 当たり判定の検査（node だけで回る部分）
//  1. 玉を落とす: 走れる面を細かく区切って、玉を上から落とし、止まった高さが面＋半径に合うか（すり抜け・浮き）
//  2. 自動走行: 横の位置と速さを変えて全区間を走り、めり込み・すり抜け・継ぎ目の跳ねを数える
//  使い方: node tools/collide.mjs [stage1|practice|all]
import { World, createBike, stepBike, closest, basis, wheelCenter, BIKE, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'

const which = process.argv[2] || 'all'
// RANGE=名前（mark か旗の名前）: その区間だけ（例 RANGE=落石の坂 node tools/collide.mjs stage1）
const ids = which === 'all' ? Object.keys(COURSES) : [which]
let totalNG = 0
const RANGE_INFO = g => `道の点 ${g.i0}〜${g.i1}・旗 ${g.ci}`
for (const cid of ids) {
  const c = COURSES[cid](), w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  let RG = null
  if (process.env.RANGE) { const m = c.marks.find(x => x.name === process.env.RANGE); const ci = c.cps.findIndex(q => q.p && m && Math.hypot(q.p[0] - c.path[m.i0].p[0], q.p[2] - c.path[m.i0].p[2]) < 40 && q.rest); const i1 = (c.marks.find(x => x.i0 > m.i0) || { i0: c.path.length }).i0; const pts = c.path.slice(m.i0 - 20, i1).filter(q => q.p); const mn = [Math.min(...pts.map(q => q.p[0])) - 14, Math.min(...pts.map(q => q.p[2])) - 14], mx = [Math.max(...pts.map(q => q.p[0])) + 14, Math.max(...pts.map(q => q.p[2])) + 14]; RG = { i0: m.i0 - 20, i1, ci: Math.max(0, ci), mn, mx }; console.log('範囲', RANGE_INFO(RG)) }
  const inRG = s => !RG || (s.max[0] > RG.mn[0] && s.min[0] < RG.mx[0] && s.max[2] > RG.mn[1] && s.min[2] < RG.mx[1])
  const drivable = c.shapes.filter(s => ['road', 'pad', 'spiral', 'kicker', 'pipe', 'island', 'log'].includes(s.tag) && inRG(s))
  // ---------- 1. 玉を落とす
  let drops = 0, ballNG = 0, ballEx = [], rolled = 0, unsettled = 0
  const r = 0.2, m = 1, k = 20000, cdmp = 120
  for (const s of drivable) {
    const step = 0.5
    for (let x = s.min[0] + 0.05; x < s.max[0]; x += step) for (let z = s.min[2] + 0.05; z < s.max[2]; z += step) {
      const top = w.rayDown(x, z, s.max[1] + 1, s.min[1] - 1)
      if (top.id !== s.id) continue // その形が一番上の所だけ
      // 縁から 0.35m 以内は玉が縁に乗るので外す（縁は自動走行で調べる）
      let edge = false
      for (const [dx, dz] of [[0.35, 0], [-0.35, 0], [0, 0.35], [0, -0.35]]) { const t2 = w.rayDown(x + dx, z + dz, top.y + 1, top.y - 1); if (Math.abs(t2.y - top.y) > 0.25) { edge = true; break } }
      if (edge) continue
      // 物理の玉を落とす（真上 1.5m から）
      const p = [x, top.y + 1.5, z], v = [0, 0, 0]
      let calm = 0
      for (let t = 0; t < 1500; t++) {
        for (let sub = 0; sub < 8; sub++) {
          const h = DT / 8
          const nid = w.near(p[0], p[1], p[2], r + 0.1)
          let fx = 0, fy = -9.81 * m, fz = 0
          for (const id of nid) {
            const sh = w.shapes[id]; const o = closest(sh, p[0], p[1], p[2], { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 })
            const dep = r - o.d; if (dep <= 0) continue
            const vn = v[0] * o.n[0] + v[1] * o.n[1] + v[2] * o.n[2]
            const N = Math.max(0, k * dep - cdmp * vn)
            fx += o.n[0] * N; fy += o.n[1] * N; fz += o.n[2] * N
            // 摩擦（転がり出さないように強め）
            fx -= v[0] * 30; fz -= v[2] * 30
          }
          v[0] += fx / m * h; v[1] += fy / m * h; v[2] += fz / m * h
          p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h
        }
        calm = Math.hypot(v[0], v[1], v[2]) < 0.15 ? calm + 1 : 0
        if (calm > 20) break
      }
      drops++
      if (calm <= 20) { unsettled++; continue }
      // 期待: 面の上に半径ぶん（沈み m*g/k = 0.5mm）。斜面は法線方向なので、高さで比べると r/cos のずれ → 斜面の傾きで割り戻す
      const moved = Math.hypot(p[0] - x, p[2] - z)
      const here = w.rayDown(p[0], p[2], p[1] + 0.5, p[1] - 3)
      const want = here.y + r / nCos(w, p[0], p[2], here)
      const err = p[1] - want
      // 止まった玉は、どれかの面にちょうど半径の距離で触れているはず（沈んでも浮いてもいない）
      let dmin = Infinity
      for (const id of w.near(p[0], p[1], p[2], r + 0.5)) { const o = closest(w.shapes[id], p[0], p[1], p[2], { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); dmin = Math.min(dmin, o.d) }
      if (moved > 0.3) rolled++
      const gapErr = dmin - r
      if (!(Math.abs(gapErr) < 0.015)) { ballNG++; if (ballEx.length < 6) ballEx.push({ gap: +gapErr.toFixed(3), x: +x.toFixed(2), z: +z.toFixed(2), tag: s.tag, top: +top.y.toFixed(3), ball: +p[1].toFixed(3), want: +want.toFixed(3), moved: +moved.toFixed(2) }) }
    }
  }
  // ---------- 1.5 頭の上の空き: 道の上 1.0〜2.2m に形が無いこと（門・看板の板は 2.6m より上なので数えない）
  let headNG = 0; const headEx = []
  for (const [qi, q] of c.path.entries()) {
    if (RG && (qi < RG.i0 || qi > RG.i1)) continue
    if (!q.p || !q.w || q.kind === 'jump') continue
    for (let up = 1.0; up <= 2.2; up += 0.3) {
      const x = q.p[0], y = q.p[1] + up, z = q.p[2]
      for (const id of w.near(x, y, z, 0.3)) { const sh = w.shapes[id]; if (sh.tag === 'sign' || sh.tag === 'kicker' || sh.tag === 'ceiling' || sh.knock || sh.mov) continue; const o = closest(sh, x, y, z, { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); if (o.d < 0.25) { headNG++; if (headEx.length < 5) headEx.push({ p: q.p.map(v => +v.toFixed(1)), up, tag: sh.tag, zone: sh.zone }); break } }
    }
  }
  // ---------- 2. 自動走行
  const runs = []
  let pen = 0, tun = 0, bump = 0, steps = 0, finished = 0
  const exPen = [], exTun = [], exBump = []
  const feats = c.path.filter(q => q.kind !== 'road' && q.kind !== 'spiral' && q.kind !== 'narrow' && q.kind !== 'skyroad' && q.kind !== 'ramp' && q.kind !== 'bridge' && q.kind !== 'runway' && q.kind !== 'narrowSpiral' && q.p)
  const nearFeat = p => feats.some(q => Math.hypot(q.p[0] - p[0], q.p[1] - p[1], q.p[2] - p[2]) < 3.5)
  // 本物の坂の折れ目（傾きが 2 度以上変わる所）の近くは「継ぎ目の跳ね」に数えない
  const onPath = p => c.path.some(q => q.p && Math.hypot(q.p[0] - p[0], q.p[2] - p[2]) < 2.5 && Math.abs(q.p[1] + 0.8 - p[1]) < 1.2)
  const creases = []
  for (let i = 1; i < c.path.length; i++) { const a = c.path[i - 1], q = c.path[i]; if (a.p && q.p && a.slope != null && q.slope != null && Math.abs(a.slope - q.slope) > 0.035) creases.push(q.p) }
  const nearCrease = p => creases.some(q => Math.hypot(q[0] - p[0], q[2] - p[2]) < 4.5 && Math.abs(q[1] - p[1]) < 3)
  for (const lat of [-0.6, -0.3, 0, 0.3, 0.6]) for (const vMul of [0.8, 1.0, 1.2]) {
    const bot = createBot(c, { skill: 'good', lat, vMul }); bot.world = w
    let cp = 0, faults = 0, s = 0
    const spawn = i => { const q = c.cps[i]; const b = createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let kk = 0; kk < 20; kk++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); return b }
    let b = spawn(RG ? RG.ci : 0); resetBot(bot, b); if (RG) cp = RG.ci
    const R0 = RG ? { cp: RG.ci, rest: RG.ci } : null; if (R0) bot.R = R0
    let prevSv = [0, 0], lastAir = 0, deep = [0, 0]
    while (s < 60 * 400) {
      const prev = b.p.slice()
      w.tick(); stepBike(w, b, botInput(bot, b)); s++; steps++
      const B = basis(b)
      if (process.env.TR) { const [tl, tv, t0, t1] = process.env.TR.split(',').map(Number); if (lat === tl && vMul === tv && s >= t0 && s <= t1) console.log(s, b.p.map(v => v.toFixed(2)).join(','), 'v', b.v.map(v => v.toFixed(1)).join(','), 'th', (b.th * 57.3).toFixed(0), 'g', +b.g[0] + '' + +b.g[1], 'd', b.cn.map(c => c ? c.depth.toFixed(3) + w.shapes[c.id].tag : '-').join(' '), 'susp', b.s.map(v => v.toFixed(2)).join(',')) }
      if (!b.g[0] || !b.g[1]) lastAir = s
      for (let i = 0; i < 2 && !b.crashed; i++) {
        const cc = wheelCenter(b, B, i, b.s[i])
        // すり抜け: 車輪の中心が形の中
        for (const id of w.near(cc[0], cc[1], cc[2], 0.4)) { const o = closest(w.shapes[id], cc[0], cc[1], cc[2], { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); if (o.d < -0.02) { tun++; if (exTun.length < 5) exTun.push({ cid, lat, vMul, s, p: cc.map(v => +v.toFixed(2)), tag: w.shapes[id].tag }) } }
        // めり込み: 接地の深さ（底づきした後も残る深さ）
        const cn = b.cn[i]; deep[i] = cn && cn.depth > 0.07 ? deep[i] + 1 : 0
        if (deep[i] === 4) { pen++; if (exPen.length < 5) exPen.push({ cid, lat, vMul, s, depth: +cn.depth.toFixed(3), tag: w.shapes[cn.id].tag, p: cn.q.map(v => +v.toFixed(2)) }) }
        // 継ぎ目の跳ね: 段・丸太・ジャンプ台・角の近く以外で、サスが急に縮む
        if (b.g[0] && b.g[1] && !b.crashed && Math.abs(b.sv[i]) > 3.5 && Math.abs(prevSv[i]) < 1.5 && !nearFeat(b.p) && !nearCrease(b.p) && s - lastAir > 30 && onPath(b.p) && !(b.cn[i] && ['kicker', 'log'].includes(w.shapes[b.cn[i].id].tag))) { bump++; if (exBump.length < 6) exBump.push({ cid, lat, vMul, s, i, sv: +b.sv[i].toFixed(2), p: b.p.map(v => +v.toFixed(2)), tag: b.cn[i] && w.shapes[b.cn[i].id].tag }) }
        prevSv[i] = b.sv[i]
      }
      for (let i = cp + 1; i < c.cps.length; i++) { const q = c.cps[i], hx = Math.cos(q.yaw), hz = -Math.sin(q.yaw); const d0 = (prev[0] - q.p[0]) * hx + (prev[2] - q.p[2]) * hz, d1 = (b.p[0] - q.p[0]) * hx + (b.p[2] - q.p[2]) * hz; if (d0 < 0 && d1 >= 0 && Math.abs(-(b.p[0] - q.p[0]) * hz + (b.p[2] - q.p[2]) * hx) < q.w / 2 + 1.2 && !b.crashed) { cp = i; break } }
      if (RG && bot.i > RG.i1) { finished++; break }
      if (c.cps[cp].finish) { finished++; break }
      if ((b.crashed && b.crashed.t > 1.5) || b.p[1] < c.cps[cp].kill - 8) { faults++; b = spawn(cp); resetBot(bot, b); bot.vMul = vMul * (0.8 + (faults * 0.37) % 0.4); prevSv = [0, 0]; if (faults > 40) break }
    }
    runs.push({ lat, vMul, cp, faults, t: +(s * DT).toFixed(1) })
  }
  const ng = ballNG + tun + pen + bump + headNG
  totalNG += ng
  console.log(`[${cid}] 頭の上の空き NG ${headNG} ${headNG ? JSON.stringify(headEx) : ''}`)
  console.log(`[${cid}] 玉: ${drops} 点（転がった ${rolled}・止まりきらない ${unsettled}）NG ${ballNG} / 走行: ${runs.length} 本（完走 ${finished}）${steps} 刻み すり抜け ${tun} めり込み ${pen} 継ぎ目の跳ね ${bump}`)
  if (ballEx.length) console.log('  玉NG例', JSON.stringify(ballEx))
  if (exTun.length) console.log('  すり抜け例', JSON.stringify(exTun))
  if (exPen.length) console.log('  めり込み例', JSON.stringify(exPen))
  if (exBump.length) console.log('  跳ね例', JSON.stringify(exBump))
  console.log('  走行', JSON.stringify(runs))
}
console.log('合計 NG', totalNG)
function nCos(w, x, z, top) {
  // 面の傾き: 少しずらした点の高さから
  const a = w.rayDown(x + 0.05, z, top.y + 0.3, top.y - 0.3).y, b2 = w.rayDown(x, z + 0.05, top.y + 0.3, top.y - 0.3).y
  if (!isFinite(a) || !isFinite(b2)) return 1
  const gx = (a - top.y) / 0.05, gz = (b2 - top.y) / 0.05
  return 1 / Math.sqrt(1 + gx * gx + gz * gz)
}
