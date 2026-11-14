// v51 本人「落石の坂、バックし始めるのが遅い」: 9 度の登りを 5m/s で登っている所でブレーキ全開。下がり始める（-0.5m/s）・-3m/s・-6m/s までの秒
// node tools/revstart.mjs
import { World, createBike, stepBike, DT, makeBox } from '../js/physics.js'
const rows = []
for (const deg of [0, 5, 9, 14]) for (const v0 of [2, 5]) {
  const a = deg * Math.PI / 180, L = 80
  const ramp = makeBox({ c: [Math.cos(a) * L / 2 - Math.sin(a) * 0.5 - 40, Math.sin(a) * L / 2 - Math.cos(a) * 0.5, 0], h: [L / 2, 0.5, 4], pitch: a, mat: 'cobble', tag: 'road' })
  const w = new World([ramp]); w.winds = []
  const x0 = 0, b = createBike({ p: [x0 - 40 + Math.cos(a) * 30, Math.sin(a) * 30 + 0.8, 0], yaw: 0 })
  b.th = a; for (let k = 0; k < 30; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
  b.v = [v0 * Math.cos(a), v0 * Math.sin(a), 0]
  for (let k = 0; k < 20; k++) stepBike(w, b, { thr: 1, brk: 0, lean: 0, steer: 0 })
  const T = {}
  for (let s = 0; s < 60 * 6; s++) {
    stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    for (const [k, v] of [['止まる', 0.3], ['下がり始め', -0.5], ['-3', -3], ['-6', -6]]) if (T[k] == null && b.speed < v) T[k] = (s * DT).toFixed(2)
    if (b.crashed) { T.転倒 = b.crashed.why; break }
  }
  rows.push({ 坂: deg, 速さ: v0, ...T })
}
console.table(rows)
