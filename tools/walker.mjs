// 歩く人の bot: 普通のアクションゲームの人（歩き 1.5m/s・走り 5m/s・跳ぶ高さ 1.0m・幅 2.5m・よじ登れる段 1.2m・坂 35度まで・止まって待てる・下がれる）が、
// 道を最初から最後まで通れるかを、区間ごとに調べる。動く物（鉄球・動く床・跳ね橋・突風・落石）は待てば通れるとする。
// 通れない理由: 跳べない切れ目・登れない段・急すぎる坂・すべる氷の坂・走っても崩れる床・体当たりでしか壊れない扉
//   node tools/walker.mjs [LIST=1]
import { World } from '../js/physics.js'
import { COURSES } from '../js/course.js'
const c = COURSES.stage1(), w = new World(c.shapes), P = c.path
const DEG = Math.PI / 180, RUN = 5, JUMPW = 2.5, JUMPH = 1.0, CLIMB = 1.2, SLOPE = 35 * DEG
const main = P.filter(q => !q.branch).length
const under = q => { const r = w.rayDown(q.p[0], q.p[2], q.p[1] + 0.6, q.p[1] - 1.5); return r.id >= 0 && Math.abs(r.y - q.p[1]) < 0.5 ? w.shapes[r.id] : null }
const doorAt = new Set(); for (const d of c.doors || []) { let bi = 0, bd = 1e9; for (let i = 0; i < main; i++) { const q = P[i]; if (!q.p) continue; const dd = (q.p[0] - d.at[0]) ** 2 + (q.p[2] - d.at[2]) ** 2 + ((q.p[1] - d.at[1]) * 2) ** 2; if (dd < bd) { bd = dd; bi = i } } doorAt.add(bi) }
// 道の点 i から次の地面の点までの「通れない理由」（なければ null）
const blocks = []
for (let i = 0; i < main - 1; i++) {
  const q = P[i]
  if (doorAt.has(i)) blocks.push({ i, why: '扉（体当たりで壊す）' })
  // 切れ目: 地面の点 → 切れ目の点が続く → 次の地面の点。横の距離と高さ
  if (q.w && P[i + 1] && !P[i + 1].w && (P[i + 1].kind === 'jump' || P[i + 1].kind === 'gap' || P[i + 1].kind === 'draw')) {
    let k = i + 1; while (k < main && !P[k].w && P[k].kind !== 'stepUp' && P[k].kind !== 'stepDown') k++
    const a = q.p, b = P[k] && P[k].p; if (!b) continue
    const len = Math.hypot(b[0] - a[0], b[2] - a[2]), dy = b[1] - a[1]
    if (P[i + 1].kind === 'draw') continue // 跳ね橋は下りるのを待てる
    const reach = dy > 0 ? (dy > JUMPH ? 0 : JUMPW) : JUMPW + 1.0 * Math.min(4, -dy)
    if (len > reach + 0.3) blocks.push({ i, why: `切れ目 ${len.toFixed(1)}m（高さ ${dy.toFixed(1)}m）` })
  }
  if ((q.kind === 'stepUp' || q.kind === 'hang') && q.dy > CLIMB) blocks.push({ i, why: `段 ${q.dy.toFixed(2)}m` })
  if (q.kind === 'stepUp' && P[i - 1] && P[i - 1].kind === 'stepUp') { /* 続く段は1つずつ */ }
}
// 坂: 同じ向きに 2m 以上続く急な坂
for (let i = 0; i < main; i++) {
  let k = i; while (k < main && P[k].w && Math.abs(P[k].slope || 0) > SLOPE) k++
  if (k - i >= 2) { blocks.push({ i, why: `坂 ${(Math.abs(P[i].slope) / DEG).toFixed(0)}度 ${k - i}m` }); i = k; continue }
  // すべる坂（氷・泥）: 20度を超えて 3m 以上
  k = i; while (k < main && P[k].w && Math.abs(P[k].slope || 0) > 20 * DEG && (() => { const s = under(P[k]); return s && (s.mu ?? 1) < 0.5 })()) k++
  if (k - i >= 3) { blocks.push({ i, why: `すべる坂 ${(Math.abs(P[i].slope) / DEG).toFixed(0)}度 ${k - i}m` }); i = k }
}
// 崩れる床: 走って（5m/s）乗っている間に崩れる長さで、跳び越せない（2.5m を超える）
for (let i = 0; i < main; i++) {
  if (P[i].kind !== 'crumble') continue
  let k = i; while (k < main && P[k].kind === 'crumble') k++
  const len = k - i; let delay = 9; for (let j = i; j < k; j++) { const s2 = under(P[j]); if (s2 && s2.mov && s2.mov.type === 'crumble') delay = Math.min(delay, s2.mov.delay) }
  // 板 1 枚の長さ（崩れる前に渡り切れるか）。歩く人は片足ずつなので、乗っている時間がそのままたまる
  const pieces = (() => { const ids = new Set(); for (let j = i; j < k; j++) { const s2 = under(P[j]); if (s2 && s2.mov) ids.add(s2.id) } return Math.max(1, ids.size) })()
  const piece = len / pieces
  if (len > JUMPW + 0.5 && piece / RUN > delay) blocks.push({ i, why: `崩れる床 ${len}m（1枚 ${piece.toFixed(1)}m・${delay}秒で崩れる）` })
  i = k
}
blocks.sort((a, b) => a.i - b.i)
// 区間 = 休憩所の旗から次の旗まで
const flags = c.cps.map((q, ci) => ({ ci, q })).filter(o => o.q.rest || o.q.finish)
const flagI = flags.map(o => { let bi = 0, bd = 1e18; for (let i = 0; i < main; i++) { const z = P[i]; if (!z.p) continue; const d = (z.p[0] - o.q.p[0]) ** 2 + (z.p[2] - o.q.p[2]) ** 2 + ((z.p[1] - o.q.p[1]) * 2) ** 2; if (d < bd) { bd = d; bi = i } } return bi })
const rows = []
for (let k = 0; k < flags.length; k++) {
  const i0 = flagI[k], i1 = k + 1 < flags.length ? flagI[k + 1] : main
  if (i1 <= i0) continue
  const bl = blocks.filter(b => b.i >= i0 && b.i < i1)
  const marks = c.marks.filter(m => m.i0 < i1 && m.i1 > i0).map(m => m.name)
  rows.push({ 区間: flags[k].q.name, 歩く人: bl.length ? '通れない' : '通れる', 理由: bl.slice(0, 2).map(b => b.why).join('・'), 仕掛け: marks.slice(0, 3).join('・') })
}
console.table(rows)
console.log('歩く人が通れる区間', rows.filter(r => r.歩く人 === '通れる').length, '/', rows.length)
// 名前の付いた仕掛け（mark）ごと
if (process.env.LIST) { const mr = c.marks.map(m => ({ 仕掛け: m.name, 歩く人: blocks.some(b => b.i >= m.i0 && b.i <= m.i1) ? '通れない' : '通れる', 理由: blocks.filter(b => b.i >= m.i0 && b.i <= m.i1).map(b => b.why).slice(0, 2).join('・') })); console.table(mr); console.log('仕掛けで歩く人が通れる', mr.filter(r => r.歩く人 === '通れる').length, '/', mr.length) }
