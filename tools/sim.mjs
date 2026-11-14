if (process.env.STEERNOW) globalThis.__steerNow = 1
// node tools/sim.mjs <course> <skill> [maxSec]  → 自動で走らせて時間・フォルト・どこで失敗したか（ゲームと同じルール js/run.js）
import { World, stepBike, DT, hashBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { spawnAtCp, judge, doRespawn, rerollTraps } from '../js/run.js'
export function runSim(cid, skill, o = {}) {
  const c = COURSES[cid](), w = new World(c.shapes); w.winds = c.winds || []
  const bot = createBot(c, { skill, react: o.react || 0, lat: o.lat || 0, vMul: o.vMul || 1 }); bot.world = w
  const st = o.start || 0 // v35: 途中の旗から（START=旗の番号）
  const R = { cp: st, rest: st, hard: !!o.hard }; bot.R = R; R.seed = +(process.env.TRAPSEED || o.trapSeed || 1); if (!process.env.NOTRAPRAND) rerollTraps(w, R) // v47 // v41 落石の坂: bot は岩の予告でバックする
  let faults = 0, steps = 0, log = [], inputs = [], maxY = -1e9, nets = 0, lastGround = null
  let b = spawnAtCp(w, c, st); resetBot(bot, b)
  const maxSteps = (o.maxSec || 400) * 60
  const perCp = {}
  const brNx = {}; c.path.forEach(q => { if (q.branch && q.nx != null) brNx[q.br] = q.nx })
  while (steps < maxSteps) {
    const prev = b.p.slice()
    const inp = o.inputs ? o.inputs[steps] || { thr: 0, brk: 0, lean: 0, steer: 0 } : botInput(bot, b)
    inputs.push(inp)
    const ev = []
    w.tick()
    stepBike(w, b, inp, ev); steps++
    if (o.onEv) for (const e of ev) o.onEv(e, b, bot, steps)
    if (o.trace && steps >= o.trace[0] && steps <= o.trace[1] && steps % (o.trace[2] || 4) === 0) console.log(steps, b.p.map(v => v.toFixed(2)).join(','), 'th', (b.th * 57.3).toFixed(0), 'psi', (b.psi * 57.3 % 360).toFixed(0), 'v', b.speed.toFixed(1), 'g', +b.g[0] + '' + +b.g[1], 'in', inp.thr, inp.brk, inp.lean, (+inp.steer).toFixed(2), 'ph', bot.phase, 'i', bot.i, c.path[bot.i].kind, (c.path[bot.i].yaw * 57.3 % 360).toFixed(0), ev.map(e => e.t + (e.why || '')).join(' '))
    maxY = Math.max(maxY, b.p[1])
    if (b.g[0] || b.g[1]) lastGround = { i: bot.i, kind: c.path[bot.i].kind, mark: (c.marks || []).find(m => bot.i >= m.i0 && bot.i <= m.i1)?.name }
    for (const e of ev) if (e.t === 'crash') log.push({ s: steps, cp: R.cp, why: e.why, v: +(e.v || 0).toFixed(1), at: b.p.map(v => +v.toFixed(1)), from: lastGround })
    const restB = R.rest
    const j = judge(w, c, R, b, prev)
    if (R.rest !== restB || o._rs == null) o._rs = steps // v36: 休憩所を通った時刻（失敗までの秒を出す）
    if (j.gate != null && perCp[j.gate] == null) perCp[j.gate] = +(steps * DT).toFixed(1)
    if (j.finish) return { cid, skill, time: steps * DT, faults, finished: true, log, perCp, hash: hashBike(b), inputs, maxY, nets }
    // 人なら 40 秒（分かれ道の床を待つ分）進めなければ R で休憩所からやり直す
    const pi = c.path[bot.i].branch ? (brNx[c.path[bot.i].br] ?? bot.i) - 1 : bot.i // 枝道の点は合流する本線の点の手前として数える
    if (pi > (o._bi || 0)) { o._bi = pi; o._bs = steps }
    if (!j.respawn && !j.finish && steps - (o._bs || 0) > 40 * 60) { j.respawn = { cp: R.rest || 0 }; log.push({ s: steps, cp: R.cp, why: 'retry', at: b.p.map(v => +v.toFixed(1)), from: lastGround }); o._bs = steps; o._bi = 0 }
    if (j.respawn) {
      if (j.respawn.fell) log.push({ s: steps, cp: R.cp, why: j.net ? 'net' : 'fall', at: b.p.map(v => +v.toFixed(1)), from: lastGround })
      else if (j.respawn.safe) log.push({ s: steps, cp: R.cp, why: 'back', at: b.p.map(v => +v.toFixed(1)), from: lastGround, crashed: b.crashed && b.crashed.why })
      if (j.net) nets++
      if (log.length) { const L = log[log.length - 1]; if (L.ft == null) { L.ft = +((steps - o._rs) / 60).toFixed(1); L.rest = R.rest } }
      faults++; b = doRespawn(w, c, R, j.respawn); resetBot(bot, b); o._rs = steps
      bot.vMul = (o.vMul || 1) * (0.75 + ((faults * 0.37) % 0.6))
      if (faults > (o.maxFaults || 80)) break
    }
  }
  return { log, endP: b.p.map(v => +v.toFixed(2)), endBot: bot.i + ":" + (c.path[bot.i] && c.path[bot.i].kind), cid, skill, time: steps * DT, faults, finished: false, cp: R.cp, cpName: c.cps[R.cp].name, log, perCp, hash: hashBike(b), inputs, maxY, nets }
}
if ((process.argv[1] || '').endsWith('sim.mjs')) {
  const [cid = 'practice', skill = 'good', maxSec = 300] = process.argv.slice(2)
  const t0 = Date.now()
  const r = runSim(cid, skill, { maxSec: +maxSec, react: +(process.env.REACT || 0), hard: !!process.env.HARD, start: +(process.env.START || 0) })
  const fails = {}; for (const l of r.log) { const k = l.cp + ':' + l.why; fails[k] = (fails[k] || 0) + 1 }
  console.log(cid, skill, 'finished', r.finished, 'time', r.time.toFixed(1), 'faults', r.faults, 'maxY', r.maxY.toFixed(1), r.finished ? '' : 'at cp ' + r.cp + ' ' + r.cpName, 'wall', Date.now() - t0, 'ms')
  console.log(' fails', JSON.stringify(fails))
  console.log(' log', JSON.stringify(r.log.slice(-10)))
  console.log(' perCp', JSON.stringify(r.perCp), 'end', JSON.stringify(r.endP), r.endBot)
}
