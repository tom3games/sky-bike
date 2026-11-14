// v51 新しい罠の検査: レーザーの床（ふつうに走ると突き上げられて転ぶ・ウィリーで抜ける）と、爆発で消える床（全開だけでは落ちる・ニトロで届く）
// それぞれ 20m 手前から、決まった走り方と bot で走らせて、抜けたか・転んだか・落ちたかを数える。 node tools/v51traps.mjs
import { World, createBike, stepBike, DT, basis, wheelCenter } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path
const name = i => { let n = ''; for (const m of c.marks) if (i >= m.i0) n = m.name; return n }
const items = [...c.v51.lasers.map(x => ({ ...x, type: 'laser' })), ...c.v51.blasts.map(x => ({ ...x, type: 'blast' }))].filter(x => !process.env.ONLY || process.env.ONLY.split(',').includes(x.type))
const modes = { laser: ['ふつうに全開', 'ふつうに 6m/s', '上手い bot', '人の速さ bot'], blast: ['全開だけ', '全開＋ニトロ', '上手い bot', '人の速さ bot'] }
const rows = []
for (const it of items) {
  const row = { 罠: it.type === 'laser' ? 'レーザー' : '爆発', 番号: it.k, 区間: name(it.i) }
  for (const mode of modes[it.type]) {
    let ok = 0, why = {}
    for (let seed = 0; seed < (mode.includes('bot') ? 4 : 1); seed++) {
      let k = it.i, d = 0; while (k > 0 && d < 20) { if (P[k - 1].p) d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k--; if (['jump', 'lip', 'stepUp', 'hang'].includes(P[k].kind) && d > 6) { k++; break } }
      const q = P[k], w = new World(c.shapes); w.winds = c.winds || []; w.setTime(seed * 1.37)
      const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); { const v0 = mode.includes('6m') ? 6 : 8; b.v = [Math.cos(q.yaw) * v0, 0, -Math.sin(q.yaw) * v0] }
      const st = S.createSteer(P); S.resetSteer(st, b)
      const bot = mode.includes('bot') ? createBot(c, { skill: 'good', react: mode.includes('人') ? 12 : 0 }) : null; if (bot) { bot.world = w; resetBot(bot, b) }
      const endI = Math.min(P.length - 1, it.i + 18), end = P[endI].p; let res = '進めない'
      for (let s = 0; s < 60 * 10; s++) {
        let inp
        if (bot) inp = botInput(bot, b)
        else { const thr = mode.includes('6m') ? (b.speed < 6 ? 1 : 0) : 1; inp = S.assist(st, b, { thr, brk: 0, lean: 0, steer: S.steerFor(st, b), nitro: mode.includes('ニトロ') ? 1 : 0 }); if (mode.includes('ニトロ') && s === 0) b.nitro = 1 }
        w.tick(); stepBike(w, b, inp, [])
        if (b.crashed) { res = '転倒 ' + b.crashed.why; break }
        if (b.p[1] < q.p[1] - 6) { res = '落下'; break }
        if (Math.hypot(b.p[0] - end[0], b.p[2] - end[2]) < 2.2 && Math.abs(b.p[1] - 0.79 - end[1]) < 1.5 && (b.g[0] || b.g[1]) && Math.abs(b.th) < 1.0) { res = 'o'; break }
      }
      if (res === 'o') ok++; else why[res] = (why[res] || 0) + 1
      if (!mode.includes('bot')) { row[mode] = res; ok = -1 }
    }
    if (ok >= 0) row[mode] = `${ok}/4` + (Object.keys(why).length ? ' ' + Object.entries(why).map(([a, n]) => a + n).join(' ') : '')
  }
  rows.push(row)
}
console.table(rows)
