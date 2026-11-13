// 記録した入力（上手い bot の第1面の走り）と、node での最後の状態の指紋を書き出す
import { writeFileSync } from 'node:fs'
import { runSim } from './sim.mjs'
import { World, createBike, stepBike, hashBike } from '../js/physics.js'
import { COURSES } from '../js/course.js'
const r = runSim('practice', 'good', { maxSec: 60 })
// 入力だけで再生して指紋を取る（転倒からの戻りを含まない最初の 1800 刻み）
const c = COURSES.practice(), w = new World(c.shapes), q = c.cps[0]
const b = createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 20; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
const inp = r.inputs.slice(0, 2000)
for (const i of inp) stepBike(w, b, i)
writeFileSync(new URL('./rec_practice.json', import.meta.url), JSON.stringify({ inp, hash: hashBike(b), p: b.p }))
console.log('hash', hashBike(b), b.p.map(v => v.toFixed(3)))
