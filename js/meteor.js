// SKY BIKE v77 隕石（本人 2026-11-19「一定の高さを超えたら、5 秒以上同じ場所で止まったら目の前に隕石落ちてくるようにして。爆風で乗ってる人だけ飛んでいくように」）
// 判定だけ（node の sim でも動く）。見た目と音は js/meteorview.js と game.js の meteorFx
//  ・出発の広場から 20m より上（練習の区間 0〜8m と、溶岩に追われる区間 12〜20m の上。溶岩の区間は溶岩が追ってくるので止まれない）
//  ・半径 1m 以内に 5 秒いたら（アクセル・ブレーキ・ニトロを押している・1.2m/s より速い・後輪が空回りしている時は数え直し）、バイクの 4.5m 前に落ちる。1.5 秒から兆し（空が赤くなる・空の光・地面の影・風切り音）。1m 動けば消える
//  ・発動しない所: 休憩所の旗のそば（8m）・出し直して何か押すまで・会話中・下山・高い縁に掛けている間・後輪の空転・動く床や回る物の上・
//    待って間合いを計る仕掛け（振り子・突風・歯車・羽根・鉄骨・扉・跳ね橋・シーソー・動く床・感知式の台・落石の坂・押す石と門・巻き上げ機）の手前 25m〜過ぎるまで
//  ・当たったら: 乗り手だけ爆風で後ろの上へ飛ぶ（見た目は bikeview の blastOff）。バイクはその場で少し跳ねるだけ。あとは今の転倒と同じ（最後の旗から）
export const METEOR = { minAlt: 20, rad: 1.0, sign: 1.5, fall: 1.3, hit: 5.0, ahead: 4.5, flagR: 8, wait: 3.0 }
const TIMING_KINDS = new Set(['gear', 'vgear', 'swing', 'spin', 'lift', 'glift', 'seesaw', 'sense', 'fork', 'forkRide', 'chimney', 'drum', 'drumRun', 'draw', 'blade', 'slide', 'trap'])
// 道の点ごとに「ここでは待つのが正しい」印（手前 25 点＝約 24m・後ろ 4 点）
function quietMap(course) {
  if (course._mq) return course._mq
  const P = course.path, n = P.length, q = new Uint8Array(n)
  const mark = (i, back = 25, fwd = 4) => { for (let k = Math.max(0, i - back); k <= Math.min(n - 1, i + fwd); k++) q[k] = 1 }
  for (let i = 0; i < n; i++) if (TIMING_KINDS.has(P[i].kind)) mark(i, 25, 4)
  const nearest = p => { let bi = -1, bd = 1e9; for (let i = 0; i < n; i++) { const a = P[i].p; if (!a) continue; const d = (a[0] - p[0]) ** 2 + (a[2] - p[2]) ** 2 + ((a[1] - p[1]) * 3) ** 2; if (d < bd) { bd = d; bi = i } } return bi }
  for (const h of course.hazards || []) { const i = nearest(h.p); if (i >= 0) mark(i, 25, Math.ceil(h.half || 2) + 4) }
  const B = course.boulder; if (B) for (let k = Math.max(0, B.gateI - 25); k <= Math.min(n - 1, B.topI + 4); k++) q[k] = 1
  const V = course.v76; if (V) for (const z of [V.A, V.B]) if (z && z.i0 != null) for (let k = Math.max(0, z.i0 - 25); k <= Math.min(n - 1, (z.i1 ?? z.i0) + 4); k++) q[k] = 1
  if (course.epi) for (let k = course.epi.i0; k < n; k++) q[k] = 1 // クリアの後の下山
  return (course._mq = q)
}
function nearPathI(course, p, from) {
  const P = course.path; let bi = from ?? 0, bd = 1e18
  const lo = from != null ? Math.max(0, from - 40) : 0, hi = from != null ? Math.min(P.length - 1, from + 40) : P.length - 1
  for (let i = lo; i <= hi; i++) { const a = P[i].p; if (!a) continue; const d = (a[0] - p[0]) ** 2 + (a[2] - p[2]) ** 2 + ((a[1] + 0.79 - p[1]) * 3) ** 2; if (d < bd) { bd = d; bi = i } }
  return bi
}
// なぜ今は数えないか（null なら数える）。検査でも使う
export function meteorBlock(world, course, R, b) {
  if (!course.climb) return 'course'
  if (b.ghost) return 'ghost'
  if (b.crashed) return 'crashed'
  if (R.mHold) return 'hold'
  if (b.hang || b.climb) return 'hang'
  if (b.burn) return 'burn'
  if (!b.g[0] && !b.g[1]) return 'air'
  if (b.p[1] - 0.79 - course.cps[0].p[1] < METEOR.minAlt) return 'low'
  for (let i = 0; i < 2; i++) { const cn = b.cn[i]; if (cn && b.g[i] && world.shapes[cn.id] && world.shapes[cn.id].mov) return 'moving' }
  if (b.carryId >= 0) return 'moving'
  for (const q of course.cps) if (q.rest && Math.hypot(b.p[0] - q.p[0], b.p[2] - q.p[2]) < METEOR.flagR && Math.abs(b.p[1] - 0.79 - q.p[1]) < 4) return 'flag'
  const i = R.onI != null ? R.onI : nearPathI(course, b.p, null)
  if (quietMap(course)[i]) return 'timing'
  return null
}
// 毎刻み（60Hz）。out.meteor に段階が変わった時の知らせ { ph: 'sign' | 'fall' | 'hit' | 'cancel', ... }
export function meteorStep(world, course, R, b, out) {
  const M = R.mt || (R.mt = { a: null, n: 0, ph: 'idle', hits: 0 })
  if (M.ph === 'hit') return
  const why = meteorBlock(world, course, R, b)
  const wr = b.wheelRot ? b.wheelRot[0] : 0, spinV = M.wr == null ? 0 : Math.abs(wr - M.wr) * 60 * 0.34; M.wr = wr /* 後輪の回る速さ（m/s）。壁に押し付けて空回り・段で何度も挑む時は「止まっている」に入れない */
  const moved = !M.a || Math.hypot(b.p[0] - M.a[0], b.p[1] - M.a[1], b.p[2] - M.a[2]) > METEOR.rad || Math.abs(b.speed) > 1.2 || spinV > 1.5 || b.act
  if (why || moved) {
    if (M.ph !== 'idle') out.meteor = { ph: 'cancel', why: why || 'moved' }
    M.a = b.p.slice(); M.n = 0; M.ph = 'idle'; M.why = why; return
  }
  M.n++; M.why = null
  const t = M.n / 60
  if (M.ph === 'idle' && t >= METEOR.sign) {
    // 落ちる所を決める: 前 4.5m の道の面（無ければ 3.5・2.5m。どこにも無ければバイクの足元の高さ）
    // 道の上の、これから進む先（道の点を 4.5m 先までたどる）。向きはバイクの前に近い方の道の向き
    const P = course.path, gy = b.p[1] - 0.79, i0 = R.onI != null ? R.onI : nearPathI(course, b.p, null)
    let hx = Math.cos(b.psi), hz = -Math.sin(b.psi)
    const q0 = P[i0], qa = P[Math.min(P.length - 1, i0 + 3)]
    let dir = 1; if (q0 && qa && q0.p && qa.p) { const ex = qa.p[0] - q0.p[0], ez = qa.p[2] - q0.p[2]; if (ex * hx + ez * hz < 0) dir = -1 } /* 後ろ向きに止まっていたら、向いている方の道へ */
    let tp = null
    for (let k = i0; k >= 0 && k < P.length && Math.abs(k - i0) < 30; k += dir) { const q = P[k]; if (!q.p) continue; const dx = q.p[0] - b.p[0], dz = q.p[2] - b.p[2]; if (Math.hypot(dx, dz) >= METEOR.ahead && Math.abs(q.p[1] - gy) < 2.5) { const y = world.rayDown(q.p[0], q.p[2], q.p[1] + 1.5, q.p[1] - 2); tp = [q.p[0], isFinite(y) ? y : q.p[1], q.p[2]]; break } if (q.p && Math.abs(q.p[1] - gy) > 2.5) break }
    if (!tp) for (const d of [METEOR.ahead, 3.5, 2.5]) { const x = b.p[0] + hx * d, z = b.p[2] + hz * d, y = world.rayDown(x, z, gy + 2.5, gy - 3); if (isFinite(y)) { tp = [x, y, z]; break } }
    if (!tp) tp = [b.p[0] + hx * 2.5, gy, b.p[2] + hz * 2.5]
    { const dx = tp[0] - b.p[0], dz = tp[2] - b.p[2], L = Math.hypot(dx, dz); if (L > 0.5) { hx = dx / L; hz = dz / L } }
    { /* 落ちる所の地面の傾き（焦げ跡と影を坂に沿わせる） */ const h = (x, z) => world.rayDown(x, z, tp[1] + 1.2, tp[1] - 1.2), d = 0.6, x0 = h(tp[0] - d, tp[2]), x1 = h(tp[0] + d, tp[2]), z0 = h(tp[0], tp[2] - d), z1 = h(tp[0], tp[2] + d)
      let n = [0, 1, 0]; if ([x0, x1, z0, z1].every(isFinite)) { const gx = (x1 - x0) / (2 * d), gz = (z1 - z0) / (2 * d), L = Math.hypot(gx, 1, gz); n = [-gx / L, 1 / L, -gz / L] } M.nrm = n }
    M.tp = tp; M.f = [hx, 0, hz]; M.ph = 'sign'; out.meteor = { ph: 'sign', p: tp.slice(), f: M.f.slice(), n: M.nrm.slice() }
  }
  if (M.ph === 'sign' && t >= METEOR.hit - METEOR.fall) { M.ph = 'fall'; out.meteor = { ph: 'fall', p: M.tp.slice(), f: M.f.slice() } }
  if (M.ph === 'fall' && t >= METEOR.hit) {
    M.ph = 'hit'; M.hits++
    if (globalThis.__meteorDry) { (M.log = M.log || []).push({ t: +world.time.toFixed(1), i: R.onI, p: b.p.map(v => +v.toFixed(1)), alt: +(b.p[1] - 0.79 - course.cps[0].p[1]).toFixed(1) }); M.ph = 'idle'; M.n = 0; M.a = null; return } /* 検査: 落とさずに数えるだけ */
    // 爆風: 乗り手は見た目で飛ぶ。車体は重いのでその場で少し浮いて揺れるだけ
    const d = [b.p[0] - M.tp[0], 0, b.p[2] - M.tp[2]], L = Math.hypot(d[0], d[2]) || 1
    b.crashed = { why: 'meteor', v: 0, t: 0, at: b.p.slice(), from: M.tp.slice() }
    b.v[0] += d[0] / L * 0.2; b.v[2] += d[2] / L * 0.2; b.v[1] += 1.1; b.w += 0.6
    b.g = [false, false]
    out.meteor = { ph: 'hit', p: M.tp.slice(), f: M.f.slice(), n: M.nrm.slice() }
  }
}
// 今の兆しの強さ 0〜1（見た目用）
export function meteorK(R) { const M = R && R.mt; if (!M || M.ph === 'idle') return 0; if (M.ph === 'hit') return 0; return Math.min(1, Math.max(0, (M.n / 60 - METEOR.sign) / (METEOR.hit - METEOR.sign))) }
// 出し直し: 次の隕石はまた 5 秒から
// 落下の進み 0〜1（見た目用。画面のコマの速さに関係なく、判定の刻みに合わせる）
export function meteorFallU(R) { const M = R && R.mt; if (!M || M.ph !== 'fall') return -1; return Math.min(1, Math.max(0, (M.n / 60 - (METEOR.hit - METEOR.fall)) / METEOR.fall)) }
export function meteorReset(R) { if (R.mt) { R.mt.ph = 'idle'; R.mt.n = 0; R.mt.a = null } }
