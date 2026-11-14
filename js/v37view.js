// SKY BIKE v37 の見た目: 明るい草原の浮き島（昼の空・揺れる草・同じ花が等間隔・縁で止まった霧の壁・動かない雲・錆びた古いトライアルバイク 3 台）・風車（塔・軸・帆）
// 真っ暗な通路は区間の明るさ（game.js ZONEP.tunnel）とヘッドライトで。光の数は変えない（月の光の色と強さを変えるだけ）
import * as THREE from 'three'
import { bladeAng } from './physics.js?v=48'

let seed = 37
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }

// 錆びた古いトライアルバイク（乗り手なし。草に半分埋まる）
export function rustyBike(M) {
  const g = new THREE.Group(), rust = new THREE.MeshStandardMaterial({ color: 0x6b3a22, roughness: 0.95, metalness: 0.35 }), dark = new THREE.MeshStandardMaterial({ color: 0x241c18, roughness: 1 })
  for (const x of [-0.71, 0.71]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 22), dark); tire.position.set(x, 0.33, 0); g.add(tire)
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 4, 18), rust); rim.position.set(x, 0.33, 0); g.add(rim)
    for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.54, 3), rust); sp.position.set(x, 0.33, 0); sp.rotation.z = k / 6 * Math.PI; g.add(sp) }
  }
  const tube = (a, b, r = 0.03) => { const v = new THREE.Vector3(b[0] - a[0], b[1] - a[1], 0), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, v.length(), 6), rust); m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0); m.rotation.z = Math.atan2(v.y, v.x) - Math.PI / 2; g.add(m) }
  tube([-0.71, 0.33], [-0.1, 0.62]); tube([-0.1, 0.62], [0.45, 0.85]); tube([0.45, 0.85], [0.71, 0.33]); tube([-0.1, 0.62], [-0.05, 0.3], 0.04); tube([0.45, 0.85], [0.5, 1.05], 0.025)
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.7, 5), rust); bar.rotation.x = Math.PI / 2; bar.position.set(0.5, 1.05, 0); g.add(bar)
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.22), new THREE.MeshStandardMaterial({ color: 0x5a2a1c, roughness: 0.8, metalness: 0.4 })); tank.position.set(0.15, 0.82, 0); tank.rotation.z = -0.2; g.add(tank)
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.16), dark); seat.position.set(-0.25, 0.8, 0); g.add(seat)
  const eng = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.26, 0.2), rust); eng.position.set(0.05, 0.42, 0); g.add(eng)
  g.traverse(o => { if (o.isMesh) o.castShadow = true })
  return g
}

export function buildV37(course, scene, M) {
  const group = new THREE.Group(); group.name = 'v37'; scene.add(group)
  const V = course.v37; if (!V) return { group, update() {}, meadowK: 0 }
  // ---------------- 草原の浮き島
  const md = V.meadow, f = [Math.cos(md.yaw), 0, -Math.sin(md.yaw)], r = [Math.sin(md.yaw), 0, Math.cos(md.yaw)]
  const len = Math.hypot(md.b[0] - md.a[0], md.b[2] - md.a[2]) + 40, ctr = [(md.a[0] + md.b[0]) / 2, Math.min(md.a[1], md.b[1]) - 0.35, (md.a[2] + md.b[2]) / 2], W = 34
  const groundM = new THREE.MeshStandardMaterial({ color: 0x6f9a48, roughness: 1 })
  const isl = new THREE.Mesh(new THREE.BoxGeometry(len, 6, W), groundM); isl.position.set(ctr[0], ctr[1] - 3, ctr[2]); isl.rotation.y = md.yaw; isl.receiveShadow = true; group.add(isl)
  const under = new THREE.Mesh(new THREE.ConeGeometry(W * 0.55, 30, 7), new THREE.MeshStandardMaterial({ color: 0x5c5248, roughness: 1 })); under.rotation.x = Math.PI; under.position.set(ctr[0], ctr[1] - 21, ctr[2]); group.add(under)
  // 揺れる草（細い板の束。頂点を時間で揺らす）
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x7fb050, roughness: 1, side: THREE.DoubleSide })
  const gU = { time: { value: 0 } }
  grassMat.onBeforeCompile = sh => { sh.uniforms.time = gU.time; sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n float sw = position.y * (0.18 + 0.08 * sin(time * 0.9 + instanceMatrix[3].x * 0.3)); transformed.x += sw * sin(time * 1.6 + instanceMatrix[3].z * 0.4); transformed.z += sw * 0.5 * cos(time * 1.3 + instanceMatrix[3].x * 0.2);').replace('#include <common>', '#include <common>\n uniform float time;') }
  const blade = new THREE.PlaneGeometry(0.08, 0.5, 1, 3); blade.translate(0, 0.25, 0)
  const NG = 2600, grass = new THREE.InstancedMesh(blade, grassMat, NG), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler()
  seed = 5; let gi = 0
  const roadNear = (x, z) => { const dx = x - ctr[0], dz = z - ctr[2], lat = dx * r[0] + dz * r[2]; return Math.abs(lat) < 3.2 }
  while (gi < NG) { const al = (rnd() - 0.5) * len, la = (rnd() - 0.5) * (W - 1), x = ctr[0] + f[0] * al + r[0] * la, z = ctr[2] + f[2] * al + r[2] * la; if (roadNear(x, z) && rnd() < 0.85) continue; e.set(0, rnd() * 6, (rnd() - 0.5) * 0.3); q.setFromEuler(e); const s = 0.6 + rnd() * 0.9; m4.compose(new THREE.Vector3(x, ctr[1] + 0.35, z), q, new THREE.Vector3(s, s, s)); grass.setMatrixAt(gi++, m4) }
  group.add(grass)
  // 同じ花が等間隔に（違和感 1）
  const flowerG = new THREE.Group(), stem = new THREE.CylinderGeometry(0.012, 0.012, 0.42, 4), petal = new THREE.SphereGeometry(0.07, 8, 6), stemM = new THREE.MeshStandardMaterial({ color: 0x4f7a34 }), petM = new THREE.MeshStandardMaterial({ color: 0xf0e6f4, emissive: 0x2a2030 })
  const NF = Math.floor(len / 3) * Math.floor(W / 3), fs = new THREE.InstancedMesh(stem, stemM, NF), fp = new THREE.InstancedMesh(petal, petM, NF); let fi = 0
  for (let al = -len / 2 + 1.5; al < len / 2; al += 3) for (let la = -W / 2 + 1.5; la < W / 2; la += 3) { if (Math.abs(la) < 3.4) continue; const x = ctr[0] + f[0] * al + r[0] * la, z = ctr[2] + f[2] * al + r[2] * la; m4.makeTranslation(x, ctr[1] + 0.56, z); fs.setMatrixAt(fi, m4); m4.makeTranslation(x, ctr[1] + 0.78, z); fp.setMatrixAt(fi, m4); fi++ }
  fs.count = fp.count = fi; flowerG.add(fs, fp); group.add(flowerG)
  // 縁で止まった霧の壁（違和感 2。動かない）
  const fogTex = canvasT(16, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(236,242,246,0)'); gr.addColorStop(0.55, 'rgba(236,242,246,0.45)'); gr.addColorStop(1, 'rgba(236,242,246,0.7)'); g.fillStyle = gr; g.fillRect(0, 0, w, h) })
  const fogM = new THREE.MeshBasicMaterial({ map: fogTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false })
  for (const [al, la, rot, wd] of [[0, W / 2 + 14, 0, len + 30], [0, -W / 2 - 14, 0, len + 30], [-len / 2 - 14, 0, Math.PI / 2, W + 30]]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(wd, 16), fogM); p.position.set(ctr[0] + f[0] * al + r[0] * la, ctr[1] - 2, ctr[2] + f[2] * al + r[2] * la); p.rotation.y = md.yaw + rot; group.add(p) }
  // 錆びた古いバイク 3 台（乗り手なし・字幕なし。当たりなし・道の外）
  const bikes = []
  for (const [al, la, rz, ry] of [[-len * 0.25, 6.5, 0.9, 0.4], [len * 0.02, -7.5, -1.2, 2.1], [len * 0.28, 7.2, 1.35, -0.6]]) { const bk = rustyBike(M), x = ctr[0] + f[0] * al + r[0] * la, z = ctr[2] + f[2] * al + r[2] * la; bk.position.set(x, ctr[1] + 0.25, z); bk.rotation.set(0, md.yaw + ry, rz); group.add(bk); bikes.push([x, ctr[1], z]) }
  // 草に隠れた穴のまわりは草を濃く（近づくまで穴が見えにくい）
  { const h = md.hole, NG2 = 260, g2 = new THREE.InstancedMesh(blade, grassMat, NG2); seed = 9; for (let k = 0; k < NG2; k++) { const al = -1.2 + rnd() * 4.4, la = (rnd() - 0.5) * 6, x = h[0] + f[0] * al + r[0] * la, z = h[2] + f[2] * al + r[2] * la; e.set(0, rnd() * 6, 0); q.setFromEuler(e); const s = 1.1 + rnd() * 0.5; m4.compose(new THREE.Vector3(x, h[1] - 0.15, z), q, new THREE.Vector3(s, s * 1.3, s)); g2.setMatrixAt(k, m4) } group.add(g2) }
  // 昼の空（草原にいる時だけ）: 青空と動かない雲（違和感 3）
  const skyTex = canvasT(512, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3f7fc8'); gr.addColorStop(0.5, '#86b8e0'); gr.addColorStop(0.62, '#b9d6ea'); gr.addColorStop(1, '#dbe7ee'); g.fillStyle = gr; g.fillRect(0, 0, w, h); seed = 3; for (let k = 0; k < 7; k++) { const x = rnd() * w, y = h * (0.28 + rnd() * 0.22), rx = 14 + rnd() * 22; for (let j = 0; j < 5; j++) { const gg = g.createRadialGradient(x + j * rx * 0.35, y + (rnd() - 0.5) * 5, 1, x + j * rx * 0.35, y, rx * 0.5); gg.addColorStop(0, 'rgba(255,255,255,0.75)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gg; g.fillRect(x - rx, y - rx, rx * 3, rx * 2) } } })
  const daySky = new THREE.Mesh(new THREE.SphereGeometry(950, 32, 16), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false, fog: false }))
  daySky.renderOrder = -1; daySky.visible = false; scene.add(daySky)
  // 遠くの風車（草原の向こう）と、乗れる風車の塔・帆
  const mills = []
  for (const n of course.notes.filter(n => n.kind === 'windmill')) {
    const g = new THREE.Group(); g.position.set(...n.hub); g.rotation.y = n.yaw; group.add(g)
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a7458, roughness: 0.95 }), cloth = new THREE.MeshStandardMaterial({ color: 0xe8e0cc, roughness: 1, side: THREE.DoubleSide, transparent: true, opacity: 0.92 })
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.4, 34, 10), new THREE.MeshStandardMaterial({ color: 0xc9c0b0, roughness: 0.95 })); tower.position.set(0, -17.5, -4.6); g.add(tower) // 塔は羽根の回る面の横（来る道の反対側）
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.8, 3.2, 10), new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.8 })); cap.position.set(0, 1.4, -4.6); g.add(cap)
    const hubM = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 4.4, 14), wood); hubM.rotation.x = Math.PI / 2; hubM.position.z = -2.4; g.add(hubM)
    const rot = new THREE.Group(); g.add(rot)
    for (let k = 0; k < 4; k++) { const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2; rot.add(arm)
      if (k > 0) { const pole = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.3, 0.3), wood); pole.position.x = 7.1; arm.add(pole) } // 乗れる羽根（k=0）は当たりの箱が見える
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(9.5, 2.4, 6, 1), cloth); sail.position.set(8, 0.15, k === 0 ? -1.75 : 0); sail.rotation.x = Math.PI / 2; arm.add(sail) }
    mills.push({ n, rot })
  }
  return {
    group, daySky, bikes, meadowK: 0,
    update(dt, tm, cam, world, zone) {
      gU.time.value = tm
      for (const ml of mills) { const a = bladeAng(ml.n.blades[0].mov, world.time).a; ml.rot.rotation.z = a }
      const want = zone === 'meadow' ? 1 : 0
      this.meadowK += Math.max(-dt / 2.5, Math.min(dt / 2.5, want - this.meadowK)) // 2.5 秒でなめらかに
      daySky.visible = this.meadowK > 0.01; daySky.material.opacity = this.meadowK; daySky.position.copy(cam)
    },
  }
}
