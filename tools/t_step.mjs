import { makeBox, World, createBike, stepBike, basis, wheelCenter } from '../js/physics.js'
function test(stepH, mode, vT=5){
  const shapes=[makeBox({c:[50,-0.5,0],h:[80,0.5,10]}), makeBox({c:[30+20,stepH/2,0],h:[20,stepH/2,10]})]
  const w=new World(shapes), b=createBike({p:[0,0.9,0],yaw:0}), ev=[]
  let phase=0, t=0
  for(let i=0;i<12*60;i++){ t=i/60
    const B=basis(b), fw=wheelCenter(b,B,1,b.s[1]), rw=wheelCenter(b,B,0,b.s[0])
    let thr = b.speed<vT?1:0, lean=0
    if(mode==='wheelie'){
      const d=30-fw[0]
      if(phase===0 && d<1.6) phase=1
      if(phase===1){ lean=-1; thr=1; if(fw[1]>stepH+0.42) phase=2 }
      if(phase===2){ lean=1; thr=1; if(rw[0]>30.5) phase=3 }
      if(phase===3){ lean=0 }
    }
    stepBike(w,b,{thr,brk:0,lean,steer:0},ev)
    if(b.crashed) break
    if(b.p[0]>40) break
  }
  console.log('step',stepH,mode,'vT',vT,'x',b.p[0].toFixed(2),'y',b.p[1].toFixed(2),'th',(b.th*57.3).toFixed(0),'v',b.speed.toFixed(1),'t',t.toFixed(1),'crash',b.crashed&&b.crashed.why, 'phase',phase)
}
for (const h of [0.15,0.25,0.35,0.5,0.65]) { test(h,'plain',5); test(h,'plain',9); test(h,'wheelie',4) }
