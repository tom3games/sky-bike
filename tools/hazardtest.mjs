// 新しい仕掛けの区間ごとに、上手い bot（タイミングを見る）と、全開の bot（何も考えない）と、途中で止まる bot の結果を数える
// 振り子の鉄球・落石・跳ね橋・突風は始める時刻（位相）を 12 通りずらす
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1()
const names = (process.env.ONLY || '振り子の鉄球,泥の坂,湧き水の流れ,跳ね橋,落石,突風の細い張り出し,三つの鉄球').split(',')
const rows = []
for (const name of names) {
  const m = c.marks.find(m => m.name === name); if (!m) { console.log('なし', name); continue }
  const row = { 区間: name }
  // 「途中で止まる」は仕掛けの真ん中で止まる（泥・水・跳ね橋は最初の点から 3 つ先、鉄球・落石・突風は危ない所の真ん中）
  let stopI = c.path.findIndex((z, i) => i >= m.i0 && i <= m.i1 && ['mud', 'water', 'draw', 'steep'].includes(z.kind))
  if (stopI >= 0) stopI += 3
  else { const hz = c.hazards.find(h => { let bi = -1, bd = 1e9; c.path.forEach((z, i) => { if (i < m.i0 || i > m.i1 || !z.p) return; const d = Math.hypot(z.p[0] - h.p[0], z.p[2] - h.p[2], z.p[1] - h.p[1]); if (d < bd) { bd = d; bi = i } }); h._i = bi; return bd < 2 }); stopI = hz ? hz._i : m.i0 + 6 }
  for (const pol of ['上手い', '全開', '途中で止まる']) {
    let ok = 0, n = 0; const why = {}; const tt = []
    for (let seed = 0; seed < 12; seed++) {
      const w = new World(c.shapes); w.winds = c.winds; w.setTime(seed * 0.37)
      const q = c.path[Math.max(0, m.i0 - 8)]
      const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
      const bot = createBot(c, { skill: pol === '上手い' ? 'good' : 'bad' }); bot.world = w; resetBot(bot, b)
      const f0 = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f0[0] * 3, 0, f0[2] * 3]
      const y0 = q.p[1]; let res = null, stopT = 0, knock = 0, maxLat = 0
      for (let s = 0; s < 60 * 30 && !res; s++) {
        let inp = botInput(bot, b)
        if (pol === '全開') inp = { ...inp, thr: 1, brk: 0, lean: 0 }
        if (pol === '途中で止まる') { if (bot.i >= stopI && stopT < 4) { inp = { ...inp, thr: 0, brk: 1, lean: 0.4 }; if (Math.abs(b.speed) < 0.3) stopT += DT } else inp = { ...inp, thr: b.speed < 5 ? 1 : 0, brk: 0, lean: 0 } }
        w.tick(); const ev = []; stepBike(w, b, inp, ev)
        if (ev.some(e => e.t === 'knock')) knock++
        if (b.crashed) { res = '転倒'; if (process.env.V) console.log(name, pol, seed, b.crashed.why, 'along', Math.hypot(b.p[0] - q.p[0], b.p[2] - q.p[2]).toFixed(1), c.path[bot.i].kind) }
        else if (b.p[1] < y0 - 3) res = knock ? '弾かれて落ちた' : '落ちた'
        else for (const e of [m.end]) if (Math.hypot(b.p[0] - e[0], b.p[2] - e[2]) < 2.2 && Math.abs(b.p[1] - 0.79 - e[1]) < 1.5) { res = 'ok'; tt.push(s * DT) }
      }
      n++; if (res === 'ok') ok++; else why[res || '進めない'] = (why[res || '進めない'] || 0) + 1
    }
    row[pol] = `${ok}/${n}` + (tt.length ? ` ${(tt.reduce((a, b) => a + b, 0) / tt.length).toFixed(1)}秒` : '') + (Object.keys(why).length ? ' ' + Object.entries(why).map(([k, v]) => k + v).join(' ') : '')
  }
  rows.push(row)
}
console.table(rows)
