// SKY BIKE v45 最後の塔（落石の坂の後、天空城への大ジャンプの前）: 太い塔のまわりを角の丸い四角に左回りで登る。
// 1 辺に技を 1 つずつ（動く床の段・縁から杭・跳ね板から縁・動く床と縁・縁の三段・ニトロの急坂・上がる床・溝と跳び）。同じ形を続けない。
// どの周も同じ四角の上に重なる（辺の長さを S にそろえる）ので、最後の周を抜けた所は、最初の辺と同じ向き・同じ位置の真上。
// 大ジャンプと天空城は、前と同じ場所のまま高さだけ上がる（v37added に数えるので、罠・猿・壁画の置き場所もずれない）
import { stepLift, pegRow } from './parts17.js?v=47'
import { springPlank, wheelieGrooves } from './parts16.js?v=47'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
export const TOWER45 = { S: 46, R: 8, rise: 3, r: 20 } // 辺の長さ・角の半径・角で上がる高さ・塔の半径

export function v45(B) {
  const { S, R, rise } = TOWER45, D = { w: 4.2, mat: 'castle', thick: 1.2 }
  B.decor = B.decor || []
  B.zone = 'castle'
  const s0 = B.t.p.slice(), yaw0 = B.t.yaw, f0 = B.dir(yaw0), L0 = B.right(yaw0).map(v => -v)
  // 塔の中心: 最初の辺の真ん中から左へ S/2 + R
  const cx = s0[0] + f0[0] * S / 2 + L0[0] * (S / 2 + R), cz = s0[2] + f0[2] * S / 2 + L0[2] * (S / 2 + R)
  B.v45 = { cx, cz, r: TOWER45.r, y0: s0[1], laps: [] }
  let sideN = 0
  // 1 辺: 始まりから前へ S ちょうどまで（足りない分は平らな道で埋める）。それから左へ 90 度、rise 上がる角
  const side = (fn) => {
    const a = B.t.p.slice(), f = B.dir(B.t.yaw)
    fn()
    const d = (B.t.p[0] - a[0]) * f[0] + (B.t.p[2] - a[2]) * f[2]
    if (d > S - 0.5) throw new Error(`v45 side ${sideN} too long ${d.toFixed(2)}`)
    B.road(S - d, { ...D, back: 0 })
    if (sideN % 2 === 0) B.torch(1, -3, { w: 4.2, down: 1 })
    B.curve(R, 90 * DEG, { ...D, w: 4.6, rise, pw: 4.2 })
    sideN++
  }
  // ---------------- 1 周目
  side(() => {
    B.road(3, D)
    B.cp('最後の塔の根もと', { w: 4.2, rest: true })
    B.mark('最後の塔 動く床の段')
    B.road(10, { ...D, slope: 9 * DEG })
    B.road(14, { w: 3.2, mat: 'grate', thick: 0.6, back: 0 })
    stepLift(B, {})
  })
  side(() => {
    B.mark('最後の塔 縁から杭')
    B.road(6, { w: 3.2, mat: 'cobble', thick: 1.0, back: 0 })
    B.hangLedge(1.6, 3.2, { w: 3.2, mat: 'cobble', max: 10 })
    pegRow(B, { rise: globalThis.__pr ?? 0.2 })
    B.road(3, { w: 3.2, mat: 'cobble', thick: 1.0, back: 0 })
  })
  side(() => {
    B.road(3, D)
    B.cp('跳ね板の前', { w: 4.2, rest: true })
    B.mark('最後の塔 跳ね板から縁')
    B.road(12, { w: 3.2, mat: 'castle', thick: 1.0, back: 0 })
    springPlank(B, { beam: false, k0: 7.4, kv: 0, vxMax: 7.5, after: 3 })
    B.hangLedge(1.6, 3.4, { w: 4, mat: 'castle', max: 8 })
  })
  side(() => {
    B.mark('最後の塔 動く床と縁')
    B.road(5, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
    B.mover('fwd', { len: 9, size: 3, w: 3.0, dwell: 2.2, move: 2.8 })
    B.road(1.5, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
    B.hangLedge(1.6, 5, { w: 3.0, mat: 'rust', max: 8, thick: 0.8 })
  })
  B.v45.laps.push(B.t.p[1])
  // ---------------- 2 周目
  side(() => {
    B.road(3, D)
    B.cp('最後の塔の中ほど', { w: 4.2, rest: true })
    B.mark('最後の塔 縁の三段')
    B.road(8, { ...D, back: 0 })
    B.hangLedge(1.6, 3.2, { w: 4.2, mat: 'castle', max: 9 })
    B.hangLedge(1.6, 3.2, { w: 4.2, mat: 'castle', max: 9 })
    B.hangLedge(1.6, 4, { w: 4.2, mat: 'castle', max: 9 })
  })
  side(() => {
    B.mark('最後の塔 ニトロの急坂')
    B.can(3)
    B.road(12, { ...D, back: 0 })
    B.road(2.8, { ...D, slope: 18 * DEG, mat: 'rust' })
    B.road(12, { ...D, slope: 40.5 * DEG, mat: 'rust', kind: 'steep', mu: 0.95 })
    { const i1 = B.path.length; for (let j = i1 - 12; j < i1; j++) B.path[j].nitro = true }
    B.road(2.8, { ...D, slope: 18 * DEG, mat: 'rust' })
    B.road(4, D)
  })
  side(() => {
    B.mark('最後の塔 上がる床')
    B.road(6, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
    B.mover('up', { rise: 3.2, size: 3.2, w: 3.0, dwell: 2.4, move: 2.6 })
    B.road(1.2, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
    B.step(0.6); B.road(5, { w: 3.0, mat: 'rust', thick: 1.0, noOverlap: true })
  })
  side(() => {
    B.road(3, D)
    B.cp('最後の塔の上のほう', { w: 4.2, rest: true })
    B.mark('最後の塔 溝と跳び')
    B.road(6, { w: 3.2, mat: 'castle', thick: 1.0, back: 0 })
    wheelieGrooves(B, { hang: 1.2, n: 3, land: 1.0, lip: 0.07, depth: 0.25 })
    B.road(10, { ...D, back: 0 })
    { const rise2 = B.kicker(3, 16 * DEG, { w: 3.6, mat: 'plank', thick: 0.7 }); B.path[B.path.length - 1].vNeed = 10
      B.gap(6.4, -rise2, 'jump'); B.path[B.path.length - 1].vJump = 9.2 }
    B.road(6, { ...D, kind: 'landing', back: 0 })
  })
  B.v45.laps.push(B.t.p[1])
  B.closeMark()
  return { s0, yaw0 }
}

// 塔の本体（v45 の周の内側。当たりあり）。頂上の崩れは v46
export function v45tower(B, top) {
  const T = B.v45; if (!T) return
  T.top = T.top ?? top
  B.cyl({ a: [T.cx, (B.lavaY ?? 0) - 4, T.cz], b: [T.cx, T.top, T.cz], r: T.r, mat: 'tower', tag: 'tower', zone: 'tower' })
}
