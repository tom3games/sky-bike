// ウィリーの上がり始め: 後ろ体重＋アクセルを押してから、前輪が浮くまで（2度）と、30度に届くまでの時間。止まった所・5m/s・10m/s
import { World, createBike, stepBike, makeBox } from '../js/physics.js'
const w = new World([makeBox({ c: [200, -0.5, 0], h: [400, 0.5, 10] })])
const rows = []
for (const v of [0, 5, 10]) {
  const b = createBike({ p: [0, 0.79, 0], yaw: 0 }); for (let k = 0; k < 40; k++) stepBike(w, b, { thr: 0, brk: 0, lean: 0, steer: 0 })
  b.v = [v, 0, 0]
  let t2 = null, t30 = null, mx = 0, flip = false, hold = []
  for (let s = 0; s < 240; s++) {
    // 30度に届いたら、保つ操作（角度で体重とアクセルを足し引き）に切り替える
    const th = b.th
    const inp = t30 == null ? { thr: 1, brk: 0, lean: -1, steer: 0 } : { thr: th < 0.5 ? 1 : th < 0.6 ? 0.5 : 0, brk: 0, lean: th > 0.62 ? 1 : th > 0.5 ? 0 : -1, steer: 0 }
    stepBike(w, b, inp)
    if (t2 == null && b.th > 2 / 57.3) t2 = (s + 1) / 60
    if (t30 == null && b.th > 30 / 57.3) t30 = (s + 1) / 60
    mx = Math.max(mx, b.th); if (b.crashed) flip = true
    if (t30 != null && s > t30 * 60 + 30) hold.push(b.th * 57.3)
  }
  rows.push({ 速さ: v, 浮き始め秒: t2 ?? '-', '30度まで秒': t30 ?? '-', 最大度: Math.round(mx * 57.3), '保った角度': hold.length ? `${Math.round(Math.min(...hold))}〜${Math.round(Math.max(...hold))}` : '-', 転倒: flip ? 'あり' : 'なし' })
}
console.table(rows)
