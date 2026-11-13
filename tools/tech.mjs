// 技の区間ごとに「上手い入力なら越えられ、適当な入力では越えられない」を数える
// node tools/tech.mjs  → 表（区間・上手い bot・適当（全開）・慎重だが技なし）と、谷のジャンプの速さの表
import { World, createBike, stepBike, DT, basis } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'

const c = COURSES[process.env.COURSE || 'stage1']()
const mkWorld = () => { const w = new World(c.shapes); w.winds = c.winds; return w }
let FORK = null // 道を選ぶ床の区間は、左と右の両方で試す
const policies = {
  上手い: () => createBot(c, { skill: 'good', fork: FORK || 'R' }),
  人の速さ: () => createBot(c, { skill: 'good', fork: FORK || 'R', react: 12 }),
  適当な全開: () => createBot(c, { skill: 'bad' }),
  慎重だが技なし: () => { const b = createBot(c, { skill: 'bad' }); b.cautious = true; return b },
}
function tryMark(m, pol, seed) {
  const w = mkWorld()
  w.setTime(seed * 1.37)
  // 区間の始まりが仕掛けの真上の時は、少し手前（道のある所）から始める
  let i0 = m.i0; if (!c.path[i0].w) for (let k = 0; k < 8 && i0 > 0 && c.path[i0 - 1].w && c.path[i0 - 1].kind !== 'jump'; k++) i0--
  const q = c.path[i0]
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
  const bot = policies[pol](); bot.world = w; resetBot(bot, b)
  if (!m.name.includes('谷')) { const f0 = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f0[0] * 3, 0, f0[2] * 3] }
  const y0 = q.p[1]
  let sd = 1234 + seed * 77
  const queue = []
  const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
  for (let s = 0; s < 60 * (/回廊/.test(m.name) ? 90 : FORK ? 60 : 30); s++) { // 道を選ぶ床は、床が来るのを待つ分（1 周 16 秒）だけ長く
    let inp = botInput(bot, b)
    if (bot.cautious) { inp = { ...inp, thr: b.speed < 3 ? 1 : 0, brk: b.speed > 4 ? 0.3 : 0, lean: 0 } }
    // ハンドルは全員自動（ゲームと同じ）。人の手の遅れ: アクセル・ブレーキ・重心だけ遅らせる（上手い 0 秒・ほか 0.25 秒）
    queue.push(inp)
    const late = queue.length > (pol === '上手い' || pol === '人の速さ' ? 0 : 15) ? queue.shift() : { thr: 0, brk: 0, lean: 0, steer: 0 }
    inp = { ...late, steer: inp.steer }
    w.tick(); const ev = []; stepBike(w, b, inp, ev)
    if (process.env.DEBUG === m.name && pol === (process.env.DPOL || '上手い') && seed === +(process.env.DSEED || 0) && s % (+process.env.EV || 6) === 0) console.log(s, b.p.map(v => v.toFixed(2)).join(','), 'th', (b.th * 57.3).toFixed(0), 'v', b.speed.toFixed(1), 'g', +b.g[0] + '' + +b.g[1], 's', b.s.map(v => v.toFixed(2)).join(','), 'in', inp.thr, inp.brk, inp.lean, inp.steer, 'ab', inp.ab || 0, 'psi', (b.psi * 57.3 % 360).toFixed(0), 'pyaw', ((c.path[bot.i].yaw || 0) * 57.3 % 360).toFixed(0), 'bi', bot.i, c.path[bot.i].kind, 'si', bot.st.i, c.path[bot.st.i].kind, ((c.path[bot.st.i].yaw || 0) * 57.3 % 360).toFixed(0), 'ph', bot.phase, ev.map(e => e.t + (e.why || '')).join(' '), b.cn[0] ? 'n0 ' + (b.cn[0].nw || b.cn[0].n).map(v => v.toFixed(2)) + ' ' + c.shapes[b.cn[0].id].tag : '', b.cn[1] ? 'n1 ' + (b.cn[1].nw || b.cn[1].n).map(v => v.toFixed(2)) + ' ' + c.shapes[b.cn[1].id].tag : '')
    if (b.crashed) { if (process.env.DEBUG === m.name && seed === 0 && pol === (process.env.DPOL || '上手い')) console.log('CRASH', pol, b.crashed.why, b.p.map(v => v.toFixed(2)).join(','), (b.cn[0] || b.cn[1]) ? c.shapes[(b.cn[0] || b.cn[1]).id].tag : '-'); return { ok: false, why: '転倒', t: s * DT } }
    if (b.p[1] < y0 - (m.drop || 3)) return { ok: false, why: '落下', t: s * DT }
    for (const e of m.ends || [m.end]) if (Math.hypot(b.p[0] - e[0], b.p[2] - e[2]) < 2.2 && Math.abs(b.p[1] - 0.79 - e[1]) < 1.5) return { ok: true, t: s * DT }
  }
  return { ok: false, why: '進めない', t: FORK ? 60 : 30 }
}
const rows = []
const todo = []
for (const m of c.marks.filter(m => !process.env.ONLY || process.env.ONLY.split(',').some(n => m.name.includes(n)))) {
  const hasFork = c.path.slice(m.i0, m.i1 + 1).some(q => q.kind === 'fork')
  if (hasFork) for (const fk of ['L', 'R']) todo.push({ m, fk }); else todo.push({ m, fk: null })
}
for (const { m, fk } of todo) {
  FORK = fk
  const row = { 区間: m.name + (fk ? ' ' + fk : '') }
  for (const pol of Object.keys(policies)) {
    let ok = 0, n = 0, why = {}, tt = []
    for (let seed = 0; seed < 8; seed++) { const r = tryMark(m, pol, seed); if (process.env.SEEDS && pol === (process.env.DPOL || "上手い")) console.log(m.name, FORK, seed, JSON.stringify(r)); n++; if (r.ok) { ok++; tt.push(r.t) } else why[r.why] = (why[r.why] || 0) + 1 }
    row[pol] = `${ok}/${n}` + (tt.length ? ` ${(tt.reduce((a, b) => a + b, 0) / tt.length).toFixed(1)}秒` : '') + (Object.keys(why).length ? ' ' + Object.entries(why).map(([k, v]) => k + v).join('') : '')
  }
  rows.push(row)
}
console.table(rows)

if ((process.env.ONLY || process.env.COURSE) && !process.env.JUMP) process.exit(0)
// 谷のジャンプ: 踏み切りの速さを変えて、どこに降りるか
const jm = c.marks.find(m => m.name === '助走して谷を飛ぶ')
const lipI = c.path.findLastIndex(q => q.kind === 'lip' && q.vNeed)
const lipQ = c.path[lipI]
const out = []
for (let v = 8; v <= 24; v += 1) {
  const w = mkWorld()
  const f = [Math.cos(lipQ.yaw), 0, -Math.sin(lipQ.yaw)]
  // 踏み切りの 6m 手前（道の上）から、その速さで走らせる
  let si = lipI, dd = 0
  while (si > 0 && dd < 6) { dd += Math.hypot(c.path[si].p[0] - c.path[si - 1].p[0], c.path[si].p[2] - c.path[si - 1].p[2]); si-- }
  const sq = c.path[si]
  const b = settle(w, createBike({ p: [sq.p[0], sq.p[1] + 0.79, sq.p[2]], yaw: sq.yaw }))
  { const sl = sq.slope || 0, fs = [Math.cos(sq.yaw), 0, -Math.sin(sq.yaw)]; b.v = [fs[0] * v * Math.cos(sl), v * Math.sin(sl), fs[2] * v * Math.cos(sl)] }
  const bot = createBot(c, { skill: 'good' }); resetBot(bot, b)
  let land = null, maxAir = 0, wasAir = false, lipV = null
  for (let s = 0; s < 60 * 6; s++) {
    let inp = botInput(bot, b)
    const air = !b.g[0] && !b.g[1]
    if (!air && !wasAir) inp = { ...inp, thr: b.speed < v ? 1 : 0, brk: 0 }
    const al0 = (b.p[0] - lipQ.p[0]) * f[0] + (b.p[2] - lipQ.p[2]) * f[2]
    if (al0 > -0.3 && lipV == null) lipV = b.speed
    w.tick(); stepBike(w, b, inp)
    if (+process.env.DJ === v && s % 4 === 0) console.log(s, 'al', al0.toFixed(2), 'y', (b.p[1] - lipQ.p[1]).toFixed(2), 'v', b.speed.toFixed(1), 'vy', b.v[1].toFixed(2), 'th', (b.th * 57.3).toFixed(0), 'g', +b.g[0] + '' + +b.g[1], 'in', inp.thr, inp.lean)
    if (air) { wasAir = true; maxAir++ }
    if (wasAir && !air && (b.g[0] || b.g[1])) { land = b.p.slice(); break }
    if (b.crashed || b.p[1] < lipQ.p[1] - 15) break
  }
  // 距離は踏み切りの先端（台の終わり）から。どこに降りたかは降りた面の高さで見る
  const LP = c.notes.find(n => n.kind === 'shortcut' && n.name.includes('浮き島2')).p
  const along = land ? (land[0] - LP[0]) * f[0] + (land[2] - LP[2]) * f[2] : null
  const dyL = land ? land[1] - 0.79 - LP[1] : null
  out.push({ 速さ: v, 踏み切り: lipV && +lipV.toFixed(1), 着地: b.crashed ? '転倒 ' + b.crashed.why + ' ' + ((b.p[0] - lipQ.p[0]) * f[0] + (b.p[2] - lipQ.p[2]) * f[2]).toFixed(1) + 'm' : land ? (dyL < -6.5 ? '谷の下の道' : along < 15 ? '谷の手前' : along < 21.6 ? '浮き島1' : along < 24.2 ? '島のふち ' + dyL.toFixed(1) : '浮き島2（近道）') + ` ${along.toFixed(1)}m` : '落下（谷）', 空中秒: +(maxAir * DT).toFixed(2) })
}
console.table(out)
// 助走路を全開で走ると、踏み切りで何 m/s 出るか
{
  const w = mkWorld(), q = c.path[jm.i0]
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
  const bot = createBot(c, { skill: 'good' }); resetBot(bot, b)
  let vLip = null
  const f = [Math.cos(lipQ.yaw), 0, -Math.sin(lipQ.yaw)]
  for (let s = 0; s < 60 * 10; s++) { const inp = botInput(bot, b); w.tick(); stepBike(w, b, { ...inp, thr: 1, brk: 0, lean: Math.max(inp.lean, b.th > 0.12 ? 0.6 : 0) }); const al = (b.p[0] - lipQ.p[0]) * f[0] + (b.p[2] - lipQ.p[2]) * f[2]; if (al > -0.5 && vLip == null) { vLip = b.speed; break } }
  console.log('助走路を全開で走った時の踏み切りの速さ', vLip && vLip.toFixed(1), 'm/s')
}
