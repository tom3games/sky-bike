// 止まったままのウィリーと前輪立ちの検査: 平らな所で止まって、後ろ体重（または前体重＋ブレーキ）を押し続けた時の角度と、倒れないか
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
const c = COURSES.practice(), w = new World(c.shapes), q = c.cps[0]
const mk = () => { const b = createBike({ p: [q.p[0] + 4, q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 30; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); return b }
for (const [name, inp] of [['後ろ体重', { thr: 0, brk: 0, lean: -1, steer: 0 }], ['後ろ体重（7割）', { thr: 0, brk: 0, lean: -0.7, steer: 0 }], ['前体重＋ブレーキ', { thr: 0, brk: 1, lean: 1, steer: 0 }], ['前体重だけ', { thr: 0, brk: 0, lean: 1, steer: 0 }], ['後ろ体重＋アクセル', { thr: 1, brk: 0, lean: -1, steer: 0 }]]) {
  const b = mk(), ev = []; let mx = -9, mn = 9, at2 = 0
  for (let s = 0; s < 300; s++) { stepBike(w, b, inp, ev); if (s > 120) { mx = Math.max(mx, b.th); mn = Math.min(mn, b.th) } if (s === 179) at2 = b.th }
  console.log(`${name}: 3秒後 ${(at2 * 57.3).toFixed(0)}度（2〜5秒の幅 ${(mn * 57.3).toFixed(0)}〜${(mx * 57.3).toFixed(0)}度）転倒 ${ev.some(e => e.t === 'crash') ? 'あり' : 'なし'} 動いた距離 ${Math.hypot(b.p[0] - q.p[0] - 4, b.p[2] - q.p[2]).toFixed(1)}m`)
}
