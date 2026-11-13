import { makeBox, World, createBike, stepBike } from '../js/physics.js'
const w=new World([makeBox({c:[50,-0.5,0],h:[200,0.5,10]})])
for (const [v0,lean,thr] of [[4,-1,1],[4,-0.5,1],[4,0,1],[8,-1,1],[0,-1,1],[0,0,1],[4,-1,0]]){
  const b=createBike({p:[0,0.8,0]}); b.v[0]=v0; b.speed=v0
  for(let i=0;i<60;i++) stepBike(w,b,{thr:0,brk:0,lean:0,steer:0})
  const tr=[]
  for(let i=0;i<120;i++){ stepBike(w,b,{thr,brk:0,lean,steer:0}); if(i%10==9) tr.push((b.th*57.3).toFixed(0)) }
  console.log('v0',v0,'lean',lean,'thr',thr,'pitch/0.17s:',tr.join(' '),'v',b.speed.toFixed(1), b.crashed&&b.crashed.why)
}
