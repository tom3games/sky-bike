// 縁石の曲がりに、いろいろな速さで全開のまま入った時に何が起きるかを数える（v67）。
//   結果: ok（曲がれた）/ skid（横滑りして曲がれた）/ out（外へはみ出して落ちた）/ curb（縁石に当たって投げ出された）/ ほかの転倒
//   「曲がりに入る前に投げ出される」「縁石から離れた所で投げ出される」が 0 であることを見る
if (process.env.HIT) globalThis.__curbHit = +process.env.HIT
if (process.env.THROW) globalThis.__curbThrow = +process.env.THROW
if (process.env.K) globalThis.__curbGrip = +process.env.K
const { World, createBike, stepBike } = await import('../js/physics.js')
const { COURSES } = await import('../js/course.js')
const { settle } = await import('../js/run.js')
const S = await import('../js/steer.js')
const c = COURSES.stage1(), P = c.path
const curbs = (c.decor || []).filter(d => d.kind === 'curb')
const nm = i => { let n = ''; for (const m of c.marks || []) if (i >= m.i0) n = m.name; return n }
const rows = []; let ng = 0
for (const D of curbs) for (const V of (process.env.VS || '7,9,11,13,15,18').split(',').map(Number)) {
  let i0 = D.i0; for (let n = 0, d = 0; n < 40 && i0 > 1 && d < 22; n++) { const a = P[i0], z = P[i0 - 1]; if (!z.p || z.branch !== a.branch || z.kind === 'jump' || z.kind === 'lip') break; d += Math.hypot(a.p[0] - z.p[0], a.p[2] - z.p[2]); i0-- }
  const w = new World(c.shapes); w.winds = c.winds || []
  const q = P[i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), st = S.createSteer(P); S.resetSteer(st, b)
  const f = [Math.cos(q.yaw), 0, -Math.sin(q.yaw)], v0 = Math.min(V, 9); b.speed = v0; b.v = [f[0] * v0, 0, f[2] * v0]; w.setTime(0)
  let res = 'ok', wob = 0, yawMax = 0, skid = 0, maxLat = 0, at = null, vIn = 0, info = ''
  for (let s = 0; s < 60 * 9; s++) {
    let inp = { thr: b.speed < V ? 1 : 0, brk: 0, lean: 0, steer: S.steerFor(st, b), nitro: process.env.NIT ? 1 : 0 }; if (process.env.NIT) b.nitro = 1
    inp = S.assist(st, b, inp); if (inp.skid) skid++; if (inp.wob) { wob++; yawMax = Math.max(yawMax, Math.abs(Math.atan2(Math.sin(b.psi - P[st.i].yaw), Math.cos(b.psi - P[st.i].yaw)))) }
    const ev = []; stepBike(w, b, inp, ev)
    const pq = P[st.i]; if (!vIn && st.i >= D.i0) vIn = b.speed
    if (process.env.TR && nm(D.i0).includes(process.env.TR) && s % 6 === 0) { const r2 = [Math.sin(pq.yaw), Math.cos(pq.yaw)]; console.log(st.i - D.i0, 'lat', (((b.p[0] - pq.p[0]) * r2[0] + (b.p[2] - pq.p[2]) * r2[1]) * (st.curbOut || 1)).toFixed(2), 'hw', ((pq.w || 0) / 2).toFixed(2), 'v', b.speed.toFixed(1), 'sk', st.skid, inp.slide ? 'SLIDE' : '', 'g', +b.g[0], +b.g[1], 'dy', (b.p[1] - pq.p[1]).toFixed(2), 'kap', (pq.kap || 0).toFixed(3), pq.kind, 'lim', (st.curbLim || 0).toFixed(1), 'side', b.side.map(x => x && x.depth > 0 ? c.shapes[x.id].tag + '/' + c.shapes[x.id].mat : '-').join(' '), 'on', b.cn.map(x => x ? c.shapes[x.id].tag : '-').join(' ')) }
    const rt = [Math.sin(pq.yaw), Math.cos(pq.yaw)], lat = (b.p[0] - pq.p[0]) * rt[0] + (b.p[2] - pq.p[2]) * rt[1], hw = (pq.w || 4) / 2
    if (st.i >= D.i0 - 4 && st.i <= D.i1 + 6) maxLat = Math.max(maxLat, Math.abs(lat) / hw)
    if (b.crashed) { res = b.crashed.why; at = st.i; info = `外の端まで ${(hw - lat * st.curbOut).toFixed(2)}m 外向き ${(st.vo2 || 0).toFixed(1)}m/s`
      if (res === 'curb' && st.i < D.i0) { ng++; info += ' NG 曲がりの前' }
      if (res === 'curb' && hw - lat * st.curbOut > 1.3) { ng++; info += ' NG 縁石から遠い' }
      break }
    if (b.p[1] < pq.p[1] - 1.5) { res = 'out'; at = st.i; break }
    if (st.i > D.i1 + 8) break
  }
  if (res === 'ok' && skid) res = 'skid'
  rows.push({ 場所: nm(D.i0), 種: D.type, 点: `${D.i0}-${D.i1}`, 幅: +(P[D.i0].w || 0).toFixed(1), 全開の上限: V, 入った速さ: +vIn.toFixed(1), 結果: res, どこで: at == null ? '' : at - D.i0, 横滑りコマ: skid, 最大はみ出し: +maxLat.toFixed(2), 取られたコマ: wob, 向きのずれ度: +(yawMax * 57.3).toFixed(0), 備考: info })
}
console.table(rows); console.log('NG', ng); process.exit(ng ? 1 : 0)
