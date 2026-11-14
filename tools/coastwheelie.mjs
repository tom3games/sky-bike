// v36 惰性で転がっている時の、後ろ体重だけのウィリー・前体重だけの前輪立ち（平らな地面）。node tools/coastwheelie.mjs
import { makeBox, World, createBike, stepBike } from '../js/physics.js'
const w = new World([makeBox({ c: [100, -0.5, 0], h: [200, 0.5, 10] })])
const rows = []
for (const v0 of [0, 0.5, 1, 2, 3, 4]) for (const lean of [-1, 1]) {
  const b = createBike({ p: [0, 0.79, 0], yaw: 0 }); for (let k = 0; k < 30; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
  b.v = [v0, 0, 0]; b.speed = v0
  let maxA = 0, t20 = null, t10 = null
  for (let s = 0; s < 180; s++) { stepBike(w, b, { thr: 0, brk: 0, lean, steer: 0 }); const a = b.th * 57.3 * -Math.sign(lean) * -1; const ang = lean < 0 ? b.th * 57.3 : -b.th * 57.3; if (ang > maxA) maxA = ang; if (t10 == null && ang > 10) t10 = s / 60; if (t20 == null && ang > 20) t20 = s / 60; if (b.crashed) break }
  rows.push({ 惰性: v0 + 'm/s', 体重: lean < 0 ? '後ろだけ' : '前だけ', 最大角度: maxA.toFixed(0) + '度', '10度まで秒': t10 == null ? '-' : t10.toFixed(2), '20度まで秒': t20 == null ? '-' : t20.toFixed(2), 転倒: b.crashed ? b.crashed.why : '', 終わりの速さ: b.speed.toFixed(1) })
}
console.table(rows)
