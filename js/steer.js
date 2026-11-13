// ハンドルは自動（Trials と同じく、人が操るのはアクセル・ブレーキ・重心の前後だけ）。
// コースの線（path）をなぞる向きにハンドルを切る。ゲームと検査（bot）で同じものを使う。
// 速すぎると曲がり切れずに外へふくらむ（ハンドルの切れる量は physics.js が速さで絞る）。だから曲がり角の前はブレーキ。
import { STEER_DK } from './physics.js?v=14'
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }

// 向きのずれ・目標点へのずれ・横のずれ・曲がりの先取り の重み（tools/steertest.mjs で決めた）
export const STEER_K = [1.6, 0.8, 1.6, 1]
export function createSteer(path) { return { path, i: 0 } }
function dist2(q, b) { return (q.p[0] - b.p[0]) ** 2 + (q.p[2] - b.p[2]) ** 2 + ((q.p[1] + 0.8 - b.p[1]) * 2) ** 2 }
// 一番近い道の点。近くで見つからなければ（落ちて下の周に来た時など）全部から探す
export function track(st, b) {
  const path = st.path
  let best = 1e18, bi = st.i
  for (let i = Math.max(0, st.i - 3); i < Math.min(path.length, st.i + 25); i++) { const q = path[i]; if (!q.p) continue; const d = dist2(q, b); if (d < best) { best = d; bi = i } }
  if (best > 9) for (let i = 0; i < path.length; i++) { const q = path[i]; if (!q.p) continue; const d = dist2(q, b); if (d < best) { best = d; bi = i } }
  st.i = bi
  return bi
}
export function resetSteer(st, b) { st.i = 0; track(st, b); return st }
// 返り: -1（左）..1（右）。lat はわざと道の中心から横へずらす量（検査で端を走らせる時）
export function steerFor(st, b, lat = 0) {
  const path = st.path, i = track(st, b), sp = b.speed
  if (sp < -0.15) return steerBack(st, b, i)
  let k = i, dist = 0
  const look = Math.max(2.5, Math.abs(sp) * 0.35)
  while (k < path.length - 1 && dist < look && !path[k + 1].branch === !path[k].branch) { const a = path[k].p, c = path[k + 1].p; if (a && c) dist += Math.hypot(c[0] - a[0], c[2] - a[2]); k++ } // 本線の終わりから枝道へ続けて読まない
  const tg = path[Math.min(k, path.length - 1)]
  let tp = tg.p
  if (lat && tg.yaw != null && (tg.w || 0) >= 2) tp = [tp[0] + Math.sin(tg.yaw) * lat * tg.w * 0.35, tp[1], tp[2] + Math.cos(tg.yaw) * lat * tg.w * 0.35]
  const want = Math.atan2(-(tp[2] - b.p[2]), tp[0] - b.p[0])
  const err = wrap(want - b.psi)
  let pvI = Math.min(path.length - 1, i + 1 + Math.round(Math.abs(sp) * 0.25)); while (pvI > i && !path[pvI].branch !== !path[i].branch) pvI--
  const pv = path[pvI]
  let cte = 0, herr = err
  const c0 = path[i]
  if (pv.yaw != null && c0.p) {
    const yw = c0.yaw ?? pv.yaw, lx = -Math.sin(yw), lz = -Math.cos(yw)
    cte = (b.p[0] - c0.p[0]) * lx + (b.p[2] - c0.p[2]) * lz - ((c0.w || 0) >= 2 ? lat * c0.w * 0.35 : 0)
    herr = wrap(pv.yaw - b.psi)
  }
  // 曲がっている道では、曲がりの分を先に切っておく（遅れて外へふくらまない）
  let ff = 0
  if (pv.yaw != null && c0.yaw != null) { const a = path[Math.min(path.length - 1, i + 3)]; if (a.yaw != null && a.p && c0.p) { const dd = Math.hypot(a.p[0] - c0.p[0], a.p[2] - c0.p[2]); if (dd > 0.5) ff = Math.atan(wrap(a.yaw - c0.yaw) / dd * 1.42) } }
  // physics.js と同じ、速さで絞ったハンドルの切れる量
  const dmax = Math.min(0.6, STEER_DK / Math.max(1, sp * sp))
  const K = globalThis.__steerK || STEER_K
  const s = -(herr * K[0] + err * K[1]) + Math.atan(K[2] * cte / Math.max(1.5, Math.abs(sp))) * 1.4 - ff / dmax * K[3]
  return Math.max(-1, Math.min(1, s))
}

// 曲がりの手前で自動で速さを落とす（アクセルを押しっぱなしでも、ふつうの曲がりでは外へはみ出さない）。
// 道の点の曲がり具合 q.kap から、横の加速度 ALAT で曲がれる速さを出し、ADEC で間に合う所から後輪だけで減速する。
// 見極めの場所（q.wide）とジャンプの先は数えない（そこは速さを読むのが遊び）
export const ALAT = 8, ADEC = 7
export function cornerCap(st, b) {
  const path = st.path, sp = Math.max(0, b.speed), look = sp * sp / (2 * ADEC) + 8
  let cap = 99, d = 0
  for (let k = st.i; k < path.length - 1 && d < look; k++) {
    const q = path[k]
    if (!path[k + 1].branch !== !q.branch) break
    if (q.kind === 'lip' || q.kind === 'jump') break
    // 細い道（幅 3m より狭い）へ続く曲がりは、はみ出せる幅が少ないので遅めに
    let wmin = 9; for (let j = k; j < Math.min(path.length, k + 5); j++) if (path[j].w) wmin = Math.min(wmin, path[j].w)
    const alat = ALAT * Math.max(0.45, Math.min(1, (wmin - 0.6) / 2.4))
    if (!q.wide && q.kap > 0.015) { const v = Math.sqrt(alat / q.kap); cap = Math.min(cap, Math.sqrt(v * v + 2 * ADEC * Math.max(0, d - 0.5))) }
    const a = q.p, c = path[k + 1].p; if (a && c) d += Math.hypot(c[0] - a[0], c[2] - a[2])
  }
  return cap
}
export function assist(st, b, inp) {
  if (!b.g[0] && !b.g[1]) return inp
  const over = b.speed - cornerCap(st, b)
  if (over <= 0) return inp
  return { ...inp, thr: over > 0.4 ? 0 : inp.thr, ab: Math.round(Math.min(1, over * 0.6) * 8) / 8 }
}

// バック: 後ろ側の道の線をなぞる。進む向きは車体の後ろ（psi+π）で、下がっている時はハンドルの効きが逆になる
export function steerBack(st, b, i) {
  const path = st.path, sp = b.speed
  let k = i, dist = 0
  const look = Math.max(2.2, Math.abs(sp) * 0.6)
  while (k > 0 && dist < look) { const a = path[k].p, c = path[k - 1].p; if (a && c) dist += Math.hypot(c[0] - a[0], c[2] - a[2]); else break; k-- }
  const tg = path[k], c0 = path[i]
  if (!tg.p || !c0.p) return 0
  const psiT = b.psi + Math.PI
  const want = Math.atan2(-(tg.p[2] - b.p[2]), tg.p[0] - b.p[0])
  const err = wrap(want - psiT)
  const yw = c0.yaw ?? tg.yaw ?? b.psi
  const herr = wrap(yw - b.psi)
  // 道の線から、下がる向きで見て左にずれている量
  const cte = -((b.p[0] - c0.p[0]) * -Math.sin(yw) + (b.p[2] - c0.p[2]) * -Math.cos(yw))
  const sf = -(herr * BACK_K[0] + err * BACK_K[1]) + Math.atan(BACK_K[2] * cte / 1.5) * 1.4
  return Math.max(-1, Math.min(1, -sf))
}
export const BACK_K = [1.8, 1.0, 2.2]
