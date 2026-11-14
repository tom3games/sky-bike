// 跳ね板（v29）: 全部の跳ね板で、(1) 続けて 3 回跳ねる（板の手前から 3 回・失敗して板の上に残ったら下がって乗り直す）、(2) 板の上でブレーキ長押しで下がれる。
// node tools/kicktest.mjs
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
let fails = 0
const say = (ok, t) => { if (!ok) fails++; console.log(ok ? 'ok  ' : 'FAIL', t) }
for (const cid of ['stage1', 'lab16']) {
  const c = COURSES[cid](), P = c.path, w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
  const boards = []; P.forEach((q, i) => { if (q.kind === 'kick' && !boards.some(x => x.m === q.kick.m)) boards.push({ i, m: q.kick.m, q }) })
  for (const [n, B] of boards.entries()) {
    const m = B.m, f = m.f, st = m.start, yaw = B.q.yaw
    const at = d => [st[0] + f[0] * d, st[1] + 0.79, st[2] + f[2] * d]
    const run = (b, inpF, sec) => { let kicks = 0; for (let s = 0; s < 60 * sec; s++) { const ev = []; w.tick(); stepBike(w, b, inpF(b), ev); if (ev.some(e => e.t === 'kick')) kicks++ } return kicks }
    // (1) 板の手前 5m から、7m/s で 3 回続けて（前の回の 1.2 秒後に次）
    let k3 = 0
    for (let r = 0; r < 3; r++) { const b = settle(w, createBike({ p: at(-5), yaw })); b.v = [f[0] * 7, 0, f[2] * 7]; k3 += run(b, b => ({ thr: b.speed < 7 ? 1 : 0, brk: 0, lean: 0, steer: 0 }), 2.5) }
    say(k3 === 3, `${cid} 跳ね板 ${n + 1}: 手前から 2.5 秒おきに 3 回 → 跳ねた ${k3} 回`)
    // (2) 板の上（引き金の手前）で止まって、ブレーキ長押しで板から下がる → 前へ出てまた跳ねる。3 回（毎回 板の上に置き直す）
    let k = 0, backOk = 0, cr = false
    for (let r = 0; r < 3; r++) {
      w.setTime(w.time + 4)
      const b = settle(w, createBike({ p: at(1.1), yaw }))
      run(b, () => ({ thr: 0, brk: 1, lean: 0, steer: 0 }), 2.0)
      const al = (b.p[0] - st[0]) * f[0] + (b.p[2] - st[2]) * f[2]; if (al < 0 && !b.crashed) backOk++; if (process.env.DBG) console.log('   after back crashed', JSON.stringify(b.crashed && b.crashed.why), 'y', (b.p[1]-st[1]).toFixed(2))
      k += run(b, b => ({ thr: b.speed < 7 ? 1 : 0, brk: 0, lean: 0, steer: 0 }), 3.5); cr = cr || !!b.crashed
      if (process.env.DBG) console.log('  round', r, 'back to al', al.toFixed(2), 'end al', ((b.p[0] - st[0]) * f[0] + (b.p[2] - st[2]) * f[2]).toFixed(2), 'v', b.speed.toFixed(1), 'cr', JSON.stringify(b.crashed && b.crashed.why), 'th', b.th.toFixed(2), 'armed', m.armed, 'trig', m.trig)
    }
    say(k === 3 && backOk === 3, `${cid} 跳ね板 ${n + 1}: 板の上で止まってブレーキ長押しで下がる→前へ出て跳ねる を 3 回 → 下がれた ${backOk} 回・跳ねた ${k} 回`)
  }
}
process.exit(fails ? 1 : 0)
