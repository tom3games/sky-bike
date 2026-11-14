// 崩れる板（v31）: 全部の崩れる板の区間を、全開・ニトロ・上手い bot・人の速さ bot で通し、乗った板が全部反応したか（乗った瞬間の合図・その後に崩れ落ちる）。
// 渡り切れたか（速さで抜けるのが正解）も数える。 node tools/crumbletest.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path
const segs = []; for (let i = 1; i < P.length; i++) if (P[i].kind === 'crumble' && P[i - 1].kind !== 'crumble' && !P[i].branch) { let j = i; while (P[j + 1] && P[j + 1].kind === 'crumble') j++; segs.push([i, j]) }
const name = i => { let n = ''; for (const m of c.marks) if (i >= m.i0) n = m.name; return n }
const tot = {}
for (const [i0, i1] of segs) {
  const row = []
  for (const mode of ['全開', 'ニトロ', '上手い bot', '人の速さ bot']) {
    const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
    let k = i0, d = 0; while (k > 0 && d < 18) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k--; if (['jump', 'stepUp', 'lip', 'crumble'].includes(P[k].kind) && d > 6) break }
    const q = P[k], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); b.v = [Math.cos(q.yaw) * 6, 0, -Math.sin(q.yaw) * 6]
    const st = S.createSteer(P); S.resetSteer(st, b); const bot = mode.includes('bot') ? createBot(c, { skill: 'good', react: mode.includes('人') ? 12 : 0 }) : null; if (bot) { bot.world = w; resetBot(bot, b) }
    const touched = new Set(), fell = new Set(), endP = P[Math.min(P.length - 1, i1 + 6)].p; let across = false
    for (let s = 0; s < 60 * 15; s++) { let inp = bot ? botInput(bot, b) : S.assist(st, b, { thr: 1, brk: 0, lean: 0, steer: S.steerFor(st, b), nitro: mode === 'ニトロ' ? 1 : 0 }); if (mode === 'ニトロ') { inp.nitro = 1; inp.thr = 1; b.nitro = 1 }
      const ev = []; w.tick(); stepBike(w, b, inp, ev)
      for (const e of ev) { if (e.t === 'crumbleTouch') touched.add(e.id); if (e.t === 'crumble') fell.add(e.id) }
      if (Math.hypot(b.p[0] - endP[0], b.p[2] - endP[2]) < 2 && Math.abs(b.p[1] - 0.79 - endP[1]) < 1.5) { across = true; for (let t = 0; t < 60; t++) { const ev2 = []; w.tick(); stepBike(w, b, inp, ev2); for (const e of ev2) if (e.t === 'crumble') fell.add(e.id) } break }
      if (b.crashed || b.p[1] < endP[1] - 8) break }
    const reacted = [...touched].filter(id => fell.has(id)).length
    tot[mode] = tot[mode] || [0, 0, 0, 0]; tot[mode][0] += touched.size; tot[mode][1] += reacted; tot[mode][2]++; if (across) tot[mode][3]++
    row.push(`${mode}: 乗った ${touched.size}・崩れた ${reacted}・${across ? '渡れた' : '落ちた/転んだ'}`)
  }
  console.log(name(i0), '|', row.join(' | '))
}
for (const [m, [t, r, n, a]] of Object.entries(tot)) console.log(`${m}: 乗った板 ${t} 枚のうち反応して崩れた ${r} 枚（${t ? Math.round(r / t * 100) : 0}%）・渡れた区間 ${a}/${n}`)
