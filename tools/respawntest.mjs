// 転んだ後の出し直しの検査: コースの各所で上手い bot を走らせてから、わざと転ばせ、出し直した所を調べる。
// 危ない所 = 出し直してから 3 秒以内にまた転ぶ・落ちる。あわせて、出し直した所が動く床・崩れる床・溝・急な坂・道の端・逆向きでないかを数える
import { World, createBike, stepBike, resetFallen } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { judge, doRespawn, settle } from '../js/run.js'
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = c.winds || []
const BAD = new Set(['lift', 'slide', 'spin', 'seesaw', 'crumble', 'trap', 'jump', 'lip', 'draw', 'water'])
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
const MODE = process.argv[2] || 'crash'
const back = []
const cnt = { 試した: 0, 危ない: 0, 旗へ: 0, 動く床や崩れる所: 0, 急な坂: 0, 道の端: 0, 逆向き: 0 }; const ex = []
for (let i = 40; i < c.path.length - 20; i += 14) {
  const q = c.path[i]; if (!q.p || !q.w || q.branch) continue
  const q0 = c.path[i - 15]; if (!q0.p || !q0.w) continue
  w.setTime(0); resetFallen(w)
  let b = settle(w, createBike({ p: [q0.p[0], q0.p[1] + 0.79, q0.p[2]], yaw: q0.yaw }))
  const bot = createBot(c, { skill: 'good' }); bot.world = w; resetBot(bot, b)
  const R = { cp: 0, rest: 0, restSeen: {} }
  let prev = b.p.slice(), ok = true
  for (let s = 0; s < 60 * 5; s++) { const inp = botInput(bot, b); w.tick(); stepBike(w, b, inp, []); const j = judge(w, c, R, b, prev); prev = b.p.slice(); if (j.respawn) { ok = false; break } }
  if (!ok) continue
  const at0 = b.p.slice()
  let j
  if (MODE === 'crash') { b.crashed = { why: 'test', t: 0.81, at: b.p.slice() }; j = judge(w, c, R, b, prev) }
  else {
    // 道の外へ横に押し出す（右か左、交互）
    const sg = (i / 14) % 2 ? 1 : -1, hx = Math.sin(b.psi), hz = Math.cos(b.psi)
    b.v[0] += -hz * 6 * sg; b.v[2] += hx * 6 * sg
    j = {}
    for (let s = 0; s < 60 * 8; s++) { w.tick(); stepBike(w, b, { thr: 0, brk: 0, lean: 0, steer: 0 }, []); j = judge(w, c, R, b, prev); prev = b.p.slice(); if (j.respawn) break; if (b.g[0] && b.g[1] && s > 30) break }
    if (!j.respawn) { cnt.下の足場 = (cnt.下の足場 || 0) + 1; continue }
  }
  if (!j.respawn) continue
  cnt.試した++
  if (j.respawn.cp != null) cnt.旗へ++
  b = doRespawn(w, c, R, j.respawn); resetBot(bot, b); back.push(Math.hypot(b.p[0] - at0[0], b.p[2] - at0[2]))
  // 出し直した所を調べる
  let bi = 0, bd = 1e9; c.path.forEach((z, k) => { if (!z.p) return; const d = (z.p[0] - b.p[0]) ** 2 + (z.p[2] - b.p[2]) ** 2 + ((z.p[1] + 0.8 - b.p[1]) * 2) ** 2; if (d < bd) { bd = d; bi = k } })
  const z = c.path[bi]
  if (BAD.has(z.kind) || (b.cn[0] && w.shapes[b.cn[0].id].mov)) { cnt.動く床や崩れる所++; if (process.env.DBG) console.log('mov', i, bi, z.kind, b.cn[0] && w.shapes[b.cn[0].id].mov?.type) }
  if (Math.abs(z.slope || 0) > 0.2) cnt.急な坂++
  if (z.w && Math.abs(-(b.p[0] - z.p[0]) * Math.sin(z.yaw) - (b.p[2] - z.p[2]) * Math.cos(z.yaw)) > z.w / 2 - 0.6) cnt.道の端++
  if (z.yaw != null && Math.abs(wrap(b.psi - z.yaw)) > 1.2) cnt.逆向き++
  // 3 秒走って、また失敗するか
  prev = b.p.slice(); let bad = null
  for (let s = 0; s < 180 && !bad; s++) { const inp = botInput(bot, b); w.tick(); const ev = []; stepBike(w, b, inp, ev); const j2 = judge(w, c, R, b, prev); prev = b.p.slice(); if (b.crashed) { bad = '転倒'; if (process.env.DBG) console.log('bad', i, 'spawn', bi, z.kind, 'crash', b.crashed.why, 'ahead', [...new Set(c.path.slice(bi, bi + 30).map(x => x.kind))].join(','), 's', s) }; if (j2.respawn) bad = bad || '落ちた' }
  if (bad) { cnt.危ない++; if (ex.length < 12) ex.push({ i, 出した所: z.kind, zone: z.zone, bad }) }
  if (BAD.has(z.kind) && ex.length < 20) ex.push({ i, 動く床: z.kind, zone: z.zone, flag: j.respawn.cp != null })
}
back.sort((a, b) => a - b); cnt.戻った距離の中央 = +(back[back.length >> 1] || 0).toFixed(1); cnt.戻った距離の最大 = +(back[back.length - 1] || 0).toFixed(1)
console.log(MODE, JSON.stringify(cnt)); for (const e of ex) console.log(' ', JSON.stringify(e))
