// SKY BIKE v51 の見た目: 黄色いレーザーの床（道の両脇の鉄の柱と、その間の黄色い光の線。光を切ると消え、床が戻ってまた光る）と、
// 爆発で消える床の火の玉（光源は足さない＝光の数を変えない。光る板だけ）
import * as THREE from 'three'

export function buildV51(course, scene) {
  const group = new THREE.Group(); group.name = 'v51'; scene.add(group)
  const iron = new THREE.MeshStandardMaterial({ color: 0x2c2a26, roughness: 0.6, metalness: 0.7 })
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd23a, toneMapped: false })
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 16; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 16); gr.addColorStop(0, 'rgba(255,210,60,0)'); gr.addColorStop(0.5, 'rgba(255,210,60,1)'); gr.addColorStop(1, 'rgba(255,210,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 16); const t = new THREE.CanvasTexture(cv); return t })()
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
  const lasers = []
  for (const d of (course.decor || []).filter(x => x.kind === 'laser')) {
    const r = [-d.f[2], 0, d.f[0]], g = new THREE.Group(); group.add(g)
    const yaw = Math.atan2(-d.f[2], d.f[0])
    for (const sg of [-1, 1]) { // 道の両脇の柱と、光の出る口
      const p = [d.beam[0] + r[0] * sg * (d.w / 2 + 0.18), d.beam[1], d.beam[2] + r[2] * sg * (d.w / 2 + 0.18)]
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.9, 0.14), iron); post.position.set(p[0], p[1] + 0.45 - 0.05, p[2]); post.rotation.y = yaw; post.castShadow = true; g.add(post)
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.06), beamMat); eye.position.set(p[0] - r[0] * sg * 0.08, d.beam[1] + d.h, p[2] - r[2] * sg * 0.08); eye.rotation.y = yaw; g.add(eye)
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, d.w + 0.2), beamMat); beam.position.set(d.beam[0], d.beam[1] + d.h, d.beam[2]); beam.rotation.y = yaw; g.add(beam)
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(d.w + 0.2, 0.16), glowMat); glow.position.copy(beam.position); glow.rotation.y = yaw + Math.PI / 2; g.add(glow)
    const glow2 = glow.clone(); glow2.rotation.x = Math.PI / 2; glow2.rotation.y = 0; glow2.rotation.z = yaw + Math.PI / 2; g.add(glow2)
    lasers.push({ d, beam, glow, glow2 })
  }
  // 爆発の火の玉（光る板 2 枚）
  const fireTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,230,1)'); gr.addColorStop(0.3, 'rgba(255,170,60,0.9)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); x.clearRect(0, 0, 128, 128); x.fillStyle = gr; x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill(); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.premultiplyAlpha = true; return t })() // 円の外は透明（四角い縁を出さない）
  const fire = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, blending: THREE.AdditiveBlending, premultipliedAlpha: true, depthWrite: false, transparent: true, opacity: 0, toneMapped: false })); fire.visible = false; group.add(fire)
  const smoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, color: 0x2a2826, depthWrite: false, transparent: true, opacity: 0 })); smoke.visible = false; group.add(smoke)
  // 谷底から吹き上げる風: 吹いている間（gustK）だけ、下から白い霧の粒が速く上がる
  const winds = []
  for (const d of (course.decor || []).filter(x => x.kind === 'valleyWind')) {
    const g = d.g, n = 140, pos = new Float32Array(n * 3), seed = []
    for (let k = 0; k < n; k++) { const r = [Math.random(), Math.random(), Math.random()]; seed.push(r); pos[k * 3] = g.min[0] + (g.max[0] - g.min[0]) * r[0]; pos[k * 3 + 1] = g.min[1] - 4 + (g.max[1] - g.min[1] + 4) * r[1]; pos[k * 3 + 2] = g.min[2] + (g.max[2] - g.min[2]) * r[2] }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xdfe8e6, size: 0.35, transparent: true, opacity: 0, depthWrite: false })); pts.frustumCulled = false; group.add(pts)
    winds.push({ g, pts, pos, seed, y0: g.min[1] - 4, H: g.max[1] - g.min[1] + 4 })
  }
  const gustK = (g, t) => { const v = Math.sin(t * g.w + g.ph); return v > 0.55 ? (v - 0.55) / 0.45 : 0 }
  let bt = -1, bp = null
  return {
    group,
    blast(p) { bt = 0; bp = p },
    update(dt, world, cam) {
      const t = world.time
      for (const L of lasers) { const m = L.d.spike.mov, on = m.t0 == null, flick = on ? 0.85 + 0.15 * Math.sin(t * 37 + L.d.beam[0]) : 0
        const near = !cam || Math.hypot(L.d.beam[0] - cam.x, L.d.beam[2] - cam.z) < 200
        L.beam.visible = on && near; L.glow.visible = L.glow2.visible = on && near; L.glow.material.opacity = 0.55 * flick }
      for (const W of winds) { const k = gustK(W.g, t), near = !cam || (cam.x > W.g.min[0] - 60 && cam.x < W.g.max[0] + 60 && cam.z > W.g.min[2] - 60 && cam.z < W.g.max[2] + 60); W.pts.visible = near; if (!near) continue
        W.pts.material.opacity = 0.15 + 0.55 * k; for (let i = 0; i < W.seed.length; i++) { const r = W.seed[i]; r[1] = (r[1] + dt * (0.05 + 0.6 * k) * (0.6 + r[0] * 0.8)) % 1; W.pos[i * 3 + 1] = W.y0 + W.H * r[1] } W.pts.geometry.attributes.position.needsUpdate = true }
      if (bt >= 0 && bp) { bt += dt; const s1 = 1.5 + 6 * Math.min(1, bt / 0.15), s2 = 2.5 + 6 * Math.min(1, bt / 1.4)
        fire.visible = bt < 0.6; fire.position.set(bp[0], bp[1] + 0.8 + bt * 2, bp[2]); fire.scale.set(s1, s1, 1); fire.material.opacity = Math.max(0, 1 - bt / 0.6)
        smoke.visible = bt < 2.4; smoke.position.set(bp[0], bp[1] + 1.2 + bt * 1.3, bp[2]); smoke.scale.set(s2, s2, 1); smoke.material.opacity = Math.min(0.7, bt * 3) * Math.max(0, 1 - bt / 2.4)
        if (bt > 2.5) bt = -1 }
    },
  }
}
