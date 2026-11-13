// 自動ハンドルの検査: 全コースを一定の間隔で、アクセルだけ（ふつうの速さ 7m/s を保つ。体重もブレーキも使わない）で 5 秒走らせ、
// 道の端から外れた回数と、壁・柱・縁の石などに横から当たった回数を数える。技が要る所（段・切れ目・ジャンプ台・崩れる板・細い鉄骨）の手前は数えない
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { createSteer, steerFor, resetSteer } from '../js/steer.js'
const V = +(process.env.V || 7), cid = process.argv[2] || 'stage1'
const c = COURSES[cid](), w = new World(c.shapes); w.winds = c.winds || []
const WALL = new Set(['tower', 'pillar', 'parapet', 'post', 'gate', 'rail', 'wall', 'castle', 'barrel', 'statue', 'sign', 'boulder'])
const TECH = new Set(['jump', 'stepUp', 'stepDown', 'lip', 'crumble', 'bump', 'water', 'mud', 'draw', 'lowledge'])
// 時間で動く仕掛け（鉄球・落石・跳ね橋・突風）の近くと、四角い踊り場で直角に曲がる所は、ハンドルの検査から外す（タイミングと速さを見る所）
const nearHz = p => (c.hazards || []).some(h => Math.hypot(h.p[0] - p[0], h.p[2] - p[2]) < h.half + 3 && Math.abs(h.p[1] - p[1]) < 3)
const isPadTurn = (i) => c.path[i] && c.path[i].kind === 'pad' && c.path[i + 1] && c.path[i + 1].yaw !== c.path[i].yaw
let over = 0, runs = 0, off = 0, wall = 0, latSum = 0, latN = 0, latMax = 0; const ex = []
for (let i0 = 0; i0 < c.path.length - 30; i0 += 6) {
  const q = c.path[i0]
  if (!q.p || !q.w || q.w < 1.3 || c.path.slice(Math.max(0, i0 - 2), i0 + 8).some(z => TECH.has(z.kind) || (z.w && z.w < 1.4) || (z.slope || 0) > 0.3)) continue
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = createSteer(c.path); resetSteer(st, b)
  const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], sl = q.slope || 0; b.v = [f[0] * V * Math.cos(sl), V * Math.sin(sl), f[2] * V * Math.cos(sl)]
  w.setTime(0)
  let bad = null, kmax = 0
  for (let s = 0; s < 300 && !bad; s++) {
    const steer = steerFor(st, b)
    stepBike(w, b, { thr: b.speed < V ? 1 : 0, brk: 0, lean: 0, steer })
    const pq = c.path[st.i]
    for (const z of c.path.slice(st.i, st.i + 6)) kmax = Math.max(kmax, Math.abs(z.curv || 0))
    if (c.path.slice(st.i, st.i + 4).some(z => TECH.has(z.kind) || (z.w && z.w < 1.4) || (z.slope || 0) > 0.3) || nearHz(b.p) || [0, 1, 2, 3, 4, 5].some(k => isPadTurn(st.i + k))) break
    if (b.p[1] < pq.p[1] - 1.2) { bad = 'off'; break }
    if (pq.w && pq.kind !== 'uturn' && pq.kind !== 'pad') { const lat = Math.abs(-(b.p[0] - pq.p[0]) * Math.sin(pq.yaw) - (b.p[2] - pq.p[2]) * Math.cos(pq.yaw)); if (s > 30) { latSum += lat; latN++; latMax = Math.max(latMax, lat) } if (lat > pq.w / 2 - 0.05) bad = 'off' }
    for (const sd of b.side) if (sd && sd.depth > 0.004 && WALL.has(c.shapes[sd.id].tag)) bad = 'wall:' + c.shapes[sd.id].tag
    if (b.crashed) bad = 'crash'
  }
  runs++
  // 曲がりの きつさ に対して速すぎた（横の加速度が 6m/s² を超える）時の失敗は、ハンドルのせいにしない
  if (bad && kmax > 0 && V * V * kmax > 6) { over++; bad = null }
  if (bad) { if (bad === 'off') off++; else wall++; if (ex.length < 40) ex.push({ i0, kind: q.kind, at: c.path[st.i].kind, i: st.i, bad, w: q.w, curv: +(q.curv || 0).toFixed(3) }) }
}
console.log(`アクセルだけ ${V}m/s: ${runs} 本 道の端から外れた ${off}・壁などに当たった ${wall}（明らかに速すぎた曲がりでの失敗 ${over} は別）（道の線からのずれ 平均 ${(latSum / latN).toFixed(2)}m・最大 ${latMax.toFixed(2)}m）`)
for (const e of ex) console.log(' ', JSON.stringify(e))
