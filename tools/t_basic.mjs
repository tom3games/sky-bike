import { makeBox, World, createBike, stepBike, basis, dsin, dcos, datan2 } from '../js/physics.js'
// 三角関数の精度
let e=0; for(let x=-20;x<20;x+=0.0137){e=Math.max(e,Math.abs(dsin(x)-Math.sin(x)),Math.abs(dcos(x)-Math.cos(x)))}
let ea=0; for(let i=0;i<5000;i++){const y=Math.sin(i)*3,x=Math.cos(i*1.3)*2; ea=Math.max(ea,Math.abs(datan2(y,x)-Math.atan2(y,x)))}
console.log('trig err', e, ea)
const shapes=[makeBox({c:[50,-0.5,0],h:[80,0.5,10]})]
// 段差 0.5m at x=40
shapes.push(makeBox({c:[60,0.25,0],h:[20,0.25,10],mat:'step'}))
const w=new World(shapes)
function run(name, policy, T=8){
  const b=createBike({p:[0,0.9,0],yaw:0}); const ev=[]
  let maxTh=-9, minTh=9
  for(let i=0;i<T*60;i++){ stepBike(w,b,policy(i/60,b),ev); maxTh=Math.max(maxTh,b.th); minTh=Math.min(minTh,b.th) }
  console.log(name, 'x',b.p[0].toFixed(2),'y',b.p[1].toFixed(2),'th',(b.th*57.3).toFixed(1),'v',b.speed.toFixed(2),'s',b.s.map(v=>v.toFixed(3)),'g',b.g,'maxTh',(maxTh*57.3).toFixed(0),'crash',b.crashed&&b.crashed.why, ev.filter(e=>e.t!=='land').map(e=>e.t+':'+(e.why||'')).join(','))
}
run('idle', ()=>({thr:0,brk:0,lean:0,steer:0}),3)
run('thr2s', t=>({thr:t<2?1:0,brk:0,lean:0,steer:0}),3)
run('noWheelie->step', t=>({thr:1,brk:0,lean:0.3,steer:0}),6)
run('wheelie->step', t=>({thr:1,brk:0,lean: t<2.2?0:(t<2.9?-1:1),steer:0}),6)
