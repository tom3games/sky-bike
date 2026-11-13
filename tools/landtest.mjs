// 強い着地の検査: 平らな所へ、いろいろな高さ・前の速さ・車体の傾きで落として、転倒（crash）が起きないか数える
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
const c = COURSES.practice(), w = new World(c.shapes), q = c.cps[0]
let n = 0, crashes = 0, thuds = 0; const why = {}
for (const h of [2, 4, 6, 9, 12, 15]) for (const v of [0, 4, 8, 12]) for (const th of [-0.35, -0.15, 0, 0.15, 0.35]) {
  const b = createBike({ p: [q.p[0] + 4, q.p[1] + 0.79 + h, q.p[2]], yaw: q.yaw }); b.th = th
  const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f[0] * v, 0, f[2] * v]
  const ev = []
  for (let s = 0; s < 150; s++) stepBike(w, b, { thr: 0, brk: 0, lean: 0, steer: 0 }, ev)
  n++; const cr = ev.filter(e => e.t === 'crash'); if (cr.length) { crashes++; for (const e of cr) why[e.why] = (why[e.why] || 0) + 1 } thuds += ev.filter(e => e.t === 'thud').length
}
console.log(`強い着地 ${n} 回: 転倒 ${crashes}`, JSON.stringify(why), `（揺れと音だけの強い着地 ${thuds}）`)
