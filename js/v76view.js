// SKY BIKE v76 押す石と門・ローラーの巻き上げ機の見た目（当たりのある形は js/v76.js。石・ボタン・門の板そのものは view.js の動く形として描かれる）
// ここで足すのは当たりのない物だけ: 床の溝・ボタンの枠・鎖と滑車・石と門の鉄の帯・ローラー（回る）・タイヤの跡・巻き上げ機の歯車・落とし格子の鉄格子
import * as THREE from 'three'
import { PA, PB } from './v76.js?v=76'

function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
// ローラーの面: 錆びた鉄に、真ん中だけ黒いタイヤの跡。筒に沿った傷（回っているのが見える）
const rollerTex = () => canvasT(256, 128, (g, w, h) => {
  g.fillStyle = '#8d8a82'; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + Math.random() * 50 | 0},${60 + Math.random() * 30 | 0},${40 + Math.random() * 20 | 0},${0.12 + Math.random() * 0.2})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 9, 1 + Math.random() * 3) }
  for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(20,18,15,0.55)'; g.fillRect(0, k * h / 6 + 2, w, 2) } // 筒に沿った溝
  const gr = g.createLinearGradient(w * 0.3, 0, w * 0.7, 0); gr.addColorStop(0, 'rgba(8,8,8,0)'); gr.addColorStop(0.25, 'rgba(8,8,8,0.9)'); gr.addColorStop(0.75, 'rgba(8,8,8,0.9)'); gr.addColorStop(1, 'rgba(8,8,8,0)')
  g.fillStyle = gr; g.fillRect(w * 0.3, 0, w * 0.4, h)
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,60,58,0.5)'; g.fillRect(w * 0.36 + Math.random() * w * 0.28, Math.random() * h, 1, 3 + Math.random() * 8) }
})
// 床のタイヤの跡（ローラーの前後に伸びる黒い筋。透けた板）
const streakTex = () => canvasT(64, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(6,6,6,0)'); gr.addColorStop(0.3, 'rgba(6,6,6,0.8)'); gr.addColorStop(0.62, 'rgba(6,6,6,0.85)'); gr.addColorStop(1, 'rgba(6,6,6,0)'); g.fillStyle = gr
  for (const [x, ww] of [[10, 5], [18, 28], [49, 5]]) g.fillRect(x, 0, ww, h) // 太い 1 本（何度も空転させた跡）と、ずれた細い筋
  for (let i = 0; i < 140; i++) { g.clearRect(8 + Math.random() * 48, Math.random() * h, 1 + Math.random() * 2, 2 + Math.random() * 6) }
})

export function buildV76(course, scene, M) {
  const group = new THREE.Group(); group.name = 'v76'; scene.add(group)
  const V = course.v76
  if (!V || (!V.A && !V.B)) return { group, update() {}, onEv() {} }
  const iron = (M.iron || new THREE.MeshStandardMaterial({ color: 0x2a2825, metalness: 0.7, roughness: 0.55 })), chainMat = M.chain || iron, rust = M.rust || iron, girder = M.girder || iron
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e0d0b, roughness: 0.95, metalness: 0.1 })
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1); unitCyl.translate(0, 0.5, 0)
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)
  const span = (m, a, b) => { _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _d.subVectors(_b, _a); const L = _d.length(); m.position.copy(_a); m.scale.y = Math.max(0.001, L); m.quaternion.setFromUnitVectors(_up, _d.normalize()) }
  const rod = (r, mat = chainMat) => { const m = new THREE.Mesh(unitCyl, mat); m.scale.set(r, 1, r); m.castShadow = true; group.add(m); return m }
  const box = (sx, sy, sz, mat, parent = group) => { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m }
  // 道の向きにそろえた入れ物（x = 前、z = 右）
  const frame = (p, yaw, parent = group) => { const g = new THREE.Group(); g.position.set(p[0], p[1], p[2]); g.rotation.y = yaw; parent.add(g); return g }
  // たるむ鎖（a → b を n 本の短い棒で。sag は真ん中の下がり）
  const sagChain = (n, r) => { const segs = []; for (let k = 0; k < n; k++) segs.push(rod(r)); return (a, b, sag, wob = 0) => { let prev = a; for (let k = 1; k <= n; k++) { const u = k / n, p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u - sag * 4 * u * (1 - u) + wob * Math.sin(u * Math.PI * 3), a[2] + (b[2] - a[2]) * u]; span(segs[k - 1], prev, p); prev = p } } }
  const upd = []
  const evs = { wRoll: -9, pbPress: -9 }

  // ---------------- A 押す石と門
  if (V.A) {
    const G = V.A, d = course.decor.find(x => x.kind === 'v76A'), [bl, bh, bw] = PA.block
    // 床の溝（石が滑る 2 本の筋）と、溝の端の止め
    { const a = d.rail[0], L = Math.hypot(d.rail[1][0] - a[0], d.rail[1][2] - a[2]), fr = frame([a[0], G.y0, a[2]], G.yaw)
      for (const sg of [-1, 1]) { const m = box(L, 0.012, 0.09, dark, fr); m.position.set(L / 2, 0.007, sg * d.railLat); m.castShadow = false }
      const e = box(0.1, 0.012, bw - 0.2, dark, fr); e.position.set(L, 0.007, 0); e.castShadow = false }
    // ボタンの枠（鉄の縁。板そのものは動く形）
    { const fr = frame([d.plate[0], G.y0, d.plate[2]], G.yaw), L = d.plateL + 0.16, W = d.plateW + 0.16
      for (const sg of [-1, 1]) { box(L, 0.03, 0.08, iron, fr).position.set(0, 0.012, sg * W / 2); box(0.08, 0.03, W, iron, fr).position.set(sg * L / 2, 0.012, 0) } }
    // 石の鉄の帯（石と一緒に動く）
    const bands = frame(G.block.c, G.yaw)
    for (const sg of [-1, 1]) box(0.09, bh + 0.02, bw + 0.02, iron, bands).position.set(sg * (bl / 2 - 0.16), 0, 0)
    for (const sg of [-1, 1]) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.022, 6, 12), iron); ring.position.set(0, 0.05, sg * (bw / 2 + 0.012)); ring.rotation.y = Math.PI / 2; bands.add(ring) }
    // 門の板の鉄の帯と下端の鉄の縁（板と一緒に上下する。当たりの外形の内側）
    const gb = frame(G.gate.c, G.yaw), gw = G.w + 0.3
    box(PA.th + 0.02, 0.16, gw + 0.01, iron, gb).position.set(0, -PA.Hs / 2 + 0.08, 0)
    for (const y of [-0.55, 0.55]) box(PA.th + 0.02, 0.1, gw + 0.01, iron, gb).position.set(0, y, 0)
    for (let k = -3; k <= 3; k++) for (const y of [-0.55, 0.55, -PA.Hs / 2 + 0.08]) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), iron); s.position.set(-PA.th / 2 - 0.012, y, k * gw / 7.4); gb.add(s) }
    // 鎖: ボタンの脇の柱 → 門の柱の上の滑車 → 門の板の上の角。踏まれていない時はたるみ、踏むと張る
    const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), iron); pulley.position.set(...d.chainB); pulley.rotation.y = G.yaw; group.add(pulley)
    { const eye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 6, 10), iron); eye.position.set(...d.chainA); eye.rotation.y = G.yaw; group.add(eye) }
    const long = sagChain(12, 0.03), drop = rod(0.03)
    const slabTopAt = () => [G.gate.c[0] - G.R[0] * (gw / 2 - 0.12) - G.f[0] * 0.3, G.gate.c[1] + PA.Hs / 2, G.gate.c[2] - G.R[2] * (gw / 2 - 0.12) - G.f[2] * 0.3]
    upd.push((dt, t) => {
      bands.position.set(G.block.c[0], G.block.c[1], G.block.c[2])
      gb.position.set(G.gate.c[0], G.gate.c[1], G.gate.c[2])
      const tw = Math.max(0, 1 - (t - evs.pbPress) * 2.5) // 踏んだ瞬間に鎖が震える
      long(d.chainA, d.chainB, 0.12 + 1.5 * (1 - G.k), 0.05 * tw * Math.sin(t * 40))
      pulley.rotation.x = -G.h * 4
      const st = slabTopAt(); span(drop, st, [d.chainB[0], Math.max(st[1] + 0.02, d.chainB[1] - 0.2), d.chainB[2]])
    })
  }

  // ---------------- B ローラーの巻き上げ機と落とし格子
  if (V.B) {
    const G = V.B, d = course.decor.find(x => x.kind === 'v76B'), y0 = G.y0
    const fr = frame([G.c[0], y0, G.c[2]], G.yaw)
    // ローラー 2 本（当たりの円柱と同じ場所・同じ太さ。回る）
    const rt = rollerTex(); rt.wrapS = rt.wrapT = THREE.RepeatWrapping
    const rmat = new THREE.MeshStandardMaterial({ map: rt, metalness: 0.55, roughness: 0.6 })
    const rg = new THREE.CylinderGeometry(d.rollR, d.rollR, d.rollLen, 20, 1); rg.rotateX(Math.PI / 2) // 軸を z（右）へ
    const rollers = [-1, 1].map(sg => { const m = new THREE.Mesh(rg, rmat); m.position.set(sg * d.rollGap / 2, d.rollY, 0); m.castShadow = true; m.receiveShadow = true; fr.add(m); return m })
    // ローラーのまわりの鉄の枠（床に埋めた受け）と、軸が巻き上げ機へ伸びる所
    { const L = d.rollGap + 2 * d.rollR + 0.24, W = d.rollLen + 0.24
      for (const sg of [-1, 1]) { box(L, 0.02, 0.1, iron, fr).position.set(0, 0.008, sg * W / 2); box(0.1, 0.02, W, iron, fr).position.set(sg * (L / 2 - 0.05), 0.008, 0) }
      for (const sg of [-1, 1]) { const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), iron); ax.rotation.x = Math.PI / 2; ax.position.set(sg * d.rollGap / 2, 0.02, d.rollLen / 2 + 0.55); fr.add(ax) } }
    // 床のタイヤの跡（ローラーの手前と先に伸びる黒い筋）
    { const st = streakTex(), sm = new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
      const pg = new THREE.PlaneGeometry(0.62, 4.6); pg.rotateX(-Math.PI / 2); pg.rotateY(Math.PI / 2)
      const p = new THREE.Mesh(pg, sm); p.position.set(-0.5, 0.022, 0); p.renderOrder = 2; fr.add(p) }
    // 巻き上げ機: 箱（当たりあり）の上に、歯止めの歯車と鎖の胴
    const wf = frame(d.winch, G.yaw)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 14), rust); drum.rotation.x = Math.PI / 2; drum.position.set(0, 0.3, 0); drum.castShadow = true; wf.add(drum)
    const cogG = new THREE.Group(); cogG.position.set(0, 0.3, 0.3); wf.add(cogG)
    { const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 18), iron); disc.rotation.x = Math.PI / 2; cogG.add(disc)
      for (let k = 0; k < PB.notch; k++) { const a = k / PB.notch * Math.PI * 2, t = box(0.09, 0.12, 0.07, iron, cogG); t.position.set(Math.cos(a) * 0.38, Math.sin(a) * 0.38, 0); t.rotation.z = a - 0.5 } }
    const pawl = box(0.3, 0.05, 0.06, iron, wf); pawl.position.set(-0.36, 0.72, 0.3)
    for (const sg of [-1, 1]) { const st = box(0.08, 0.7, 0.08, girder, wf); st.position.set(0, 0.05, sg * 0.36) }
    // 落とし格子（鉄格子。当たりの板と同じ外形・同じ動き）
    const gr = frame(G.grate.c, G.yaw), gw = G.grate.h[2] * 2, gh = PB.Hs
    { const bar = new THREE.CylinderGeometry(0.035, 0.035, gh, 6)
      const n = Math.round(gw / 0.3); for (let k = 0; k <= n; k++) { const m = new THREE.Mesh(bar, iron); m.position.set(0, 0, -gw / 2 + gw * k / n); m.castShadow = true; gr.add(m) }
      for (const y of [-gh / 2 + 0.06, -gh / 6, gh / 6, gh / 2 - 0.06]) box(PB.th, 0.11, gw, iron, gr).position.set(0, y, 0) }
    // 鎖: 巻き上げ機 → 柱の上の滑車 → 格子の上
    const pulley = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 6, 14), iron); pulley.position.set(...d.pulley); pulley.rotation.y = G.yaw; group.add(pulley)
    const up = sagChain(10, 0.03), drop = rod(0.03)
    const wTop = [d.winch[0], d.winch[1] + 0.56, d.winch[2]]
    let jig = 0
    upd.push((dt, t) => {
      const tw = Math.max(0, 1 - (t - evs.wRoll) * 1.6), w = tw * Math.sin((t - evs.wRoll) * 26) // 通った時: ローラーが少し回って戻り、鎖が一瞬だけ震える
      jig = 0.35 * w
      const a = -(G.turn || 0) / d.rollR
      rollers[0].rotation.z = a - jig; rollers[1].rotation.z = a - jig
      const wa = -G.prog * Math.PI * 2 * 2.5; drum.rotation.y = wa; cogG.rotation.z = wa
      pawl.rotation.z = -0.25 + 0.2 * Math.abs(Math.sin(G.prog * PB.notch * Math.PI))
      gr.position.set(G.grate.c[0], G.grate.c[1], G.grate.c[2])
      up(wTop, d.pulley, 0.25 * (1 - Math.min(1, G.prog * 6)) + 0.03, 0.06 * w + (G.spin > 0 ? 0.012 * Math.sin(t * 60) : 0))
      pulley.rotation.x = wa
      const gt = [G.grate.c[0] + G.R[0] * (gw / 2 - 0.1) - G.f[0] * 0.3, G.grate.c[1] + gh / 2, G.grate.c[2] + G.R[2] * (gw / 2 - 0.1) - G.f[2] * 0.3]
      span(drop, gt, [d.pulley[0], Math.max(gt[1] + 0.02, d.pulley[1] - 0.2), d.pulley[2]])
    })
  }
  return {
    group,
    onEv(e, t) { if (e.t === 'wRoll') evs.wRoll = t; if (e.t === 'pbPress') evs.pbPress = t },
    update(dt, world) { const t = world ? world.time : 0; for (const f of upd) f(dt, t) },
  }
}
