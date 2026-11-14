// SKY BIKE v35 回る大きな筒（ドラム）: 廃工場の巨大な筒の内側を一周する。
// 筒は進む向きに横たわる円（軸は道の横向き）。入口は筒の後ろの下の口（A）、出口は前の下の口（B）。
// 最初は A が開いて B が閉じている（B の内側の面を登っていく）。筒の真上を車輪を着けたまま越えた瞬間に、
// 閉じていた B の板が筒と一緒に回って A をふさぐ（A が閉じ、B が開く）。そのまま一周して下へ戻れば、開いた B から前へ抜ける。
// 遅いと真上の手前で面から離れて落ちる（転んで手前の旗から）。旗から全開で入れば回れる（半径 5.5m: 入る速さ約 9.5m/s 以上）。
// 当たりは 48 枚の板（見た目は js/v35view.js が筒の形で描く。板は tag 'drum' で描かない）
import { dsin, dcos } from './physics.js?v=41b'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
export const DRUM = { R: 5.5, W: 5.6, N: 48, TH: 0.5, GATE: 9 } // GATE: 口の板の枚数（9 枚 = 67.5 度）

// 今の位置（道の上面の中心）を筒の一番下にして置く。道の点（kind 'drum'）を一周ぶん足す。道そのものは呼ぶ側が続けて作る
export function drum(B, o = {}) {
  const R = o.R ?? DRUM.R, W = o.W ?? DRUM.W, N = DRUM.N, TH = DRUM.TH
  const t = B.t, yaw = t.yaw, f = B.dir(yaw), rv = B.right(yaw), up = [0, 1, 0]
  const c = add3(t.p, up, R)
  const D = { c: c.slice(), f: [f[0], 0, f[2]], ax: rv.slice(), R, hw: W / 2, yaw, open: false, id: (B.drums = B.drums || []).length }
  B.drums.push(D)
  const L = 2 * Math.PI * R / N
  for (let k = 0; k < N; k++) {
    const ph = (k + 0.5) / N * 2 * Math.PI, s = dsin(ph), co = dcos(ph)
    const pin = add3(c, [f[0] * s - up[0] * co, f[1] * s - up[1] * co, f[2] * s - up[2] * co], R) // 内側の面の点
    const out = [f[0] * s - up[0] * co, -co, f[2] * s - up[2] * co]
    const side = k < DRUM.GATE ? 'B' : k >= N - DRUM.GATE ? 'A' : null
    const sh = B.box({ c: add3(pin, out, TH / 2), h: [L / 2 + 0.04, TH / 2, W / 2], yaw, pitch: ph, mat: 'rust', mu: 1.05, tag: 'drum', ...(side ? { mov: { type: 'gate', drum: D.id, side } } : {}) })
    if (side) sh.mov.drumR = D // 物理の側は World が drums を集める（mov.drumR から）
  }
  // 両端の板（筒の横の壁。道の外。見た目は丸い板と回る輪）
  for (const sg of [-1, 1]) B.box({ c: add3(c, rv, sg * (W / 2 + 0.15)), h: [R + 0.6, R + 0.6, 0.15], yaw, mat: 'rust', tag: 'drum' })
  // 筒の中の灯り（両端の板の、軸の高さ。光は近い火に付く既存の仕組み）
  for (const sg of [-1, 1]) for (const a of [-0.9, 0.9]) { const q = add3(add3(c, rv, sg * (W / 2 - 0.25)), f, a * R * 0.55); B.torches.push([q[0], q[1] - R * 0.35, q[2], 2]) }
  // 下の支え（鉄骨の柱。道の外の左右）
  for (const sg of [-1, 1]) for (const a of [-0.55, 0.55]) { const q = add3(add3(c, rv, sg * (W / 2 + 0.9)), f, a * R); B.cyl({ a: [q[0], c[1] - R - 46, q[2]], b: [q[0], c[1] + 0.4, q[2]], r: 0.45, mat: 'girder', tag: 'post' }) }
  // 道の点: 筒の内側を一周（向きは同じ。slope に筒の中の角度）
  const n = Math.round(2 * Math.PI * R)
  for (let k = 0; k < n; k++) { const ph = k / n * 2 * Math.PI, s = dsin(ph), co = dcos(ph); B.path.push({ p: add3(c, [f[0] * s, -co, f[2] * s], R), yaw, slope: ph, w: 4, kind: 'drum', drum: D.id }) }
  B.decor.push({ kind: 'drum', D })
  B.last = null
  return D
}
