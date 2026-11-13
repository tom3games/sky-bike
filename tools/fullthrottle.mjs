// アクセルを押しっぱなし（V m/s まで。既定 15）で全コースを区間ごとに走らせ、道の端から外れた数と壁に当たった数を区間ごとに数える。
// ゲームと同じ自動ハンドルと、曲がりの手前の自動の減速（steer.js の assist）を通す。
// 数えない所: 技の区間（段・切れ目・ジャンプ台・崩れる板・水・泥・跳ね橋）、時間で動く仕掛けの近く、見極めの場所（q.wide）
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const V = +(process.env.V || 15), cid = process.argv[2] || 'stage1'
const c = COURSES[cid](), w = new World(c.shapes); w.winds = c.winds || []
const WALL = new Set(['tower', 'pillar', 'parapet', 'post', 'gate', 'rail', 'wall', 'castle', 'barrel', 'statue', 'sign', 'boulder'])
const TECH = new Set(['jump', 'stepUp', 'stepDown', 'lip', 'bump', 'draw', 'lowledge', 'trap', 'seesaw', 'lift', 'slide', 'spin']) // 跳ぶ・段・時間で動く物だけ数えない（崩れる板・水・泥・急坂・木箱の上は数える）
const nearHz = p => (c.hazards || []).some(h => Math.hypot(h.p[0] - p[0], h.p[2] - p[2]) < h.half + (h.kind === 'pend' ? 6 : 3) && Math.abs(h.p[1] - p[1]) < 3) // 鉄球は横へ弾き飛ばす範囲まで
const markOf = i => { let n = '出発'; for (const m of c.marks || []) if (i >= m.i0) n = m.name; return n }
const per = {}; let runs = 0, off = 0, wall = 0
// ゴールの門より先（城の前の広場の奥）と、枝道は数えない
const fin = c.cps.find(q => q.finish), finI = fin ? c.path.findIndex(q => q.p && Math.hypot(q.p[0] - fin.p[0], q.p[2] - fin.p[2]) < 1.5 && Math.abs(q.p[1] - fin.p[1]) < 1) : c.path.length
for (let i0 = 0; i0 < finI - 6; i0 += 4) {
  const q = c.path[i0]
  if (!q.p || !q.w || q.w < 1.3 || q.wide || c.path.slice(Math.max(0, i0 - 2), i0 + 8).some(z => TECH.has(z.kind) || z.kind === 'crumble' || z.door || (z.w && z.w < 1.4) || (z.slope || 0) > 0.3)) continue // 崩れる板の上・扉の手前から始めない
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = S.createSteer(c.path); S.resetSteer(st, b)
  b.speed = 8; const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], sl = q.slope || 0, v0 = Math.min(V, 8, S.cornerCap ? S.cornerCap(st, b) : 8); // 始めの速さは、その場で出してよい速さまで b.v = [f[0] * v0 * Math.cos(sl), v0 * Math.sin(sl), f[2] * v0 * Math.cos(sl)]
  w.setTime(0)
  let bad = null
  for (let s = 0; s < 360 && !bad; s++) {
    let inp = { thr: b.speed < V ? 1 : 0, brk: 0, lean: 0, steer: S.steerFor(st, b) }
    if (S.assist && !process.env.NOASSIST) inp = S.assist(st, b, inp)
    stepBike(w, b, inp)
    const pq = c.path[st.i]
    if (st.i >= finI || c.path.slice(st.i, st.i + 4).some(z => TECH.has(z.kind) || z.door || z.wide || (z.w && z.w < 1.4) || (z.slope || 0) > 0.3) || nearHz(b.p)) break
    if (b.p[1] < pq.p[1] - 1.2) { bad = 'off'; break }
    if (pq.w && pq.kind !== 'uturn' && pq.kind !== 'pad') { const lat = Math.abs(-(b.p[0] - pq.p[0]) * Math.sin(pq.yaw) - (b.p[2] - pq.p[2]) * Math.cos(pq.yaw)); if (lat > pq.w / 2 - 0.05) bad = 'off' }
    for (const sd of b.side) if (sd && sd.depth > 0.004 && WALL.has(c.shapes[sd.id].tag)) { bad = 'wall'; if (process.env.EX) console.log('   当たった', c.shapes[sd.id].tag, c.shapes[sd.id].mat, b.p.map(v => v.toFixed(1)).join(',')) }
    if (b.crashed) { bad = 'wall'; if (process.env.EX) console.log('   転倒', b.crashed.why, b.p.map(v => v.toFixed(1)).join(','), 'th', (b.th * 57.3).toFixed(0)) }
  }
  runs++
  const k = markOf(i0); per[k] = per[k] || { 区間: k, 本数: 0, はみ出し: 0, 壁: 0 }; per[k].本数++
  if (bad && process.env.EX) console.log('  例', i0, k, bad, c.path[st.i].kind, st.i, 'w', c.path[st.i].w, 'kap', (c.path[st.i].kap || 0).toFixed(2), 'v', b.speed.toFixed(1))
  if (bad === 'off') { off++; per[k].はみ出し++ } else if (bad) { wall++; per[k].壁++ }
}
console.log(`アクセル押しっぱなし ${V}m/s: ${runs} 本  はみ出し ${off}・壁 ${wall}`)
if (process.env.TABLE) console.table(Object.values(per))
