// SKY BIKE v62 技が要る近道（3 本）: 道の上のウィリー跳ね板
// 時間のかかる仕掛け（上下する床・三つの段・後輪で乗る台）の手前の道に、跳ね板を 1 枚置く。跳ね板の向こうに上の段（着地する道）が見えている。
//   ウィリーで（車体の角度 V62.pitchT ± V62.pitchTol で、前輪を浮かせて）後輪が板に乗ると跳ねて、仕掛けを飛びこえて上の段へ着く＝速い。
//   角度が外れている・両輪で乗った時は、ただの床（何も起きない）。そのまま、いつもの仕掛けを通る＝遅いだけで落ちない。
//   跳び方は板ごとに決まっている（入った速さによらず、同じ所へ着く）。空中で着地の角度へ向かうように回す
// 道の点の数と並びは変えない（板は道の上に重ねて置き、道の点には印 v62 を付けるだけ）
const DEG = Math.PI / 180
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const G = 9.81
export const V62 = { pitchT: 30 * DEG, pitchTol: 10 * DEG, Lp: 3.8, W: 2.6, trigAt: 1.0, vy: 11, thLand: 8 * DEG, vIn: 3.7 }
// mark: 区間の名前 / at: 仕掛けの始まりの点の見つけ方 / lip: 板の先端を仕掛けの何 m 手前に置くか / land: 着地する道の点の見つけ方 / plus: その何 m 先を狙うか
export const SPOTS = [
  { name: '上下する床を飛びこえる', mark: '工場の試験', at: q => q.kind === 'lift' && q.up, lip: 2.2, /* 板の手前 7m に破る扉がある */ land: (q, y) => q.kind === 'road' && q.p[1] > y + 2.9, plus: 3 },
  { name: '三つの段を飛びこえる', mark: '最後の塔 縁の三段', at: q => q.kind === 'hang', lip: 1.8, land: (q, y) => q.kind === 'road' && q.p[1] > y + 4.7, plus: 4 },
  { name: '後輪で乗る台を飛びこえる', mark: '最後の塔 後輪で乗る台と梁', at: q => q.kind === 'sense', lip: 3.6, land: (q, y) => q.kind === 'road' && q.p[1] > y + 2.5, plus: 4 },
]
export function v62post(B) {
  const P = B.path, out = []
  if (globalThis.__noV62) { B.v62 = { spots: [] }; return } /* 検査用: 近道なしの比べ */
  B.decor = B.decor || []
  for (const S of SPOTS) {
    const mk = (B.marks || []).find(m => m.name === S.mark); if (!mk) continue
    let iA = -1; for (let i = mk.i0; i <= mk.i1; i++) if (P[i] && P[i].p && S.at(P[i])) { iA = i; break }
    if (iA < 0) continue
    const q0 = P[iA - 1], y0 = q0.p[1], yaw = q0.yaw, f = B.dir(yaw)
    let iL = -1; for (let i = iA; i <= mk.i1 + 40; i++) if (P[i] && P[i].p && S.land(P[i], y0)) { iL = i; break }
    if (iL < 0) continue
    // 板の先端（lip）は仕掛けの始まりの lip m 手前。板の始まりはそのさらに Lp 手前
    const pA = P[iA].p, start = add3([pA[0], y0, pA[2]], f, -(S.lip + V62.Lp)), lip = add3(start, f, V62.Lp)
    const qL = P[iL], tgt = add3(qL.p, f, S.plus)
    // 跳ぶ所（後輪が trigAt を過ぎた所。車体の真ん中は後輪の約 0.7m 前）から、着地点までを決まった跳び方で
    const p0 = add3(start, f, V62.trigAt + 0.7), dy = tgt[1] - y0, vy = V62.vy
    const tf = (vy + Math.sqrt(vy * vy - 2 * G * dy)) / G, dist = (tgt[0] - p0[0]) * f[0] + (tgt[2] - p0[2]) * f[2], vf = dist / tf
    const m = { type: 'kick', axis: [0, 1, 0], stroke: 0.5, k0: vy, kv: 0, vmax: 13, hold: 0.6, back: 1.0, trigAt: V62.trigAt, trigEnd: V62.Lp - 0.15, start, f, ext: [0.2, 1.2, 0.2], trig: null,
      pitchT: V62.pitchT, pitchTol: V62.pitchTol, pitchK: 0, pitchLoss: 0, v62: out.length + 1, vf, vy, tf, thLand: V62.thLand }
    // 道の上に重ねた薄い板（上の面は道より 1cm 高いだけ）
    const sh = B.box({ c: add3(add3(start, f, V62.Lp / 2), [0, 1, 0], -0.05 + 0.01), h: [V62.Lp / 2 - 0.015, 0.05, V62.W / 2], yaw, mat: 'plank', mu: 1.05, tag: 'road', mov: m, zone: q0.zone })
    B.decor.push({ kind: 'kick', shape: sh, Lp: V62.Lp, W: V62.W, v62: true })
    const info = { m, shape: sh, n: m.v62, start, f, yaw, lip, iA, iL, tgt, name: S.name, mark: S.mark, vf, tf }
    // 板の手前から板の上までの道の点に印（bot が板を見つける）
    for (let i = 0; i < P.length; i++) { const q = P[i]; if (!q.p || q.branch) continue; const a = (q.p[0] - start[0]) * f[0] + (q.p[2] - start[2]) * f[2], l = (q.p[0] - start[0]) * f[2] - (q.p[2] - start[2]) * f[0]; if (a > -0.5 && a < V62.Lp && Math.abs(l) < 1.5 && Math.abs(q.p[1] - y0) < 0.5) q.v62 = info }
    out.push(info)
  }
  B.v62 = { spots: out.map(s => ({ name: s.name, mark: s.mark, iA: s.iA, iL: s.iL, start: s.start, lip: s.lip, tgt: s.tgt, yaw: s.yaw, vf: +s.vf.toFixed(2), tf: +s.tf.toFixed(2) })) }
  B.v62planks = out
}
