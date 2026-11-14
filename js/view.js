// 見た目。コースの形（physics の box/cyl/arc）から、そのままメッシュを作る（走れる面は当たりと同じ形）。
// 飾り（塔の窓・張り出しの下の持ち送り・鎖・遠くの廃墟・溶岩・霧）は、手の届かない所だけに置く。
// 色はコンセプト画 B（霧の青緑と松明の橙）から取った: 石 #21221d #3b3b36 / 霧 #3a585f #497580 / もや #90afb3 / 火 #c27a40
import * as THREE from 'three'
import { mergeGeometries } from '../vendor/jsm/utils/BufferGeometryUtils.js'
import { arcPoint } from './physics.js?v=32'

export const PAL = { stoneD: 0x21221d, stone: 0x3b3b36, fogD: 0x3a585f, fog: 0x497580, mist: 0x90afb3, fire: 0xc27a40 }
const TEX = {}
const loader = new THREE.TextureLoader()
let maxAniso = 4
// 索引のない形に toNonIndexed を呼んでも警告を出さない（three はその時 this を返すだけ）
{ const tni = THREE.BufferGeometry.prototype.toNonIndexed; THREE.BufferGeometry.prototype.toNonIndexed = function () { return this.index ? tni.call(this) : this } }
export function setAniso(n) { maxAniso = n }
function tex(name, srgb) {
  const k = name + (srgb ? ':s' : '')
  if (TEX[k]) return TEX[k]
  const t = loader.load(`assets/tex/${name}.webp`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = maxAniso
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return (TEX[k] = t)
}
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
// 決まった値の雑音（岩の欠け）
function hash3(x, y, z) { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h) }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf)
  const L = (a, b, t) => a + (b - a) * t
  const c = (i, j, k) => hash3(xi + i, yi + j, zi + k)
  return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w)
}

// 材料: Poly Haven（CC0）の色・法線・ラフネス。color で絵の色に寄せる。rep は何 m で模様を1回くり返すか
function materials() {
  const M = {}
  const PBR = (n, rough = true) => ({ map: tex(n + '_diff', true), normalMap: tex(n + '_nor_gl'), ...(rough ? { roughnessMap: tex(n + '_rough') } : {}) })
  const def = (k, o, rep, ns = 1) => { const m = new THREE.MeshStandardMaterial(o); m.userData.rep = rep; if (ns !== 1) m.normalScale = new THREE.Vector2(ns, ns); M[k] = m; return m }
  def('cobble', { ...PBR('cobblestone_floor_08'), color: 0x9a9c94, roughness: 0.55 }, 2.4, 1.4)
  def('ruinwall', { ...PBR('medieval_blocks_02'), color: 0x77786f, roughness: 0.95 }, 2.6, 1.3)
  def('tower', { ...PBR('medieval_blocks_02'), color: 0x7c7d74, roughness: 0.95 }, 5.5, 1.4)
  def('basalt', { ...PBR('rock_boulder_dry'), color: 0x7a756b, roughness: 0.62 }, 3.2, 1.6)
  def('plank', { ...PBR('weathered_planks'), color: 0xb8a48a, roughness: 0.75 }, 2.2, 1.4)
  def('plankold', { ...PBR('weathered_planks'), color: 0x7a6650, roughness: 0.95 }, 1.6)
  def('grate', { ...PBR('rust_coarse_01'), color: 0xd8c0a6, roughness: 0.55, metalness: 0.05 }, 2.0, 1.6)
  def('rust', { ...PBR('rust_coarse_01'), color: 0xd4b69c, roughness: 0.62, metalness: 0.05 }, 2.4, 1.5)
  def('girder', { ...PBR('rust_coarse_01'), color: 0x8c5e44, roughness: 0.8, metalness: 0.4 }, 1.4)
  def('iron', { ...PBR('metal_plate_02'), color: 0x3c3a38, roughness: 0.55, metalness: 0.85 }, 1)
  def('edgesteel', { ...PBR('metal_plate_02'), color: 0xb0aaa0, roughness: 0.38, metalness: 0.75 }, 1) // ジャンプ台の縁の鉄の帯（光って見える明るさ）
  def('chain', { ...PBR('rust_coarse_01'), color: 0x5a4a40, roughness: 0.6, metalness: 0.8 }, 0.5)
  def('snowrock', { ...PBR('aerial_rocks_02'), color: 0xaab6ba, roughness: 0.8 }, 3.5, 1.4)
  def('ice', { ...PBR('snow_02'), color: 0xa8c4cc, roughness: 0.22, metalness: 0.05 }, 3)
  def('castle', { ...PBR('medieval_blocks_02'), color: 0x8f8a82, roughness: 0.9 }, 3, 1.2)
  def('column', { ...PBR('medieval_blocks_02'), color: 0x8a8a82, roughness: 0.9 }, 1.6, 1.4)
  def('marble', { ...PBR('medieval_blocks_02'), color: 0xa09c94, roughness: 0.85 }, 1.4, 1.2)
  def('rock', { ...PBR('aerial_rocks_02'), color: 0x7a7e7a, roughness: 0.92 }, 4, 1.4)
  def('rockdark', { ...PBR('rock_boulder_dry'), color: 0x48463f, roughness: 0.95 }, 6, 1.5)
  // 練習場など（色だけ暗い絵に寄せる）
  def('concrete', { map: tex('concrete_panels_diff', true), normalMap: tex('concrete_panels_nor_gl'), color: 0x8a8880, roughness: 0.85 }, 4)
  def('stone', { ...PBR('cobblestone_floor_08'), color: 0x9a9a92, roughness: 0.85 }, 2.6)
  def('dirt', { map: tex('dirt_diff', true), normalMap: tex('dirt_nor_gl'), color: 0x8a7a66, roughness: 0.95 }, 3)
  def('grass', { ...PBR('rock_boulder_dry'), color: 0x3e4440, roughness: 1 }, 8)
  def('ground', { ...PBR('aerial_rocks_02'), color: 0x6a6e66, roughness: 0.9 }, 6, 1.5)
  def('asphalt', { map: tex('asphalt_02_diff', true), normalMap: tex('asphalt_02_nor_gl'), color: 0x6a6c70, roughness: 0.9 }, 3)
  def('steel', { ...PBR('metal_plate_02'), color: 0x6a6e72, roughness: 0.55, metalness: 0.7 }, 2)
  def('pipe', { ...PBR('rust_coarse_01'), color: 0x7a706a, roughness: 0.5, metalness: 0.7 }, 3)
  def('log', { map: tex('japanese_cedar_bark_diff', true), normalMap: tex('japanese_cedar_bark_nor_gl'), color: 0x6a5a4a, roughness: 0.95 }, 1.2)
  def('wood', { ...PBR('weathered_planks'), color: 0x9c8a74, roughness: 0.9 }, 2.2)
  def('beam', { ...PBR('weathered_planks'), color: 0x8a7a66, roughness: 0.9 }, 2.2)
  def('pole', { ...PBR('metal_plate_02'), color: 0x3c3a38, roughness: 0.55, metalness: 0.85 }, 1)
  def('gold', { color: 0x8a6a2a, roughness: 0.45, metalness: 0.9 }, 1)
  def('banner', { color: 0x3a2a26, roughness: 0.9 }, 1)
  def('banner_gold', { color: 0x4a2a22, roughness: 0.9 }, 1)
  def('signboard', { ...PBR('weathered_planks'), color: 0x7a6650, roughness: 0.9 }, 1)
  def('liftdeck', { ...PBR('metal_plate_02'), color: 0x8c7a68, roughness: 0.6, metalness: 0.6 }, 1.5)
  def('mud', { map: tex('dirt_diff', true), normalMap: tex('dirt_nor_gl'), color: 0x4a3c2e, roughness: 0.38, metalness: 0.0 }, 2.2, 1.8)
  def('wetstone', { ...PBR('cobblestone_floor_08'), color: 0x5e6a66, roughness: 0.18 }, 2.4, 1.6)
  def('bridgeplank', { ...PBR('weathered_planks'), color: 0x8a7258, roughness: 0.85 }, 1.8, 1.4)
  def('boulder', { ...PBR('rock_boulder_dry'), color: 0x6e6a60, roughness: 0.9 }, 1.6, 1.5)
  def('crate', { ...PBR('weathered_planks'), color: 0x9a7a52, roughness: 0.85 }, 1.1, 1.6)
  def('rooftile', { ...PBR('castle_brick_07'), color: 0x6a5a50, roughness: 0.8 }, 1.6)
  return M
}
// 上の面と側面で材料を分ける（石畳の上面＋石積みの側面、のように）
const SIDE = { crate: 'crate', mud: 'ruinwall', wetstone: 'ruinwall', cobble: 'ruinwall', stone: 'ruinwall', castle: 'ruinwall', plank: 'plank', plankold: 'plankold', grate: 'rust', rust: 'rust', snowrock: 'snowrock', ice: 'snowrock', basalt: 'basalt', rock: 'rockdark', concrete: 'concrete' }
// 側面を内側へ欠けさせる量（上の面と上の縁は当たりとぴったり同じまま。欠けるのは内側だけ）
const CHIP = { ruinwall: 0.16, basalt: 0.28, snowrock: 0.22, rockdark: 0.35, castle: 0.1 }

// 面の向きから、世界の座標で模様を貼る（重なった板でも模様がずれない）
function worldUV(geo, rep) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i))
    let u, v
    if (ay >= ax && ay >= az) { u = x; v = z } else if (ax >= az) { u = z; v = y } else { u = x; v = y }
    uv[i * 2] = u / rep; uv[i * 2 + 1] = v / rep
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
function cylUV(geo, s, rep) {
  const p = geo.attributes.position, n = geo.attributes.normal, uv = new Float32Array(p.count * 2), c = [(s.a[0] + s.b[0]) / 2, (s.a[2] + s.b[2]) / 2]
  for (let i = 0; i < p.count; i++) {
    if (n && Math.abs(n.getY(i)) > 0.7) { uv[i * 2] = p.getX(i) / rep; uv[i * 2 + 1] = p.getZ(i) / rep; continue } // 上の面は真上から（渦の模様にしない）
    // 継ぎ目（角度が ±π で折り返す所）で模様が飛ばないように、三角形ごとに角度をそろえる
    const a = Math.atan2(p.getZ(i) - c[1], p.getX(i) - c[0]); uv[i * 2] = a * s.r / rep; uv[i * 2 + 1] = p.getY(i) / rep
  }
  for (let t = 0; t + 2 < p.count; t += 3) { const u0 = uv[t * 2], lim = Math.PI * s.r / rep; for (let k = 1; k < 3; k++) { const j = (t + k) * 2; if (uv[j] - u0 > lim) uv[j] -= 2 * lim; else if (u0 - uv[j] > lim) uv[j] += 2 * lim } }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
}
// 形の違う部品をまとめる（索引なし・位置と法線と模様の座標だけにそろえる）
function mergeLoose(arr) {
  const out = arr.map(g0 => { let g = g0.index ? g0.toNonIndexed() : g0; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g })
  return mergeGeometries(out)
}
const mkGeo = (a, uv) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); if (uv) { q.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); q.userData.uvM = true } q.computeVertexNormals(); return q }
// 形 → { top, side }（どちらも世界座標）
export function shapeGeometry(s, chip = 0) {
  if (s.type === 'box') {
    const seg = n => chip ? Math.min(40, Math.max(1, Math.round(n * 2 / 0.7))) : 1
    const g = new THREE.BoxGeometry(s.h[0] * 2, s.h[1] * 2, s.h[2] * 2, seg(s.h[0]), seg(s.h[1]), seg(s.h[2])).toNonIndexed()
    const pos = g.attributes.position, nor = g.attributes.normal, tops = [], sides = [], tuv = [], suv = []
    const A0 = s.ax[0], A2 = s.ax[2]
    const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(...s.ax[0]), new THREE.Vector3(...s.ax[1]), new THREE.Vector3(...s.ax[2])); m.setPosition(s.c[0], s.c[1], s.c[2])
    const v = new THREE.Vector3(), w = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i), top = ny > 0.5
      if (chip && !top && v.y < s.h[1] - 0.14) {
        // 内側へだけ欠けさせる（外へは出さない）。上の縁に近いほど小さく
        w.copy(v).applyMatrix4(m)
        const k = chip * (0.35 + 0.65 * vnoise(w.x * 0.9, w.y * 0.9, w.z * 0.9)) * Math.min(1, (s.h[1] - 0.14 - v.y) / 0.4)
        v.x -= nx * Math.min(k, s.h[0] * 0.4); v.y -= ny * Math.min(k, s.h[1] * 0.4); v.z -= nz * Math.min(k, s.h[2] * 0.4)
      }
      v.applyMatrix4(m)
      ;(top ? tops : sides).push(v.x, v.y, v.z)
      // 模様は箱の向きに沿って、世界の位置から（並んだ板で模様がつながる）
      const f = v.x * A0[0] + v.y * A0[1] + v.z * A0[2], r = v.x * A2[0] + v.y * A2[1] + v.z * A2[2]
      if (top || ny < -0.5) (top ? tuv : suv).push(f, r)
      else if (Math.abs(nz) > 0.5) suv.push(f, v.y)
      else suv.push(r, v.y)
    }
    return { top: mkGeo(tops, tuv), side: mkGeo(sides, suv) }
  } else if (s.type === 'cyl') {
    const seg = Math.min(200, Math.max(12, Math.ceil(Math.PI / Math.acos(1 - 0.0025 / s.r))))
    let g = new THREE.CylinderGeometry(s.r, s.r, s.L, seg, s.tag === 'tower' ? 8 : 1)
    const k = 1 / Math.cos(Math.PI / seg); g.scale(k, 1, k) // 角の数で内側に入る分を外接させて補う
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...s.d))
    g.applyQuaternion(q); g.translate((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2)
    g = g.toNonIndexed(); g.computeVertexNormals()
    return { top: null, side: g }
  }
  return arcGeometry(s)
}
function arcGeometry(s) {
  // 急な坂（ねじれた面）は、四角を2つの三角に割る所の高さのずれが 4mm を超えないように細かく割る
  const n = Math.min(400, Math.max(2, Math.ceil((s.phi1 - s.phi0) / (2 * Math.acos(1 - 0.004 / s.r2))), Math.ceil((s.phi1 - s.phi0) * Math.abs(s.b) / 0.016)))
  const top = [], side = [], tuv = [], suv = [], rm = (s.r1 + s.r2) / 2
  const P = (ph, r, h) => arcPoint(s, ph, r, h)
  const U = (arr, pts) => { for (const [ph, r, h, kind] of pts) arr.push(ph * rm, kind === 'r' ? r : (s.y0 + s.b * (ph - s.phi0)) + h) }
  const quad = (arr, a, b, c, d) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d) }
  const quadU = (arr, uarr, A, Bq, C, D) => { quad(arr, P(...A), P(...Bq), P(...C), P(...D)); U(uarr, [A, Bq, C, A, C, D]) }
  for (let i = 0; i < n; i++) {
    const a0 = s.phi0 + (s.phi1 - s.phi0) * i / n, a1 = s.phi0 + (s.phi1 - s.phi0) * (i + 1) / n
    const ro = s.r2 / Math.cos((a1 - a0) / 2), ri = s.r1
    const R = (ph, r, h) => [ph, r, h, 'r'], Hh = (ph, r, h) => [ph, r, h, 'h']
    quadU(top, tuv, R(a0, ri, 0), R(a0, ro, 0), R(a1, ro, 0), R(a1, ri, 0))
    quadU(side, suv, R(a0, ri, -s.thick), R(a1, ri, -s.thick), R(a1, ro, -s.thick), R(a0, ro, -s.thick))
    quadU(side, suv, Hh(a0, ro, 0), Hh(a0, ro, -s.thick), Hh(a1, ro, -s.thick), Hh(a1, ro, 0))
    quadU(side, suv, Hh(a0, ri, 0), Hh(a1, ri, 0), Hh(a1, ri, -s.thick), Hh(a0, ri, -s.thick))
  }
  const e = (ph, sg) => { const a = [ph, s.r1, 0, 'r'], b = [ph, s.r2, 0, 'r'], c = [ph, s.r2, -s.thick, 'r'], d = [ph, s.r1, -s.thick, 'r']; sg > 0 ? quadU(side, suv, a, d, c, b) : quadU(side, suv, a, b, c, d) }
  e(s.phi0, 1); e(s.phi1, -1)
  return { top: mkGeo(top, tuv), side: mkGeo(side, suv) }
}

// コース全体のメッシュ。区間（zone）× 90m の升目 × 材料ごとにまとめる（升目ごとに画面外・影の外を省ける）。
// 遠い升目は「影」用の軽いメッシュ（欠けなし・小物なし・模様なし・影なし）に切り替える。返り値の group は検査の光線にも使う
const HIDE = new Set(['barrel', 'statue']) // 模型で見せる物（当たりは同じ大きさの円柱）
const CELL = 90
const FAR_SKIP = new Set(['parapet', 'post', 'gate', 'sign', 'rail', 'log', 'web', 'flange', 'door', 'ball', 'pad', 'ceiling', 'pillar', 'barrel', 'statue', 'rock'])
const cellOf = s => { const x = (s.min[0] + s.max[0]) / 2, z = (s.min[2] + s.max[2]) / 2; return Math.floor(x / CELL) + ',' + Math.floor(z / CELL) }
// 遠景用の色（材料の模様の平均の明るさ × 色）
const FARC = { cobble: 0x4a4a44, ruinwall: 0x45453f, castle: 0x4c4a45, tower: 0x46463f, basalt: 0x3c3a35, rockdark: 0x2a2924, rock: 0x3e403c, snowrock: 0x6a7276, ice: 0x6a7c82, plank: 0x5a4c3c, plankold: 0x433628, grate: 0x4c3a2c, rust: 0x58402e, girder: 0x48301f, iron: 0x22211f, wetstone: 0x353d3a, mud: 0x2c241b, crate: 0x564430, bridgeplank: 0x4c3e2e, column: 0x48483f }
function farGeometry(s) {
  // 当たりと同じ外形（欠けなし）。弧は 3m ごとに割る
  if (s.type === 'arc') {
    const n = Math.max(2, Math.ceil((s.phi1 - s.phi0) * s.r2 / 3)), out = [], P = (ph, r, h) => arcPoint(s, ph, r, h)
    const q = (a, b, c, d) => out.push(...a, ...b, ...c, ...a, ...c, ...d)
    for (let i = 0; i < n; i++) {
      const a0 = s.phi0 + (s.phi1 - s.phi0) * i / n, a1 = s.phi0 + (s.phi1 - s.phi0) * (i + 1) / n
      q(P(a0, s.r1, 0), P(a0, s.r2, 0), P(a1, s.r2, 0), P(a1, s.r1, 0))
      q(P(a0, s.r1, -s.thick), P(a1, s.r1, -s.thick), P(a1, s.r2, -s.thick), P(a0, s.r2, -s.thick))
      q(P(a0, s.r2, 0), P(a0, s.r2, -s.thick), P(a1, s.r2, -s.thick), P(a1, s.r2, 0))
      q(P(a0, s.r1, 0), P(a1, s.r1, 0), P(a1, s.r1, -s.thick), P(a0, s.r1, -s.thick))
    }
    return out
  }
  if (s.type === 'box') {
    const c = s.c, h = s.h, A = s.ax, out = [], V = (i, j, k) => [0, 1, 2].map(d => c[d] + A[0][d] * h[0] * i + A[1][d] * h[1] * j + A[2][d] * h[2] * k)
    const f = (a, b, cc, d) => out.push(...a, ...b, ...cc, ...a, ...cc, ...d)
    f(V(-1, 1, -1), V(-1, 1, 1), V(1, 1, 1), V(1, 1, -1)); f(V(-1, -1, -1), V(1, -1, -1), V(1, -1, 1), V(-1, -1, 1))
    f(V(1, -1, -1), V(1, 1, -1), V(1, 1, 1), V(1, -1, 1)); f(V(-1, -1, -1), V(-1, -1, 1), V(-1, 1, 1), V(-1, 1, -1))
    f(V(-1, -1, 1), V(1, -1, 1), V(1, 1, 1), V(-1, 1, 1)); f(V(-1, -1, -1), V(-1, 1, -1), V(1, 1, -1), V(1, -1, -1))
    return out
  }
  if (s.type === 'cyl') {
    const g = new THREE.CylinderGeometry(s.r, s.r, s.L, 6, 1, true), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...s.d))
    g.applyQuaternion(q); g.translate((s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2, (s.a[2] + s.b[2]) / 2)
    return Array.from(g.toNonIndexed().attributes.position.array)
  }
  return []
}
let farMat = null
export function buildCourse(course, scene, nowZones = null) {
  const M = materials()
  const byMat = {}, movers = [], later = {}, chunks = new Map()
  const group = new THREE.Group(); group.name = 'course'
  farMat = farMat || new THREE.MeshLambertMaterial({ vertexColors: true })
  const chunkOf = key => { let ch = chunks.get(key); if (!ch) chunks.set(key, ch = { key, zone: key.split('|')[0], min: [1e9, 1e9, 1e9], max: [-1e9, -1e9, -1e9], det: [], far: null, built: false }); return ch }
  let curZone = 'x', curKey = 'x|0,0'
  const push = (k, g) => {
    if (!g || !g.attributes.position.count) return
    const rep = (M[k] || M.rock).userData.rep
    if (g.userData.uvM) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / rep, uv.getY(i) / rep) } else worldUV(g, rep)
    const key = curKey + '|' + k
    ;(byMat[key] = byMat[key] || []).push(g)
  }
  // 遠景の軽いメッシュ（全区間ぶん、最初に作る）
  const t0 = performance.now()
  const farPos = {}, farCol = {}, _c = new THREE.Color()
  for (const s of course.shapes) {
    if (s.mov || HIDE.has(s.tag) || FAR_SKIP.has(s.tag)) continue
    const z = s.zone || 'x'; if (z === 'x' || z === 'tower' || s.tag === 'tower') continue
    const key = z + '|' + cellOf(s), ch = chunkOf(key)
    for (let d = 0; d < 3; d++) { ch.min[d] = Math.min(ch.min[d], s.min[d]); ch.max[d] = Math.max(ch.max[d], s.max[d]) }
    const pos = farGeometry(s); if (!pos.length) continue
    _c.setHex(FARC[s.side || SIDE[s.mat] || s.mat] ?? 0x45453f)
    const P = farPos[key] = farPos[key] || [], C = farCol[key] = farCol[key] || []
    for (let i = 0; i < pos.length; i += 3) { P.push(pos[i], pos[i + 1], pos[i + 2]); C.push(_c.r, _c.g, _c.b) }
  }
  for (const key in farPos) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(farPos[key], 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(farCol[key], 3)); g.computeVertexNormals()
    const m = new THREE.Mesh(g, farMat); m.name = 'far:' + key; m.matrixAutoUpdate = false; m.userData.far = true
    chunkOf(key).far = m; group.add(m)
  }
  if (typeof window !== 'undefined' && window.__loadMarks) window.__loadMarks.far = Math.round(performance.now() - t0)
  for (const s of course.shapes) {
    if (HIDE.has(s.tag)) continue
    if (s.mov) {
      let g
      if (s.type === 'box') g = new THREE.BoxGeometry(s.h[0] * 2, s.h[1] * 2, s.h[2] * 2)
      else if (s.type === 'sph' && s.tag === 'rock') { g = new THREE.IcosahedronGeometry(s.r, 2); const P = g.attributes.position; for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), k = 0.82 + vnoise(x * 2.1 + 3, y * 2.1, z * 2.1) * 0.3; P.setXYZ(i, x * k, y * k * 0.9, z * k) } g.computeVertexNormals() }
      else if (s.type === 'sph') g = new THREE.SphereGeometry(s.r, 28, 18)
      else if (s.type === 'arc') { const ag = shapeGeometry(s); g = ag.top ? mergeGeometries([ag.top, ag.side].filter(Boolean).map(x => x.index ? x.toNonIndexed() : x)) : ag.side }
      else { g = shapeGeometry(s).side; g.translate(-(s.a[0] + s.b[0]) / 2, -(s.a[1] + s.b[1]) / 2, -(s.a[2] + s.b[2]) / 2) }
      if (g.index) g = g.toNonIndexed()
      const mat = M[s.mat] || M.rock // 材料は同じ物を使い回す（動く物が多くても、読み込みと描画を重くしない）
      if (s.type === 'box') { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s.h[0] * 2 / mat.userData.rep, uv.getY(i) * s.h[2] * 2 / mat.userData.rep) }
      else if (s.type !== 'sph') worldUV(g, s.type === 'arc' ? (mat.userData.rep || 2) : 1)
      const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; mesh.matrixAutoUpdate = false
      mesh.userData.shape = s; mesh.name = 'mover'
      group.add(mesh); movers.push(mesh)
      continue
    }
    curZone = s.zone || 'x'
    // 最初に見えない所は後から作る（読み込みを速く）。nowZones は区間の名前の Set か、形を受けて今作るかを返す関数。塔の柱・塔そのものは今作る
    if (nowZones && curZone !== 'x' && curZone !== 'tower' && s.tag !== 'tower' && !(typeof nowZones === 'function' ? nowZones(s) : nowZones.has(curZone))) { const lk = typeof nowZones === 'function' ? curZone + '|' + cellOf(s) : curZone; (later[lk] = later[lk] || []).push(s); continue }
    addStatic(s)
  }
  function addStatic(s) {
    curZone = s.zone || 'x'
    const always = curZone === 'x' || curZone === 'tower' || s.tag === 'tower'
    curKey = always ? 'tower|' + cellOf(s) : curZone + '|' + cellOf(s)
    const ch = chunkOf(curKey); ch.built = true
    for (let d = 0; d < 3; d++) { ch.min[d] = Math.min(ch.min[d], s.min[d]); ch.max[d] = Math.max(ch.max[d], s.max[d]) }
    if (always) ch.always = true
    const sideK = s.side || SIDE[s.mat] || s.mat
    const big = s.type === 'box' ? Math.max(1, Math.min(3, Math.min(s.h[0], s.h[2]) / 2)) : 1
    const { top, side } = shapeGeometry(s, s.type === 'box' && s.tag !== 'ground' ? (CHIP[sideK] || 0) * big : 0)
    if (s.tag === 'tower') { cylUV(side, s, M.tower.userData.rep); const k = curKey + '|tower'; (byMat[k] = byMat[k] || []).push(side); return }
    if (s.tag === 'pillar' && s.mat === 'tower') { push('column', side); return }
    push(s.mat, top); push(s.type === 'cyl' ? s.mat : sideK, side)
  }
  flush()
  scene.add(group)
  // 後から作る: 1 回に 1 区間（zone を渡すとその区間）。残りの区間の名前と、区間の道の真ん中の点
  const laterZones = () => Object.keys(later).map(z => { const L = later[z]; let x = 0, y = 0, w = 0; for (const s of L) { x += s.min[0] + s.max[0]; y += s.min[2] + s.max[2]; w += s.min[1] + s.max[1] } return { zone: z, at: [x / L.length / 2, w / L.length / 2, y / L.length / 2] } })
  const more = (zone) => { const z = zone || Object.keys(later)[0]; if (!z || !later[z]) return 0; for (const s of later[z]) addStatic(s); delete later[z]; flush(); return Object.keys(later).length + 1 }
  return { group, M, movers, more, laterZones, chunks: [...chunks.values()], chunkMap: chunks }
  function flush() {
  for (const key in byMat) {
    const parts = key.split('|'), k = parts[2], ch = chunks.get(parts[0] + '|' + parts[1])
    const mesh = new THREE.Mesh(mergeGeometries(byMat[key], false), M[k] || M.rock)
    mesh.castShadow = k !== 'tower'; mesh.receiveShadow = true; mesh.name = 'course:' + k; mesh.matrixAutoUpdate = false
    ch.det.push(mesh)
    group.add(mesh)
  }
  for (const k in byMat) delete byMat[k]
  }
}
// 升目ごとに、近い所は細かいメッシュ、遠い所は軽い影のメッシュ。とても遠い所は霧で見えないので描かない
export function updateLOD(chunks, cam, near = 230, farMax = 1600) {
  for (const ch of chunks) {
    const dx = Math.max(ch.min[0] - cam.x, 0, cam.x - ch.max[0]), dy = Math.max(ch.min[1] - cam.y, 0, cam.y - ch.max[1]), dz = Math.max(ch.min[2] - cam.z, 0, cam.z - ch.max[2])
    const d = Math.hypot(dx, dy, dz)
    const det = ch.always || (ch.built && d < (ch.det[0] && ch.det[0].visible ? near + 20 : near))
    for (const m of ch.det) m.visible = det && d < farMax
    if (ch.far) ch.far.visible = !det && d < farMax
  }
}
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3()
export function updateMovers(movers, world, cam) {
  for (const mesh of movers) {
    const s = mesh.userData.shape
    // 遠い動く物は描かない（動きの計算は物理の側で続く）
    if (cam) { const c = s.c || s.a || (s.min && [(s.min[0] + s.max[0]) / 2, (s.min[1] + s.max[1]) / 2, (s.min[2] + s.max[2]) / 2]); if (c && Math.hypot(c[0] - cam.x, c[1] - cam.y, c[2] - cam.z) > 260) { mesh.visible = false; continue } }
    if (s.type === 'box') {
      _m.makeBasis(_x.set(...s.ax[0]), _y.set(...s.ax[1]), _z.set(...s.ax[2]))
      let ox = 0, oy = 0
      if (s.mov.type === 'crumble' && s.touch > 0 && !s.gone) { ox = (Math.random() - 0.5) * 0.05 * s.touch / s.mov.delay; oy = (Math.random() - 0.5) * 0.04 }
      else if (s.mov.type === 'crumble' && s.preWarn != null && !s.gone && world.time - s.preWarn < 4) { const k = Math.min(1, (world.time - s.preWarn) * 2); ox = (Math.random() - 0.5) * 0.04 * k; oy = -0.07 * k + (Math.random() - 0.5) * 0.03 } // v32 前の板: 先にひびが入って揺れ、少し沈む（見た目だけ）
      // v31: 崩れた板は、その場で消さずに 1.2 秒かけて回りながら落ちる（後ろで崩れ落ちるのが見える）
      const fa = s.mov.type === 'crumble' && s.gone && s.goneAt != null ? world.time - s.goneAt : -1
      if (fa >= 0 && fa < 1.2) { const k = s.id % 2 ? 1 : -1; _m.premultiply(_r.makeRotationAxis(_y.set(...s.ax[2]).normalize(), k * fa * 1.4)); oy -= 4.9 * fa * fa + fa * 0.6 }
      _m.setPosition(s.c[0] + ox, s.c[1] + oy, s.c[2])
      mesh.visible = !s.gone || (fa >= 0 && fa < 1.2)
    } else if (s.type === 'arc') {
      // 抜ける床・崩れる敷石: その場で、抜ける前はガタガタ揺れ、抜けたら消える
      const sh = s.warnT != null && !s.gone ? 0.05 : (s.mov.type === 'crumble' && s.touch > 0 && !s.gone ? 0.04 * s.touch / s.mov.delay : (s.mov.type === 'crumble' && s.preWarn != null && !s.gone && world.time - s.preWarn < 4 ? 0.06 : 0))
      const fa = s.mov.type === 'crumble' && s.gone && s.goneAt != null ? world.time - s.goneAt : -1 // v31: 崩れた敷石は 1.2 秒かけて落ちる
      _m.makeTranslation(sh ? (Math.random() - 0.5) * sh : 0, (sh ? -Math.random() * sh : 0) - (fa >= 0 && fa < 1.2 ? 4.9 * fa * fa + fa * 0.6 : 0), 0); mesh.visible = !s.gone || (fa >= 0 && fa < 1.2)
    } else if (s.type === 'sph') {
      // 鉄球は振れる向きに少し回し、岩は落ちながら転がす
      const a = s.mov.type === 'drop' ? world.time * 3.1 + s.id : (s.c[0] + s.c[2]) * 0.4
      _m.makeRotationAxis(_x.set(0.6, 0.3, 0.74).normalize(), a); _m.setPosition(s.c[0], s.c[1], s.c[2]); mesh.visible = !s.gone
    } else { _m.makeRotationY(s.mov.rate * world.time); _m.setPosition(s.c[0], s.c[1], s.c[2]) }
    mesh.matrix.copy(_m); mesh.matrixWorldNeedsUpdate = true
  }
}

// ------------------------------------------------------------ 飾り（手の届かない所だけ）
// 道の点を 8m の升目に入れて、近くだけ調べる（広い世界でも速く）
const PGC = 8
function pgrid(course) {
  if (course._pg && course._pgN === course.path.length) return course._pg
  const G = new Map()
  for (const q of course.path) { if (!q.p) continue; const k = Math.floor(q.p[0] / PGC) * 100000 + Math.floor(q.p[2] / PGC); let L = G.get(k); if (!L) G.set(k, L = []); L.push(q) }
  course._pgN = course.path.length
  return (course._pg = G)
}
function anyNear(course, x, z, rh, fn) {
  const G = pgrid(course), r = Math.ceil(rh / PGC), i0 = Math.floor(x / PGC), k0 = Math.floor(z / PGC)
  for (let i = -r; i <= r; i++) for (let k = -r; k <= r; k++) { const L = G.get((i0 + i) * 100000 + k0 + k); if (L) for (const q of L) if (fn(q)) return true }
  return false
}
function nearPath(course, x, y, z, rh, rv) { return anyNear(course, x, z, rh, q => Math.abs(q.p[1] - y) < rv && Math.hypot(q.p[0] - x, q.p[2] - z) < rh) }
// 道から横にどれだけ離れているか（rmax まで調べる）
function pathDist(course, x, z, rmax) { let best = rmax; anyNear(course, x, z, rmax, q => { const d = Math.hypot(q.p[0] - x, q.p[2] - z); if (d < best) best = d; return false }); return best }
const onTower = (s, T) => s.type === 'arc' && Math.abs(s.cx - T.cx) < 0.01 && Math.abs(s.cz - T.cz) < 0.01 && Math.abs(s.r1 - T.r) < 0.01
// ステンドグラス（割れて抜けた所は暗い）
function glassTexture(k) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const g = c.getContext('2d')
  seed = 31 + k * 7
  const cols = ['#6a1c1a', '#9a3026', '#b8a47e', '#2a4060', '#c8b890', '#4a2434', '#7a5a26']
  g.fillStyle = '#060606'; g.fillRect(0, 0, 128, 256)
  for (let y = 0; y < 256; y += 18) for (let x = 0; x < 128; x += 16) {
    const broken = rnd() < 0.24
    g.fillStyle = broken ? '#040404' : cols[Math.floor(rnd() * cols.length)]
    g.beginPath(); g.moveTo(x + rnd() * 4, y + rnd() * 4); g.lineTo(x + 16 - rnd() * 4, y + rnd() * 5); g.lineTo(x + 16, y + 18 - rnd() * 4); g.lineTo(x + rnd() * 5, y + 18); g.closePath(); g.fill()
  }
  g.strokeStyle = '#0c0c0c'; g.lineWidth = 3
  for (let x = 0; x <= 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke() }
  g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.stroke()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
function clothTexture() { return canvasT(64, 192, (g, w, h) => { seed = 5; g.fillStyle = '#3e1d1a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${20 + rnd() * 30},${10 + rnd() * 10},${8 + rnd() * 8},0.25)`; g.fillRect(rnd() * w, rnd() * h, 2, 6) } g.strokeStyle = 'rgba(120,90,50,0.6)'; g.lineWidth = 3; g.strokeRect(6, 4, w - 12, h * 0.55); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 4) g.lineTo(x, h - 10 - rnd() * 60 * (x % 16 < 8 ? 1 : 0.4)); g.lineTo(w, h); g.fill(); for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(rnd() * w, rnd() * h * 0.9, 2 + rnd() * 6, 0, 7); g.fill() } }) }
function ivyTexture() { return canvasT(128, 256, (g, w, h) => { seed = 9; for (let k = 0; k < 9; k++) { let x = rnd() * w, y = 0; g.strokeStyle = 'rgba(40,46,30,0.95)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); while (y < h * (0.5 + rnd() * 0.5)) { x += (rnd() - 0.5) * 8; y += 6; g.lineTo(x, y); if (rnd() < 0.8) { g.save(); g.fillStyle = `rgb(${34 + rnd() * 30},${44 + rnd() * 34},${26 + rnd() * 18})`; g.beginPath(); g.ellipse(x + (rnd() - 0.5) * 10, y, 3 + rnd() * 4, 2 + rnd() * 3, rnd() * 3, 0, 7); g.fill(); g.restore() } } g.stroke() } }) }
function poolTexture() { return canvasT(64, 64, (g) => { const gr = g.createRadialGradient(32, 30, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64) }) }
function grassTexture() { return canvasT(64, 64, (g) => { seed = 13; for (let i = 0; i < 26; i++) { const x = 6 + rnd() * 52, hh = 20 + rnd() * 40; g.strokeStyle = `rgb(${50 + rnd() * 30},${58 + rnd() * 30},${36 + rnd() * 16})`; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, 64); g.quadraticCurveTo(x + (rnd() - 0.5) * 10, 64 - hh * 0.6, x + (rnd() - 0.5) * 18, 64 - hh); g.stroke() } }) }
// 草（道の縁と壁ぎわ。やわらかい物なので当たりは無い）
export function buildGrass(course, scene, T = course.tower) {
  if (!T) return null
  const pts = []
  seed = 17
  for (const sh of course.shapes) {
    if (!onTower(sh, T) || sh.mat === 'grate' || sh.mat === 'ice' || sh.mat === 'rust') continue
    const n = Math.floor((sh.phi1 - sh.phi0) * sh.r2 / 0.9)
    for (let j = 0; j < n; j++) for (const r of [sh.r1 + 0.5, sh.r2 - 0.45]) { if (rnd() < 0.4) continue; const ph = sh.phi0 + (sh.phi1 - sh.phi0) * (j + rnd()) / n; pts.push([T.cx + Math.cos(ph) * r, sh.y0 + sh.b * (ph - sh.phi0), T.cz - Math.sin(ph) * r, rnd() * 3, 0.9 + rnd() * 0.9]) }
  }
  const geo = new THREE.PlaneGeometry(0.5, 0.36); geo.translate(0, 0.18, 0)
  const g2 = geo.clone(); g2.rotateY(Math.PI / 2); const cross = mergeGeometries([geo, g2])
  const mat = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1 })
  const im = new THREE.InstancedMesh(cross, mat, pts.length), o = new THREE.Object3D()
  pts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.rotation.set(0, p[3], 0); o.scale.setScalar(p[4]); o.updateMatrix(); im.setMatrixAt(i, o.matrix) })
  im.name = 'grass'; if (scene) scene.add(im)
  return im
}
// 尖ったアーチの形（下が四角、上が尖る）
function archShape(w, h) {
  const s = new THREE.Shape(), k = h - w * 0.8
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, k)
  s.quadraticCurveTo(w / 2, h - w * 0.15, 0, h); s.quadraticCurveTo(-w / 2, h - w * 0.15, -w / 2, k); s.lineTo(-w / 2, 0)
  return s
}
export function buildDecor(course, scene, M, T = course.tower) {
  const g = new THREE.Group(); g.name = 'decor'
  const wallFlames = []
  if (T) {
    g.userData.ctr = [T.cx, (T.y0 + T.top) / 2, T.cz]
    const TOP = (T.top2 ?? T.top ?? 50)
    // 壁の飾りは、張り出しから離れた高さ（その角度で、道が 2.8m 下〜0.6m 上にない所）だけ
    const wallPt = (a, r) => [T.cx + Math.cos(a) * r, T.cz - Math.sin(a) * r]
    const free = (a, y0, y1, rh = 4.6) => { const [x, z] = wallPt(a, T.r); return !anyNear(course, x, z, rh, q => q.p[1] > y0 - 2.8 && q.p[1] < y1 + 0.6 && Math.hypot(q.p[0] - x, q.p[2] - z) < rh) }
    const P = (T.pillars || course.pillars || []).slice().sort((x, y) => x - y)
    const y00 = Math.max(course.lavaY ?? -30, T.y0 - 40) // 窓は塔の道の少し下から上へ（溶岩の下まで並べない）
    const gaps = P.map((a, i) => { let b = P[(i + 1) % P.length]; if (b <= a) b += Math.PI * 2; return [a, b] })
    // 柱と柱の間に、尖ったアーチの枠と割れたステンドグラスの窓（高さはばらばら）
    const glassMats = [0, 1, 2].map(k => { const t = glassTexture(k); return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: new THREE.Color(0xffc890), emissiveIntensity: 0.7, roughness: 0.25, metalness: 0.1 }) })
    const wg = new THREE.ShapeGeometry(archShape(1.5, 3.6), 6)
    const fg = new THREE.ExtrudeGeometry(archShape(2.1, 4.3), { depth: 0.3, bevelEnabled: false, curveSegments: 6 }); fg.translate(0, -0.35, -0.28)
    const big = new THREE.ExtrudeGeometry((() => { const o = archShape(4.6, 7.6), h = archShape(4.0, 7.0); o.holes.push(new THREE.Path(h.getPoints(24).map(q => new THREE.Vector2(q.x, Math.max(0.15, q.y))))); return o })(), { depth: 0.22, bevelEnabled: false, curveSegments: 8 }); big.translate(0, -0.3, -0.18)
    const fgs = [], wins = []
    seed = 41 + Math.round(T.cx)
    for (const [a0, a1] of gaps) {
      const am = (a0 + a1) / 2, span = (a1 - a0) * T.r
      for (let y = y00; y < TOP - 5; y += 2) {
        if (wins.some(w => Math.abs(w.a - am) < 0.01 && Math.abs(w.y - y) < 6.5)) continue
        if (!free(am, y, y + 4.2, 4.2)) continue
        if (rnd() < 0.25) continue
        wins.push({ a: am + (rnd() - 0.5) * 0.04, y, arcade: span > 5.5 && free(am, y - 0.3, y + 7.4, 5.2) })
      }
    }
    let k = 0
    const bigs = [], panes = [[], [], []]
    for (const w of wins) {
      const o = new THREE.Object3D(); o.position.set(T.cx + Math.cos(w.a) * (T.r + 0.05), w.y, T.cz - Math.sin(w.a) * (T.r + 0.05)); o.rotation.y = w.a + Math.PI / 2; o.updateMatrix()
      const pg = wg.clone(); pg.applyMatrix4(o.matrix); panes[k++ % 3].push(pg) // 窓ガラスは材料ごとに 1 つにまとめる（描画の回数を減らす）
      const f = fg.clone(); f.applyMatrix4(o.matrix); fgs.push(f.toNonIndexed())
      if (w.arcade) { const bg = big.clone(); bg.applyMatrix4(o.matrix); bigs.push(bg.toNonIndexed()) }
    }
    panes.forEach((arr, j) => { if (arr.length) g.add(new THREE.Mesh(mergeGeometries(arr), glassMats[j])) })
    for (const arr of [fgs, bigs]) if (arr.length) { const geo = mergeGeometries(arr); geo.computeVertexNormals(); worldUV(geo, 2); const fm = new THREE.Mesh(geo, M.ruinwall); fm.receiveShadow = true; g.add(fm) }
    // 柱の帯（張り出しから離れた高さだけ）と、柱から垂れる旗の切れ端
    const bands = [], banners = []
    for (const a of P) for (let y = y00 + 1; y < TOP - 2; y += 5.5 + rnd() * 3) {
      if (!free(a, y - 0.4, y + 0.4, 3.2)) continue
      const tg = new THREE.TorusGeometry(0.37, 0.06, 6, 16); tg.rotateX(Math.PI / 2); const [x, z] = wallPt(a, T.r - 0.17); tg.translate(x, y, z); bands.push(tg.toNonIndexed())
      if (rnd() < 0.35 && free(a, y - 3.2, y, 3.6)) banners.push({ a, y })
    }
    if (bands.length) { const geo = mergeGeometries(bands); geo.computeVertexNormals(); worldUV(geo, 1); g.add(new THREE.Mesh(geo, M.column)) }
    const banM = new THREE.MeshStandardMaterial({ map: clothTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 })
    for (const bn of banners) { const pg = new THREE.PlaneGeometry(0.9, 2.8, 1, 6), pp = pg.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getY(i) * 1.7) * 0.06); pg.translate(0, -1.4, 0); const m = new THREE.Mesh(pg, banM); const [x, z] = wallPt(bn.a, T.r + 0.22); m.position.set(x, bn.y, z); m.rotation.y = bn.a + Math.PI / 2; g.add(m) }
    // ツタと苔（壁にぴったり。張り出しの下の外側にも垂らす）
    const ivyM = new THREE.MeshStandardMaterial({ map: ivyTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 })
    const ivy = []
    for (let i = 0; i < 70; i++) {
      const a = rnd() * Math.PI * 2, y = y00 + rnd() * (TOP - 4 - y00), h = 2 + rnd() * 4
      if (!free(a, y - h, y, 3.6)) continue
      const pg = new THREE.PlaneGeometry(1.2 + rnd() * 1.4, h); pg.translate(0, -h / 2, 0)
      const o = new THREE.Object3D(); const [x, z] = wallPt(a, T.r + 0.06); o.position.set(x, y, z); o.rotation.y = a + Math.PI / 2; o.updateMatrix(); pg.applyMatrix4(o.matrix); ivy.push(pg)
    }
    for (const sh of course.shapes) {
      if (!onTower(sh, T)) continue
      const n = Math.floor((sh.phi1 - sh.phi0) * sh.r2 / 3.5)
      for (let j = 0; j < n; j++) {
        if (rnd() < 0.45) continue
        const ph = sh.phi0 + (sh.phi1 - sh.phi0) * (j + rnd()) / n, y = sh.y0 + sh.b * (ph - sh.phi0) - 0.05, h = 1.2 + rnd() * 2.6
        const [x, z] = wallPt(ph, sh.r2 + 0.04)
        if (nearPath(course, x, y - h / 2 - 1, z, 2.2, h / 2 + 1.2)) continue
        const pg = new THREE.PlaneGeometry(0.8 + rnd() * 1.2, h); pg.translate(0, -h / 2, 0)
        const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.y = ph + Math.PI / 2; o.updateMatrix(); pg.applyMatrix4(o.matrix); ivy.push(pg)
      }
    }
    if (ivy.length) g.add(new THREE.Mesh(mergeGeometries(ivy), ivyM))
    // 張り出しの下の持ち送り（石の腕、工場は鉄の腕）。張り出しの真下だけ
    const cor = [], strut = []
    for (const s of course.shapes) {
      if (!onTower(s, T) || s.mov) continue
      const n = Math.max(1, Math.floor((s.phi1 - s.phi0) * s.r2 / 3.2))
      for (let i = 0; i < n; i++) {
        const ph = s.phi0 + (s.phi1 - s.phi0) * (i + 0.5) / n
        const y = s.y0 + s.b * (ph - s.phi0) - s.thick
        const depth = s.r2 - s.r1 - 0.3, h = s.mat === 'grate' ? 1.8 : 1.2
        const geo = new THREE.BoxGeometry(depth, h, s.mat === 'grate' ? 0.3 : 0.6)
        const p = geo.attributes.position
        for (let j = 0; j < p.count; j++) if (p.getY(j) < 0) p.setX(j, p.getX(j) * 0.2 - depth * 0.4)
        geo.translate(depth / 2, -h / 2, 0)
        const o = new THREE.Object3D(); o.position.set(s.cx + Math.cos(ph) * s.r1, y, s.cz - Math.sin(ph) * s.r1); o.rotation.y = ph; o.updateMatrix()
        geo.applyMatrix4(o.matrix)
        ;(s.mat === 'grate' ? strut : cor).push(geo.toNonIndexed())
      }
    }
    for (const [arr, mt] of [[cor, M.ruinwall], [strut, M.girder]]) if (arr.length) { const geo = mergeGeometries(arr); geo.computeVertexNormals(); worldUV(geo, mt.userData.rep); const m = new THREE.Mesh(geo, mt); m.castShadow = true; m.receiveShadow = true; g.add(m) }
    // 塔の壁の松明（張り出しの内側の壁、頭より上）
    for (let i = 0; i < course.path.length; i += 12) {
      const q = course.path[i]; if (q.kind !== 'orbit' || !q.p || q.branch) continue
      if (Math.hypot(q.p[0] - T.cx, q.p[2] - T.cz) > T.rm + 2.5 || q.p[1] < T.y0 - 2 || q.p[1] > T.top + 2) continue // この塔のまわりの道だけ
      const a = Math.atan2(-(q.p[2] - T.cz), q.p[0] - T.cx)
      wallFlames.push([T.cx + Math.cos(a) * (T.r + 0.42), q.p[1] + 2.75, T.cz - Math.sin(a) * (T.r + 0.42), 0])
    }
    // 欠けた石の縁の上の灯り（下の周回が灯りの点々で見える）
    seed = 61
    for (const sh of course.shapes) if (sh.tag === 'parapet' && rnd() < 0.42 && Math.hypot(sh.c[0] - T.cx, sh.c[2] - T.cz) < T.r + 9 && sh.c[1] > T.y0 - 3 && sh.c[1] < T.top + 3) wallFlames.push([sh.c[0], sh.c[1] + sh.h[1] + 0.12, sh.c[2], 2])
    // 壁の松明のまわりの、壁に落ちる光のにじみ（光るだけの板）
    const poolM = new THREE.MeshBasicMaterial({ map: poolTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(1.1, 0.55, 0.22), polygonOffset: true, polygonOffsetFactor: -4 })
    const pools = []
    for (const f of wallFlames) { if (f[3] !== 0) continue; const a = Math.atan2(-(f[2] - T.cz), f[0] - T.cx); const pg = new THREE.PlaneGeometry(4.2, 4.6); const o = new THREE.Object3D(); o.position.set(T.cx + Math.cos(a) * (T.r + 0.08), f[1] - 0.3, T.cz - Math.sin(a) * (T.r + 0.08)); o.rotation.y = a + Math.PI / 2; o.updateMatrix(); pg.applyMatrix4(o.matrix); pools.push(pg) }
    if (pools.length) { const m = new THREE.Mesh(mergeGeometries(pools), poolM); m.renderOrder = 3; g.add(m) }
    var grass = buildGrass(course, scene, T) // 草は柔らかい物（当たりなし）。検査で別に数えるため、塔の飾りとは別の物にする
    if (grass) grass.userData.ctr = g.userData.ctr
  }
  if (T) { if (scene) scene.add(g); return { group: g, wallFlames, grass } }
  const roofM = new THREE.MeshStandardMaterial({ color: 0x2a3034, roughness: 0.6, metalness: 0.4 })
  for (const d of course.decor) if (d.kind === 'roof') { const m = new THREE.Mesh(new THREE.ConeGeometry(d.r, d.h, 8), roofM); m.position.set(d.p[0], d.p[1] + d.h / 2, d.p[2]); m.castShadow = true; g.add(m) }
  scene.add(g)
  return { group: g, wallFlames }
}

// 鎖（輪をつないだ物。InstancedMesh でまとめて描く）
// 中ほどの距離に浮く廃墟の島（アーチ・折れた柱・松明）。どの道からも 18m 以上離す。手は届かない
export function buildFloaters(course, scene, M) {
  const T = (course.towers || [])[0] || course.tower; if (!T) return { group: null, flames: [] }
  const g = new THREE.Group(); g.name = 'floaters'
  seed = 211
  const rocks = [], stone = [], flames = []
  const arch = (x, y, z, ang, w, h, d) => { const e = new THREE.ExtrudeGeometry((() => { const o = archShape(w, h), hole = archShape(w - 0.9, h - 0.6); o.holes.push(new THREE.Path(hole.getPoints(20).map(q => new THREE.Vector2(q.x, Math.max(0.05, q.y))))); return o })(), { depth: d, bevelEnabled: false, curveSegments: 8 }); e.translate(0, 0, -d / 2); e.rotateY(ang); e.translate(x, y, z); stone.push(e.toNonIndexed()) }
  const island = (x, y, z, s, lit, detail) => {
    const rg = new THREE.IcosahedronGeometry(1, detail ? 3 : 2), p = rg.attributes.position, v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(0.72 + 0.56 * vnoise(v.x * 2 + x, v.y * 2, v.z * 2 + z)); if (v.y > 0) v.y *= 0.1; else v.y *= 1.5 + (-v.y) * 1.2; p.setXYZ(i, v.x, v.y, v.z) }
    rg.scale(s, s * 0.9, s * 0.8); rg.rotateY(rnd() * 3); rg.translate(x, y, z); rg.computeVertexNormals(); rocks.push(rg.toNonIndexed())
    const top = y + s * 0.08, ang = rnd() * Math.PI
    // 廃墟の輪郭: 尖ったアーチ（1〜2つ）・折れた柱・崩れた壁・小さな尖塔
    const na = 1 + Math.floor(rnd() * 2)
    for (let k = 0; k < na; k++) { const w = s * (0.45 + rnd() * 0.25), h = w * (1.4 + rnd() * 0.5); const off = (k - (na - 1) / 2) * w * 0.95; arch(x + Math.cos(ang) * off, top, z - Math.sin(ang) * off, ang, w, h, 0.7) }
    for (let j = 0; j < 2 + Math.floor(rnd() * 3); j++) { const h = 1.5 + rnd() * s * 0.6, cg = new THREE.CylinderGeometry(0.4, 0.46, h, 10); cg.translate(x + (rnd() - 0.5) * s, top + h / 2, z + (rnd() - 0.5) * s * 0.6); stone.push(cg.toNonIndexed()) }
    if (rnd() < 0.6) { const wh = 2 + rnd() * 3, wg = new THREE.BoxGeometry(s * 0.7, wh, 0.6, 4, 2, 1); const pp = wg.attributes.position; for (let i = 0; i < pp.count; i++) if (pp.getY(i) > 0) pp.setY(i, pp.getY(i) - rnd() * wh * 0.6); wg.translate(0, top + wh / 2, s * 0.25); wg.rotateY(ang + 0.4); wg.translate(x, 0, z); stone.push(wg.toNonIndexed()) }
    if (rnd() < 0.45) { const sh = s * (1.2 + rnd()), tw = new THREE.BoxGeometry(s * 0.35, sh, s * 0.35); tw.translate(x - s * 0.3, top + sh / 2, z + s * 0.2); stone.push(tw.toNonIndexed()); const cap = new THREE.ConeGeometry(s * 0.3, sh * 0.5, 4); cap.rotateY(Math.PI / 4); cap.translate(x - s * 0.3, top + sh * 1.25, z + s * 0.2); stone.push(cap.toNonIndexed()); if (lit) flames.push([x - s * 0.3 + s * 0.18, top + sh * 0.7, z + s * 0.2, 1]) }
    if (lit) { const fx = x + (rnd() - 0.5) * s * 0.5, fz = z + (rnd() - 0.5) * s * 0.3; flames.push([fx, top + 1.5, fz, 1]); const post = new THREE.CylinderGeometry(0.2, 0.25, 1.25, 8); post.translate(fx, top + 0.62, fz); stone.push(post.toNonIndexed()) }
  }
  // 3層: 近い（はっきり・灯りあり）、中ほど（輪郭）、遠い（霧に沈む）
  for (const [n, r0, r1, s0, s1, lit, det] of []) {
    let made = 0
    for (let k = 0; k < n * 5 && made < n; k++) {
      const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0), y = -14 + rnd() * 72
      const x = T.cx + Math.cos(a) * r, z = T.cz - Math.sin(a) * r, s = s0 + rnd() * (s1 - s0)
      if (nearPath(course, x, y, z, 16 + s * 1.6, 18)) continue
      island(x, y, z, s, lit, det); made++
    }
  }
  for (const [arr, mt, smooth] of [[rocks, M.rockdark, true], [stone, M.ruinwall, false]]) if (arr.length) { const geo = mergeGeometries(arr); if (!smooth) geo.computeVertexNormals(); worldUV(geo, mt.userData.rep); const m = new THREE.Mesh(geo, mt); m.castShadow = false; m.receiveShadow = true; g.add(m) }
  scene.add(g)
  return { group: g, flames }
}
// タイトルの場面の左の中ほどに見える、浮いた廃墟の島と、塔の壁の戸口から渡る鎖の橋（どの道からも離れた飾り）
export function buildTitleIsland(course, scene, M, cands, T = course.tower) {
  if (!T || !cands) return { group: null, flames: [], chains: [] }
  const g = new THREE.Group(); g.name = 'titleIsland'
  let c = null
  for (const p of cands) { const dr = Math.hypot(p[0] - T.cx, p[2] - T.cz); if (dr > T.r + 14 && !nearPath(course, p[0], p[1], p[2], 13, 9)) { c = p; break } }
  if (!c) return { group: null, flames: [], chains: [] }
  seed = 303
  const rocks = [], stone = [], planks = [], flames = [], chains = []
  const s = 6.5
  const rg = new THREE.IcosahedronGeometry(1, 4), pp = rg.attributes.position, v = new THREE.Vector3()
  for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); v.multiplyScalar(0.55 + 0.6 * vnoise(v.x * 2.3, v.y * 2.3, v.z * 2.3) + 0.25 * vnoise(v.x * 7, v.y * 7, v.z * 7)); if (v.y > 0) v.y *= 0.1; else v.y *= 1.1 + (-v.y) * 0.9; pp.setXYZ(i, v.x, v.y, v.z) }
  rg.scale(s, s, s * 0.8); rg.translate(c[0], c[1], c[2]); rg.computeVertexNormals(); rocks.push(rg.toNonIndexed())
  const top = c[1] + s * 0.06
  const slab = new THREE.BoxGeometry(s * 1.3, 0.4, s * 1.0); slab.translate(c[0], top, c[2]); stone.push(slab.toNonIndexed())
  const ang = Math.atan2(-(T.cz - c[2]), T.cx - c[0])
  // 尖ったアーチ2つと折れた柱
  for (const k of [-1, 1]) { const w = 3.2, h = 5.2; const e = new THREE.ExtrudeGeometry((() => { const o = archShape(w, h), hole = archShape(w - 0.8, h - 0.6); o.holes.push(new THREE.Path(hole.getPoints(20).map(p2 => new THREE.Vector2(p2.x, Math.max(0.05, p2.y))))); return o })(), { depth: 0.7, bevelEnabled: false, curveSegments: 8 }); e.translate(k * 1.7, top + 0.2, -1.6); e.rotateY(ang + Math.PI / 2); e.translate(c[0], 0, c[2]); stone.push(e.toNonIndexed()) }
  { const wh = 3.4, wg = new THREE.BoxGeometry(s * 0.9, wh, 0.6, 6, 3, 1), q2 = wg.attributes.position; for (let i = 0; i < q2.count; i++) if (q2.getY(i) > 0) q2.setY(i, q2.getY(i) - rnd() * wh * 0.7); wg.translate(0, top + wh / 2, s * 0.3); wg.rotateY(ang + 0.5); wg.translate(c[0], 0, c[2]); stone.push(wg.toNonIndexed()) }
  { const sh = 7.5, tw = new THREE.BoxGeometry(1.6, sh, 1.6); tw.translate(c[0] - Math.cos(ang) * s * 0.45, top + sh / 2, c[2] + Math.sin(ang) * s * 0.45); stone.push(tw.toNonIndexed()); const cap = new THREE.ConeGeometry(1.35, 4, 4); cap.rotateY(Math.PI / 4); cap.translate(c[0] - Math.cos(ang) * s * 0.45, top + sh + 2, c[2] + Math.sin(ang) * s * 0.45); stone.push(cap.toNonIndexed()) }
  for (let j = 0; j < 4; j++) { const h = 1.2 + rnd() * 3.5, cg = new THREE.CylinderGeometry(0.35, 0.42, h, 10); cg.translate(c[0] + (rnd() - 0.5) * s, top + h / 2, c[2] + (rnd() - 0.5) * s * 0.6); stone.push(cg.toNonIndexed()) }
  for (const k of [-1, 1]) { const px = c[0] + Math.cos(ang) * 3 + Math.sin(ang) * k * 1.2, pz = c[2] - Math.sin(ang) * 3 + Math.cos(ang) * k * 1.2; const pg = new THREE.CylinderGeometry(0.16, 0.2, 1.4, 8); pg.translate(px, top + 0.7, pz); stone.push(pg.toNonIndexed()); flames.push([px, top + 1.55, pz, 1]) }
  // 鎖の橋: 島のふちから、塔の壁の戸口（張り出しの間の高さ）へ
  const a = Math.atan2(-(c[2] - T.cz), c[0] - T.cx)
  let wy = null
  for (let y = top; y < top + 8 && wy == null; y += 0.5) { const wx = T.cx + Math.cos(a) * T.r, wz = T.cz - Math.sin(a) * T.r; if (!nearPath(course, wx, y + 1, wz, 5, 3.2)) wy = y }
  if (wy != null) {
    const A = [c[0] + Math.cos(ang) * s * 0.6, top + 0.2, c[2] - Math.sin(ang) * s * 0.6], B = [T.cx + Math.cos(a) * (T.r + 0.1), wy, T.cz - Math.sin(a) * (T.r + 0.1)]
    const L = Math.hypot(B[0] - A[0], B[2] - A[2]), n = Math.floor(L / 0.3), yaw = Math.atan2(-(B[2] - A[2]), B[0] - A[0])
    for (let i = 0; i < n; i++) { if (rnd() < 0.05) continue; const t = (i + 0.5) / n, sag = Math.sin(t * Math.PI) * L * 0.07; const pk = new THREE.BoxGeometry(0.27, 0.08, 1.5 + rnd() * 0.3); pk.rotateZ((rnd() - 0.5) * 0.1); pk.rotateY(yaw); pk.translate(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - sag, A[2] + (B[2] - A[2]) * t); planks.push(pk.toNonIndexed()) }
    const r = [Math.sin(yaw), 0, Math.cos(yaw)]
    for (const k of [-1, 1]) chains.push({ a: [A[0] + r[0] * k * 0.8, A[1] + 1.0, A[2] + r[2] * k * 0.8], b: [B[0] + r[0] * k * 0.8, B[1] + 1.0, B[2] + r[2] * k * 0.8], sag: L * 0.08 })
    const door = new THREE.ExtrudeGeometry(archShape(2.2, 3.4), { depth: 0.3, bevelEnabled: false }); door.translate(0, 0, -0.25); door.rotateY(a + Math.PI / 2); door.translate(T.cx + Math.cos(a) * T.r, wy - 0.1, T.cz - Math.sin(a) * T.r); const dm = new THREE.Mesh(door, new THREE.MeshBasicMaterial({ color: 0x050605 })); g.add(dm)
    flames.push([B[0] + Math.cos(a) * 0.3 + r[0] * 1.5, wy + 2.2, B[2] - Math.sin(a) * 0.3 + r[2] * 1.5, 0])
  }
  for (const [arr, mt, smooth] of [[rocks, M.rockdark, true], [stone, M.ruinwall, false], [planks, M.plankold, false]]) if (arr.length) { const geo = mergeGeometries(arr); if (!smooth) geo.computeVertexNormals(); worldUV(geo, mt.userData.rep); const m = new THREE.Mesh(geo, mt); m.castShadow = true; m.receiveShadow = true; g.add(m) }
  scene.add(g)
  return { group: g, flames, chains }
}
// 霧の層の間に置く、描いた廃墟の板（遠いほど霧に沈む）。絵は後から読む
export function buildCards(course, scene, tex) {
  const T = course.tower; if (!T) return null
  const g = new THREE.Group(); g.name = 'cards'
  seed = 401
  for (let k = 0; k < 9; k++) {
    const t = tex[k % tex.length], a = rnd() * Math.PI * 2, r = 150 + rnd() * 110, h = 34 + rnd() * 36, y = -24 + rnd() * 46
    const x = T.cx + Math.cos(a) * r, z = T.cz - Math.sin(a) * r
    const asp = t.image ? t.image.width / t.image.height : 1
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h * asp, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.5, depthWrite: false, fog: true, color: new THREE.Color(0.5, 0.62, 0.62) }))
    m.position.set(x, y + h / 2, z); m.lookAt(T.cx, y + h / 2, T.cz); m.renderOrder = 1
    g.add(m)
  }
  scene.add(g)
  return g
}
// 浮いた広場の下の岩の塊（広場の真下だけ。上から落ちてきた物は先に広場に当たるので、手は届かない）
// 広場の底から、真下を通る道までの空き（m）。下に道がなければ大きな数
function clearBelow(course, pl) {
  const f = [Math.cos(pl.yaw), -Math.sin(pl.yaw)], r = [Math.sin(pl.yaw), Math.cos(pl.yaw)], bot = pl.c[1] - pl.thick
  let best = 99
  for (const q of course.path) {
    if (!q.p || q.p[1] >= bot) continue
    const dx = q.p[0] - pl.c[0], dz = q.p[2] - pl.c[2], a = dx * f[0] + dz * f[1], l = dx * r[0] + dz * r[1], m = (q.w || 3) / 2 + 1
    if (Math.abs(a) < pl.h[0] + m && Math.abs(l) < pl.h[1] + m) best = Math.min(best, bot - q.p[1])
  }
  return best
}
export function buildUnderRocks(course, scene, M) {
  const parts = [], cor = []
  // 広場の下の縁に沿って、石の持ち送り（広場の真下、外へは出さない）
  // 下を道が通る広場は、岩と持ち送りを道の頭の上 2.6m より下へ垂らさない（当たりのない見た目が道に入らない）
  for (const pl of course.plats || []) pl.room = clearBelow(course, pl) - 2.6
  for (const pl of course.plats || []) {
    if (pl.room < 1.6) continue
    const f = [Math.cos(pl.yaw), 0, -Math.sin(pl.yaw)], r = [Math.sin(pl.yaw), 0, Math.cos(pl.yaw)]
    for (const [ax, ay, len, ox, oy] of [[f, r, pl.h[0], 0, 1], [f, r, pl.h[0], 0, -1], [r, f, pl.h[1], 1, 0], [r, f, pl.h[1], -1, 0]]) {
      const n = Math.floor(len * 2 / 2.4)
      for (let k = 0; k < n; k++) {
        const t = -len + (k + 0.5) * len * 2 / n, edge = oy ? pl.h[1] : pl.h[0], nrm = oy ? [r[0] * oy, 0, r[2] * oy] : [f[0] * ox, 0, f[2] * ox]
        const g = new THREE.BoxGeometry(0.5, 1.5, 0.9); const p = g.attributes.position
        for (let i = 0; i < p.count; i++) if (p.getY(i) < 0) p.setZ(i, p.getZ(i) * 0.15 - 0.35)
        g.translate(0, -0.75, -0.45)
        const o = new THREE.Object3D(); o.position.set(pl.c[0] + ax[0] * t + nrm[0] * edge, pl.c[1] - pl.thick, pl.c[2] + ax[2] * t + nrm[2] * edge); o.lookAt(o.position.x + nrm[0], o.position.y, o.position.z + nrm[2]); o.updateMatrix(); g.applyMatrix4(o.matrix); cor.push(g.toNonIndexed())
      }
    }
  }
  for (const pl of course.plats || []) {
    if (pl.room < 1.2) continue
    const g = new THREE.IcosahedronGeometry(1, 4), p = g.attributes.position, v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      const n = 0.75 + 0.5 * vnoise(v.x * 2.1 + pl.c[0], v.y * 2.1, v.z * 2.1 + pl.c[2])
      v.multiplyScalar(n)
      if (v.y > 0) v.y = 0 // 上は平ら（広場の底）
      else v.y *= 1.0 + (-v.y) * 0.8 // 下へ尖る
      p.setXYZ(i, v.x, v.y, v.z)
    }
    g.scale(pl.h[0] * 0.92, Math.min(7, pl.room / 1.8), pl.h[1] * 0.92); g.rotateY(pl.yaw); g.translate(pl.c[0], pl.c[1] - pl.thick, pl.c[2])
    parts.push(g.toNonIndexed())
  }
  if (!parts.length) return null
  const geo = mergeGeometries(parts); geo.computeVertexNormals(); worldUV(geo, 5)
  const m = new THREE.Mesh(geo, M.rockdark); m.castShadow = true; m.receiveShadow = true; m.name = 'underrocks'
  if (cor.length) { const cg = mergeGeometries(cor); cg.computeVertexNormals(); worldUV(cg, 2.6); const cm = new THREE.Mesh(cg, M.ruinwall); cm.castShadow = true; cm.receiveShadow = true; m.add(cm) }
  scene.add(m)
  return m
}
export function buildChains(course, scene, M, T0) {
  const links = []
  const addChain = (a, b, sag = 0) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), L = A.distanceTo(Bv), n = Math.max(2, Math.floor(L / 0.13))
    for (let i = 0; i < n; i++) {
      const t0 = i / n, t1 = (i + 1) / n
      const p0 = A.clone().lerp(Bv, t0); p0.y -= sag * 4 * t0 * (1 - t0)
      const p1 = A.clone().lerp(Bv, t1); p1.y -= sag * 4 * t1 * (1 - t1)
      links.push({ p: p0.clone().lerp(p1, 0.5), d: p1.clone().sub(p0).normalize(), twist: i % 2 })
    }
  }
  if (!T0) for (const d of course.decor) if (d.kind === 'chain') addChain(d.a, d.b, d.sag)
  // 広場の下に垂れる鎖（下の道に届かない長さ）
  if (!T0) for (const pl of course.plats || []) {
    const f = [Math.cos(pl.yaw), 0, -Math.sin(pl.yaw)], r = [Math.sin(pl.yaw), 0, Math.cos(pl.yaw)]
    for (const [u, v, L0] of [[0.85, -0.9, 9], [-0.7, 0.92, 5], [0.9, 0.75, 7], [0.2, -0.95, 4]]) {
      const top = [pl.c[0] + f[0] * pl.h[0] * u + r[0] * pl.h[1] * v, pl.c[1] - pl.thick, pl.c[2] + f[2] * pl.h[0] * u + r[2] * pl.h[1] * v]
      let len = L0
      while (len > 0.4 && nearPath(course, top[0], top[1] - len / 2, top[2], 2.5, len / 2 + 1)) len -= 0.5
      if (pl.room == null) pl.room = clearBelow(course, pl) - 2.6
      if (len > pl.room) len = pl.room
      if (len < 0.5) continue
      addChain(top, [top[0] + 0.15, top[1] - len, top[2] + 0.1])
    }
  }
  // 張り出しの下に垂れる鎖（下の道に届かない長さ）
  const T = T0
  if (T) { seed = 23; for (const sh of course.shapes) {
    if (!onTower(sh, T) || sh.mov) continue
    const n = Math.floor((sh.phi1 - sh.phi0) * sh.r2 / 7)
    for (let j = 0; j < n; j++) {
      if (rnd() < 0.5) continue
      const ph = sh.phi0 + (sh.phi1 - sh.phi0) * (j + rnd()) / n, r = sh.r2 - 0.35, top = [T.cx + Math.cos(ph) * r, sh.y0 + sh.b * (ph - sh.phi0) - sh.thick, T.cz - Math.sin(ph) * r]
      let len = 1.5 + rnd() * 3.5
      while (len > 1 && nearPath(course, top[0], top[1] - len / 2, top[2], 2.6, len / 2 + 2.4)) len -= 0.5
      if (len > 1) addChain(top, [top[0], top[1] - len, top[2]])
      // 2本目で弧を描いて垂れる鎖
      if (rnd() < 0.3) { const ph2 = ph + 2.5 / r, t2 = [T.cx + Math.cos(ph2) * r, sh.y0 + sh.b * (ph2 - sh.phi0) - sh.thick, T.cz - Math.sin(ph2) * r]; if (!nearPath(course, top[0], top[1] - 1.5, top[2], 2.6, 3.5)) addChain(top, t2, 1.1) }
    }
  } }
  if (!links.length) return null
  const geo = new THREE.TorusGeometry(0.05, 0.016, 4, 7); geo.scale(1, 1.6, 1)
  // 120m の升目ごとに分ける（遠い升目は描かない・画面外を省ける）
  const cells = new Map()
  for (const l of links) { const k = Math.floor(l.p.x / 120) + ',' + Math.floor(l.p.z / 120); let L = cells.get(k); if (!L) cells.set(k, L = []); L.push(l) }
  const g = new THREE.Group(); g.name = 'chains'
  const o = new THREE.Object3D(), up = new THREE.Vector3(0, 1, 0)
  for (const L of cells.values()) {
    const im = new THREE.InstancedMesh(geo, M.chain, L.length), c = new THREE.Vector3()
    L.forEach((l, i) => { o.position.copy(l.p); o.quaternion.setFromUnitVectors(up, l.d); if (l.twist) o.rotateY(Math.PI / 2); o.updateMatrix(); im.setMatrixAt(i, o.matrix); c.add(l.p) })
    c.divideScalar(L.length); im.userData.ctr = [c.x, c.y, c.z]
    im.computeBoundingSphere(); im.castShadow = true; im.receiveShadow = true; im.name = 'chains'
    g.add(im)
  }
  if (scene) scene.add(g)
  return g
}

// 遠くの廃墟（尖塔・アーチの橋）。霧の中の影として見せる。走れる所から 100m 以上離す
export function buildMountains(scene, center, rad, M) {
  const g = new THREE.Group(); g.name = 'far'
  const mat = M.castle.clone(); mat.color = new THREE.Color(0x24251f)
  seed = 99
  const parts = [], lights = []
  const add = q => parts.push(q.index ? q.toNonIndexed() : q)
  const spire = (x, z, base, h, w) => {
    const rot = rnd() * 3, out = [], broken = rnd() < 0.35
    let y = base, ww = w
    const tiers = 3
    for (let k = 0; k < tiers; k++) {
      const th = h * (k === 0 ? 0.5 : 0.25), body = new THREE.BoxGeometry(ww, th, ww * 0.9); body.translate(0, y + th / 2, 0); out.push(body)
      // 角の小尖塔と、控え壁
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const pc = new THREE.ConeGeometry(ww * 0.09, th * 0.35, 4); pc.translate(sx * ww * 0.5, y + th + th * 0.17, sz * ww * 0.45); out.push(pc); const bt = new THREE.BoxGeometry(ww * 0.12, th * 0.9, ww * 0.12); bt.translate(sx * ww * 0.56, y + th * 0.45, sz * ww * 0.5); out.push(bt) }
      y += th; ww *= 0.72
      if (broken && k === 1) break
    }
    if (!broken) { const cap = new THREE.ConeGeometry(ww * 0.75, h * 0.4, 4); cap.rotateY(Math.PI / 4); cap.translate(0, y + h * 0.2, 0); out.push(cap) }
    else for (let k = 0; k < 4; k++) { const sh = new THREE.BoxGeometry(ww * 0.3, ww * (0.4 + rnd()), ww * 0.3); sh.rotateZ((rnd() - 0.5) * 0.6); sh.translate((rnd() - 0.5) * ww, y + ww * 0.3, (rnd() - 0.5) * ww); out.push(sh) }
    for (const q of out) { q.rotateY(rot); q.translate(x, 0, z); add(q) }
    // 窓に残った灯り（いくつかの塔だけ）
    if (rnd() < 0.5) { const n = 1 + Math.floor(rnd() * 3); for (let k = 0; k < n; k++) { const ly = base + 40 + rnd() * h * 0.6, la = rot + Math.floor(rnd() * 4) * Math.PI / 2; lights.push([x + Math.cos(la) * w * 0.52, ly, z + Math.sin(la) * w * 0.52, 1]) } }
  }
  for (let i = 0; i < 34; i++) {
    const a = i / 34 * Math.PI * 2 + rnd() * 0.15, r = rad + 40 + rnd() * 220
    spire(center[0] + Math.cos(a) * r, center[2] + Math.sin(a) * r, -40, 60 + rnd() * 130, 10 + rnd() * 14)
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2, r = rad + 80 + rnd() * 150, ang = a + Math.PI / 2 + (rnd() - 0.5)
    const x0 = center[0] + Math.cos(a) * r, z0 = center[2] + Math.sin(a) * r, y = 10 + rnd() * 50, n = 4 + Math.floor(rnd() * 4), span = 16
    for (let k = 0; k < n; k++) {
      const x = x0 + Math.cos(ang) * span * k, z = z0 + Math.sin(ang) * span * k
      const T = q => { q.rotateY(-ang); q.translate(x, 0, z); add(q) }
      const pier = new THREE.BoxGeometry(3, y + 40, 4); pier.translate(0, (y - 40) / 2, 0); T(pier)
      if (k < n - 1 && rnd() > 0.2) {
        const arc = new THREE.TorusGeometry(span / 2, 1.6, 4, 12, Math.PI); arc.translate(span / 2, y, 0); T(arc)
        const deck = new THREE.BoxGeometry(span, 1.6, 4); deck.translate(span / 2, y + span / 2 + 0.8, 0); T(deck)
      }
    }
  }
  const geo = mergeGeometries(parts); geo.computeVertexNormals(); worldUV(geo, 8)
  g.add(new THREE.Mesh(geo, mat))
  g.userData.lights = lights
  scene.add(g)
  return g
}

// 広い世界の谷: 輪になった道の内側と外側に立つ廃墟の尖塔・煙突・崩れた水道橋。どの道からも 50m 以上離す（手は届かない）。
// 形は近くの区間に合わせる（工場のそばは煙突と鉄骨、氷のそばは白い頂、ほかはゴシックの尖塔）。霧の中の影として見せる
export function buildValley(course, scene, M) {
  const g = new THREE.Group(); g.name = 'far'
  const P = course.path.filter(q => q.p)
  let mn = [1e9, 1e9], mx = [-1e9, -1e9]
  for (const q of P) { mn[0] = Math.min(mn[0], q.p[0]); mn[1] = Math.min(mn[1], q.p[2]); mx[0] = Math.max(mx[0], q.p[0]); mx[1] = Math.max(mx[1], q.p[2]) }
  const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2], half = [(mx[0] - mn[0]) / 2, (mx[1] - mn[1]) / 2]
  const towers = course.towers || []
  const nearZone = (x, z) => { let bz = 'ruin', bd = 1e9; anyNear(course, x, z, 260, q => { const d = Math.hypot(q.p[0] - x, q.p[2] - z); if (d < bd) { bd = d; bz = q.zone } return false }); return bz }
  const pathY = (x, z) => { let by = 0, bd = 1e9; anyNear(course, x, z, 300, q => { const d = Math.hypot(q.p[0] - x, q.p[2] - z); if (d < bd) { bd = d; by = q.p[1] } return false }); return by }
  const base = (course.lavaY ?? -30) - 10
  seed = 131
  const stone = [], iron = [], snow = [], lights = [], rocks = []
  const spire = (x, z, h, w, out) => {
    const rot = rnd() * 3, parts = [], broken = rnd() < 0.4
    let y = base, ww = w
    for (let k = 0; k < 3; k++) {
      const th = h * (k === 0 ? 0.55 : 0.22), body = new THREE.BoxGeometry(ww, th, ww * 0.9); body.translate(0, y + th / 2, 0); parts.push(body)
      for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const bt = new THREE.BoxGeometry(ww * 0.13, th * 0.92, ww * 0.13); bt.translate(sx * ww * 0.55, y + th * 0.46, sz * ww * 0.5); parts.push(bt); const pc = new THREE.ConeGeometry(ww * 0.09, th * 0.3, 4); pc.translate(sx * ww * 0.55, y + th + th * 0.15, sz * ww * 0.5); parts.push(pc) }
      y += th; ww *= 0.7
      if (broken && k === 1) break
    }
    if (!broken) { const cap = new THREE.ConeGeometry(ww * 0.78, h * 0.35, 4); cap.rotateY(Math.PI / 4); cap.translate(0, y + h * 0.175, 0); parts.push(cap) }
    else for (let k = 0; k < 4; k++) { const sh = new THREE.BoxGeometry(ww * 0.3, ww * (0.5 + rnd() * 1.2), ww * 0.3); sh.rotateZ((rnd() - 0.5) * 0.7); sh.translate((rnd() - 0.5) * ww, y + ww * 0.3, (rnd() - 0.5) * ww); parts.push(sh) }
    for (const q of parts) { q.rotateY(rot); q.translate(x, 0, z); out.push(q.index ? q.toNonIndexed() : q) }
    if (rnd() < 0.45) { const ly = base + h * (0.35 + rnd() * 0.3), la = rot + Math.floor(rnd() * 4) * Math.PI / 2; lights.push([x + Math.cos(la) * w * 0.5, ly, z - Math.sin(la) * w * 0.5, 1]) }
  }
  const island = (x, y, z, s, zn) => {
    const rg = new THREE.IcosahedronGeometry(1, 3), p = rg.attributes.position, v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(0.62 + 0.5 * vnoise(v.x * 1.6 + x, v.y * 1.6, v.z * 1.6 + z) + 0.22 * vnoise(v.x * 5 + 3, v.y * 5, v.z * 5)); if (v.y > 0) v.y *= 0.12; else v.y *= 0.85 + (-v.y) * 0.25; p.setXYZ(i, v.x, v.y, v.z) }
    rg.scale(s, s * 0.9, s * 0.8); rg.rotateY(rnd() * 3); rg.translate(x, y, z); rocks.push(rg.toNonIndexed())
    const top = y + s * 0.1, out = (zn === 'ice' || zn === 'roof' || zn === 'sky' || zn === 'castle') ? snow : stone
    // 崩れた尖塔 1 本・アーチ・折れた柱
    const sh = s * (1.4 + rnd() * 1.4), tw = new THREE.BoxGeometry(s * 0.4, sh, s * 0.4); tw.translate(x + s * 0.25, top + sh / 2, z); out.push(tw.toNonIndexed())
    if (rnd() < 0.6) { const cap = new THREE.ConeGeometry(s * 0.33, sh * 0.45, 4); cap.rotateY(Math.PI / 4); cap.translate(x + s * 0.25, top + sh + sh * 0.22, z); out.push(cap.toNonIndexed()) }
    const w = s * 0.7, h = w * 1.5, e = new THREE.ExtrudeGeometry((() => { const o = archShape(w, h), hole = archShape(w - 1.2, h - 0.8); o.holes.push(new THREE.Path(hole.getPoints(16).map(q => new THREE.Vector2(q.x, Math.max(0.05, q.y))))); return o })(), { depth: 1, bevelEnabled: false, curveSegments: 6 })
    e.translate(-s * 0.3, top, 0); e.rotateY(rnd() * 3); e.translate(x, 0, z); stone.push(e.toNonIndexed())
    for (let j = 0; j < 2; j++) { const ch = 1.5 + rnd() * s * 0.5, cg = new THREE.CylinderGeometry(0.5, 0.6, ch, 8); cg.translate(x + (rnd() - 0.5) * s, top + ch / 2, z + (rnd() - 0.5) * s * 0.6); stone.push(cg.toNonIndexed()) }
    if (rnd() < 0.55) lights.push([x + s * 0.25 + s * 0.21, top + sh * 0.6, z, 1])
  }
  const chimney = (x, z, h, r) => {
    const c = new THREE.CylinderGeometry(r * 0.8, r, h, 12, 1, true); c.translate(x, base + h / 2, z); stone.push(c.toNonIndexed())
    for (let k = 1; k < 5; k++) { const b = new THREE.TorusGeometry(r * (1 - 0.2 * k / 5) + 0.1, 0.35, 4, 14); b.rotateX(Math.PI / 2); b.translate(x, base + h * k / 5, z); iron.push(b.toNonIndexed()) }
    lights.push([x, base + h + 0.4, z, 1])
  }
  const truss = (x, z, h, w) => {
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const b = new THREE.BoxGeometry(0.9, h, 0.9); b.translate(x + sx * w / 2, base + h / 2, z + sz * w / 2); iron.push(b.toNonIndexed()) }
    for (let y = 20; y < h; y += 18) for (const [ax, az] of [[1, 0], [0, 1]]) { const b = new THREE.BoxGeometry(ax ? w : 0.6, 0.7, az ? w : 0.6); b.translate(x + (ax ? 0 : w / 2 * (rnd() < 0.5 ? 1 : -1)), base + y, z + (az ? 0 : w / 2 * (rnd() < 0.5 ? 1 : -1))); iron.push(b.toNonIndexed()) }
  }
  const aqueduct = (x0, z0, ang, n, y) => {
    const span = 18
    for (let k = 0; k < n; k++) {
      const x = x0 + Math.cos(ang) * span * k, z = z0 - Math.sin(ang) * span * k
      if (pathDist(course, x, z, 50) < 50) return
      const T = q => { q.rotateY(ang); q.translate(x, 0, z); stone.push(q.index ? q.toNonIndexed() : q) }
      const pier = new THREE.BoxGeometry(3.4, y - base, 4.4); pier.translate(0, (y + base) / 2, 0); T(pier)
      if (k < n - 1 && rnd() > 0.25) { const arc = new THREE.TorusGeometry(span / 2 - 1.7, 1.7, 4, 14, Math.PI); arc.translate(span / 2, y - span / 2 + 1.7, 0); T(arc); const deck = new THREE.BoxGeometry(span, 2.2, 4.4); deck.translate(span / 2, y + 1.1, 0); T(deck) }
    }
  }
  // 内側（輪の中の谷）と外側（輪のまわり）
  const tries = [[60, 0.1, 0.95], [70, 1.05, 1.9]]
  for (const [n, r0, r1] of tries) {
    let made = 0
    for (let k = 0; k < n * 8 && made < n; k++) {
      const a = rnd() * Math.PI * 2, rr = r0 + rnd() * (r1 - r0)
      const x = ctr[0] + Math.cos(a) * half[0] * rr * (r0 > 1 ? 1.1 : 1), z = ctr[1] + Math.sin(a) * half[1] * rr * (r0 > 1 ? 1.1 : 1)
      const pd = pathDist(course, x, z, 70)
      if (pd < 50) continue
      if (towers.some(T => Math.hypot(T.cx - x, T.cz - z) < T.r + 60)) continue
      const zn = nearZone(x, z), py = pathY(x, z)
      // 道が高い所（150m より上）のそばは、谷から伸びる細い塔ではなく、道の高さの近くに浮く廃墟の島（コンセプト画の中景）
      if (py > 150 && rnd() < 0.45) { if (pd > 60) { island(x, py - 45 + rnd() * 60, z, 7 + rnd() * 9, zn); made++ } continue }
      // 高さ: 谷の底から 60〜180m（見下ろすと谷の廃墟、低い道からは見上げる影）
      const h = Math.min(180, Math.max(60, (py - base) * (0.5 + rnd() * 0.5))), w = 10 + rnd() * 12
      if (zn === 'factory') { if (rnd() < 0.55) chimney(x, z, h, 4.5 + rnd() * 3); else truss(x, z, h * 0.85, 9 + rnd() * 6) }
      else if (zn === 'ice' || zn === 'roof' || zn === 'sky' || zn === 'castle') { const s0 = stone.length; spire(x, z, h, w, snow); void s0 }
      else if ((zn === 'ruin' || zn === 'crypt') && rnd() < 0.18) aqueduct(x, z, rnd() * Math.PI, 3 + Math.floor(rnd() * 4), base + h * 0.6)
      else spire(x, z, h, w, stone)
      made++
    }
  }
  const dark = M.castle.clone(); dark.color = new THREE.Color(0x2a2b25)
  const darkI = M.girder.clone(); darkI.color = new THREE.Color(0x2c2018)
  const pale = M.snowrock.clone(); pale.color = new THREE.Color(0x5a6468)
  const rk = M.rockdark.clone(); rk.color = new THREE.Color(0x2a2824)
  for (const [arr, mt] of [[stone, dark], [iron, darkI], [snow, pale], [rocks, rk]]) if (arr.length) { const geo = mergeLoose(arr); geo.computeVertexNormals(); worldUV(geo, 8); const m = new THREE.Mesh(geo, mt); m.name = 'valley'; g.add(m) }
  g.userData.lights = lights
  scene.add(g)
  return g
}

// 道の下の支え（当たりのある柱、tag 'support'）を、つながった建物に見せる飾り:
// 水道橋（aqueduct）と鐘楼の高架（pier）は、となり合う柱の間に何段ものアーチの壁を渡す（古代の水道橋の形）。
// 鉄骨（truss）は柱の間に斜めの筋交い。どれも道の下（柱の上の端より下）だけで、ほかの道からは離す
function arcPanel(out, L, wid, top, H, rise, pointed) {
  // 幅 L の口のアーチの壁（厚さ wid）。上の端 top、高さ H。口の上の線 h(x)（尖りか半円）から top までを埋める。x は -L/2..L/2
  const n = 12, s = top - H, half = L / 2
  const hy = x => { const u = Math.min(1, Math.abs(x) / half); return s + (pointed ? rise * (1 - Math.pow(u, 1.6)) : rise * Math.sqrt(1 - u * u)) }
  for (let i = 0; i < n; i++) {
    const x0 = -half + L * i / n, x1 = -half + L * (i + 1) / n, y0 = hy(x0), y1 = hy(x1)
    for (const z of [wid / 2, -wid / 2]) { const f = z > 0; const a = [x0, y0, z], b = [x1, y1, z], c = [x1, top, z], d = [x0, top, z]; if (f) out.push(...a, ...b, ...c, ...a, ...c, ...d); else out.push(...a, ...c, ...b, ...a, ...d, ...c) }
    out.push(x0, y0, -wid / 2, x1, y1, -wid / 2, x1, y1, wid / 2, x0, y0, -wid / 2, x1, y1, wid / 2, x0, y0, wid / 2) // 口の天井
  }
}
export function buildSupportDecor(course, M) {
  const g = new THREE.Group(); g.name = 'supports'
  const out = { aqueduct: [], pier: [], truss: [] }
  const S = course.shapes.filter(s => s.tag === 'support' && s.type === 'box' && (s.style === 'aqueduct' || s.style === 'pier'))
  for (let i = 0; i + 1 < S.length; i++) {
    const A = S[i], B = S[i + 1]
    if (A.style !== B.style) continue
    const dx = B.c[0] - A.c[0], dz = B.c[2] - A.c[2], D = Math.hypot(dx, dz)
    if (D < 4 || D > 28) continue
    const top = Math.min(A.max[1], B.max[1]) - 0.2, bot = Math.max(A.min[1], B.min[1])
    const gap = D - (A.h[0] + B.h[0]) * 1.0, wid = Math.min(A.h[2], B.h[2]) * 2 * 0.85
    if (gap < 2) continue
    const ang = Math.atan2(-dz, dx), mx = (A.c[0] + B.c[0]) / 2, mz = (A.c[2] + B.c[2]) / 2
    const pointed = A.style === 'pier', tierH = Math.max(gap * 0.5 + 2.4, 7), rise = gap / 2
    const pos = []
    // 段は下ほど高く（上は小さなアーチの列、下は背の高いアーチ）。下の段は崩れて抜けた所がある
    let sd = Math.round(Math.abs(mx * 13 + mz * 7)) % 997 + 1
    for (let k = 0, t = top, th = tierH; k < 7 && t - th > bot + 4; k++, t -= th, th *= 1.45) {
      sd = (sd * 16807) % 2147483647
      if (k >= 2 && sd / 2147483647 < 0.3) continue
      const tierH = th
      // ほかの道（この柱の上の道より下を通る道）に近い段は作らない
      if (anyNear(course, mx, mz, D / 2 + 4, q => q.p[1] < t + 0.3 && q.p[1] > t - tierH - 3 && Math.hypot(q.p[0] - mx, q.p[2] - mz) < D / 2 + 4)) continue
      arcPanel(pos, gap, wid, t, tierH, Math.min(k ? tierH * 0.8 : rise, tierH - 1.6), pointed)
    }
    if (!pos.length) continue
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.rotateY(ang); geo.translate(mx, 0, mz)
    out[A.style].push(geo)
  }
  // 鉄骨: 縦の柱の組の間に X の筋交い
  const C = course.shapes.filter(s => s.tag === 'support' && s.style === 'truss' && s.type === 'cyl' && Math.abs(s.d[1]) > 0.9)
  for (let i = 0; i + 1 < C.length; i++) {
    const A = C[i], B = C[i + 1], D = Math.hypot(B.a[0] - A.a[0], B.a[2] - A.a[2])
    if (D < 1.5 || D > 9) continue
    const y0 = Math.max(A.a[1], B.a[1]), y1 = Math.min(A.b[1], B.b[1]) - 1.5
    for (let y = y0; y + 4 < y1; y += 5) for (const [ya, yb] of [[y, y + 5], [y + 5, y]]) {
      const p0 = new THREE.Vector3(A.a[0], Math.min(ya, y1), A.a[2]), p1 = new THREE.Vector3(B.a[0], Math.min(yb, y1), B.a[2]), L = p0.distanceTo(p1)
      if (nearPath(course, (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2, 3.5, 4)) continue
      const cg = new THREE.CylinderGeometry(0.07, 0.07, L, 4, 1, true); cg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), p1.clone().sub(p0).normalize())); cg.translate((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2); out.truss.push(cg.toNonIndexed())
    }
  }
  const MT = { aqueduct: M.ruinwall, pier: M.castle, truss: M.girder }
  for (const k in out) if (out[k].length) { const geo = mergeLoose(out[k]); geo.computeVertexNormals(); worldUV(geo, MT[k].userData.rep || 2.5); const m = new THREE.Mesh(geo, MT[k]); m.receiveShadow = true; m.castShadow = k !== 'truss'; m.name = 'supports:' + k; g.add(m) }
  return g
}

// 塔の頭: 道から離れた高さ（円柱の上の面 top2 より上）にだけ、塔ごとに違う崩れた輪郭を置く（遠くから見分ける目印）。
// 墓所 = 崩れた胸壁と折れた控え壁・肋骨だけ残った丸屋根、廃墟 = 細い二段目と折れた尖塔、歯車 = 煙突と縦の大歯車、
// 鐘楼 = 4 本の柱とアーチと鐘・とがった屋根、氷 = 屋上の縁の細い尖塔と、軒のつらら（屋上は走る所なので真ん中には置かない）
export function buildCrown(course, T, M) {
  const g = new THREE.Group(); g.name = 'crown'
  const st = T.style || T.zone, R = T.r, y0 = T.top2 ?? T.top, cx = T.cx, cz = T.cz
  let sd = Math.round(cx * 7 + cz * 3) & 0xffff || 5
  const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647)
  const stone = [], dark = [], iron = [], snow = [], flames = []
  const at = (geo, a, rad, y, rotY = true) => { if (rotY) geo.rotateY(a + Math.PI / 2); geo.translate(cx + Math.cos(a) * rad, y, cz - Math.sin(a) * rad); return geo.index ? geo.toNonIndexed() : geo }
  // 道から届かないか（塔のそばの道で、その高さに近い点が無い）
  const clear = (x, y, z, rh, rv) => !nearPath(course, x, y, z, rh, rv)
  const crownClear = clear(cx, y0 + 10, cz, R + 9, 12.5)
  const band = (y, rr, t = 0.5) => { const b = new THREE.TorusGeometry(rr, t, 5, 48); b.rotateX(Math.PI / 2); b.translate(cx, y, cz); stone.push(b.toNonIndexed()) }
  const merlons = (rr, y, hMax, gapP = 0.25) => {
    const n = Math.round(2 * Math.PI * rr / 2.4)
    for (let k = 0; k < n; k++) { if (r() < gapP) continue; const a = k / n * Math.PI * 2, h = 1 + r() * hMax; const b = new THREE.BoxGeometry(1.5, h, 1.1); b.translate(0, h / 2, 0); stone.push(at(b, a, rr - 0.4, y)) }
  }
  const brokenRing = (rr, y, h, thick = 1.2) => {
    // 上の縁が崩れた筒の壁（外と内の2枚）
    const n = 40, seg = new THREE.CylinderGeometry(rr, rr, h, n, 3, true), p = seg.attributes.position
    for (let i = 0; i < p.count; i++) if (p.getY(i) > -h / 2 + 0.1) { const a = Math.atan2(p.getZ(i), p.getX(i)); const cut = Math.max(0, Math.sin(a * 3 + cx) * 0.5 + vnoise(a * 4, cz * 0.1, 1) - 0.3) * h * 0.9; p.setY(i, Math.min(p.getY(i), h / 2 - cut)) }
    seg.translate(cx, y + h / 2, cz); stone.push(seg.toNonIndexed())
    const inner = seg.toNonIndexed(); inner.translate(-cx, 0, -cz); inner.scale((rr - thick) / rr, 1, (rr - thick) / rr); inner.translate(cx, 0, cz); const ip = inner.attributes.position
    for (let i = 0; i < ip.count; i += 3) { const ax = ip.getX(i + 1), ay = ip.getY(i + 1), az = ip.getZ(i + 1); ip.setXYZ(i + 1, ip.getX(i + 2), ip.getY(i + 2), ip.getZ(i + 2)); ip.setXYZ(i + 2, ax, ay, az) }
    stone.push(inner)
  }
  if (st === 'ice' || T.roof) {
    // 屋上の縁の細い尖塔（道から 5m 以上離れた角度だけ）と、軒のつらら
    const n = 8
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + 0.2, x = cx + Math.cos(a) * (R - 1.2), z = cz - Math.sin(a) * (R - 1.2)
      if (!clear(x, y0 + 3, z, 6, 5)) continue
      const h = 9 + r() * 12, c = new THREE.CylinderGeometry(0.9, 1.15, h, 8); c.translate(0, h / 2, 0); stone.push(at(c, a, R - 1.2, y0))
      const cap = new THREE.ConeGeometry(1.25, h * 0.7, 8); cap.translate(0, h + h * 0.35, 0); snow.push(at(cap, a, R - 1.2, y0))
      flames.push([x + Math.cos(a) * 0.95, y0 + h * 0.62, z - Math.sin(a) * 0.95, 0])
    }
    for (let k = 0; k < 90; k++) {
      const a = r() * Math.PI * 2, L = 0.6 + r() * 2.6, x = cx + Math.cos(a) * (R + 0.15), z = cz - Math.sin(a) * (R + 0.15)
      if (!clear(x, y0 - L / 2, z, 3.2, L / 2 + 2.6)) continue
      const ic = new THREE.ConeGeometry(0.12 + r() * 0.14, L, 5); ic.rotateX(Math.PI); ic.translate(x, y0 - 0.35 - L / 2, z); snow.push(ic.toNonIndexed())
    }
  } else if (crownClear) {
    band(y0 + 0.3, R + 0.25, 0.55)
    if (st === 'crypt') {
      merlons(R + 0.2, y0 + 0.6, 2.6, 0.35)
      // 折れた控え壁の尖塔（4本、高さばらばら、少し傾く）
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, h = 7 + r() * 11, b = new THREE.BoxGeometry(2.2, h, 2.2); b.translate(0, h / 2, 0); b.rotateX((r() - 0.5) * 0.12); stone.push(at(b, a, R - 0.6, y0)); if (r() < 0.6) { const cp = new THREE.ConeGeometry(1.4, 4, 4); cp.translate(0, h + 2, 0); stone.push(at(cp, a, R - 0.6, y0)) } }
      // 肋骨だけ残った丸屋根（半分崩れた）
      for (let k = 0; k < 7; k++) { if (r() < 0.3) continue; const rib = new THREE.TorusGeometry(R * 0.8, 0.45, 5, 18, Math.PI * (0.45 + r() * 0.55)); rib.rotateY(k / 7 * Math.PI); rib.translate(cx, y0 + 0.5, cz); dark.push(rib.toNonIndexed()) }
      flames.push([cx, y0 + 1.2, cz, 1])
    } else if (st === 'ruin') {
      merlons(R + 0.2, y0 + 0.6, 1.8, 0.45)
      brokenRing(R * 0.62, y0, 13)
      band(y0 + 13 * 0.55, R * 0.62 + 0.2, 0.4)
      // 折れた細い尖塔
      const a = r() * 6.28, h = 26 + r() * 10, sx = cx + Math.cos(a) * R * 0.25, sz = cz - Math.sin(a) * R * 0.25
      const b = new THREE.BoxGeometry(4, h, 4); b.translate(sx, y0 + h / 2, sz); stone.push(b.toNonIndexed())
      for (let k = 0; k < 4; k++) { const sh = new THREE.BoxGeometry(1.1, 3 + r() * 5, 1.1); sh.rotateZ((r() - 0.5) * 0.5); sh.translate(sx + (r() - 0.5) * 3, y0 + h + 1.5, sz + (r() - 0.5) * 3); stone.push(sh.toNonIndexed()) }
      for (let k = 0; k < 3; k++) { const wa = r() * 6.28; flames.push([cx + Math.cos(wa) * R * 0.66, y0 + 4 + r() * 6, cz - Math.sin(wa) * R * 0.66, 0]) }
    } else if (st === 'factory' || st === 'storm') {
      // 煙突 3 本（鉄の帯・口に残り火）
      for (let k = 0; k < 3; k++) {
        const a = k * 2.1 + 0.5, rr = R * (0.35 + r() * 0.25), h = 18 + r() * 20, rad = 1.5 + r() * 0.9
        const c = new THREE.CylinderGeometry(rad * 0.85, rad, h, 14, 1, true); c.translate(cx + Math.cos(a) * rr, y0 + h / 2, cz - Math.sin(a) * rr); stone.push(c.toNonIndexed())
        for (let j = 1; j <= 4; j++) { const t = new THREE.TorusGeometry(rad * (1 - 0.15 * j / 4) + 0.12, 0.2, 4, 14); t.rotateX(Math.PI / 2); t.translate(cx + Math.cos(a) * rr, y0 + h * j / 4.4, cz - Math.sin(a) * rr); iron.push(t.toNonIndexed()) }
        flames.push([cx + Math.cos(a) * rr, y0 + h + 0.3, cz - Math.sin(a) * rr, 1])
      }
      // 縦の大歯車（塔の頭の縁に立つ）
      const ga = r() * 6.28, GR = R * 0.55, gx = cx + Math.cos(ga) * R * 0.3, gz = cz - Math.sin(ga) * R * 0.3, gy = y0 + GR + 1.5
      const ring = new THREE.TorusGeometry(GR, 0.7, 6, 40); const parts = [ring]
      for (let k = 0; k < 24; k++) { const t = new THREE.BoxGeometry(1.2, 1.5, 1.0); t.translate(0, GR + 0.9, 0); t.rotateZ(k / 24 * Math.PI * 2); parts.push(t) }
      for (let k = 0; k < 6; k++) { const s = new THREE.BoxGeometry(0.6, GR * 2, 0.5); s.rotateZ(k / 6 * Math.PI); parts.push(s) }
      const hub = new THREE.CylinderGeometry(1.4, 1.4, 1.4, 12); hub.rotateX(Math.PI / 2); parts.push(hub)
      for (const q of parts) { q.rotateY(ga); q.translate(gx, gy, gz); iron.push(q.index ? q.toNonIndexed() : q) }
      // 鉄骨の枠
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.8, b = new THREE.BoxGeometry(0.6, 12, 0.6); b.translate(0, 6, 0); iron.push(at(b, a, R - 1, y0)) }
      band(y0 + 12, R - 1, 0.35)
    } else if (st === 'bell') {
      // 4 本の柱とアーチ、真ん中に鐘、とがった屋根
      const H = 15, w = R * 1.25
      for (let k = 0; k < 4; k++) {
        const a = k * Math.PI / 2 + Math.PI / 4, b = new THREE.BoxGeometry(3, H, 3); b.translate(0, H / 2, 0); stone.push(at(b, a, R * 0.78, y0))
        const am = a + Math.PI / 4, e = new THREE.ExtrudeGeometry((() => { const o = archShape(w, H + 1), hole = archShape(w - 3.2, H - 2.5); o.holes.push(new THREE.Path(hole.getPoints(20).map(q => new THREE.Vector2(q.x, Math.max(0.05, q.y))))); return o })(), { depth: 1.2, bevelEnabled: false, curveSegments: 8 })
        e.translate(0, 0, -0.6); stone.push(at(e, am, R * 0.78 * Math.cos(Math.PI / 4), y0))
      }
      const roof = new THREE.ConeGeometry(R * 1.02, 16, 4, 1); roof.rotateY(Math.PI / 4 + 0); roof.translate(cx, y0 + H + 1 + 8, cz); dark.push(roof.toNonIndexed())
      const sp = new THREE.ConeGeometry(0.9, 9, 6); sp.translate(cx, y0 + H + 1 + 16 + 4.5, cz); iron.push(sp.toNonIndexed())
      const bell = new THREE.LatheGeometry([[0, 0], [2.6, 0.1], [2.4, 0.6], [1.9, 2.0], [1.6, 3.4], [1.0, 3.9], [0, 4.0]].map(([x, y]) => new THREE.Vector2(x, y)), 18); bell.translate(cx, y0 + H - 5.5, cz); iron.push(bell.toNonIndexed())
      const yoke = new THREE.BoxGeometry(R * 1.3, 0.8, 0.8); yoke.translate(cx, y0 + H - 1.2, cz); dark.push(yoke.toNonIndexed())
      flames.push([cx + 2, y0 + 1.2, cz, 1])
    } else {
      merlons(R + 0.2, y0 + 0.6, 2, 0.3)
    }
  }
  const mt = { stone: M.tower, dark: M.ruinwall, iron: M.girder, snow: M.snowrock }
  for (const [arr, m] of [[stone, mt.stone], [dark, mt.dark], [iron, mt.iron], [snow, mt.snow]]) if (arr.length) { const geo = mergeLoose(arr); geo.computeVertexNormals(); worldUV(geo, m.userData.rep || 3); const ms = new THREE.Mesh(geo, m); ms.receiveShadow = true; g.add(ms) }
  g.userData.ctr = [cx, y0, cz]
  return { group: g, flames }
}

// 溶岩の川（はるか下。黒い岩の割れ目を細く流れる）。光るのは割れ目だけ
export function buildLava(scene, center, y, R = 115) {
  const mat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), time: { value: 0 }, rad: { value: R }, cxz: { value: new THREE.Vector2(center[0], center[2]) } },
    vertexShader: `varying vec3 vW;\n#include <fog_pars_vertex>\nvoid main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;\n#include <fog_vertex>\n}`,
    fragmentShader: `uniform float time; uniform float rad; uniform vec2 cxz; varying vec3 vW;\n#include <fog_pars_fragment>\n
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 3.1; a *= 0.5; } return s; }
      void main(){
        vec2 p = vW.xz * 0.012;
        float r = abs(fbm(p + vec2(time * 0.004, 0.0)) - 0.5);
        float river = smoothstep(0.022, 0.0, r);
        float crack = smoothstep(0.012, 0.0, abs(fbm(p * 4.0 + 7.0) - 0.5)) * 0.22;
        float glow = clamp(river + crack, 0.0, 1.0);
        float pulse = 0.85 + 0.15 * sin(time * 0.8 + vW.x * 0.05);
        vec3 rock = vec3(0.020, 0.019, 0.017) * (0.6 + 0.8 * fbm(p * 9.0));
        vec3 lava = mix(vec3(1.2, 0.25, 0.04), vec3(2.6, 0.95, 0.22), river) * pulse;
        gl_FragColor = vec4(mix(rock, lava * 1.7, glow), 1.0);
        #ifdef USE_FOG
        { ${FOG_FACTOR} gl_FragColor.rgb *= 1.0 - 0.9 * clamp(fogFactor, 0.0, 1.0); }
        #endif
        #include <fog_fragment>
        gl_FragColor.a = 1.0 - smoothstep(rad * 0.62, rad * 0.97, length(vW.xz - cxz));
      }`,
  })
  mat.transparent = true
  const m = new THREE.Mesh(new THREE.CircleGeometry(R, 64), mat)
  m.rotation.x = -Math.PI / 2; m.position.set(center[0], y, center[2]); m.name = 'lava'
  scene.add(m)
  return m
}

// 霧の層: 世界の高さ 45m ごとの雲海。見えるのは今いる高さより 8〜140m 下の層だけ（下を見ると霧の海、上の塔は隠さない）。
// 板はカメラに付いて動き、模様は世界の位置で決まる（動いても模様は流れない）。足元のまわりは薄く、遠くほど濃い
export function buildFogLayers(scene, center, layers) {
  const g = new THREE.Group(); g.name = 'foglayers'
  const mats = [], meshes = []
  for (const [y0, op0] of layers) for (const [y, op] of [[y0, op0 * 0.6], [y0 + 2.2, op0 * 0.45]]) {
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { time: { value: 0 }, col: { value: new THREE.Color(PAL.fogD) }, op: { value: op }, c: { value: new THREE.Vector2(center[0], center[2]) }, camY: { value: 0 }, ly: { value: y } },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `uniform float time; uniform vec3 col; uniform float op; uniform vec2 c; uniform float camY; uniform float ly; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f); return mix(mix(h(i), h(i+vec2(1,0)), u.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), u.x), u.y); }
        float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n(p); p = p * 2.1 + 1.7; a *= 0.5; } return s; }
        void main(){ float d = length(vW.xz - c); float near = smoothstep(22.0, 75.0, d) * (1.0 - smoothstep(900.0, 1300.0, d));
          float f = fbm(vW.xz * 0.008 + vec2(time * 0.02, time * 0.011)) * 0.7 + fbm(vW.xz * 0.03 - vec2(time * 0.04, 0.0)) * 0.3; float below = camY - ly;
          float band = smoothstep(6.0, 22.0, below) * (1.0 - smoothstep(100.0, 140.0, below));
          float a = smoothstep(0.30, 0.80, f) * op * near * band;
          if (a < 0.003) discard;
          gl_FragColor = vec4(col, a); }`,
    })
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), mat); m.rotation.x = -Math.PI / 2; m.position.set(center[0], y, center[2]); m.renderOrder = 2; m.userData.ly = y
    g.add(m); mats.push(mat); meshes.push(m)
  }
  scene.add(g)
  return { group: g, mats, meshes,
    update(cam, tm) { for (const m of meshes) { const u = m.material.uniforms, below = cam.y - m.userData.ly; m.visible = below > 6 && below < 140; if (!m.visible) continue; m.position.x = cam.x; m.position.z = cam.z; u.c.value.set(cam.x, cam.z); u.time.value = tm; u.camY.value = cam.y } } }
}

// 火（松明・火鉢・壁の松明）。炎の板は光るだけ。実際の光は game.js が近くの数個にだけ付ける
function flameTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d')
  const gr = g.createRadialGradient(32, 92, 2, 32, 80, 46)
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,170,70,0.95)'); gr.addColorStop(0.6, 'rgba(200,70,20,0.45)'); gr.addColorStop(1, 'rgba(120,20,0,0)')
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(54, 50, 58, 96, 32, 124); g.bezierCurveTo(6, 96, 10, 50, 32, 4); g.fill()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,160,80,0.5)'); gr.addColorStop(1, 'rgba(255,120,40,0)')
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
// 火の板は 2 回の描画（炎・にじみ）にまとめる。1 つずつの Sprite だと、松明が数百あると描画の回数が多すぎる
// 遠い火は霧で消しきらず、点々の灯りとして残す（来た道・次の塔の道が灯りで読める）
const FL_CAP = 8192
const FL_VS = `attribute vec4 ip; attribute vec3 isz; uniform float time; varying vec2 vUv;
#include <fog_pars_vertex>
void main(){ vUv = uv;
  float k = 0.85 + 0.1 * sin(time * 13.0 + ip.w) + 0.06 * sin(time * 29.0 + ip.w * 2.0);
  vec4 mvPosition = viewMatrix * vec4(ip.xyz, 1.0);
  vec2 o = position.xy * isz.xy;
  if (isz.z > 0.5) o.y = (position.y + 0.5) * isz.y * k - 0.5 * isz.y; else o *= 0.92 + 0.08 * k;
  mvPosition.xy += o;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`
const FL_FS = `uniform sampler2D map; uniform vec3 col; varying vec2 vUv;
#include <fog_pars_fragment>
void main(){ vec4 t = texture2D(map, vUv); vec3 c = t.rgb * col * t.a;
#ifdef USE_FOG
  FOGF
  c *= 1.0 - 0.8 * clamp(fogFactor, 0.0, 1.0);
#endif
  gl_FragColor = vec4(c, 1.0); }`
// 高さで変わる霧の濃さ（game.js の霧の部品と同じ式）。fogNear = 濃さ、fogFar = 霧が薄くなり始める高さ
// 遠くまで指数で効き、最大でも 0.93（遠い塔の影が霧の中に残る）。今いる高さより下ほど濃い
export const FOG_FACTOR = `float hk = exp( - max( 0.0, vFogW.y - fogFar ) * 0.035 );
  float fogFactor = 0.93 * ( 1.0 - exp( - fogNear * ( 0.45 + 1.1 * hk ) * vFogDepth ) );`
export function buildFlames(scene, points, M) {
  const g = new THREE.Group(); g.name = 'flames'
  const mk = (tex, col) => {
    const base = new THREE.PlaneGeometry(1, 1), geo = new THREE.InstancedBufferGeometry()
    geo.index = base.index; geo.setAttribute('position', base.attributes.position); geo.setAttribute('uv', base.attributes.uv)
    geo.setAttribute('ip', new THREE.InstancedBufferAttribute(new Float32Array(FL_CAP * 4), 4)); geo.setAttribute('isz', new THREE.InstancedBufferAttribute(new Float32Array(FL_CAP * 3), 3)); geo.instanceCount = 0
    const mat = new THREE.ShaderMaterial({ fog: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: tex }, col: { value: col }, time: { value: 0 } }, vertexShader: FL_VS, fragmentShader: FL_FS.replace('FOGF', FOG_FACTOR) })
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 4; g.add(m); return m
  }
  const glow = mk(glowTexture(), new THREE.Color(0.55, 0.33, 0.165)), fire = mk(flameTexture(), new THREE.Color(2.6, 1.5, 0.7))
  const put = (m, x, y, z, ph, w, h, fl) => { const geo = m.geometry, i = geo.instanceCount; if (i >= FL_CAP) return; geo.attributes.ip.setXYZW(i, x, y, z, ph); geo.attributes.isz.setXYZ(i, w, h, fl); geo.instanceCount = i + 1; geo.attributes.ip.needsUpdate = true; geo.attributes.isz.needsUpdate = true }
  const fl = { group: g, list: [], add(pts) {
    const bas = [], bowls = []
    for (const p of pts) {
      const big = p[3] === 1, tiny = p[3] === 2, ph = (p[0] * 3.1 + p[2] * 1.7) % 6.28
      if (tiny) { put(fire, p[0], p[1] + 0.1, p[2], ph, 0.22, 0.34, 1); put(glow, p[0], p[1] + 0.1, p[2], ph, 1.6, 1.6, 0); const cg = new THREE.CylinderGeometry(0.07, 0.09, 0.14, 6); cg.translate(p[0], p[1] - 0.05, p[2]); bas.push(cg.toNonIndexed()); continue }
      put(fire, p[0], p[1] + (big ? 0.35 : 0.18), p[2], ph, big ? 0.75 : 0.42, big ? 1.1 : 0.66, 1); put(glow, p[0], p[1] + 0.2, p[2], ph, big ? 4.2 : 3.0, big ? 4.2 : 3.0, 0)
      const q = big ? new THREE.CylinderGeometry(0.3, 0.2, 0.18, 10) : new THREE.CylinderGeometry(0.17, 0.08, 0.22, 8, 1, true); q.translate(p[0], p[1] - (big ? 0.15 : 0.05), p[2]); (big ? bowls : bas).push(q.toNonIndexed())
    }
    for (const arr of [bas, bowls]) if (arr.length) { const m = new THREE.Mesh(mergeGeometries(arr), M.iron); m.castShadow = true; m.name = 'basket'; g.add(m) }
  }, mats: [glow.material, fire.material] }
  fl.add(points)
  if (scene) scene.add(g)
  return fl
}
export function updateFlames(fl, t) { for (const m of fl.mats) m.uniforms.time.value = t }

// 看板の文字（練習場。当たりのある板の、手前の面にぴったり重ねる）
export function buildSigns(course, scene) {
  const g = new THREE.Group(); g.name = 'signs'
  const coarse = typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window)
  for (const sg0 of course.signs) {
    const sg = typeof sg0.text === 'string' ? sg0 : { ...sg0, text: coarse ? sg0.text.touch : sg0.text.pc } // v17: スマホと PC で文言を分ける
    const sh = sg.shape
    const c = document.createElement('canvas'); c.width = 640; c.height = 216
    const x = c.getContext('2d')
    x.fillStyle = '#2a2622'; x.fillRect(0, 0, 640, 216)
    x.fillStyle = '#d8cfbe'; x.textAlign = 'center'; x.textBaseline = 'middle'
    let fs = 60; x.font = `700 ${fs}px "Zen Kaku Gothic New", sans-serif`
    while (x.measureText(sg.text).width > 590 && fs > 20) { fs -= 2; x.font = `700 ${fs}px "Zen Kaku Gothic New", sans-serif` }
    x.fillText(sg.text, 320, 112)
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
    const board = new THREE.Mesh(new THREE.PlaneGeometry(sh.h[2] * 2 - 0.04, sh.h[1] * 2 - 0.04), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }))
    const nx = new THREE.Vector3(...sh.ax[0]).multiplyScalar(-1)
    board.position.set(sh.c[0], sh.c[1], sh.c[2]).addScaledVector(nx, sh.h[0] + 0.002)
    board.lookAt(board.position.clone().add(nx))
    g.add(board)
  }
  scene.add(g)
  return g
}

// 空: 霧の青緑の夜。雲の濃淡と、雲越しの月（左上）
export function buildSky(scene) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { pano: { value: null }, hasPano: { value: 0 }, panoGain: { value: 1.0 }, panoRot: { value: 0 }, top: { value: new THREE.Color(0x0f1a1d) }, mid: { value: new THREE.Color(0x2f5058) }, bot: { value: new THREE.Color(0x3a585f) }, moonDir: { value: new THREE.Vector3(-0.5, 0.55, -0.4).normalize() }, time: { value: 0 }, flash: { value: 0 } },
    vertexShader: 'varying vec3 vW; void main(){ vW = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D pano; uniform float hasPano; uniform float panoGain; uniform float panoRot; uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 moonDir; uniform float time; uniform float flash; varying vec3 vW;
      float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
      float n(vec3 p){ vec3 i = floor(p), f = fract(p); vec3 u = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i), h(i+vec3(1,0,0)), u.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), u.x), u.y), mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), u.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), u.x), u.y), u.z); }
      float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.02 + 1.3; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vW); float y = d.y;
        vec3 c = y > 0.0 ? mix(mid, top, pow(clamp(y, 0.0, 1.0), 0.6)) : mix(mid, bot, clamp(-y * 4.0, 0.0, 1.0));
        float m = max(dot(d, moonDir), 0.0);
        float cl = fbm(d * 3.0 + vec3(time * 0.004, 0.0, time * 0.002));
        float cl2 = fbm(d * 7.0 - vec3(time * 0.006));
        float clouds = smoothstep(0.38, 0.75, cl * 0.75 + cl2 * 0.35) * smoothstep(-0.05, 0.25, y);
        vec3 moonGlow = vec3(0.56, 0.69, 0.70) * (pow(m, 40.0) * 1.0 + pow(m, 6.0) * 0.32 + pow(m, 2.0) * 0.1);
        float disc = smoothstep(0.9993, 0.9996, m);
        c += moonGlow * (1.0 - clouds * 0.6);
        c = mix(c, vec3(0.16, 0.24, 0.26) + moonGlow * 0.7, clouds * 0.85);
        c += vec3(0.85, 0.9, 0.86) * disc * (1.0 - clouds * 0.7);
        c += vec3(0.5, 0.6, 0.65) * flash * smoothstep(0.0, 0.6, clouds);
        if (hasPano > 0.5) { vec2 uv = vec2(fract(atan(d.z, d.x) / 6.2831853 + 0.5 + panoRot), clamp(asin(clamp(y, -1.0, 1.0)) / 3.1415927 * 1.5 + 0.64, 0.002, 0.998)); c = texture2D(pano, uv).rgb * panoGain; }
        gl_FragColor = vec4(c, 1.0); }`,
  })
  const m = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 16), mat); m.name = 'sky'; m.renderOrder = -1
  // 月（空と一緒に動く。向きは game.js がタイトルの場面の左上に決める）
  const mt = canvasT(256, 256, (g) => {
    const h = g.createRadialGradient(128, 128, 20, 128, 128, 128); h.addColorStop(0, 'rgba(210,235,235,0.55)'); h.addColorStop(0.25, 'rgba(150,190,195,0.18)'); h.addColorStop(1, 'rgba(120,160,170,0)'); g.fillStyle = h; g.fillRect(0, 0, 256, 256)
    const d = g.createRadialGradient(120, 120, 2, 128, 128, 26); d.addColorStop(0, '#f4fbf8'); d.addColorStop(1, '#c8dcda'); g.fillStyle = d; g.beginPath(); g.arc(128, 128, 26, 0, 7); g.fill()
    g.fillStyle = 'rgba(120,150,150,0.25)'; for (const [x, y, r] of [[118, 120, 6], [136, 132, 4], [124, 140, 3], [138, 116, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill() }
  })
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: mt, color: new THREE.Color(1.6, 1.7, 1.7), transparent: true, depthWrite: false, fog: false }))
  moon.scale.setScalar(260); moon.name = 'moon'; moon.visible = false; m.add(moon)
  scene.add(m)
  return m
}
