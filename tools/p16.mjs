// v16 の仕掛けの単体の試し: node tools/p16.mjs <仕掛け> [速さ,...]  → 入る速さごとに、一定の速さを保って走った結果
import { World, createBike, stepBike, DT } from '../js/physics.js'
import { Builder } from '../js/course.js'
import * as P16 from '../js/parts16.js'
import { settle } from '../js/run.js'
const which = process.argv[2] || 'gear', speeds = (process.argv[3] || '3,5,7,9,11,13').split(',').map(Number)
export function mini(fn) {
  const B = new Builder([0, 10, 0], 0); B.plats = []; B.props = []
  B.road(30, { w: 4, mat: 'grate', thick: 0.6 }); B.cp('s', { w: 4, rest: true }); B.mark('m')
  const y0 = B.t.p[1]; fn(B); B.road(10, { w: 4, mat: 'grate', thick: 0.6 }); B.cp('g', { w: 4, finish: true })
  const c = P16.finish16(B, { id: 'mini', killBelow: 8 }); c.y0 = y0; return c
}
const O = JSON.parse(process.env.O || '{}')
const builds = { gear: B => P16.gearRun(B, O), groove: B => P16.wheelieGrooves(B, O), swing: B => P16.swingBridge(B, O.len || 22, O), chimney: B => P16.chimney(B, O), kick: B => P16.springPlank(B, O) }
const c = mini(builds[which])
for (const v of speeds) {
  const w = new World(c.shapes); w.winds = c.winds; w.setTime(0)
  const q = c.path.find(q => q.kind !== 'road') , i0 = c.path.indexOf(q) - (process.env.BACK != null ? +process.env.BACK : 12), s0 = c.path[i0]
  const b = settle(w, createBike({ p: [s0.p[0], s0.p[1] + 0.79, s0.p[2]], yaw: 0 })); b.v = [process.env.V0 ? +process.env.V0 : v, 0, 0]
  let res = 'timeout', maxX = 0, log = []
  for (let s = 0; s < 60 * (+process.env.SEC || 12); s++) {
    const air = !b.g[0] && !b.g[1]
    const wh = process.env.WH && !air; const inp = wh ? (b.speed < v - 0.3 && b.th > 0.25 ? { thr: 1, brk: 0, lean: b.th > 0.55 ? 1 : 0, steer: 0 } : { thr: b.th < 0.35 ? 1 : b.th < 0.55 ? 0.45 : 0, brk: b.speed > v + 0.6 ? 0.3 : 0, lean: b.th > 0.65 ? 1 : b.th > 0.45 ? 0 : -1, steer: 0 }) : { thr: b.speed < v ? 1 : 0, brk: b.speed > v + 1.5 ? 0.3 : 0, nitro: process.env.NITRO ? 1 : 0, lean: air ? Math.max(-1, Math.min(1, (b.th - (+process.env.TH || -0.1)) * 3 + b.w * 0.5)) : 0, steer: 0 }
    w.tick(); const ev = []; stepBike(w, b, inp, ev)
    if (s % (+process.env.EVERY || 15) === 0) log.push(`${b.p[0].toFixed(1)}/${(b.p[1] - c.y0).toFixed(1)}/${b.speed.toFixed(1)}/${(b.th*57.3).toFixed(0)}/${+b.g[0]}${+b.g[1]}`)
    if (b.crashed) { res = 'crash ' + b.crashed.why + ' x=' + b.p[0].toFixed(1); break }
    if (b.p[1] < c.y0 - 9) { res = 'fall x=' + b.p[0].toFixed(1); break }
    const end = c.marks[0].end; if (Math.hypot(b.p[0] - end[0], b.p[2] - end[2]) < 2 && Math.abs(b.p[1] - 0.79 - end[1]) < 1.5) { res = 'OK t=' + (s * DT).toFixed(1); break }
  }
  console.log('v', v, res, process.env.LOG ? log.join(' ') : '')
}
