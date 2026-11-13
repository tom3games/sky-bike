// 頭の上の空き: 道の点ごとに、乗り手の頭の高さ（道から 1.95m・半径 0.28m）に当たる物がないか。上の周の飾り・梁・屋根が下の道に掛かっていないか
import { World } from '../js/physics.js'
import { COURSES } from '../js/course.js'
const c = COURSES.stage1(), w = new World(c.shapes), hits = {}
let n = 0
c.path.forEach((q, i) => {
  if (!q.p || !q.w || q.branch || q.kind === 'jump') return
  const y = q.p[1] + 1.95, ids = w.near(q.p[0], y, q.p[2], 0.6)
  const con = w.sphere(q.p[0], y, q.p[2], 0.28, ids)
  if (con && con.depth > 0.02) { const s = w.shapes[con.id]; if (s.mov && s.mov.type === 'pend') return; n++; const k = s.tag + ':' + s.type; hits[k] = hits[k] || []; if (hits[k].length < 5) hits[k].push(i + '(' + q.zone + ')') }
})
console.log('頭が当たる道の点', n); for (const k in hits) console.log(' ', k, hits[k].join(' '))
