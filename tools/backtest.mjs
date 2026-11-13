// バックの検査: 全コースの各所で止まる → ブレーキ押しっぱなしで 3.5 秒（0.45 秒たつと下がり始める）。
// 自動ハンドルのまま、道の中心からのずれの最大と、道から落ちた回数を数える
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const cid = process.argv[2] || 'stage1', c = COURSES[cid](), w = new World(c.shapes); w.winds = []
const SKIP = new Set(['jump', 'stepUp', 'stepDown', 'lip', 'crumble', 'bump', 'water', 'draw', 'uturn', 'pad', 'trap', 'seesaw', 'lift', 'slide', 'spin', 'steep', 'crate', 'mud'])
const nearHz = p => (c.hazards || []).some(h => Math.hypot(h.p[0] - p[0], h.p[2] - p[2]) < h.half + 10 && Math.abs(h.p[1] - p[1]) < 3) // 時間で動く仕掛けの近く（下がる 10m の内）は除く
let runs = 0, off = 0, maxDev = 0, devSum = 0; const ex = []
for (let i0 = 12; i0 < c.path.length - 4; i0 += 5) {
  const q = c.path[i0]
  // 後ろ 8 点が、段・切れ目のない道の時だけ（段の下へ下がるのは別の話）
  if (!q.p || !q.w || q.w < 1.3 || nearHz(q.p) || c.path.slice(i0 - 10, i0 + 1).some(z => !z.branch !== !q.branch) || c.path.slice(i0 - 13, i0 + 1).some(z => !z.p || !z.w || SKIP.has(z.kind) || (z.slope || 0) > 0.2 || z.w < 1.3)) continue
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = S.createSteer(c.path); S.resetSteer(st, b)
  let dev = 0, bad = null
  for (let s = 0; s < 210 && !bad; s++) {
    stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: S.steerFor(st, b) })
    const pq = c.path[st.i]
    if (!pq.p) continue
    if (b.p[1] < pq.p[1] - 1.2) bad = 'off'
    const lat = Math.abs(-(b.p[0] - pq.p[0]) * Math.sin(pq.yaw) - (b.p[2] - pq.p[2]) * Math.cos(pq.yaw))
    if (pq.w && pq.kind !== 'uturn' && pq.kind !== 'pad') { dev = Math.max(dev, lat); if (lat > pq.w / 2 - 0.05) bad = 'off' }
    if (st.i < i0 - 9) break
  }
  runs++; if (dev > maxDev && process.env.EX) console.log("  最大を更新", i0, q.kind, dev.toFixed(2)); maxDev = Math.max(maxDev, dev); devSum += dev
  if (bad) { off++; if (ex.length < 8) ex.push({ i0, kind: q.kind, w: q.w, dev: +dev.toFixed(2) }) }
}
console.log(`バック 3.5 秒: ${runs} 本  道から外れた ${off}・道の中心からのずれ 最大 ${maxDev.toFixed(2)}m・平均 ${(devSum / runs).toFixed(2)}m`)
for (const e of ex) console.log(' ', JSON.stringify(e))
