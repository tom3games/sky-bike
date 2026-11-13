// 何も起きない平らな道が長く続く所を数える（上手い bot の平らな道での速さ 6m/s で 10 秒 = 60m 以上）
import { COURSES } from '../js/course.js'
const c = COURSES.stage1(), LIM = +(process.env.LIM || 60)
const PLAIN = new Set(['road', 'orbit', 'curve', 'bridge', 'runway'])
const nearHz = p => (c.hazards || []).some(h => Math.hypot(h.p[0] - p[0], h.p[2] - p[2]) < 4 && Math.abs(h.p[1] - p[1]) < 3)
const runs = []; let len = 0, start = 0
for (let i = 1; i < c.path.length; i++) {
  const q = c.path[i], a = c.path[i - 1]
  if (q.branch) break
  const plain = q.p && a.p && PLAIN.has(q.kind) && Math.abs(q.slope || 0) < 0.087 && !q.door && !nearHz(q.p) && !c.tuts.some(t => Math.abs(t.i - i) < 3)
  if (plain) { if (!len) start = i; len += Math.hypot(q.p[0] - a.p[0], q.p[2] - a.p[2]) }
  else { if (len >= LIM) runs.push({ i: start, m: Math.round(len), zone: c.path[start].zone }); len = 0 }
}
console.log(`平らで何も起きない道が ${LIM}m 以上続く所: ${runs.length}`); for (const r of runs.slice(0, 12)) console.log(' ', JSON.stringify(r))
