// SKY BIKE v40 序盤の旗のそばの広場に立つ大人のお姉さん（Quaternius Ultimate Modular Women「Formal」CC0 を、深い赤のドレスに染めた Lady.glb）
// 壁にもたれて立ち、バイクが近づくとこちらを向く。会話の進め方は game.js（廃墟の男と同じ仕組み）
import * as THREE from 'three'

// 置き場所: 道の 10〜16% にある休憩所の旗の少し先の、平らで広い道の点（出だしの道は変えない）
export function ladySpot(course) {
  const P = course.path, N = (P.findIndex(q => q.branch) > 0 ? P.findIndex(q => q.branch) : P.length) - (course.v37added || 0)
  const ok = z => z && z.p && !z.branch && z.w >= 4 && Math.abs(z.slope || 0) < 0.07 && (z.kap || 0) < 0.04 && ['road', 'orbit', 'pad'].includes(z.kind) && !z.door
  const cpI = q => { let bi = 0, bd = 1e18; for (let k = 0; k < N; k++) { const z = P[k]; if (!z.p) continue; const d = (z.p[0] - q.p[0]) ** 2 + (z.p[2] - q.p[2]) ** 2 + ((z.p[1] - q.p[1]) * 2) ** 2; if (d < bd) { bd = d; bi = k } } return bi }
  for (const cp of course.cps || []) {
    if (!cp.rest) continue
    const ci = cpI(cp); if (ci < N * 0.10 || ci > N * 0.16) continue
    for (let i = ci + 6; i < ci + 60; i++) { let g = true; for (let j = i - 12; j <= i + 4; j++) if (!ok(P[j])) { g = false; break } if (g) { const q = P[i]; return { i, p: q.p.slice(), yaw: q.yaw, w: q.w } } }
  }
  return null
}

export function buildLady(course, group, M, loader) {
  const sp = ladySpot(course)
  const L = { spot: sp, root: null, mixer: null, acts: {}, state: 'lean', t: 0, ready: false, side: 1, face: null }
  if (!sp || !loader) return L
  // 道のどちら側に立つか: 縁の外に高い壁が無い側（高い壁の前だと、外側から見るカメラから壁の陰に隠れる）。どちらも同じなら塔から遠い側
  { const r = [Math.sin(sp.yaw), 0, Math.cos(sp.yaw)], f0 = [Math.cos(sp.yaw), 0, -Math.sin(sp.yaw)]; let best = -1e9
    for (const sg of [1, -1]) { let tall = 0; for (const a of [-3, 0, 3]) for (const o of [0.6, 1.4]) { const x = sp.p[0] + r[0] * sg * (sp.w / 2 + o) + f0[0] * a, z = sp.p[2] + r[2] * sg * (sp.w / 2 + o) + f0[2] * a; for (const s of course.shapes) if (s.min && x > s.min[0] && x < s.max[0] && z > s.min[2] && z < s.max[2] && s.max[1] > sp.p[1] + 1.2 && s.min[1] < sp.p[1] + 3) { tall++; break } }
      const x = sp.p[0] + r[0] * sg * sp.w / 2, z = sp.p[2] + r[2] * sg * sp.w / 2; let d = 1e9; for (const T of course.towers || []) d = Math.min(d, Math.hypot(x - T.cx, z - T.cz) - T.r)
      const sc = -tall * 1000 + (sg === 1 ? 1 : 0); void d; /* カメラは塔から離れた所では道の右後ろ（+1 側）から見るので、右の縁に立つ（左の縁だと飾りの高い壁の陰に入っていた） */ if (sc > best) { best = sc; L.side = sg } } }
  const f = [Math.cos(sp.yaw), 0, -Math.sin(sp.yaw)], r = [Math.sin(sp.yaw), 0, Math.cos(sp.yaw)], lat = L.side * (sp.w / 2 - 0.45)
  L.pos = [sp.p[0] + r[0] * lat, sp.p[1], sp.p[2] + r[2] * lat]
  // もたれる壁（道の縁の外の崩れた壁。見た目だけ）
  { const wg = new THREE.BoxGeometry(2.6, 2.6, 0.5, 4, 2, 1); const pp = wg.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) - Math.abs(Math.sin(pp.getX(i) * 2.3)) * 0.4)
    const w = new THREE.Mesh(wg, M.ruinwall || M.rock); const wl = L.side * (sp.w / 2 + 0.05); w.position.set(sp.p[0] + r[0] * wl, sp.p[1] + 1.1, sp.p[2] + r[2] * wl); w.rotation.y = sp.yaw; w.castShadow = true; w.receiveShadow = true; w.name = 'ladyWall'; group.add(w) }
  loader.loadAsync('assets/models/Lady.glb').then(gl => {
    const m = gl.scene
    m.traverse(o => {
      if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.material = o.material.clone(); const n = o.material.name || '', c = o.material.color
        if (/LimeGreen/.test(n)) { c.setHex(0x4a1020); o.material.roughness = 0.42; o.material.metalness = 0.05 } // 深い赤のドレス（少しつや）
        else if (/Red/.test(n)) c.setHex(0x3a1c14) // 髪は暗い赤茶
        else if (/Gold/.test(n)) c.setHex(0x9a7a3a)
        else if (/Skin/.test(n)) c.multiplyScalar(0.95) }
      if (o.isBone && o.name === 'Chest') { o.scale.set(1.06, 1.0, 1.14); for (const ch of o.children) if (ch.isBone) ch.scale.set(1 / 1.06, 1, 1 / 1.14) } // 胸まわりを少し豊かに（子の骨は元の大きさへ戻す）
    })
    m.userData.bust = bust(m)
    const box = new THREE.Box3().setFromObject(m), s = 1.7 / (box.max.y - box.min.y); m.scale.setScalar(s)
    L.root = new THREE.Group(); L.root.add(m); group.add(L.root); L.root.visible = false
    L.mixer = new THREE.AnimationMixer(m)
    for (const a of gl.animations) L.acts[a.name] = L.mixer.clipAction(a)
    L.ready = true; if (L.onReady) L.onReady()
  }).catch(e => console.warn('lady', e))
  const play = (name, fade = 0.3) => { const a = L.acts[name]; if (!a || L.cur === a) return; if (L.cur) L.cur.fadeOut(fade); a.reset().fadeIn(fade).play(); L.cur = a }
  L.set = st => { if (L.state === st) return; L.state = st; L.t = 0 }
  // 状態（game.js が決める）: lean 壁にもたれる → look 近づくとこちらを向く → talk → after 話の後 → bye 出し直し後は手を振るだけ
  L.update = (dt, cam, bike) => {
    if (!L.ready) return
    L.t += dt
    const near = cam && Math.hypot(cam.x - L.pos[0], cam.z - L.pos[2]) < 110
    L.root.visible = !!near; if (!near) return
    const across = Math.atan2(-r[0] * L.side, -r[2] * L.side) // 道の向こう側を見る向き
    let want = across, lean = 0.12
    const bx = bike ? bike.p[0] - L.pos[0] : 0, bz = bike ? bike.p[2] - L.pos[2] : 0, bd = Math.hypot(bx, bz)
    const toBike = Math.atan2(bx, bz)
    if (L.state === 'lean') { if (bike && bd < 24) { want = toBike; lean = 0.06 } play('Idle_Neutral') }
    else if (L.state === 'look' || L.state === 'talk' || L.state === 'after') { want = bike && bd < 30 ? toBike : across; lean = L.state === 'talk' ? 0.03 : 0.07; play(L.state === 'talk' && L.t < 1.2 ? 'Interact' : 'Idle') }
    else if (L.state === 'bye') { want = bike && bd < 30 ? toBike : across; lean = 0.05; play('Wave') }
    L.face = L.face == null ? want : L.face + Math.atan2(Math.sin(want - L.face), Math.cos(want - L.face)) * Math.min(1, dt * 3)
    L.root.position.set(L.pos[0] + r[0] * L.side * 0.12, L.pos[1], L.pos[2] + r[2] * L.side * 0.12)
    L.root.rotation.set(0, L.face, 0); L.root.rotateX(-lean) // 少し後ろ（壁）へもたれる
    L.mixer.update(dt)
  }
  return L
}

// v44 本人「もっと爆乳に」: ドレスの胴の頂点を、胸の 2 つの中心から丸くふくらませる（骨に付いたまま動く。服は覆ったまま・肌は増やさない）
export const BUST = { amt: 0.75, R: 0.95, up: 0.42, side: 0.6, inset: 0.45 }
function bust(root) {
  root.updateMatrixWorld(true)
  let chest = null, neck = null; root.traverse(o => { if (o.isBone && o.name === 'Chest') chest = o; if (o.isBone && o.name === 'Neck') neck = o })
  if (!chest || !neck) return 'no bone'
  const B = { ...BUST, ...(globalThis.__bust || {}) }, info = { n: 0 }
  const cw = new THREE.Vector3().setFromMatrixPosition(chest.matrixWorld), nw = new THREE.Vector3().setFromMatrixPosition(neck.matrixWorld), H = cw.distanceTo(nw)
  root.traverse(o => {
    if (!o.isSkinnedMesh || !/Body/.test(o.name + (o.parent ? o.parent.name : ''))) return
    const g = o.geometry, p = g.attributes.position, mw = o.matrixWorld, inv = mw.clone().invert(), v = new THREE.Vector3(), d = new THREE.Vector3()
    let front = -1e9; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(mw); if (Math.abs(v.y - (cw.y + H * B.up)) < H * 0.3 && Math.abs(v.x - cw.x) < H * 0.9) front = Math.max(front, v.z) }
    if (front < -1e8) return
    const R = H * B.R, cs = [-1, 1].map(sg => new THREE.Vector3(cw.x + sg * H * B.side, cw.y + H * B.up, front - R * B.inset))
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mw)
      let best = null, bk = 0
      for (const c of cs) { d.subVectors(v, c); const dist = d.length(); if (dist >= R || d.z < -R * 0.15) continue; const u = 1 - (dist / R) ** 2, k = u * u; if (k > bk) { bk = k; best = c } }
      if (!best) continue
      d.subVectors(v, best); const len = d.length() || 1; d.multiplyScalar(1 / len); d.z = Math.max(d.z, 0.35); d.normalize()
      v.addScaledVector(d, H * B.amt * bk); v.applyMatrix4(inv); p.setXYZ(i, v.x, v.y, v.z); info.n++
    }
    p.needsUpdate = true; g.computeVertexNormals(); g.computeBoundingSphere()
  })
  return info
}
