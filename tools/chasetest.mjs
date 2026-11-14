// v36 猿の追いかけ: 追われ始める前の旗から走り、逃げ切れるか（上手い・人の速さ 0.2 秒・0.25 秒・アクセルだけ）。node tools/chasetest.mjs
if (process.env.T1) globalThis.__chT1 = +process.env.T1
if (process.env.D1) globalThis.__chD1 = +process.env.D1
if (process.env.V1) globalThis.__chV1 = +process.env.V1
import { World, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { spawnAtCp, spawnAt, judge, doRespawn, pathS } from '../js/run.js'
const c = COURSES.stage1(), S = pathS(c)
const cpI = q => { let bi = 0, bd = 1e9; c.path.forEach((z, i) => { if (!z.p || z.branch) return; const d = Math.hypot(z.p[0] - q.p[0], z.p[1] - q.p[1], z.p[2] - q.p[2]); if (d < bd) { bd = d; bi = i } }); return bi }
const POL = { 上手い: { skill: 'good' }, '人の速さ0.2秒': { skill: 'good', react: 12 }, '人0.25秒': { skill: 'good', react: 15 }, 'アクセルだけ': { thr: true } }
const rows = []
for (const [k, C] of c.chases.entries()) {
  if (process.env.ONLY1 && k) continue
  let ci = 0; c.cps.forEach((q, j) => { if (q.rest && cpI(q) < C.i0) ci = j })
  for (const [name, o] of Object.entries(POL)) {
    const res = {}
    for (let seed = 0; seed < 8; seed++) {
      const w = new World(c.shapes); w.winds = c.winds; w.setTime(seed * 1.37)
      const R = { cp: ci, rest: ci }; const q0 = c.path[C.i0 - +(process.env.BACK || 6)]; let b = spawnAt(w, { p: q0.p, yaw: q0.yaw }); { const hx = Math.cos(q0.yaw), hz = -Math.sin(q0.yaw); b.v = [hx * 9, 0, hz * 9] }
      const bot = createBot(c, { skill: o.skill || 'bad', react: o.react || 0 }); bot.world = w; resetBot(bot, b)
      let r = '進めない', minGap = 99, t0 = null
      for (let s = 0; s < 60 * 90; s++) {
        let inp = botInput(bot, b)
        if (o.thr) inp = { ...inp, thr: 1, brk: 0, lean: 0, nitro: 0 }
        w.tick(); stepBike(w, b, inp, [])
        const j = judge(w, process.env.NOCHASE ? { ...c, chases: [] } : c, R, b, b.p)
        if (process.env.NOCHASE && bot.i >= C.i1) { r = '着いた'; break }
        const st = R.ch && R.ch[k]
        if (st && st.ph === 'run') { minGap = Math.min(minGap, S[st.bi] - st.sm); if (t0 == null) t0 = s }
        if (process.env.DBG && seed === 0 && name === process.env.DBG && (s % 20 === 0 || (st && st.lost && !st._p && (st._p = 1)))) console.log(k, s, 'v', b.speed.toFixed(1), 'nit', b.nitro.toFixed(2), b.nitroOn ? 'ON' : '', 'in', inp.thr, inp.brk, inp.ab || 0, inp.nitro || 0, 'i', bot.i, c.path[bot.i].kind, st ? st.ph + (st.lost ? ' LOST' : '') + ' air ' + (st.airT || 0).toFixed(2) + ' gap ' + (S[st.bi] - (st.sm ?? 0)).toFixed(1) : '')
        if (st && st.ph === 'done') { r = '逃げ切り'; break }
        if (st && st.ph === 'caught') { r = '追いつかれた'; break }
        if (j.respawn) { r = '転倒/落下(' + (b.crashed ? b.crashed.why : 'fell') + ')'; break }
      }
      res[r] = (res[r] || 0) + 1; res.minGap = Math.min(res.minGap ?? 99, +minGap.toFixed(1))
    }
    rows.push({ 場所: k + 1, 方針: name, ...res })
  }
}
console.table(rows)
