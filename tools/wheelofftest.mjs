// v51 下山の脱輪: 最後の区間「下山 小屋へ」を、前輪が外れた後の入力ごとに走らせる
// node tools/wheelofftest.mjs  → 方針ごと 8 回: 小屋に着いた / 転倒（理由）、外れた時の速さ、ウィリーの角度の幅
import { World, createBike, stepBike, DT, NOFRONT_HOLD } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { settle } from '../js/run.js'
const c = COURSES.stage1(), m = c.marks.find(x => x.name === '下山 小屋へ')
const pols = {
  上手い: { react: 0, after: null }, 人の速さ: { react: 12, after: null },
  何もしない: { react: 0, after: () => ({ thr: 1, brk: 0, lean: 0 }) }, 何も押さない: { react: 0, after: () => ({ thr: 0, brk: 0, lean: 0 }) },
  後ろ体重だけ: { react: 0, after: () => ({ thr: 0, brk: 0, lean: -1 }) }, 後ろ体重とブレーキ: { react: 0, after: (b) => ({ thr: 0, brk: 1, lean: -1 }) },
  後ろ体重とニトロ: { react: 0, after: () => ({ thr: 1, brk: 0, lean: -1, nitro: 1 }) },
}
const rows = []
for (const [name, P] of Object.entries(pols)) {
  let ok = 0, why = {}, vOff = [], thMin = 99, thMax = -99, tEnd = []
  for (let seed = 0; seed < 8; seed++) {
    const w = new World(c.shapes); w.winds = c.winds; w.setTime(seed * 1.37)
    const q = c.path[m.i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
    const bot = createBot(c, { skill: 'good', react: P.react }); bot.world = w; resetBot(bot, b)
    const f0 = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f0[0] * 3, 0, f0[2] * 3]
    let res = null
    for (let s = 0; s < 60 * 40; s++) {
      let inp = botInput(bot, b)
      if (b.noFront && P.after) inp = { ...P.after(b), steer: inp.steer }
      const ev = []; w.tick(); stepBike(w, b, inp, ev)
      if (ev.some(e => e.t === 'wheelOff')) vOff.push(b.speed)
      if (b.noFront && b.noFront.t > NOFRONT_HOLD + 0.5 && b.g[0] && !b.crashed) { const d = b.th * 57.3; thMin = Math.min(thMin, d); thMax = Math.max(thMax, d) }
      if (process.env.LOG === name && seed === 0 && s % 6 === 0) console.log(s, 'v', b.speed.toFixed(1), 'th', (b.th * 57.3).toFixed(0), 'g', +b.g[0] + '' + +b.g[1], b.noFront ? 'NF ' + b.noFront.t.toFixed(2) + (b.noFront.stub ? ' stub' : '') : '', ev.map(e => e.t + (e.why || '')).join(' '))
      if (b.crashed) { res = '転倒' + b.crashed.why; break }
      if (Math.hypot(b.p[0] - m.end[0], b.p[2] - m.end[2]) < 9 && Math.abs(b.p[1] - 0.79 - m.end[1]) < 2.5) { res = 'ok'; tEnd.push(s * DT); break }
      if (b.p[1] < q.p[1] - 45) { res = '落下'; break }
    }
    res = res || '進めない'
    if (res === 'ok') ok++; else why[res] = (why[res] || 0) + 1
  }
  rows.push({ 方針: name, 着いた: `${ok}/8`, 失敗: JSON.stringify(why), 外れた速さ: vOff.length ? (vOff.reduce((a, x) => a + x, 0) / vOff.length).toFixed(1) : '-', 角度: thMin < 99 ? `${thMin.toFixed(0)}〜${thMax.toFixed(0)}度` : '-', 秒: tEnd.length ? (tEnd.reduce((a, x) => a + x, 0) / tEnd.length).toFixed(1) : '-' })
}
console.table(rows)
