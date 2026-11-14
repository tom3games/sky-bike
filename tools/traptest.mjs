if (process.env.GD1) globalThis.__gD1 = +process.env.GD1
if (process.env.GD2) globalThis.__gD2 = +process.env.GD2
// v36 罠: 40m 手前から走って 25m 先まで抜けられるか（上手い・人の速さ 0.2 秒・0.25 秒・全開だけ）。8 回ずつ（時刻をずらす）
// node tools/traptest.mjs [ONLY=girder,door,oil]
import { World, createBike, stepBike, resetFallen } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle, pathS } from '../js/run.js'
const c = COURSES.stage1(), S = pathS(c)
const POL = { 上手い: { skill: 'good' }, '人の速さ0.2秒': { skill: 'good', react: 12 }, '人0.25秒': { skill: 'good', react: 15 }, 全開だけ: { skill: 'bad', full: true } }
const rows = []
for (const T of c.traps.filter(t => t.kind !== 'press' && (!process.env.ONLY || process.env.ONLY.includes(t.kind)))) {
  let i0 = T.i; while (i0 > 0 && S[T.i] - S[i0] < 34 && !['fork', 'forkRide', 'jump', 'lip', 'hang', 'drum', 'gear', 'lift', 'trap', 'crumble', 'seesaw'].includes(c.path[i0 - 1].kind)) i0-- // 手前の別の仕掛けの先から
  let i1 = T.i; while (i1 < c.path.length - 1 && S[i1] - S[T.i] < 25) i1++
  for (const [name, o] of Object.entries(POL)) {
    const res = {}, tt = []
    for (let seed = 0; seed < 8; seed++) {
      const w = new World(c.shapes); w.winds = c.winds; resetFallen(w); w.setTime(seed * 1.37)
      const q = c.path[i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); const f0 = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f0[0] * 8, 0, f0[2] * 8]
      const bot = createBot(c, { skill: o.skill, react: o.react || 0 }); bot.world = w; resetBot(bot, b)
      let r = '進めない'
      for (let s = 0; s < 60 * 40; s++) {
        let inp = botInput(bot, b); if (o.full) inp = { ...inp, thr: 1, brk: 0, lean: 0, nitro: 0 }
        w.tick(); stepBike(w, b, inp, [])
        if (process.env.DBG === T.kind + (T.T || '') + name && seed === +(process.env.SEED || 0) && s % 15 === 0) console.log(s, 'v', b.speed.toFixed(1), 'i', bot.i, c.path[bot.i].kind, 'in', inp.thr, inp.brk, inp.lean, inp.ab || 0, b.oilSide || '', b.crashed ? b.crashed.why : '')
        if (b.crashed) { r = '転倒 ' + b.crashed.why; break }
        if (b.p[1] < q.p[1] - 4) { r = '落下'; break }
        if (Math.hypot(b.p[0] - c.path[i1].p[0], b.p[2] - c.path[i1].p[2]) < 2.5 && Math.abs(b.p[1] - 0.79 - c.path[i1].p[1]) < 1.6) { r = '抜けた'; tt.push(s / 60); break }
      }
      res[r] = (res[r] || 0) + 1
    }
    rows.push({ 罠: T.kind + (T.T ? T.T + '秒' : '') + ' ' + Math.round(T.i / c.path.findIndex(z => z.branch) * 100) + '%', 方針: name, 結果: Object.entries(res).map(([k, v]) => k + v).join(' '), 平均秒: tt.length ? (tt.reduce((a, b) => a + b, 0) / tt.length).toFixed(1) : '-' })
  }
}
console.table(rows)
