// ブレーキの効き: 平らな長い道（ふつうの石畳・濡れた石・氷・泥）で、13・8・4 m/s からブレーキだけ（体重は真ん中）で止まるまでの距離と時間。
// あわせて、止まるまでに後輪が浮いた最大の角度（前へ回らないか）
import { World, createBike, stepBike, DT, makeBox } from '../js/physics.js'
const rows = []
for (const [name, mu, mud] of [['ふつうの道', 1.05, 0], ['濡れた石', 0.7, 0], ['氷', 0.4, 0], ['泥', 0.3, 60]]) {
  const sh = makeBox({ c: [0, -0.5, 0], h: [200, 0.5, 6], mat: 'cobble', tag: 'road', mu }); if (mud) sh.mud = mud
  const w = new World([sh]); w.winds = []
  const r = { 路面: name }
  for (const v of [13, 8, 4]) {
    const b = createBike({ p: [-150, 0.8, 0], yaw: 0 }); for (let k = 0; k < 40; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    b.v = [v, 0, 0]; const x0 = b.p[0]; let t = 0, nose = 0, crash = false
    for (let s = 0; s < 60 * 8; s++) { stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 }, []); t += DT; nose = Math.min(nose, b.th); if (b.crashed) crash = true; if (b.speed < 0.15) break }
    r[`${v}m/s`] = `${(b.p[0] - x0).toFixed(1)}m ${t.toFixed(2)}秒 浮き${(-nose * 57.3).toFixed(0)}度${crash ? ' 転倒' : ''}`
  }
  rows.push(r)
}
console.table(rows)
