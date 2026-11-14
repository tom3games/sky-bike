// SKY BIKE v35 の見た目: 回る筒・廃墟に住む男（ハンカチ）・兄の跡（刻んだ印・落書き・工具）・門の前の兄のヘルメットと手紙。
// 当たりは持たない（筒の当たりは js/drum.js の板）。字は手で刻んだ線（フォントの字を貼らない）
import * as THREE from 'three'

let seed = 35
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t }

// ------------------------------------------------------------ 手で刻んだ線の字（数字と記号だけ。0..1 の枠の中の折れ線）
const GL = {
  0: [[[0.5, 0], [0.15, 0.2], [0.12, 0.75], [0.5, 1], [0.86, 0.75], [0.85, 0.22], [0.5, 0]]],
  1: [[[0.3, 0.18], [0.55, 0], [0.55, 1]]],
  2: [[[0.12, 0.25], [0.42, 0], [0.82, 0.12], [0.8, 0.42], [0.12, 1], [0.9, 0.98]]],
  3: [[[0.12, 0.08], [0.78, 0.08], [0.42, 0.45], [0.85, 0.64], [0.62, 0.98], [0.12, 0.9]]],
  4: [[[0.7, 1], [0.7, 0], [0.06, 0.68], [0.95, 0.68]]],
  5: [[[0.85, 0.02], [0.22, 0.02], [0.16, 0.45], [0.66, 0.42], [0.86, 0.72], [0.52, 1], [0.1, 0.9]]],
  6: [[[0.8, 0.05], [0.32, 0.3], [0.14, 0.75], [0.5, 1], [0.85, 0.76], [0.5, 0.5], [0.18, 0.66]]],
  7: [[[0.1, 0.02], [0.9, 0.02], [0.4, 1]]],
  8: [[[0.5, 0.48], [0.18, 0.25], [0.5, 0], [0.82, 0.25], [0.5, 0.48], [0.14, 0.74], [0.5, 1], [0.86, 0.74], [0.5, 0.48]]],
  9: [[[0.82, 0.38], [0.48, 0.5], [0.16, 0.26], [0.5, 0], [0.84, 0.24], [0.8, 1]]],
  '/': [[[0.85, 0], [0.15, 1]]],
  '-': [[[0.1, 0.5], [0.9, 0.5]]],
}
// 刻んだ線: 暗い溝と、下側に薄い明るい縁。shake で線が震える（後ろの跡ほど大きい）
function scratch(g, pts, w, shake, col = 'rgba(22,16,12,0.95)', hi = 'rgba(235,225,205,0.5)') {
  const jit = pts.map(([x, y]) => [x + (rnd() - 0.5) * shake, y + (rnd() - 0.5) * shake])
  const path = () => { g.beginPath(); jit.forEach(([x, y], i) => { if (i === 0) g.moveTo(x, y); else { const [px, py] = jit[i - 1]; const n = 4; for (let k = 1; k <= n; k++) { const u = k / n; g.lineTo(px + (x - px) * u + (rnd() - 0.5) * shake * 0.6, py + (y - py) * u + (rnd() - 0.5) * shake * 0.6) } } }) }
  g.lineCap = 'round'; g.lineJoin = 'round'
  g.save(); g.translate(0, w * 0.45); g.strokeStyle = hi; g.lineWidth = w * 0.8; path(); g.stroke(); g.restore()
  g.strokeStyle = col; g.lineWidth = w; path(); g.stroke()
}
function writeText(g, s, x, y, h, w, shake, slant = 0) {
  let cx = x
  for (const ch of s) {
    const gl = GL[ch]; if (!gl) { cx += h * 0.5; continue }
    const ww = h * 0.62
    for (const st of gl) scratch(g, st.map(([u, v]) => [cx + u * ww + (1 - v) * h * slant, y + v * h]), w, shake)
    cx += ww + h * 0.16
  }
  return cx
}
// 石の板の地（汚れ・ひび）
function stoneBase(g, w, h, tone = 92) {
  g.fillStyle = `rgb(${tone},${tone - 4},${tone - 12})`; g.fillRect(0, 0, w, h)
  for (let i = 0; i < 1400; i++) { const v = tone - 30 + rnd() * 50; g.fillStyle = `rgba(${v},${v - 4},${v - 10},${0.18 + rnd() * 0.2})`; g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 3) }
  for (let i = 0; i < 5; i++) { const x = rnd() * w, y = rnd() * h, r = 20 + rnd() * 50, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(30,26,20,0.28)'); gr.addColorStop(1, 'rgba(30,26,20,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2) }
  g.strokeStyle = 'rgba(30,26,22,0.5)'; g.lineWidth = 1.5
  for (let i = 0; i < 3; i++) { let x = rnd() * w, y = 0; g.beginPath(); g.moveTo(x, y); while (y < h) { x += (rnd() - 0.5) * 30; y += 10 + rnd() * 30; g.lineTo(x, y) } g.stroke() }
}
// 兄の跡の板の絵（kind ごと。shake 0..1）
function traceTexture(kind, shake, k) {
  seed = 101 + k * 17
  const W = 256, H = 512
  return canvasT(W, H, (g) => {
    stoneBase(g, W, H, 150 - k * 4)
    const sh = 2 + shake * 22, lw = 9 + shake * 2
    const date = ['10/2', '10/4', '10/9', '10/13', '10/16', '10/19', '10/21', '10/23'][k] || '10/2'
    if (kind === 'height' || kind === 'sloppy') {
      // 高さの印（横の線と日付）。sloppy は印がいくつも、だんだん傾いて雑に
      const n = kind === 'height' ? 1 : 4
      for (let i = 0; i < n; i++) {
        const y = 150 + i * 70 + (rnd() - 0.5) * shake * 20, tilt = (rnd() - 0.5) * shake * 60
        scratch(g, [[30, y], [150, y + tilt]], lw + 1, sh)
        writeText(g, i === n - 1 ? date : ['9/2', '9/1', '8/30', '8/29'][i], 160 - (i % 2) * 10, y - 26, 34, lw * 0.7, sh * 0.7, shake * 0.3)
      }
    } else if (kind === 'arrow' || kind === 'up' || kind === 'shaky') {
      const x = 128, len = kind === 'up' ? 360 : 260
      scratch(g, [[x + (rnd() - 0.5) * shake * 30, 80 + len], [x, 80]], lw + 2, sh)
      scratch(g, [[x - 50, 140], [x, 80], [x + 50, 140]], lw + 2, sh)
      if (kind === 'shaky') { for (let i = 0; i < 3; i++) scratch(g, [[x - 40 + i * 30, 380], [x - 30 + i * 30, 470]], lw, sh * 1.3) }
      writeText(g, date, 40, kind === 'up' ? 460 : 380, 36, lw * 0.75, sh * 0.8, shake * 0.4)
      if (kind === 'arrow') for (let i = 0; i < 4; i++) scratch(g, [[150 + i * 16, 400], [148 + i * 16, 450]], lw * 0.8, sh)
    } else if (kind === 'claw') {
      // 爪でえぐった 4 本の筋と、震える上向きの矢印
      for (let i = 0; i < 4; i++) scratch(g, [[40 + i * 26, 90 + i * 6], [110 + i * 26, 300 + i * 4]], lw + 3, sh * 0.5, 'rgba(14,10,8,0.98)')
      scratch(g, [[200, 470], [196, 180]], lw, sh * 1.4); scratch(g, [[165, 230], [196, 180], [228, 232]], lw, sh * 1.4)
      writeText(g, '10/24', 30, 400, 34, lw * 0.75, sh, 0.5)
    } else if (kind === 'two') {
      // 二人の印（棒の人が 2 つ並ぶ）と日付。ここまでは二人で来た
      for (const x0 of [70, 160]) { scratch(g, [[x0, 120], [x0, 250]], lw, sh); scratch(g, [[x0 - 34, 330], [x0, 250], [x0 + 34, 330]], lw, sh); scratch(g, [[x0 - 40, 170], [x0 + 40, 170]], lw, sh); g.beginPath(); g.lineWidth = lw; g.strokeStyle = 'rgba(22,16,12,0.95)'; g.arc(x0 + (rnd() - 0.5) * sh, 90, 26, 0, 7); g.stroke() }
      writeText(g, '9/27', 50, 400, 40, lw * 0.75, sh * 0.8, shake * 0.3)
    } else if (kind === 'turnback') {
      // 上を指す矢印に×、下へ戻る矢印（引き返した）
      scratch(g, [[90, 330], [90, 90]], lw + 1, sh); scratch(g, [[50, 140], [90, 90], [130, 140]], lw + 1, sh)
      scratch(g, [[50, 150], [140, 250]], lw + 2, sh); scratch(g, [[140, 150], [50, 250]], lw + 2, sh)
      scratch(g, [[180, 120], [180, 360]], lw, sh); scratch(g, [[150, 320], [180, 370], [210, 320]], lw, sh)
      writeText(g, date, 60, 410, 36, lw * 0.75, sh * 0.8)
    }
    // 端の欠け
    g.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(rnd() < 0.5 ? 0 : W, rnd() * H, 6 + rnd() * 18, 0, 7); g.fill() }
  })
}

// ------------------------------------------------------------ 筒
function drumView(D, M, group) {
  const R = D.R, W = D.hw * 2, root = new THREE.Group(); root.position.set(...D.c); root.rotation.y = D.yaw; group.add(root)
  const base = M.rust || new THREE.MeshStandardMaterial({ color: 0x7a5a44 })
  const mk = (repU, repV, dark = 1) => { const m = base.clone(); for (const k of ['map', 'normalMap', 'roughnessMap']) if (m[k]) { m[k] = m[k].clone(); m[k].wrapS = m[k].wrapT = THREE.RepeatWrapping; m[k].repeat.set(repU, repV); m[k].needsUpdate = true } m.color = m.color.clone().multiplyScalar(dark); return m }
  const circ = 2 * Math.PI * R
  const inner = mk(circ / 2.6, W / 2.6, 1.15); inner.side = THREE.BackSide
  const outer = mk(circ / 3.2, W / 3.2, 0.7)
  const G0 = 9 / 48 * Math.PI * 2 // 口の角度（67.5 度）
  // 筒の面（口の 2 か所を除く 225 度）。軸は横（root の z）。CylinderGeometry の θ=0 が一番下、θ が増えると前の壁へ
  const arc = (r, t0, tl, mat) => { const g = new THREE.CylinderGeometry(r, r, W, Math.max(8, Math.round(96 * tl / (Math.PI * 2))), 1, true, t0, tl); const m = new THREE.Mesh(g, mat); m.rotation.x = Math.PI / 2; m.castShadow = true; m.receiveShadow = true; return m }
  const shell = new THREE.Group(); root.add(shell)
  shell.add(arc(R, G0, Math.PI * 2 - 2 * G0, inner), arc(R + 0.5, G0, Math.PI * 2 - 2 * G0, outer))
  // 口をふさぐ板（最初は前の下 B。真上を越えると筒と一緒に回って後ろの下 A へ）
  const shut = new THREE.Group(); root.add(shut)
  const sIn = mk(G0 * R / 2.2, W / 2.2, 0.85); sIn.side = THREE.BackSide
  shut.add(arc(R, 0, G0, sIn), arc(R + 0.5, 0, G0, outer))
  // 縁の鉄の帯（板の継ぎ目。回る筒の目印）
  const band = new THREE.MeshStandardMaterial({ color: 0x3a2e26, roughness: 0.6, metalness: 0.8 })
  for (const sg of [-1, 1]) { const tg = new THREE.TorusGeometry(R - 0.05, 0.09, 6, 96); const t = new THREE.Mesh(tg, band); t.position.z = sg * (W / 2 - 0.12); shell.add(t) }
  // 両端の板（丸い壁）と、回る輻（スポーク）と鋲
  const plateM = mk(4, 4, 0.55); plateM.side = THREE.DoubleSide
  const spin = new THREE.Group(); root.add(spin)
  for (const sg of [-1, 1]) {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R + 0.6, 64), plateM); disc.position.z = sg * (W / 2 + 0.15); root.add(disc)
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, sp = new THREE.Mesh(new THREE.BoxGeometry(0.32, R * 0.92, 0.16), band); sp.position.set(Math.sin(a) * R * 0.5, -Math.cos(a) * R * 0.5, sg * (W / 2 - 0.02)); sp.rotation.z = a; spin.add(sp) }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.3, 20), band); hub.rotation.x = Math.PI / 2; hub.position.z = sg * (W / 2 - 0.05); spin.add(hub)
    const rv = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), band, 48); const mm = new THREE.Matrix4()
    for (let k = 0; k < 48; k++) { const a = k / 48 * Math.PI * 2; mm.makeTranslation(Math.sin(a) * (R - 0.35), -Math.cos(a) * (R - 0.35), sg * (W / 2 - 0.02)); rv.setMatrixAt(k, mm) } spin.add(rv)
  }
  // 両端の板の縁に、油の灯り（光る板。光そのものは増やさない）
  const lampM = new THREE.MeshStandardMaterial({ color: 0x2a1a10, emissive: 0xffa04a, emissiveIntensity: 2.2, roughness: 0.6 })
  for (const sg of [-1, 1]) for (let k = 0; k < 10; k++) { const a = (k + 0.5) / 10 * Math.PI * 2, l = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.32, 0.12), lampM); l.position.set(Math.sin(a) * (R - 0.6), -Math.cos(a) * (R - 0.6), sg * (W / 2 + 0.05)); l.rotation.z = a; root.add(l) }
  let turn = 0
  return {
    update(dt, tm) {
      spin.rotation.z = -tm * 0.22 // 筒はいつもゆっくり回っている（下の面が後ろへ）
      for (const m of [inner, outer, sIn]) if (m.map) m.map.offset.x = (tm * 0.22 / (Math.PI * 2)) * m.map.repeat.x
      const want = D.open ? -G0 : 0; turn += Math.max(-dt * 2.4, Math.min(dt * 2.4, want - turn)); if (!D.open) turn = 0
      shut.rotation.z = turn
    },
  }
}

// ------------------------------------------------------------ 兄の跡の置き場所: 道の割合 t から先で、まっすぐ平らで広い所
export function traceSpots(course) {
  const hs = hermitSpot(course)
  const P = course.path, N = P.findIndex(q => q.branch) > 0 ? P.findIndex(q => q.branch) : P.length
  const ok = q => q && q.p && !q.branch && q.w >= 3.2 && ['road', 'orbit', 'pad'].includes(q.kind) && Math.abs(q.slope || 0) < 0.1 && (q.kap || 0) < 0.06 && !q.door
  const LIST = [
    [0.17, 'height', '兄の字だ。', "My brother's handwriting."],
    [0.22, 'arrow', 'ここも通ったらしい。', 'He came through here too.'],
    [0.40, 'wrench', '兄のスパナが落ちている。', "My brother's wrench, left behind."],
    [0.55, 'turnback', 'ここで一度、引き返したらしい。', 'Looks like he turned back here once.'],
    [0.66, 'lever', '折れたレバー。無理に動かしたらしい。', 'A snapped lever. He forced it.'],
    [0.75, 'sloppy', '印が雑になっていく。', 'His marks are getting sloppy.'],
    [0.84, 'shaky', '字が震えている。', 'The scratches are shaking.'],
    [0.895, 'up', 'それでも、上へ向かっている。', 'Still, he kept going up.'],
  ]
  const out = []
  LIST.forEach(([t, kind, ja, en], k) => {
    for (let i = Math.floor(N * t); i < N - 12; i++) {
      let good = true; for (let j = i - 6; j <= i + 6; j++) if (!ok(P[j])) { good = false; break }
      if (!good || (hs && Math.abs(i - hs.i) < 70) || (course.chases || []).some(C => i > C.i0 - 40 && i < C.i1 + 40) || (course.traps || []).some(T => Math.abs(i - T.i) < 40)) continue // 廃墟の男・猿・罠の近くには置かない
      const q = P[i]
      // 塔の壁から遠い側（外の側）の縁に置く
      let side = -1
      for (const T of course.towers || []) { const rx = Math.sin(q.yaw), rz = Math.cos(q.yaw), dl = Math.hypot(q.p[0] - rx * 3 - T.cx, q.p[2] - rz * 3 - T.cz), dr = Math.hypot(q.p[0] + rx * 3 - T.cx, q.p[2] + rz * 3 - T.cz); if (Math.min(dl, dr) < T.r + 6) side = dl < dr ? 1 : -1 }
      out.push({ i, p: q.p.slice(), yaw: q.yaw, w: q.w, side, kind, ja, en, k, shake: k / (LIST.length - 1) })
      break
    }
  })
  // 中盤の山: 休憩所「嵐の回廊の途中」のそばの野宿の跡（廃墟の男とは別の場所）。字の乱れは 41% と 62% の跡の間
  const cs = campSpot(course)
  if (cs) out.push({ ...cs, side: -1, kind: 'two', camp: true, ja: 'ここまでは二人で来た。', en: 'We made it this far together.', k: 8, shake: 0.36 })
  // v36 2 か所目の猿を逃げ切った先: 「あれに追われた。振り返るな。」（爪の跡と、震える上向きの矢印）
  const ch = course.chases && course.chases[1]
  if (ch) { const P = course.path; let i = ch.i1 + 4; while (i < P.length - 1 && !(P[i].w >= 3 && ['road', 'orbit', 'pad'].includes(P[i].kind))) i++; const q = P[i]; out.push({ i, p: q.p.slice(), yaw: q.yaw, w: q.w, side: -1, kind: 'claw', ja: 'あれに追われた。振り返るな。', en: "They chased me. Don't look back.", k: 9, shake: 0.95 }) }
  return out
}
export function campSpot(course) {
  const P = course.path, cp = course.cps.find(q => q.name === '嵐の回廊の途中'); if (!cp) return null
  let bi = 0, bd = 1e9; P.forEach((q, i) => { if (!q.p || q.branch) return; const d = Math.hypot(q.p[0] - cp.p[0], q.p[1] - cp.p[1], q.p[2] - cp.p[2]); if (d < bd) { bd = d; bi = i } })
  const i = bi + 5, q = P[i]; return { i, p: q.p.slice(), yaw: q.yaw, w: q.w }
}
// 廃墟に住む男の場所: 道の 25% より先の、明るい廃墟の区間で、手前 14m がまっすぐでゆるい所（休憩所「廃墟の回廊の入口」の少し先）
export function hermitSpot(course) {
  const P = course.path, N = P.findIndex(q => q.branch) > 0 ? P.findIndex(q => q.branch) : P.length
  const ok = z => z && z.p && !z.branch && z.w >= 4 && Math.abs(z.slope || 0) < 0.07 && (z.kap || 0) < 0.04 && ['road', 'orbit', 'pad'].includes(z.kind) && !z.door
  for (let i = Math.floor(N * 0.25); i < N * 0.6; i++) { if (P[i].zone !== 'ruin' && P[i].zone !== 'bell') continue; let g = true; for (let j = i - 14; j <= i + 4; j++) if (!ok(P[j])) { g = false; break } if (g) { const q = P[i]; return { i, p: q.p.slice(), yaw: q.yaw, w: q.w } } }
  return null
}

export function buildV35(course, scene, M, loader) {
  const group = new THREE.Group(); group.name = 'v35'; scene.add(group)
  const drums = (course.drums || []).map(D => drumView(D, M, group))
  // ---------------- 兄の跡
  const traces = traceSpots(course)
  const stoneM = M.ruinwall || new THREE.MeshStandardMaterial({ color: 0x77786f })
  const ironM = new THREE.MeshStandardMaterial({ color: 0x4a4440, roughness: 0.5, metalness: 0.85 })
  for (const tr of traces) {
    const f = [Math.cos(tr.yaw), 0, -Math.sin(tr.yaw)], r = [Math.sin(tr.yaw), 0, Math.cos(tr.yaw)]
    const edge = [tr.p[0] + r[0] * tr.side * (tr.w / 2 + 0.3), tr.p[1], tr.p[2] + r[2] * tr.side * (tr.w / 2 + 0.3)]
    if (tr.kind === 'wrench' || tr.kind === 'lever') {
      // 道の縁に落ちている工具（スパナ）/ 縁の柱に付いた折れたレバー
      const g = new THREE.Group(), at = [tr.p[0] + r[0] * tr.side * (tr.w / 2 - 0.35), tr.p[1], tr.p[2] + r[2] * tr.side * (tr.w / 2 - 0.35)]
      if (tr.kind === 'wrench') {
        const h = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.025, 0.05), ironM); h.position.set(0, 0.015, 0); g.add(h)
        for (const sx of [-1, 1]) { const j = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.016, 5, 10, Math.PI * 1.4), ironM); j.rotation.x = -Math.PI / 2; j.rotation.z = sx > 0 ? 0.6 : 3.7; j.position.set(sx * 0.19, 0.015, 0); g.add(j) }
        const rag = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), new THREE.MeshStandardMaterial({ color: 0x6a5c40, roughness: 1, side: THREE.DoubleSide })); rag.rotation.x = -Math.PI / 2; rag.rotation.z = 0.5; rag.position.set(-0.05, 0.006, 0.1); g.add(rag)
        g.position.set(...at); g.rotation.y = tr.yaw + 0.7
        // 隣の縁の石に、小さく刻んだ日付
        tr.kind2 = 'height'
      } else {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), stoneM); post.position.y = 0.2; g.add(post)
        const boxL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), ironM); boxL.position.y = 0.95; g.add(boxL)
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), ironM); rod.position.set(0, 1.25, 0); rod.rotation.z = 0.5; g.add(rod)
        const broken = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), ironM); broken.position.set(-0.22, 0.03, 0.25); broken.rotation.z = Math.PI / 2; broken.rotation.y = 0.8; g.add(broken)
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0x5a2a1a, roughness: 0.7 })); knob.position.set(-0.38, 0.05, 0.38); g.add(knob)
        g.position.set(...edge); g.rotation.y = tr.yaw
      }
      group.add(g)
    }
    if (tr.camp) {
      // 消えた焚き火・毛布・空き缶・小さな鍋（道の左の縁の内側。当たりなし）
      const g = new THREE.Group(), base = [tr.p[0] - r[0] * (tr.w / 2 - 0.9), tr.p[1], tr.p[2] - r[2] * (tr.w / 2 - 0.9)]
      g.position.set(base[0] + f[0] * 1.2, base[1], base[2] + f[2] * 1.2); g.rotation.y = tr.yaw
      const ash = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshStandardMaterial({ color: 0x1c1a18, roughness: 1 })); ash.rotation.x = -Math.PI / 2; ash.position.y = 0.012; g.add(ash)
      const charM = new THREE.MeshStandardMaterial({ color: 0x241c16, roughness: 1 })
      for (let k = 0; k < 5; k++) { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.5, 6), charM); lg.rotation.z = Math.PI / 2; lg.rotation.y = k * 1.25; lg.position.y = 0.06 + (k % 2) * 0.04; g.add(lg) }
      for (let k = 0; k < 8; k++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07 + (k % 3) * 0.015), stoneM); const a = k / 8 * Math.PI * 2; st.position.set(Math.cos(a) * 0.48, 0.04, Math.sin(a) * 0.48); g.add(st) }
      const blanket = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.5, 6, 8), new THREE.MeshStandardMaterial({ color: 0x4a3a2e, roughness: 1, side: THREE.DoubleSide }))
      { const P = blanket.geometry.attributes.position; for (let k = 0; k < P.count; k++) P.setZ(k, Math.abs(Math.sin(P.getX(k) * 7 + P.getY(k) * 5)) * 0.06) } blanket.geometry.computeVertexNormals()
      blanket.rotation.x = -Math.PI / 2; blanket.rotation.z = 0.3; blanket.position.set(-1.25, 0.02, 0.15); g.add(blanket)
      const canM = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 0.45, metalness: 0.8 })
      for (const [x, z, lie] of [[0.7, 0.4, 1], [0.85, 0.1, 0], [0.55, -0.35, 1]]) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10, 1, true), canM); cn.position.set(x, lie ? 0.04 : 0.05, z); if (lie) { cn.rotation.z = Math.PI / 2; cn.rotation.y = x * 3 } g.add(cn) }
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.12, 14, 1, true), new THREE.MeshStandardMaterial({ color: 0x2e2a28, roughness: 0.5, metalness: 0.7, side: THREE.DoubleSide })); pot.position.set(0.1, 0.13, -0.05); pot.rotation.z = 0.15; g.add(pot)
      const hd = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.008, 4, 16, Math.PI), canM); hd.position.set(0.1, 0.19, -0.05); g.add(hd)
      group.add(g)
    }
    if (tr.kind !== 'wrench' && tr.kind !== 'lever' || tr.kind2) {
      // 縁の折れた石の柱（下は道の横へ埋まる）と、前の面に刻んだ印
      const kind = tr.kind2 || tr.kind, Hh = 2.0, Ww = 1.0
      const g = new THREE.Group(); g.position.set(edge[0] + f[0] * (tr.kind2 ? 1.5 : 0), edge[1], edge[2] + f[2] * (tr.kind2 ? 1.5 : 0))
      g.rotation.y = tr.yaw - Math.PI / 2 + tr.side * -0.55 // 面は来る人の方へ（道の側へ少し向ける）
      const slab = new THREE.Mesh(new THREE.BoxGeometry(Ww, Hh + 1.2, 0.34), stoneM); slab.position.y = Hh / 2 - 0.6; slab.castShadow = true; g.add(slab)
      const face = new THREE.Mesh(new THREE.PlaneGeometry(Ww * 0.92, Hh * 0.96), new THREE.MeshStandardMaterial({ map: traceTexture(kind, tr.shake, tr.k), roughness: 0.95, transparent: true, alphaTest: 0.5, emissive: 0x2a2620, emissiveIntensity: 0.6 }))
      face.position.set(0, Hh * 0.5 + 0.02, 0.172); g.add(face)
      group.add(g)
    }
  }
  // ---------------- 門の前の兄のヘルメットと手紙
  const fin = course.cps.find(q => q.finish)
  if (fin) {
    const f = [Math.cos(fin.yaw), 0, -Math.sin(fin.yaw)], r = [Math.sin(fin.yaw), 0, Math.cos(fin.yaw)]
    const at = [fin.p[0] - f[0] * 2.2 + r[0] * 3.2, fin.p[1], fin.p[2] - f[2] * 2.2 + r[2] * 3.2]
    const g = new THREE.Group(); g.position.set(...at); g.rotation.y = fin.yaw + 2.2
    const shellM = new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: 0.55, metalness: 0.25 })
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), shellM); helm.position.y = 0.13; helm.rotation.z = 0.35; helm.castShadow = true; g.add(helm)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 })); visor.position.set(0.15, 0.17, 0); visor.rotation.z = 0.5; g.add(visor)
    const scr = new THREE.Mesh(new THREE.TorusGeometry(0.168, 0.012, 4, 24), new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.8 })); scr.rotation.x = Math.PI / 2; scr.position.y = 0.06; g.add(scr)
    seed = 77
    const paper = canvasT(256, 192, (x, w, h) => { x.fillStyle = '#c9b68a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${90 + rnd() * 40},${70 + rnd() * 30},${40},${0.08 + rnd() * 0.1})`; x.fillRect(rnd() * w, rnd() * h, 2, 2) } x.strokeStyle = 'rgba(60,44,30,0.35)'; x.lineWidth = 1; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(20, 40 + k * 24); x.lineTo(236, 40 + k * 24); x.stroke() } for (let k = 0; k < 3; k++) { let px = 26; x.strokeStyle = 'rgba(30,24,40,0.85)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(px, 34 + k * 24); while (px < 200 - k * 50) { px += 6 + rnd() * 8; x.lineTo(px, 34 + k * 24 + (rnd() - 0.5) * 10) } x.stroke() } x.strokeStyle = 'rgba(90,70,40,0.5)'; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.stroke() })
    const let_ = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.26), new THREE.MeshStandardMaterial({ map: paper, roughness: 1, side: THREE.DoubleSide })); let_.rotation.x = -Math.PI / 2; let_.position.set(-0.3, 0.012, 0.12); let_.rotation.z = 0.3; g.add(let_)
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.07), stoneM); stone.position.set(-0.32, 0.05, 0.1); g.add(stone)
    group.add(g)
  }
  // ---------------- 門の向こうへ続く兄のタイヤの跡（最後の場面だけ見せる。門の向こうの建物は映さない）
  let tracks = null
  if (fin) {
    seed = 91
    const L = 22, tex = canvasT(64, 1024, (x, w, h) => { x.clearRect(0, 0, w, h); for (let y = 0; y < h; y += 9) { const a = 0.55 + rnd() * 0.3; x.fillStyle = `rgba(18,14,12,${a})`; x.fillRect(20 + (rnd() - 0.5) * 3, y, 24, 5); x.fillStyle = `rgba(18,14,12,${a * 0.5})`; x.fillRect(14, y + 2, 6, 3); x.fillRect(44, y + 2, 6, 3) } const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.3, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.globalCompositeOperation = 'destination-out'; x.fillStyle = gr; x.fillRect(0, 0, w, h) })
    const geo = new THREE.PlaneGeometry(0.22, L, 1, 40), P = geo.attributes.position
    for (let k = 0; k < P.count; k++) { const yy = P.getY(k) + L / 2; P.setX(k, P.getX(k) + Math.sin(yy * 0.35) * 0.35 + yy * 0.03) }
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 }))
    const f = [Math.cos(fin.yaw), 0, -Math.sin(fin.yaw)]
    m.rotation.order = 'YXZ'; m.rotation.y = fin.yaw - Math.PI / 2; m.rotation.x = -Math.PI / 2
    m.position.set(fin.p[0] + f[0] * (L / 2 + 0.6), fin.p[1] + 0.02, fin.p[2] + f[2] * (L / 2 + 0.6))
    m.visible = false; group.add(m); tracks = m
  }
  // ---------------- 廃墟に住む男（読み込みは後から）
  const hs = hermitSpot(course)
  const hermit = { spot: hs, root: null, mixer: null, acts: {}, state: 'hide', t: 0, pos: null }
  if (hs && loader) loader.loadAsync('assets/models/Hermit.glb').then(gl => {
    const m = gl.scene; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) { o.material = o.material.clone(); const n = o.material.name || ''; const c = o.material.color; if (c) { if (/Skin/.test(n)) c.multiply(new THREE.Color(0.78, 0.68, 0.6)); else c.multiplyScalar(0.55).lerp(new THREE.Color(0x4a3c2c), 0.35) } o.material.roughness = 0.95 } } })
    const box = new THREE.Box3().setFromObject(m), s = 1.72 / (box.max.y - box.min.y); m.scale.setScalar(s)
    hermit.root = new THREE.Group(); hermit.root.add(m); group.add(hermit.root); hermit.root.visible = false
    hermit.mixer = new THREE.AnimationMixer(m)
    for (const a of gl.animations) hermit.acts[a.name] = hermit.mixer.clipAction(a)
    hermit.ready = true
    if (hermit.onReady) hermit.onReady()
  }).catch(e => console.warn('hermit', e))
  // 男の動き（game.js が state を決める）: hide 隠れている → out 道の脇から出てくる → wave 手を上げる → talk → give 渡す → aside 脇で見送る（出し直し後は手を振るだけ）
  const play = (name, fade = 0.25) => { const a = hermit.acts[name]; if (!a || hermit.cur === a) return; if (hermit.cur) hermit.cur.fadeOut(fade); a.reset().fadeIn(fade).play(); hermit.cur = a }
  hermit.set = (st) => { if (hermit.state === st) return; hermit.state = st; hermit.t = 0 }
  function hermitUpdate(dt, cam) {
    if (!hermit.ready || !hs) return
    const H = hermit, f = [Math.cos(hs.yaw), 0, -Math.sin(hs.yaw)], r = [Math.sin(hs.yaw), 0, Math.cos(hs.yaw)]
    H.t += dt
    const near = cam && Math.hypot(cam.x - hs.p[0], cam.z - hs.p[2]) < 120
    H.root.visible = near && H.state !== 'hide0'
    if (!near) return
    const edge = hs.w / 2 - 0.35, inRoad = hs.w / 2 - 1.1, toRider = hs.yaw - Math.PI / 2
    // 隠れている所: 道の先 7m の縁（瓦礫の陰）。そこから斜めに歩いて来て、道の右寄りで手を上げる
    let along = 0, lat = inRoad, a = toRider
    const walk = (u, a0, l0, a1, l1) => { along = a0 + (a1 - a0) * u; lat = l0 + (l1 - l0) * u; if (u < 1) a = Math.atan2(-((a1 - a0) * f[0] + (l1 - l0) * r[0]), -((a1 - a0) * f[2] + (l1 - l0) * r[2])) + Math.PI }
    if (H.state === 'hide') { along = 7; lat = edge; a = hs.yaw; play('Idle_Neutral') }
    else if (H.state === 'out') { const u = Math.min(1, H.t / 2.2); walk(u, 7, edge, 0, inRoad); play(u < 1 ? 'Walk' : 'Wave') }
    else if (H.state === 'wave') { play('Wave') }
    else if (H.state === 'bye') { lat = edge; play('Wave') }
    else if (H.state === 'talk') { play('Idle') }
    else if (H.state === 'give') { play('Interact') }
    else if (H.state === 'aside') { const u = Math.min(1, H.t / 0.9); walk(u, 0, inRoad, 0, edge); play(u < 1 ? 'Walk' : 'Idle_Neutral') }
    H.root.position.set(hs.p[0] + f[0] * along + r[0] * lat, hs.p[1], hs.p[2] + f[2] * along + r[2] * lat)
    H.root.rotation.y = a
    H.mixer.update(dt)
  }
  return {
    group, traces, hermit, tracks,
    update(dt, tm, cam) { for (const d of drums) d.update(dt, tm); hermitUpdate(dt, cam) },
  }
}

// 黄ばんだハンカチの絵（持ち物の札・もらった時の絵）。手で描いた線のにじみ
export function hankieDataURL() {
  const c = document.createElement('canvas'); c.width = c.height = 160; const g = c.getContext('2d'); seed = 55
  g.translate(80, 84); g.rotate(-0.12)
  g.fillStyle = '#d6c58e'; g.beginPath(); g.moveTo(-58, -50); g.lineTo(54, -56); g.lineTo(60, 48); g.lineTo(-52, 56); g.closePath(); g.fill()
  for (let i = 0; i < 9; i++) { const x = (rnd() - 0.5) * 90, y = (rnd() - 0.5) * 90, r = 6 + rnd() * 20, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(150,118,46,0.45)'); gr.addColorStop(1, 'rgba(150,118,46,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2) }
  g.strokeStyle = 'rgba(120,96,50,0.7)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-48, -40); g.lineTo(44, -45); g.lineTo(50, 38); g.lineTo(-42, 45); g.closePath(); g.stroke()
  g.strokeStyle = 'rgba(110,88,46,0.45)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-56, 2); g.quadraticCurveTo(0, -6, 58, 0); g.stroke(); g.beginPath(); g.moveTo(-2, -54); g.quadraticCurveTo(4, 0, 2, 54); g.stroke()
  g.strokeStyle = 'rgba(60,46,26,0.8)'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-58, -50); g.lineTo(54, -56); g.lineTo(60, 48); g.lineTo(-52, 56); g.closePath(); g.stroke()
  return c.toDataURL()
}
