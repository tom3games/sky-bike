// v51 ニトロの急坂: 坂の 20m 手前から全開（坂では前体重）で、ニトロなし / ニトロありで登り切れるか。node tools/nitroslopes.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, rows = []
const name = i => { let n = ''; for (const m of c.marks) if (i >= m.i0) n = m.name; return n }
for (let i = 1; i < P.length; i++) { if (!(P[i].kind === 'steep' && P[i - 1].kind !== 'steep') || P[i].branch) continue
  let j = i; while (P[j + 1] && P[j + 1].kind === 'steep') j++
  if (process.env.SLICK && !P[i].slick) continue
  const top = P[Math.min(P.length - 1, j + 3)].p, row = { 区間: name(i), 坂: i + '-' + j, 角度: Math.round(Math.max(...P.slice(i, j + 1).map(q => q.slope || 0)) * 57.3), 高さ: +(P[j].p[1] - P[i].p[1]).toFixed(1) }
  for (const nit of [0, 1]) {
    let k = i, d = 0; while (k > 0 && d < 20) { if (P[k - 1].p) d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k--; if (['jump', 'lip', 'hang', 'stepUp'].includes(P[k].kind)) { k++; break } }
    const q = P[k], w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
    const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); b.v = [Math.cos(q.yaw) * 6, 0, -Math.sin(q.yaw) * 6]; b.nitro = 1
    const st = S.createSteer(P); S.resetSteer(st, b); let res = '登れない', vt = null
    for (let s = 0; s < 60 * 10; s++) { const onS = (P[st.i] || {}).kind === 'steep'; const inp = S.assist(st, b, { thr: 1, brk: 0, lean: onS || b.th > 0.3 ? 1 : 0, steer: S.steerFor(st, b), nitro: nit && st.i >= i - 2 ? 1 : 0 }); w.tick(); stepBike(w, b, inp, [])
      if (b.crashed) { res = '転倒 ' + b.crashed.why; break }
      if (Math.hypot(b.p[0] - top[0], b.p[2] - top[2]) < 2 && Math.abs(b.p[1] - 0.79 - top[1]) < 1.2) { res = 'o'; vt = b.speed; break } }
    row[nit ? 'ニトロ' : 'ニトロなし'] = res + (vt != null ? ' ' + vt.toFixed(1) + 'm/s' : '')
  }
  rows.push(row) }
console.table(rows)
