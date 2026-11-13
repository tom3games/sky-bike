// 抜ける床・横切る溝・一度通ると崩れる敷石: アクセルだけで速さを保つ bot（7m/s）と、ゆっくりの bot（2.5m/s）で越えられるか。
// あわせて、崩れた後に出し直す（resetFallen）と元に戻るかを見る
import { World, createBike, stepBike, resetFallen } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1()
const feats = []
for (let i = 5; i < c.path.length - 12; i++) { const q = c.path[i], p = c.path[i - 1]; if (q.branch) break; const k = q.kind === 'trap' ? '抜ける床' : q.kind === 'crumble' && c.path[i - 1].kind !== 'crumble' ? '崩れる敷石' : q.kind === 'jump' && p.kind !== 'jump' && p.kind !== 'lip' && !(q.len > 2.6) && (p.kind === 'orbit' || p.kind === 'road') ? '溝' : null; if (k && (q.kind !== 'trap' || p.kind !== 'trap')) feats.push({ i, k }) }
const res = {}
for (const f of feats) for (const V of [7, 2.5]) {
  const w = new World(c.shapes); w.winds = []
  let i0 = f.i, d = 0; while (i0 > 0 && d < 9) { const a = c.path[i0].p, b0 = c.path[i0 - 1].p; if (a && b0) d += Math.hypot(a[0] - b0[0], a[2] - b0[2]); i0--; if (!c.path[i0].p || !c.path[i0].w) { i0++; break } }
  const q = c.path[i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = S.createSteer(c.path); S.resetSteer(st, b)
  b.v = [Math.cos(q.yaw) * V, 0, -Math.sin(q.yaw) * V]
  let ok = false
  for (let s = 0; s < 60 * 8; s++) { w.tick(); stepBike(w, b, { thr: b.speed < V ? 1 : 0, brk: b.speed > V + 0.5 ? 0.3 : 0, lean: 0, steer: S.steerFor(st, b) }); if (b.p[1] < q.p[1] - 2.5 || b.crashed) break; if (st.i > f.i + 6) { ok = true; break } }
  // 崩れた物を元に戻せるか
  const fallen = w.moving.filter(s => (s.mov.type === 'trap' || s.mov.once) && s.gone).length
  resetFallen(w); const after = w.moving.filter(s => (s.mov.type === 'trap' || s.mov.once) && s.gone).length
  const key = f.k + ' ' + V + 'm/s'; res[key] = res[key] || { 越えた: 0, 数: 0, 崩れた物: 0, 戻した後に残った物: 0 }
  res[key].数++; if (ok) res[key].越えた++; res[key].崩れた物 += fallen; res[key].戻した後に残った物 += after
}
console.table(res)
