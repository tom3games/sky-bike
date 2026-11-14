// バイクと乗り手の見た目。タイヤの形は当たりと同じドーナツ（円の半径 R・太さ rt）
// 車体は形のある部品（外装・タンク・シート・泥よけ・排気管）で組む。乗り手は CC0 の人物模型（Quaternius）を
// 2本の骨の IK で、足をステップ・手をグリップに合わせて立ち乗りさせる。
import * as THREE from 'three'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { BIKE, basis, wheelCenter } from './physics.js?v=32'

const P = BIKE
const V = (x, y, z) => new THREE.Vector3(x, y, z)
// 横から見た形を厚みのある板にする（z の真ん中に置く）
// 薄い曲がった板（泥よけ）: 中心線 f(t) に沿って厚み th の板
function plate(f, n, th, depth) {
  const top = [], bot = []
  for (let i = 0; i <= n; i++) { const [x, y] = f(i / n); top.push([x, y]); bot.push([x, y - th]) }
  return profile(top.concat(bot.reverse()), depth, 0.006)
}
function profile(pts, depth, bevel = 0.012) {
  const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 4 })
  g.translate(0, 0, -depth / 2); return g
}
export class BikeView {
  // v28: ライトを光らせる（0..1）
  flinch() { this._flinch = performance.now() }
  setLamp(k) { if (!this.lampM) return; this.lampM.emissiveIntensity = 0.05 + k * 6; this.lampLight.intensity = k * 600; this.lampGlow.visible = k > 0.02; this.lampGlow.material.opacity = Math.min(1, k) }
  constructor(scene, o = {}) {
    this.root = new THREE.Group(); this.root.name = o.ghost ? 'ghost' : 'bike'
    this.body = new THREE.Group(); this.root.add(this.body)
    const ghost = this.ghost = !!o.ghost
    const mat = (c, r = 0.5, m = 0.2) => ghost ? new THREE.MeshBasicMaterial({ color: 0x9fd4dc, transparent: true, opacity: 0.22, depthWrite: false }) : new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m })
    const plastic = mat(0x6a2622, 0.55, 0.05), white = mat(0xb9b2a4, 0.6, 0.05), frameM = mat(0x2a2b2d, 0.45, 0.7), alu = mat(0x8a8c8e, 0.35, 0.85), black = mat(0x151617, 0.7, 0.2), rubber = mat(0x131313, 0.92, 0), chrome = mat(0xb8bcc0, 0.25, 0.95)
    const tail = ghost ? plastic : new THREE.MeshStandardMaterial({ color: 0x300000, emissive: new THREE.Color(2.5, 0.15, 0.1), roughness: 0.4 })
    this.mats = [plastic, white, frameM, alu, black, rubber, chrome]
    const add = (g, m, parent = this.body) => { const ms = new THREE.Mesh(g, m); ms.castShadow = !ghost; ms.receiveShadow = !ghost; parent.add(ms); return ms }
    const tube = (a, b, r, m, parent) => {
      const va = V(...a), vb = V(...b), d = vb.clone().sub(va)
      const ms = add(new THREE.CylinderGeometry(r, r, d.length(), 10), m, parent)
      ms.position.copy(va).add(vb).multiplyScalar(0.5); ms.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return ms
    }
    // ---- 車体（重心を原点、x 前・y 上・z 右）
    const head = [0.5, 0.18], pivot = [-0.18, -0.2]
    for (const z of [-0.07, 0.07]) { tube([head[0], head[1], z * 0.4], [-0.05, 0.04, z], 0.028, frameM); tube([-0.05, 0.04, z], [pivot[0], pivot[1], z], 0.026, frameM); tube([-0.05, 0.04, z], [-0.62, 0.12, z], 0.018, frameM) }
    tube([head[0], head[1], 0], [0.12, -0.24, 0], 0.03, frameM)
    // エンジン（角を落とした塊とシリンダーのフィン）
    add(profile([[-0.16, -0.32], [0.16, -0.32], [0.2, -0.18], [0.12, -0.05], [-0.12, -0.05], [-0.2, -0.2]], 0.2, 0.02), frameM)
    for (let i = 0; i < 6; i++) { const f = add(new THREE.BoxGeometry(0.17, 0.012, 0.19), alu); f.position.set(0.06, -0.04 + i * 0.026, 0); f.rotation.z = -0.35 }
    // 排気管（右側を回って後ろへ）と消音器
    const ex = new THREE.CatmullRomCurve3([V(0.12, -0.02, 0.06), V(0.24, -0.12, 0.12), V(0.12, -0.24, 0.16), V(-0.18, -0.12, 0.17), V(-0.42, 0.02, 0.16)])
    add(new THREE.TubeGeometry(ex, 24, 0.026, 8), chrome)
    const sil = add(new THREE.CylinderGeometry(0.05, 0.045, 0.34, 12), alu); sil.position.set(-0.58, 0.07, 0.16); sil.rotation.z = Math.PI / 2 - 0.25
    // タンクとラジエーターの覆い（外装）、ゼッケンの横板
    add(profile([[0.05, 0.1], [0.42, 0.24], [0.46, 0.14], [0.3, -0.04], [0.06, -0.02]], 0.26, 0.02), plastic)
    for (const z of [-0.15, 0.15]) { const sh = add(profile([[0.12, 0.16], [0.44, 0.22], [0.38, -0.06], [0.16, -0.1]], 0.02, 0.006), plastic); sh.position.z = z }
    for (const z of [-0.13, 0.13]) { const sp = add(profile([[-0.62, 0.12], [-0.2, 0.08], [-0.22, -0.06], [-0.5, -0.02]], 0.015, 0.005), white); sp.position.z = z }
    // シート（長く平ら）
    add(profile([[-0.68, 0.17], [0.1, 0.13], [0.16, 0.08], [-0.02, 0.06], [-0.66, 0.1]], 0.2, 0.025), black)
    // 後ろの泥よけ（上へ反り返る）とテールランプ
    add(plate(u => [-0.55 - u * 0.52, 0.13 + u * 0.11 + Math.sin(u * Math.PI) * 0.03], 10, 0.03, 0.17), white)
    const tl = add(new THREE.BoxGeometry(0.03, 0.03, 0.08), tail); tl.position.set(-1.06, 0.25, 0)
    // ハンドル
    this.bar = new THREE.Group(); this.bar.position.set(head[0], head[1], 0); this.body.add(this.bar)
    tube([0, 0.13, -0.38], [0, 0.13, 0.38], 0.014, black, this.bar)
    for (const z of [-0.33, 0.33]) tube([0, 0.13, z - 0.05 * Math.sign(z)], [0, 0.13, z + 0.06 * Math.sign(z)], 0.022, rubber, this.bar)
    tube([0, 0, -0.07], [0, 0.13, -0.05], 0.02, alu, this.bar); tube([0, 0, 0.07], [0, 0.13, 0.05], 0.02, alu, this.bar)
    const np = add(plate(u => [0.02 + u * 0.1, -0.1 + u * 0.24], 4, 0.025, 0.2), white, this.bar)
    // v28 ヘッドライト（ゼッケンの板の前の丸いレンズ。ふだんは暗く、クラクションの時にパッパッと光る）
    if (!ghost) {
      this.lampM = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, emissive: 0xfff2c8, emissiveIntensity: 0.05, roughness: 0.3, metalness: 0.2 })
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.03, 18), this.lampM); lens.rotation.z = Math.PI / 2; lens.position.set(0.17, 0.05, 0); this.bar.add(lens)
      this.lampLight = new THREE.SpotLight(0xfff0d0, 0, 30, 0.45, 0.45, 1.2); this.lampAt = new THREE.Object3D(); this.lampAt.position.set(0.2, 0.05, 0); this.bar.add(this.lampAt); scene.add(this.lampLight) // v31: 光はバイクの外（シーン直下）に置き、毎フレーム位置だけ合わせる（バイクを隠す・出すで光の数が変わると、全部の材料のシェーダを作り直して止まる）
      const tg = new THREE.Object3D(); tg.position.set(6, -0.9, 0); this.bar.add(tg); this.lampLight.target = tg
      // 光ったときの、ライトのまわりのにじみ（足し算で重ねる板）
      const cv = document.createElement('canvas'); cv.width = cv.height = 64; const cx = cv.getContext('2d'), gr = cx.createRadialGradient(32, 32, 0, 32, 32, 32)
      gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(0.25, 'rgba(255,236,190,0.55)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); cx.fillStyle = gr; cx.fillRect(0, 0, 64, 64)
      this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }))
      this.lampGlow.scale.set(0.9, 0.9, 1); this.lampGlow.position.set(0.22, 0.05, 0); this.lampGlow.visible = false; this.bar.add(this.lampGlow)
    }
    // ---- 車輪（当たりと同じ大きさのドーナツ）
    this.wheels = [0, 1].map(i => {
      const g = new THREE.Group()
      add(new THREE.TorusGeometry(P.R, P.rt, 16, 44), rubber, g)
      add(new THREE.TorusGeometry(P.R - 0.035, 0.02, 6, 36), alu, g)
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.045, 0.035, 0.07), rubber, 64); im.castShadow = !ghost
      const o3 = new THREE.Object3D()
      for (let k = 0; k < 64; k++) { const a = k / 32 * Math.PI, side = k % 2 ? 0.06 : -0.06; o3.position.set(Math.cos(a) * (P.R + P.rt - 0.008), Math.sin(a) * (P.R + P.rt - 0.008), side); o3.rotation.set(0, 0, a); o3.updateMatrix(); im.setMatrixAt(k, o3.matrix) }
      g.add(im)
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2; tube([0, 0, k % 2 ? 0.03 : -0.03], [Math.cos(a) * (P.R - 0.04), Math.sin(a) * (P.R - 0.04), 0], 0.0035, chrome, g).castShadow = false }
      const hub = add(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 14), alu, g); hub.rotation.x = Math.PI / 2
      if (i) { const disc = add(new THREE.RingGeometry(0.06, 0.13, 24), chrome, g); disc.position.z = -0.07 }
      const spin = new THREE.Group(); spin.add(g); this.root.add(spin)
      return spin
    })
    // 前の泥よけ（前輪の上。フォークと一緒に動く）
    this.ffender = add(plate(u => { const a = -0.55 + u * 1.5; return [Math.sin(a) * 0.4, Math.cos(a) * 0.4 - 0.4] }, 14, 0.03, 0.15), white, this.root)
    // フォーク（上は黒・下は銀）とスイングアーム、ショック
    this.fork = [-0.09, 0.09].map(z => [tube([0, 0, 0], [0, 1, 0], 0.032, black, this.root), tube([0, 0, 0], [0, 1, 0], 0.024, chrome, this.root), z])
    this.arm = [-0.09, 0.09].map(z => [tube([0, 0, 0], [0, 1, 0], 0.026, alu, this.root), z])
    this.shock = tube([0, 0, 0], [0, 1, 0], 0.03, mat(0x9a6a2a, 0.4, 0.6), this.root)
    // ニトロのボトル（車体の左、シートの下）: ガラスの筒の中に青く光る中身。中身の高さが残りの量
    if (!ghost) {
      const glass = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, depthWrite: false })
      this.nFillM = new THREE.MeshStandardMaterial({ color: 0x1b6cff, emissive: new THREE.Color(0.25, 0.9, 2.4), roughness: 0.3 })
      const bot = new THREE.Group(); bot.position.set(-0.3, -0.02, -0.21); bot.rotation.z = Math.PI / 2 - 0.12; this.body.add(bot)
      add(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 16, 1, true), glass, bot).castShadow = false
      for (const y of [-0.17, 0.17]) { const cap = add(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 16), chrome, bot); cap.position.y = y }
      this.nFill = add(new THREE.CylinderGeometry(0.044, 0.044, 0.32, 14), this.nFillM, bot); this.nFill.castShadow = false
      const strap = add(new THREE.TorusGeometry(0.06, 0.008, 6, 20), black, bot); strap.rotation.x = Math.PI / 2
      // 噴射の炎（消音器の出口から後ろへ）: 青い芯と橙の外炎。加算で光らせる
      const fl = this.flame = new THREE.Group(); fl.position.set(-0.75, 0.115, 0.16); fl.rotation.z = Math.PI / 2 - 0.25 + Math.PI; this.body.add(fl)
      const fm = (c, o) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false })
      const cone = (r, h, m) => { const g = new THREE.ConeGeometry(r, h, 14, 1, true); g.translate(0, h / 2, 0); g.rotateZ(Math.PI); const ms = new THREE.Mesh(g, m); ms.castShadow = false; fl.add(ms); return ms }
      this.flameOut = cone(0.075, 0.9, fm(0xff8a3a, 0.75)); this.flameIn = cone(0.04, 0.55, fm(0x7ec8ff, 0.95))
      this.flameLight = new THREE.PointLight(0x7ab8ff, 0, 5, 2); this.flameAt = new THREE.Object3D(); this.flameAt.position.set(0, -0.4, 0); fl.add(this.flameAt); scene.add(this.flameLight) // v31: 炎を隠しても光は数えたまま（明るさ 0）
      fl.visible = false
    }
    // 乗り手
    this.rider = new THREE.Group(); this.body.add(this.rider)
    this.ready = false
    scene.add(this.root)
  }
  async loadRider(url) {
    const gl = await new GLTFLoader().loadAsync(url)
    const m = gl.scene
    m.traverse(o => { if (o.isMesh) { o.castShadow = !this.ghost; o.frustumCulled = false; if (o.material) { o.material.roughness = Math.max(0.55, o.material.roughness ?? 0.6); o.material.metalness = 0.1 } } })
    const box = new THREE.Box3().setFromObject(m), h = box.max.y - box.min.y
    m.scale.setScalar(1.72 / h) // 身長 1.72m
    m.rotation.y = Math.PI / 2 // 模型は +z を向いている → バイクの +x へ
    this.rider.add(m)
    const bone = n => m.getObjectByName(n) || m.getObjectByName(n.replace(/[.]/g, '')) // GLTFLoader は名前の「.」を消す
    this.B = {}
    for (const n of ['Hips', 'Abdomen', 'Torso', 'Chest', 'Neck', 'Head', 'UpperArm.L', 'LowerArm.L', 'Wrist.L', 'UpperArm.R', 'LowerArm.R', 'Wrist.R', 'UpperLeg.L', 'LowerLeg.L', 'Foot.L', 'UpperLeg.R', 'LowerLeg.R', 'Foot.R']) { const b = bone(n); if (b) { this.B[n] = b; b.userData.q0 = b.quaternion.clone() } }
    this.model = m
    this.ready = !!(this.B.Hips && this.B['UpperLeg.L'] && this.B['UpperArm.L'] && this.B['Foot.L'] && this.B['Wrist.L'])
  }
  // 立ち乗りの姿勢: 腰の位置を決め、胴を前へ倒し、足はステップ・手はグリップへ（IK）
  pose(lean, crouch, air) {
    if (!this.ready) return
    const B = this.B
    for (const k in B) B[k].quaternion.copy(B[k].userData.q0)
    this._p = this._p || { c: crouch, l: lean }
    this._p.c += (Math.min(1, crouch + (air ? 0.3 : 0)) - this._p.c) * 0.25; this._p.l += (lean - this._p.l) * 0.3
    const C = this._p.c, L = this._p.l
    this.body.updateMatrixWorld(true)
    // 左右の向きを1回だけ実測（模型の左足が車体の z の負の側か）
    if (!this.sideSign) { const l = this.body.worldToLocal(B['UpperLeg.L'].getWorldPosition(new THREE.Vector3())); this.sideSign = l.z < 0 ? 1 : -1 }
    // 腰（体の座標）。前体重で前へ・後ろ体重で後ろへ、縮むほど低く
    const hip = V(-0.13 + L * 0.09, 0.5 - C * 0.16, 0)
    const cur = this.body.worldToLocal(B.Hips.getWorldPosition(new THREE.Vector3()))
    this.rider.position.add(hip.clone().sub(cur)); this.rider.updateMatrixWorld(true)
    // 胴を前へ倒す（車体の横の軸のまわり）
    const lat = new THREE.Vector3(0, 0, 1).transformDirection(this.body.matrixWorld)
    const bend = (b, ang) => { if (!b) return; const wq = b.getWorldQuaternion(new THREE.Quaternion()), q = new THREE.Quaternion().setFromAxisAngle(lat, -ang), pq = b.parent.getWorldQuaternion(new THREE.Quaternion()); b.quaternion.copy(pq.invert().multiply(q.multiply(wq))); b.updateMatrixWorld(true) }
    bend(B.Abdomen, 0.5 + L * 0.25 + C * 0.15); bend(B.Chest || B.Torso, 0.28 + L * 0.15); bend(B.Head, -(0.55 + L * 0.3 + C * 0.1))
    const W = p => this.body.localToWorld(V(...p))
    const fwd = new THREE.Vector3(1, 0, 0).transformDirection(this.body.matrixWorld), up = new THREE.Vector3(0, 1, 0).transformDirection(this.body.matrixWorld)
    for (const n of ['L', 'R']) {
      const zs = (n === 'L' ? -1 : 1) * this.sideSign
      const hk = W([hip.x, hip.y, 0.1 * zs])
      ik2(B['UpperLeg.' + n], B['LowerLeg.' + n], B['Foot.' + n], W([-0.1, -0.31, 0.16 * zs]), hk.clone().addScaledVector(fwd, 1.0).addScaledVector(lat, 0.2 * zs))
      ik2(B['UpperArm.' + n], B['LowerArm.' + n], B['Wrist.' + n], this.bar.localToWorld(V(0, 0.13, 0.31 * zs)), W([0.0, 0.55, 0.6 * zs]).addScaledVector(up, -0.3).addScaledVector(fwd, -0.2))
    }
  }
  sync(b, lerpFrom, alpha) {
    const s = lerpFrom ? mixState(lerpFrom, b, alpha) : b
    const Bs = basis(s)
    const m = new THREE.Matrix4().makeBasis(V(...Bs.f), V(...Bs.u), V(...Bs.R))
    this.root.position.set(s.p[0], s.p[1], s.p[2])
    const q = new THREE.Quaternion().setFromRotationMatrix(m)
    // 曲がる時の傾き（見た目だけ）
    const roll = Math.max(-0.7, Math.min(0.7, -Math.atan((b.psiRate || 0) * Math.abs(b.speed || 0) / 9.81))) // 曲がる時、速いほど深く内側へ倒れる（遠心力と釣り合う角度）
    this.roll = (this.roll || 0) + (roll - (this.roll || 0)) * 0.2
    const qr = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), this.roll)
    this.body.quaternion.copy(q).multiply(qr)
    for (let i = 0; i < 2; i++) {
      const c = wheelCenter(s, Bs, i, s.s[i]), w = this.wheels[i]
      w.position.set(c[0] - s.p[0], c[1] - s.p[1], c[2] - s.p[2])
      w.quaternion.copy(q).multiply(qr)
      w.children[0].rotation.z = -(b.wheelRot[i] || 0)
    }
    const toLocal = v => V(v[0] - s.p[0], v[1] - s.p[1], v[2] - s.p[2])
    const head = toLocal(bodyPt(s, Bs, 0.5, 0.18)), front = this.wheels[1].position, pivot = toLocal(bodyPt(s, Bs, -0.18, -0.2)), rear = this.wheels[0].position
    const R = V(...Bs.R)
    for (const [up, low, z] of this.fork) { const off = R.clone().multiplyScalar(z), top = head.clone().add(off), bot = front.clone().add(off), mid = bot.clone().lerp(top, 0.5); placeTube(low, bot, mid); placeTube(up, mid, top) }
    for (const [arm, z] of this.arm) { const off = R.clone().multiplyScalar(z); placeTube(arm, rear.clone().add(off), pivot.clone().add(off)) }
    placeTube(this.shock, rear.clone().lerp(pivot, 0.45), toLocal(bodyPt(s, Bs, -0.12, 0.08)))
    const fdir = head.clone().sub(front).normalize()
    this.ffender.position.copy(front).addScaledVector(fdir, P.R + P.rt + 0.05)
    this.ffender.quaternion.copy(q)
    this.bar.rotation.y = (s.delta || 0) * 0.8
    // 膝で吸収: 沈んだ量と沈む速さで腰が下がる。ウィリーでは体を後ろへ、登りの坂では前へ
    const sv = Math.max(0, (b.sv ? (b.sv[0] + b.sv[1]) / 2 : 0))
    this._kn = Math.max((this._kn || 0) * 0.86, Math.min(1, sv * 0.35))
    const crouch = Math.max(0, Math.min(1, (s.s[0] + s.s[1]) / (2 * P.travel) * 1.4 + this._kn * 0.6))
    const air = !b.g[0] && !b.g[1], wh = b.g[0] && !b.g[1] && s.th > 0.25
    const lean = Math.max(-1, Math.min(1, s.lean + (wh ? -0.35 : 0) + (!air && !wh ? Math.max(-0.3, Math.min(0.35, s.th * 0.9)) : 0)))
    // v32 カラスが当たった直後: 乗り手がのけぞる（0.7 秒。見た目だけ）
    const fk = this._flinch ? Math.max(0, 1 - (performance.now() - this._flinch) / 700) : 0
    if (!this.fly) this.pose(fk > 0 ? Math.max(-1, lean - 1.2 * Math.sin(fk * Math.PI)) : lean, crouch, air)
    if (this.nFill) { const n = Math.max(0.001, b.nitro ?? 1); this.nFill.scale.y = n; this.nFill.position.y = -0.16 * (1 - n); this.nFillM.emissiveIntensity = 0.5 + (b.nitroOn ? 1.2 : 0) }
    if (this.flame) {
      const on = !!b.nitroOn; this._fl = (this._fl || 0) + ((on ? 1 : 0) - (this._fl || 0)) * (on ? 0.5 : 0.25)
      this.flame.visible = this._fl > 0.02
      if (!this.flame.visible) this.flameLight.intensity = 0
      if (this.flame.visible) { const k = this._fl, j = 0.8 + Math.random() * 0.45; this.flameOut.scale.set(k * (0.9 + Math.random() * 0.2), k * j, k * (0.9 + Math.random() * 0.2)); this.flameIn.scale.set(k, k * (0.85 + Math.random() * 0.3), k); this.flameLight.intensity = 6 * k * j }
    }
    // v31: シーン直下の光を、ライトと炎の位置へ
    if (this.lampAt) { this.lampAt.updateWorldMatrix(true, false); this.lampAt.getWorldPosition(this.lampLight.position) }
    if (this.flameAt) { this.flameAt.updateWorldMatrix(true, false); this.flameAt.getWorldPosition(this.flameLight.position) }
  }
}
// 2本の骨の IK: A（付け根）→ B（関節）→ C（先）を、先が target に来るよう曲げる。pole は関節を向ける側
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3()
function aim(bone, childW, targetW) {
  const bw = bone.getWorldPosition(new THREE.Vector3())
  const from = childW.clone().sub(bw).normalize(), to = targetW.clone().sub(bw).normalize()
  const dq = new THREE.Quaternion().setFromUnitVectors(from, to)
  const wq = bone.getWorldQuaternion(new THREE.Quaternion()), pq = bone.parent.getWorldQuaternion(new THREE.Quaternion())
  bone.quaternion.copy(pq.invert().multiply(dq.multiply(wq)))
  bone.updateMatrixWorld(true)
}
function ik2(A, B, C, target, pole) {
  if (!A || !B || !C) return
  A.getWorldPosition(_a); B.getWorldPosition(_b); C.getWorldPosition(_c)
  const l1 = _a.distanceTo(_b), l2 = _b.distanceTo(_c)
  const d = target.clone().sub(_a), L = Math.max(0.05, Math.min(l1 + l2 - 0.002, d.length())), u = d.normalize()
  const cosA = Math.max(-1, Math.min(1, (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L))), sinA = Math.sqrt(1 - cosA * cosA)
  const pv = pole.clone().sub(_a); pv.sub(u.clone().multiplyScalar(pv.dot(u))).normalize()
  const bD = _a.clone().addScaledVector(u, l1 * cosA).addScaledVector(pv, l1 * sinA)
  aim(A, _b.clone(), bD)
  B.getWorldPosition(_b); C.getWorldPosition(_c)
  aim(B, _c.clone(), _a.clone().addScaledVector(u, L))
}
function placeTube(mesh, a, b) {
  const d = b.clone().sub(a), L = d.length()
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.divideScalar(L || 1))
  const base = mesh.userData.base || (mesh.userData.base = mesh.geometry.parameters.height)
  mesh.scale.set(1, L / base, 1)
}
function bodyPt(s, B, x, y) { return [s.p[0] + B.f[0] * x + B.u[0] * y, s.p[1] + B.f[1] * x + B.u[1] * y, s.p[2] + B.f[2] * x + B.u[2] * y] }
function mixState(a, b, t) {
  const L = (x, y) => x + (y - x) * t
  return { p: [L(a.p[0], b.p[0]), L(a.p[1], b.p[1]), L(a.p[2], b.p[2])], th: L(a.th, b.th), psi: L(a.psi, b.psi), lean: L(a.lean, b.lean), s: [L(a.s[0], b.s[0]), L(a.s[1], b.s[1])], delta: L(a.delta, b.delta), speed: b.speed, psiRate: b.psiRate }
}
// 転倒: 乗り手を車体から外して投げ出す（当たりは物理の世界の球で取る）
BikeView.prototype.throwRider = function (b, scene) {
  if (this.fly || !this.ready) return
  const r = this.rider
  r.updateWorldMatrix(true, false)
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3()
  r.matrixWorld.decompose(pos, q, sc)
  scene.add(r); r.position.copy(pos); r.quaternion.copy(q); r.scale.copy(sc)
  this.fly = { v: new THREE.Vector3(b.v[0] * 0.8, b.v[1] * 0.6 + 2.5, b.v[2] * 0.8), w: new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 3, -4 - Math.random() * 4), t: 0 }
}
BikeView.prototype.updateRider = function (dt, world) {
  const f = this.fly; if (!f) return
  const r = this.rider, R = 0.35
  f.t += dt; f.v.y -= 9.81 * dt
  r.position.addScaledVector(f.v, dt)
  const c = r.position.clone().add(V(0, 0.35, 0))
  const con = world.sphere(c.x, c.y, c.z, R, world.near(c.x, c.y, c.z, R + 0.5))
  if (con) {
    const n = V(...con.n), vn = f.v.dot(n)
    r.position.addScaledVector(n, con.depth)
    if (vn < 0) f.v.addScaledVector(n, -vn * 1.35)
    f.v.multiplyScalar(0.86); f.w.multiplyScalar(0.8)
  }
  const ang = f.w.length() * dt
  if (ang > 1e-5) r.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(f.w.clone().normalize(), ang))
}
BikeView.prototype.resetRider = function () {
  if (!this.fly) return
  this.fly = null
  const r = this.rider
  this.body.add(r); r.position.set(0, 0, 0); r.quaternion.identity(); r.scale.set(1, 1, 1)
}
export function snap(b) { return { p: b.p.slice(), th: b.th, psi: b.psi, lean: b.lean, s: b.s.slice(), delta: b.delta, speed: b.speed, psiRate: b.psiRate } }
