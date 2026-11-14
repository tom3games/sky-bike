// 天空城への大ジャンプ（v32）: 旗「大ジャンプの助走」から、助走のしかた（全開・ニトロ・上手い bot・人の速さ bot）と空中の体重（何もしない・坂に合わせる・後ろ体重で宙返り）を変えて跳ぶ。
// 踏み切りの速さ・滞空・距離・着地（転ばずに 2 秒走れたか）を数える。 node tools/megajump.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { spawnAtCp } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, cp = c.cps.findIndex(q => q.name === '大ジャンプの助走'), n = c.notes.find(n => n.kind === 'megaJump')
const f = [Math.cos(n.yaw), 0, -Math.sin(n.yaw)], al = p => (p[0] - n.lip[0]) * f[0] + (p[2] - n.lip[2]) * f[2]
const fin = c.cps[c.cps.length - 1].p
const rows = []; let okN = 0, all = 0
for (const run of ['全開', 'ニトロ', '上手い bot', '人の速さ bot']) for (const air of ['何もしない', '坂に合わせる', '後ろ体重で宙返り', '前体重']) {
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  const b = spawnAtCp(w, c, cp), st = S.createSteer(P); S.resetSteer(st, b)
  const bot = run.includes('bot') ? createBot(c, { skill: 'good', react: run.includes('人') ? 12 : 0 }) : null; if (bot) { bot.world = w; resetBot(bot, b) }
  let vl = null, t0 = null, t1 = null, land = null, res = '', rot = 0, prevTh = b.th, flips = 0
  for (let s = 0; s < 60 * 30; s++) {
    let inp = bot ? botInput(bot, b) : S.assist(st, b, { thr: 1, brk: 0, lean: 0, steer: S.steerFor(st, b), nitro: run === 'ニトロ' ? 1 : 0 })
    if (run === 'ニトロ') { inp.nitro = 1; inp.thr = 1 }
    const inAir = !b.g[0] && !b.g[1] && t0 != null && t1 == null
    if (inAir && !(run.includes('bot') && air === '坂に合わせる')) {
      const lean = air === '何もしない' ? 0 : air === '前体重' ? 0.6 : air === '後ろ体重で宙返り' ? (rot < 2 * Math.PI - 0.6 ? -1 : 0) : (b.th > -0.15 ? 0.5 : b.th < -0.55 ? -0.5 : 0)
      inp = { ...inp, lean, steer: 0 }
    }
    const was = b.g[0] || b.g[1]
    stepBike(w, b, inp, [])
    if (t0 == null && was && !b.g[0] && !b.g[1] && Math.abs(al(b.p)) < 3) { t0 = s; vl = b.speed }
    if (t0 != null && t1 == null) { let d = b.th - prevTh; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; rot += d }
    prevTh = b.th
    if (t0 != null && t1 == null && s - t0 > 20 && (b.g[0] || b.g[1])) { t1 = s; land = al(b.p) }
    if (b.crashed) { res = '転倒 ' + b.crashed.why; break }
    if (b.p[1] < fin[1] - 30) { res = '落下'; break }
    if (t1 != null && s - t1 > 120) { res = 'ok'; break }
  }
  all++; if (res === 'ok') okN++
  rows.push({ 助走: run, 空中: air, 踏み切り: vl ? +vl.toFixed(1) : '-', 滞空秒: t1 ? +((t1 - t0) / 60).toFixed(2) : '-', 距離m: land ? +land.toFixed(0) : '-', 回った度: Math.round(rot * 57.3), 結果: res || '時間切れ' })
}
console.table(rows); console.log(`着地して走れた ${okN}/${all}`)
