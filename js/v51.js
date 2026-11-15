// SKY BIKE v51 落とし穴（近づくと抜ける床）の一部を、新しい罠に置き換える（道の点の数と形は変えない＝後の区間の位置が動かない）
//  1 黄色いレーザーの床（spike）: 道を横切る黄色い光。前輪で光を切ると、後輪の下の床が突き上がって前へ回される。
//    ウィリーで前輪を光の上に通せば、光を切るのは後輪になり、突き上がるのは後輪の後ろ（何も起きない）。最初の 1 つは出発してすぐの見極めの台
//  2 目の前で爆発して床が消える（blast）: 合図の台は置かない。近づくと目の前の床（落とし穴の 1.8m＋その先の道の初めの 3.2m）が爆発で消える。
//    その瞬間にニトロを押せば向こうへ届く（ふつうの全開では手前の縁に前輪が落ちる）。手前に燃料の缶。5 秒で床は戻る
// 置き換える落とし穴は、組み立てた後の形の並び（tools/_traplist.mjs の番号）で選ぶ
export const LASERS = [0, 2, 9, 22, 12, 25, 36, 41], BLASTS = [13]
export const SPIKE = { h: 0.3, back: 1.75, rise: 0.42, kick: 4.5, spin: 5.5 }
export const ICE = { mu: 0.3 }
export const SLICK = { mu: +(globalThis.__slickMu ?? 0.45) }
export const UPDRAFT = { a: 13, run: +(globalThis.__upRun ?? 10.6), T: 4.6 }
export const BLAST = { cut: 5.0, trig: 6.5, back: 5, lipDeg: 8, lipLen: 1.0, roadN: 2 }
import { closest } from './physics.js?v=55'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

function addLipB(B, G, S, f, w) {
  // 爆発の瞬間に、手前の床の端が割れて少しだけ上を向く（割れた敷石。ジャンプ台には見えない形・爆発するまで無い）。向きは進む向き（板の向きが逆の時もある）
  const la = BLAST.lipDeg * Math.PI / 180, L = BLAST.lipLen, yaw = Math.atan2(-G.f[2], G.f[0]), sl = Math.asin(Math.max(-1, Math.min(1, f[1]))), pt = sl + la
  const fl = [Math.cos(yaw) * Math.cos(pt), Math.sin(pt), -Math.sin(yaw) * Math.cos(pt)], ul = [-Math.cos(yaw) * Math.sin(pt), Math.cos(pt), Math.sin(yaw) * Math.sin(pt)]
  const back = add3(G.start, f, -L), c = add3(add3(back, fl, L / 2), ul, -0.07)
  G.lip = B.box({ c, h: [L / 2, 0.07, w / 2 - 0.15], yaw, pitch: pt, zone: S.zone, mat: S.mat, tag: 'road', mov: { type: 'blastLip', G } })
}
export function v51post(B) {
  const addLip = (G, S, f, w) => addLipB(B, G, S, f, w)
  if (globalThis.__noV51traps) return
  const P = B.path
  const all = B.shapes.filter(s => s.mov && s.mov.type === 'trap')
  const pick = k => { const s = all[k]; return s && s.type === 'box' ? s : null }
  const near = (s, kinds) => { const out = []; for (let i = 0; i < P.length; i++) { const q = P[i]; if (!q.p || !kinds.includes(q.kind)) continue; const d = [q.p[0] - s.c[0], q.p[1] - s.c[1], q.p[2] - s.c[2]]; if (Math.abs(dot(d, s.ax[0])) < s.h[0] + 0.2 && Math.abs(dot(d, s.ax[2])) < s.h[2] + 0.2 && Math.abs(dot(d, s.ax[1]) - s.h[1]) < 0.6) out.push(i) } return out }
  B.decor = B.decor || []; B.v51 = { lasers: [], blasts: [] }
  for (const k of LASERS) { const s = pick(k); if (!s) continue
    const ii = near(s, ['trap']); if (!ii.length) continue
    const q = P[ii[0]], hf = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], sg = dot(s.ax[0], hf) >= 0 ? 1 : -1, f = s.ax[0].map(v => v * sg), up = s.ax[1], w = s.h[2] * 2
    s.mov = null; s.tag = 'road'
    const beam = add3(add3(s.c, f, s.h[0]), up, s.h[1]), hz = [f[0], 0, f[2]], L = Math.hypot(hz[0], hz[2]); hz[0] /= L; hz[2] /= L
    const c = add3(add3(beam, f, -(0.45 + SPIKE.back / 2)), up, -(0.25 + 0.03))
    const sp = B.box({ c, h: [SPIKE.back / 2, 0.25, w / 2 - 0.12], yaw: s.base.yaw, pitch: s.base.pitch, roll: s.base.roll, zone: s.zone, mat: 'rust', tag: 'spike', mov: { type: 'spike', up: up.slice(), rise: SPIKE.rise, beam, f: hz, w, h: SPIKE.h, back: SPIKE.back, kick: SPIKE.kick, spin: SPIKE.spin, ext: [0, SPIKE.rise, 0] } })
    for (const i of ii) { P[i].kind = 'spike'; P[i].spike = sp.mov }
    // 光の手前の点にも印（bot が手前でウィリーを始める）
    B.decor.push({ kind: 'laser', beam, f: hz, up, w, h: SPIKE.h, spike: sp })
    B.v51.lasers.push({ k, i: ii[0], beam })
  }
  // まっすぐで平らな長い道の板を自動で探して、爆発の床を足す（落とし穴の場所だけでは助走の取れる所が 2 つしかない）
  const roadSpots = []
  if (!globalThis.__noRoadBlast) { const N = P.length, ok = q => q && q.p && q.kind === 'road' && !q.branch && Math.abs(q.slope || 0) < 0.02 && (q.kap || 0) < 0.006 && q.w >= 3
    let last = -1e9
    for (let i = Math.floor(N * 0.5); i < N * 0.8 && roadSpots.length < BLAST.roadN; i++) { let good = true; for (let j = i; j < i + 27; j++) if (!ok(P[j])) { good = false; break } if (!good || i - last < 700) continue
      const g = P[i + 15], hf = [Math.cos(g.yaw), 0, -Math.sin(g.yaw)]
      const box = B.shapes.find(n => n.type === 'box' && !n.mov && n.tag === 'road' && Math.abs(dot(n.ax[0], hf)) > 0.999 && (() => { const d = [g.p[0] - n.c[0], g.p[1] - n.c[1], g.p[2] - n.c[2]]; return dot(d, n.ax[0]) * (dot(n.ax[0], hf) >= 0 ? 1 : -1) > -n.h[0] + 2 && dot(d, n.ax[0]) * (dot(n.ax[0], hf) >= 0 ? 1 : -1) < n.h[0] - 7.6 && Math.abs(dot(d, n.ax[2])) < n.h[2] && Math.abs(dot(d, n.ax[1]) - n.h[1]) < 0.1 })())
      if (!box) continue
      roadSpots.push({ i: i + 15, box }); last = i }
  }
  for (const sp of roadSpots) { const n = sp.box, q = P[sp.i], hf = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], sg = dot(n.ax[0], hf) >= 0 ? 1 : -1, f = n.ax[0].map(v => v * sg), up = n.ax[1], w = n.h[2] * 2, cut = BLAST.cut + 1.8
    const top = add3(add3(n.c, up, n.h[1]), f, 0), d0 = dot([q.p[0] - top[0], q.p[1] - top[1], q.p[2] - top[2]], f) // 切れ目の始まり（板の中心からの距離）
    const L0 = n.h[0] + d0, L2 = n.h[0] - d0 - cut, a0 = add3(n.c, f, -n.h[0] + L0 / 2), a1 = add3(n.c, f, d0 + cut / 2), a2 = add3(n.c, f, d0 + cut + L2 / 2)
    const G = { t0: null, back: BLAST.back, start: add3(add3(n.c, f, d0), up, n.h[1]), f: [f[0], 0, f[2]], w, trig: BLAST.trig, len: cut }
    const mk = (c, h, mov) => B.box({ c, h: [h, n.h[1], n.h[2]], yaw: n.base.yaw, pitch: n.base.pitch, roll: n.base.roll, zone: n.zone, mat: n.mat, mu: n.mu, tag: 'road', mov })
    const idx = B.shapes.indexOf(n), A = mk(a0, L0 / 2, null); B.shapes.pop(); B.shapes[idx] = A; mk(a1, cut / 2, { type: 'blast', G }); mk(a2, L2 / 2, null)
    for (let i = sp.i - 2; i < sp.i + 10; i++) { const d = [P[i].p[0] - G.start[0], P[i].p[2] - G.start[2]], al = d[0] * G.f[0] + d[1] * G.f[2]; if (al > -0.6 && al < cut + 0.01) { P[i].kind = 'blast'; P[i].blast = G } }
    addLip(G, n, f, w)
    B.cans = B.cans || []; B.cans.push({ p: add3(G.start, G.f, -9), t: null })
    B.decor.push({ kind: 'blast', G }); B.v51.blasts.push({ k: 'road', i: sp.i, start: G.start })
  }
  // 氷の曲がり（1 か所）: 氷の区間の、幅 3.4m 以下で一番長い曲がり。板の摩擦を ICE.mu に、曲がりの手前の自動の減速を外す（速さを読むのが遊び）。
  //   全開で入ると外へ滑って落ちる。手前の普通の道でブレーキして 6m/s ほどで入れば曲がれる
  if (!globalThis.__noIce) { let best = null
    for (let i = 1; i < P.length; i++) { const q = P[i]; if (q.kind !== 'curve' || P[i - 1].kind === 'curve' || q.branch || q.zone !== 'ice' || q.w > 3.4) continue; let j = i; while (P[j + 1] && P[j + 1].kind === 'curve') j++; if (!best || j - i > best[1] - best[0]) best = [i, j] }
    if (best) { const [i0, i1] = best, ids = new Set()
      for (let i = i0; i <= i1; i++) { const q = P[i]; q.ice = true; for (const s of B.shapes) { if (ids.has(s) || s.mov || s.tag !== 'road' || s.max && (q.p[1] > s.max[1] + 1 || q.p[1] < s.min[1] - 1)) continue; const cp = closest(s, q.p[0], q.p[1] - 0.05, q.p[2]); if (cp && cp.d < 0.3) ids.add(s) } }
      for (const s of ids) { s.mu = ICE.mu; s.mat = 'ice' }
      B.v51.ice = { i0, i1, n: ids.size } } }
  // 谷底から吹き上げる風（2 か所）: 走っている途中（嵐の区間の長い道）と、跳んでいる途中（中盤の切れ目）に、間をおいてふわっと浮く。
  //   B.winds（physics の風）に上向きの力を足すだけ。強さは重さの UPDRAFT.a 倍の加速度、吹くのは周期の 3 割ほど（gustK）
  if (!globalThis.__noValleyWind) { const N = P.length, spots = [], mk = i => { let r = ''; for (const m of B.marks || []) if (i >= m.i0) r = m.name; return r }, bad = i => /道を選ぶ|谷を飛ぶ|大ジャンプ/.test(mk(i))
    for (let i = Math.floor(N * 0.25); i < N * 0.55 && spots.length < 1; i++) { let ok = true; for (let j = i; j < i + 18; j++) { const q = P[j]; if (!q || !q.p || q.branch || bad(j) || q.zone === 'ground' || !['road', 'orbit'].includes(q.kind) || q.w < 4 || (q.kap || 0) > 0.012 || Math.abs(q.slope || 0) > 0.05) { ok = false; break } } if (ok) spots.push({ a: i, b: i + 18, run: true }) }
    for (let i = Math.floor(N * 0.45); i < N * 0.75 && spots.length < 2; i++) { const q = P[i]; if (q.kind === 'jump' && !q.branch && !bad(i) && (q.len || 0) >= 5 && q.zone !== 'ground' && P[i - 1] && P[i - 1].kind !== 'blast') spots.push({ a: i - 1, b: i + 1, jump: true }) }
    for (const [n, sp] of spots.entries()) { const pts = []; for (let j = sp.a; j <= sp.b; j++) if (P[j] && P[j].p) pts.push(P[j].p); if (sp.jump) { const q = P[sp.a + 1]; pts.push([q.p[0] + Math.cos(q.yaw) * q.len, q.p[1] + (q.dy || 0), q.p[2] - Math.sin(q.yaw) * q.len]) }
      const mn = [0, 1, 2].map(k => Math.min(...pts.map(p => p[k])) - (k === 1 ? 1 : 3)), mx = [0, 1, 2].map(k => Math.max(...pts.map(p => p[k])) + (k === 1 ? 7 : 3))
      const g = { min: mn, max: mx, f: [0, sp.jump ? UPDRAFT.a : UPDRAFT.run, 0], w: 2 * Math.PI / UPDRAFT.T, ph: n * 1.7, pulse: true, valley: true }
      B.winds = B.winds || []; B.winds.push(g); B.decor.push({ kind: 'valleyWind', g }); (B.v51.winds = B.v51.winds || []).push({ i: sp.a, jump: !!sp.jump }) } }
  // ニトロでないと登れない急坂（2 か所）: 41 度の急坂のうち、嵐の回廊の最初と最後の塔のニトロの急坂。表面を濡れた滑る石にして、タイヤの力では登り切れず、
  //   ニトロ（重心を押す力。タイヤの滑りに関係なく効く）で登る。坂の形・長さは変えない
  if (!globalThis.__noSlick) { const done = new Set(), mk = i => { let r = ''; for (const m of B.marks || []) if (i >= m.i0) r = m.name; return r }
    for (let i = 1; i < P.length; i++) { const q = P[i]; if (q.kind !== 'steep' || P[i - 1].kind === 'steep' || q.branch) continue; let j = i; while (P[j + 1] && P[j + 1].kind === 'steep') j++
      const nm = mk(i), mx = Math.max(...P.slice(i, j + 1).map(x => x.slope || 0)); if (mx < 0.7 || !(/嵐の回廊|ニトロの急坂/.test(nm)) || done.has(nm)) continue; done.add(nm)
      const ids = new Set(); for (let k = i; k <= j; k++) { const qq = P[k]; qq.slick = true; for (const s of B.shapes) { if (ids.has(s) || s.mov || s.tag !== 'road' || s.max && (qq.p[1] > s.max[1] + 1 || qq.p[1] < s.min[1] - 1)) continue; const cp = closest(s, qq.p[0], qq.p[1] - 0.05, qq.p[2]); if (cp && cp.d < 0.3) ids.add(s) } }
      for (const s of ids) { s.mu = SLICK.mu; s.mat = 'wetstone'; s.slick = true }
      for (let k = Math.max(0, i - 14); k <= j; k++) P[k].nitro = true
      ;(B.v51.slick = B.v51.slick || []).push({ i, j, nm, n: ids.size }) } }
  for (const k of BLASTS) { const s = pick(k); if (!s) continue
    const ii = near(s, ['trap']); if (!ii.length) continue
    const q = P[ii[0]], hf = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], sg = dot(s.ax[0], hf) >= 0 ? 1 : -1, f = s.ax[0].map(v => v * sg), up = s.ax[1], w = s.h[2] * 2
    const end = add3(s.c, f, s.h[0])
    // その先の道の板（向きが同じで、始まりが落とし穴の終わりに接する箱）
    let ni = -1; for (let j = 0; j < B.shapes.length; j++) { const n = B.shapes[j]; if (n === s || n.type !== 'box' || n.mov || n.tag !== 'road' || Math.abs(dot(n.ax[0], s.ax[0])) < 0.999) continue; const st = add3(n.c, f, -n.h[0]); if (Math.hypot(st[0] - end[0], st[2] - end[2]) < 0.35 && Math.abs(st[1] + n.h[1] - end[1] - s.h[1]) < 0.15) { ni = j; break } }
    if (ni < 0) continue
    const n = B.shapes[ni], Ln = n.h[0] * 2, cut = Math.min(BLAST.cut, Ln - 0.8)
    const G = { t0: null, back: BLAST.back, start: add3(add3(s.c, f, -s.h[0]), up, s.h[1]), f: [f[0], 0, f[2]], w, trig: BLAST.trig, len: s.h[0] * 2 + cut }
    s.mov = { type: 'blast', G }
    const pc = add3(n.c, f, -n.h[0] + cut / 2), rc = add3(n.c, f, cut / 2)
    const a = B.box({ c: pc, h: [cut / 2, n.h[1], n.h[2]], yaw: n.base.yaw, pitch: n.base.pitch, roll: n.base.roll, zone: n.zone, mat: n.mat, mu: n.mu, tag: 'road', mov: { type: 'blast', G } })
    B.shapes.pop(); B.shapes[ni] = a // 先の板の初めの cut m（爆発で消える）を元の場所に、残りを後ろへ
    const rest = B.box({ c: rc, h: [n.h[0] - cut / 2, n.h[1], n.h[2]], yaw: n.base.yaw, pitch: n.base.pitch, roll: n.base.roll, zone: n.zone, mat: n.mat, mu: n.mu, tag: 'road' })
    for (const i of near(s, ['trap'])) { P[i].kind = 'blast'; P[i].blast = G }
    for (let i = ii[ii.length - 1] + 1; i < P.length && P[i].p; i++) { const d = [P[i].p[0] - G.start[0], P[i].p[2] - G.start[2]]; const al = d[0] * G.f[0] + d[1] * G.f[2]; if (al > G.len + 0.01) break; P[i].kind = 'blast'; P[i].blast = G }
    // 手前の燃料の缶（9m 手前の道の上）
    B.cans = B.cans || []; B.cans.push({ p: add3(G.start, G.f, -9), t: null })
    addLip(G, s, f, w)
    B.decor.push({ kind: 'blast', G })
    B.v51.blasts.push({ k, i: ii[0], start: G.start, rest })
  }
}
