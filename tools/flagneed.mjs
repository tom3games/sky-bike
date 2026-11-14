// v36 難所の前に旗: 上手い・人の速さ 0.2 秒・0.25 秒の bot で通し、失敗（転倒・落下・進めない）ごとに「旗から失敗までの秒」を出す。
// 同じ所で 2 回以上失敗し、旗から 40 秒以上かかる所を、足す旗の候補に。node tools/flagneed.mjs
import { runSim } from './sim.mjs'
import { COURSES } from '../js/course.js'
const c = COURSES.stage1(), agg = {}
for (const [name, react] of [['上手い', 0], ['人0.2秒', 12], ['人0.25秒', 15]]) {
  const r = runSim('stage1', 'good', { maxSec: +(process.env.MAX || 2400), react, maxFaults: 200 })
  console.log(name, 'finished', r.finished, 'time', r.time.toFixed(0), 'faults', r.faults, 'cp', r.cp)
  for (const L of r.log) { if (!L.from || L.ft == null) continue; const k = L.rest + '|' + (L.from.mark || L.from.kind); const a = agg[k] = agg[k] || { rest: c.cps[L.rest].name, at: L.from.mark || L.from.kind, i: L.from.i, n: 0, ft: [], who: {} }; a.n++; a.ft.push(L.ft); a.who[name] = (a.who[name] || 0) + 1 }
}
const rows = Object.values(agg).map(a => ({ 旗: a.rest, 失敗した所: a.at, 道の点: a.i, 回数: a.n, 旗から秒: Math.round(a.ft.reduce((x, y) => x + y, 0) / a.ft.length), 誰: JSON.stringify(a.who) })).sort((x, y) => y.回数 * y.旗から秒 - x.回数 * x.旗から秒)
console.table(rows.slice(0, 30))
