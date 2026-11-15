// SKY BIKE v46 崩れる頂上（最後の塔の 3 周目。v45 の後、天空城への大ジャンプの前）
// 塔そのものが崩れ始める: 道の内側の塔の胸壁の塊が外へ落ち、内側の柱が道をまたいで倒れ（当たりなし・演出）、足場の板は乗ると崩れる。
// 正しく走れば（止まらずに登り続ければ）落ちない。止まる・遅い・跳び損ねると、20m 下の周へ落ちて旗から。
// 板は坂のまま崩れる（crumbleSlope）。角の曲がりは崩れない石。高さは 1 周で約 34m（頂上は表示で約 500m）
import { TOWER45 } from './v45.js?v=71'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
// v51 追ってくる崩れの組（js/physics.js の chase）。c = { v0, a, lead }: 崩れの先 s = v0 τ + a τ²/2 − lead。崩れ終わって 8 秒で板が戻り、また待つ
export function chaseGroup(c, len) { const v = Math.max(1, c.v0), T = c.tab ? c.tab.length / 10 + 2 : c.a > 0 ? (-v + Math.sqrt(v * v + 2 * c.a * (len + c.lead))) / c.a : (len + c.lead) / v; return { v0: c.v0, a: c.a || 0, lead: c.lead, tab: c.tab || null, k: c.k ?? (globalThis.__chaseK ?? 0.97), nitro: !!c.nitro, len, reset: T + 8, t0: null } }
// v51 追ってくる崩れの速さ（tools/chasetune.mjs で、全開＋ニトロの後輪のすぐ後ろになるように決めた）。__chaseOff で崩れない（測る時）
export const CHASE = { fin: { tab: [-1.23, 0.84, 2.92, 4.99, 7.06, 9.13, 11.2, 13.27, 15.35, 17.41, 19.45, 21.47, 23.47, 25.45, 27.4, 29.34, 31.25, 33.15, 35.02, 36.87, 38.71], lead: +(globalThis.__chaseLead ?? 0.3), nitro: 1 }, s1: { tab: [-1.25, 0.59, 2.43, 4.19, 5.93, 7.63, 9.31, 10.94, 12.54, 14.1, 15.63, 17.12, 18.58, 20.01, 21.4, 22.75, 24.08, 25.39, 26.67, 27.93, 29.13, 30.25, 31.37, 32.5], lead: +(globalThis.__chaseLead ?? 0.3), nitro: 1 }, s3: { tab: [-0.32, 0.55, 1.44, 2.33, 3.26, 4.21, 5.2, 6.22, 7.29, 8.38, 9.51, 10.67, 11.85, 13.05, 14.27, 15.49, 16.72, 17.96, 19.2, 20.45, 21.7, 22.94, 24.19, 25.44, 26.7, 27.95, 29.2, 30.45, 31.7, 32.95, 34.2, 35.45, 36.7, 37.92, 39.08, 40.25], lead: +(globalThis.__chaseLead3 ?? 1.5), k: 0.82 }, s4a: { tab: [-0.46, 0.4, 1.3, 2.18, 3.09, 4.04, 5.02, 6.03, 7.09, 8.17, 9.29, 10.44, 11.61, 12.81, 14.02, 15.24, 16.45, 17.65, 18.83], lead: +(globalThis.__chaseLead4 ?? 1.5), k: 0.82 }, s4b: { tab: [0.07, 1.27, 2.47, 3.65, 4.85, 6.06, 7.28, 8.5, 9.73, 10.97, 12.21, 13.45, 14.7, 15.93, 17.15, 18.35], lead: +(globalThis.__chaseLead4 ?? 1.5), k: 0.82 } }
export const chaseOf = k => globalThis.__chaseOff ? { ...CHASE[k], tab: null, v0: 1, a: 0, lead: 1e5 } : CHASE[k]
export const CR46 = { delay: 0.5, back: 6, slope: 11.5 }

// 坂のまま崩れる板の列: 今の位置から len（坂に沿った長さ）を n 枚に。乗ると delay 秒で落ち、back 秒で戻る
export function crumbleSlope(B, len, n, w, slope, o = {}) {
  const t = B.t, f = B.dir(t.yaw, slope), up = B.upv(t.yaw, slope), th = 0.3, G = o.chase ? chaseGroup(o.chase, len) : null // v51 追ってくる崩れ
  for (let i = 0; i < n; i++) {
    const c0 = add3(add3(t.p, f, len / n * (i + 0.5)), up, -th / 2)
    B.box({ c: c0, h: [len / n / 2 - 0.04, th / 2, w / 2], yaw: t.yaw, pitch: slope, mat: o.mat || 'castle', tag: 'road', mov: { type: 'crumble', delay: o.delay ?? CR46.delay, back: o.back ?? CR46.back, ...(G ? { chase: { G, s0: len / n * i, s1: len / n * (i + 1) } } : {}) } })
  }
  for (let d = 0; d < len; d += 1) B.path.push({ p: add3(t.p, f, d), yaw: t.yaw, slope, w, kind: 'crumble', ...(G ? { chase: G } : {}) })
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
    crumbleSlope(B, 30, 12, W, sl, { chase: chaseOf('s1') })
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
    crumbleSlope(B, 38, 15, W, sl, { chase: chaseOf('s3') })
    B.road(3, { ...D, slope: 5 * DEG }) // 坂の頭で跳ね上がらないように
  })
  side(() => {
    B.road(3, D)
    crown(8); crown(22)
    fall(10, 15, 1.5, 0.1)
    crumbleSlope(B, 16, 6, W, sl, { chase: chaseOf('s4a') })
    B.road(4, D)
    crumbleSlope(B, 16, 6, W, sl, { chase: chaseOf('s4b') })
    B.road(3, { ...D, slope: 5 * DEG }) // 坂の頭で跳ね上がらないように
  })
  B.v45.laps.push(B.t.p[1])
  B.closeMark()
}
