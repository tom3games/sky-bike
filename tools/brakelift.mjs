// 急ブレーキの後輪上げ（v20〜v23）: ふつうの道で、速さ v からブレーキの押し方を変えて、後輪が浮く最大の角度・転ぶか・止まる距離
//  全開を押し続ける（13m/s で約 50 度・14.5 超はゆっくり前へ転ぶ）／弱いブレーキ（0.45）／短い踏み直し（0.2 秒×3 回）
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
const c = COURSES.practice(), w = new World(c.shapes), q = c.cps[0]
const run = (v, pat) => {
  const b = settle(w, createBike({ p: [q.p[0] + 2, q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); b.v = [Math.cos(q.yaw) * v, 0, -Math.sin(q.yaw) * v]
  let mx = 0, crashT = null; const x0 = b.p.slice()
  for (let s = 0; s < 240; s++) { const t = s * DT; const brk = pat(t); stepBike(w, b, { thr: 0, brk, lean: 0, steer: 0 }, []); mx = Math.max(mx, -b.th * 57.3); if (b.crashed && crashT == null) { crashT = t; break } }
  return `浮き${mx.toFixed(0)}度 ${crashT != null ? '転倒 ' + crashT.toFixed(2) + '秒' : '転ばない'} ${Math.hypot(b.p[0] - x0[0], b.p[2] - x0[2]).toFixed(1)}m`
}
const rows = []
for (const v of [8, 13, 16, 19]) rows.push({ 速さ: v, 全開を押し続ける: run(v, () => 1), '弱い（0.45）': run(v, () => 0.45), '短い踏み直し 0.2秒×3': run(v, t => (t % 0.5) < 0.2 && t < 1.5 ? 1 : 0) })
console.table(rows)
