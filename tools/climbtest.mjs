// よじ登る段の検査: 段の高さごとに、上手い bot（ウィリーで前輪を引っ掛け → 前体重＋アクセルで後輪を上げる）の成功率を数える
// node tools/climbtest.mjs  （MU=0.5 で濡れた段、N=段の数）
import { World, createBike, stepBike } from '../js/physics.js'
import { Builder } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const MU = process.env.MU ? +process.env.MU : undefined, NS = +(process.env.N || 1)
const HS = (process.env.H || '0.5,0.6,0.72,0.8,0.9,1.0,1.08').split(',').map(Number)
function course(h) {
  const B = new Builder([0, 0, 0], 0); B.solid = true; B.base = -2
  B.road(14, { w: 4, mat: 'stone', thick: 1 })
  for (let k = 0; k < NS; k++) { B.step(h); B.road(k === NS - 1 ? 12 : 2.6, { w: 4, mat: 'stone', thick: 1, noOverlap: true, mu: MU }) }
  return B
}
const rows = []
for (const h of HS) {
  const c = course(h), w = new World(c.shapes); w.winds = []
  const top = h * NS
  let ok = 0, n = 0, crash = 0, ts = []
  for (const v0 of [0, 1.5, 3]) for (const d0 of [1.5, 3, 5]) for (const react of (process.env.R || "0,6").split(",").map(Number)) {
    const b = settle(w, createBike({ p: [d0, 0.79, 0], yaw: 0 })); b.v = [v0, 0, 0]
    const bot = createBot(c, { skill: 'good', react }); bot.world = w; resetBot(bot, b)
    let s = 0, done = false
    for (; s < 60 * 25; s++) { const ev = []; stepBike(w, b, botInput(bot, b), ev); if (b.crashed) { crash++; break } if (b.p[0] > 14 + NS * 2.6 + 2 && b.p[1] > top + 0.5) { done = true; break } }
    n++; if (done) { ok++; ts.push(s / 60) } else if (process.env.V) console.log('NG', h, v0, d0, react, b.p.map(v => v.toFixed(2)).join(','), 'ph', bot.phase, 'th', (b.th * 57.3).toFixed(0))
  }
  rows.push({ 段の高さ: h, 車輪の径の何倍: +(h / 0.72).toFixed(2), 成功: `${ok}/${n}`, 平均秒: ts.length ? +(ts.reduce((a, b) => a + b) / ts.length).toFixed(1) : '-', 転倒: crash })
}
console.log(`段 ${NS} 段` + (MU ? `・すべる面 mu ${MU}` : ''))
console.table(rows)
