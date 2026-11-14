// v51 下山のジャンプ: 全開で走って踏み切った時の速さと、着地の頭の高さを後輪がよぎる所までの距離（届く限界）を、ジャンプごとに測る
// node tools/epijumps.mjs   → 表（何番目・切れ目・踏み切りの速さ・届く限界・余り・全開で抜けたか）
import { World, createBike, stepBike, DT, basis, wheelCenter, BIKE } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, E = c.epi
const jumps = []
for (let i = E.i0; i < E.i1; i++) if (P[i].kind === 'jump' && P[i - 1] && P[i - 1].kind === 'lip') jumps.push(i)
const rows = []
for (const [n, ji] of jumps.entries()) {
  const lip = P[ji - 1], J = P[ji], f = [Math.cos(lip.yaw), 0, -Math.sin(lip.yaw)]
  const headY = J.p[1] + J.dy, gap = J.len
  // 28m 手前（道に沿って）から
  let k = ji - 1, d = 0; while (k > E.i0 && d < 28) { if (P[k - 1].p) d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k--; if (P[k].kind === 'jump') { k++; break } }
  const q = P[k], w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); { const sl = q.slope || 0; b.v = [Math.cos(q.yaw) * 9 * Math.cos(sl), 9 * Math.sin(sl), -Math.sin(q.yaw) * 9 * Math.cos(sl)] }
  const st = S.createSteer(P); S.resetSteer(st, b)
  let vLip = null, reach = null, air = false, ok = null, tAfter = 0
  for (let s = 0; s < 60 * 12; s++) {
    const inp = S.assist(st, b, { thr: process.env.VCAP && b.speed > +process.env.VCAP ? 0 : 1, brk: 0, lean: b.th > 0.25 ? 0.7 : 0, steer: S.steerFor(st, b), nitro: 0 })
    w.tick(); stepBike(w, b, inp, [])
    const al = (b.p[0] - J.p[0]) * f[0] + (b.p[2] - J.p[2]) * f[2]
    if (vLip == null && al > -0.3) vLip = Math.hypot(b.v[0], b.v[2])
    if (vLip != null && !b.g[0] && !b.g[1]) air = true
    if (air && reach == null) { const B = basis(b), rc = wheelCenter(b, B, 0, 0); if (rc[1] - BIKE.R - BIKE.rt < headY) reach = (rc[0] - J.p[0]) * f[0] + (rc[2] - J.p[2]) * f[2] }
    const onPath = () => { for (let j = ji; j < Math.min(P.length, ji + 120); j++) { const qq = P[j]; if (qq.p && qq.w && Math.hypot(b.p[0] - qq.p[0], b.p[2] - qq.p[2]) < qq.w / 2 + 1 && Math.abs(b.p[1] - 0.79 - qq.p[1]) < 2.5) return true } return false }
    if (b.crashed || b.p[1] < headY - 40 || (air && !onPath() && b.p[1] < headY - 3 && !(b.g[0] || b.g[1]) && (b.v[1] < -9))) { ok = false; break }
    if (air && (b.g[0] || b.g[1])) { tAfter += DT; if (tAfter > 2.5) { ok = onPath(); break } }
  }
  rows.push({ n, 切れ目: +gap.toFixed(2), 頭の下: +(lip.p[1] + (lip.rise || 0) - headY).toFixed(2), 踏み切り: vLip && +vLip.toFixed(1), 届く限界: reach && +reach.toFixed(2), 余り: reach && +(reach - gap).toFixed(2), 全開: ok ? '抜けた' : b.crashed ? '転倒 ' + b.crashed.why : '落ちた', vJump: J.vJump })
}
console.table(rows)
