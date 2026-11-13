import { COURSES } from '../js/course.js'
for (const k of Object.keys(COURSES)) {
  const c = COURSES[k]()
  const mn=[1e9,1e9,1e9], mx=[-1e9,-1e9,-1e9]
  for (const s of c.shapes) for (let i=0;i<3;i++){mn[i]=Math.min(mn[i],s.min[i]);mx[i]=Math.max(mx[i],s.max[i])}
  console.log(k, 'shapes', c.shapes.length, 'cps', c.cps.map(p=>p.name+'@'+p.p.map(v=>v.toFixed(1)).join(',')).join(' | '))
  console.log(' bbox', mn.map(v=>v.toFixed(0)), mx.map(v=>v.toFixed(0)), 'path', c.path.length)
  // 薄すぎる板
  const thin = c.shapes.filter(s=>s.type==='box' && Math.min(...s.h)*2 < 0.09)
  console.log(' thin', thin.length, thin.slice(0,3).map(s=>s.tag+':'+s.h.map(v=>v.toFixed(2))))
}
