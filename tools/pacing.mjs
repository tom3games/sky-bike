// 判断の間隔: 上手い bot で通しを走り、プレイヤーが何か判断する出来事（跳ぶ・段・速さを変える・避ける・待つ・乗る・道を選ぶ・ニトロ）の
// 間の秒数を出す。何も判断しなくてよい時間が 4 秒以上続く所を、区間ごとに数える。 node tools/pacing.mjs [GAP=4] [LIST=1]
import { World, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { spawnAtCp, judge, doRespawn } from '../js/run.js'
const GAP = +(process.env.GAP || 4)
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = c.winds || []
const P = c.path
// 枝道（分かれ道の短い道）の点は、合流する本線の点の手前として数える（v16）
const brNx = {}; P.forEach(q => { if (q.branch && q.nx != null) brNx[q.br] = q.nx })
const prog = i => P[i].branch ? (brNx[P[i].br] ?? i) - 1 : i
// 判断の出来事になる道の点
const EV = new Set(['jump', 'lip', 'ramp', 'stepUp', 'stepDown', 'trap', 'crumble', 'crate', 'mud', 'water', 'steep', 'seesaw', 'lift', 'slide', 'spin', 'draw', 'narrow', 'bump', 'uturn', 'pad', 'landing', 'hang', 'nitro', 'can', 'room', 'whoop', 'pinch', 'glift', 'peg'])
const evAt = new Array(P.length).fill(null)
for (let i = 1; i < P.length; i++) {
  const q = P[i], pr = P[i - 1]; if (q.branch) continue
  if (EV.has(q.kind) && q.kind !== pr.kind) evAt[i] = q.kind
  else if ((q.kap || 0) > 0.11 && (pr.kap || 0) <= 0.11) evAt[i] = 'きつい曲がり'
  else if (q.w && pr.w && Math.abs(q.w - pr.w) > 0.7) evAt[i] = '幅が変わる'
  else if (q.door) evAt[i] = 'door'
  else if (q.hero) evAt[i] = 'hero'
}
// 動く仕掛け・扉の位置も出来事に
const nearI = p => { let bi = 0, bd = 1e18; for (let i = 0; i < P.length; i++) { const q = P[i]; if (!q.p || q.branch) continue; const d = (q.p[0] - p[0]) ** 2 + (q.p[2] - p[2]) ** 2 + ((q.p[1] - p[1]) * 2) ** 2; if (d < bd) { bd = d; bi = i } } return bi }
for (const h of c.hazards) { const i = nearI(h.p); evAt[i] = evAt[i] || h.kind }
for (const d of c.doors || []) { const i = nearI(d.shape.c); evAt[i] = evAt[i] || 'door' }
for (const r of c.risers || []) evAt[r.i0] = evAt[r.i0] || 'riser'
// 高い縁の手前で速さを落として前輪を上げる（縁の 6m 手前）、燃料の缶
for (let i = 6; i < P.length; i++) if (P[i].kind === 'hang' && !evAt[i - 6]) evAt[i - 6] = '縁の手前で減速'
for (const cn of c.cans || []) { const i = nearI(cn.p); evAt[i] = evAt[i] || 'can' }
// 上手い bot で走って、道の点に初めて着いた時刻
const bot = createBot(c, { skill: 'good', fork: process.env.FORK || 'safe' }); bot.world = w // 分かれ道は本線（長い道）を通る（枝道の出来事はこの表に入らないので）
const R = { cp: 0, rest: 0 }
let b = spawnAtCp(w, c, 0); resetBot(bot, b)
const tAt = new Array(P.length).fill(null)
const busy = [] // 待っている・縁に掛けて耐えている時刻（判断し続けている時間）
let steps = 0
const stuck = []
let faults = 0
const resp = [] // 失敗して出し直した時刻（その間の空きは数えない）
while (steps < 60 * 60 * 30) {
  const prev = b.p.slice(), inp = botInput(bot, b); w.tick(); stepBike(w, b, inp, []); steps++
  if (b.hang || bot.waiting) busy.push(steps * DT)
  const pi = prog(bot.i)
  if (tAt[pi] == null) for (let k = pi; k >= 0 && tAt[k] == null; k--) tAt[k] = steps * DT
  const j = judge(w, c, R, b, prev)
  if (j.finish) break
  if (pi > (R._bi || 0)) { R._bi = pi; R._bs = steps }
  if (!j.respawn && steps - (R._bs || 0) > 40 * 60) { j.respawn = { cp: R.rest || 0 }; R._bs = steps; R._bi = 0; stuck.push(bot.i) } // 人なら 25 秒進めなければ休憩所から
  if (j.respawn) { resp.push(steps * DT); b = doRespawn(w, c, R, j.respawn); resetBot(bot, b); faults++; bot.vMul = 0.75 + ((faults * 0.37) % 0.6) }
}
const evs = []; for (let i = 0; i < P.length; i++) if (evAt[i] && tAt[i] != null) evs.push({ i, t: tAt[i], k: evAt[i], zone: P[i].zone })
evs.sort((a, b) => a.t - b.t)
const ZN = { ground: '地面', crypt: '墓所', ruin: '廃墟', factory: '工場', bell: '鐘楼', ice: '氷', storm: '嵐', roof: '屋上', sky: '空' }
const rows = {}, longs = []
for (let k = 1; k < evs.length; k++) {
  const a = evs[k - 1], z = ZN[a.zone] || a.zone
  // 待っている・耐えている間は判断している時間なので、空きから引く
  let g = evs[k].t - a.t; { let lo = 0, hi = busy.length; while (lo < hi) { const m = (lo + hi) >> 1; if (busy[m] < a.t) lo = m + 1; else hi = m } let n = 0; for (let q = lo; q < busy.length && busy[q] < evs[k].t; q++) n++; g -= n * DT }
  if (resp.some(t => t > a.t && t <= evs[k].t + 0.5) || evs[k].i < a.i) continue // 失敗をはさむ・戻った所は数えない
  rows[z] = rows[z] || { 出来事: 0, '4秒以上の空き': 0, いちばん長い空き秒: 0, 空きの合計秒: 0 }
  rows[z].出来事++
  if (g >= GAP) { rows[z]['4秒以上の空き']++; rows[z].空きの合計秒 = +(rows[z].空きの合計秒 + g).toFixed(1); longs.push({ zone: z, from: a.k, i: a.i, to: evs[k].k, 秒: +g.toFixed(1), mark: (c.marks.find(m => a.i >= m.i0 && a.i <= m.i1) || {}).name }) }
  rows[z].いちばん長い空き秒 = Math.max(rows[z].いちばん長い空き秒, +g.toFixed(1))
}
console.log('通しの時間', (steps * DT).toFixed(0), '秒  出来事', evs.length, '  平均の間隔', ((evs.at(-1).t - evs[0].t) / evs.length).toFixed(1), '秒')
console.table(rows)
if (stuck.length) console.log('進めずやり直した所（道の点）', stuck.slice(0, 10).join(' '))
if (process.env.LIST) console.table(longs)
