// 止まった所から前体重＋ブレーキで前輪立ち（約 33 度で保つ）か（v32）。平らな所・下り 5 度・登り 10 度。 node tools/standfront.mjs
import { World, createBike, stepBike, makeBox } from '../js/physics.js'
import { settle } from '../js/run.js'
let fails = 0
for (const brk of [1, 0]) for (const [nm0, deg] of [['平ら', 0], ['下り 5度', -5], ['登り 6度', 6], ['登り 10度', 10], ['登り 24度', 24]]) { const nm = nm0 + (brk ? '・前体重＋ブレーキ' : '・前体重だけ')
  const a = deg * Math.PI / 180, w = new World([makeBox({ c: [0, -0.5, 0], h: [60, 0.5, 6], pitch: a })]); w.winds = []
  const b = settle(w, createBike({ p: [0, 0.79 + 0, 0], yaw: 0 }))
  let mx = -9, end = 0, back = 0; const x0 = b.p[0]
  for (let s = 0; s < 60 * 4; s++) { stepBike(w, b, { thr: 0, brk, lean: 1, steer: 0 }, []); mx = Math.max(mx, -b.th * 57.3); back = Math.max(back, x0 - b.p[0]) }
  end = -b.th * 57.3 + deg // 地面に対する角度
  const ok = deg > 20 ? !b.crashed /* 24 度の台の上ではブレーキでも下がる（後輪は止めていない）。転ばないことだけ */ : deg > 8 ? !b.crashed : (end > (brk ? 26 : 18) && end < (brk ? 45 : 33) && !b.crashed && back < 0.5)
  if (!ok) fails++
  console.log(ok ? 'ok  ' : 'FAIL', `${nm} 4 秒 → 前へ最大 ${mx.toFixed(0)} 度・4 秒後 地面に対して ${end.toFixed(0)} 度・下がった ${back.toFixed(2)}m・転倒 ${!!b.crashed}`)
}
process.exit(fails ? 1 : 0)
