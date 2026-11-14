// SKY BIKE v49 出発でわざと後ろへバックし続ける人への仕掛け: 出発の地点から後ろへ 9m を越えると、後ろから村の年配の男が歩いて来て横に立ち、
// バイクは止まり「豊、気をつけて行ってこいよ。」→ 暗転 0.3 秒で出発の地点に前向きで置き直し。何度でも同じ（2 回目からは文が短く出るだけ）。
// モデルは Quaternius「Ultimate Animated Character Pack」OldClassy_Male（CC0。使うアニメ 3 本だけ残した Elder.glb）。準備完了の後に裏で読む
import * as THREE from 'three'
export const ELDER = { back: 9, lat: 14 }

export function buildElder(course, group, M, loader) {
  const sp = course.spawn
  const E = { spawn: sp, root: null, mixer: null, acts: {}, ready: false, state: 'hide', t: 0, from: null, to: null }
  if (!sp || !loader) return E
  const f = [Math.cos(sp.yaw), 0, -Math.sin(sp.yaw)], r = [Math.sin(sp.yaw), 0, Math.cos(sp.yaw)]
  E.f = f; E.r = r
  loader.loadAsync('assets/models/Elder.glb').then(gl => {
    const m = gl.scene
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false } })
    const box = new THREE.Box3().setFromObject(m), s = 1.68 / (box.max.y - box.min.y); m.scale.setScalar(s)
    E.root = new THREE.Group(); E.root.add(m); group.add(E.root); E.root.visible = false
    E.mixer = new THREE.AnimationMixer(m)
    for (const a of gl.animations) E.acts[a.name] = E.mixer.clipAction(a)
    E.ready = true; if (E.onReady) E.onReady()
  }).catch(e => console.warn('elder', e))
  const play = (name, fade = 0.25) => { const a = E.acts[name]; if (!a || E.cur === a) return; if (E.cur) E.cur.fadeOut(fade); a.reset().fadeIn(fade).play(); E.cur = a }
  // 出てくる: バイクの斜め後ろ（右）から歩いて、バイクの右の少し前に立つ
  E.come = bike => {
    const p = bike.p, h = [Math.cos(bike.psi), 0, -Math.sin(bike.psi)], rr = [Math.sin(bike.psi), 0, Math.cos(bike.psi)], y = p[1] - 0.8
    E.from = [p[0] - h[0] * 6 + rr[0] * 2.4, y, p[2] - h[2] * 6 + rr[2] * 2.4]
    E.to = [p[0] + h[0] * 0.8 + rr[0] * 1.9, y, p[2] + h[2] * 0.8 + rr[2] * 1.9]
    E.state = 'walk'; E.t = 0
  }
  E.hide = () => { E.state = 'hide'; if (E.root) E.root.visible = false }
  E.update = (dt, bike) => {
    if (!E.ready || E.state === 'hide') return
    E.t += dt; E.root.visible = true
    const W = 1.4, u = Math.min(1, E.t / W), a = E.from, b = E.to
    E.root.position.set(a[0] + (b[0] - a[0]) * u, a[1], a[2] + (b[2] - a[2]) * u)
    let face = Math.atan2(b[0] - a[0], b[2] - a[2])
    if (u >= 1 && bike) face = Math.atan2(bike.p[0] - b[0], bike.p[2] - b[2])
    E.root.rotation.set(0, face, 0)
    play(u < 1 ? 'Walk' : E.state === 'talk' && E.t - W < 1.2 ? 'Victory' : 'Idle')
    E.mixer.update(dt)
  }
  return E
}
