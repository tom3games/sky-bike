// 仕掛けの見た目: 振り子の鉄球の鎖・跳ね橋の鎖・湧き水の流れと滝としぶき・落石の予兆（小石と影）・突風の雪煙・セーブの旗。
// 当たりは physics.js（同じデータ）。ここは見せるだけ。update は音を鳴らすための出来事を返す
import * as THREE from 'three'
import { dropState, hingeAng, gustK, bridgePose, shuttlePos } from './physics.js?v=17'

let seed = 11
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }

// 黄ばんで色あせた布（しみ・ほつれ・破れた端）
function flagTexture() {
  return canvasT(128, 80, (g, w, h) => {
    seed = 21
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#b3a26a'); gr.addColorStop(1, '#8c7a48')
    g.fillStyle = gr; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(${70 + rnd() * 40},${55 + rnd() * 30},${25 + rnd() * 20},${0.08 + rnd() * 0.12})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2) }
    for (let i = 0; i < 7; i++) { const x = rnd() * w, y = rnd() * h, r = 4 + rnd() * 12; const sg = g.createRadialGradient(x, y, 0, x, y, r); sg.addColorStop(0, 'rgba(80,60,26,0.32)'); sg.addColorStop(1, 'rgba(80,60,26,0)'); g.fillStyle = sg; g.fillRect(x - r, y - r, r * 2, r * 2) }
    g.strokeStyle = 'rgba(90,70,36,0.55)'; g.lineWidth = 2; g.strokeRect(6, 6, w - 30, h - 12)
    // 端の破れ（向こう側の端を不揃いに切る）
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(w, 0)
    for (let y = 0; y <= h; y += 4) g.lineTo(w - 4 - rnd() * 20 * (y % 12 < 6 ? 1 : 0.4), y)
    g.lineTo(w, h); g.fill()
    for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(w * 0.3 + rnd() * w * 0.6, rnd() * h, 1.5 + rnd() * 3.5, 0, 7); g.fill() }
  })
}
// 水の面（波紋の筋）。流れる向きに動かす
function waterTexture() {
  return canvasT(128, 128, (g, w, h) => {
    seed = 31
    g.fillStyle = '#3d625e'; g.fillRect(0, 0, w, h)
    for (let i = 0; i < 160; i++) { const x = rnd() * w, y = rnd() * h, L = 8 + rnd() * 30; g.strokeStyle = `rgba(${150 + rnd() * 60},${190 + rnd() * 40},${190 + rnd() * 40},${0.18 + rnd() * 0.4})`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (rnd() - 0.5) * 8, y + L / 2, x + (rnd() - 0.5) * 6, y + L); g.stroke() }
  })
}

function points(scene, N, color, size, additive) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), al = new Float32Array(N)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { col: { value: new THREE.Color(color) }, sz: { value: size } },
    vertexShader: 'attribute float alpha; varying float vA; uniform float sz; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = sz * 120.0 / -mv.z + 1.5; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 col; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(col, vA * (1.0 - d * 1.6)); }',
  })
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
  const P = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, g: 9.8, fade: 1 }))
  let k = 0
  return {
    obj: pts,
    emit(p, v, spread, g = 9.8, fade = 1) { const q = P[k = (k + 1) % N]; q.p.set(p[0], p[1], p[2]); q.v.set(v[0] + (Math.random() - 0.5) * spread, v[1] + (Math.random() - 0.5) * spread, v[2] + (Math.random() - 0.5) * spread); q.life = 1; q.g = g; q.fade = fade },
    update(dt) {
      for (let i = 0; i < N; i++) { const q = P[i]; if (q.life > 0) { q.life -= dt * q.fade; q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt) } pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; al[i] = Math.max(0, q.life) }
      geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true
    },
  }
}

export function buildGimmicks(course, scene, M) {
  const group = new THREE.Group(); group.name = 'gimmicks'; scene.add(group)
  const chainMat = (M.chain || new THREE.MeshStandardMaterial({ color: 0x5a4a40, metalness: 0.8, roughness: 0.6 })).clone()
  if (chainMat.map) { chainMat.map = chainMat.map.clone(); chainMat.map.needsUpdate = true }
  const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6, 1); unitCyl.translate(0, 0.5, 0)
  const rods = []
  const rod = (r) => { const m = new THREE.Mesh(unitCyl, chainMat); m.scale.set(r, 1, r); m.castShadow = true; group.add(m); rods.push(m); return m }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)
  const span = (m, a, b) => { _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _d.subVectors(_b, _a); const L = _d.length(); m.position.copy(_a); m.scale.y = L; m.quaternion.setFromUnitVectors(_up, _d.normalize()) }

  // 振り子の鎖（支点 → 鉄球の上）と、支点の金具
  const pends = course.decor.filter(d => d.kind === 'pendChain').map(d => {
    const m = rod(0.05)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 12), chainMat); ring.position.set(...d.pivot); group.add(ring)
    return { d, m }
  })
  // 跳ね橋の鎖（柱の上 → 板の手前の端）
  const draws = course.decor.filter(d => d.kind === 'drawChain').map(d => ({ d, m: rod(0.04) }))

  // 動く床の通り道の印（鉄のレール）と、上下する床を吊る鎖
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6a5a4c, metalness: 0.7, roughness: 0.5 })
  for (const d of course.decor) if (d.kind === 'rail') { const m = new THREE.Mesh(unitCyl, railMat); m.castShadow = true; span(m, d.a, d.b); m.scale.x = m.scale.z = 0.07; group.add(m) }
  const lchains = course.decor.filter(d => d.kind === 'liftChain').map(d => ({ d, m: rod(0.04) }))
  // 湧き水: 道の板の上に薄い水の面（外へ流れる）＋外の縁から落ちる滝＋塔の壁の湧き口のしぶき
  const wTex = waterTexture(); wTex.wrapS = wTex.wrapT = THREE.RepeatWrapping
  const waterMat = new THREE.MeshStandardMaterial({ map: wTex, color: 0xc4e4de, emissive: 0x1e3634, roughness: 0.04, metalness: 0.25, transparent: true, opacity: 0.94, depthWrite: false, side: THREE.DoubleSide })
  const fallTex = wTex.clone(); fallTex.needsUpdate = true; fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping
  const fallMat = new THREE.MeshStandardMaterial({ map: fallTex, color: 0x9ab4b0, roughness: 0.2, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide })
  const waters = []
  for (const wv of course.waters || []) {
    if (wv.box) { // まっすぐな水路（箱の道の上の水の面）。流れる向きに模様を動かす
      const s = wv.box, tx = wTex.clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(s.h[2] * 2 / 2.4, s.h[0] * 2 / 2.4)
      const mat = waterMat.clone(); mat.map = tx
      const g = new THREE.PlaneGeometry(s.h[0] * 2, s.h[2] * 2); g.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(g, mat); mesh.name = 'water'; mesh.renderOrder = 2
      const m4 = new THREE.Matrix4().makeBasis(new THREE.Vector3(...s.ax[0]), new THREE.Vector3(...s.ax[1]), new THREE.Vector3(...s.ax[2])); mesh.quaternion.setFromRotationMatrix(m4)
      mesh.position.set(s.c[0] + s.ax[1][0] * (s.h[1] + 0.035), s.c[1] + s.ax[1][1] * (s.h[1] + 0.035), s.c[2] + s.ax[1][2] * (s.h[1] + 0.035)); group.add(mesh)
      waters.push({ s: null, box: s, tex: tx, dir: 'x', sp: wv.u < 0 ? -0.6 : 0.6, center: s.c })
      continue
    }
    const s = wv.arc; if (!s) continue
    const n = 24, pos = [], uv = [], idx = [], fpos = [], fuv = [], fidx = []
    for (let i = 0; i <= n; i++) {
      const ph = s.phi0 + (s.phi1 - s.phi0) * i / n, y = s.y0 + s.b * (ph - s.phi0) + 0.035
      for (const [j, r] of [[0, s.r1 + 0.02], [1, s.r2 - 0.02]]) { pos.push(s.cx + r * Math.cos(ph), y, s.cz - r * Math.sin(ph)); uv.push((ph - s.phi0) * s.r2 / 2.4, j * (s.r2 - s.r1) / 2.4) }
      // 滝: 外の縁から 7m 下へ、少し外へ広がる
      for (const [j, dy, dr] of [[0, 0, 0], [1, -7, 0.9]]) { const r = s.r2 + 0.05 + dr; fpos.push(s.cx + r * Math.cos(ph), y + dy, s.cz - r * Math.sin(ph)); fuv.push((ph - s.phi0) * s.r2 / 2.4, j * 2.4) }
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); fidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals()
    const mesh = new THREE.Mesh(g, waterMat); mesh.receiveShadow = true; mesh.renderOrder = 2; mesh.name = 'water'; group.add(mesh)
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2)); fg.setIndex(fidx); fg.computeVertexNormals()
    const fall = new THREE.Mesh(fg, fallMat); fall.renderOrder = 2; fall.name = 'water'; group.add(fall)
    // 塔の壁の割れ目から噴き出す水（内側の縁に沿った薄い幕）
    { const sp = [], su = [], si = [], m2 = 10
      for (let i = 0; i <= m2; i++) { const ph = s.phi0 + (s.phi1 - s.phi0) * (0.2 + 0.6 * i / m2), y = s.y0 + s.b * (ph - s.phi0); for (const [j, dy, dr] of [[0, 1.5, 0.02], [1, 0.03, 0.3]]) { const r = s.r1 + dr; sp.push(s.cx + r * Math.cos(ph), y + dy, s.cz - r * Math.sin(ph)); su.push(i / m2 * 2, j * 1.4) } if (i < m2) { const a = i * 2; si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) } }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(su, 2)); g2.setIndex(si); g2.computeVertexNormals()
      const spout = new THREE.Mesh(g2, fallMat); spout.renderOrder = 2; spout.name = 'water'; group.add(spout) }
    const mid = (s.phi0 + s.phi1) / 2, ym = s.y0 + s.b * (mid - s.phi0)
    if (wv.tan) { const tx = wTex.clone(); tx.needsUpdate = true; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.rotation = Math.PI / 2; const mat = waterMat.clone(); mat.map = tx; mesh.material = mat; fall.visible = false; waters.push({ s, tex: tx, dir: 'tan', sp: 0.7 * wv.tan, center: [s.cx + (s.r1 + s.r2) / 2 * Math.cos(mid), ym, s.cz - (s.r1 + s.r2) / 2 * Math.sin(mid)] }) }
    else waters.push({ s, center: [s.cx + (s.r1 + s.r2) / 2 * Math.cos(mid), ym, s.cz - (s.r1 + s.r2) / 2 * Math.sin(mid)] })
  }
  const spray = points(scene, 260, 0xc9dcd8, 0.5, false)

  // 落石: 落ちる場所の影（予兆の間に濃くなる）と、上から降る小石
  const shadowTex = canvasT(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64) })
  const rocks = (course.hazards || []).filter(h => h.kind === 'rock').map(h => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0 }))
    m.rotation.x = -Math.PI / 2; m.position.set(h.p[0], h.p[1] + 0.04, h.p[2]); m.renderOrder = 3; group.add(m)
    return { h, m, was: null }
  })
  const pebbles = points(scene, 160, 0x4a463e, 0.35, false)
  const dustP = points(scene, 160, 0x7a746a, 1.6, false)

  // 突風: 横へ流れる雪煙の筋
  const gusts = (course.winds || []).filter(g => g.pulse)
  const streak = points(scene, 220, 0xdfe6e8, 0.28, true)

  // セーブの旗（竿は当たりの円柱。布は竿の上から風下へなびく）
  const fTex = flagTexture()
  const flags = (course.flags || []).map(f => {
    const geo = new THREE.PlaneGeometry(1.25, 0.78, 14, 6); geo.translate(0.625, -0.39, 0)
    const base = Float32Array.from(geo.attributes.position.array)
    const mat = new THREE.MeshStandardMaterial({ map: fTex, color: 0xd8c896, roughness: 0.95, side: THREE.DoubleSide, transparent: true, alphaTest: 0.4, emissive: 0x2a2410 })
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = true
    mesh.position.set(f.p[0], f.p[1] + f.h - 0.08, f.p[2])
    mesh.rotation.y = f.yaw + Math.PI // 道の向きと逆へなびく（向こうから来る風）
    group.add(mesh)
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), M.gold || chainMat); cap.position.set(f.p[0], f.p[1] + f.h + 0.05, f.p[2]); group.add(cap)
    return { f, mesh, geo, base, lit: 0, phase: f.p[0] * 0.3 + f.p[2] * 0.17 }
  })

  // 燃料の缶（ニトロ）: 赤い金属の携行缶と青い光の輪。拾うと消えて 25 秒で戻る
  const canGeo = new THREE.BoxGeometry(0.26, 0.36, 0.14), capGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 10)
  const canMat = new THREE.MeshStandardMaterial({ color: 0x9a2a1e, roughness: 0.45, metalness: 0.6 }), ringMat = new THREE.MeshBasicMaterial({ color: 0x5fb8ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
  const cans = (course.cans || []).map(cn => {
    const g = new THREE.Group(); g.name = 'pickup'; g.position.set(cn.p[0], cn.p[1] + 0.45, cn.p[2]) // 拾う物（当たりなし。ghostwall は数えない）
    const body = new THREE.Mesh(canGeo, canMat); body.castShadow = true; g.add(body)
    const cap = new THREE.Mesh(capGeo, M.gold || canMat); cap.position.set(0.07, 0.21, 0); g.add(cap)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 32), ringMat); ring.rotation.x = Math.PI / 2; ring.position.y = -0.4; g.add(ring)
    const lt = new THREE.PointLight(0x5fb8ff, 3, 5, 2); lt.position.y = 0.2; g.add(lt)
    group.add(g); return { cn, g }
  })
  // 前輪を掛ける縁: 角に欠けかけた石の並び（見た目だけ）
  for (const d of (course.decor || []).filter(d => d.kind === 'hangLip')) {
    const ax = [d.b[0] - d.a[0], d.b[1] - d.a[1], d.b[2] - d.a[2]], L = Math.hypot(...ax), n = Math.max(2, Math.round(L / 0.45))
    for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11 + rnd() * 0.06, 0), M.rock || canMat); st.position.set(d.a[0] + ax[0] * u + d.n[0] * 0.05, d.a[1] + ax[1] * u - 0.05, d.a[2] + ax[2] * u + d.n[2] * 0.05); st.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3); st.castShadow = true; group.add(st) }
  }
  const v16 = buildV16(course, group, M, chainMat, unitCyl)
  const tmpC = new THREE.Color(), dim = new THREE.Color(0xd8c896), bright = new THREE.Color(0xfff0b4)
  return {
    group, objs: [group, spray.obj, pebbles.obj, dustP.obj, streak.obj],
    // 出来事: { t: 'rockWarn'|'rockFall'|'rockHit'|'splash'|'save', p }
    update(world, bike, dt, tm, R, camPos) {
      const out = []
      const T = world.time
      for (const { d, m } of pends) { const c = d.ball.c; span(m, d.pivot, [c[0], c[1] + d.ball.r * 0.9, c[2]]) }
      for (const { d, m } of lchains) { const s = d.shape, ax = s.ax, h = s.h; span(m, d.top, [0, 1, 2].map(k => s.c[k] + ax[2][k] * d.sg * (h[2] + 0.2) + ax[1][k] * h[1])) }
      for (const { d, m } of draws) {
        const s = d.shape, ax = s.ax, h = s.h
        // 鎖は板の横の金具（道の幅の外）に掛ける。通る所に当たりのない鎖を通さない
        const end = [0, 1, 2].map(k => s.c[k] - ax[0][k] * (h[0] - 0.15) + ax[2][k] * d.sg * (h[2] + 0.45) + ax[1][k] * h[1])
        span(m, d.top, end)
      }
      // 水
      wTex.offset.y = -tm * 0.55; fallTex.offset.y = tm * 1.6
      for (const w of waters) if (w.tex) { if (w.dir === 'x') w.tex.offset.y = tm * w.sp; else w.tex.offset.x = -tm * w.sp }
      let nearW = 1e9
      for (const w of waters) {
        const dx = camPos.x - w.center[0], dy = camPos.y - w.center[1], dz = camPos.z - w.center[2]; nearW = Math.min(nearW, Math.sqrt(dx * dx + dy * dy + dz * dz))
        if (nearW < 60 && w.s && !w.tex && Math.random() < dt * 30) {
          const s = w.s, ph = s.phi0 + (s.phi1 - s.phi0) * Math.random(), y = s.y0 + s.b * (ph - s.phi0)
          // 塔の壁の湧き口から噴き出す水と、外の縁で砕けるしぶき
          spray.emit([s.cx + (s.r1 + 0.1) * Math.cos(ph), y + 0.5 + Math.random() * 0.6, s.cz - (s.r1 + 0.1) * Math.sin(ph)], [Math.cos(ph) * 1.6, 0.6, -Math.sin(ph) * 1.6], 0.6, 6, 1.4)
          spray.emit([s.cx + (s.r2 + 0.2) * Math.cos(ph), y - 0.2 - Math.random() * 4, s.cz - (s.r2 + 0.2) * Math.sin(ph)], [Math.cos(ph) * 0.8, 0.4, -Math.sin(ph) * 0.8], 1.2, 4, 1.2)
        }
      }
      this.nearWater = nearW
      if (bike) {
        let inW = false
        for (let i = 0; i < 2; i++) { const cn = bike.cn[i]; if (!cn) continue; const sh = world.shapes[cn.id]; if (sh.flowR || sh.flow) { inW = true; if (Math.abs(bike.speed) > 0.5 && Math.random() < dt * 40) spray.emit([cn.q[0], cn.q[1] + 0.05, cn.q[2]], [bike.v[0] * 0.3, 1.6 + Math.abs(bike.speed) * 0.25, bike.v[2] * 0.3], 1.4, 9, 1.6) } }
        if (inW && !this.inW) { out.push({ t: 'splash', p: bike.p.slice() }); for (let k = 0; k < 24; k++) spray.emit([bike.p[0], bike.p[1] - 0.6, bike.p[2]], [0, 2.4, 0], 2.4, 9, 1.4) }
        this.inW = inW
      }
      spray.update(dt)
      // 落石
      for (const r of rocks) {
        const st = dropState(r.h.m, T), sh = r.h.rock
        const phase = !st.hidden ? 'fall' : st.warn > 0 ? 'warn' : 'idle'
        const vis = st.hidden ? st.warn : 1
        r.m.material.opacity = Math.min(0.85, vis * 0.85); const sc = 0.6 + vis * 1.4; r.m.scale.set(sc, sc, 1)
        if (phase === 'warn' && Math.random() < dt * 22) pebbles.emit([r.h.p[0] + (Math.random() - 0.5) * 1.2, r.h.p[1] + r.h.m.hd + 0.6, r.h.p[2] + (Math.random() - 0.5) * 1.2], [0, -1, 0], 0.4, 9.8, 0.7)
        if (phase === 'warn' && r.was === 'idle') out.push({ t: 'rockWarn', p: r.h.p })
        if (phase === 'fall' && r.was !== 'fall') out.push({ t: 'rockFall', p: r.h.p })
        if (phase !== 'fall' && r.was === 'fall') { out.push({ t: 'rockHit', p: r.h.p }); for (let k = 0; k < 30; k++) dustP.emit([sh.c[0], r.h.p[1] + 0.3, sh.c[2]], [0, 1.2, 0], 3.2, 1.5, 0.8); for (let k = 0; k < 16; k++) pebbles.emit([sh.c[0], r.h.p[1] + 0.4, sh.c[2]], [0, 3.5, 0], 4.5, 9.8, 0.9) }
        r.was = phase
      }
      pebbles.update(dt); dustP.update(dt)
      // 突風
      let gustNear = 0
      for (const g of gusts) {
        const k = gustK(g, T)
        const inside = camPos.x > g.min[0] - 25 && camPos.x < g.max[0] + 25 && camPos.z > g.min[2] - 25 && camPos.z < g.max[2] + 25 && Math.abs(camPos.y - (g.min[1] + g.max[1]) / 2) < 25
        if (!inside) continue
        if (bike && bike.p[0] > g.min[0] && bike.p[0] < g.max[0] && bike.p[2] > g.min[2] && bike.p[2] < g.max[2] && bike.p[1] > g.min[1] && bike.p[1] < g.max[1]) gustNear = Math.max(gustNear, k)
        const L = Math.hypot(g.f[0], g.f[2]) || 1, fx = g.f[0] / L, fz = g.f[2] / L
        // 予兆: 吹く少し前から雪が流れ始める
        const pre = gustK({ ...g, ph: g.ph + 0.5 }, T)
        const rate = (k + pre * 0.4) * 160
        for (let n = 0; n < rate * dt; n++) {
          const x = g.min[0] + Math.random() * (g.max[0] - g.min[0]), z = g.min[2] + Math.random() * (g.max[2] - g.min[2]), y = g.min[1] + 0.8 + Math.random() * 3
          streak.emit([x - fx * 6, y, z - fz * 6], [fx * (9 + k * 10), 0.3, fz * (9 + k * 10)], 1.2, 0, 1.3)
        }
      }
      this.gust = gustNear
      streak.update(dt)
      for (const c of cans) { const gone = c.cn.t != null && T - c.cn.t < 25 && T >= c.cn.t; c.g.visible = !gone; if (!gone) c.g.rotation.y = tm * 1.4 }
      // 旗: なびき（布の端ほど大きく揺れる）。通った旗は明るくなる
      for (const fl of flags) {
        const reached = R && R.rest != null && fl.f.cp <= R.rest && (R.restSeen || {})[fl.f.cp]
        fl.lit += ((reached ? 1 : 0) - fl.lit) * Math.min(1, dt * 2.5)
        tmpC.copy(dim).lerp(bright, fl.lit); fl.mesh.material.color.copy(tmpC); fl.mesh.material.emissive.setRGB(0.165 + fl.lit * 0.2, 0.14 + fl.lit * 0.15, 0.06 + fl.lit * 0.03)
        const P = fl.geo.attributes.position, b = fl.base
        for (let i = 0; i < P.count; i++) { const x = b[i * 3], y = b[i * 3 + 1], k = x / 1.25; P.setZ(i, Math.sin(tm * 4.2 + x * 3.1 + fl.phase) * 0.12 * k + Math.sin(tm * 2.3 + y * 4 + fl.phase) * 0.05 * k); P.setY(i, y - k * k * 0.12) }
        P.needsUpdate = true; fl.geo.computeVertexNormals()
      }
      v16.update(world, bike, dt, tm, camPos, out)
      return out
    },
  }
}

// ============================================================ v16 の仕掛けの見た目（当たりは physics.js。歯は歯車の円の外の側面だけで、上の面より下）
function buildV16(course, group, M, chainMat, unitCyl) {
  const d16 = (course.decor || [])
  const iron = M.iron || chainMat, rust = M.rust || chainMat, girder = M.girder || chainMat, edge = M.edgesteel || iron
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0)
  const span = (m, a, b, r) => { _a.set(a[0], a[1], a[2]); _b.set(b[0], b[1], b[2]); _d.subVectors(_b, _a); const L = _d.length() || 1e-3; m.position.copy(_a); m.scale.set(r, L, r); m.quaternion.setFromUnitVectors(_up, _d.normalize()) }
  const rod = (r, mat = chainMat) => { const m = new THREE.Mesh(unitCyl, mat); m.castShadow = true; m.userData.r = r; group.add(m); return m }
  const snd = () => (typeof Snd !== 'undefined' ? Snd : null)
  // ---- 歯車: 側面の歯（上の面より 0.12 下まで）・上の面の放射状の帯（面に貼るだけ）・中心の軸。円板と一緒に回す
  const gears = d16.filter(d => d.kind === 'gear').map(d => {
    const g = new THREE.Group(); g.position.set(d.c[0], d.c[1], d.c[2]); group.add(g)
    // 円板の上の面と下の面（当たりの円柱と同じ。側面はコースのメッシュ）
    const topG = new THREE.CircleGeometry(d.R, 64); topG.rotateX(-Math.PI / 2)
    { const uv = topG.attributes.uv, P = topG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, P.getX(i) / 2.4, P.getZ(i) / 2.4) }
    const top = new THREE.Mesh(topG, M.grate || rust); top.receiveShadow = true; g.add(top)
    const bot = new THREE.Mesh(topG, rust); bot.rotation.x = Math.PI; bot.position.y = -d.thick; g.add(bot)
    const nT = Math.max(16, Math.round(d.R * 2 * Math.PI / 0.42)), th = Math.min(0.55, d.thick - 0.14)
    const tg = new THREE.BoxGeometry(0.24, th, 0.22), tm = new THREE.InstancedMesh(tg, iron, nT); tm.castShadow = true
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), ps = new THREE.Vector3()
    for (let k = 0; k < nT; k++) { const a = k / nT * Math.PI * 2; ps.set(Math.cos(a) * (d.R + 0.1), -0.14 - th / 2, -Math.sin(a) * (d.R + 0.1)); q.setFromAxisAngle(_up, a); m4.compose(ps, q, sc); tm.setMatrixAt(k, m4) }
    g.add(tm)
    // 上の面の帯（6 本の太い帯と輪。面から 5mm 上。回っているのが見える）
    const bandMat = new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.5, metalness: 0.7 })
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(d.R * 0.82, 0.01, 0.34), bandMat); b.position.set(Math.cos(a) * d.R * 0.5, 0.005, -Math.sin(a) * d.R * 0.5); b.rotation.y = a; b.receiveShadow = true; g.add(b) }
    const ring = new THREE.Mesh(new THREE.RingGeometry(d.R - 0.32, d.R - 0.14, 48), bandMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.006; g.add(ring)
    const hub = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), edge); hub.rotation.x = -Math.PI / 2; hub.position.y = 0.007; g.add(hub)
    return { d, g }
  })
  // ---- 揺れる吊り橋: 板の両端の下の鎖（板と一緒に動く）・柱の上から垂れる主の鎖（道の幅の外）と吊り鎖
  const bridges = d16.filter(d => d.kind === 'swingBridge').map(d => {
    const br = d.br, n = br.planks.length, edgeL = [], edgeR = [], hang = []
    for (let i = 0; i < n - 1; i++) { edgeL.push(rod(0.03)); edgeR.push(rod(0.03)) }
    const mainL = [], mainR = []; const NS = 12
    for (let i = 0; i < NS; i++) { mainL.push(rod(0.045)); mainR.push(rod(0.045)) }
    for (let i = 2; i < n - 2; i += 4) hang.push({ i, L: rod(0.02), R: rod(0.02) })
    return { br, edgeL, edgeR, mainL, mainR, hang }
  })
  // ---- 倒れる煙突: 鉄の帯（面から 2cm）と、上の口の暗い穴。煙突の形と一緒に動かす
  const chims = d16.filter(d => d.kind === 'chimney').map(d => {
    const g = new THREE.Group(); g.matrixAutoUpdate = false; group.add(g)
    const sootMat = new THREE.MeshStandardMaterial({ color: 0x0c0b0a, roughness: 1 })
    for (let k = 1; k < 5; k++) { const x = -d.L / 2 + d.L * k / 5, b = new THREE.Mesh(new THREE.BoxGeometry(0.16, d.T + 0.04, d.W + 0.04), rust); b.position.set(x, 0, 0); b.castShadow = true; g.add(b) }
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(d.T * 0.7, d.W * 0.7), sootMat); hole.position.set(d.L / 2 + 0.01, 0, 0); hole.rotation.y = Math.PI / 2; g.add(hole)
    const lip = new THREE.Mesh(new THREE.BoxGeometry(0.3, d.T + 0.12, d.W + 0.12), M.castle || rust); lip.position.set(d.L / 2 - 0.15, 0, 0); g.add(lip)
    return { d, g, was: null }
  })
  // ---- 跳ね板: 板の下のバネ（穴の底から板の裏まで伸び縮み）
  const kicks = d16.filter(d => d.kind === 'kick').map(d => {
    const sh = d.shape, springs = []
    for (const a of [-0.3, 0.3]) for (const l of [-0.33, 0.33]) springs.push({ a, l, m: rod(0.12, edge) })
    return { d, sh, springs, was: null }
  })
  // ---- 道を選ぶ床: 床の両脇の鎖止め（見た目の金具。床より下）
  const forks = d16.filter(d => d.kind === 'forkPlat').map(d => ({ d, was: null }))
  const _m = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3()
  let gearSnd = 0
  return {
    update(world, bike, dt, tm, camPos, out) {
      const T = world.time, S = snd()
      for (const { d, g } of gears) g.rotation.y = d.rate * T
      // 歯車の近くでは機械のうなり（録音のループ。近いほど大きい）
      if (S && gears.length) { let dm = 1e9; for (const { d } of gears) dm = Math.min(dm, Math.hypot(camPos.x - d.c[0], camPos.y - d.c[1], camPos.z - d.c[2])); const v = Math.max(0, 1 - dm / 30) * 0.35; if (v > 0.01 && !gearSnd) { S.loop('gear16', 'snd/machine.mp3', v, 0.6); gearSnd = 1 } else if (v <= 0.01 && gearSnd) { S.loop('gear16', null); gearSnd = 0 } else if (gearSnd && S.loops.gear16 && S.loops.gear16.g) S.loops.gear16.g.gain.value = v }
      for (const b of bridges) {
        const br = b.br, P = br.planks, R = br.R
        const edgeAt = (sh, sg, dy) => [sh.c[0] + sh.ax[0][0] * 0 + sh.ax[2][0] * sg * (sh.h[2] - 0.08) - sh.ax[1][0] * (sh.h[1] + dy), sh.c[1] + sh.ax[2][1] * sg * (sh.h[2] - 0.08) - sh.ax[1][1] * (sh.h[1] + dy), sh.c[2] + sh.ax[2][2] * sg * (sh.h[2] - 0.08) - sh.ax[1][2] * (sh.h[1] + dy)]
        for (let i = 0; i < P.length - 1; i++) { span(b.edgeL[i], edgeAt(P[i], -1, 0.05), edgeAt(P[i + 1], -1, 0.05), 0.03); span(b.edgeR[i], edgeAt(P[i], 1, 0.05), edgeAt(P[i + 1], 1, 0.05), 0.03) }
        // 主の鎖: 柱の上（道の幅の外 1m）から、橋の真ん中で道より 1.3m 上まで垂れる。横揺れに合わせて少し揺れる
        const top = 2.5, low = 1.3, off = br.W / 2 + 1.0
        for (const [arr, sg] of [[b.mainL, -1], [b.mainR, 1]]) {
          let prev = null
          for (let i = 0; i <= arr.length; i++) {
            const u = i / arr.length, s0 = u * br.L, st = bridgePose(br, s0, T), sagY = top - (top - low) * Math.sin(Math.PI * u)
            const p = [br.p0[0] + br.f[0] * s0 + R[0] * (sg * off + st.lat * 0.5), br.p0[1] + sagY, br.p0[2] + br.f[2] * s0 + R[2] * (sg * off + st.lat * 0.5)]
            if (prev) span(arr[i - 1], prev, p, 0.045); prev = p
          }
        }
        for (const h of b.hang) { const sh = P[h.i], u = h.i / P.length, s0 = u * br.L, st = bridgePose(br, s0, T), y = br.p0[1] + top - (top - low) * Math.sin(Math.PI * u)
          for (const [m, sg] of [[h.L, -1], [h.R, 1]]) { const lo = [sh.c[0] + R[0] * sg * (br.W / 2 + 0.45), sh.c[1] - 0.05, sh.c[2] + R[2] * sg * (br.W / 2 + 0.45)], hi = [br.p0[0] + br.f[0] * s0 + R[0] * (sg * off + st.lat * 0.5), y, br.p0[2] + br.f[2] * s0 + R[2] * (sg * off + st.lat * 0.5)]; span(m, lo, hi, 0.02) } }
        // 乗った時・大きくあおられた時のきしみ（録音）
        if (S) { const on = br.on; if (on && !b.wasOn) S.play('chain', { vol: 0.6 }); b.wasOn = on; const big = br.tJolt && br.tOn != null && T - br.tOn > br.tJolt; if (big && !b.wasBig) { S.play('creak', { vol: 0.9 }); S.play('chain', { vol: 0.8, rate: 0.8 }) } b.wasBig = big }
      }
      for (const c of chims) {
        const s = c.d.shape; _m.makeBasis(_x.set(...s.ax[0]), _y.set(...s.ax[1]), _z.set(...s.ax[2])); _m.setPosition(s.c[0], s.c[1], s.c[2]); c.g.matrix.copy(_m); c.g.matrixWorldNeedsUpdate = true
        const st = s.mov.trig == null ? 'up' : (s.mov.aNow > s.mov.aEnd + 1e-3 ? (s.mov.wNow < 0 ? 'fall' : 'rise') : 'down')
        if (S && st !== c.was) { const v = Math.max(0, 1 - Math.hypot(camPos.x - s.c[0], camPos.y - s.c[1], camPos.z - s.c[2]) / 50); if (st === 'fall') { S.play('crack', { vol: v }); S.play('rumble', { vol: v * 0.9 }) } if (st === 'down') S.play('rockbreak', { vol: v * 0.8 }); if (st === 'rise') S.play('rumble', { vol: v * 0.4, rate: 0.8 }) }
        c.was = st
      }
      for (const k of kicks) {
        const s = k.sh, f = s.ax[0], rt = s.ax[2], c0 = s.base.c
        for (const sp of k.springs) { const x = sp.a * s.h[0] * 2, z = sp.l * s.h[2] * 2, top = [s.c[0] + f[0] * x + rt[0] * z, s.c[1] - s.h[1], s.c[2] + f[2] * x + rt[2] * z], bot = [c0[0] + f[0] * x + rt[0] * z, c0[1] - 0.73, c0[2] + f[2] * x + rt[2] * z]; span(sp.m, bot, top, 0.12) }
        const st = s.mov.trig != null
        if (S && st && !k.was) { S.play('spring', { vol: 1 }); S.play('clank', { vol: 0.7, rate: 0.9 }) }
        k.was = st
      }
      for (const fk of forks) { const st = shuttlePos(fk.d.fork.mov, T).at, moving = st === 'up' || st === 'down'; if (S && moving !== fk.was && fk.was != null) { const p = fk.d.fork.mid, v = Math.max(0, 1 - Math.hypot(camPos.x - p[0], camPos.y - p[1], camPos.z - p[2]) / 40); if (v > 0) S.play(moving ? 'chain' : 'clank', { vol: v * 0.7 }) } fk.was = moving }
    },
  }
}
