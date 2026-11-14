// ニトロの最高速度（v31 20→21m/s）に関わる所: 41度のニトロの坂を登れるか・ニトロの最高速度からの急ブレーキ（ゆっくり前へ転ぶ秒数）
// node tools/nitro21.mjs
import { World, createBike, stepBike, makeBox, BIKE } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
console.log('nitroTop', BIKE.nitroTop)
const c = COURSES.stage1(), P = c.path, w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
const si = P.findIndex(q => q.kind === 'steep' && Math.abs((q.slope || 0) - 41 * Math.PI / 180) < 0.01)
let ok = 0, n = 0
for (const back of [6, 9, 12, 15]) for (const lean of [0, 0.5, 1]) {
  let i = si, d = 0; while (d < back && i > 0) { d += Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[2] - P[i - 1].p[2]); i-- }
  const q = P[i], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); const st = S.createSteer(P); S.resetSteer(st, b)
  const top = P[si + 10].p[1]; let up = false
  for (let s = 0; s < 60 * 8; s++) { let inp = S.assist(st, b, { thr: 1, brk: 0, lean, steer: S.steerFor(st, b), nitro: 1 }); inp.nitro = 1; inp.thr = 1; stepBike(w, b, inp, []); if (b.crashed) break; if (b.p[1] > top + 0.5 && (b.g[0] || b.g[1])) { up = true; break } }
  n++; if (up) ok++
}
console.log(`41度のニトロの坂: 助走 6〜15m × 体重 3 通り → 登れた ${ok}/${n}`)
// 平らな道で、ニトロの最高速度から急ブレーキ（ブレーキ全開を押し続ける）。前へ転ぶまでの秒数
{ const w2 = new World([makeBox({ c: [0, -0.5, 0], h: [600, 0.5, 6], mat: 'cobble', tag: 'road' })]); w2.winds = []
  const b = settle(w2, createBike({ p: [-550, 0.79, 0], yaw: 0 })); let v = 0
  for (let s = 0; s < 60 * 20; s++) { stepBike(w2, b, { thr: 1, brk: 0, lean: 0, steer: 0, nitro: s % 300 < 290 ? 1 : 0 }, []); b.nitro = 1 }
  v = b.speed; let t = null
  for (let s = 0; s < 60 * 6; s++) { stepBike(w2, b, { thr: 0, brk: 1, lean: 0, steer: 0 }, []); if (b.crashed) { t = s / 60; break } }
  console.log(`ニトロの最高速度 ${v.toFixed(1)}m/s から急ブレーキ: ${t == null ? '6 秒転ばない' : t.toFixed(2) + ' 秒で ' + (b.crashed.why)}`) }
