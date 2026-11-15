// SKY BIKE v61 縁石の曲がり（本人が選んだ案 5）: 赤白の縁石が付いた曲がりだけ、自動の減速を外す。自分でブレーキする
//   曲がれる速さを少し超えると横滑りして（砂利の音と砂ぼこり）大きく減速＝遅くなる。かなり超えると乗り手だけ外へ投げ出されて落ちる（steer.js curbSkid）
//   前の 2 か所（1）は投げ出されるまでの幅が広い（1.35 倍）、後の 2 か所（2）は 1.2 倍。上手いと自動の減速より速く曲がれる
export const CURB = { soft: ['見極めの台', '突風の細い張り出し'], hard: ['ワイヤーの綱渡り', '落石の坂'], vmax: 10, k: 1.1 }
export function v61post(B) {
  const P = B.path, ALAT = 8, mk = i => { let r = ''; for (const m of B.marks || []) if (i >= m.i0) r = m.name; return r }
  B.decor = B.decor || []; B.v61 = { curbs: [] }
  const want = new Map([...CURB.soft.map(n => [n, 1]), ...CURB.hard.map(n => [n, 2])])
  for (let i = 1; i < P.length; i++) { const q = P[i]; if (q.kind !== 'curve' || P[i - 1].kind === 'curve' || q.branch || q.ice) continue
    let j = i; while (P[j + 1] && P[j + 1].kind === 'curve') j++
    const nm = mk(i), type = want.get(nm); if (!type) { i = j; continue }
    let kmax = 0, wmin = 9; for (let k = i; k <= j; k++) { kmax = Math.max(kmax, P[k].kap || 0); wmin = Math.min(wmin, P[k].w || 9) }
    const vcap = Math.sqrt(ALAT * Math.max(0.45, Math.min(1, (wmin - 0.6) / 2.4)) / Math.max(1e-3, kmax))
    if (vcap > CURB.vmax) { i = j; continue }
    for (let k = i; k <= j; k++) P[k].curb = type
    B.v61.curbs.push({ i0: i, i1: j, type, name: nm }); B.decor.push({ kind: 'curb', i0: i, i1: j, type })
    want.delete(nm); i = j }
  // v68 縁石の曲がりの外側に低い石の縁を置く（滑って勢いよく当たると投げ出される steer.js curbHit）。もう縁がある所・別の道が通る所には置かない
  const wr = a => Math.atan2(Math.sin(a), Math.cos(a))
  for (const D of B.v61.curbs) {
    let turn = 0; for (let k = D.i0; k < D.i1; k++) if (P[k].yaw != null && P[k + 1].yaw != null) turn += wr(P[k + 1].yaw - P[k].yaw)
    const out = turn > 0 ? 1 : -1
    for (let i = Math.max(1, D.i0 - 1); i <= Math.min(P.length - 2, D.i1 + 3); i++) { const q = P[i], z = P[i + 1]; if (!q.p || !z.p || q.branch || z.branch) continue
      const len = Math.hypot(z.p[0] - q.p[0], z.p[2] - q.p[2]); if (len < 0.05 || len > 3) continue
      const yaw = Math.atan2(-(z.p[2] - q.p[2]), z.p[0] - q.p[0]), off = ((q.w || 4) / 2 + 0.1) * out
      const c = [(q.p[0] + z.p[0]) / 2 + Math.sin(yaw) * off, (q.p[1] + z.p[1]) / 2, (q.p[2] + z.p[2]) / 2 + Math.cos(yaw) * off]
      if (B.shapes.some(s => s.tag === 'parapet' && s.c && Math.hypot(s.c[0] - c[0], s.c[2] - c[2]) < 1.0 && Math.abs(s.c[1] - c[1]) < 1)) continue
      if (P.some((t, k) => Math.abs(k - i) > 12 && t.p && Math.hypot(t.p[0] - c[0], t.p[2] - c[2]) < (t.w || 4) / 2 + 0.6 && Math.abs(t.p[1] - c[1]) < 1.5)) continue
      B.box({ c: [c[0], c[1] + 0.05, c[2]], h: [len / 2 + 0.1, 0.42, 0.13], yaw, pitch: Math.atan2(z.p[1] - q.p[1], len), mat: 'ruinwall', tag: 'parapet', curbWall: 1 }) } }
}
