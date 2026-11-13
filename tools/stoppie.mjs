// 急ブレーキで後輪がどれだけ浮くか（平らな所・速さごと）。ブレーキだけ と 前体重＋ブレーキ（ジャックナイフ）を比べる
import { World, createBike, stepBike, makeBox } from '../js/physics.js'
const w = new World([makeBox({ c: [100, -0.5, 0], h: [200, 0.5, 10] })])
const rows = []
for (const v of [3, 6, 9, 12, 15]) {
  const row = { 速さ: v }
  for (const [nm, lean] of [['ブレーキだけ', 0], ['前体重＋ブレーキ', 1]]) {
    const b = createBike({ p: [0, 0.79, 0], yaw: 0 }); for (let k = 0; k < 30; k++) stepBike(w, b, { thr: 0, brk: 0, lean: 0, steer: 0 })
    b.v = [v, 0, 0]
    let mx = 0, t30 = 0, flip = false
    for (let s = 0; s < 240; s++) { stepBike(w, b, { thr: 0, brk: 1, lean, steer: 0 }); mx = Math.max(mx, -b.th); if (s === 180) t30 = -b.th; if (b.crashed) flip = true }
    row[nm] = `最大 ${(mx * 57.3).toFixed(0)}度・3秒後 ${(t30 * 57.3).toFixed(0)}度` + (flip ? '・転倒' : '')
  }
  rows.push(row)
}
console.table(rows)
