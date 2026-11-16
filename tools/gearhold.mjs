// 回る歯車（工場）: アクセル押しっぱなし（ゲームと同じ自動ハンドル＋曲がりの手前の自動減速）で通れてしまわないか。
// node tools/gearhold.mjs → 始める場所（手前の旗・区間の頭）× 歯車の向き（時刻 16 通り）× ニトロ有無。通れた数 / 本数
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import * as S from '../js/steer.js'
const c = COURSES.stage1(), P = c.path, m = c.marks.find(m => m.name === '回る歯車')
const g0 = P.findIndex((q, i) => i >= m.i0 && q.kind === 'gear'), gl = P.findLastIndex((q, i) => i <= m.i1 && q.kind === 'gear'), endI = P.findIndex((q, i) => i > gl && q.kind === 'road')
const NT = +(process.env.NT || 16), rows = []
for (const [nm, back, v0] of [['旗から', g0 - m.i0 + 6, 0], ['区間の頭から 3m/s', g0 - m.i0, 3], ['歯車の 4m 手前で止まってから', 4, 0], ['歯車の手前 8m/s', 6, 8]]) for (const nit of [0, 1]) {
  let ok = 0; const why = {}
  for (let k = 0; k < NT; k++) {
    const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(k * 0.83)
    const q = P[g0 - back], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = S.createSteer(P); S.resetSteer(st, b)
    b.v = [Math.cos(q.yaw) * v0, 0, -Math.sin(q.yaw) * v0]
    let res = '進めない'
    for (let s = 0; s < 60 * 40; s++) {
      let inp = { thr: 1, brk: 0, lean: 0, steer: S.steerFor(st, b), nitro: nit }; if (nit) b.nitro = 1
      if (S.assist) inp = S.assist(st, b, inp)
      w.tick(); stepBike(w, b, inp)
      if (b.crashed) { res = '転倒 ' + b.crashed.why; break }
      if (b.p[1] < P[g0].p[1] - 4) { res = '落下'; break }
      if (Math.hypot(b.p[0] - P[endI].p[0], b.p[2] - P[endI].p[2]) < 2 && Math.abs(b.p[1] - 0.79 - P[endI].p[1]) < 1.2) { res = 'ok'; break }
    }
    if (res === 'ok') ok++; else why[res] = (why[res] || 0) + 1
  }
  rows.push({ 始め: nm, ニトロ: nit ? '押す' : 'なし', 通れた: ok + '/' + NT, 失敗: Object.entries(why).map(([a, n]) => a + n).join(' ') })
}
console.table(rows)
