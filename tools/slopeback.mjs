// 坂の上でブレーキ長押しのバック（v29）: 最初のジャンプ台（24度）と他の坂で、止まった所からブレーキを押し続けると下がって行けるか。
// node tools/slopeback.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
const spots = []
spots.push(['出発のジャンプ台 24度', P.findIndex(q => q.kind === 'ramp' && Math.abs(q.slope - 24 * Math.PI / 180) < 0.01) + 3])
// 他の坂（上り 10 度以上・道の点が 4 つ以上続く所）から数か所
{ let n = 0; for (let i = 60; i < P.length - 5 && n < 6; i += 1) { const q = P[i]; if (!q.p || q.branch || !q.w || (q.slope || 0) < 0.17 || !['road', 'ramp', 'orbit', 'steep'].includes(q.kind)) continue; if (![1, 2, 3, 4, 5, 6, 7, 8, 9].every(k => P[i + k] && Math.abs((P[i + k].slope || 0) - q.slope) < 0.02)) continue; spots.push([`坂 ${Math.round(q.slope * 57.3)}度 (${q.kind} ${i})`, i + 7]); n++; i += 400 } }
let fails = 0
for (const lean of [0, 1]) for (const [nm0, i] of spots) { const nm = nm0 + (lean ? '・前体重のまま' : '')
  const q = P[i], f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]
  // 坂を登ってきて止まった所: 少し手前から、ゆっくり登る速さで置く
  const b = createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw, pitch: q.slope })
  b.th = q.slope || 0
  for (let k = 0; k < 20; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
  const st = S.createSteer(P); S.resetSteer(st, b)
  const p0 = b.p.slice(); let back = 0, crashed = false, tStart = null
  for (let s = 0; s < 60 * 4; s++) { const inp = S.assist(st, b, { thr: 0, brk: 1, lean, steer: S.steerFor(st, b) }); stepBike(w, b, inp); const d = -((b.p[0] - p0[0]) * f[0] + (b.p[2] - p0[2]) * f[2]); if (tStart == null && d > 0.3) tStart = s / 60; back = Math.max(back, d); if (b.crashed) { crashed = true; break } }
  const ok = back > 2.0 && !crashed && tStart != null && tStart < 1.2
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', nm, `4 秒で ${back.toFixed(1)}m 下がる・下がり始め ${tStart == null ? '-' : tStart.toFixed(2)} 秒・転倒 ${crashed}`)
}
process.exit(fails ? 1 : 0)
