// v35 回る筒: 入る速さごとに一周できるか・ニトロ・出し直しで口が戻るか（node tools/drumtest.mjs）
import { World, createBike, stepBike, resetFallen } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { createSteer, steerFor } from '../js/steer.js'
const c = COURSES.stage1(), m = c.marks.find(m => m.name === '回る筒')
const w = new World(c.shapes); w.winds = c.winds
const D = w.drums[0]
function run(vc, nitro) {
  resetFallen(w); w.setTime(0)
  const q = c.path[m.i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = createSteer(c.path)
  let vin = 0, vin0 = false, opened = false, ev = []
  for (let s = 0; s < 60 * 20; s++) {
    const inDrum = c.path[st.i].kind === 'drum'
    { const fw = (b.p[0] - D.c[0]) * D.f[0] + (b.p[2] - D.c[2]) * D.f[2]; if (fw < 0 && !vin0) vin = b.speed; else vin0 = true }
    const thr = inDrum ? 1 : (b.speed < vc ? 1 : 0)
    w.tick(); ev.length = 0; stepBike(w, b, { thr, brk: 0, lean: 0, steer: steerFor(st, b), nitro: nitro && thr ? 1 : 0 }, ev)
    if (ev.some(e => e.t === 'drumTurn')) opened = true
    if (b.crashed) return { vc, vin: +vin.toFixed(1), r: '転倒 ' + b.crashed.why, opened }
    if (Math.hypot(b.p[0] - m.end[0], b.p[2] - m.end[2]) < 2.2 && Math.abs(b.p[1] - 0.79 - m.end[1]) < 1.5) return { vc, vin: +vin.toFixed(1), r: '抜けた ' + (s / 60).toFixed(1) + '秒', opened }
  }
  return { vc, vin: +vin.toFixed(1), r: '進めない', opened }
}
const rows = []; for (const v of [5, 7, 8, 9, 9.5, 10, 11, 12, 13.5]) rows.push(run(v)); rows.push({ ...run(30, true), vc: 'ニトロ' })
console.table(rows)
resetFallen(w); console.log('出し直し後: open', D.open, '入口 A の板', w.moving.filter(s => s.mov.side === 'A').every(s => s.gone) ? '無し（開いている）' : 'ある', '出口 B の板', w.moving.filter(s => s.mov.side === 'B').every(s => !s.gone) ? 'ある（閉じている）' : '無し')
