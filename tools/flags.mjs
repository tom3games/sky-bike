// 旗（休憩所）の間隔: 上手い bot で旗から旗までの秒数、人の速さの bot（反応 0.2 秒）の失敗の回数を区間ごとに。
// SAFE=1 で、転んだ時に 2 秒前から出し直す（v14 の形）。ふだんは最後の旗から
import { runSim } from './sim.mjs'
import { COURSES } from '../js/course.js'
if (process.env.SAFE) globalThis.__crashSafe = true
const c = COURSES.stage1()
const good = runSim('stage1', 'good', { maxSec: 3600 }), human = runSim('stage1', 'good', { maxSec: 5400, react: 12, maxFaults: 400 })
const rows = []; let prev = 0, prevT = 0
const fl = c.cps.map((q, i) => ({ q, i })).filter(o => o.q.rest || o.q.finish)
for (let k = 1; k < fl.length; k++) {
  const a = fl[k - 1], b = fl[k], tg = good.perCp[b.i], th = human.perCp[b.i], tha = human.perCp[a.i] ?? 0, tga = good.perCp[a.i] ?? 0
  const fails = human.log.filter(l => l.cp >= a.i && l.cp < b.i && l.why !== 'retry').length
  rows.push({ 旗から: a.q.name, 旗まで: b.q.name, 上手い秒: tg != null ? +(tg - tga).toFixed(0) : '-', 人の速さ秒: th != null ? +(th - tha).toFixed(0) : '-', 人の失敗: fails })
}
console.table(rows)
console.log(`上手い: 完走 ${good.finished} ${good.time.toFixed(0)} 秒 失敗 ${good.faults} ／ 人の速さ: 完走 ${human.finished} ${human.time.toFixed(0)} 秒 失敗 ${human.faults}`)
