// 縁に前輪を引っ掛けて耐える検査: 高さ 1.6m の縁。人の速さの bot（反応 0.15 秒・体重の直しが粗い）で、
// ゆっくりウィリーで近づいて前輪を掛け → ブレーキで耐えて N 秒待つ → 前体重＋アクセルで登る。成功の割合と、何もしない時に何秒で落ちるか
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { Builder } from '../js/course.js'
import { settle } from '../js/run.js'
const H = +(process.env.H || 1.6)
function course(max) { const B = new Builder([0, 0, 0], 0); B.solid = true; B.base = -2; B.road(14, { w: 4, mat: 'stone', thick: 1 }); B.hangLedge(H, 10, { w: 4, max }); return B }
const rows = []
for (const [name, wait, react, rough] of [['上手い（待ち 3 秒）', 3, 0, 0], ['人の速さ（待ち 3 秒）', 3, 9, 0.25], ['人の速さ（待ち 6 秒）', 6, 9, 0.25], ['何もしない（引っ掛けた後）', 99, 0, 0], ['ブレーキだけ', 99, 0, 0]]) {
  let ok = 0, n = 0, caught = 0, tFall = []
  for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) for (const d0 of [3, 6]) {
    const c = course(8), w = new World(c.shapes); w.winds = []; w.setTime(seed * 0.73)
    const b = settle(w, createBike({ p: [14 - d0, 0.79, 0], yaw: 0 }))
    const hist = []; let res = 'none', hangAt = null
    for (let s = 0; s < 60 * 20; s++) {
      hist.push(b.hang ? { x: b.hang.x, xv: b.hang.xv, slip: b.hang.slip } : null)
      const seen = hist[Math.max(0, hist.length - 1 - react)]
      let inp = { thr: 0, brk: 0, lean: 0, steer: 0 }
      if (!b.hang && !hangAt) { const near = 14 - b.p[0]; inp = { thr: b.speed < 1.2 ? 0.5 : 0, brk: b.speed > 1.8 ? 0.4 : 0, lean: near < 2.6 ? -1 : 0, steer: 0 } }
      if (b.hang) {
        hangAt = hangAt ?? s
        const ht = (s - hangAt) * DT
        if (name.startsWith('何もしない')) inp = { thr: 0, brk: 0, lean: 0, steer: 0 }
        else if (name === 'ブレーキだけ') inp = { thr: 0, brk: 1, lean: 0, steer: 0 }
        else {
          const x = seen ? seen.x : 0, xv = seen ? seen.xv : 0
          let l = -(x * 1.6 + xv * 0.9); if (rough) l = Math.round(l / 0.5) * 0.5 // 人は体重を細かく調整しにくい
          l = Math.max(-1, Math.min(1, l))
          if (ht < wait) inp = { thr: 0, brk: 1, lean: l, steer: 0 }
          else inp = { thr: 1, brk: 0, lean: Math.max(0.6, l), steer: 0 }
        }
      }
      const ev = []; stepBike(w, b, inp, ev)
      for (const e of ev) if (e.t === 'hangUp') res = 'up'; else if (e.t === 'hangFall' || e.t === 'hangBreak') { if (res === 'none') { res = 'fall'; tFall.push((s - hangAt) * DT) } }
      if (res !== 'none' && res !== 'hanging') { if (res === 'up') { for (let k = 0; k < 60; k++) stepBike(w, b, { thr: 0.4, brk: 0, lean: 0, steer: 0 }, []); if (b.crashed || b.p[1] < H) res = 'upfail' } break }
      if (b.crashed) { res = 'crash'; break }
    }
    n++; if (hangAt != null) caught++; if (res === 'up') ok++
  }
  rows.push({ 走り方: name, 引っ掛けた: `${caught}/${n}`, 登れた: `${ok}/${n}`, 落ちるまでの秒: tFall.length ? +(tFall.reduce((a, b) => a + b) / tFall.length).toFixed(1) : '-' })
}
console.log(`縁の高さ ${H}m・耐えられる上限 8 秒`); console.table(rows)
