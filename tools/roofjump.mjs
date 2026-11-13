// 屋上の休憩所から全開で助走して、谷を越えてどこへ降りるか（近道の浮き島2に届くか）
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), w = new World(c.shapes)
const cp = c.cps.find(q => q.name === '塔の屋上'), note = c.notes.find(n => n.kind === 'shortcut')
const b = settle(w, createBike({ p: [cp.p[0], cp.p[1] + 0.79, cp.p[2]], yaw: cp.yaw })), st = S.createSteer(c.path); S.resetSteer(st, b)
let vl = null, out = null
for (let s = 0; s < 900 && !out; s++) {
  let inp = { thr: 1, brk: 0, lean: 0, steer: S.steerFor(st, b) }; if (S.assist) inp = S.assist(st, b, inp)
  if (vl != null) inp = { thr: 0, brk: 0, lean: b.th > 0.1 ? 0.5 : b.th < -0.3 ? -0.5 : 0, steer: 0 }
  const was = b.g[0] || b.g[1]; stepBike(w, b, inp)
  if (vl == null && was && !b.g[0] && !b.g[1] && Math.hypot(b.p[0] - note.p[0], b.p[2] - note.p[2]) < 4) vl = Math.hypot(...b.v)
  if (vl != null && (b.g[0] || b.g[1])) { const d2 = Math.hypot(b.p[0] - note.isl2[0], b.p[2] - note.isl2[2]); out = { 踏み切り: +vl.toFixed(1), 飛んだm: +Math.hypot(b.p[0] - note.p[0], b.p[2] - note.p[2]).toFixed(1), 着地の高さ: +(b.p[1] - 0.79).toFixed(1), 浮き島2の高さ: +note.isl2[1].toFixed(1), 浮き島1の高さ: +(note.p[1] - 1.6).toFixed(1), 着いた所: c.shapes[(b.cn[0] || b.cn[1]).id].tag + ':' + c.shapes[(b.cn[0] || b.cn[1]).id].mat } }
  if (b.p[1] < note.p[1] - 30) out = { 踏み切り: vl, 落ちた: true }
}
console.log(JSON.stringify(out))
