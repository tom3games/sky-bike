// ブレーキの検査: 平らな所と下り坂で、いろいろな速さからブレーキ全開（体重は真ん中）にして、前に転ぶか数える。
// あわせて、前体重＋ブレーキで前輪で立てる（ジャックナイフ）ことも確かめる。後ろへ下がる速さも測る
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { createSteer, steerFor, resetSteer } from '../js/steer.js'
let flips = 0, tries = 0, maxNose = 0, jk = 0, jkTries = 0, falls = 0, hits = 0; const ex = []
for (const cid of ['practice', 'stage1']) {
  const c = COURSES[cid](), w = new World(c.shapes); w.winds = c.winds || []
  const pts = c.path.map((q, i) => ({ q, i })).filter(({ q, i }) => i + 40 < c.path.length && q.p && q.w >= 2 && (q.slope || 0) <= 0.02 && !c.path.slice(i, i + 30).some(z => ['jump', 'stepUp', 'stepDown', 'lip', 'uturn', 'pad', 'crumble'].includes(z.kind) || !z.w))
  for (let k = 0; k < pts.length; k += 9) for (const v of [4, 8, 12, 16]) {
    const { q } = pts[k], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = createSteer(c.path); resetSteer(st, b)
    const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], sl = q.slope || 0; b.v = [f[0] * v * Math.cos(sl), v * Math.sin(sl), f[2] * v * Math.cos(sl)]
    let nose = 0, ev = [], fell = false, hit = false, pv = b.speed
    for (let s = 0; s < 150; s++) { stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: steerFor(st, b) }, ev); if (b.p[1] < q.p[1] - 1.2) { fell = true; break } if (b.side.some(x => x && x.depth > 0.01) || pv - b.speed > 0.4) hit = true; pv = b.speed; if (b.g[0] || b.g[1]) nose = Math.min(nose, b.th - sl) }
    if (fell) { falls++; continue }
    if (hit) { hits++; continue }
    tries++; maxNose = Math.min(maxNose, nose)
    if (ev.some(e => e.t === 'crash') || nose < -0.8) { flips++; if (ex.length < 6) ex.push({ cid, i: pts[k].i, v, nose: +(nose * 57.3).toFixed(0), kind: q.kind }) }
  }
  // ジャックナイフ: 前体重＋ブレーキで後輪が浮くか（平らな所、6m/s）
  for (let k = 0; k < pts.length; k += 25) {
    const { q } = pts[k], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
    const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f[0] * 6, 0, f[2] * 6]
    let up = false
    for (let s = 0; s < 60; s++) { stepBike(w, b, { thr: 0, brk: 1, lean: 1, steer: 0 }); if (!b.g[0] && b.g[1]) up = true }
    jkTries++; if (up) jk++
  }
}
// 後ろへ下がる速さ（止まってブレーキを押し続ける。3 秒後）
const c = COURSES.practice(), w = new World(c.shapes), q = c.cps[0]
const b = settle(w, createBike({ p: [q.p[0] + 6, q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
for (let s = 0; s < 180; s++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
console.log('例', JSON.stringify(ex)); console.log(`（道の端から落ちた ${falls}・物に当たった ${hits} は数えない）ブレーキ全開で前転 ${flips}/${tries}（前へ傾いた最大 ${(maxNose * 57.3).toFixed(0)}度）／ 前体重＋ブレーキで前輪立ち ${jk}/${jkTries} ／ 後ろへ下がる速さ ${(-b.speed).toFixed(2)} m/s`)
