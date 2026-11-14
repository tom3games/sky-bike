// 高い縁（hangLedge）の登りの検査: 縁ごとに、上手い bot・入力を遅らせた bot（0.15 / 0.2 / 0.25 秒）で
//  ・登れた数（1 回目で・25 秒以内に）と、失敗の仕方（掛からず弾かれる・ずり落ちる・後ろへ落ちる・前へ転ぶ・縁が欠ける・転倒）
//  ・瞬間移動: 1 刻み（1/60 秒）の車体の位置と角度の変化のうち、その時の速さで説明できない飛び（位置 5cm 超・角度 3 度超）の数
// を数える。 node tools/hangrate.mjs [ONLY=番号,..] [N=縁の数] [OUT=json]
import { World, createBike, stepBike, DT, basis, wheelCenter } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
import { writeFileSync } from 'node:fs'
const c = COURSES[process.env.COURSE || 'stage1'](), P = c.path
const ledges = []
for (let i = 1; i < P.length; i++) if (P[i].kind === 'hang' && !P[i].branch) ledges.push(i)
const use = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : ledges.slice(0, +(process.env.N || ledges.length)).map((_, k) => k)
const markOf = i => { let n = '-'; for (const m of c.marks) if (i >= m.i0 && i <= m.i1) n = m.name; return n }
const POL = { 上手い: 0, '遅れ0.15': 9, '遅れ0.2（人の速さ）': 12, '遅れ0.25': 15, '遅れ0.3': 18 }
const rows = [], jumpsAll = { 位置: 0, 角度: 0, 前輪: 0, 後輪: 0, '掛かり中の1刻み5cm超': 0, '掛かり中の1刻み3度超': 0 }, examples = []
function run(li, react, seed) {
  const q = P[li], f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]
  // 縁の 9m 手前の道の点から
  let k = li, d = 0; while (k > 0 && d < 9 && P[k - 1].p && P[k - 1].w) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- }
  while (k > 0 && ['crumble', 'trap'].includes(P[k].kind) && P[k - 1].p && P[k - 1].w) k--
  if (P[k - 1] && !P[k - 1].w) k = Math.min(li - 1, k + 2) // 段のすぐ後ろ（縁の上）からは始めない // 崩れる床・抜ける床の上からは始めない（止まった所から始めると落ちる）
  const s0 = P[k]
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(seed * 1.37)
  const b = settle(w, createBike({ p: [s0.p[0], s0.p[1] + 0.79, s0.p[2]], yaw: s0.yaw }))
  b.v = [Math.cos(s0.yaw) * 2, 0, -Math.sin(s0.yaw) * 2]
  const bot = createBot(c, { skill: 'good', react }); bot.world = w; resetBot(bot, b)
  const edgeY = q.p[1] + q.dy
  let fails = [], catches = 0, upAt = null, prev = null, jumps = { 位置: 0, 角度: 0, 前輪: 0, 後輪: 0, '掛かり中の1刻み5cm超': 0, '掛かり中の1刻み3度超': 0 }, firstOk = null
  const wc = () => { const B = basis(b); return [wheelCenter(b, B, 0, b.s[0]), wheelCenter(b, B, 1, b.s[1])] }
  for (let s = 0; s < 60 * 25; s++) {
    let inp = botInput(bot, b)
    const ev = []
    w.tick(); stepBike(w, b, inp, ev)
    const W = wc(), cur = { p: b.p.slice(), th: b.th, v: b.v.slice(), w: b.w, W, hang: !!b.hang }
    if (prev && !ev.some(e => e.t === 'knock') && (prev.hang || cur.hang || upAt != null && s - upAt < 30)) { // 鉄球に弾かれた刻みは数えない（本当に弾かれた）
      // 速さで説明できない動き（前の刻みの速さで進んだ所からのずれ）
      const ex = [0, 1, 2].map(j => cur.p[j] - prev.p[j] - (prev.v[j] + cur.v[j]) / 2 * DT), e = Math.hypot(...ex)
      const eth = Math.abs(cur.th - prev.th - (prev.w + cur.w) / 2 * DT) * 57.3
      // 車輪: 1 刻みの動きが、前の刻みの動きから 5cm 超えて変わったら飛び（急に別の所へ移った）
      if (prev.dW) for (const j of [0, 1]) { const dW = [0, 1, 2].map(a => cur.W[j][a] - prev.W[j][a]), e2 = Math.hypot(...[0, 1, 2].map(a => dW[a] - prev.dW[j][a])); if (e2 > 0.05) { jumps[j ? '前輪' : '後輪']++; if (examples.length < 12) examples.push({ 縁: li, react, s, 何: j ? '前輪' : '後輪', m: +e2.toFixed(3), hang: cur.hang, wasHang: prev.hang }) } }
      cur.dW = [0, 1].map(j => [0, 1, 2].map(a => cur.W[j][a] - prev.W[j][a]))
      if (prev.hang || cur.hang) { if (Math.hypot(...[0, 1, 2].map(j => cur.p[j] - prev.p[j])) > 0.05) jumps['掛かり中の1刻み5cm超']++; if (Math.abs(cur.th - prev.th) * 57.3 > 3) jumps['掛かり中の1刻み3度超']++ } // そのままの動きの大きさ（掛かる・登る間）
      if (e > 0.05) { jumps.位置++; if (examples.length < 12) examples.push({ 縁: li, react, s, 何: '位置', m: +e.toFixed(3), hang: cur.hang, wasHang: prev.hang }) }
      if (eth > 3) { jumps.角度++; if (examples.length < 12) examples.push({ 縁: li, react, s, 何: '角度', deg: +eth.toFixed(1), hang: cur.hang, wasHang: prev.hang }) }
    }
    prev = cur
    for (const e of ev) {
      if (e.t === 'hang') catches++
      if (e.t === 'hangFall') fails.push(e.why)
      if (e.t === 'hangBreak') fails.push('edge')
      if (e.t === 'hangUp') upAt = s
    }
    if (b.crashed) { fails.push('転倒'); break }
    if (b.p[1] < q.p[1] - 4) { fails.push('下へ落ちた'); break }
    if (upAt != null && s - upAt > 60 && b.p[1] > edgeY + 0.3) { firstOk = !fails.length; return { ok: true, first: firstOk, fails, catches, jumps, t: s * DT } }
  }
  if (!catches) fails.push('掛からない')
  return { ok: false, first: false, fails, catches, jumps }
}
for (const k of use) {
  const li = ledges[k]
  // 動く床の上から掛ける縁は、床の動きと一緒に試す tools/tech.mjs で見る（ここでは止まった床の上から始められない）
  { let j = li, d = 0, mov = false; while (j > 0 && d < 9) { if (['lift', 'glift', 'slide'].includes(P[j].kind)) mov = true; if (P[j - 1].p && P[j].p) d += Math.hypot(P[j].p[0] - P[j - 1].p[0], P[j].p[2] - P[j - 1].p[2]); j-- } if (mov) { rows.push({ 縁: k, 場所: markOf(li), bot: '-', 登れた: '動く床の上（tech で）', '1回目で': '', 平均秒: '', 失敗: '' }); continue } }
  for (const [pn, react] of Object.entries(POL)) {
    let ok = 0, first = 0, why = {}, tt = []
    for (let seed = 0; seed < 8; seed++) {
      const r = run(li, react, seed)
      if (r.ok) { ok++; tt.push(r.t); if (r.first) first++ }
      for (const f of r.fails) why[f] = (why[f] || 0) + 1
      for (const j in r.jumps) jumpsAll[j] += r.jumps[j]
    }
    rows.push({ 縁: k, 場所: markOf(li), bot: pn, 登れた: `${ok}/8`, '1回目で': `${first}/8`, 平均秒: tt.length ? +(tt.reduce((a, b) => a + b, 0) / tt.length).toFixed(1) : '-', 失敗: Object.entries(why).map(([a, b]) => a + b).join(' ') })
  }
}
console.table(rows)
console.log('飛び（1/60 秒で速さで説明できない動き）', JSON.stringify(jumpsAll))
if (examples.length) console.table(examples)
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify({ rows, jumpsAll, examples }))
