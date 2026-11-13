// 全開ウィリー中に後ろへ傾いていく速さ（度/秒）: 平らな所を 2〜8m/s で走り、後ろ体重（強さ 0.5〜1）＋アクセル全開を 3 秒押し続け、
// 前輪が浮いて車体が 30〜80 度の間にある時の、後ろへ回る速さの平均。物理のファイルを引数で選べる（前後の比べ用）
const P = await import(process.argv[2] || '../js/physics.js')
const { COURSES } = await import('../js/course.js')
const c = COURSES.practice(), w = new P.World(c.shapes), q = c.cps[0]
let sum = 0, n = 0, loops = 0, runs = 0
for (const v of [2, 3, 4, 5, 6, 7, 8]) for (const lean of [-1, -0.75, -0.5]) {
  const b = P.createBike({ p: [q.p[0] + 2, q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 20; k++) P.stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
  b.v = [Math.cos(q.yaw) * v, 0, -Math.sin(q.yaw) * v]; b.revT = 0
  let looped = false
  for (let s = 0; s < 180; s++) { P.stepBike(w, b, { thr: 1, brk: 0, lean, steer: 0 }); if (!b.g[1] && b.th > 0.52 && b.th < 1.4) { sum += b.w; n++ } if (b.th > 1.6) looped = true }
  runs++; if (looped) loops++
}
console.log(`後ろへ傾く速さの平均 ${(sum / n * 57.3).toFixed(1)} 度/秒（30〜80度の間）・宙返りまで行った ${loops}/${runs}`)
