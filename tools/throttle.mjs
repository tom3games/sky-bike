// アクセルの反応（v27）: ふつうの平らな道で止まった所からアクセルを押して、動き出すまで（0.3m/s）・0.5 秒・1 秒の速さと距離
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
const c = COURSES.practice(), w = new World(c.shapes), q = c.cps[0]
for (const [nm, thr, pre] of [['止まった所から', 1, 0], ['止まった所から（半分）', 0.5, 0], ['ブレーキで下がっている所から', 1, 1]]) {
  const b = settle(w, createBike({ p: [q.p[0] + 2, q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
  for (let k = 0; k < 60; k++) stepBike(w, b, { thr: 0, brk: pre, lean: 0, steer: 0 }, [])
  const x0 = b.p.slice(); let tMove = null; const at = {}
  for (let s = 1; s <= 90; s++) { stepBike(w, b, { thr, brk: 0, lean: 0, steer: 0 }, []); const t = s * DT; if (tMove == null && b.speed > 0.3) tMove = t; if (s === 6 || s === 12 || s === 30 || s === 60) at[t.toFixed(2) + '秒'] = b.speed.toFixed(2) + 'm/s ' + Math.hypot(b.p[0] - x0[0], b.p[2] - x0[2]).toFixed(2) + 'm' }
  console.log(nm, 'v0', 0, '動き出す（0.3m/s）', tMove && tMove.toFixed(3) + '秒', JSON.stringify(at))
}
