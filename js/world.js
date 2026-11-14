// v16 広い世界: 道を「塔のまわり」と「塔と塔の間の自由な道」に分ける。
// 区間の作り（zones.js）は x.orbit / x.orbitRaw / x.ogap / x.excursion などの同じ呼び方のまま、
//   塔のまわり（tower モード）: 塔の中心のまわりの円弧（1 周しない。塔ごとに 1 回だけ）
//   自由な道（free モード）: 区間の向き hd に沿って、ゆるい S 字で進む円弧。excursion は外へ出て戻らず、そのまま先へ進む
// 当たりと見た目は今まで通り同じ形の一覧（B.shapes）から作る。
import { dsin, dcos } from './physics.js?v=48'

const DEG = Math.PI / 180
const RM0 = 17.1 // v15 の周の道の半径（区間の長さは「角度 × これ」で決めてあった）
const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }

export function makeWorldX(B, o = {}) {
  const W = o.W ?? 4.2
  B.towers = B.towers || []
  const X = { B, W, DEG, mode: 'free', RM: RM0, TR: 15, cx: 0, cz: 0 }
  // ---------------- 自由な道の向き
  const F = { hd: B.t.yaw, amp: 0.38, lam: 150, d: 0, side: 1 }
  X.free = (fo = {}) => {
    if (X.mode === 'tower') closeTower()
    X.mode = 'free'; B.last = null
    if (fo.hd != null) F.hd = fo.hd
    F.to = fo.to || null // 目指す点 [x, z]（区間の終わりの目安）。60m 手前まで、そこへ向かう
    if (fo.turn != null) F.hd = B.t.yaw + fo.turn
    if (fo.amp != null) F.amp = fo.amp
    if (fo.lam != null) F.lam = fo.lam
    F.d = fo.phase ?? 0
    B.orbitSign = 1
    return X
  }
  const freeYaw = d => {
    if (F.to) { const dx = F.to[0] - B.t.p[0], dz = F.to[1] - B.t.p[2]; if (Math.hypot(dx, dz) > 60) { const bh = Math.atan2(-dz, dx); F.hd = B.t.yaw + wrap(bh - B.t.yaw) } }
    return F.hd + F.amp * Math.sin(2 * Math.PI * d / F.lam)
  }
  // 長さ L・上がり rise の自由な道（円弧。曲がりがほとんどない時は箱）
  const freeSeg = (L, rise, so = {}) => {
    const w = so.w ?? W, t = B.t
    let sweep = so.sweep ?? wrap(freeYaw(F.d + L) - t.yaw)
    const Rmin = so.Rmin ?? 22
    if (Math.abs(sweep) > L / Rmin) sweep = Math.sign(sweep) * L / Rmin
    F.d += L
    const mat = so.mat || B.omat, thick = so.thick ?? 1.2
    if (Math.abs(sweep) < 0.012) {
      const s = B.road(L, { w, slope: Math.atan2(rise, L), mat, mu: so.mu, thick, kind: so.kind || 'orbit', noOverlap: true, back: so.back ?? 0 })
      B.last = null
      return s
    }
    const R = L / Math.abs(sweep)
    const s = B.curve(R, sweep, { w, rise, mat, mu: so.mu, thick, kind: so.kind || 'orbit', side: so.side })
    B.orbitSign = sweep > 0 ? 1 : -1 // 流れの向きなど（v15 の周の向き）は、今曲がっている向き
    return s
  }
  // ---------------- 塔のまわり
  let T = null
  X.tower = (to = {}) => {
    const sg = to.sign ?? 1, TR = to.r ?? 15, w = to.w ?? W, RM = TR + w / 2
    const Rv = B.right(B.t.yaw)
    // 今の位置で道が円に接するように、中心を左（sg=1）か右（sg=-1）に置く
    const cx = B.t.p[0] - Rv[0] * RM * sg, cz = B.t.p[2] - Rv[2] * RM * sg
    T = { cx, cz, r: TR, rm: RM, y0: B.t.p[1], top: B.t.p[1], zone: B.zone, name: to.name || B.zone, crown: to.crown ?? 14, style: to.style || B.zone }
    B.towers.push(T)
    X.mode = 'tower'; X.TR = TR; X.RM = RM; X.cx = cx; X.cz = cz
    B.orbitSign = sg; B.last = null
    return T
  }
  function closeTower() { if (T) { T.top = Math.max(T.top, B.t.p[1]); T.exitY = B.t.p[1] } T = null; X.RM = RM0 }
  X.closeTower = closeTower
  X.target = () => F.to
  // ang は v15 の周の角度（長さ = ang × 17.1m）。塔の大きさが違っても、道の長さは同じにする
  const towerRaw = (ang0, rise, ro = {}) => {
    const w = ro.w ?? W, R = T.r + w / 2
    let ang = ro.raw ? ang0 : ang0 * RM0 / R
    const dx = B.t.p[0] - T.cx, dz = B.t.p[2] - T.cz, r0 = Math.hypot(dx, dz)
    if (r0 > 1) {
      const ph = Math.atan2(-dz, dx), want = ph + (ang * B.orbitSign > 0 ? 1 : -1) * Math.PI / 2
      let d = want - B.t.yaw; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI
      if (Math.abs(d) > 1e-4) { B.t.yaw += d; B.last = null }
      if (Math.abs(r0 - R) > 0.02) {
        const w0 = Math.max(1.6, Math.min(8, (r0 - T.r) * 2))
        if (Math.abs(w0 - w) > 0.5 && Math.abs(ang) > 0.2 && !ro.noBlend) { const a0 = 0.05; for (let k = 1; k <= 2; k++) towerRaw(a0, rise * a0 / ang, { ...ro, w: w0 + (w - w0) * k / 3, noBlend: true, raw: true }); ang -= a0 * 2; rise -= rise * a0 * 2 / (ang + a0 * 2) }
        const dx2 = B.t.p[0] - T.cx, dz2 = B.t.p[2] - T.cz, r2 = Math.hypot(dx2, dz2)
        B.t.p[0] = T.cx + dx2 / r2 * R; B.t.p[2] = T.cz + dz2 / r2 * R; B.last = null
      }
    }
    const s = B.curve(R, ang * B.orbitSign, { w, rise, mat: ro.mat || B.omat, mu: ro.mu, thick: ro.thick ?? 1.4, kind: ro.kind || 'orbit', side: ro.side })
    T.top = Math.max(T.top, B.t.p[1])
    return s
  }
  // ---------------- 共通の呼び方
  X.orbitRaw = (ang, rise, ro = {}) => X.mode === 'tower' ? towerRaw(ang, rise, ro) : freeSeg(ang * RM0, rise, ro)
  X.seg = (L, rise, ro = {}) => X.mode === 'tower' ? towerRaw(L / X.RM, rise, ro) : freeSeg(L, rise, ro)
  // ふつうの道（長さ 7.5m 以上）には、2 本に 1 本、何かを仕込む: 急に抜ける床・横切る溝・一度通ると崩れる敷石
  let decoN = 0
  X.orbit = (ang, rise, ro = {}) => {
    if (B.noDeco > 0) { B.noDeco--; return X.orbitRaw(ang, rise, ro) }
    const free = X.mode === 'free'
    if (ro.kind || ro.plain || ro.mu || ro.w || !B.decoOn || ang * RM0 < 6) return X.orbitRaw(ang, rise, ro)
    { const lc = B.cps[B.cps.length - 1]; if (lc && lc.rest && Math.hypot(lc.p[0] - B.t.p[0], lc.p[2] - B.t.p[2]) < 3 && Math.abs(lc.p[1] - B.t.p[1]) < 2) { decoN++; return X.orbitRaw(ang, rise, ro) } } // 仕込みの順番は進める（後の道の仕込みを変えない） // v17: 休憩所の旗のすぐ先には切れ目などを仕込まない（止まった所から出し直すと助走が足りず、切れ目に前輪を落として進めなくなる）
    // 自由な道では、6m 以上の道には毎回何かを仕込む（何もしなくていい時間を 4 秒より短く）
    const kind = ['trap', 'groove', 'log', 'once', 'step', 'groove', 'trap', 'log'][(decoN++) % 8] // 6m 以上の道には毎回何かを仕込む（v16。何もしなくていい時間を 4 秒より短く）
    const L = ang * RM0, L1 = L * 0.42, r1 = rise * 0.42
    const first = X.seg(L1, r1, ro)
    if (kind === 'groove') {
      const gw = [1.2, 1.8, 2.4, 1.5][(decoN >> 1) % 4]
      X.ogap(gw, 0); { const ra = Math.max(0.8, L - L1 - gw); X.seg(ra, Math.min(rise - r1, ra * 0.3), ro) }
    } else if (kind === 'trap') {
      const tl = 1.8, s2 = X.seg(tl, 0, { ...ro, thick: 0.5, kind: 'trap' })
      s2.mov = { type: 'trap', trig: 6.5, warn: 0.45 }; s2.tag = 'road'
      { const ra = Math.max(0.8, L - L1 - tl); X.seg(ra, Math.min(rise - r1, ra * 0.3), ro) }
    } else if (kind === 'log') {
      const ra = Math.max(3, L - L1); B.log(1.4, 0.15, W - 0.4, 'log'); X.seg(ra, Math.min(rise - r1, ra * 0.3), { ...ro, sweep: 0 })
    } else if (kind === 'step') {
      X.ostep(ro.stepH ?? 0.32); const ra = Math.max(2, L - L1); X.seg(ra, Math.min(rise - r1, ra * 0.3) + (0.32 - (ro.stepH ?? 0.32)), ro) // 段を低くした分は後の坂で登る（先の道の高さを変えない）
    } else {
      const n = 3, al = Math.min(L - L1 - 0.8, 6.2)
      for (let k = 0; k < n; k++) { const s3 = X.seg(al / n, 0, { ...ro, mat: 'plankold', thick: 0.35, kind: 'crumble' }); s3.mov = { type: 'crumble', delay: 0.28, back: 1e9, once: true } }
      { const ra = Math.max(0.8, L - L1 - al); X.seg(ra, Math.min(rise - r1, ra * 0.3), ro) }
    }
    return first
  }
  // v17: 足した区間の中の道の仕込みで、後の道の仕込みの順番がずれないように（前の版の並びを保つ）
  X.decoKeep = fn => { const n0 = decoN; fn(); decoN = n0 }
  X.ogap = (len, dy) => {
    B.noDeco = 1
    if (X.mode === 'tower') return B.curve(X.RM, len / X.RM * B.orbitSign, { noShape: true, rise: dy, kind: 'jump', pw: 0, vJump: 2.0 + len * 1.9 })
    B.gap(len, dy, 'jump'); B.path[B.path.length - 1].vJump = 3.2 + len * 1.9; F.d += len // まっすぐな切れ目は点が 1 つで、跳ぶ前の速さがぎりぎりだと前輪が向こうの縁に当たる。少し速く
  }
  X.ostep = dy => { B.noDeco = 1; return B.step(dy) }
  let tside = 1
  X.outer = () => X.mode === 'tower' ? -B.orbitSign : (tside = -tside)
  X.otorch = () => X.mode === 'tower' ? B.torch(-B.orbitSign, 0, { w: W, down: 1.2 }) : B.torch(tside = -tside, 0, { w: 5.8, down: 1.2 }) // 自由な道では、広くなる所（5.6m）の外に
  // 外へ張り出す区間: 自由な道ではそのまま先へ進む（戻ってこない）。塔のまわりにいる時は、塔を離れて自由な道になる
  X.excursion = eo => {
    if (X.mode === 'tower') X.free({ to: F.to })
    B.last = null
    const y0 = B.t.p[1]
    eo.out()
    // v15 の帰りの道（U ターンして戻る坂）の代わりに、上がっていた高さ（sRise）の残りを、仕掛けのある短い登りで足す
    B.noDeco = 1
    const left = (eo.sRise || 0) - (B.t.p[1] - y0)
    const n = Math.max(1, Math.ceil(left / 1.3))
    for (let k = 0; k < n; k++) X.orbit(8 / RM0, left > 0 ? left / n : 0)
    B.last = null
  }
  // 屋根と窓のある通路: 道の形 s（円弧か箱）に沿って両側に窓のある壁、上に屋根。塔のまわりでは内側は塔の壁
  X.gallery = (s, go = {}) => {
    const H = go.h ?? 3.6, mat = go.mat || 'castle'
    if (s.type === 'arc') {
      const span = s.phi1 - s.phi0, yAt = ph => s.y0 + s.b * (ph - s.phi0)
      const onTower = X.mode === 'tower' && Math.abs(s.cx - X.cx) < 0.01
      const sides = onTower ? [[s.r2, s.r2 + 0.5]] : [[s.r2, s.r2 + 0.5], [s.r1 - 0.5, s.r1]]
      for (const [r1, r2] of sides) {
        const step = 3.2 / r2, n = Math.max(1, Math.round(span / step))
        for (let k = 0; k < n; k++) {
          const a = s.phi0 + span * k / n, b2 = s.phi0 + span * (k + 1) / n, m = a + (b2 - a) * 0.28
          B.arc({ cx: s.cx, cz: s.cz, r1, r2, phi0: a, phi1: m, y0: yAt(a) + H, b: s.b, thick: H + 1.2, mat, tag: 'wall' })
          B.arc({ cx: s.cx, cz: s.cz, r1, r2, phi0: m, phi1: b2, y0: yAt(m) + 1.0, b: s.b, thick: 2.2, mat, tag: 'wall' })
          B.arc({ cx: s.cx, cz: s.cz, r1, r2, phi0: m, phi1: b2, y0: yAt(m) + H, b: s.b, thick: 0.75, mat, tag: 'wall' })
          const ph = (a + m) / 2, rr = r1 < s.r1 ? r2 + 0.12 : r1 - 0.12
          if (k % 2 === 0 && r1 >= s.r2) B.torches.push([s.cx + rr * Math.cos(ph), yAt(ph) + 2.5, s.cz - rr * Math.sin(ph)])
        }
      }
      B.arc({ cx: s.cx, cz: s.cz, r1: onTower ? X.TR - 0.3 : s.r1 - 0.8, r2: s.r2 + 0.8, phi0: s.phi0, phi1: s.phi1, y0: s.y0 + H + 0.35, b: s.b, thick: 0.35, mat, tag: 'roof' })
    } else {
      // まっすぐな板: 箱の向きの両脇に壁（窓は 3.2m ごと）と屋根
      const ax = s.ax, hx = s.h[0], hz = s.h[2], c = s.c, up = ax[1]
      const top = [c[0] + up[0] * s.h[1], c[1] + up[1] * s.h[1], c[2] + up[2] * s.h[1]]
      const yaw = s.base.yaw, pitch = s.base.pitch || 0
      const n = Math.max(1, Math.round(2 * hx / 3.2))
      for (const sg of [-1, 1]) for (let k = 0; k < n; k++) {
        const u0 = -hx + 2 * hx * k / n, u1 = -hx + 2 * hx * (k + 1) / n, um = u0 + (u1 - u0) * 0.28
        const at = (u, lat, h) => [top[0] + ax[0][0] * u + ax[2][0] * lat + up[0] * h, top[1] + ax[0][1] * u + ax[2][1] * lat + up[1] * h, top[2] + ax[0][2] * u + ax[2][2] * lat + up[2] * h]
        const lat = sg * (hz + 0.25)
        B.box({ c: at((u0 + um) / 2, lat, (H + 1.2) / 2 - 1.2 + 0.0), h: [(um - u0) / 2, (H + 1.2) / 2, 0.25], yaw, pitch, mat, tag: 'wall' })
        B.box({ c: at((um + u1) / 2, lat, 1.0 - 1.1), h: [(u1 - um) / 2, 1.1, 0.25], yaw, pitch, mat, tag: 'wall' })
        B.box({ c: at((um + u1) / 2, lat, H - 0.375), h: [(u1 - um) / 2, 0.375, 0.25], yaw, pitch, mat, tag: 'wall' })
        if (k % 2 === 0 && sg > 0) { const q = at(u0 + 0.3, lat - sg * 0.37, 2.5); B.torches.push(q) }
      }
      const rc = [top[0] + up[0] * (H + 0.35 - 0.175), top[1] + up[1] * (H + 0.35 - 0.175), top[2] + up[2] * (H + 0.35 - 0.175)]
      B.box({ c: rc, h: [hx, 0.175, hz + 0.8], yaw, pitch, mat, tag: 'roof' })
    }
  }
  return X
}

// ---------------- 自由な道の下の支え（当たりのある形）。区間ごとに題材を変える:
//   crypt 崖（道の外側に岩壁、下は岩の塊）/ ruin 水道橋の橋脚 / storm 浮いた岩の島 / factory 鉄骨の柱 / bell 石の橋脚 / ice 氷の岩
// ほかの道の上下の空き（道の幅＋1.2m の横・路面の上 4.5m）には入れない。入る時は短くするか置かない
const STYLE = { crypt: 'cliff', ruin: 'aqueduct', storm: 'island', factory: 'truss', bell: 'pier', ice: 'rock' }
export function addSupports(B) {
  const towers = B.towers || []
  const onTower = s => towers.some(T => Math.abs(s.cx - T.cx) < 0.01 && Math.abs(s.cz - T.cz) < 0.01)
  // 道の点を 4m の格子に
  const G = new Map(), gk = (x, z) => Math.floor(x / 4) * 100003 + Math.floor(z / 4)
  const allPts = [...B.path, ...(B.branches || []).flat()]
  for (const q of allPts) if (q.p && q.w) { const k = gk(q.p[0], q.p[2]); let L = G.get(k); if (!L) G.set(k, L = []); L.push(q) }
  // 分かれ道の床が動く範囲には置かない
  const forkPts = allPts.filter(q => q.p && (q.kind === 'fork' || q.kind === 'forkRide'))
  const nearFork = (x, z) => forkPts.some(q => Math.hypot(q.p[0] - x, q.p[2] - z) < 16)
  // 横に置く物（崖の壁）が、同じ高さの別の道（広がる所・扉の枠・枝道）に食い込まないか
  const sideBlocked = (x, z, rad, y0, y1) => { const r = Math.ceil((rad + 6) / 4), i0 = Math.floor(x / 4), k0 = Math.floor(z / 4); for (let di = -r; di <= r; di++) for (let dk = -r; dk <= r; dk++) for (const q of G.get((i0 + di) * 100003 + (k0 + dk)) || []) { if (q.p[1] + 4 < y0 || q.p[1] - 0.5 > y1) continue; if (Math.hypot(q.p[0] - x, q.p[2] - z) < rad + q.w / 2 + 0.4) return true } return false }
  // (x,z) の横 rad 以内にある道の点の高さで、[y0, y1] の柱がぶつかる所。下から見て、ぶつからずに伸ばせる範囲を返す
  const clearSpan = (x, z, rad, yTop, yBot, self) => {
    let top = yTop, bot = yBot
    const r = Math.ceil((rad + 4) / 4), i0 = Math.floor(x / 4), k0 = Math.floor(z / 4)
    for (let di = -r; di <= r; di++) for (let dk = -r; dk <= r; dk++) for (const q of G.get((i0 + di) * 100003 + (k0 + dk)) || []) {
      if (Math.hypot(q.p[0] - x, q.p[2] - z) > rad + q.w / 2 + 1.2) continue
      if (self && Math.abs(q.p[1] - self) < 1.6) continue // 支えている道そのもの
      if (q.p[1] < yTop + 0.5 && q.p[1] + 4.5 > bot) bot = Math.max(bot, q.p[1] + 4.5) // 下の道の上の空きまで
      if (q.p[1] > yTop && q.p[1] - 1.2 < top) top = Math.min(top, q.p[1] - 1.2)
    }
    return { top, bot }
  }
  let sd = 4242; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
  const cen = (() => { let x = 0, z = 0, n = 0; for (const q of B.path) if (q.p) { x += q.p[0]; z += q.p[2]; n++ } return [x / n, z / n] })()
  const floor = (B.lavaY ?? -32) - 3
  const add = []
  for (const s of B.shapes) {
    if (s.tag !== 'road' || s.mov || s.zone == null || !STYLE[s.zone]) continue
    if (s.type === 'arc' && onTower(s)) continue
    const style = STYLE[s.zone]
    // 道に沿って点を取る（上面の中心・向き・幅・下面）
    const pts = []
    if (s.type === 'arc') {
      const rm = (s.r1 + s.r2) / 2, L = (s.phi1 - s.phi0) * rm, w = s.r2 - s.r1
      for (let d = 0; d < L; d += 1) { const ph = s.phi0 + d / rm, y = s.y0 + s.b * (ph - s.phi0); pts.push({ p: [s.cx + dcos(ph) * rm, y, s.cz - dsin(ph) * rm], yaw: ph + Math.PI / 2, w, bot: y - s.thick }) }
    } else if (s.type === 'box') {
      const f = s.ax[0], up = s.ax[1], hx = s.h[0]
      if (Math.abs(up[1]) < 0.7) continue
      for (let u = -hx; u < hx; u += 1) { const top = [s.c[0] + f[0] * u + up[0] * s.h[1], s.c[1] + f[1] * u + up[1] * s.h[1], s.c[2] + f[2] * u + up[2] * s.h[1]]; pts.push({ p: top, yaw: s.base.yaw, w: s.h[2] * 2, bot: top[1] - s.h[1] * 2 }) }
    }
    if (!pts.length) continue
    s._sup = pts
  }
  // 区間ごとに、支えを置く間隔で道をたどる（形の切れ目をまたいで一定の間隔に）
  const every = { cliff: 7, aqueduct: 11, island: 24, truss: 9, pier: 14, rock: 16 }
  let acc = {}, last = {}
  for (const s of B.shapes) {
    if (!s._sup) continue
    const style = STYLE[s.zone]
    for (const q of s._sup) {
      const lp = last[style]
      if (lp && Math.hypot(q.p[0] - lp[0], q.p[2] - lp[2]) > 20) acc[style] = every[style] * 0.5 // 遠く離れた道は数え直す
      acc[style] = (acc[style] ?? every[style] * 0.5) + (lp ? Math.min(3, Math.hypot(q.p[0] - lp[0], q.p[2] - lp[2])) : 0)
      last[style] = q.p
      if (acc[style] < every[style]) continue
      acc[style] = 0
      if (nearFork(q.p[0], q.p[2])) continue
      const f = [dcos(q.yaw), 0, -dsin(q.yaw)], R = [dsin(q.yaw), 0, dcos(q.yaw)]
      const zone = s.zone
      if (style === 'cliff') {
        // 道の外側（世界の真ん中と反対）に岩壁、下に岩の塊
        const out = (R[0] * (q.p[0] - cen[0]) + R[2] * (q.p[2] - cen[1])) > 0 ? 1 : -1
        const wc = [q.p[0] + R[0] * out * (q.w / 2 + 2.3), 0, q.p[2] + R[2] * out * (q.w / 2 + 2.3)]
        const sp = clearSpan(wc[0], wc[2], 2.6, q.p[1] + 9 + rr() * 14, floor, q.p[1])
        if (sp.top - sp.bot > 6 && !sideBlocked(wc[0], wc[2], 2.2, sp.bot, sp.top)) add.push({ c: [wc[0], (sp.top + sp.bot) / 2, wc[2]], h: [4.2, (sp.top - sp.bot) / 2, 2.1], yaw: q.yaw + (rr() - 0.5) * 0.08, mat: 'rockdark', tag: 'support', style, zone })
        const sb = clearSpan(q.p[0], q.p[2], q.w / 2 + 0.6, q.bot, floor, q.p[1])
        if (sb.top - sb.bot > 3) add.push({ c: [q.p[0] + R[0] * out * 0.6, (Math.min(sb.top, q.bot) + sb.bot) / 2, q.p[2] + R[2] * out * 0.6], h: [3.8, (Math.min(sb.top, q.bot) - sb.bot) / 2, q.w / 2 + 0.4], yaw: q.yaw, mat: 'rockdark', tag: 'support', style, zone })
      } else if (style === 'aqueduct' || style === 'pier') {
        const hw = style === 'pier' ? 1.3 : 0.9
        // 橋脚は 18〜34m で、下の岩の塊で終わる（谷底まで届く巨大な柱にしない）
        const depth = 18 + rr() * 16
        const sb = clearSpan(q.p[0], q.p[2], q.w / 2 + 2.5, q.bot, Math.max(floor, q.bot - depth - 6), q.p[1])
        const pb = Math.max(sb.bot + 5, q.bot - depth)
        if (sb.top - pb > 3) {
          add.push({ c: [q.p[0], (sb.top + pb) / 2, q.p[2]], h: [hw, (sb.top - pb) / 2, q.w / 2 + 0.25], yaw: q.yaw, mat: style === 'pier' ? 'castle' : 'ruinwall', tag: 'support', style, zone })
          const ra = 2.6 + rr() * 1.6
          if (pb - 2.4 > sb.bot) add.push({ c: [q.p[0], pb - 2.2, q.p[2]], h: [ra, 2.4, ra * 0.9], yaw: q.yaw + rr(), mat: 'rockdark', tag: 'support', style: 'rock', zone })
        }
      } else if (style === 'truss') {
        for (const sg of [-1, 1]) {
          const x = q.p[0] + R[0] * sg * (q.w / 2 - 0.25), z = q.p[2] + R[2] * sg * (q.w / 2 - 0.25)
          const sb = clearSpan(x, z, 0.4, q.bot, q.bot - 28, q.p[1])
          if (sb.top - sb.bot > 3) add.push({ cyl: true, a: [x, sb.bot, z], b: [x, Math.min(sb.top, q.bot), z], r: 0.22, mat: 'girder', tag: 'support', style, zone })
        }
        const sb = clearSpan(q.p[0], q.p[2], q.w / 2, q.bot, q.bot - 2.2, q.p[1])
        if (sb.bot <= q.bot - 2) add.push({ c: [q.p[0], q.bot - 1.6, q.p[2]], h: [0.12, 0.12, q.w / 2], yaw: q.yaw, mat: 'girder', tag: 'support', style, zone })
      } else if (style === 'island' || style === 'rock') {
        const a = 2.4 + rr() * 2.2, d = 5 + rr() * 6
        const sb = clearSpan(q.p[0], q.p[2], a + 1, q.bot, q.bot - d - 4, q.p[1])
        if (sb.bot > q.bot - 3) continue
        const top = q.bot, mat = style === 'rock' ? 'snowrock' : 'rockdark'
        add.push({ c: [q.p[0], top - 1.4, q.p[2]], h: [a + 1.2, 1.4, Math.max(q.w / 2 + 0.6, a)], yaw: q.yaw + (rr() - 0.5) * 0.4, mat, tag: 'support', style, zone })
        const h2 = Math.min(d, top - 2.8 - sb.bot) / 2
        if (h2 > 0.8) add.push({ c: [q.p[0], top - 2.8 - h2, q.p[2]], h: [a * 0.7, h2, a * 0.6], yaw: q.yaw + 0.5 + rr(), mat, tag: 'support', style, zone })
      }
    }
  }
  for (const s of B.shapes) delete s._sup
  for (const o of add) {
    const sh = o.cyl ? B.cyl({ a: o.a, b: o.b, r: o.r, mat: o.mat, tag: o.tag, zone: o.zone }) : B.box({ c: o.c, h: o.h, yaw: o.yaw, mat: o.mat, tag: o.tag, zone: o.zone })
    sh.style = o.style
  }
  return add.length
}

// ---------------- 分かれ道の道づくり: 今の位置から、目的の点 target [x, y, z] へ曲がって向かい、坂でその高さに合わせる
// (分かれた 2 本の道を、先の広場で合流させる時に使う。最後は広場に入るので、少しのずれは広場が吸う)
export function routeTo(S, target, o = {}) {
  const w = o.w ?? 3.2, mat = o.mat || 'cobble', R = o.R ?? 9, thick = o.thick ?? 1.0
  for (let it = 0; it < 2; it++) {
    const dx = target[0] - S.t.p[0], dz = target[2] - S.t.p[2]
    const e = wrap(Math.atan2(-dz, dx) - S.t.yaw)
    if (Math.abs(e) > 0.05) S.curve(R, e * 0.98, { w, mat, thick, rise: o.curveRise ?? 0 })
  }
  const dx = target[0] - S.t.p[0], dz = target[2] - S.t.p[2], d = Math.hypot(dx, dz), dy = target[1] - S.t.p[1]
  if (d > 0.5) S.road(d, { w, mat, thick, slope: Math.atan2(dy, d), back: 0, kind: o.kind })
}

// ---------------- 道を選ぶ横に動く床（v16）。床の左端で降りると左の道、右端で降りると右の道。先の広場で合流する
// fo: { main: 'L'|'R'（本線＝長くて安全な道の側）, ahead（広場まで前へ何 m）, rise（広場の高さ）, hard(S, side), safe(B, side), w, mat }
// 短い道（hard）は技が要る。長い道（safe）は遠回りで、燃料の缶と見どころ。どちらも歩く人では通れない形にする（zones.js で中身を決める）
export function makeFork(X, parts) {
  const B = X.B
  return (fo) => {
    if (X.mode === 'tower') X.free({ to: X.target() })
    const w = fo.w ?? 3.2, mat = fo.mat || B.omat
    B.road(6, { w, mat, thick: 1.0, back: 0, kind: 'road' }) // 床の手前の入口（床の動きが見える）
    const p0 = B.t.p.slice(), yaw0 = B.t.yaw, f = B.dir(yaw0), R = B.right(yaw0)
    const out = parts.forkPlatform(B, { gap: fo.gap ?? 5, amp: fo.amp ?? 6, w, main: fo.main, dwell: fo.dwell, move: fo.move })
    const hardSide = fo.main === 'L' ? 'R' : 'L', sgH = hardSide === 'R' ? 1 : -1
    // 長い道（本線）を先に作り、それより先（前へ）に合流の広場を置く。両方の道は広場の手前の縁の左右から入る
    fo.safe(B, -sgH, { f, R })
    const S = parts.forkBranch(B, out[hardSide])
    S.zone = B.zone; S.omat = mat
    fo.hard(S, sgH, { f, R })
    // 両方の道の先より前に広場。高さは 2 本の道の終わりの間、坂は 11 度より緩く入れるだけの距離を取る
    const fwd = q => (q.p[0] - p0[0]) * f[0] + (q.p[2] - p0[2]) * f[2]
    let ext = 0; for (let i = B.path.length - 1; i >= 0 && B.path[i].kind !== 'forkRide'; i--) if (B.path[i].p) ext = Math.max(ext, fwd(B.path[i]))
    for (const q of S.path) if (q.p && q.kind !== 'fork' && q.kind !== 'forkRide') ext = Math.max(ext, fwd(q))
    const yB = B.t.p[1], yS = S.t.p[1], yM = (yB + yS) / 2 + (fo.rise ?? 0) * 0.3
    const ahead = Math.max(fo.ahead ?? 40, ext + 26 + Math.max(Math.abs(yM - yB), Math.abs(yM - yS)) / 0.19)
    const back = [p0[0] + f[0] * ahead, yM, p0[2] + f[2] * ahead]
    const entH = [back[0] + R[0] * sgH * 3.4, back[1], back[2] + R[2] * sgH * 3.4], entS = [back[0] - R[0] * sgH * 3.4, back[1], back[2] - R[2] * sgH * 3.4]
    // 広場の向きにそろえ、S 字で横のずれを消してから、まっすぐ広場の手前の縁へ入る（横から斜めに入らない）
    const arrive = (T, ent) => {
      const o = { w, mat, thick: 1.0 }
      const e0 = wrap(yaw0 - T.t.yaw); if (Math.abs(e0) > 0.03) T.curve(16, e0, o)
      const rel = () => { const dx = ent[0] - T.t.p[0], dz = ent[2] - T.t.p[2]; return { d: dx * R[0] + dz * R[2], D: dx * f[0] + dz * f[2], dy: ent[1] - T.t.p[1] } }
      let r0 = rel()
      if (Math.abs(r0.d) > 0.3) {
        const rr = Math.max(16, Math.abs(r0.d) / 3.6), th = Math.acos(Math.max(-1, 1 - Math.abs(r0.d) / (2 * rr))), sg = r0.d > 0 ? -1 : 1
        T.curve(rr, sg * th, { ...o, rise: r0.dy * 0.2 }); T.trapStraight({ w, mat }); T.curve(rr, -sg * th, { ...o, rise: r0.dy * 0.2 })
      }
      r0 = rel()
      // 長い登りは途中に切れ目を 1 つ（何もしない時間を作らない）
      if (r0.D > 16) { const sl = Math.atan2(r0.dy, r0.D), n = Math.max(1, Math.floor(r0.D / 15)), seg = (r0.D - n * 1.5) / (n + 1); for (let k = 0; k <= n; k++) { T.road(seg, { ...o, slope: sl, back: 0 }); if (k < n) { T.gap(1.5, 1.5 * Math.tan(sl), 'jump'); T.path[T.path.length - 1].vJump = 6 } } }
      else if (r0.D > 0.5) T.road(r0.D, { ...o, slope: Math.atan2(r0.dy, r0.D), back: 0 })
    }
    arrive(S, entH); arrive(B, entS)
    // 広場
    B.t.p = back.slice(); B.t.yaw = yaw0; B.last = null
    const mi = B.path.length
    B.road(12, { w: 11, mat: 'cobble', thick: 1.2, back: 0, kind: 'pad' })
    B.torch(1, -1, { w: 11, down: 1.2 }); B.torch(-1, -1, { w: 11, down: 1.2 })
    for (const q of S.path) q.zone = q.zone || B.zone
    parts.forkJoin(B, S, mi)
    X.free({ to: X.target() })
    return mi
  }
}
