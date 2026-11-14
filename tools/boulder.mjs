// v41 落石の坂: 旗から上手い bot で登り、予告（地鳴り・2 秒）が始まってから D 秒後にブレーキを押し続けて（バック）門まで下がる。逃げ切り・追いつかれ・道から落ちた を数える
// node tools/boulder.mjs   DELAYS=0.3,1.5
import { World, stepBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
import { createBot, botInput, resetBot } from '../js/bot.js'
import { spawnAtCp, judge, pathS , rerollTraps } from '../js/run.js'
import { createSteer, steerFor, resetSteer } from '../js/steer.js'
import { ROCK } from '../js/v41.js'
const ROCKR = ROCK.R
globalThis.__rock = {}; if (process.env.VMAX) __rock.vMax = +process.env.VMAX; if (process.env.ACC) __rock.acc = +process.env.ACC; if (process.env.TRIG) __rock.trigFrac = +process.env.TRIG; if (process.env.WARN) __rock.warn = +process.env.WARN
const c = COURSES.stage1(), B = c.boulder, S = pathS(c)
const ci = c.cps.findIndex(q => q.name === '落石の坂の下')
const rows = []
for (const D of (process.env.DELAYS || '0.3,0.8,1.2,1.5,2.0').split(',').map(Number)) {
  const res = {}; let minGap = 99, maxV = 0, maxLat = 0
  for (let seed = 0; seed < 8; seed++) {
    const w = new World(c.shapes); w.winds = c.winds; w.setTime(seed * 1.37)
    const b0 = spawnAtCp(w, c, ci); let b = b0
    const bot = createBot(c, { skill: 'good' }); bot.world = w; resetBot(bot, b)
    const st = createSteer(c.path); resetSteer(st, b)
    const R = { cp: ci, rest: ci }; if (!process.env.NORAND) { R.seed = 500 + seed * 7919; rerollTraps(w, R) } /* v47 */ let tRoll = null, r = '岩が来ない', thrCap = 0.6 + (seed % 4) * 0.13
    for (let s = 0; s < 60 * 60; s++) {
      let inp = botInput(bot, b)
      if (tRoll == null) inp = { ...inp, thr: Math.min(inp.thr, thrCap) } // 登る速さを人ごとに変える
      else if (w.time - tRoll >= D) inp = { thr: 0, brk: 1, lean: 0, steer: b.crashed ? 0 : steerFor(st, b), nitro: 0 }
      else steerFor(st, b)
      w.tick(); stepBike(w, b, inp, []); const j = judge(w, c, R, b, b.p)
      if (j.boulder && j.boulder.ph === 'warn') tRoll = w.time // 反応は予告（地鳴り）が始まってから
      const bo = R.bo
      if (bo && bo.ph === 'roll') { minGap = Math.min(minGap, bo.s - ROCK.R - S[bo.bi]) } if (bo && (bo.ph === 'roll' || bo.ph === 'warn')) { const q = c.path[bo.bi]; if (b.speed < 0) maxV = Math.max(maxV, -b.speed); const lat = Math.abs((b.p[0] - q.p[0]) * Math.sin(q.yaw) + (b.p[2] - q.p[2]) * Math.cos(q.yaw)); maxLat = Math.max(maxLat, lat) }
      if (bo && bo.ph === 'broken') { r = '逃げ切り'; break }
      if (bo && bo.ph === 'hit') { r = '追いつかれた'; break }
      if (j.respawn || (b.crashed && b.crashed.why !== 'boulder')) { r = '転倒/落下(' + (b.crashed ? b.crashed.why : 'fell') + ')'; break }
    }
    res[r] = (res[r] || 0) + 1
  }
  rows.push({ 反応: D + '秒', ...res, 最小の差m: +minGap.toFixed(2), バックの最高速: +maxV.toFixed(2), 道の中心からのずれ最大: +maxLat.toFixed(2) })
}

console.table(rows)
