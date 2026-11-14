// v51 ニトロの坂の登り: 坂（15・25・38 度）の下から 6m/s で入り、全開だけ / 全開＋ニトロで、坂を 20m 登るまでの秒と、登り切った時の速さ
// node tools/nitroclimb.mjs
import { World, createBike, stepBike, DT, makeBox } from '../js/physics.js'
const out = []
for (const deg of [15, 25, 32, 38]) {
  const a = deg * Math.PI / 180, L = 30
  const flat = makeBox({ c: [-20, -0.5, 0], h: [20, 0.5, 4], mat: 'cobble', tag: 'road' })
  const ramp = makeBox({ c: [Math.cos(a) * L / 2 - Math.sin(a) * 0.5, Math.sin(a) * L / 2 - Math.cos(a) * 0.5, 0], h: [L / 2, 0.5, 4], pitch: a, mat: 'cobble', tag: 'road' })
  const row = { 坂: deg + '度' }
  for (const nit of [false, true]) {
    const w = new World([flat, ramp]); w.winds = []
    const b = createBike({ p: [-8, 0.8, 0], yaw: 0 }); for (let k = 0; k < 20; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    b.v = [6, 0, 0]
    let t20 = null, vTop = null
    for (let s = 0; s < 60 * 12; s++) {
      const up = b.p[0] > 0
      stepBike(w, b, { thr: 1, brk: 0, lean: up ? 1 : 0, steer: 0, nitro: nit && up ? 1 : 0 }); if (nit) b.nitro = 1
      const along = b.p[0] / Math.cos(a)
      if (t20 == null && along > 20) { t20 = s * DT; vTop = b.speed }
      if (b.crashed) { row[nit ? 'ニトロ' : '全開'] = '転倒 ' + b.crashed.why; break }
    }
    if (!b.crashed) row[nit ? 'ニトロ' : '全開'] = t20 == null ? '登れない' : `${t20.toFixed(2)}秒 ${vTop.toFixed(1)}m/s`
  }
  out.push(row)
}
console.table(out)
