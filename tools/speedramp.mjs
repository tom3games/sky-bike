// 見極めの台: 踏み切りの速さごとに、どこへ降りるか（下の道でもう一周 / 向こうの高い張り出し / 速すぎて地面へ）を表にする
// 踏み切りまで一定の速さを保ち、跳んだ後は上手い bot に任せて、曲がり切れたか（その先の道に乗ったか）まで見る
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { createSteer, steerFor, resetSteer } from '../js/steer.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = c.winds || []
const n = c.notes.find(n => n.kind === 'speedRamp')
const lipI = c.path.findIndex((q, i) => i > n.ru0 && q.kind === 'lip')
const after = c.path.findIndex((q, i) => i > lipI && q.kind === 'curve') + 14 // 曲がった先
const rows = []
const V = process.env.V ? [+process.env.V] : Array.from({ length: 25 }, (_, k) => 6 + k * 0.5)
for (const v of V) {
  const q = c.path[n.ru0 + 2]
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = createSteer(c.path); resetSteer(st, b)
  const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f[0] * v, 0, f[2] * v]
  let phase = 0, land = null, air = 0, bot = null, res = '', vl = 0, dist = 0
  for (let s = 0; s < 60 * 14; s++) {
    let inp
    if (phase === 0) { inp = { thr: b.speed < v ? 1 : 0, brk: b.speed > v + 0.2 ? 0.5 : 0, lean: 0, steer: steerFor(st, b) }; if (!b.g[0] && !b.g[1]) { phase = 1; vl = b.speed } }
    else if (phase === 1) { inp = { thr: 0, brk: 0, lean: b.th > 0.05 ? 0.6 : b.th < -0.25 ? -0.6 : 0, steer: 0 }; if (b.g[0] || b.g[1]) { phase = 2; const sh = c.shapes[(b.cn[0] || b.cn[1]).id]; land = { y: b.p[1], tag: sh.tag }; dist = Math.hypot(b.p[0] - n.lip[0], b.p[2] - n.lip[2]); bot = createBot(c, { skill: 'good' }); bot.world = w; resetBot(bot, b) } }
    else inp = botInput(bot, b)
    const ev = []; stepBike(w, b, inp, ev)
    if (phase === 1 && b.crashed) { land = { tag: 'edge' }; res = '角に当たって転び、下の道へ'; break }
    if (phase === 2) {
      if (b.p[1] < 1.6) { res = '地面に落ちた'; break }
      if (st.i > after && Math.abs(b.p[1] - 0.79 - c.path[after].p[1]) < 1) { res = '曲がり切った'; break }
      if (b.p[1] < n.yL + 1.5 && Math.abs(b.p[1] - 0.79 - n.yL) < 0.6) { res = 'もう一周'; break }
    }
    steerFor(st, b)
    if (process.env.DBG && s % 15 === 0) console.log(s, phase, b.p.map(v => v.toFixed(1)).join(','), b.speed.toFixed(1), 'th', (b.th * 57.3).toFixed(0), +b.g[0] + '' + +b.g[1], st.i, bot && bot.phase, JSON.stringify(inp), bot && bot.i, bot && bot.backT, bot && bot.stuckT)
  }
  const where = !land ? '-' : land.tag === 'edge' ? '張り出しの角' : land.tag === 'ground' ? '地面' : Math.abs(land.y - 0.79 - n.yL) < 1 ? '下の道' : land.y - 0.79 > n.yU - 1 ? '高い張り出し' : '途中'
  rows.push({ 助走の速さ: v, 踏み切りの速さ: +vl.toFixed(1), 着地: where, 距離m: +dist.toFixed(1), その後: res || '-' })
}
console.table(rows)
