// v76 の仕掛け 2 つの検査（node だけ）。node tools/v76check.mjs  → 項目ごとに ok / NG と数字。最後に NG の数
//  A 押す石と門: 石の進み（当たる速さ・押し続け）／ボタンと門／「気づかない人」（石をウィリーで越えてボタンから走る）は 遅い・全開・ニトロ のどれでも頭が当たる／解いた人は通れる
//  B ローラー: 通るだけ・アクセルだけ・ブレーキだけでは回らない／ローラーの上の同時押しで上がり切る／離しても下がらない／ローラーの外の同時押しは空転だけ
import { World, createBike, stepBike, DT, basis, riderPts, hashBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { settle } from '../js/run.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
const c = COURSES.stage1(), A = c.v76.A, Bw = c.v76.B
let ng = 0; const rows = []
const ok = (name, cond, info) => { if (!cond) ng++; rows.push(`${cond ? 'ok  ' : 'NG  '} ${name}  ${info ?? ''}`) }
const mk = () => { const w = new World(c.shapes); w.winds = c.winds; return w }
const sA = p => (p[0] - A.a[0]) * A.ax[0] + (p[2] - A.a[2]) * A.ax[2], sB = p => (p[0] - Bw.a[0]) * Bw.f[0] + (p[2] - Bw.a[2]) * Bw.f[2]
const bikeAt = (w, G, s, v = 0) => { const f = G.kind === 'A' ? G.ax : G.f, b = settle(w, createBike({ p: [G.a[0] + f[0] * s, G.a[1] + 0.79, G.a[2] + f[2] * s], yaw: G.yaw })); b.v = [f[0] * v, 0, f[2] * v]; return b }
const run = (w, b, fn, sec) => { const evs = []; for (let k = 0; k < sec * 60; k++) { const inp = { thr: 0, brk: 0, lean: 0, steer: 0, ...fn(k / 60, b) }; w.tick(); const ev = []; stepBike(w, b, inp, ev); for (const e of ev) evs.push({ t: k / 60, ...e }); if (b.crashed && b.crashed.t > 1.2) break } return evs }
// ---------------- A 石
{ const d = []; for (const v of [2, 4, 6, 8]) { const w = mk(), b = bikeAt(w, A, A.sBlock - 2.7, v); run(w, b, () => ({}), 5); d.push(+A.x.toFixed(2)); if (b.crashed) ok('石に当たっても転ばない v=' + v, false, b.crashed.why) }
  ok('石: 速く当たるほど進む（当たった後は何も押さない。2/4/6/8 m/s）', d[0] < d[1] && d[1] < d[2] && d[2] <= d[3] && d[0] > 0.05, d.join(' / ') + ' m') }
{ const w = mk(), b = bikeAt(w, A, A.sBlock - 0.5 - 1.15, 0); let tEnd = null; run(w, b, t => { if (tEnd == null && A.x >= A.len) tEnd = t; return { thr: 1 } }, 9)
  ok('石: 止まって押し続けても進む（前輪を石に当てて全開）', A.x >= A.len && !b.crashed, `溝の端まで ${tEnd} 秒・石 ${A.x.toFixed(2)}m`)
  ok('石: 溝の端（ボタンの上）で止まり、それ以上は進まない', Math.abs(A.x - A.len) < 1e-9 && A.pressed && A.h >= A.Hopen, `x ${A.x} 門の下端 ${A.h.toFixed(2)}m`) }
{ const w = mk(), b = bikeAt(w, A, A.sBlock + 2.2, 0); run(w, b, t => ({ brk: 1 }), 4); ok('石: 先からバックで当たっても後ろへは動かない', A.x === 0, `x ${A.x} バイク s ${sA(b.p).toFixed(2)}`) }
// ---------------- A ボタンと門（バイクが載っている間だけ開く・離れるとゆっくり閉じる）
{ const w = mk(), b = bikeAt(w, A, A.sPlate, 0); let hOn = 0; run(w, b, () => ({}), 3); hOn = A.h; const pressed = A.pressed
  ok('ボタン: バイクが載ると沈み、門が上がり切って止まる', pressed && Math.abs(hOn - A.Hopen) < 1e-9 && A.k === 1, `下端 ${hOn.toFixed(2)}m（上がり切るまで ${(A.Hopen / A.vUp).toFixed(1)} 秒）`)
  const ev = run(w, b, t => ({ thr: t < 0.7 ? 1 : 0, brk: t > 1.0 ? 1 : 0 }), 2.0); const h1 = A.h; run(w, b, () => ({}), 8)
  ok('門: 離れるとゆっくり閉じる（上から下へ）', ev.some(e => e.t === 'pbRelease') && h1 < A.Hopen && h1 > 0 && A.h === 0, `離れて約 ${(2.0 - (ev.find(e => e.t === 'pbRelease') || {}).t).toFixed(1)} 秒で ${h1.toFixed(2)}m → 閉じ切るまで ${(A.Hopen / A.vDown).toFixed(1)} 秒`) }
// ---------------- A 「気づかない人」: 石をウィリーで越え（押さない）、ボタンの上で止まって門が上がり切ったら走る
const unaware = (mode, human) => {
  const w = mk(), q = c.path[A.i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }))
  const bot = createBot(c, { skill: 'good', react: human ? 12 : 0 }); bot.world = w; bot.unaware76 = true; resetBot(bot, b)
  let ph = 0, tTop = null, res = null, xMax = 0, leftT = null, last = null
  for (let k = 0; k < 60 * 40; k++) {
    const s = sA(b.p); let inp = botInput(bot, b)
    if (ph === 0 && s - 0.7 > A.sBlock + 0.9 && b.g[0] && b.g[1]) ph = 1 // 石を越えた
    if (ph === 1) { const e = A.sPlate - s; inp = { ...inp, thr: e > 0.25 && b.speed < Math.min(3, 1 + e) ? 0.6 : 0, brk: b.speed > Math.max(0.3, Math.min(3, 1 + e)) || e < 0.25 ? (Math.abs(b.speed) > 0.15 ? 1 : 0) : 0, lean: 0, nitro: 0 }; if (A.h >= A.Hopen && Math.abs(b.speed) < 0.2) { ph = 2; tTop = k / 60 } }
    else if (ph === 2) inp = { ...inp, thr: mode === 'slow' ? (b.speed < 6 ? 1 : 0) : 1, brk: 0, lean: 0, nitro: mode === 'nitro' ? 1 : 0 }
    w.tick(); stepBike(w, b, inp, []); xMax = Math.max(xMax, A.x)
    if (ph === 2 && leftT == null && !A.pressed) leftT = k / 60
    const hd = riderPts(b, basis(b))[2]
    if (b.crashed) { res = { ...(last || {}), 門の下端: +A.h.toFixed(2), 差: last ? +(A.h - last.頭).toFixed(3) : null, 転倒: b.crashed.why, s: +sA(b.p).toFixed(1), ph }; break }
    if (ph === 2 && leftT != null) last = { 秒: +(k / 60 - leftT).toFixed(2), 速さ: +b.speed.toFixed(1), 頭: +(hd.c[1] + hd.r - A.y0).toFixed(2) } // 当たる直前のコマの頭の高さと速さ（差は、当たった時の門の下端 − 頭のてっぺん）
    if (s > A.sGate + 3) { res = { ...(res || {}), 通れた: true }; break }
  }
  return { res, xMax, ph }
}
for (const human of [false, true]) for (const mode of ['slow', 'full', 'nitro']) { const r = unaware(mode, human), R = r.res || {}
  ok(`気づかない人（${human ? '人の速さ' : '上手い'} bot が石をウィリーで越える）→ ボタンから ${{ slow: '遅く 6m/s', full: '全開', nitro: 'ニトロ' }[mode]}: 頭が門に当たる`, R.転倒 === 'head' && r.ph === 2 && !R.通れた && r.xMax < A.pressAt - 0.5 && R.s < A.sGate, JSON.stringify(R) + ` 石の動き ${r.xMax.toFixed(2)}m`) }
// ---------------- A 解いた人: 石がボタンの上なら、門は開いたまま。石を越えて全開・ニトロでくぐれる
for (const mode of ['full', 'nitro']) { const w = mk(); A.x = A.len; const b = bikeAt(w, A, A.sPlate + 1.6, 0); let minGap = 9; run(w, b, t => ({}), 2.6); const h0 = A.h
  run(w, b, t => { const hd = riderPts(b, basis(b))[2], s = sA(hd.c); if (Math.abs(s - A.sGate) < 0.5) minGap = Math.min(minGap, A.h - (hd.c[1] + hd.r - A.y0)); return { thr: 1, nitro: mode === 'nitro' ? 1 : 0 } }, 3)
  ok(`石がボタンの上: 門は上がり切ったまま。${mode === 'nitro' ? 'ニトロ' : '全開'}でくぐれる`, h0 >= A.Hopen && A.h >= A.Hopen && !b.crashed && sA(b.p) > A.sGate + 2, `頭の上の空き ${minGap.toFixed(2)}m`) }
// ---------------- A bot（解き方を知っている）
for (const [name, react] of [['上手い', 0], ['人の速さ', 12]]) { let n = 0, ts = []; for (let seed = 0; seed < 8; seed++) { const w = mk(); w.setTime(seed * 1.37); const q = c.path[A.i0], b = settle(w, createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw })), bot = createBot(c, { skill: 'good', react }); bot.world = w; resetBot(bot, b); b.v = [A.ax[0] * 3, 0, A.ax[2] * 3]
    for (let k = 0; k < 60 * 40; k++) { w.tick(); stepBike(w, b, botInput(bot, b), []); if (b.crashed) break; if (sA(b.p) > A.sGate + 2.5) { n++; ts.push(+(k / 60).toFixed(1)); break } } }
  ok(`A ${name} bot: 石を押してボタンに載せ、石を越えて門をくぐる`, n === 8, `${n}/8  ${ts.join(' ')} 秒`) }
// ---------------- B ローラー
{ const res = []; for (const v of [3, 8, 13]) { const w = mk(), b = bikeAt(w, Bw, Bw.sRoll - 4.4, v); const ev = run(w, b, () => ({ thr: 1 }), 2.5); res.push(`${v}m/s: 上がり ${Bw.prog.toFixed(2)} 鎖の震え ${ev.filter(e => e.t === 'wRoll').length} 回 ${b.crashed ? '転倒' : ''}`); ok('ローラー: 走って通るだけでは回らない v=' + v, Bw.prog === 0 && Bw.h === 0 && !b.crashed && ev.some(e => e.t === 'wRoll') && sB(b.p) < Bw.sGrate, res[res.length - 1] + ` 止まった所 s ${sB(b.p).toFixed(1)}（格子 ${Bw.sGrate}）`) } }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll + 0.7, 0); run(w, b, t => ({ thr: t < 0.4 ? 1 : 0 }), 2); ok('ローラー: 上でアクセルだけ → 回らない（そのまま走り出す）', Bw.prog === 0, `動いた ${(sB(b.p) - 0.7 - Bw.sRoll).toFixed(2)}m`) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll + 0.7, 0); run(w, b, t => ({ brk: 1 }), 0.4); ok('ローラー: 上でブレーキだけ → 回らない', Bw.prog === 0) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll + 0.7, 0); let tTop = null, burn = 0; const ev = run(w, b, t => { if (tTop == null && Bw.prog >= 1) tTop = t; if (b.burn) burn++; return { thr: 1, brk: 1 } }, 5)
  ok('ローラー: 上でブレーキとアクセルを同時 → 後輪が空転して格子が上がり切る', Bw.prog === 1 && Math.abs(Bw.h - Bw.Hopen) < 1e-9 && tTop != null && !b.crashed, `${tTop} 秒・歯止め ${ev.filter(e => e.t === 'wNotch').length} 回・その間に動いた ${(sB(b.p) - 0.7 - Bw.sRoll).toFixed(2)}m`)
  run(w, b, () => ({}), 3); ok('格子: 上がり切ったら離しても下がらない', Bw.h === Bw.Hopen)
  run(w, b, () => ({ thr: 1 }), 3); ok('格子: 上がったら全開でくぐれる', !b.crashed && sB(b.p) > Bw.sGrate + 3, `s ${sB(b.p).toFixed(1)}`) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll + 0.7, 0); run(w, b, t => (t < 1.5 ? { thr: 1, brk: 1 } : {}), 5); const h1 = Bw.h; ok('格子: 途中で離すと歯止めで止まる（下がらない）', h1 > 0.8 && h1 < Bw.Hopen && Bw.h === h1, `1.5 秒で ${h1.toFixed(2)}m のまま`)
  run(w, b, t => ({ thr: 1 }), 2.5); ok('格子: 半分しか上がっていないと通れない（頭か前輪が当たる）', sB(b.p) < Bw.sGrate + 0.5, `s ${sB(b.p).toFixed(1)} ${b.crashed ? '転倒 ' + b.crashed.why : '止まる'}`) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll + 0.7, 0); b.th += 2 * Math.PI; run(w, b, () => ({ thr: 1, brk: 1 }), 5); ok('回る筒で 1 回転した後（車体の角度が 360 度ぶん増えている）でも、ローラーの上の同時押しで上がり切る', Bw.prog === 1, `角度 ${(b.th * 57.3).toFixed(0)} 度`) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll - 3 + 0.7, 0); let burn = 0; run(w, b, t => { if (b.burn) burn++; return { thr: 1, brk: 1 } }, 3); ok('ローラーの外で同時押し → その場で空転するだけ（格子は動かない）', Bw.prog === 0 && burn > 150 && Math.abs(sB(b.p) - 0.7 - (Bw.sRoll - 3)) < 0.3, `空転 ${burn} コマ・動いた ${(sB(b.p) - 0.7 - (Bw.sRoll - 3)).toFixed(2)}m・後輪の空回りの速さ ${b.spin.toFixed(1)}m/s`) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll - 8, 9); let burn = 0; run(w, b, t => { if (b.burn && Math.abs(b.speed) > 1.5) burn++; return { thr: 1, brk: 1 } }, 0.5); ok('走っている間（1.5m/s より速い）の同時押しは空転しない（今まで通り減速）', burn === 0, `0.5 秒後 ${b.speed.toFixed(1)}m/s`) }
for (const [name, opt] of [['上手い', { skill: 'good' }], ['人の速さ', { skill: 'good', react: 12 }]]) { let n = 0, ts = []; for (let seed = 0; seed < 8; seed++) { const w = mk(); w.setTime(seed * 1.37); const b = bikeAt(w, Bw, Bw.sRoll - 4.4, [3, 6, 9, 12][seed % 4]), bot = createBot(c, opt); bot.world = w; resetBot(bot, b)
    for (let k = 0; k < 60 * 40; k++) { w.tick(); stepBike(w, b, botInput(bot, b), []); if (b.crashed) break; if (sB(b.p) > Bw.sGrate + 2.5) { n++; ts.push(+(k / 60).toFixed(1)); break } } }
  ok(`B ${name} bot: 後輪をローラーに止めて同時押し → 格子をくぐる（入る速さ 3/6/9/12 m/s）`, n === 8, `${n}/8  ${ts.join(' ')} 秒`) }
{ const w = mk(), b = bikeAt(w, Bw, Bw.sRoll - 4.4, 12), bot = createBot(c, { skill: 'bad' }); bot.world = w; resetBot(bot, b); for (let k = 0; k < 60 * 20; k++) { w.tick(); stepBike(w, b, botInput(bot, b), []) }
  ok('気づかない人（全開のまま）: 格子は上がらず進めない', Bw.prog === 0 && sB(b.p) < Bw.sGrate, `20 秒後 s ${sB(b.p).toFixed(1)}（格子 ${Bw.sGrate}）${b.crashed ? ' 転倒 ' + b.crashed.why : ''}`) }
// ---------------- 同じ入力なら同じ結果
{ const once = () => { const w = mk(), b = bikeAt(w, A, 0.5, 0); run(w, b, t => ({ thr: 1, lean: t > 3 && t < 3.4 ? -1 : 0 }), 6); return hashBike(b) + ':' + A.x + ':' + A.h }; const a = once(), b2 = once(); ok('同じ入力なら同じ結果（石・門を含む）', a === b2, a) }
console.log(rows.join('\n')); console.log('\nNG', ng, '/', rows.length)
process.exit(ng ? 1 : 0)
