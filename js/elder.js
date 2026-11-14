// SKY BIKE v49 出発でわざと後ろへバックし続ける人への仕掛け: 出発の地点から後ろへ 9m を越えると、後ろから村の年配の男が歩いて来て横に立ち、
// バイクは止まり「豊、気をつけて行ってこいよ。」→ 暗転 0.3 秒で出発の地点に前向きで置き直し。何度でも同じ（2 回目からは文が短く出るだけ）。
// v51 本人「アニメっぽい・ほかの人物と違う」: 2 頭身の OldClassy_Male をやめ、廃墟の男・お姉さん・乗り手と同じ Quaternius「Ultimate Modular Men」の
// 等身の体（Adventurer、背嚢を外す）に King の白髪と髭の頭（冠を外す）を付け、くすんだ上着に塗った Elder.glb。歩きはゆっくり、大きな手ぶりはやめて小さくうなずくだけ、少し背を丸める
// 準備完了の後に裏で読む
import * as THREE from 'three'
export const ELDER = { back: 9, lat: 14 }
const WALK = 3.0 // 歩いて来る秒（セリフは game.js が 1.4 秒の後・バイクが止まったら出す。最後の数歩は話しながら）

export function buildElder(course, group, M, loader) {
  const sp = course.spawn
  const E = { spawn: sp, root: null, mixer: null, acts: {}, ready: false, state: 'hide', t: 0, from: null, to: null, face: 0 }
  if (!sp || !loader) return E
  const f = [Math.cos(sp.yaw), 0, -Math.sin(sp.yaw)], r = [Math.sin(sp.yaw), 0, Math.cos(sp.yaw)]
  E.f = f; E.r = r
  loader.loadAsync('assets/models/Elder.glb').then(gl => {
    const m = gl.scene
    m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false } if (o.isBone && o.name === 'Chest') E.chest = o; if (o.isBone && o.name === 'Neck') E.neck = o })
    const box = new THREE.Box3().setFromObject(m), s = 1.7 / (box.max.y - box.min.y); m.scale.setScalar(s)
    E.root = new THREE.Group(); E.root.add(m); group.add(E.root); E.root.visible = false
    E.mixer = new THREE.AnimationMixer(m)
    for (const a of gl.animations) E.acts[a.name] = E.mixer.clipAction(a)
    if (E.acts.Walk) E.acts.Walk.timeScale = 0.95
    if (E.acts.Idle_Neutral) E.acts.Idle_Neutral.timeScale = 0.8
    E.ready = true; if (E.onReady) E.onReady()
  }).catch(e => console.warn('elder', e))
  const play = (name, fade = 0.35) => { const a = E.acts[name]; if (!a || E.cur === a) return; if (E.cur) E.cur.fadeOut(fade); a.reset().fadeIn(fade).play(); E.cur = a }
  // 出てくる: バイクの斜め後ろ（右、カメラの外）から歩いて、バイクの右横に立つ
  E.come = bike => {
    const p = bike.p, h = [Math.cos(bike.psi), 0, -Math.sin(bike.psi)], rr = [Math.sin(bike.psi), 0, Math.cos(bike.psi)], y = p[1] - 0.8
    E.from = [p[0] - h[0] * 4.6 + rr[0] * 3.0, y, p[2] - h[2] * 4.6 + rr[2] * 3.0]
    E.to = [p[0] + h[0] * 0.3 + rr[0] * 1.8, y, p[2] + h[2] * 0.3 + rr[2] * 1.8]
    E.state = 'walk'; E.t = 0; E.talkT = null; E.face = Math.atan2(E.to[0] - E.from[0], E.to[2] - E.from[2])
  }
  E.hide = () => { E.state = 'hide'; if (E.root) E.root.visible = false } // アニメは止めない（骨に足した姿勢の分 E.pose と骨の値の対応を崩さない）
  E.update = (dt, bike) => {
    if (!E.ready || E.state === 'hide') return
    E.t += dt; E.root.visible = true
    const u = Math.min(1, E.t / WALK), a = E.from, b = E.to
    const k = u < 0.85 ? u : 0.85 + (1 - (1 - (u - 0.85) / 0.15) ** 2) * 0.15 // 止まる前に少し歩みをゆるめる
    E.root.position.set(a[0] + (b[0] - a[0]) * k, a[1], a[2] + (b[2] - a[2]) * k)
    let want = Math.atan2(b[0] - a[0], b[2] - a[2])
    if (u > 0.9 && bike) want = Math.atan2(bike.p[0] - E.root.position.x, bike.p[2] - E.root.position.z) // 着く間際に乗り手の方へ向き直る
    E.face += Math.atan2(Math.sin(want - E.face), Math.cos(want - E.face)) * Math.min(1, dt * 4)
    E.root.rotation.set(0, E.face, 0)
    if (E.state === 'talk' && u >= 1 && E.talkT == null) E.talkT = 0
    if (E.talkT != null) E.talkT += dt
    play(u < 1 ? 'Walk' : 'Idle_Neutral')
    // 年配の姿勢: 胸を少し前へ丸め、首で顔を前へ戻す。話す時は小さく 2 回うなずくだけ。
    // アニメが同じ値の間は骨を書き直さない（three の PropertyMixer）ので、前の刻みで足した分を先に引いてから進める（足し続けると丸まり続ける）
    const o = E.pose || (E.pose = { c: 0, n: 0 })
    if (E.chest) E.chest.rotation.x -= o.c
    if (E.neck) E.neck.rotation.x -= o.n
    E.mixer.update(dt)
    o.c = 0.12; o.n = -0.12 + (E.talkT != null && E.talkT < 1.2 ? Math.sin(E.talkT / 1.2 * Math.PI * 2) ** 2 * 0.2 : 0)
    if (E.chest) E.chest.rotation.x += o.c
    if (E.neck) E.neck.rotation.x += o.n
  }
  return E
}
