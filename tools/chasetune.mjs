// v51 追ってくる崩れ（chase）: 崩れの組ごとに、手前 18m から「全開＋ニトロ」「全開だけ」「上手い bot」「人の速さ bot」で走り、
//   最初の板に触れてからの後輪の進み（組の始まりからの距離）を測る。MEASURE=1 は崩れを止めて、全開＋ニトロの後輪の進みに 2 次式を当てはめ、
//   「崩れの先が後輪の GAP m 後ろまで迫る」lead を出す。ふつうに回すと、各走りで渡れたか・崩れの先と後輪の一番近い差を出す
// node tools/chasetune.mjs  /  MEASURE=1 node tools/chasetune.mjs
if (process.env.MEASURE) globalThis.__chaseOff = 1
const { World, createBike, stepBike, DT, basis, wheelCenter } = await import('../js/physics.js')
const { COURSES } = await import('../js/course.js')
const { createBot, botInput, resetBot } = await import('../js/bot.js')
const { settle } = await import('../js/run.js')
const S = await import('../js/steer.js')
const c = COURSES.stage1(), P = c.path
const groups = [...new Set(c.shapes.filter(s => s.mov && s.mov.chase).map(s => s.mov.chase.G))]
const GAP = +(process.env.GAP || 0.25)
for (const [gi, G] of groups.entries()) {
  const planks = c.shapes.filter(s => s.mov && s.mov.chase && s.mov.chase.G === G)
  const p0 = planks.find(s => s.mov.chase.s0 === 0)
  // 組の始まり: 最初の板の中心から、板の向きに半分戻る
  const ax = p0.ax[0], start = [p0.c[0] - ax[0] * p0.h[0], p0.c[1] - ax[1] * p0.h[0], p0.c[2] - ax[2] * p0.h[0]]
  let i0 = 0, best = 1e9; for (let i = 0; i < P.length; i++) { const q = P[i]; if (!q.p) continue; const d = Math.hypot(q.p[0] - start[0], q.p[2] - start[2]) + Math.abs(q.p[1] - start[1]); if (d < best) { best = d; i0 = i } }
  let k = i0, d = 0; while (k > 0 && d < +(process.env.RUNUP || 40)) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k--; if ((['jump', 'lip', 'stepUp'].includes(P[k].kind) && d > 6) || (P[k].kind === 'crumble' && P[k].chase !== G && d > 1)) { k++; break } }
  if (globalThis.__lastG && i0 - globalThis.__lastG.i1 < 10) k = globalThis.__lastG.k // 続けて並ぶ組（4m の道を挟む）は、前の組の手前から通して走る
  globalThis.__lastG = { i1: i0 + Math.round(G.len), k }
  const rows = []
  const modes = process.env.MEASURE ? [G.nitro ? '全開＋ニトロ' : '全開だけ'] : ['全開＋ニトロ', '全開だけ', '上手い bot', '人の速さ bot']
  for (const mode of modes) {
    const w = new World(c.shapes); w.winds = c.winds || []; w.setTime(0)
    const q = P[k], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })); { const sl = q.slope || 0; b.v = [Math.cos(q.yaw) * 7 * Math.cos(sl), 7 * Math.sin(sl), -Math.sin(q.yaw) * 7 * Math.cos(sl)] }
    const st = S.createSteer(P); S.resetSteer(st, b)
    const bot = mode.includes('bot') ? createBot(c, { skill: 'good', react: mode.includes('人') ? 12 : 0 }) : null; if (bot) { bot.world = w; resetBot(bot, b) }
    const samp = []; let minGap = 1e9, across = false
    for (let s = 0; s < 60 * 12; s++) {
      let inp = bot ? botInput(bot, b) : S.assist(st, b, { thr: 1, brk: 0, lean: b.th > 0.3 ? 0.6 : 0, steer: S.steerFor(st, b), nitro: mode.includes('ニトロ') ? 1 : 0 })
      if (mode.includes('ニトロ') && s === 0) b.nitro = 1
      w.tick(); stepBike(w, b, inp, [])
      const B = basis(b), rc = wheelCenter(b, B, 0, 0), along = (rc[0] - start[0]) * ax[0] + (rc[1] - start[1]) * ax[1] + (rc[2] - start[2]) * ax[2]
      if (G.t0 != null || (process.env.MEASURE && samp.length) || (process.env.MEASURE && b.cn[1] && planks.some(p => p.id === b.cn[1].id))) {
        const tau = process.env.MEASURE ? samp.length * DT : w.time - G.t0
        samp.push([tau, along]); if (process.env.DG == gi && mode === (process.env.DM || "全開＋ニトロ") && samp.length % 6 === 1) console.log("tau", tau.toFixed(2), "along", along.toFixed(2), "sw", (G.v0 * tau + G.a * tau * tau / 2 - G.lead).toFixed(2), "v", b.speed.toFixed(1), "nitro", b.nitroOn, b.nitro.toFixed(2), "t0", G.t0)
        if (!process.env.MEASURE) { const sw = (G.tab ? (await import('../js/physics.js')).chaseTab(G.tab, tau) : G.v0 * tau + G.a * tau * tau / 2) - G.lead; if (along < G.len + 0.5) minGap = Math.min(minGap, along - 0.36 - sw) }
      }
      if (along > G.len + 3 && Math.abs(b.p[1] - 0.79 - (start[1] + ax[1] * G.len)) < 2.5) { across = true; break }
      if (b.crashed || b.p[1] < start[1] - 8) break
    }
    if (process.env.MEASURE) {
      // 後輪の進み s(τ)（板の上にいる間）に s ≈ v0 τ + a τ²/2 を当てはめ（最小二乗）、崩れの先が後輪の後ろの端（−0.36m）より GAP 後ろに来る lead
      const on = samp.filter(([, s]) => s > -1 && s < G.len)
      let S11 = 0, S12 = 0, S22 = 0, B1 = 0, B2 = 0
      for (const [t, s] of on) { const x1 = t, x2 = t * t / 2, y = s; S11 += x1 * x1; S12 += x1 * x2; S22 += x2 * x2; B1 += x1 * y; B2 += x2 * y }
      const det = S11 * S22 - S12 * S12, v0 = (B1 * S22 - B2 * S12) / det, a = (S11 * B2 - S12 * B1) / det
      { const tab = []; for (let t = 0; t <= samp[samp.length - 1][0] + 1e-9; t += 0.1) { const j = Math.min(samp.length - 1, Math.round(t / DT)); tab.push(+samp[j][1].toFixed(2)) } console.log(`組${gi} tab（後輪の進み 0.1 秒ごと）: [${tab.join(', ')}]  lead は 0.36 + GAP(${GAP}) = ${(0.36 + GAP).toFixed(2)}`) }
      let lead = -1e9; for (const [t, s] of on) lead = Math.max(lead, v0 * t + a * t * t / 2 - (s - 0.36 - GAP))
      console.log(`組${gi} 長さ${G.len} 板${planks.length} 渡れた ${across} 後輪の点 ${on.length} → { v0: ${v0.toFixed(2)}, a: ${a.toFixed(2)}, lead: ${lead.toFixed(2)} }`)
    } else rows.push({ 組: gi, 長さ: G.len, 走り: mode, 渡れた: across ? 'o' : b.crashed ? '転倒 ' + b.crashed.why : '落ちた', 崩れとの差: minGap < 1e8 ? +minGap.toFixed(2) : null })
  }
  if (rows.length) console.table(rows)
}
