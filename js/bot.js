// 自動で走る bot（検査・デモ用）。skill: 'good'（ウィリー・空中の角度合わせ・速さの調整）/ 'bad'（アクセルとハンドルだけ）
import { basis, wheelCenter, BIKE, liftPos, shuttlePos } from './physics.js?v=16'
import { createSteer, steerFor, resetSteer, assist } from './steer.js?v=16'

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
// 道の点を先へたどる（合流の nx をたどる。枝道の境目で止まる）
export function seq(path, i, n) {
  const out = []; let k = i
  while (k >= 0 && k < path.length && out.length < n) { out.push(k); const q = path[k]; if (q.nx != null) { k = q.nx; continue } const z = path[k + 1]; if (!z || !z.branch !== !q.branch || z.br !== q.br) break; k++ }
  return out
}
export function createBot(course, o = {}) {
  const path = o.path || course.path
  // 道を選ぶ床: 枝道の始まりの番号（finish の後に決まる）
  for (const q of path) if (q.fork && q.fork.branchPath && q.fork.branchI == null) q.fork.branchI = path.indexOf(q.fork.branchPath[0])
  return { fork: o.fork || (o.skill === 'bad' ? 'L' : o.react > 0 ? 'safe' : 'hard') /* v16: 上手い bot は短い道、人の速さの bot は長い道 */, forkN: 0, path, hz: course.hazards || [], st: createSteer(path), i: 0, skill: o.skill || 'good', phase: 0, react: o.react || 0, queue: [], lat: o.lat || 0, vMul: o.vMul || 1 }
}
export function resetBot(bot, b) { bot.i = nearest(bot, b, 0, bot.path.length); resetSteer(bot.st, b); bot.phase = 0; bot.queue.length = 0; bot.jkDone = null; bot.corner = null; bot.liftGo = false; bot.backT = 0; bot.stuckT = 0; bot.creep = 0; bot.forkOn = false; bot.forkExit = false; bot.forkWant = null }
function nearest(bot, b, from, to) {
  let best = 1e9, bi = from
  const scan = (a, z) => { for (let i = Math.max(0, a); i < Math.min(bot.path.length, z); i++) {
    const p = bot.path[i].p; if (!p) continue
    const d = (p[0] - b.p[0]) ** 2 + (p[2] - b.p[2]) ** 2 + ((p[1] + 0.8 - b.p[1]) * 2) ** 2
    if (d < best) { best = d; bi = i }
  } }
  scan(from, to)
  for (let i = Math.max(0, from); i < Math.min(bot.path.length, to); i++) { const nx = bot.path[i].nx; if (nx != null) scan(nx, nx + 25) }
  // 近くに道の点がない（跳んで届かず下の道へ落ちた時など）は全部から探す
  if (best > 16 && (from > 0 || to < bot.path.length)) return nearest(bot, b, 0, bot.path.length)
  return bi
}
export function botInput(bot, b) {
  const path = bot.path, P = BIKE
  if (b.hang) return hangInput(bot, b)
  bot.hangT0 = null
  bot.i = nearest(bot, b, bot.i - 2, bot.i + 25)
  const SQ = seq(path, bot.i, 60), PV = {}; for (let a = 1; a < SQ.length; a++) PV[SQ[a]] = SQ[a - 1]
  const B = basis(b)
  const sp = b.speed
  // ハンドルは自動（ゲームと同じ js/steer.js）
  let steer = steerFor(bot.st, b, bot.lat)
  // この先の様子
  let vT = 11, stepAt = null, lipAt = null, narrow = false, turnAhead = false, dsum = 0, landSlope = null
  // 先の要所で要る速さから、今出してよい速さを逆算する（ブレーキ 2.5m/s² で間に合う速さ）
  let vCap = 99
  bot.jumpAhead = false; bot.steepAhead = false
  const need = (v, d) => { vCap = Math.min(vCap, Math.sqrt(v * v + 2 * 2.5 * Math.max(0, d - 1))) }
  for (let jj = 0, j = SQ[0], dd = 0; jj < Math.min(SQ.length, 60); j = SQ[++jj]) {
    const q = path[j]
    if (jj > 0 && path[PV[j]].p && q.p) dd += Math.hypot(q.p[0] - path[PV[j]].p[0], q.p[2] - path[PV[j]].p[2])
    if (q.kind === 'stepUp' && q.dy > 0.25) need(q.dy > 0.55 ? 1.1 : q.dy > 0.4 ? 3.4 : 3.5, dd)
    if (q.kind === 'lift' && !bot.liftGo) need(0.8, Math.max(0, dd - 3.2))
    if (((q.slope || 0) > 0.38 || q.kind === 'steep' || q.kind === 'mud') && dd < 12) bot.steepAhead = true
    if (q.kind === 'narrow' || q.kind === 'pipe' || (q.w && q.w < 1.3)) need(3.6, dd)
    if (jj > 0 && !q.curv && !path[bot.i].curv && Math.abs(wrap((q.yaw ?? b.psi) - (path[bot.i].yaw ?? b.psi))) > 0.9) need((q.w || 9) < 2 ? 2.6 : 2.9, dd)
    if (q.curv && dd < 20) need(Math.sqrt(20 / (1.42 * Math.abs(q.curv))) * 0.85, dd)
    if (q.kind === 'lip') break
    if (q.kind === 'jump') { if (dd < 9) { bot.jumpAhead = true; bot.vJump = q.vJump } break }
  }
  for (let jj = 0, j = SQ[0]; jj < Math.min(SQ.length, 40); j = SQ[++jj]) {
    const q = path[j]
    if (jj > 0 && path[PV[j]].p && q.p) dsum += Math.hypot(q.p[0] - path[PV[j]].p[0], q.p[2] - path[PV[j]].p[2])
    if (q.kind === 'stepUp' && q.dy > 0.25 && stepAt == null && dsum < 14) stepAt = { d: dsum, q }
    if (q.kind === 'lip' && lipAt == null && dsum < 30) lipAt = { d: dsum, q }
    if (q.kind === 'bump' && dsum < 6) vT = Math.min(vT, 6)
    if ((q.kind === 'narrow' || q.kind === 'pipe' || (q.w && q.w < 1.3)) && dsum < 10) narrow = true
    if (!turnAhead && jj > 0 && !q.curv && Math.abs(wrap((q.yaw ?? b.psi) - (path[bot.i].yaw ?? b.psi))) > 0.9 && dsum < 9) { turnAhead = true; if (bot.corner == null || bot.corner.j !== j) bot.corner = { j, d: dsum, yaw: q.yaw, narrow: (q.w || 9) < 2 } ; else bot.corner.d = dsum }
  }
  const cur = path[bot.i]
  if (cur.kind === 'spiral' || cur.kind === 'narrowSpiral' || cur.kind === 'orbit') vT = 10
  if (narrow) vT = 3.6
  if (turnAhead) vT = Math.min(vT, narrow || (bot.corner && bot.corner.narrow) ? 2.6 : 2.9)
  if (stepAt) vT = Math.min(vT, stepAt.q.dy > 0.55 ? (stepAt.d < 5 ? 1.1 : 2.5) : stepAt.q.dy > 0.4 ? 3.4 : 3.5)
  if (lipAt) vT = Math.max(vT, lipAt.q.vNeed || 12.5)
  if (!lipAt || (lipAt.d > 12 && !((lipAt.q.vNeed || 0) >= 14.5 && lipAt.d < 30))) vT = Math.min(vT, vCap) // 屋上の大ジャンプは、助走の全部を全開で
  if (bot.jumpAhead) vT = Math.max(vT, bot.vJump || 6.5)
  if (bot.steepAhead && !stepAt) vT = Math.max(vT, 9) // すべる急坂は勢いで一気に
  if (cur.kind === 'crumble' || (path[bot.i + 2] && path[bot.i + 2].kind === 'crumble')) vT = Math.max(vT, 7) // 崩れる板の上では止まらない
  for (let jj = 0, j = SQ[0]; jj < Math.min(SQ.length, 9); j = SQ[++jj]) if (path[j].kind === 'trap') { vT = Math.max(vT, 7); break } // 抜け落ちる床は速さで越える
  // 高い縁（前輪を掛ける）: 歩く速さで近づき、手前でウィリー
  let hangAt = null, nitroNeed = false, nitroLip = 0
  for (let jj = 0, j = SQ[0], dd = 0; jj < Math.min(SQ.length, 30); j = SQ[++jj]) {
    const q = path[j]; if (jj > 0 && path[PV[j]].p && q.p) dd += Math.hypot(q.p[0] - path[PV[j]].p[0], q.p[2] - path[PV[j]].p[2])
    if ((q.kind === 'jump' || q.kind === 'lip') && (jj > 1 || q.kind === 'jump')) break // 先に跳ぶ所がある時は、縁のための減速はまだしない
    if (q.kind === 'hang' && hangAt == null && dd < 16) hangAt = { d: dd, q }
    if (q.nitro && dd < 26) nitroNeed = true
    if (q.kind === 'lip' && (q.vNeed || 0) > 15.5 && dd < 40) nitroLip = q.vNeed
  }
  if (hangAt) { vT = Math.min(vT, hangAt.d < 7 ? 1.2 : 3.5) }
  if (nitroNeed) vT = Math.max(vT, 21) // ニトロの所はブレーキを使わない（最高 20m/s）
  if (nitroLip) vT = Math.max(vT, nitroLip) // ジャンプ台で要る速さまでだけニトロ（出しすぎると跳びすぎる）
  if (bot.skill === 'bad') { vT = narrow ? 6 : turnAhead ? 7 : 14 }
  vT *= bot.vMul
  let thr = sp < vT ? 1 : 0, brk = sp > vT + 0.3 ? Math.min(sp > vT + 3 && bot.skill === 'good' ? 0.7 : 0.45, (sp - vT) * 0.4) : 0
  let lean = 0
  const air = !b.g[0] && !b.g[1]
  const slope = cur.slope || 0
  if (bot.skill === 'good') {
    // 段差: 前輪が近づいたらウィリー → 前輪が上に出たら前へ
    const fw = wheelCenter(b, B, 1, b.s[1]), rw = wheelCenter(b, B, 0, b.s[0])
    const hx = Math.cos(cur.yaw ?? b.psi), hz = -Math.sin(cur.yaw ?? b.psi)
    if (stepAt && bot.phase === 0) {
      const fd = (stepAt.q.p[0] - fw[0]) * hx + (stepAt.q.p[2] - fw[2]) * hz
      if (stepAt.q.dy > 0.55 || (stepAt.q.dy > 0.38 && (bot.slowStep || (sp < 2.2 && fd < 1.7)))) { if (fd < 1.7) { bot.phase = 20; bot.stepY = stepAt.q.p[1]; bot.stepP = stepAt.q.p } }
      else if (fd < 1.1 + Math.max(0, sp) * 0.65) { bot.phase = 1; bot.stepY = stepAt.q.p[1]; bot.stepP = stepAt.q.p }
    }
    // ジャックナイフ: 細い道の曲がり角で、前ブレーキ＋前重心で後輪を浮かせ、前輪を軸に回る
    if (false && bot.phase === 0 && turnAhead && bot.corner && bot.corner.narrow && bot.jkDone !== bot.corner.j && !air && Math.abs(sp) < 5 && (() => { const cp = path[bot.corner.j].p; const fwp = wheelCenter(b, B, 1, b.s[1]); return Math.hypot(fwp[0] - cp[0], fwp[2] - cp[2]) < 0.45 + Math.abs(sp) * 0.12 })()) { bot.phase = 10; bot.jkYaw = bot.corner.yaw; bot.jkJ = bot.corner.j }
    if (bot.phase === 10) {
      const e = wrap(bot.jkYaw - b.psi)
      thr = 0; steer = e > 0 ? -1 : 1
      brk = b.th > -0.22 ? 1 : 0.2; lean = b.th > -0.2 ? 1 : b.th < -0.38 ? -0.6 : 0.3
      // 止まってしまったら少し進んでから、もう一度ブレーキで後輪を浮かせる
      if (b.g[0] && b.g[1] && Math.abs(sp) < 0.6) { bot.creep = 12 }
      if (bot.creep > 0) { bot.creep--; thr = 0.7; brk = 0; lean = 0.3 }
      if (Math.abs(e) < 0.12 || Math.abs(sp) > 6) { bot.phase = 0; bot.jkDone = bot.jkJ; bot.i = Math.max(bot.i, bot.jkJ - 1); lean = -0.5; brk = 0 }
    } else if (bot.phase === 20 || bot.phase === 21) {
      // 高い段（車輪の径くらい）: 歩く速さのウィリーで前輪を段の上へ掛け → 前体重＋アクセルで後輪を引き上げる
      const fd = (bot.stepP[0] - fw[0]) * hx + (bot.stepP[2] - fw[2]) * hz, rd = (bot.stepP[0] - rw[0]) * hx + (bot.stepP[2] - rw[2]) * hz
      if (bot.phase === 20) { thr = 0.6; brk = 0; lean = -1; if (fd < -0.05 && fw[1] > bot.stepY + 0.2) bot.phase = 21 }
      else { thr = 1; brk = 0; lean = 1; if (fw[1] < bot.stepY + 0.1) bot.phase = 20 }
      if (rd < -0.3 && rw[1] > bot.stepY + 0.2) { bot.phase = 0; bot.slowStep = false }
      if (fd > 3) bot.phase = 0
    } else if (bot.phase === 1) {
      // 前輪を 20〜35 度に上げて保つ
      const fd = (bot.stepP[0] - fw[0]) * hx + (bot.stepP[2] - fw[2]) * hz
      thr = b.th < 0.3 ? 1 : b.th < 0.5 ? 0.45 : 0; lean = b.th > 0.6 ? 1 : b.th > 0.42 ? 0 : -1; brk = 0
      if (sp > 4.2) { thr = 0; brk = 0.35 } else if (sp > 3.8 && b.th > 0.25) { thr = 0; brk = 0.2 }
      if (fd < -0.15 && fw[1] - (P.R + P.rt) > bot.stepY - 0.05) bot.phase = 2
      if (b.th > 0.9) lean = 1
    } else if (bot.phase === 2) {
      // 前輪が段に乗ったら前重心で後輪を押し上げる
      lean = 1; thr = b.th > 0.55 ? 0 : sp > 4 ? 0.4 : 1; brk = b.th > 0.75 ? 0.4 : 0
      const rd = (bot.stepP[0] - rw[0]) * hx + (bot.stepP[2] - rw[2]) * hz
      if (rd < -0.3 || (b.g[0] && rw[1] > bot.stepY + P.R)) bot.phase = 0
    } else if (air) {
      // 空中: 着地する面の傾きに合わせる（少しだけ前輪寄り）
      let ls = 0
      for (let jj = 0, j = SQ[0]; jj < Math.min(SQ.length, 14); j = SQ[++jj]) if (path[j].kind !== 'jump' && path[j].kind !== 'lip' && path[j].w) { ls = path[j].slope || 0; if (path[j].p[1] < b.p[1] - 0.3) break }
      const tgt = ls - 0.05
      lean = Math.max(-1, Math.min(1, (b.th - tgt) * 3.5 + b.w * 0.6))
      thr = 0.5; brk = 0 // 空中ではブレーキを掛けない（掛けると前へ回って突っ込む。v16 の自由な道の切れ目は点が 1 つなので、跳んだ後の先の段で速さを落とそうとしていた）
    } else {
      // 地面: 車体が坂から浮きすぎ・突っ込みすぎを直す
      const d = b.th - slope
      if (d > 0.18) lean = Math.min(1, (d - 0.1) * 5)
      else if (d < -0.15) lean = Math.max(-1, (d + 0.1) * 5)
      if (slope > 0.15 && thr) lean = Math.max(lean, slope > 0.5 ? 1 : 0.5)
      if (brk > 0) lean = Math.min(lean, b.th - slope < -0.08 ? -0.8 : -0.3)
      // ジャンプ台の手前で軽く後ろへ（前輪が落ちすぎないように）
      if (lipAt && lipAt.d < 1.0) lean = -0.4
    }
  } else {
    // 下手: 坂でひっくり返りそうな時だけ前へ
    if (b.th - slope > 0.7) lean = 1
  }
  bot.waiting = false
  // シーソー: ゆっくり乗る（重さで傾くのを待つ）。扉: 壊せる速さで当たる
  if (bot.skill === 'good' && !air) {
    for (let jj = 0, j = SQ[0], dd = 0; jj < Math.min(SQ.length, 16); j = SQ[++jj]) {
      const q = path[j]; if (jj > 0 && path[PV[j]].p && q.p) dd += Math.hypot(q.p[0] - path[PV[j]].p[0], q.p[2] - path[PV[j]].p[2])
      if (q.kind === 'seesaw' && dd < 7) { const vs = 2.2; thr = sp < vs ? 1 : 0; brk = sp > vs + 0.4 ? 0.5 : 0; lean = 0 }
      if (q.door && dd < 14 && bot.phase === 0) { const vd = q.door + 1.5; if (sp < vd) { thr = 1; brk = 0 } }
    }
  }
  // 湧き水の上は止まらない・泥の手前は勢いをつける
  if (bot.skill === 'good' && !air) {
    for (let jj = 0, j = SQ[0], dd = 0; jj < Math.min(SQ.length, 14); j = SQ[++jj]) {
      const q = path[j]; if (jj > 0 && path[PV[j]].p && q.p) dd += Math.hypot(q.p[0] - path[PV[j]].p[0], q.p[2] - path[PV[j]].p[2])
      if (q.kind === 'water' && dd < 6) { if (sp < 4.5) { thr = 1; brk = 0 } }
      if (q.kind === 'mud' && dd < 14 && bot.phase === 0) { if (sp < 9) { thr = 1; brk = 0 } if (lean < 0.4) lean = 0.4 }
    }
  }
  // 時間で動く危ない物（振り子の鉄球・落石・跳ね橋・突風）: 今から全開で行った時に、通る間ずっと安全なら行く。だめなら手前で止まって待つ
  if (bot.skill === 'good' && bot.world && bot.hz.length && !air) {
    const T0 = bot.world.time, hx = Math.cos(cur.yaw ?? b.psi), hz = -Math.sin(cur.yaw ?? b.psi)
    const near = []
    for (const h of bot.hz) {
      const dx = h.p[0] - b.p[0], dz = h.p[2] - b.p[2], dy = h.p[1] + 0.8 - b.p[1]
      const hx2 = Math.cos(h.yaw), hz2 = -Math.sin(h.yaw)
      const da = dx * hx2 + dz * hz2, lat = Math.abs(-dx * hz2 + dz * hx2)
      if (Math.abs(dy) > 2.5 || lat > h.w / 2 + 2.5 || da < -h.half - 1 || da > 16) continue
      near.push({ h, da })
    }
    if (near.length) {
      near.sort((a, b2) => a.da - b2.da)
      const vGo = Math.min(...near.map(z => z.h.vGo || 5.2)), acc = 4.2
      const sAt = t => { const tv = Math.max(0, (vGo - Math.max(0, sp)) / acc); return t < tv ? Math.max(0, sp) * t + acc * t * t / 2 : Math.max(0, sp) * tv + acc * tv * tv / 2 + vGo * (t - tv) }
      const tAt = d => { if (d <= 0) return 0; let lo = 0, hi = 20; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (sAt(m) < d) lo = m; else hi = m } return hi }
      let ok = true, first = null
      for (const { h, da } of near) {
        const tin = tAt(da - h.half - 1.0), tout = tAt(da + h.half + 1.0)
        if (tout <= 0) continue
        if (h.entryOnly) { if (h.unsafe(T0 + tin + 0.08)) ok = false } // 乗る（着く）瞬間だけ見る仕掛け
        else for (let t = tin; t <= tout; t += 0.05) if (h.unsafe(T0 + t)) { ok = false; break }
        if (!ok) { first = { h, da }; break }
      }
      // 助走して跳ぶ仕掛けは、一度行くと決めたら（助走を始めたら）、跳ぶまで迷わない
      // 助走が足りない所に出し直された時は、少し下がって助走を取り直す
      for (const { h, da } of near) if (h.runup && !bot.commitHz && da < h.runup * 0.7 && sp < 2 && !(bot.backT > 0)) { bot.backT = 90; bot.phase = 0 }
      if (ok) for (const { h, da } of near) if (h.runup && da < h.runup + h.half + 2 && !(bot.backT > 0)) bot.commitHz = h
      if (bot.commitHz && !near.some(z => z.h === bot.commitHz)) bot.commitHz = null
      const inZone = !!bot.commitHz || near.some(({ h, da }) => da < h.half + 1.0 && da > -h.half - 1)
      if (ok || inZone) { if (sp < vGo) { thr = 1; brk = 0 } else { thr = 0; brk = sp > vGo + 1 ? 0.4 : 0 } }
      else {
        const stopAt = first.da - first.h.half - (first.h.runup ?? 2.4) // 跳ぶ仕掛けは、助走の分だけ手前で待つ
        bot.waiting = true
        if (stopAt > 0.6) { const vMax = Math.sqrt(2 * 3 * stopAt); thr = sp < Math.min(vMax, 4) ? 1 : 0; brk = sp > vMax ? Math.min(1, (sp - vMax) * 0.5 + 0.3) : 0 }
        else { thr = 0; brk = Math.abs(sp) > 0.15 ? 1 : 0.6; lean = 0.4 }
      }
    }
  }
  // 上下する足場: 手前で待ち、足場が道の高さに来てから乗る。乗ったら向こうの高さまで待つ
  if (bot.skill === 'good') {
    for (let jj = 0, j = SQ[0]; jj < Math.min(SQ.length, 6); j = SQ[++jj]) {
      const q = path[j]; if (q.kind !== 'lift') continue
      const st = liftPos(q.lift.mov, bot.world ? bot.world.time : 0)
      const fx = Math.cos(q.yaw), fz = -Math.sin(q.yaw)
      const along = (b.p[0] - q.start[0]) * fx + (b.p[2] - q.start[2]) * fz
      const onIt = along > 0.8 && along < q.len + 0.3
      const dFront = -along
      // 下で止まった直後（残り 1.8 秒以上）なら乗る。乗ったら上で止まるまで待つ
      const hold = () => { bot.waiting = true; thr = 0; brk = Math.abs(sp) > 0.8 ? 0.45 : Math.abs(sp) > 0.25 ? 0.3 : 0; lean = Math.abs(sp) > 0.8 ? -0.6 : 0 }
      const centerD = Math.abs(along - q.len / 2)
      if (!onIt && !bot.liftGo && dFront < 4.5 && dFront > -0.5) {
        if (st.at === 'lo' && st.left > 2.0 && dFront > 1.4) bot.liftGo = true
        else { hold(); if (dFront < 1.9 && Math.abs(sp) < 0.5) { thr = 0; brk = 1; lean = 0 } }
      }
      if (bot.liftGo && !onIt && along < 0.8) { thr = sp < 1.8 ? 1 : 0; brk = 0; lean = 0 }
      if (onIt && st.at !== 'hi') { hold(); if (centerD < 0.5) { thr = 0; brk = Math.abs(sp) > 0.2 ? 0.6 : 0 } }
      if (onIt && st.at === 'hi') { bot.liftGo = false; thr = sp < 2 ? 1 : 0; brk = 0; lean = 0 }
      break
    }
  }
  // 段の技が 4 秒たっても終わらない時も、下がってやり直す（次はゆっくりのウィリーで）
  bot.phT = bot.phase === 1 || bot.phase === 2 || bot.phase === 20 || bot.phase === 21 ? (bot.phT || 0) + 1 : 0
  if (bot.phT > 240) { bot.backT = 70; bot.phT = 0; bot.phase = 0; bot.slowStep = true }
  // 止まって進めない時は、少し下がってやり直す（人と同じ）
  bot.stuckT = Math.abs(sp) < 0.4 && !air && !bot.waiting && !(bot.backT > 0) && !(brk === 1 && thr === 0) ? (bot.stuckT || 0) + 1 : 0
  if (bot.stuckT > 100) { bot.backT = 70; bot.stuckT = 0; bot.phase = 0; bot.slowStep = true }
  if (bot.backT > 0) { bot.backT--; thr = 0; brk = 1; lean = b.th > 0.35 ? 0.6 : -0.3; steer = 0; bot.phase = 0 }
  // 横に動く床の上: 床が道の線にそろう少し前まで、止まって待つ（床と一緒に運ばれている）
  if (bot.skill === 'good' && bot.world && b.carryId >= 0 && !air) {
    const sh = bot.world.shapes[b.carryId], m = sh && sh.mov
    if (m && m.type === 'slide') {
      const off = (sh.c[0] - sh.base.c[0]) * m.axis[0] + (sh.c[1] - sh.base.c[1]) * m.axis[1] + (sh.c[2] - sh.base.c[2]) * m.axis[2]
      const vel = m.amp * m.w * Math.cos(bot.world.time * m.w + (m.ph || 0)), lead = off + vel * 0.7
      if (Math.abs(lead) > 0.45) { thr = 0; brk = 1; lean = 0; bot.waiting = true } else { thr = 1; brk = 0 }
    }
  }
  if (hangAt && bot.skill === 'good' && !air && bot.phase === 0) {
    const fw = wheelCenter(b, B, 1, b.s[1]), hx = Math.cos(hangAt.q.yaw), hz = -Math.sin(hangAt.q.yaw)
    const fd = (hangAt.q.p[0] - fw[0]) * hx + (hangAt.q.p[2] - fw[2]) * hz
    if (fd < 2.6) { thr = sp < 1.2 ? 0.5 : 0; brk = sp > 1.8 ? 0.4 : 0; lean = -1 }
  }
  // ---------------- v16 の仕掛け（上手い bot だけ）
  if (bot.skill === 'good') {
    const o = v16Input(bot, b, SQ, PV, { thr, brk, lean, steer, sp, air, B })
    if (o) { thr = o.thr; brk = o.brk; lean = o.lean; if (o.steer != null) steer = o.steer; if (o.nitroOff) nitroNeed = false; bot.stuckT = 0; bot.backT = 0; bot.waiting = true }
  }
  const nitro = (nitroNeed || (nitroLip && sp < nitroLip - 0.3)) && thr > 0.5 && sp > 6 && bot.skill === 'good' ? 1 : 0
  // ゲームと同じ、曲がりの手前の自動の減速を通す
  const inp = assist(bot.st, b, { thr, brk, lean: Math.round(lean * 16) / 16, steer: Math.round(steer * 16) / 16, nitro })
  // 反応の遅れ（人の速さ）
  if (bot.react > 0) { bot.queue.push(inp); if (bot.queue.length > bot.react) return bot.queue.shift(); return { thr: 0, brk: 0, lean: 0, steer: 0 } }
  return inp
}

// 縁に前輪を掛けて耐えている間: 体の釣り合いを直しながらブレーキで耐え、縁の上を横切る物（鉄球・突風）が過ぎてから登る。
// 耐えられる時間が残り少なくなったら登る
function hangInput(bot, b) {
  const hg = b.hang
  if (bot.hangT0 == null) bot.hangT0 = 0
  bot.hangT0++
  const hist = bot.hangHist || (bot.hangHist = [])
  hist.push({ x: hg.x, xv: hg.xv }); if (hist.length > 30) hist.shift()
  const seen = hist[Math.max(0, hist.length - 1 - Math.min(bot.react || 0, 12))]
  let l = -(seen.x * 1.6 + seen.xv * 0.9)
  if (bot.react > 0) l = Math.round(l / 0.5) * 0.5
  l = Math.max(-1, Math.min(1, l))
  // 縁の上（少し先まで）の危ない物
  let safe = true
  if (bot.world) {
    const T0 = bot.world.time
    for (const h of bot.hz) {
      const d = Math.hypot(h.p[0] - b.p[0], h.p[2] - b.p[2]), dy = h.p[1] - b.p[1]
      if (d > 8 || dy < -1 || dy > 3) continue
      for (let t = 0.5; t <= 1.7; t += 0.1) if (h.unsafe(T0 + t)) { safe = false; break }
    }
  }
  const tMax = (bot.world && bot.world.shapes[hg.id].hang.max) || 8
  const minWait = 0.7
  if ((safe && hg.t > minWait) || hg.t > tMax - 1.6) return { thr: 1, brk: 0, lean: Math.max(0.6, l), steer: 0, nitro: 0 }
  return { thr: 0, brk: 1, lean: l, steer: 0, nitro: 0 }
}

// v16: 歯車・溝・吊り橋・跳ね板・道を選ぶ床。返り: 入力を置き換える時だけ { thr, brk, lean, steer? }
function v16Input(bot, b, SQ, PV, c) {
  const path = bot.path, cur = path[bot.i], sp = c.sp, W = bot.world, T = W ? W.time : 0
  const ahead = (n, fn) => { for (let jj = 0, dd = 0; jj < Math.min(SQ.length, n); jj++) { const j = SQ[jj], q = path[j]; if (jj > 0 && path[PV[j]].p && q.p) dd += Math.hypot(q.p[0] - path[PV[j]].p[0], q.p[2] - path[PV[j]].p[2]); const r = fn(q, dd, j); if (r !== undefined) return r } return null }
  const hold = v => ({ thr: sp < v - 0.5 ? 1 : sp < v + 0.2 ? 0.35 : 0, brk: sp > v + (bot.react ? 1.8 : 0.8) ? Math.min(0.5, (sp - v) * 0.3) : 0, lean: sp > v + 0.8 ? Math.min(c.lean, -0.3) : c.lean }) // 速さを保つ（反応が遅くても行き過ぎない）
  // 道を選ぶ床
  const fk = cur.fork || ahead(14, q => q.fork && q.kind === 'fork' ? q.fork : undefined)
  if (fk && W) {
    const sh = fk.shape, m = fk.mov, f = [Math.cos(fk.yaw), 0, -Math.sin(fk.yaw)], R = [Math.sin(fk.yaw), 0, Math.cos(fk.yaw)]
    const al = (b.p[0] - fk.p0[0]) * f[0] + (b.p[2] - fk.p0[2]) * f[2], lat = (b.p[0] - fk.mid[0]) * R[0] + (b.p[2] - fk.mid[2]) * R[2]
    const want = bot.fork === 'mix' ? ((bot.forkN + Math.floor(T / 7)) % 2 ? 'R' : 'L') : bot.fork === 'safe' ? fk.main : bot.fork === 'hard' ? (fk.main === 'L' ? 'R' : 'L') : bot.fork
    if (bot.forkWant == null || al < -6) bot.forkWant = want
    const side = bot.forkWant, sg = side === 'L' ? -1 : 1
    const onPlat = b.carryId === sh.id
    const head = { steer: Math.max(-1, Math.min(1, -((((fk.yaw - b.psi) + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * 2.5)) } // 向きを道の向きに保つ（横には切らない）
    // 出口の技: 切れ目なら床の後ろから助走、段ならゆっくり
    const exitPath = side === fk.main ? path.slice(fk.iMainExit, fk.iMainExit + 4) : (fk.branchI >= 0 ? path.slice(fk.branchI, fk.branchI + 8) : [])
    const exitJump = exitPath.find(q => q.kind === 'jump' || q.kind === 'gap'), exitStep = exitPath.find(q => q.kind === 'stepUp')
    const at = side === 'L' ? 'lo' : 'hi'
    const onAl = exitJump ? 0.85 : 1.3
    if (!bot.forkOn && !(onPlat && al > onAl) && al < onAl) {
      // 入口で待つ: 床が真ん中を通る時に着くように
      const dEdge = -al - 0.75 // 前輪が縁に着くまで
      const st = shuttlePos(m, T + Math.max(0, dEdge) / 2.6 + 0.35)
      const ok = Math.abs(st.k) < fk.pw / 2 - 1.0 && st.at !== 'lo' && st.at !== 'hi'
      if (dEdge > 1.2 && !bot.forkGo) return { ...hold(2.2), steer: null }
      if (ok || bot.forkGo) { bot.forkGo = true; return { thr: sp < (exitJump ? 2.0 : 2.8) ? 1 : 0, brk: 0, lean: 0, ...head } }
      return { thr: 0, brk: 1, lean: 0, ...head }
    }
    if ((onPlat && al > onAl) || (bot.forkOn && al < fk.gap - 0.2)) {
      bot.forkOn = true; bot.forkGo = false
      const st = shuttlePos(m, T), there = st.at === at && Math.abs(lat - sg * fk.amp) < 1.6
      const stopAl = exitJump ? 0.95 : fk.gap / 2 // 切れ目の時は床の後ろで待つ（助走を取る）
      if (there && st.left > (exitJump ? 0.6 : 1.4)) {
        // 降りる（ここから先はふつうの道として。枝道の側なら道の線を枝道へ）
        if (side !== fk.main && fk.branchI >= 0 && bot.i < fk.branchI) { bot.i = fk.branchI; if (bot.st) bot.st.i = fk.branchI }
        bot.forkExit = true
        if (exitStep) return null // 段は、ふつうの段の技（ゆっくりウィリー）
        return { thr: 1, brk: 0, lean: exitJump && sp > 4 ? -0.3 : 0, ...head }
      }
      if (bot.forkExit && there) return null
      // 床の上で止まって運ばれる（向きは保つ）。位置: 待つ所まで前後に動く
      const e = stopAl - al
      if (Math.abs(sp) < 0.4 && Math.abs(e) > 0.5 && st.at !== 'up' && st.at !== 'down') return { thr: e > 0 ? 0.5 : 0, brk: e < 0 ? 1 : 0, lean: 0, ...head }
      return { thr: 0, brk: 1, lean: 0, ...head }
    }
    if (al > fk.gap - 0.2) { bot.forkOn = false; bot.forkExit = false; if (al > fk.gap + 4 && bot.forkWant) { bot.forkN++; bot.forkWant = null } }
  }
  // ウィリーの溝: 溝の 2.6m 手前から、前輪を 25〜35 度に上げたまま 3.6m/s で
  const gv = ahead(10, (q, dd) => q.groove && dd < 2.6 ? q : undefined) || (cur.grooveRun && cur.kind === 'groove' ? cur : null)
  if (gv && !c.air && !b.hang) {
    const vg = ((gv.groove || gv.grooveRun) || {}).vg || 3.7
    const th = b.th - (cur.slope || 0) * 0.6, k = 0 // 坂では坂に対する角度で。反応の遅い人は早めに戻す
    if (bot.react && ((gv.groove || gv.grooveRun) || {}).slope > 0.05) { const H = globalThis.__hw || [0.5, 2, 0.3], ln = Math.max(-1, Math.min(1, (th - H[0]) * H[1] + b.w * H[2])); return { thr: th < 0.3 ? 1 : th < 0.5 ? (sp < vg ? 0.8 : 0.4) : 0.15, brk: sp > vg + 0.8 ? 0.3 : 0, lean: ln } } // 人の速さ: なめらかに体重で保つ
    if (sp < vg - 0.3 && th > 0.25) return { thr: 1, brk: 0, lean: th > 0.55 - k ? 1 : 0 }
    return { thr: th < 0.35 - k ? 1 : th < 0.55 - k ? 0.45 : 0, brk: sp > vg + 0.6 ? 0.3 : 0, lean: th > 0.65 - k ? 1 : th > 0.45 - k ? 0 : -1 }
  }
  // 歯車: 跳ぶ所の速さの帯の真ん中。逆らう歯車の上では全開
  if (cur.kind === 'gear' && cur.gear.u < 0 && !c.air) return { thr: 1, brk: 0, lean: c.lean } // 逆らう歯車の上は全開
  const g0 = cur.kind === 'gear' ? cur : ahead(24, (q, dd) => q.kind === 'gear' && dd < 18 ? q : (q.kind === 'jump' && !q.gearJump ? null : undefined))
  if (g0 && !c.air) return hold(g0.gear.vIn || 10)
  // 跳ね板: 決まった速さで入る
  const kj = ahead(24, (q, dd) => q.kickJump ? q : undefined)
  if (kj && !c.air && (cur.kind === 'kick' || ahead(24, (q, dd) => q.kind === 'kick' && dd < 16 ? true : undefined))) {
    const near = cur.kind === 'kick' || ahead(8, (q, dd) => q.kind === 'kick' && dd < 4 ? true : undefined)
    if (near) return { thr: sp < kj.vJump - 1.0 ? 0.6 : 0, brk: 0, lean: 0 } // 板の上ではアクセルを開けない（跳ね上がる瞬間に前が上がる）
    return hold(kj.vJump)
  }
  // 揺れる吊り橋: ちょうどの速さ
  const sw = cur.swing || ahead(30, (q, dd) => q.swing && dd < 20 ? q.swing : undefined)
  if (sw && !c.air) { const o = hold((sw.vMin + sw.vMax) / 2); if (sp < sw.vMin + 0.3) { o.thr = 1; o.brk = 0 } return o }
  return null
}
