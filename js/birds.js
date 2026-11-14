// SKY BIKE v22 道に止まっているカラス。バイクが近づく（速いほど遠くから）と羽音を立てて飛び立ち、空へ散っていく。
// 当たり判定なし（見た目と音だけ）。出し直したら、また止まっている。
// 絵: Crow（Poly by Google・CC BY 3.0）を止まっている姿に、飛ぶ時は体を前へ倒して羽を 2 枚（翼の形の板）足して羽ばたかせる。
// 全部の鳥を 1 つの InstancedMesh でまとめて描き、カメラから遠い群れ（130m 超）は描かない。
import { strikerSpot } from './strike.js?v=46'
import * as THREE from 'three'

const FAR = 130
// 道の上・縁に群れを置く所を選ぶ（決まった並び。区間に偏らないよう、道の長さで等間隔に近く・ふつうの道の点だけ）
export function birdSpots(course, n = 22) {
  const P = course.path, ok = []
  const BAD = new Set(['blade', 'drum', 'dark', 'narrow', 'jump', 'lip', 'gap', 'stepUp', 'stepDown', 'hang', 'lift', 'glift', 'slide', 'spin', 'seesaw', 'draw', 'crumble', 'trap', 'water', 'mud', 'fork', 'forkRide', 'gear', 'swing', 'chimney', 'kick', 'groove', 'peg', 'bump', 'uturn'])
  for (let i = 20; i < P.length - 20 - (course.v37added || 0); i++) { const q = P[i]; if (q.p && !q.branch && q.w >= 2.6 && !BAD.has(q.kind) && Math.abs(q.slope || 0) < 0.12) ok.push(i) }
  const out = []
  let sd = 4242
  const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
  for (let k = 0; k < n; k++) {
    const want = Math.floor((k + 0.5) / n * ok.length + (rr() - 0.5) * ok.length / n * 0.6)
    const i = ok[Math.max(0, Math.min(ok.length - 1, want))], q = P[i]
    const R = [Math.sin(q.yaw), 0, Math.cos(q.yaw)], side = rr() < 0.5 ? -1 : 1
    const count = rr() < 0.3 ? 1 : 2 + Math.floor(rr() * 4) // 1 羽か、2〜5 羽の群れ
    const lat = side * (q.w / 2 - 0.45) * (0.4 + rr() * 0.6) // 道の端寄り
    const birds = []
    for (let j = 0; j < count; j++) birds.push({ off: [(rr() - 0.5) * 1.6, (rr() - 0.5) * 0.9], yaw: q.yaw + Math.PI / 2 + (rr() - 0.5) * 2.4, ph: rr() * 10 })
    out.push({ p: [q.p[0] + R[0] * lat, q.p[1], q.p[2] + R[2] * lat], yaw: q.yaw, birds, i })
  }
  return out
}

// 翼（片側）: 付け根から先へ細くなる羽の板。x が体の横、z が前後
function wingGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0.06); s.lineTo(0.16, 0.07); s.lineTo(0.34, 0.03); s.lineTo(0.42, -0.04); s.lineTo(0.36, -0.07); s.lineTo(0.3, -0.05); s.lineTo(0.27, -0.09); s.lineTo(0.2, -0.07); s.lineTo(0.16, -0.11); s.lineTo(0.09, -0.08); s.lineTo(0, -0.07)
  const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2) // 水平な板（y が上）
  return g
}

// 道の真ん中に居座る群れ: 本道の半分あたりから先で、手前 16m がまっすぐ平らな道の所（向かってくるのが見えて、止まれる）
function blockerSpot(course) {
  const P = course.path, n0 = Math.floor((P.length - (course.v37added || 0)) * 0.47) // v37 で足した終盤は数えない
  const flat = q => q && q.p && !q.branch && q.w >= 3 && ['road', 'orbit', 'pad', 'landing'].includes(q.kind) && Math.abs(q.slope || 0) < 0.08 && Math.abs(q.curv || 0) < 0.02
  for (let i = n0; i < P.length - 10; i++) {
    let ok = true; for (let k = i - 16; k <= i + 4; k++) if (!flat(P[k])) { ok = false; break }
    if (!ok) continue
    const q = P[i], birds = []
    let sd = 777; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
    for (let j = 0; j < 6; j++) birds.push({ off: [(rr() - 0.5) * 1.8, (rr() - 0.5) * Math.min(2.4, q.w - 1)], yaw: q.yaw + Math.PI + (rr() - 0.5) * 1.6, ph: rr() * 10 })
    return { p: q.p.slice(), yaw: q.yaw, birds, i, block: true }
  }
  return null
}

export class Birds {
  constructor(scene, course) {
    this.scene = scene; this.flocks = birdSpots(course); this.time = 0; this.events = []
    // v28: 中盤の道の真ん中に、近づいても飛ばない群れ（6 羽）。クラクションで飛ぶ（game.js）
    this.blocker = blockerSpot(course)
    if (this.blocker) this.flocks.push(this.blocker)
    this.striker = strikerSpot(course); if (this.striker) this.striker.birds = [{ off: [0, 0], yaw: this.striker.yaw, ph: 0 }]
    if (this.striker) this.flocks.push(this.striker)
    this.total = this.flocks.reduce((a, f) => a + f.birds.length, 0)
    this.ready = false
    this.reset()
  }
  async load(url) {
    const { GLTFLoader } = await import('../vendor/jsm/loaders/GLTFLoader.js')
    const gl = await new GLTFLoader().loadAsync(url)
    let mesh = null; gl.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o })
    if (!mesh) return
    const geo = mesh.geometry.clone()
    geo.computeBoundingBox()
    const bb = geo.boundingBox, h = bb.max.y - bb.min.y, s = 0.42 / h // 高さ 42cm のカラス
    // 足の下を原点・前（くちばし）を +x に（道の向きの約束）
    geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); geo.scale(s, s, s)
    geo.rotateY(this.frontRot ?? Math.PI / 2)
    const mat = mesh.material.clone(); mat.side = THREE.FrontSide
    this.body = new THREE.InstancedMesh(geo, mat, this.total); this.body.name = 'birds'
    this.body.frustumCulled = false; this.body.castShadow = false; this.body.receiveShadow = false
    const wmat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.85, side: THREE.DoubleSide })
    this.wings = new THREE.InstancedMesh(wingGeo(), wmat, this.total * 2); this.wings.name = 'birdWings'; this.wings.frustumCulled = false
    this.scene.add(this.body, this.wings)
    this.ready = true
  }
  // 止まっている姿へ戻す（出し直し・コースの読み直し）
  reset() {
    for (const f of this.flocks) { f.state = f.strike ? 'wait' : 'perch'; f.t = 0; for (const b of f.birds) { b.pos = [f.p[0] + Math.cos(f.yaw) * b.off[0] + Math.sin(f.yaw) * b.off[1], f.p[1], f.p[2] - Math.sin(f.yaw) * b.off[0] + Math.cos(f.yaw) * b.off[1]]; b.vel = [0, 0, 0]; b.fy = b.yaw; b.hop = 0 } }
  }
  // 群れを飛び立たせる（クラクション。from: 鳴らした所）
  flush(f, from) {
    if (f.state !== 'perch') return
    f.state = 'fly'; f.t = 0
    for (const b of f.birds) { const ax = b.pos[0] - from[0], az = b.pos[2] - from[2], al = Math.hypot(ax, az) || 1, sp = 3 + Math.random() * 2.5, a = Math.atan2(az / al, ax / al) + (Math.random() - 0.5) * 1.6; b.vel = [Math.cos(a) * sp, 2.8 + Math.random() * 1.8, Math.sin(a) * sp]; b.delay = Math.random() * 0.25; b.fy = Math.atan2(-b.vel[2], b.vel[0]) }
  }
  // 体当たりの 1 羽: from から to へ dur 秒でまっすぐ飛ぶ。当たったら strikeHit で、はじかれて落ちていく
  strikeStart(from, to, dur) { const f = this.striker; if (!f || f.state !== 'wait') return; f.state = 'fly'; f.t = 0; f.hit = false; const b = f.birds[0]; b.pos = from.slice(); b.vel = [(to[0] - from[0]) / dur, (to[1] - from[1]) / dur, (to[2] - from[2]) / dur]; b.delay = 0; b.fy = Math.atan2(-b.vel[2], b.vel[0]); b.spin = 0 }
  strikeHit(hx, hz) { const f = this.striker; if (!f || f.state !== 'fly') return null; f.hit = true; const b = f.birds[0]; b.vel = [-b.vel[0] * 0.25 + hx * 2, 3.2, -b.vel[2] * 0.25 + hz * 2]; return b.pos.slice() }
  dispose() { if (this.body) this.scene.remove(this.body, this.wings) }
  // bike: { p, speed }。cam: カメラの位置。返り: 飛び立った群れ（音を鳴らすため）
  update(dt, bike, cam) {
    this.time += dt
    const ev = []
    if (bike) for (const f of this.flocks) {
      if (f.state !== 'perch' || f.block || f.strike) continue // 居座る群れは近づいても飛ばない（クラクションで飛ぶ）
      const d = Math.hypot(bike.p[0] - f.p[0], bike.p[2] - f.p[2]), dy = Math.abs(bike.p[1] - 0.8 - f.p[1])
      const R = 4 + Math.min(14, Math.max(0, bike.speed) * 0.75) // 速いほど遠くから気づく
      if (d < R && dy < 4) {
        f.state = 'fly'; f.t = 0
        for (const b of f.birds) {
          // バイクから離れる向き＋上へ。少しずつ遅れて飛び立つ
          const ax = b.pos[0] - bike.p[0], az = b.pos[2] - bike.p[2], al = Math.hypot(ax, az) || 1, sp = 3 + Math.random() * 2.5
          const a = Math.atan2(az / al, ax / al) + (Math.random() - 0.5) * 1.4
          b.vel = [Math.cos(a) * sp, 2.6 + Math.random() * 1.8, Math.sin(a) * sp]; b.delay = Math.random() * 0.35; b.fy = Math.atan2(-b.vel[2], b.vel[0])
        }
        ev.push({ t: 'flush', p: f.p.slice(), n: f.birds.length, d })
      }
    }
    for (const f of this.flocks) if (f.state === 'fly') {
      f.t += dt
      for (const b of f.birds) { if (f.t < b.delay) continue; if (!f.strike || f.hit) b.vel[1] += (f.hit ? -4 : 1.6) * dt; if (f.hit) b.spin = (b.spin || 0) + dt * 9; for (let k = 0; k < 3; k++) b.pos[k] += b.vel[k] * dt }
      if (f.t > 9) f.state = 'gone'
    }
    if (!this.ready) return ev
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), sc = new THREE.Vector3(1, 1, 1), zero = new THREE.Vector3(0, 0, 0), pos = new THREE.Vector3()
    let k = 0, kw = 0
    const hide = () => m.compose(pos.set(0, -9999, 0), q.identity(), zero)
    for (const f of this.flocks) {
      const far = !cam || Math.hypot(cam.x - f.p[0], cam.z - f.p[2]) > FAR
      for (const b of f.birds) {
        if (far || f.state === 'gone' || f.state === 'wait') { hide(); this.body.setMatrixAt(k++, m); this.wings.setMatrixAt(kw++, m); this.wings.setMatrixAt(kw++, m); continue }
        const tt = this.time + b.ph
        if (f.state === 'perch' || f.t < b.delay) {
          // 止まっている: ときどき首を振る・向きを変える・小さく跳ねる
          const look = Math.sin(tt * 0.9) > 0.85 ? 0.5 : 0
          const hop = Math.max(0, Math.sin(tt * 1.7) - 0.97) * 3
          e.set(Math.sin(tt * 6) * 0.04 * look, b.yaw + Math.sin(tt * 0.37) * 0.4 + look, 0); q.setFromEuler(e)
          m.compose(pos.set(b.pos[0], b.pos[1] + hop * 0.12, b.pos[2]), q, sc); this.body.setMatrixAt(k++, m)
          hide(); this.wings.setMatrixAt(kw++, m); this.wings.setMatrixAt(kw++, m)
          continue
        }
        // 飛んでいる: 体を前へ倒し、進む向きを向いて、翼を速く羽ばたかせる
        const ft = f.t - b.delay, fl = Math.sin(tt * 26 + ft * 4) * (0.9 - Math.min(0.4, ft * 0.08))
        e.set(f.hit ? (b.spin || 0) : 0, b.fy, f.hit ? (b.spin || 0) * 0.7 : -0.25 - Math.min(0.35, ft * 0.6)); q.setFromEuler(e)
        pos.set(b.pos[0], b.pos[1] + 0.12, b.pos[2])
        m.compose(pos, q, sc); this.body.setMatrixAt(k++, m)
        for (const side of [-1, 1]) {
          const wq = new THREE.Quaternion().setFromEuler(new THREE.Euler(side * fl, 0, 0, 'XYZ'))
          const wm = new THREE.Matrix4().compose(new THREE.Vector3(0.04, 0.2, side * 0.05), wq, new THREE.Vector3(1, 1, side))
          const bm = new THREE.Matrix4().compose(pos, q, sc)
          // 翼の板は x が体の横なので、体の向き（+x が前）に合わせて 90 度回す
          const rot = new THREE.Matrix4().makeRotationY(-Math.PI / 2)
          m.multiplyMatrices(bm, wm).multiply(rot); this.wings.setMatrixAt(kw++, m)
        }
      }
    }
    this.body.instanceMatrix.needsUpdate = true; this.wings.instanceMatrix.needsUpdate = true
    return ev
  }
}
