// ニトロの加速: 平らな長い道で、全開だけ / 全開＋ニトロの速さの伸び（秒ごと）と、満タンで何秒使えるか
import { World, createBike, stepBike, DT, makeBox } from '../js/physics.js'
const w = new World([makeBox({ c: [0, -0.5, 0], h: [400, 0.5, 6], mat: 'cobble', tag: 'road' })]); w.winds = []
for (const nit of [false, true]) {
  const b = createBike({ p: [-380, 0.8, 0], yaw: 0 }); for (let k = 0; k < 30; k++) stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
  const row = []; let on = 0
  for (let s = 0; s < 60 * 8; s++) { const ev = []; stepBike(w, b, { thr: 1, brk: 0, lean: 0, steer: 0, nitro: nit && s > 60 * 2 ? 1 : 0 }, ev); if (b.nitroOn) on++; if (s % 60 === 59) row.push(b.speed.toFixed(1)) }
  console.log(nit ? '全開＋ニトロ(2秒目から)' : '全開だけ', row.join(' '), nit ? '噴射 ' + (on * DT).toFixed(2) + '秒 残り ' + b.nitro.toFixed(2) : '')
}
