// 道の外へ落ちた時、下の道や足場に着地できるか: コースの各所で、横へ押し出して（左右）落とし、着いた先を数える
// 足場 = 道・広場など（そこから登り直せる）／地面 = 塔の根もとの地面（旗へ戻る）／奈落 = 溶岩・谷底（旗へ戻る）
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = []
const cnt = { 足場: 0, 地面: 0, 奈落: 0, 着いたが転んだ: 0 }, byZone = {}
let runs = 0
for (let i = 20; i < c.path.length; i += 9) {
  const q = c.path[i]
  if (!q.p || !q.w || q.branch || ['jump', 'lip', 'uturn', 'pad'].includes(q.kind)) continue
  for (const sg of [-1, 1]) {
    const R = [Math.sin(q.yaw), 0, Math.cos(q.yaw)], f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]
    // 押し出す所: 道の端の外で、すぐ下（1.5m 以内）に何もない所（一段低い縁があれば、その外）
    let off = q.w / 2 + 0.9
    for (let k = 0; k < 12; k++) { const x = q.p[0] + R[0] * sg * off, z = q.p[2] + R[2] * sg * off, r = w.rayDown(x, z, q.p[1] + 0.5, q.p[1] - 1.5); if (!isFinite(r.y) || r.y < q.p[1] - 1.5) break; off += 0.5 }
    const b = createBike({ p: [q.p[0] + R[0] * sg * off, q.p[1] + 1.2, q.p[2] + R[2] * sg * off], yaw: q.yaw })
    b.v = [R[0] * sg * 1.2 + f[0] * 3, 0, R[2] * sg * 1.2 + f[2] * 3] // 横へ 1.2m/s（滑って落ちる速さ）
    let res = null, air = 0
    for (let s = 0; s < 60 * 10 && !res; s++) {
      stepBike(w, b, { thr: 0, brk: 0, lean: 0, steer: 0 })
      if (b.p[1] < (c.lavaKill ?? -50)) res = '奈落'
      else if (b.g[0] || b.g[1]) {
        const tag = c.shapes[(b.cn[0] || b.cn[1]).id].tag
        if (s > 3) res = tag === 'ground' ? '地面' : b.crashed ? '着いたが転んだ' : '足場'
      } else if (b.crashed) { // 人が先に当たった
        const k = (b.cn[0] || b.cn[1]) ? c.shapes[(b.cn[0] || b.cn[1]).id].tag : null
        if (s > 20) res = k === 'ground' ? '地面' : '着いたが転んだ'
      }
    }
    if (!res) res = '奈落'
    runs++; cnt[res]++; const z = q.zone || '-'; byZone[z] = byZone[z] || { 足場: 0, 地面: 0, 奈落: 0, 着いたが転んだ: 0 }; byZone[z][res]++
  }
}
console.log(`道の外へ押し出して落とした ${runs} 回: ` + Object.entries(cnt).map(([k, v]) => `${k} ${v}（${Math.round(v / runs * 100)}%）`).join('・'))
if (process.env.TABLE) console.table(byZone)
