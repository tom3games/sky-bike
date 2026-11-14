// 出発の大ジャンプ（v27）: 台の手前から、bot（上手い・人の速さ 0.2 秒遅れ・0.3 秒遅れ）と、決まった速さで全開のまま跳ぶ走りで、
// 着地の先の 0.75m の段を越えて 6m 先まで行けるか・転ぶなら何で（頭・体・着地）どこで。 node tools/startjump.mjs
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1(), P = c.path
const li = P.findIndex(q => q.kind === 'lip'), lip = P[li], f = [Math.cos(lip.yaw), -Math.sin(lip.yaw)]
const si = P.findIndex((q, i) => i > li && q.kind === 'stepUp'), goal = P[si]
const along = p => (p[0] - lip.p[0]) * f[0] + (p[2] - lip.p[2]) * f[1]
const goalA = 22 // 台の先 22m（着地坂・その先の上がり坂の先）まで
const s0 = P[Math.max(0, li - 14)]
function run(pol, vMul, vFix, noLean, thrAir = 1) {
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  const b = settle(w, createBike({ p: [s0.p[0], s0.p[1] + 0.79, s0.p[2]], yaw: s0.yaw }))
  const bot = createBot(c, { skill: 'good', react: pol }); bot.world = w; resetBot(bot, b); bot.vMul = vMul
  for (let s = 0; s < 60 * 14; s++) {
    let inp = botInput(bot, b)
    if (vFix) { const a = along(b.p); inp = a < 0.5 ? { ...inp, thr: b.speed < vFix ? 1 : 0, brk: b.speed > vFix + 0.5 ? 0.5 : 0, lean: 0 } : noLean ? { ...inp, thr: (!b.g[0] && !b.g[1]) ? thrAir : 1, brk: 0, lean: 0 } : inp }
    w.tick(); const ev = []; stepBike(w, b, inp, ev)
    if (b.crashed) return '転倒(' + b.crashed.why + ') ' + (along(b.p)).toFixed(1) + 'm'
    if (b.p[1] < lip.p[1] - 4) return '落下'
    if (noLean ? along(b.p) > goalA : along(b.p) > goalA && Math.abs(b.p[1] - 0.79 - goal.p[1]) < 1.2) { if (!noLean) return 'ok'; if (!b.landT) b.landT = s; if (s - b.landT > 60) return 'ok' }
  }
  return '進めない'
}
const rows = []
for (const [name, pol] of [['上手い', 0], ['人の速さ 0.2秒', 12], ['0.3秒遅れ', 18]]) { const r = {}; let ok = 0; for (const vm of [0.8, 0.9, 1, 1.1, 1.2]) for (const sd of [0]) { const x = run(pol, vm); r['速さ×' + vm] = x; if (x === 'ok') ok++ } rows.push({ bot: name, ok: ok + '/5', ...r }) }
const r2 = {}; let ok2 = 0; for (const v of [7, 8, 9, 10, 11, 12, 13, 14]) { const x = run(0, 1, v); r2[v + 'm/s'] = x; if (x === 'ok') ok2++ }
console.table(rows); console.log('台に決まった速さで入る（空中は上手い bot の体重）', ok2 + '/8'); console.table([r2])
for (const [nm, ta] of [['体重を動かさずアクセルを押したまま（着地して 12m 先で 1 秒転ばない）', 1], ['体重を動かさず空中でアクセルを離す', 0]]) { const r3 = {}; let k = 0; for (const v of [4, 5, 6, 6.5, 7, 8, 10, 12, 14]) { const x = run(0, 1, v, true, ta); r3[v + 'm/s'] = x; if (x === 'ok') k++ } console.log(nm, k + '/9'); console.table([r3]) }
console.log('段の位置（台の先）', (along(goal.p)).toFixed(1), 'm')
