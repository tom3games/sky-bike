// v77 隕石の検査（node）。node tools/meteortest.mjs [full]
//  1) 止まる bot（前体重で止まる。坂でも下がらない）: 20m より上の、待つ仕掛けから離れた道の上で手を離す → 5 秒で着弾・乗り手が飛ぶ転倒（why meteor）。4.9 秒では落ちない
//  2) 動き出せば消える: 4 秒止まって少し進む → 落ちない
//  3) 低い所（練習の区間）・旗のそば では 10 秒止まっても落ちない
//  4) full: 上手い bot・人の速さの bot の通しで、落ちる回数（落とさず数える）＝ 0
import { World, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { spawnAt, judge, doRespawn } from '../js/run.js'
import { meteorBlock, METEOR } from '../js/meteor.js'
import { runSim } from './sim.mjs'
const c = COURSES.stage1()
let ng = 0; const ok = (k, cond, info = '') => { console.log((cond ? 'ok ' : 'NG ') + k, info); if (!cond) ng++ }
const Z = { thr: 0, brk: 0, lean: 1, steer: 0 } // 止まる人: 前体重（止まっている時は前体重だけでブレーキが掛かり、坂でも下がらない）
function trial(i, holdSec, o = {}) {
  const w = new World(c.shapes); w.winds = c.winds || []
  const q = c.path[i], R = { cp: 0, rest: 0 }
  let b = spawnAt(w, { p: q.p, yaw: q.yaw })
  let first = null, ph = [], hitAt = null, blocks = {}
  for (let s = 0; s < holdSec * 60; s++) {
    const prev = b.p.slice(); w.tick()
    const inp = o.inp ? o.inp : o.moveAt != null && s >= o.moveAt * 60 && s < o.moveAt * 60 + 50 ? { thr: 1, brk: 0, lean: 0, steer: 0 } : o.moveAt != null && s >= o.moveAt * 60 + 50 ? { thr: 0, brk: 1, lean: 0, steer: 0 } : Z
    stepBike(w, b, inp, [])
    const j = judge(w, c, R, b, prev)
    const bk = meteorBlock(w, c, R, b); blocks[bk || 'count'] = (blocks[bk || 'count'] || 0) + 1
    if (j.meteor) { ph.push(j.meteor.ph + (j.meteor.why ? ':' + j.meteor.why : '') + '@' + (s / 60).toFixed(2)); if (j.meteor.ph === 'hit') hitAt = s / 60 }
    if (j.respawn) { first = first || { s: s / 60, crashed: b.crashed && b.crashed.why }; break }
  }
  return { hitAt, ph, first, crashed: b.crashed && b.crashed.why, blocks, mt: R.mt }
}
// 試す所: 20m より上で、数える状態（null）の道の点を区間ごとに選ぶ
const w0 = new World(c.shapes)
const cand = []
for (let i = 500; i < c.epi.i0; i += 7) { const q = c.path[i]; if (!q.p || !['road', 'orbit', 'curve'].includes(q.kind) || Math.abs(q.slope || 0) > 0.05) continue; if (q.p[1] - c.cps[0].p[1] < METEOR.minAlt + 1) continue
  const R = { onI: i }; const b = { p: [q.p[0], q.p[1] + 0.79, q.p[2]], g: [true, true], cn: [null, null], carryId: -1 }; if (meteorBlock(w0, c, R, b) == null) cand.push(i) }
console.log('数える道の点の候補', cand.length)
const picks = [0.05, 0.2, 0.35, 0.5, 0.65, 0.8, 0.95].map(f => cand[Math.floor(f * (cand.length - 1))])
for (const i of picks) {
  const r = trial(i, 9)
  ok(`止まる bot i=${i} 高さ${(c.path[i].p[1] - c.cps[0].p[1]).toFixed(0)}m で着弾`, r.hitAt != null && Math.abs(r.hitAt - METEOR.hit) < 0.1 && r.first && r.first.crashed === 'meteor', JSON.stringify({ hit: r.hitAt, ph: r.ph, first: r.first }))
}
{ const i = picks[3], r = trial(i, 4.9); ok('4.9 秒では落ちない', r.hitAt == null, JSON.stringify(r.ph)) }
{ const i = picks[3], r = trial(i, 9, { moveAt: 4.0 }); ok('4 秒止まって動き出すと消える（その後また止まっても 5 秒数え直し）', !r.ph.includes('hit@4.99') && r.ph.some(x => x.startsWith('cancel')) && (r.hitAt == null || r.hitAt > 9), JSON.stringify(r.ph)) }
{ // 高い縁・段に全開で挑み続ける（後輪が空回り・前後に揺れる）: 12 秒たっても落ちない
  let n = 0, hit = 0; const seen = []
  for (let i = 400; i < c.epi.i0 && n < 6; i++) { const q = c.path[i]; if (!['hang', 'ledge3', 'lowledge'].includes(q.kind) || q.p[1] - c.cps[0].p[1] < METEOR.minAlt + 2 || seen.some(k => Math.abs(k - i) < 200)) continue; seen.push(i); n++
    const r = trial(i - 5, 12, { inp: { thr: 1, brk: 0, lean: 0, steer: 0 } }); if (r.hitAt != null) { hit++; console.log('  hit at', i, q.kind, JSON.stringify(r.blocks), r.mt && r.mt.tp) } }
  ok(`高い縁に全開で挑み続ける ${n} か所で 12 秒落ちない`, hit === 0 && n > 0, 'hit ' + hit) }
{ // 低い所
  const i = c.path.findIndex((q, k) => k > 200 && q.p && q.kind === 'road' && q.p[1] - c.cps[0].p[1] < 10); const r = trial(i, 10); ok(`低い所 i=${i} では 10 秒止まっても落ちない`, r.hitAt == null, JSON.stringify(r.blocks)) }
{ // 旗のそば
  let n = 0, hit = 0; for (const [k, q] of c.cps.entries()) { if (!q.rest || q.p[1] - c.cps[0].p[1] < METEOR.minAlt || k >= 59) continue; const i = c.path.reduce((bi, p, j) => p.p && Math.hypot(p.p[0] - q.p[0], p.p[2] - q.p[2]) + Math.abs(p.p[1] - q.p[1]) * 3 < (c.path[bi].p ? Math.hypot(c.path[bi].p[0] - q.p[0], c.path[bi].p[2] - q.p[2]) + Math.abs(c.path[bi].p[1] - q.p[1]) * 3 : 1e9) ? j : bi, 0); const r = trial(i, 7); n++; if (r.hitAt != null) hit++ }
  ok(`旗のそば ${n} か所で 7 秒止まっても落ちない`, hit === 0, 'hit ' + hit) }
if (process.argv[2] === 'full') {
  globalThis.__meteorDry = 1
  for (const [skill, react] of [['good', 0], ['good', 12]]) {
    let R0 = null
    const t0 = Date.now(), r = runSim('stage1', skill, { maxSec: 2400, react, onR: R => { R0 = R } })
    console.log(skill, react, 'finished', r.finished, 'time', r.time.toFixed(1), 'faults', r.faults, 'wall', ((Date.now() - t0) / 1000).toFixed(0) + 's')
    const log = (r.R && r.R.mt && r.R.mt.log) || []
    ok(`${skill} react=${react} の通しで隕石 0（落とさず数えた）`, log.length === 0, JSON.stringify(log.slice(0, 12)))
  }
}
console.log(ng ? `NG ${ng}` : 'NG 0')
