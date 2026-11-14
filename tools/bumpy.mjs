// v36 出発の大ジャンプの着地の先〜低い段の練習の手前（丸太と小さい段）: 人の速さ・0.25 秒遅れ・全開だけで、どこで転ぶ・止まるか。node tools/bumpy.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1(), P = c.path
const i0 = P.findIndex((q, i) => i > 20 && q.kind === 'stepUp' && Math.abs(q.dy - 0.75) < 0.01) + 2, i1 = c.marks.find(m => m.name === '低い段の練習').i0
const end = P[i1].p
const POL = { 上手い: { skill: 'good' }, '人の速さ0.2秒': { skill: 'good', react: 12 }, '人0.25秒': { skill: 'good', react: 15 }, 全開だけ: { skill: 'bad', full: true } }
const rows = [], where = {}
for (const [name, o] of Object.entries(POL)) { const res = {}
  for (let seed = 0; seed < 8; seed++) {
    const w = new World(c.shapes); w.winds = c.winds; w.setTime(seed * 1.37)
    const q = P[i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); b.v = [Math.cos(q.yaw) * (6 + seed * 0.5), 0, -Math.sin(q.yaw) * (6 + seed * 0.5)]
    const bot = createBot(c, { skill: o.skill, react: o.react || 0 }); bot.world = w; resetBot(bot, b)
    let r = '進めない', stop = 0
    for (let s = 0; s < 60 * 40; s++) { let inp = botInput(bot, b); if (o.full) inp = { ...inp, thr: 1, brk: 0, lean: 0 }; w.tick(); stepBike(w, b, inp, [])
      if (process.env.DBG === name && seed === +(process.env.SEED || 0) && s % +(process.env.EV || 15) === 0) console.log(s, 'i', bot.i, P[bot.i].kind, 'v', b.speed.toFixed(1), 'th', (b.th * 57.3).toFixed(0), 'g', +b.g[0] + '' + +b.g[1], 'in', inp.thr, inp.brk, inp.lean, 'ph', bot.phase, 'n0', b.cn[0] ? c.shapes[b.cn[0].id].tag + ' ' + (b.cn[0].nw || b.cn[0].n).map(v => v.toFixed(2)).join(',') : '-', 'n1', b.cn[1] ? c.shapes[b.cn[1].id].tag + ' ' + (b.cn[1].nw || b.cn[1].n).map(v => v.toFixed(2)).join(',') : '-')
      if (b.crashed) { r = '転倒'; const k = name + ' 転倒 i' + bot.i + ' ' + P[bot.i].kind; where[k] = (where[k] || 0) + 1; break }
      if (Math.abs(b.speed) < 0.3) stop++; else stop = 0
      if (stop === 120) { const k = name + ' 止まる i' + bot.i + ' ' + P[bot.i].kind; where[k] = (where[k] || 0) + 1 }
      if (Math.hypot(b.p[0] - end[0], b.p[2] - end[2]) < 2.5) { r = '抜けた'; break } }
    res[r] = (res[r] || 0) + 1 }
  rows.push({ 方針: name, ...res }) }
console.log('区間 道の点', i0, '〜', i1); console.table(rows); console.log(where)
