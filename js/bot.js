// 自動で走る bot（検査・デモ用）。skill: 'good'（ウィリー・空中の角度合わせ・速さの調整）/ 'bad'（アクセルとハンドルだけ）
import { basis, wheelCenter, BIKE, liftPos } from './physics.js?v=14'
import { createSteer, steerFor, resetSteer, assist } from './steer.js?v=14'

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a }
export function createBot(course, o = {}) {
  const path = o.path || course.path
  return { path, hz: course.hazards || [], st: createSteer(path), i: 0, skill: o.skill || 'good', phase: 0, react: o.react || 0, queue: [], lat: o.lat || 0, vMul: o.vMul || 1 }
}
export function resetBot(bot, b) { bot.i = nearest(bot, b, 0, bot.path.length); resetSteer(bot.st, b); bot.phase = 0; bot.queue.length = 0; bot.jkDone = null; bot.corner = null; bot.liftGo = false; bot.backT = 0; bot.stuckT = 0; bot.creep = 0 }
function nearest(bot, b, from, to) {
  let best = 1e9, bi = from
  for (let i = Math.max(0, from); i < Math.min(bot.path.length, to); i++) {
    const p = bot.path[i].p; if (!p) continue
    const d = (p[0] - b.p[0]) ** 2 + (p[2] - b.p[2]) ** 2 + ((p[1] + 0.8 - b.p[1]) * 2) ** 2
    if (d < best) { best = d; bi = i }
  }
  // 近くに道の点がない（跳んで届かず下の道へ落ちた時など）は全部から探す
  if (best > 16 && (from > 0 || to < bot.path.length)) return nearest(bot, b, 0, bot.path.length)
  return bi
}
export function botInput(bot, b) {
  const path = bot.path, P = BIKE
  bot.i = nearest(bot, b, bot.i - 2, bot.i + 25)
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
  for (let j = bot.i, dd = 0; j < Math.min(path.length, bot.i + 60); j++) {
    const q = path[j]
    if (j > bot.i && path[j - 1].p && q.p) dd += Math.hypot(q.p[0] - path[j - 1].p[0], q.p[2] - path[j - 1].p[2])
    if (q.kind === 'stepUp' && q.dy > 0.25) need(q.dy > 0.55 ? 1.1 : q.dy > 0.4 ? 3.4 : 3.5, dd)
    if (q.kind === 'lift' && !bot.liftGo) need(0.8, Math.max(0, dd - 3.2))
    if (((q.slope || 0) > 0.38 || q.kind === 'steep' || q.kind === 'mud') && dd < 12) bot.steepAhead = true
    if (q.kind === 'narrow' || q.kind === 'pipe' || (q.w && q.w < 1.3)) need(3.6, dd)
    if (j > bot.i && !q.curv && !path[bot.i].curv && Math.abs(wrap((q.yaw ?? b.psi) - (path[bot.i].yaw ?? b.psi))) > 0.9) need((q.w || 9) < 2 ? 2.6 : 2.9, dd)
    if (q.curv && dd < 20) need(Math.sqrt(20 / (1.42 * Math.abs(q.curv))) * 0.85, dd)
    if (q.kind === 'lip') break
    if (q.kind === 'jump') { if (dd < 9) { bot.jumpAhead = true; bot.vJump = q.vJump } break }
  }
  for (let j = bot.i; j < Math.min(path.length, bot.i + 40); j++) {
    const q = path[j]
    if (j > bot.i && path[j - 1].p && q.p) dsum += Math.hypot(q.p[0] - path[j - 1].p[0], q.p[2] - path[j - 1].p[2])
    if (q.kind === 'stepUp' && q.dy > 0.25 && stepAt == null && dsum < 14) stepAt = { d: dsum, q }
    if (q.kind === 'lip' && lipAt == null && dsum < 30) lipAt = { d: dsum, q }
    if (q.kind === 'bump' && dsum < 6) vT = Math.min(vT, 6)
    if ((q.kind === 'narrow' || q.kind === 'pipe' || (q.w && q.w < 1.3)) && dsum < 10) narrow = true
    if (!turnAhead && j > bot.i && !q.curv && Math.abs(wrap((q.yaw ?? b.psi) - (path[bot.i].yaw ?? b.psi))) > 0.9 && dsum < 9) { turnAhead = true; if (bot.corner == null || bot.corner.j !== j) bot.corner = { j, d: dsum, yaw: q.yaw, narrow: (q.w || 9) < 2 } ; else bot.corner.d = dsum }
  }
  const cur = path[bot.i]
  if (cur.kind === 'spiral' || cur.kind === 'narrowSpiral' || cur.kind === 'orbit') vT = 10
  if (narrow) vT = 3.6
  if (turnAhead) vT = Math.min(vT, narrow || (bot.corner && bot.corner.narrow) ? 2.6 : 2.9)
  if (stepAt) vT = Math.min(vT, stepAt.q.dy > 0.55 ? (stepAt.d < 5 ? 1.1 : 2.5) : stepAt.q.dy > 0.4 ? 3.4 : 3.5)
  if (lipAt) vT = Math.max(vT, lipAt.q.vNeed || 12.5)
  if (!lipAt || lipAt.d > 12) vT = Math.min(vT, vCap)
  if (bot.jumpAhead) vT = Math.max(vT, bot.vJump || 6.5)
  if (bot.steepAhead && !stepAt) vT = Math.max(vT, 9) // すべる急坂は勢いで一気に
  if (cur.kind === 'crumble' || (path[bot.i + 2] && path[bot.i + 2].kind === 'crumble')) vT = Math.max(vT, 7) // 崩れる板の上では止まらない
  for (let j = bot.i; j < Math.min(path.length, bot.i + 9); j++) if (path[j].kind === 'trap') { vT = Math.max(vT, 7); break } // 抜け落ちる床は速さで越える
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
      for (let j = bot.i; j < Math.min(path.length, bot.i + 14); j++) if (path[j].kind !== 'jump' && path[j].kind !== 'lip' && path[j].w) { ls = path[j].slope || 0; if (path[j].p[1] < b.p[1] - 0.3) break }
      const tgt = ls - 0.05
      lean = Math.max(-1, Math.min(1, (b.th - tgt) * 3.5 + b.w * 0.6))
      thr = 0.5
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
    for (let j = bot.i, dd = 0; j < Math.min(path.length, bot.i + 16); j++) {
      const q = path[j]; if (j > bot.i && path[j - 1].p && q.p) dd += Math.hypot(q.p[0] - path[j - 1].p[0], q.p[2] - path[j - 1].p[2])
      if (q.kind === 'seesaw' && dd < 7) { const vs = 2.2; thr = sp < vs ? 1 : 0; brk = sp > vs + 0.4 ? 0.5 : 0; lean = 0 }
      if (q.door && dd < 14 && bot.phase === 0) { const vd = q.door + 1.5; if (sp < vd) { thr = 1; brk = 0 } }
    }
  }
  // 湧き水の上は止まらない・泥の手前は勢いをつける
  if (bot.skill === 'good' && !air) {
    for (let j = bot.i, dd = 0; j < Math.min(path.length, bot.i + 14); j++) {
      const q = path[j]; if (j > bot.i && path[j - 1].p && q.p) dd += Math.hypot(q.p[0] - path[j - 1].p[0], q.p[2] - path[j - 1].p[2])
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
    for (let j = bot.i; j < Math.min(path.length, bot.i + 6); j++) {
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
  // ゲームと同じ、曲がりの手前の自動の減速を通す
  const inp = assist(bot.st, b, { thr, brk, lean: Math.round(lean * 16) / 16, steer: Math.round(steer * 16) / 16 })
  // 反応の遅れ（人の速さ）
  if (bot.react > 0) { bot.queue.push(inp); if (bot.queue.length > bot.react) return bot.queue.shift(); return { thr: 0, brk: 0, lean: 0, steer: 0 } }
  return inp
}
