import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
const [cid='practice', skill='good', from=0, to=400, every=6, cpi=0] = process.argv.slice(2)
const c = COURSES[cid](), w = new World(c.shapes), bot = createBot(c, { skill })
const q = c.cps[+cpi]; const b = createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 20; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); resetBot(bot, b)
for (let s = 0; s < +to; s++) {
  const inp = botInput(bot, b); const ev = []; stepBike(w, b, inp, ev)
  if (s >= +from && (s % +every === 0 || ev.length)) console.log(s, 'x', b.p.map(v => v.toFixed(2)).join(','), 'th', (b.th * 57.3).toFixed(0), 'w', b.w.toFixed(2), 'v', b.speed.toFixed(1), 'g', +b.g[0] + '' + +b.g[1], 's', b.s.map(v => v.toFixed(2)).join(','), 'in', inp.thr, inp.brk, inp.lean, inp.steer, 'ph', bot.phase, ev.map(e => e.t + ':' + (e.why || '')).join(' '), (b.cn[0] ? 'n0 ' + b.cn[0].nw.map(v=>v.toFixed(2)) + ' id' + b.cn[0].id : '') + (b.cn[1] ? ' n1 ' + b.cn[1].nw.map(v=>v.toFixed(2)) + ' id' + b.cn[1].id : ''))
  if (b.crashed) break
}
