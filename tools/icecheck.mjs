// 落石の後の凍った坂（v31）: 旗「凍った坂の上」から、アクセルだけ（体重なし／前体重）と人の速さ bot で、坂の上（旗「突風の手前」）まで行けるか。
// 止まり続けないか（40 秒以内）。 node tools/icecheck.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { spawnAtCp, judge, doRespawn } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), cp = c.cps.findIndex(q => q.name === '凍った坂の上'), goal = c.cps.findIndex(q => q.name === '突風の手前')
let fails = 0
for (const [nm, mk] of [['アクセルだけ', null], ['アクセル＋前体重', 0.6], ['上手い bot', 'good0'], ['人の速さ bot', 'good12']]) for (const t0 of (process.env.TS ? process.env.TS.split(",").map(Number) : [0, 1.3, 2.6])) {
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(t0); const R = { cp, rest: cp }
  let b = spawnAtCp(w, c, cp), st = S.createSteer(c.path); S.resetSteer(st, b)
  const bot = typeof mk === 'string' ? createBot(c, { skill: 'good', react: +mk.slice(4) }) : null; if (bot) { bot.world = w; resetBot(bot, b) }
  let prev = b.p.slice(), ok = false, sec = 0
  for (let s = 0; s < 60 * 60; s++) { let inp = bot ? botInput(bot, b) : S.assist(st, b, { thr: 1, brk: 0, lean: mk || 0, steer: S.steerFor(st, b) }); w.tick(); stepBike(w, b, inp, []); const j = judge(w, c, R, b, prev); prev = b.p.slice()
    if (j.respawn) { b = doRespawn(w, c, R, j.respawn); if (bot) resetBot(bot, b); else S.resetSteer(st, b) }
    if (R.cp >= goal) { ok = true; sec = s / 60; break } }
  const pass = typeof mk === 'string' ? ok && sec < 40 : true
  if (!pass) fails++
  console.log(pass ? 'ok  ' : 'FAIL', `${nm}（時刻 ${t0}）: 坂の上まで ${ok ? sec.toFixed(1) + ' 秒' : '60 秒で届かない'}`)
}
process.exit(fails ? 1 : 0)
