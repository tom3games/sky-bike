// 出発の大ジャンプ台へ ゆっくり（1〜6m/s）入る走りで、頭を打って転ぶか数える。
// 入り方: 一定の速さを保つ（アクセルを踏み足す）・アクセル全開・台の上で止まる（ブレーキ）の3通り × 重心 前/中/後
import { World, createBike, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { createSteer, steerFor, resetSteer } from '../js/steer.js'
const c = COURSES.stage1(), w = new World(c.shapes); w.winds = c.winds || []
const name = process.env.MARK || '出発の大ジャンプ'
const m = c.marks.find(m => m.name === name)
const q = c.path[m.i0]
// 調べるのは台と着地坂まで（その先の段は別の検査）
let iEnd = m.i0; for (let i = m.i0; i <= m.i1; i++) if (c.path[i].kind === 'landing') iEnd = i + 2
let n = 0, crash = 0; const rows = []
for (const v of [1, 2, 3, 4, 5, 6]) for (const mode of ['保つ', '全開', '台で止まる']) for (const lean of [-0.6, 0, 0.6]) {
  const b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = createSteer(c.path); resetSteer(st, b)
  const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)]; b.v = [f[0] * v, 0, f[2] * v]
  let why = null, sCross = 0
  for (let s = 0; s < 60 * 12 && !why; s++) {
    const steer = steerFor(st, b)
    const k = c.path[st.i].kind
    let inp
    if (mode === '保つ') inp = { thr: b.speed < v ? 1 : 0, brk: 0, lean, steer }
    else if (mode === '全開') inp = { thr: 1, brk: 0, lean, steer }
    else inp = (k === 'ramp' || k === 'lip' || sCross) ? (sCross = sCross || s, { thr: 0, brk: 1, lean, steer }) : { thr: b.speed < v ? 1 : 0, brk: 0, lean, steer }
    const ev = []; stepBike(w, b, inp, ev)
    if (b.crashed) why = b.crashed.why
    if (st.i > iEnd) break
    if (sCross && s - sCross > 180) break
  }
  n++; if (why) { crash++; rows.push({ v, mode, lean, why, at: c.path[st.i].kind, i: st.i - m.i0, th: Math.round(b.th * 57.3), sp: +b.speed.toFixed(1), y: +(b.p[1]).toFixed(2) }) }
}
console.log(`${name} に ゆっくり入る ${n} 本: 転倒 ${crash}`)
for (const r of rows) console.log(' ', JSON.stringify(r))
