// v17 の仕掛け（溝の動く床・片輪の杭）が「前輪を上げないと越えられない」かを確かめる。
// 仕掛けの手前から、体重を動かさず（ウィリーしない）一定の速さを保って走らせ、溝・杭の先まで行けるかを速さごとに数える。
// 同じ所を上手い bot（ウィリーする）でも走らせて、越えられることを確かめる。 node tools/v17check.mjs [COURSE=stage1]
import { World, createBike, stepBike, DT, liftPos } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES[process.env.COURSE || 'stage1'](), P = c.path
const rows = []
// 試す所: 溝の動く床（床が手前で止まった直後に、床の上の後ろの端から）・杭の列（最初の杭の 1.6m 手前から）
const spots = []
for (let i = 1; i < P.length; i++) {
  const q = P[i]
  if (q.kind === 'glift' && P[i - 1].kind !== 'glift') spots.push({ kind: 'glift', i, gl: q.glift })
  if (q.kind === 'peg' && P[i - 1].kind !== 'peg') spots.push({ kind: 'peg', i })
}
const markOf = i => { let n = '-'; for (const m of c.marks) if (i >= m.i0 && i <= m.i1) n = m.name; return n }
function run(sp, v, mode) {
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  let p0, yaw = P[sp.i].yaw, f = [Math.cos(yaw), 0, -Math.sin(yaw)], endAl
  if (sp.kind === 'glift') { const gl = sp.gl; p0 = [gl.start[0] - f[0] * 7, gl.start[1], gl.start[2] - f[2] * 7]; endAl = gl.stepS + 0.8 } // 床は時刻 0 で手前の端に止まっている。7m 手前から、その速さで
  else { // 杭: すぐ手前に高い縁があれば、縁の上から（縁を登った直後の速さ 2m/s）
    const hq = P.slice(0, sp.i).findLast(q => q.kind === 'hang'), q = P[sp.i]; p0 = hq && Math.hypot(hq.p[0] - q.p[0], hq.p[2] - q.p[2]) < 4 ? [hq.p[0] + f[0] * 0.9, q.p[1], hq.p[2] + f[2] * 0.9] : [q.p[0] - f[0] * 1.6, q.p[1], q.p[2] - f[2] * 1.6]
    let k = sp.i; while (P[k + 1] && P[k + 1].kind === 'peg') k++; const e = P[k]; endAl = (e.p[0] - p0[0]) * f[0] + (e.p[2] - p0[2]) * f[2] + 0.8 }
  const b = settle(w, createBike({ p: [p0[0], p0[1] + 0.79, p0[2]], yaw }))
  const v0 = sp.kind === 'glift' ? v : Math.min(v, 2.0); b.v = [f[0] * v0, 0, f[2] * v0]
  let passed = false
  const bot = createBot(c, { skill: 'good', react: mode === 'human' ? 12 : 0 }); bot.world = w; resetBot(bot, b)
  const y0 = p0[1]
  for (let s = 0; s < 60 * 12; s++) {
    let inp
    if (mode === 'plain') inp = passed ? { thr: 0, brk: 1, lean: 0.3, steer: 0 } : { thr: b.speed < v ? 1 : 0, brk: b.speed > v + 0.5 ? 0.4 : 0, lean: b.th < -0.15 ? -0.5 : b.th > 0.25 ? 0.6 : 0, steer: 0 }
    else { inp = botInput(bot, b) }
    w.tick(); stepBike(w, b, inp, [])
    if (b.crashed) return '転倒'
    if (b.p[1] < y0 - 1.2) return '落下'
    let al = (b.p[0] - p0[0]) * f[0] + (b.p[2] - p0[2]) * f[2]
    if (sp.kind === 'glift') { const st = liftPos(sp.gl.m, w.time); al = (b.p[0] - sp.gl.start[0]) * f[0] + (b.p[2] - sp.gl.start[2]) * f[2] - (sp.gl.amp + st.k) }
    if (al > endAl) passed = true // 後輪が段・杭を越えた
    if (passed && (sp.kind !== 'glift' || mode !== 'plain' || w.time > sp.gl.m.dwell + sp.gl.m.move + 0.5)) return '越えた' // 床は、向こうに着くまで床の上に残れたら
  }
  return passed ? '床から落ちず' : '進めない'
}
for (const sp of spots) {
  const row = { 所: markOf(sp.i) + ' ' + (sp.kind === 'glift' ? '段のある動く床' : '杭') }
  for (const v of [1.5, 2.5, 3.5, 4.5, 6, 8, 11]) row['体重なし ' + v] = run(sp, v, 'plain')
  row.上手い = run(sp, 0, 'good'); row.人の速さ = run(sp, 0, 'human')
  rows.push(row)
}
console.table(rows)
