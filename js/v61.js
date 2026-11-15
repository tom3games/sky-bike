// SKY BIKE v61 縁石の曲がり（本人が選んだ案 5）: 赤白の縁石が付いた曲がりだけ、自動の減速を外す。自分でブレーキする
//   soft（前の 2 か所）: 速すぎても落ちない。曲がりの中で横滑りして（砂利の音と砂ぼこり）大きく減速するだけ＝遅くなる
//   hard（後の 2 か所）: 速すぎると外へ落ちる。上手いと自動の減速より速く（約 1.2 倍）曲がれる
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
}
