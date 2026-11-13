// 全開（アクセル押しっぱなし）でジャンプ台に入った時の、踏み切りの速さと飛んだ距離（大ジャンプ台・見極めの台・氷の岩・谷越え）
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = c.winds || []
const lips = c.path.map((q, i) => q.kind === 'lip' ? i : -1).filter(i => i >= 0)
const name = i => { let n = ''; for (const m of c.marks) if (i >= m.i0) n = m.name; return n }
const rows = []
for (const li of lips) {
  // 台の 26m 手前（なければ道の始め）から、止まった所から全開
  let i0 = li, d = 0; while (i0 > 0 && d < 26) { const a = c.path[i0].p, b = c.path[i0 - 1].p; if (a && b) d += Math.hypot(a[0] - b[0], a[2] - b[2]); i0--; if (['uturn', 'jump', 'stepUp'].includes(c.path[i0].kind)) { i0++; break } }
  const q = c.path[i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = S.createSteer(c.path); S.resetSteer(st, b)
  const L = c.path[li].p
  let vl = null, land = null
  for (let s = 0; s < 60 * 12; s++) {
    let inp = { thr: 1, brk: 0, lean: 0, steer: S.steerFor(st, b) }
    if (S.assist) inp = S.assist(st, b, inp)
    if (vl != null) inp = { thr: 0, brk: 0, lean: b.th > 0.1 ? 0.5 : b.th < -0.3 ? -0.5 : 0, steer: 0 }
    const was = b.g[0] || b.g[1]
    stepBike(w, b, inp)
    if (vl == null && was && !b.g[0] && !b.g[1] && Math.hypot(b.p[0] - L[0], b.p[2] - L[2]) < 4) vl = Math.hypot(b.v[0], b.v[1], b.v[2])
    if (vl != null && (b.g[0] || b.g[1])) { land = Math.hypot(b.p[0] - L[0], b.p[2] - L[2]); break }
  }
  rows.push({ 台: name(li), 助走m: +d.toFixed(0), 踏み切りの速さ: vl ? +vl.toFixed(1) : '-', 飛んだ距離m: land ? +land.toFixed(1) : '-' })
}
console.table(rows)
