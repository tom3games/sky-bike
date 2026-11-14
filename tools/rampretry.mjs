// 最初のジャンプ台を何回でも跳べるか（v29）: 旗「塔の根もと」から、遅い・ちょうど・速いの順に 3 回続けて跳ぶ。
// 失敗（切れ目に落ちる・転ぶ）したら台の手前に戻り、次の回も台で踏み切れる（launch が毎回出る）。ゲームと同じルール（run.js）。 node tools/rampretry.mjs
import { World, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { spawnAtCp, judge, doRespawn } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
const lipI = P.findIndex(q => q.kind === 'lip'), lip = P[lipI].p, f = [Math.cos(P[lipI].yaw), 0, -Math.sin(P[lipI].yaw)]
const al = p => (p[0] - lip[0]) * f[0] + (p[2] - lip[2]) * f[2]
const R = { cp: 0, rest: 0 }
let b = spawnAtCp(w, c, 0), st = S.createSteer(P); S.resetSteer(st, b)
const out = []
for (const [nm, vmax] of [['遅い（7m/s）', 7], ['ちょうど（全開）', 99], ['もう一度 遅い（6m/s）', 6], ['全開', 99]]) {
  let launched = false, result = '', prev = b.p.slice()
  for (let s = 0; s < 60 * 20; s++) {
    let inp = { thr: b.speed < vmax ? 1 : 0, brk: 0, lean: 0, steer: S.steerFor(st, b) }; inp = S.assist(st, b, inp)
    if (!b.g[0] && !b.g[1]) inp = { ...inp, lean: b.th > 0.1 ? 0.6 : b.th < -0.25 ? -0.6 : 0 }
    const ev = []; w.tick && w.tick(); stepBike(w, b, inp, ev)
    if (ev.some(e => e.t === 'launch') || (!launched && al(b.p) > -1 && al(b.p) < 8 && !b.g[0] && !b.g[1] && b.p[1] > lip[1] + 0.2)) launched = true
    const j = judge(w, c, R, b, prev); prev = b.p.slice()
    if (j.respawn) { b = doRespawn(w, c, R, j.respawn); S.resetSteer(st, b); result = `失敗→出し直し（台から ${al(b.p).toFixed(1)}m の所${al(b.p) < -10 ? '・台の手前' : ''}）`; break }
    if (al(b.p) > 13 && (b.g[0] || b.g[1]) && Math.abs(b.speed) < 0.5) { result = '着地して先へ'; b = spawnAtCp(w, c, 0); S.resetSteer(st, b); R.cp = 0; break }
  }
  if (!result) result = `止まった（台から ${al(b.p).toFixed(1)}m・速さ ${b.speed.toFixed(1)}・転倒 ${!!b.crashed}）`
  out.push([`${nm}: 台で踏み切った ${launched}・${result}`, launched && result])
}
for (const [t, ok] of out) console.log(ok ? 'ok  ' : 'FAIL', t)
// 台の横から広場に落ちた時: 広場からアクセルだけで台へ戻って、また跳べるか
{ const { createBike } = await import('../js/physics.js'); const { settle } = await import('../js/run.js')
  const r = [Math.sin(P[lipI].yaw), 0, Math.cos(P[lipI].yaw)]
  for (const [nm, a0, l0] of [['台の横（右）', -3, 4.2], ['台の横（左）', -2, -4.2], ['切れ目の横', 3, 4.5]]) {
    const p = [lip[0] + f[0] * a0 + r[0] * l0, 0.5 + 0.79, lip[2] + f[2] * a0 + r[2] * l0]
    let bb = settle(w, createBike({ p, yaw: P[lipI].yaw })); const st2 = S.createSteer(P); S.resetSteer(st2, bb); const R2 = { cp: 0, rest: 0 }
    let launched = false, res = '', prev = bb.p.slice()
    for (let s = 0; s < 60 * 25; s++) { let inp = { thr: 1, brk: 0, lean: 0, steer: S.steerFor(st2, bb) }; inp = S.assist(st2, bb, inp); stepBike(w, bb, inp, [])
      if (!launched && al(bb.p) > -1 && al(bb.p) < 8 && !bb.g[0] && !bb.g[1] && bb.p[1] > lip[1] + 0.2) launched = true
      const j = judge(w, c, R2, bb, prev); prev = bb.p.slice(); if (j.respawn) { bb = doRespawn(w, c, R2, j.respawn); S.resetSteer(st2, bb); res = res || `出し直し（台から ${al(bb.p).toFixed(1)}m）` } if (launched) break }
    console.log(launched || /-\d/.test(res) ? 'ok  ' : 'FAIL', `${nm}: 25 秒以内に台で跳べた ${launched} ${res}・最後 台から ${al(bb.p).toFixed(1)}m`) } }
