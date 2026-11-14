// 旗からの復活の検査（v19）: どの旗でも、出し直してアクセルだけ 2 秒押すと、道の進む向きへ前に進むか。
// ゲームと同じ自動ハンドルと曲がりの手前の自動の減速を通す。 node tools/flagtest.mjs [COURSE=stage1] [LIST=1]
import { World, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { spawnAtCp } from '../js/run.js'
import { createSteer, resetSteer, steerFor, assist } from '../js/steer.js'
const c = COURSES[process.env.COURSE || 'stage1'](), P = c.path
const rows = []
let bad = 0
for (let i = 0; i < c.cps.length; i++) {
  const q = c.cps[i]
  if (q.finish) continue // ゴールの門からは出し直さない
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  const b = spawnAtCp(w, c, i), p0 = b.p.slice()
  const st = createSteer(P); resetSteer(st, b)
  const i0 = st.i, pq = P[i0], f = [Math.cos(pq.yaw), -Math.sin(pq.yaw)]
  const yawGap = Math.abs(Math.atan2(Math.sin(q.yaw - pq.yaw), Math.cos(q.yaw - pq.yaw))) * 57.3
  let crashed = false
  for (let s = 0; s < 120; s++) {
    const inp = assist(st, b, { thr: 1, brk: 0, lean: 0, steer: Math.round(steerFor(st, b) * 16) / 16, nitro: 0 })
    w.tick(); stepBike(w, b, inp, [])
    if (b.crashed) { crashed = true; break }
  }
  const fwd = (b.p[0] - p0[0]) * f[0] + (b.p[2] - p0[2]) * f[1]
  const ok = fwd > 2 && !crashed
  if (!ok) bad++
  if (!ok || process.env.LIST) rows.push({ 旗: i, 名前: q.name, 高さ: +q.p[1].toFixed(0), 道の点: i0, 旗と道の向きの差: +yawGap.toFixed(0), '2秒で前へm': +fwd.toFixed(1), 転倒: crashed })
}
console.table(rows)
console.log('旗', c.cps.length, '前へ進まない', bad)
