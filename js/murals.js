// SKY BIKE v36 塔の壁の古い壁画 4 枚（世界が崩れた理由。字幕は出さない）。手で描いた線と色あせた顔料・剥がれ・ひび・煤
// ① 谷の町の人々が天空城を見上げる ② 人々が行列になって塔を登る ③ 城の光が強くなり、塔の上で人が消えていく（長い腕の小さな影が増える）④ 塔が崩れ、谷が霧に沈む（瓦礫に影が住みつく）
import * as THREE from 'three'

let seed = 9
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const W = 640, H = 400
const INK = 'rgba(34,26,20,0.88)', OCHRE = 'rgba(176,122,58,0.75)', UMBER = 'rgba(110,70,42,0.7)', INDIGO = 'rgba(58,72,96,0.7)', GOLD = 'rgba(214,170,80,0.8)', RED = 'rgba(140,52,36,0.7)'
// 手で引いた線（少し震える）
function line(g, pts, w = 3, col = INK) { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); pts.forEach(([x, y], i) => { const jx = x + (rnd() - 0.5) * 1.6, jy = y + (rnd() - 0.5) * 1.6; if (i) g.lineTo(jx, jy); else g.moveTo(jx, jy) }); g.stroke() }
function blob(g, x, y, rx, ry, col) { g.fillStyle = col; g.beginPath(); for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2, r = 1 + (rnd() - 0.5) * 0.16; g.lineTo(x + Math.cos(t) * rx * r, y + Math.sin(t) * ry * r) } g.fill() }
// 人（棒と頭。顔は描かない）
function person(g, x, y, s = 1, look = 0, col = INK) { line(g, [[x, y], [x, y - 14 * s]], 2.4 * s, col); blob(g, x + look * 1.5, y - 18 * s, 3.4 * s, 3.8 * s, col); line(g, [[x - 5 * s, y + 9 * s], [x, y], [x + 5 * s, y + 9 * s]], 2 * s, col); line(g, [[x - 5 * s, y - 6 * s + look * -6], [x, y - 11 * s], [x + 5 * s, y - 6 * s + look * -6]], 1.8 * s, col) }
// 長い腕の小さな影
function imp(g, x, y, s = 1) { blob(g, x, y - 8 * s, 5 * s, 6 * s, 'rgba(18,14,12,0.85)'); blob(g, x, y - 16 * s, 4 * s, 3.6 * s, 'rgba(18,14,12,0.85)'); line(g, [[x - 3 * s, y - 10 * s], [x - 10 * s, y - 2 * s], [x - 11 * s, y + 4 * s]], 1.6 * s, 'rgba(18,14,12,0.85)'); line(g, [[x + 3 * s, y - 10 * s], [x + 10 * s, y - 2 * s], [x + 12 * s, y + 4 * s]], 1.6 * s, 'rgba(18,14,12,0.85)'); g.fillStyle = 'rgba(230,200,120,0.9)'; g.fillRect(x - 2 * s, y - 17 * s, 1.4 * s, 1.2 * s); g.fillRect(x + 1 * s, y - 17 * s, 1.4 * s, 1.2 * s) }
function castle(g, x, y, s = 1, glow = 0) {
  if (glow) { const gr = g.createRadialGradient(x, y - 20 * s, 4, x, y - 20 * s, 150 * s * glow); gr.addColorStop(0, 'rgba(255,236,170,0.85)'); gr.addColorStop(1, 'rgba(255,236,170,0)'); g.fillStyle = gr; g.fillRect(x - 200, y - 220, 400, 360); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2; line(g, [[x + Math.cos(a) * 30 * s, y - 20 * s + Math.sin(a) * 30 * s], [x + Math.cos(a) * 120 * s * glow, y - 20 * s + Math.sin(a) * 110 * s * glow]], 2, 'rgba(214,170,80,0.55)') } }
  blob(g, x, y + 6 * s, 46 * s, 12 * s, UMBER) // 浮いた岩
  line(g, [[x - 40 * s, y + 4 * s], [x - 8 * s, y + 36 * s], [x + 30 * s, y + 6 * s]], 2.4, INK)
  g.fillStyle = OCHRE; g.fillRect(x - 30 * s, y - 26 * s, 60 * s, 28 * s)
  for (const dx of [-30, -8, 14]) { g.fillStyle = OCHRE; g.fillRect(x + dx * s, y - 46 * s, 14 * s, 22 * s); line(g, [[x + dx * s - 2, y - 46 * s], [x + (dx + 7) * s, y - 60 * s], [x + (dx + 16) * s, y - 46 * s]], 2.4, INK) }
  line(g, [[x - 30 * s, y + 2 * s], [x - 30 * s, y - 26 * s], [x + 30 * s, y - 26 * s], [x + 30 * s, y + 2 * s]], 2.6, INK)
}
function tower(g, x, y, h, w, broken = 0) {
  g.fillStyle = 'rgba(120,104,84,0.75)'; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x - w * 0.42, y - h); if (broken) { g.lineTo(x - w * 0.1, y - h + 18); g.lineTo(x + w * 0.05, y - h - 10); g.lineTo(x + w * 0.2, y - h + 24) } g.lineTo(x + w * 0.42, y - h); g.lineTo(x + w / 2, y); g.fill()
  line(g, [[x - w / 2, y], [x - w * 0.42, y - h]], 2.6); line(g, [[x + w / 2, y], [x + w * 0.42, y - h]], 2.6)
  for (let k = 1; k < 6; k++) { const yy = y - h * k / 6; line(g, [[x - w * 0.47 + k * 1.5, yy + 10], [x + w * 0.47 - k * 1.5, yy - 10]], 1.6, 'rgba(60,46,34,0.6)') } // らせんの道
}
function sky(g, top, bot) { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, W, H) }
const SCENES = [
  g => { // ① 見上げる
    sky(g, 'rgba(96,120,140,0.55)', 'rgba(170,150,110,0.5)')
    for (let k = 0; k < 4; k++) blob(g, 120 + k * 130, 60 + (k % 2) * 20, 70, 14, 'rgba(230,226,214,0.55)')
    castle(g, 330, 110, 1.1)
    g.fillStyle = 'rgba(126,98,70,0.7)'; g.fillRect(0, 300, W, 100)
    for (let k = 0; k < 9; k++) { const x = 30 + k * 70; g.fillStyle = k % 2 ? OCHRE : UMBER; g.fillRect(x, 262 - (k % 3) * 10, 46, 40 + (k % 3) * 10); line(g, [[x - 4, 262 - (k % 3) * 10], [x + 23, 242 - (k % 3) * 10], [x + 50, 262 - (k % 3) * 10]], 2.2) }
    for (let k = 0; k < 14; k++) person(g, 40 + k * 42 + (rnd() - 0.5) * 10, 352 + (rnd() - 0.5) * 8, 1.15, 1)
  },
  g => { // ② 行列になって塔を登る
    sky(g, 'rgba(110,128,140,0.5)', 'rgba(176,156,118,0.5)')
    castle(g, 520, 70, 0.7)
    tower(g, 300, 390, 330, 210)
    for (let k = 0; k < 26; k++) { const u = k / 26, yy = 380 - u * 300, side = Math.sin(u * Math.PI * 5), x = 300 + side * (100 - u * 18); person(g, x, yy, 0.75 - u * 0.25, side > 0 ? -1 : 1, k % 5 === 0 ? RED : INK) }
    line(g, [[0, 392], [W, 388]], 3, UMBER)
  },
  g => { // ③ 城の光が強くなり、塔の上で人が消えていく。長い腕の影が増える
    sky(g, 'rgba(130,120,110,0.5)', 'rgba(90,96,104,0.55)')
    castle(g, 320, 80, 0.85, 1.4)
    tower(g, 320, 395, 250, 190)
    for (let k = 0; k < 12; k++) { const u = k / 12, yy = 380 - u * 230, x = 320 + Math.sin(u * 12) * (90 - u * 30); person(g, x, yy, 0.7, 1, `rgba(34,26,20,${(0.85 * (1 - u * 0.95)).toFixed(2)})`) } // 上ほど薄く消える
    for (let k = 0; k < 7; k++) imp(g, 150 + k * 52 + (rnd() - 0.5) * 20, 392 - (k % 2) * 8, 0.9 + (k % 3) * 0.15)
  },
  g => { // ④ 塔が崩れ、谷が霧に沈む
    sky(g, 'rgba(84,96,104,0.55)', 'rgba(120,130,132,0.5)')
    castle(g, 470, 70, 0.6)
    tower(g, 180, 330, 200, 120, 1); tower(g, 400, 320, 140, 90, 1)
    for (let k = 0; k < 18; k++) blob(g, 60 + rnd() * 520, 300 + rnd() * 30, 10 + rnd() * 14, 6 + rnd() * 6, 'rgba(96,84,70,0.8)') // 瓦礫
    for (let k = 0; k < 4; k++) { g.fillStyle = `rgba(214,218,214,${0.4 + k * 0.12})`; g.beginPath(); g.moveTo(0, 300 + k * 24); for (let x = 0; x <= W; x += 20) g.lineTo(x, 300 + k * 24 + Math.sin(x * 0.03 + k) * 8); g.lineTo(W, H); g.lineTo(0, H); g.fill() }
    for (let k = 0; k < 5; k++) imp(g, 120 + k * 90, 300 - (k % 2) * 10, 0.8)
  },
]
// 古びさせる: 色あせ・ひび・煤・剥がれ（剥がれは透明にして、下の塔の石が見える）
function age(g, k) {
  for (let i = 0; i < 2200; i++) { const v = 120 + rnd() * 80; g.fillStyle = `rgba(${v},${v - 10},${v - 30},${0.05 + rnd() * 0.08})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 3) }
  const sg = g.createLinearGradient(0, H, 0, H * 0.4); sg.addColorStop(0, 'rgba(20,16,12,0.55)'); sg.addColorStop(1, 'rgba(20,16,12,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H) // 下からの煤
  g.strokeStyle = 'rgba(30,24,18,0.7)'; g.lineWidth = 1.4
  for (let i = 0; i < 7; i++) { let x = rnd() * W, y = rnd() * H; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 8; s++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.3) * 40; g.lineTo(x, y) } g.stroke() }
  g.globalCompositeOperation = 'destination-out'
  for (let i = 0; i < 6 + k; i++) { const x = rnd() * W, y = rnd() * H, r = 14 + rnd() * 40; g.beginPath(); for (let a = 0; a <= 20; a++) { const t = a / 20 * Math.PI * 2, rr = r * (0.6 + rnd() * 0.6); g.lineTo(x + Math.cos(t) * rr, y + Math.sin(t) * rr * 0.8) } g.fill() }
  for (let i = 0; i < 4; i++) { g.beginPath(); g.ellipse(rnd() < 0.5 ? 0 : W, rnd() * H, 30 + rnd() * 50, 40 + rnd() * 60, 0, 0, 7); g.fill() } // 端の欠け
  g.globalCompositeOperation = 'source-over'
}
export function muralTexture(k) {
  seed = 300 + k * 41
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d')
  g.fillStyle = '#b8a688'; g.fillRect(0, 0, W, H) // 漆喰
  SCENES[k](g); age(g, k)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t
}
// 置き場所: 道の割合 t の先で、塔の壁のすぐ横を走る所。壁の、少し先（目に入る所）に
export function muralSpots(course) {
  const P = course.path, N = (P.findIndex(q => q.branch) > 0 ? P.findIndex(q => q.branch) : P.length) - (course.v37added || 0), out = [] // v37 で足した終盤の道は数えない（置き場所を変えない）
  // 塔ごとに、道が塔の壁のすぐ横を回る点（壁から 1〜4m）。① 廃墟の塔の最初 ② 工場の塔の最初 ③ 鐘楼の塔の最初 ④ 鐘楼の塔の終わりの方
  const near = T => { const L = []; for (let i = 0; i < N - 8; i++) { const q = P[i]; if (!q.p || !q.w || !['orbit', 'road', 'curve', 'pad'].includes(q.kind)) continue; const d = Math.hypot(q.p[0] - T.cx, q.p[2] - T.cz) - T.r; if (d > 0.8 && d < q.w / 2 + 2 && q.p[1] > T.y0 + 1 && q.p[1] < (T.top2 ?? T.top) - 5) L.push(i) } return L }
  const T = course.towers || []
  const plan = [[0, 1, 0.08], [1, 2, 0.1], [2, 3, 0.15]]
  for (const [k, ti, f] of plan) {
    const tw = T[ti]; if (!tw) continue
    const L = near(tw); if (!L.length) continue
    const i = L[Math.min(L.length - 1, Math.floor(L.length * f))], q = P[i], q2 = P[i + 6]; if (!q2 || !q2.p) continue
    const th = Math.atan2(q.p[0] - tw.cx, q.p[2] - tw.cz), th2 = Math.atan2(q2.p[0] - tw.cx, q2.p[2] - tw.cz)
    let d = th2 - th; d = Math.atan2(Math.sin(d), Math.cos(d))
    out.push({ k, i, T: tw, th: th + Math.sign(d) * (2.5 / tw.r), y: q.p[1] }) // 2.5m 先の壁（塔の壁は外へふくらんでいるので、先すぎると曲がりの陰になる）
  }
  // ④ 終盤（86%）の、崩れた塔の壁の切れ端（道の脇に立つ大きな石の壁。当たりなし）
  for (let i = Math.floor(N * 0.86); i < N * 0.9; i++) { const q = P[i]; if (q.p && q.w >= 3 && ['road', 'orbit', 'pad'].includes(q.kind) && Math.abs(q.slope || 0) < 0.1) { out.push({ k: 3, i, wall: true, p: q.p.slice(), yaw: q.yaw, w: q.w }); break } }
  return out
}
export function buildMurals(course, scene) {
  const g = new THREE.Group(); g.name = 'murals'; scene.add(g)
  const spots = muralSpots(course)
  for (const s of spots) {
    if (s.wall) { // 崩れた壁の切れ端と、前の面の壁画（来る人の方へ少し向ける）
      const f = [Math.cos(s.yaw), 0, -Math.sin(s.yaw)], r = [Math.sin(s.yaw), 0, Math.cos(s.yaw)], at = [s.p[0] + f[0] * 9 + r[0] * (s.w / 2 + 1.6), s.p[1], s.p[2] + f[2] * 9 + r[2] * (s.w / 2 + 1.6)]
      const w = new THREE.Group(); w.position.set(...at); w.rotation.y = s.yaw - Math.PI / 2 + 0.55
      const st = new THREE.Mesh(new THREE.BoxGeometry(7, 7.5, 0.8), new THREE.MeshStandardMaterial({ color: 0x5c5a52, roughness: 0.95 })); st.position.y = 1.6; st.castShadow = true; w.add(st)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.9), new THREE.MeshStandardMaterial({ map: muralTexture(s.k), emissive: 0x3a3226, emissiveIntensity: 0.35, transparent: true, alphaTest: 0.4, roughness: 0.95 })); m.position.set(0, 3.1, 0.41); w.add(m)
      g.add(w); continue
    }
    const Wm = 6.2, Hm = 3.9, r = s.T.r + 0.42, tl = Wm / r // 塔の柱（壁から 0.15m 出る）と石の凹凸より外
    const geo = new THREE.CylinderGeometry(r, r, Hm, 24, 1, true, s.th - tl / 2, tl)
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: muralTexture(s.k), emissiveMap: null, emissive: 0x3a3226, emissiveIntensity: 0.35, transparent: true, alphaTest: 0.4, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -2 }))
    m.position.set(s.T.cx, s.y + 1.1 + Hm / 2, s.T.cz); m.receiveShadow = true
    g.add(m)
  }
  return { group: g, spots }
}
