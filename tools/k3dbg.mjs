// v60 跳ね板の三段登りの 1 回の走りを細かく出す。 POL=good|human|bad|cautious SEED=0 EV=6 node tools/k3dbg.mjs
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1(), m = c.marks.find(x => x.name === '跳ね板の三段登り')
const pol = process.env.POL || 'good', seed = +(process.env.SEED || 0), EV = +(process.env.EV || 6)
const w = new World(c.shapes); w.winds = c.winds; w.setTime(seed * 1.37)
const q = c.path[m.i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
const bot = createBot(c, { skill: pol === 'bad' || pol === 'cautious' ? 'bad' : 'good', react: pol === 'human' ? 12 : 0 }); bot.world = w; resetBot(bot, b)
const f0 = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f0[0] * 3, 0, f0[2] * 3]
const y0 = q.p[1]
for (let s = 0; s < 60 * 30; s++) {
  let inp = botInput(bot, b)
  if (pol === 'cautious') inp = { ...inp, thr: b.speed < 3 ? 1 : 0, brk: b.speed > 4 ? 0.3 : 0, lean: 0 }
  w.tick(); const ev = []; stepBike(w, b, inp, ev)
  for (const e of ev) if (e.t === 'kick') console.log('KICK', s, 'v', e.v.toFixed(2), 'th', (b._k3.th * 57.3).toFixed(1), 'dw', e.k3.toFixed(2))
  if (s % EV === 0) console.log(s, 'i', bot.i, c.path[bot.i].kind, 'y', (b.p[1] - y0).toFixed(2), 'th', (b.th * 57.3).toFixed(0), 'w', b.w.toFixed(1), 'v', b.speed.toFixed(2), 'g', +b.g[0] + '' + +b.g[1], 'in', inp.thr, inp.brk, inp.lean)
  if (b.crashed) { console.log('CRASH', b.crashed.why, s, (b.p[1] - y0).toFixed(2)); break }
  if (b.p[1] < y0 - 3) { console.log('DROP', s); break }
  if (Math.hypot(b.p[0] - m.end[0], b.p[2] - m.end[2]) < 2.2 && Math.abs(b.p[1] - 0.79 - m.end[1]) < 1.5) { console.log('OK', (s * DT).toFixed(1)); break }
}
