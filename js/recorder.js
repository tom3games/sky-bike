// SKY BIKE v65 兄の録音機（本人の案）: 野宿の跡「ここまでは二人で来た。」の少し先の道の上に、古い携帯の録音機が落ちている。
// 前輪が近づくと拾い、勝手に再生が始まる。声は入れない（本人「セリフだけで」）: 吹き出しに兄の言葉「ひとりじゃこれ以上はキツそうだ…」→ 主人公「…兄の声だ」
import * as THREE from 'three'
import { campSpot, traceSpots } from './v35view.js?v=70'

export function recorderSpot(course) {
  const cs = campSpot(course); if (!cs) return null
  const P = course.path, tr = traceSpots(course)
  const ok = q => q && q.p && !q.branch && q.w >= 3.2 && ['road', 'orbit', 'pad'].includes(q.kind) && Math.abs(q.slope || 0) < 0.08 && (q.kap || 0) < 0.05 && !q.door
  for (let i = cs.i + 45; i < Math.min(P.length - 10, cs.i + 900); i++) {
    let g = true; for (let j = i - 10; j <= i + 4; j++) if (!ok(P[j]) || Math.abs(P[j].p[1] - P[i].p[1]) > 0.2) { g = false; break } /* 手前 14 点は同じ高さの平らな道（段の上に置かない） */
    if (!g || (course.traps || []).some(T => Math.abs(i - T.i) < 30) || tr.some(T => Math.abs(i - T.i) < 20) || (course.chases || []).some(C => i > C.i0 - 30 && i < C.i1 + 30)) continue
    const q = P[i]; return { i, p: q.p.slice(), yaw: q.yaw }
  }
  return null
}

export function buildRecorder(course, scene) {
  const S = recorderSpot(course); if (!S) return null
  const g = new THREE.Group(); g.name = 'recorder'
  const body = new THREE.MeshStandardMaterial({ color: 0x2b2926, roughness: 0.55, metalness: 0.4 }), metal = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.35, metalness: 0.9 })
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.22), body); box.position.y = 0.045; box.castShadow = true; g.add(box)
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.09), new THREE.MeshStandardMaterial({ color: 0x1a1816, roughness: 0.2, metalness: 0.1 })); win.position.set(-0.03, 0.092, -0.02); g.add(win)
  const reels = []; for (const x of [-0.08, 0.02]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 10), metal); r.position.set(x, 0.1, -0.02); g.add(r); reels.push(r) }
  for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.02, 0.03), metal); b.position.set(0.1 + k * 0.0, 0.1, -0.06 + k * 0.045); g.add(b) }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff3a24, toneMapped: false })); led.position.set(0.13, 0.095, 0.08); g.add(led)
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.008, 4, 14, Math.PI * 1.3), new THREE.MeshStandardMaterial({ color: 0x5a4a38, roughness: 1 })); strap.rotation.x = -Math.PI / 2; strap.position.set(-0.22, 0.01, 0.05); g.add(strap)
  g.position.set(S.p[0], S.p[1], S.p[2]); g.rotation.y = S.yaw + 0.5; g.scale.setScalar(1.6); scene.add(g) /* 走りながら目に入る大きさ */
  const R = { ...S, group: g, led, reels, picked: false, t: 0,
    reset() { R.picked = false; R.t = 0; g.visible = true; led.visible = true },
    update(dt, time) { if (!g.visible) return; led.visible = Math.sin(time * 5) > 0.2; if (R.picked) for (const r of reels) r.rotation.y += dt * 6 } }
  return R
}
