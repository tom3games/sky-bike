import { World, createBike, stepBike } from '../js/physics.js'
import { Builder } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
const verbose = process.env.V
let ok = 0, tot = 0
for (const H of [0.2, 0.3, 0.36, 0.45, 0.5, 0.56]) for (const v0 of [2, 5, 9]) {
  const B = new Builder([0, 1, 0], 0); B.solid = true; B.base = -2
  B.road(20, { w: 4 }); B.step(H); B.road(6, { w: 4, noOverlap: true }); B.step(H); B.road(20, { w: 4, noOverlap: true })
  const w = new World(B.shapes), bot = createBot({ path: B.path }, { skill: 'good' })
  const b = createBike({ p: [2, 1.8, 0], yaw: 0 }); b.v[0] = v0; b.speed = v0
  for (let k = 0; k < 10; k++) stepBike(w, b, { thr: 0, brk: 0, lean: 0, steer: 0 })
  resetBot(bot, b)
  let s = 0, res = 'stuck'
  for (; s < 900; s++) { const inp = botInput(bot, b); stepBike(w, b, inp); if (verbose && s % 6 === 0) console.log(s, b.p.map(v => v.toFixed(2)).join(','), 'th', (b.th * 57.3).toFixed(0), 'v', b.speed.toFixed(1), 'ph', bot.phase, inp.thr, inp.brk, inp.lean); if (b.crashed) { res = 'crash:' + b.crashed.why; break } if (b.p[0] > 40) { res = 'ok'; break } }
  tot++; if (res === 'ok') ok++
  console.log('H', H, 'v0', v0, res, (s / 60).toFixed(1) + 's')
}
console.log('ok', ok, '/', tot)
