// SKY BIKE v36 の見た目: 鉄骨の影・油だまりと倒れた樽・プレス機・小さな猿のような生き物。当たりは physics.js / run.js（ここは見せるだけ）
import * as THREE from 'three'
import { clone as skClone } from '../vendor/jsm/utils/SkeletonUtils.js'
import { girderPose } from './physics.js?v=38'
import { pathS, CHASE } from './run.js?v=38'

let seed = 36
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
// ぼけた影（真ん中が濃い楕円）
const shadowTex = () => canvasT(128, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(0,0,0,0.95)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.setTransform(1, 0, 0, 0.5, 0, h / 4); g.fillStyle = gr; g.fillRect(0, 0, w, w) })
// 油: 黒く光る、縁が不揃いな広がり（虹色の筋が少し）
const oilTex = () => canvasT(256, 256, (g, w, h) => {
  seed = 61; g.clearRect(0, 0, w, h)
  g.fillStyle = 'rgba(6,6,8,0.96)'; g.beginPath()
  for (let a = 0; a <= 64; a++) { const t = a / 64 * Math.PI * 2, r = w * (0.36 + 0.1 * Math.sin(t * 3 + 1) + 0.05 * Math.sin(t * 7) + rnd() * 0.03); const x = w / 2 + Math.cos(t) * r, y = h / 2 + Math.sin(t) * r; if (a) g.lineTo(x, y); else g.moveTo(x, y) }
  g.fill()
  for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(w * (0.15 + rnd() * 0.7), h * (0.15 + rnd() * 0.7), 6 + rnd() * 14, 0, 7); g.fill() }
  g.globalCompositeOperation = 'source-atop'
  for (let i = 0; i < 6; i++) { const y = h * (0.25 + rnd() * 0.5); const gr = g.createLinearGradient(0, y - 6, 0, y + 6); gr.addColorStop(0, 'rgba(60,20,90,0)'); gr.addColorStop(0.5, `rgba(${40 + rnd() * 60},${60 + rnd() * 50},${90 + rnd() * 60},0.35)`); gr.addColorStop(1, 'rgba(30,90,60,0)'); g.fillStyle = gr; g.fillRect(0, y - 6, w, 12) }
})

export function buildV36(course, scene, M, loader) {
  const group = new THREE.Group(); group.name = 'v36'; scene.add(group)
  const traps = course.traps || []
  const shTex = shadowTex()
  // ---------------- 鉄骨の影
  const girders = traps.filter(t => t.kind === 'girder').map(t => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, depthWrite: false, opacity: 0, polygonOffset: true, polygonOffsetFactor: -3 }))
    m.rotation.order = 'YXZ'; m.rotation.y = t.yaw; m.rotation.x = -Math.PI / 2
    m.position.set(t.p[0], t.p[1] + 0.03, t.p[2]); m.visible = false; group.add(m)
    return { t, m }
  })
  // ---------------- 油だまりと、油の滴る倒れた樽
  for (const t of traps.filter(t => t.kind === 'oil')) {
    const f = [Math.cos(t.yaw), 0, -Math.sin(t.yaw)]
    const mat = new THREE.MeshStandardMaterial({ map: oilTex(), transparent: true, depthWrite: false, roughness: 0.04, metalness: 0.65, color: 0xffffff, polygonOffset: true, polygonOffsetFactor: -3 })
    const o = new THREE.Mesh(new THREE.PlaneGeometry(t.w + 0.4, t.L + 0.8), mat)
    o.rotation.order = 'YXZ'; o.rotation.y = t.yaw - Math.PI / 2; o.rotation.x = -Math.PI / 2
    o.position.set(t.p[0] + f[0] * t.L / 2, t.p[1] + 0.012, t.p[2] + f[2] * t.L / 2); group.add(o)
    // 樽（横倒し・口から油の筋）と、樽から道へ流れた油
    const bm = new THREE.MeshStandardMaterial({ color: 0x5a2416, roughness: 0.55, metalness: 0.6 })
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.88, 18), bm); br.castShadow = true
    for (const y of [-0.3, 0.3]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.295, 0.02, 4, 18), new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.5, metalness: 0.8 })); r.rotation.x = Math.PI / 2; r.position.y = y; br.add(r) }
    const g = new THREE.Group(); g.add(br); br.rotation.z = Math.PI / 2; g.position.set(t.barrel[0] + f[0] * 0.43, t.barrel[1] + 0.3, t.barrel[2] + f[2] * 0.43); g.rotation.y = t.yaw; group.add(g)
    const pud = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), mat); pud.rotation.order = 'YXZ'; pud.rotation.y = t.yaw - Math.PI / 2 + 0.6; pud.rotation.x = -Math.PI / 2
    const R = [Math.sin(t.yaw), 0, Math.cos(t.yaw)]; pud.position.set(t.barrel[0] + f[0] * 1.2 + R[0] * 0.9, t.p[1] + 0.012, t.barrel[2] + f[2] * 1.2 + R[2] * 0.9); group.add(pud)
  }
  // ---------------- プレス機（通ると頭の 25cm 上まで、ガクンと下りて止まる。当たりなし）
  const presses = traps.filter(t => t.kind === 'press').map(t => {
    const iron = M.iron || new THREE.MeshStandardMaterial({ color: 0x3c3a38, metalness: 0.8, roughness: 0.5 }), rust = M.rust || iron
    const g = new THREE.Group(); g.position.set(...t.p); g.rotation.y = t.yaw
    const W = t.w + 1.2
    for (const sg of [-1, 1]) { const col = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7.5, 0.5), rust); col.position.set(0, 3.0, sg * (W / 2 + 0.3)); col.castShadow = true; g.add(col) }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.6, W + 1.6), rust); top.position.y = 7; g.add(top)
    const ram = new THREE.Group(); g.add(ram)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, W - 0.1), iron); plate.castShadow = true; ram.add(plate)
    for (let k = -2; k <= 2; k++) { const rib = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.12, 0.12), rust); rib.position.set(0, -0.3, k * W / 5.2); ram.add(rib) }
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.2, 10), iron); rod.position.y = 2.3; ram.add(rod)
    group.add(g)
    return { t, g, ram, y: 5.6, st: 'up', at: 0 }
  })
  // ---------------- 小さな猿のような生き物（膝くらい・長い腕・光る目。Quaternius の小鬼を暗くして小さく）
  const S = course.chases && course.chases.length ? pathS(course) : null
  const imps = { ready: false, list: [] }
  if (S && loader) loader.loadAsync('assets/models/Imp.glb').then(gl => {
    const src = gl.scene
    src.traverse(o => { if (o.isMesh) { o.castShadow = false; o.frustumCulled = false; o.material = o.material.clone(); const n = o.material.name || ''; if (/Face/.test(n)) { o.material.emissive = new THREE.Color(0xffd27a); o.material.emissiveIntensity = 1.6 } else o.material.color.multiplyScalar(0.32).lerp(new THREE.Color(0x2a2620), 0.4); o.material.roughness = 0.9 } })
    const box = new THREE.Box3().setFromObject(src), s0 = 0.62 / (box.max.y - box.min.y)
    for (const C of course.chases) {
      const n = C === course.chases[0] ? 3 : 4, list = []
      for (let k = 0; k < n; k++) {
        const m = skClone(src); m.scale.setScalar(s0 * (0.85 + k * 0.08)); m.scale.x *= 1.05
        // 長い腕: 肩から先の骨を伸ばす
        m.traverse(o => { if (o.isBone && /(Arm|Hand|arm|hand)/.test(o.name)) o.scale.multiplyScalar(1.18) })
        const mixer = new THREE.AnimationMixer(m), acts = {}; for (const a of gl.animations) acts[a.name] = mixer.clipAction(a)
        m.visible = false; group.add(m)
        list.push({ m, mixer, acts, cur: null, k, lat: (k - (n - 1) / 2) * 0.9, lag: k * 1.1 + (k % 2) * 0.4 })
      }
      imps.list.push({ C, list, ...perchOf(C) })
    }
    imps.ready = true; if (imps.onReady) imps.onReady()
  }).catch(e => console.warn('imp', e))
  // v38 予告の見張り台: 追われ始める所の少し手前、道の外側の縁に立つ崩れた柱。猿はこの上にしゃがんでこちらを見ている（見た目だけ。当たりなし）
  const towers = course.towers || []
  function perchOf(C) {
    const s0 = S[C.i0] - 1, q0 = posAt(s0, 0), w = (course.path[C.i0].w || 5) / 2
    let side = 1, far = -1
    for (const sd of [1, -1]) { const q = posAt(s0, sd * (w + 2)); let d = 1e9; for (const T of towers) d = Math.min(d, Math.hypot(q.p[0] - T.cx, q.p[2] - T.cz) - T.r); if (d > far) { far = d; side = sd } }
    const n = C === course.chases[0] ? 3 : 4, len = n * 1.3 + 1.2, top = q0.p[1] + 3.4
    const g = new THREE.BoxGeometry(len, 7.4, 1.3, 3, 2, 1); const pp = g.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) - Math.abs(Math.sin(pp.getX(i) * 2.1)) * 0.35)
    const m = new THREE.Mesh(g, M.ruinwall || M.rock); const pq = posAt(s0, side * (w + 0.7)); m.position.set(pq.p[0], top - 3.7, pq.p[2]); m.rotation.y = pq.yaw; m.castShadow = true; m.receiveShadow = true; m.name = 'perch'; group.add(m)
    return { side0: side, s0, w, top, perch: m, vis: 'hide', jt: 0, sideV: -side }
  }
  const play = (u, name, ts = 1) => { const a = u.acts[name]; if (!a || u.cur === a) return; if (u.cur) u.cur.fadeOut(0.15); a.reset().fadeIn(0.15).play(); a.timeScale = ts; u.cur = a }
  const posAt = (s, lat) => { const P = course.path; let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m } const a = P[lo], b = P[hi] && P[hi].p ? P[hi] : a, u = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0, y = a.yaw; return { p: [a.p[0] + (b.p[0] - a.p[0]) * u + Math.sin(y) * lat, a.p[1] + (b.p[1] - a.p[1]) * u, a.p[2] + (b.p[2] - a.p[2]) * u + Math.cos(y) * lat], yaw: y } }

  return {
    group, imps,
    update(dt, tm, cam, world, R, bike) {
      for (const G of girders) {
        const sh = G.t.shape, pose = girderPose(sh, world.time)
        const k = pose.ph === 'warn' ? pose.k : pose.ph === 'fall' ? 1 : 0
        G.m.visible = k > 0.001
        if (G.m.visible) { const s = 1.2 + k * 4.2; G.m.scale.set(s * 1.0, (G.t.w + 1.4) * (0.5 + k * 0.5), 1); G.m.material.opacity = 0.25 + k * 0.6 }
      }
      for (const P of presses) {
        const b = bike, t = P.t
        if (b) { const hx = Math.cos(t.yaw), hz = -Math.sin(t.yaw), ahead = (t.p[0] - b.p[0]) * hx + (t.p[2] - b.p[2]) * hz, lat = Math.abs(-(t.p[0] - b.p[0]) * hz + (t.p[2] - b.p[2]) * hx), near = Math.abs(b.p[1] - 0.8 - t.p[1]) < 3 && lat < t.w
          if (P.st === 'up' && near && ahead < 2.5 && ahead > -1) { P.st = 'down'; P.at = tm; P.ev = 'slam' }
          if (P.st !== 'up' && (ahead < -14 || ahead > 30 || !near)) P.st = 'up' }
        const low = 2.18 + 0.3 // 乗り手の頭（約 1.9m）の 25cm ほど上で止まる（板の下の面）
        const want = P.st === 'up' ? 5.6 : low + 0.275
        P.y += Math.max(-dt * (P.st === 'down' ? 18 : 2), Math.min(dt * 1.2, want - P.y))
        P.ram.position.y = P.y
      }
      if (imps.ready && R) for (const I of imps.list) {
        const k = course.chases.indexOf(I.C), st = R.ch && R.ch[k], C = I.C
        const bi = st && st.bi != null ? st.bi : R.onI, sb = bi != null ? S[bi] : -1e9
        // 見え方: 見張り台の上（来る 45m 手前から）→ 鳴いて飛び降りる（13m 手前）→ 追いかけ（カメラと反対側の斜め後ろを並走）
        let mode = 'hide'
        if (st && st.ph !== 'warn') mode = 'chase'
        else if (sb > S[C.i0] - 45 && sb < S[C.i0] + 4) mode = sb > S[C.i0] - 13 ? 'jump' : 'perch'
        if (mode === 'jump' && I.vis !== 'jump') { I.jt = tm; I.ev = true }
        I.vis = mode
        // カメラのいる側の反対（画面の端に入る側）。カメラが反対へ回ったら、ゆっくり寄せる
        if (bike && cam) { const q = course.path[bi] || course.path[C.i0], y = q.yaw, cl = (cam.x - bike.p[0]) * Math.sin(y) + (cam.z - bike.p[2]) * Math.cos(y); const want = Math.abs(cl) > 0.4 ? -Math.sign(cl) : I.sideV >= 0 ? 1 : -1; I.sideV += (want - I.sideV) * Math.min(1, dt * 2.5) }
        const n = I.list.length
        for (const u of I.list) {
          if (mode === 'hide') { u.m.visible = false; continue }
          u.m.visible = true
          if (mode === 'perch' || mode === 'jump') {
            const off = (u.k - (n - 1) / 2) * 1.3, top = posAt(I.s0 + off, I.side0 * (I.w + 0.7)), dn = posAt(S[C.i0] - 3 + off, I.side0 * Math.max(0.8, I.w - 0.6))
            const p = mode === 'jump' ? Math.max(0, Math.min(1, (tm - I.jt - u.k * 0.12) / 0.45)) : 0
            const y0 = I.top, y1 = dn.p[1]
            u.m.position.set(top.p[0] + (dn.p[0] - top.p[0]) * p, y0 + (y1 - y0) * p + Math.sin(p * Math.PI) * 0.8, top.p[2] + (dn.p[2] - top.p[2]) * p)
            u.m.rotation.y = top.yaw - Math.PI / 2 // 来るバイクの方を見る
            u.m.scale.y = u.m.scale.x / 1.05 * (p === 0 ? 0.9 : 1) // 台の上ではしゃがむ
            play(u, p === 0 ? 'Idle' : p < 1 ? 'Run' : (u.k === 0 ? 'Victory' : 'Idle'), p > 0 && p < 1 ? 1.6 : 1)
            u.bl = 0; u.last = u.m.position.clone()
          } else {
            const run = st.ph === 'run', caught = st.ph === 'caught'
            u.m.scale.y = u.m.scale.x / 1.05
            if (st.ph === 'done') { play(u, 'Victory'); u.mixer.update(dt); continue } // 逃げ切られた所で止まって見送る
            // 本当の差（道のり）を、画面の端に見える近さへ縮めて置く: 差が詰まるほど横に寄って大きく、離されるほど後ろへ下がって端から消える
            const g = Math.max(0, sb - (st.sm ?? sb)) + u.lag * 0.45
            const back = g <= 9 ? 0.5 + 2.7 * Math.max(0, g - 1.2) / 7.8 : 3.2 + (g - 9) * 0.55
            const lat = I.sideV * (Math.min(2.3, Math.max(1.2, I.w - 0.6)) - (u.k % 2) * 0.45)
            const q = posAt(sb - back, lat), hop = run ? Math.abs(Math.sin(tm * 9 + u.k)) * 0.22 : 0
            const tx = q.p[0], ty = q.p[1] + hop, tz = q.p[2]
            u.bl = Math.min(1, (u.bl || 0) + dt * 2.2) // 飛び降りた所から並走の位置へ駆け寄る
            if (u.last && u.bl < 1) u.m.position.set(u.last.x + (tx - u.last.x) * u.bl, u.last.y + (ty - u.last.y) * u.bl, u.last.z + (tz - u.last.z) * u.bl)
            else u.m.position.set(tx, ty, tz)
            u.m.rotation.y = q.yaw + Math.PI / 2
            play(u, run ? 'Run' : caught && u.k === 0 ? 'Punch' : 'Victory', run ? 1.6 : 1)
          }
          u.mixer.update(dt)
        }
      }
    },
    impEvents() { const out = []; for (const I of imps.list) if (I.ev) { out.push(course.chases.indexOf(I.C)); I.ev = false } return out },
    pressEvents() { const out = []; for (const P of presses) if (P.ev) { out.push({ t: P.ev, p: P.g.position.toArray() }); P.ev = null } return out },
  }
}
