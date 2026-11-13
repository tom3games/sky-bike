// 道どうしの重なりの検査: 上の道と下の道の間が狭すぎる所（頭が当たる・見た目が詰まる）と、
// 同じ高さで別の区間の道が交わる所（意図しない合流）を数える。node tools/overlap.mjs [stage1|practice]
import { COURSES } from '../js/course.js'
const c = COURSES[process.argv[2] || 'stage1']()
const P = c.path.map((q, i) => ({ ...q, i })).filter(q => q.p && q.w > 0 && q.kind !== 'jump' && !q.branch) // 枝道（近道の着地坂）は、本線と重なるように作ってある
let ng = 0; const ex = []
for (let a = 0; a < P.length; a++) for (let b = a + 1; b < P.length; b++) {
  const A = P[a], Bq = P[b]; if (Bq.i - A.i < 25) continue
  const dx = A.p[0] - Bq.p[0], dz = A.p[2] - Bq.p[2], d = Math.hypot(dx, dz)
  const reach = (Math.min(A.w, 6) + Math.min(Bq.w, 6)) / 2
  if (d > reach) continue
  const dy = Math.abs(A.p[1] - Bq.p[1])
  if (dy < 4.2) { ng++; if (ex.length < 12) ex.push({ a: A.i, b: Bq.i, ka: A.kind, kb: Bq.kind, d: +d.toFixed(1), dy: +dy.toFixed(2), p: A.p.map(v => +v.toFixed(1)) }) }
}
console.log('重なり NG', ng); for (const e of ex) console.log(' ', JSON.stringify(e))
// 道をふさぐ物の検査: 道の線の左右（幅の内側）・路面から 0.15〜0.9m の高さに、縁の石・柱・松明の柱・樽などが入り込んでいないか
import { World, closest } from '../js/physics.js'
{
  const w = new World(c.shapes), BLOCK = new Set(['parapet', 'pillar', 'post', 'barrel', 'statue', 'gate', 'rail', 'sign'])
  let ng2 = 0; const ex2 = []
  for (const q of c.path) {
    if (!q.p || !q.w || q.kind === 'jump' || q.kind === 'uturn' || q.kind === 'pad') continue
    const half = Math.min(q.w, 6) / 2 - 0.45; if (half <= 0) continue
    const rx = Math.sin(q.yaw), rz = Math.cos(q.yaw)
    for (const lat of [-half, 0, half]) for (const up of [0.15, 0.5, 0.9]) {
      const x = q.p[0] + rx * lat, y = q.p[1] + up, z = q.p[2] + rz * lat
      for (const id of w.near(x, y, z, 0.2)) { const s = c.shapes[id]; if (!BLOCK.has(s.tag)) continue; const o = closest(s, x, y, z, { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); if (o.d < 0.05) { ng2++; if (ex2.length < 8) ex2.push({ kind: q.kind, tag: s.tag, p: [x, y, z].map(v => +v.toFixed(1)), lat: +lat.toFixed(2), up }) } }
    }
  }
  console.log('道をふさぐ物 NG', ng2); for (const e of ex2) console.log(' ', JSON.stringify(e))
}
