// v52 跳ね板の速さの帯: 板ごとに、入る速さ（板の 8m 手前から決まった速さ・空中は上手い bot の体重）を変えて、どこに着くか（坂に着いた・手前に落ちた・跳びすぎ・転倒）
// node tools/kickband.mjs
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1(), P = c.path
const name = i => { let n = ''; for (const m of c.marks) if (i >= m.i0) n = m.name; return n }
const boards = []; P.forEach((q, i) => { if (q.kind === 'kick' && !q.branch && !boards.some(x => x.m === q.kick.m)) boards.push({ i, m: q.kick.m, q }) })
const speeds = (process.env.V || '3,4,5,6,7,8,9,10,11,12,13').split(',').map(Number)
const rows = []
for (const B of boards) {
  const ji = P.findIndex((q, k) => k > B.i && q.kind === 'jump'), J = P[ji], f = B.m.f
  const land0 = [J.p[0] + f[0] * J.len, J.p[1] + J.dy, J.p[2] + f[2] * J.len] // 坂の上の端
  let li = ji + 1; while (P[li] && P[li].kind === 'landing') li++
  const landEnd = P[li - 1].p, after = P[Math.min(P.length - 1, li + 3)].p
  const row = { 板: name(B.i) + ' ' + B.i }
  for (const v of speeds) {
    let k = B.i, d = 0; while (k > 0 && d < 8) { if (P[k - 1].p) d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- }
    const q = P[k], w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
    const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); b.v = [Math.cos(q.yaw) * v, 0, -Math.sin(q.yaw) * v]
    const bot = createBot(c, { skill: 'good' }); bot.world = w; resetBot(bot, b)
    let res = '？', air = false
    for (let s = 0; s < 60 * 6; s++) {
      let inp = botInput(bot, b); const gnd = b.g[0] || b.g[1]
      if (!air && gnd) inp = { ...inp, thr: b.speed < v - 0.2 ? 1 : 0, brk: b.speed > v + 0.4 ? 0.4 : 0, lean: 0 }
      w.tick(); const ev = []; stepBike(w, b, inp, ev)
      if (ev.some(e => e.t === 'kick')) air = true
      if (air && !b.g[0] && !b.g[1]) air = 'up'
      if (b.crashed) { res = '転倒'; break }
      const al = (b.p[0] - land0[0]) * f[0] + (b.p[2] - land0[2]) * f[2], aEnd = (landEnd[0] - land0[0]) * f[0] + (landEnd[2] - land0[2]) * f[2]
      if (air === 'up' && (b.g[0] || b.g[1])) { if (al < -0.3) { res = '短い'; break }
        res = al > aEnd + 0.5 ? '跳びすぎ' : 'o'; for (let t = 0; t < 60; t++) { w.tick(); stepBike(w, b, { thr: 0.3, brk: 0, lean: 0, steer: 0 }, []); if (b.crashed) { res = (res === 'o' ? '着いて' : res) + '転倒'; break } } break }
      if (b.p[1] < land0[1] - 12) { res = '短い'; break }
      if (false) { res = al > aEnd + 0.5 ? '跳びすぎ' : 'o'; if (res === 'o') { for (let t = 0; t < 60; t++) { w.tick(); stepBike(w, b, { thr: 0.3, brk: 0, lean: 0, steer: 0 }, []); if (b.crashed) { res = '着いて転倒'; break } } } break }
    }
    row[v] = res
  }
  rows.push(row)
}
console.table(rows)
