// SKY BIKE v46 崩れる頂上（最後の塔の 3 周目。v45 の後、天空城への大ジャンプの前）
// 塔そのものが崩れ始める: 道の内側の塔の胸壁の塊が外へ落ち、内側の柱が道をまたいで倒れ（当たりなし・演出）、足場の板は乗ると崩れる。
// 正しく走れば（止まらずに登り続ければ）落ちない。止まる・遅い・跳び損ねると、20m 下の周へ落ちて旗から。
// 板は坂のまま崩れる（crumbleSlope）。角の曲がりは崩れない石。高さは 1 周で約 34m（頂上は表示で約 500m）
import { TOWER45 } from './v45.js?v=48'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
export const CR46 = { delay: 0.5, back: 6, slope: 11.5 }

// 坂のまま崩れる板の列: 今の位置から len（坂に沿った長さ）を n 枚に。乗ると delay 秒で落ち、back 秒で戻る
export function crumbleSlope(B, len, n, w, slope, o = {}) {
  const t = B.t, f = B.dir(t.yaw, slope), up = B.upv(t.yaw, slope), th = 0.3
  for (let i = 0; i < n; i++) {
    const c0 = add3(add3(t.p, f, len / n * (i + 0.5)), up, -th / 2)
    B.box({ c: c0, h: [len / n / 2 - 0.04, th / 2, w / 2], yaw: t.yaw, pitch: slope, mat: o.mat || 'castle', tag: 'road', mov: { type: 'crumble', delay: o.delay ?? CR46.delay, back: o.back ?? CR46.back } })
  }
  for (let d = 0; d < len; d += 1) B.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope, w, kind: 'crumble' })
  t.p = add3(t.p, f, len); B.last = null
}

export function v46(B) {
  const T = B.v45; if (!T) return
  const { S, R, rise } = TOWER45, D = { w: 4.2, mat: 'castle', thick: 1.2 }, W = 4.2
  B.zone = 'castle'
  const sl = CR46.slope * DEG
  // 道の内側（塔の側＝左）の柱: 近づくと道をまたいで倒れる（finale と同じ fallTower。当たりなし）
  const fall = (at, h, r, delay = 0) => {
    const t = B.t, f = B.dir(t.yaw), Rv = B.right(t.yaw)
    const base = add3(add3(t.p, f, at), Rv, -(W / 2 + 1.4 + r)); base[1] -= 1.5
    B.decor.push({ kind: 'fallTower', p: base, h, r, yaw: t.yaw, side: -1, trig: add3(t.p, f, at - 16 - delay * 10), fwd: f })
  }
  // 道の外の縁の欠片 / 塔の胸壁の塊: 近づくと落ちる（fallChunk。当たりなし）
  const chunk = (at, lat, dy, hx, hy, hz, trigBack = 12) => {
    const t = B.t, f = B.dir(t.yaw), Rv = B.right(t.yaw)
    B.decor.push({ kind: 'fallChunk', c: add3(add3(add3(t.p, f, at), Rv, lat), [0, 1, 0], dy), h: [hx, hy, hz], yaw: t.yaw, trig: add3(t.p, f, at - trigBack) })
  }
  const crown = (at) => { // 塔の頭の胸壁（道の左の塔の壁の上）が崩れて落ちる
    const t = B.t, f = B.dir(t.yaw), p = add3(t.p, f, at), dx = p[0] - T.cx, dz = p[2] - T.cz, L = Math.hypot(dx, dz), e = [dx / L, 0, dz / L]
    const c = [T.cx + e[0] * (T.r - 1.2), T.top + 1.4, T.cz + e[2] * (T.r - 1.2)]
    B.decor.push({ kind: 'fallChunk', c, h: [1.4, 1.4, 1.1], yaw: t.yaw + 0.4, trig: add3(t.p, f, at - 14) })
  }
  let sideN = 0
  const side = (fn) => {
    const a = B.t.p.slice(), f = B.dir(B.t.yaw)
    fn()
    const d = (B.t.p[0] - a[0]) * f[0] + (B.t.p[2] - a[2]) * f[2]
    if (d > S - 0.5) throw new Error(`v46 side ${sideN} too long ${d.toFixed(2)}`)
    B.road(S - d, { ...D, back: 0 })
    B.torch(1, -3, { w: W, down: 1 }); B.curve(R, 90 * DEG, { ...D, w: 4.6, rise, pw: W })
    sideN++
  }
  // 塔の頭: 3 周目の真ん中ほどの高さ（道はその上の縁を回る）
  T.top = B.t.p[1] + 14
  side(() => {
    B.road(3, D)
    B.cp('崩れる頂上の下', { w: W, rest: true })
    B.mark('崩れる頂上')
    B.road(6, D)
    B.can(1)
    B.sign('崩れる前に 駆け上がれ', { at: 3 })
    B.road(4, D)
    fall(12, 16, 1.4); fall(24, 13, 1.2, 0.2); chunk(10, W / 2 + 1.2, -0.6, 1.0, 0.5, 0.8); chunk(22, W / 2 + 1.1, -0.6, 0.8, 0.45, 1.0)
    crumbleSlope(B, 30, 12, W, sl)
    B.road(3, { ...D, slope: 5 * DEG }) // 坂の頭で跳ね上がらないように
  })
  side(() => {
    B.road(3, D)
    crown(6); crown(20)
    crumbleSlope(B, 10, 4, W, sl)
    B.road(8, { ...D, back: 0 })
    // 崩れ落ちた所（切れ目）をジャンプ台で越える。切れ目の所の道の塊は、近づくと落ちる
    { const r2 = B.kicker(3, 16 * DEG, { w: 3.6, mat: 'plank', thick: 0.7 }); B.path[B.path.length - 1].vNeed = 10
      const t = B.t, f = B.dir(t.yaw)
      B.decor.push({ kind: 'fallChunk', c: add3(add3(t.p, f, 3.4), [0, 1, 0], -r2 - 0.6), h: [3.0, 0.6, W / 2], yaw: t.yaw, trig: add3(t.p, f, -18) })
      B.gap(6.8, -r2, 'jump'); B.path[B.path.length - 1].vJump = 9.2 }
    B.road(5, { ...D, kind: 'landing', back: 0 })
    crumbleSlope(B, 7, 3, W, sl)
    B.road(3, { ...D, slope: 5 * DEG }) // 坂の頭で跳ね上がらないように
  })
  side(() => {
    B.road(3, D)
    crown(4); crown(16); crown(30)
    fall(8, 18, 1.6); fall(20, 14, 1.3, 0.25); fall(32, 12, 1.1, 0.1)
    chunk(14, W / 2 + 1.2, -0.6, 0.9, 0.5, 1.0); chunk(28, W / 2 + 1.1, -0.6, 1.1, 0.5, 0.8)
    crumbleSlope(B, 38, 15, W, sl)
    B.road(3, { ...D, slope: 5 * DEG }) // 坂の頭で跳ね上がらないように
  })
  side(() => {
    B.road(3, D)
    crown(8); crown(22)
    fall(10, 15, 1.5, 0.1)
    crumbleSlope(B, 16, 6, W, sl)
    B.road(4, D)
    crumbleSlope(B, 16, 6, W, sl)
    B.road(3, { ...D, slope: 5 * DEG }) // 坂の頭で跳ね上がらないように
  })
  B.v45.laps.push(B.t.p[1])
  B.closeMark()
}
