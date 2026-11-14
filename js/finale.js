// SKY BIKE v32 終盤の 2 区間（天空城の手前）
// 1 崩れ落ちる空中回廊: 走る先で両脇の塔・柱が次々に外へ倒れ、道の先の一部が崩れ落ちる所をジャンプ台で飛び越え、
//   燃料の缶で満タンにしてニトロで崩れる橋を渡り切る。倒れる物は道の外へ倒れる（道には入らない）。理不尽に落とさない
// 2 天空城への大ジャンプ: 急な下りの助走路（缶あり）→ 踏み切り → 4〜6 秒飛んで、天空城の広い着地坂へ。
//   着地坂は、ふつうの速さで飛んだ線に沿わせた形（まっすぐ着けば転ばない）。空中で後ろ体重を続ければ宙返りもできる
import { drum } from './drum.js?v=41'
import { v37 } from './v37.js?v=41'
import { v41 } from './v41.js?v=41'
const DEG = Math.PI / 180
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]

// 大ジャンプの着地坂の形（踏み切りの端からの前の距離 x と高さ y）。tools/finaletune.mjs で、ふつうに飛んだ線から決めた
export const HILL = { x0: 18, pts: null }
const UPF = 5.0, UPX = 118, UPLO = -60 // 上昇気流の強さ（m/s²）・前の長さ・下の端

export function finale(B) {
  const C = { w: 4.2, mat: 'castle', thick: 1.2 }
  B.zone = 'castle'
  B.road(6, { w: 4.2, mat: 'castle', thick: 2.6 })
  B.cp('崩れる回廊の手前', { w: 4.2, rest: true })
  B.mark('崩れ落ちる空中回廊')
  B.decor = B.decor || []
  const fall = (at, side, h, r, delay = 0) => { // 道の脇の塔・柱: 近づくと道の外へ倒れる（見た目だけ。道には入らない）
    const t = B.t, f = B.dir(t.yaw), R = B.right(t.yaw)
    const base = add3(add3(t.p, f, at), R, side * (C.w / 2 + 1.4 + r))
    base[1] -= 1.5
    B.decor.push({ kind: 'fallTower', p: base, h, r, yaw: t.yaw, side, trig: add3(t.p, f, at - 16 - delay * 10), fwd: f })
  }
  B.road(4, C)
  fall(10, 1, 14, 1.4); fall(18, -1, 18, 1.8, 0.3); fall(27, 1, 11, 1.1, 0.2)
  B.road(30, { ...C, kind: 'road' })
  B.torch(1, -2, { w: C.w, down: 1 }); B.torch(-1, -2, { w: C.w, down: 1 })
  // 道の先が崩れ落ちる: ジャンプ台で切れ目を越える（切れ目の所の道の塊は、近づくと落ちる見た目）
  B.road(6, C)
  { const rise = B.kicker(3, 16 * DEG, { w: 3.6, mat: 'plank', thick: 0.7 }); B.path[B.path.length - 1].vNeed = 10
    const t = B.t, f = B.dir(t.yaw)
    B.decor.push({ kind: 'fallChunk', c: add3(add3(t.p, f, 3.4), [0, 1, 0], -rise - 0.6), h: [3.0, 0.6, C.w / 2], yaw: t.yaw, trig: add3(t.p, f, -18) })
    B.gap(6.8, -rise, 'jump'); B.path[B.path.length - 1].vJump = 9.2 }
  B.road(6, { ...C, kind: 'landing', back: 0 })
  fall(4, -1, 16, 1.5); fall(11, 1, 20, 2.0, 0.2)
  B.road(10, C)
  // 左へ曲がりながら、内側の塔が外へ倒れていく
  B.curve(16, 70 * DEG, { ...C, w: 4.6 })
  fall(3, 1, 22, 2.2); fall(10, -1, 14, 1.3, 0.3); fall(16, 1, 12, 1.2, 0.15)
  B.road(18, C)
  // 2 つ目の崩れ落ちる所（少し長い切れ目。助走は十分）
  B.road(4, C)
  { const rise = B.kicker(3.2, 18 * DEG, { w: 3.6, mat: 'plank', thick: 0.7 }); B.path[B.path.length - 1].vNeed = 11
    const t = B.t, f = B.dir(t.yaw)
    B.decor.push({ kind: 'fallChunk', c: add3(add3(t.p, f, 4.2), [0, 1, 0], -rise - 0.6), h: [3.8, 0.6, C.w / 2], yaw: t.yaw, trig: add3(t.p, f, -20) })
    B.gap(8.4, -rise - 0.6, 'jump'); B.path[B.path.length - 1].vJump = 9.8 }
  B.road(8, { ...C, kind: 'landing', back: 0 })
  fall(5, -1, 18, 1.8); fall(12, 1, 15, 1.5, 0.2)
  B.road(14, C)
  B.curve(16, -60 * DEG, { ...C, w: 4.6 })
  fall(4, -1, 20, 2.0); fall(12, 1, 16, 1.6, 0.25)
  B.road(12, C)
  // 燃料の缶 → 崩れる長い橋（ニトロで一気に）
  B.can(3)
  B.road(10, C)
  fall(6, 1, 13, 1.2); fall(14, -1, 15, 1.4, 0.25); fall(22, 1, 17, 1.6, 0.1)
  B.sign('崩れる前に 駆け抜けろ', { at: 2 })
  B.crumbleRun(36, 14, 3.6, 0.32)
  B.road(8, { ...C, kind: 'landing' })
  B.closeMark()
  // ---------------- v35 回る筒（廃工場の巨大な筒の内側を一周する。js/drum.js）
  { const F = { w: 4.2, mat: 'grate', thick: 1.2 }
    B.zone = 'factory'
    B.road(6, F)
    B.cp('回る筒の手前', { w: 4.2, rest: true })
    B.mark('回る筒')
    B.road(12, F)
    B.can(4)
    B.torch(1, -2, { w: 4.2, down: 1 }); B.torch(-1, -2, { w: 4.2, down: 1 })
    B.road(26, { ...F, kind: 'drumRun' })
    drum(B)
    B.road(16, { ...F, back: 0 })
    B.torch(1, -3, { w: 4.2, down: 1 }); B.torch(-1, -3, { w: 4.2, down: 1 })
    B.road(4, F)
    B.closeMark()
    B.zone = 'castle' }
  { const n0 = B.path.length; v37(B); v41(B); B.v37added = B.path.length - n0 } // v41 落石の坂（js/v41.js）も終盤に足した道として数える // v37 真っ暗な通路・明るい草原・風車の羽根・ワイヤーの綱渡り（js/v37.js）
  // ---------------- 天空城への大ジャンプ
  B.road(6, C)
  B.cp('大ジャンプの助走', { w: 4.2, rest: true })
  B.mark('天空城への大ジャンプ')
  B.road(8, { w: 5, mat: 'castle', thick: 1.2 })
  B.can(2)
  B.sign('飛べ', { at: 5 })
  // 急な下りの助走路（ここで速さがつく）
  for (const [len, sl] of [[3, -10], [3, -20], [26, -28], [3, -20], [3, -12], [3, -5], [3, 0]]) B.road(len, { w: 5, mat: 'plank', thick: 0.6, slope: sl * DEG, kind: sl < -25 ? 'runway' : 'road', back: 0 })
  for (const a of [-40, -28, -16, -4]) { B.torch(1, a, { w: 5, down: 1 }); B.torch(-1, a, { w: 5, down: 1 }) }
  const rise = B.kicker(4.5, 13 * DEG, { w: 4.6, mat: 'plank', thick: 0.8 })
  B.path[B.path.length - 1].vNeed = 18
  const lip = B.t.p.slice(), f = B.dir(B.t.yaw), yaw = B.t.yaw
  B.notes = B.notes || []; B.notes.push({ kind: 'megaJump', lip, yaw, rise })
  // 谷の上の上昇気流（下から吹き上げる風。空中で長く浮く）: 踏み切りから着地坂の終わりまで
  { const R = B.right(yaw), corners = []; for (const al of [3, UPX]) for (const l of [-14, 14]) corners.push(add3(add3(lip, f, al), R, l))
    const mn = [Math.min(...corners.map(c => c[0])), lip[1] + UPLO, Math.min(...corners.map(c => c[2]))], mx = [Math.max(...corners.map(c => c[0])), lip[1] + 40, Math.max(...corners.map(c => c[2]))]
    B.winds = B.winds || []; B.winds.push({ min: mn, max: mx, f: [0, UPF, 0], w: 0, ph: Math.PI / 2, updraft: true, lvl: -0.4 })
    B.decor.push({ kind: 'updraft', min: mn, max: mx, lip: lip.slice(), f, yaw }) }
  // 着地坂: HILL.pts（x, y）を板でつなぐ。幅 14m
  const pts = HILL.pts || defaultHill()
  B.path.push({ p: lip.slice(), yaw, slope: 0, w: 0, kind: 'jump', len: pts[0][0] })
  B.t.p = [lip[0] + f[0] * pts[0][0], lip[1] + pts[0][1], lip[2] + f[2] * pts[0][0]]; B.last = null
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k][0] - pts[k - 1][0], dy = pts[k][1] - pts[k - 1][1]
    B.road(Math.hypot(dx, dy), { w: 14, mat: 'snowrock', thick: 1.6, slope: Math.atan2(dy, dx), kind: 'landing', back: 0, noOverlap: true })
  }
  B.road(10, { w: 12, mat: 'castle', thick: 2.4 })
  B.closeMark()
  return { lip, yaw }
}
// 仮の着地坂（tools/finaletune.mjs で置き換える前の形）: 24m/s・13 度で飛んだ線の 0.4m 下
function defaultHill() {
  const v = 22.4, a = 14.7 * DEG, g = 4.1, /* 実測: 全開で飛んだ線（上昇気流＋空気の抵抗で、下へは約 4.1m/s²） */ vx = v * Math.cos(a), vy = v * Math.sin(a), out = []
  for (let x = 30; x <= 130; x += 5) { const t = x / vx; out.push([x, vy * t - g / 2 * t * t - 16 + 0.14 * (x - 30)]) }
  // 終わりは平らへ
  const [xl, yl] = out[out.length - 1]
  for (const [dx, sl] of [[8, -30], [8, -20], [8, -11], [8, -4]]) { const [x0, y0] = out[out.length - 1]; out.push([x0 + dx, y0 + dx * Math.tan(sl * DEG)]) }
  return out
}
