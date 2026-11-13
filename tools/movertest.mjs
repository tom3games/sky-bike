// 動く床の検査: コースの動く床（前後・上下・横）とシーソー・回る橋に、止まったバイクを載せてブレーキだけで 8 秒。
// 床と一緒に運ばれるか（床から見たずれ）・落ちないか・床の端で跳ねる/めり込むか（車体の上下の速さとめり込み）を数える
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = []
const rows = []
for (const s of c.shapes) {
  if (!s.mov || !['lift', 'seesaw', 'spin'].includes(s.mov.type) || s.type !== 'box') continue
  for (const pol of ['何もしない', 'ゆっくり走る', '止まる', '着地直後']) for (const t0 of [0, 1.7, 3.1, 4.6, 6.2]) {
    w.setTime(t0)
    const yaw = Math.atan2(-s.ax[0][2], s.ax[0][0]) // 床の今の向き（回る床は時刻で向きが変わる）
    const top = [s.c[0] + s.ax[1][0] * s.h[1], s.c[1] + s.ax[1][1] * s.h[1], s.c[2] + s.ax[1][2] * s.h[1]]
    const b = createBike({ p: [top[0], top[1] + (pol === '着地直後' ? 2.2 : 0.8), top[2]], yaw }) // 着地直後: 1.4 m 上から落として、着いた後に床と一緒に動くか
    // 床の上の、床から見た位置（床の軸での座標）
    const local = () => { const d = [b.p[0] - s.c[0], b.p[1] - s.c[1], b.p[2] - s.c[2]]; return [0, 2].map(k => d[0] * s.ax[k][0] + d[1] * s.ax[k][1] + d[2] * s.ax[k][2]) }
    let l0 = null, maxSlip = 0, fell = false, maxVy = 0, maxSink = 0
    for (let k = 0; k < 480; k++) {
      const vr = b.speed; const inp = pol === '何もしない' || pol === '着地直後' ? { thr: 0, brk: 0, lean: 0, steer: 0 } : pol === '止まる' ? { thr: 0, brk: 1, lean: 0.4, steer: 0 } : { thr: vr < 0.6 ? 0.4 : 0, brk: vr > 0.9 ? 0.3 : 0, lean: 0, steer: 0 }
      w.tick(); const ev = []; stepBike(w, b, inp, ev)
      if (k === 30 && pol !== '着地直後') l0 = local(); if (pol === '着地直後' && !l0 && b.g[0] && b.g[1]) l0 = local()
      if (k > 30 && l0) { const l = local(); maxSlip = Math.max(maxSlip, pol === 'ゆっくり走る' ? Math.abs(l[1] - l0[1]) : Math.hypot(l[0] - l0[0], l[1] - l0[1])); const v = w.shapeVel(s, b.p) || [0, 0, 0]; maxVy = Math.max(maxVy, Math.abs(b.v[1] - v[1])) }
      for (const cn of b.cn) if (cn && cn.depth) maxSink = Math.max(maxSink, cn.depth)
      if (b.p[1] < top[1] - 4) { fell = true; break }
      if (pol === 'ゆっくり走る' && Math.abs(local()[0]) > s.h[0] - 1) break // 床の端まで走ったら終わり
    }
    rows.push({ 着いた: !!l0, 操作: pol, 床: s.mov.type + (s.mov.axis ? (Math.abs(s.mov.axis[1]) > 0.5 ? '（上下）' : '（前後か横）') : ''), 始めの時刻: t0, 床から見たずれm: +maxSlip.toFixed(2), 落ちた: fell ? 'はい' : '', 上下に跳ねる速さ: +maxVy.toFixed(2), めり込みm: +maxSink.toFixed(3) })
  }
}
const agg = {}; for (const r of rows) { const k = r.操作 + ' ' + r.床; agg[k] = agg[k] || { 本数: 0, 床から見たずれ最大m: 0, 落ちた: 0 }; agg[k].本数++; agg[k].床から見たずれ最大m = Math.max(agg[k].床から見たずれ最大m, r.床から見たずれm); if (r.落ちた) agg[k].落ちた++ }
console.table(agg); if (process.argv[2]) console.table(rows.filter(r => r.床.startsWith(process.argv[2])))
