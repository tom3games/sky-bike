// 先読みする bot（検査用）。物理が決まっているので、候補の入力を先に試して一番進めるものを選ぶ。
// 1 回の判断 = 候補の入力を hold 秒続け、その後 roll 秒は普通の bot に任せた結果で比べる
import { stepBike, BIKE } from './physics.js?v=37b'
import { createBot, botInput } from './bot.js?v=37b'

const clone = b => {
  const c = { ...b, p: b.p.slice(), v: b.v.slice(), s: b.s.slice(), sv: b.sv.slice(), g: b.g.slice(), cn: b.cn.slice(), side: b.side.slice(), wheelRot: b.wheelRot.slice(), frame: b.frame.slice() }
  c.crashed = b.crashed ? { ...b.crashed } : null
  return c
}
const cloneBot = (bt) => ({ ...bt, queue: bt.queue.slice() })
const LEANS = [-1, -0.5, 0, 0.5, 1], THRS = [0, 0.5, 1], BRKS = [0, 0.6]

export function createPlanner(course, o = {}) {
  const bot = createBot(course, { skill: 'good', path: o.path })
  return { bot, hold: o.hold || 12, roll: o.roll || 72, plan: null, left: 0, kill: o.kill ?? -1e9, react: o.react || 0 }
}
function score(pl, b, bt, kill) {
  if (b.crashed) return -1e6 + bt.i
  if (b.p[1] < kill) return -1e6 + bt.i
  const slope = (pl.bot.path[bt.i] && pl.bot.path[bt.i].slope) || 0
  let s = bt.i * 10
  s -= Math.abs(b.th - slope) * 6
  s += Math.min(b.speed, 14) * 0.5
  return s
}
export function plannerInput(pl, world, b, kill) {
  if (pl.left > 0 && pl.plan) { pl.left--; const base = botInput(pl.bot, b); return { ...base, ...pl.plan } }
  let best = null, bestS = -Infinity
  const base0 = cloneBot(pl.bot)
  // 候補: 普通の bot そのまま（null）＋ 重心・アクセル・ブレーキの組み合わせ
  const cands = [null]
  for (const lean of LEANS) for (const [thr, brk] of [[1, 0], [0.4, 0], [0, 0.6]]) cands.push({ lean, thr, brk })
  for (const cd of cands) {
    const bb = clone(b), bt = cloneBot(base0)
    let dead = false
    for (let k = 0; k < pl.hold + pl.roll; k++) {
      const inp = botInput(bt, bb)
      stepBike(world, bb, k < pl.hold && cd ? { ...inp, ...cd } : inp)
      if (bb.crashed || bb.p[1] < kill) { dead = true; break }
    }
    const sc = score(pl, bb, bt, kill) - (cd ? 0.5 : 0)
    if (sc > bestS) { bestS = sc; best = cd }
  }
  pl.plan = best; pl.left = pl.hold - 1
  const inp = botInput(pl.bot, b)
  return best ? { ...inp, ...best } : inp
}
