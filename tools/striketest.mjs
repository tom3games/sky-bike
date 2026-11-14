// カラスの体当たり（v32）: その場所を速さを変えて 10 回通し、転倒・はみ出しの数と、横のずれ（当たらなかった時との差）を出す。
// ゲームと同じ自動ハンドルと減速（steer.js）・同じ押し方（strike.js）。 node tools/striketest.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { strikerSpot, crowPush } from '../js/strike.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, Sp = strikerSpot(c)
console.log('場所 道の点', Sp.i, '幅', Sp.w)
const hx = Math.cos(Sp.yaw), hz = -Math.sin(Sp.yaw), rx = Math.sin(Sp.yaw), rz = Math.cos(Sp.yaw)
const run = (v, strike, nitro) => {
  const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  let k = Sp.i, d = 0; while (d < 18) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- }
  const q = P[k], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); b.v = [Math.cos(q.yaw) * v, 0, -Math.sin(q.yaw) * v]
  const st = S.createSteer(P); S.resetSteer(st, b); const tr = []; let hit = false, off = false
  for (let s = 0; s < 60 * 6; s++) { let inp = S.assist(st, b, { thr: b.speed < v ? 1 : 0, brk: 0, lean: 0, steer: S.steerFor(st, b), nitro: nitro ? 1 : 0 }); stepBike(w, b, inp, []); if (strike) { const r = crowPush(b, Sp); if (r && r.t === 'hit') hit = true }
    const dx = b.p[0] - Sp.p[0], dz = b.p[2] - Sp.p[2], along = dx * hx + dz * hz, lat = dx * rx + dz * rz; tr.push([along, lat]); if (Math.abs(lat) > Sp.w / 2 - 0.2 && along > -2 && along < 20) off = true; if (along > 25) break }
  return { tr, hit, crashed: !!b.crashed, off, vEnd: b.speed }
}
let crash = 0, offN = 0; const rows = []
for (const [v, nit] of [[4, 0], [6, 0], [8, 0], [10, 0], [12, 0], [13, 0], [13.5, 0], [16, 1], [19, 1], [21, 1]]) {
  const a = run(v, true, nit), b0 = run(v, false, nit)
  let dmax = 0; for (let i = 0; i < Math.min(a.tr.length, b0.tr.length); i++) if (a.tr[i][0] > -1 && a.tr[i][0] < 25) dmax = Math.max(dmax, Math.abs(a.tr[i][1] - b0.tr[i][1]))
  if (a.crashed) crash++; if (a.off) offN++
  rows.push({ 速さ: v, ニトロ: !!nit, 当たった: a.hit, 横のずれm: +dmax.toFixed(2), 転倒: a.crashed, 当たらない時の転倒: b0.crashed, はみ出し: a.off, 後の速さ: +a.vEnd.toFixed(1) })
}
console.table(rows); console.log(`転倒 ${crash}・はみ出し ${offN}`)
