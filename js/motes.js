// SKY BIKE v43 区間ごとに舞う粒（カメラのまわり 60m の箱の中だけ・1 回の描画）
// 0 谷底のほこり / 1 工場の火の粉（橙・上へ）/ 2 氷の尖塔の雪 / 3 草原の綿毛（白・ゆっくり）/ 4 ほかの区間の薄いほこり
// 粒は種類ごとに決まっていて、動きは GPU（時間で流して箱の中で折り返す）。区間が変わると種類ごとの濃さを 2.5 秒かけて入れ替える
import * as THREE from 'three'

export const MOTE_ZONE = { ground: 0, ruin: 0, crypt: 0, factory: 1, ice: 2, roof: 2, meadow: 3 }
const KINDS = [
  // 色, 大きさ, 速さ [x, y, z] m/s, 揺れ, 濃さ
  [0x9a8d7a, 1.3, [0.25, -0.05, 0.12], 0.5, 0.55],
  [0xff8a30, 1.5, [0.15, 1.1, 0.05], 0.8, 0.95],
  [0xf2f6fa, 1.7, [0.2, -0.9, 0.1], 0.6, 0.85],
  [0xfbfaf2, 2.1, [0.45, 0.06, 0.2], 1.0, 0.8],
  [0xb8b2a6, 1.1, [0.2, -0.04, 0.1], 0.4, 0.32],
]
export function buildMotes(scene, lowEnd) {
  const per = lowEnd ? 60 : 120, N = per * KINDS.length, BOX = 60
  const pos = new Float32Array(N * 3), kind = new Float32Array(N), seed = new Float32Array(N)
  let s = 7; const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  for (let i = 0; i < N; i++) { pos[i * 3] = rnd() * BOX; pos[i * 3 + 1] = rnd() * BOX * 0.6; pos[i * 3 + 2] = rnd() * BOX; kind[i] = i % KINDS.length; seed[i] = rnd() }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('kind', new THREE.BufferAttribute(kind, 1)); geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1))
  const cols = KINDS.map(k => { const c = new THREE.Color(k[0]); return new THREE.Vector3(c.r, c.g, c.b) }), vels = KINDS.map(k => new THREE.Vector3(...k[2]))
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, w: { value: [0, 0, 0, 0, 1] }, cols: { value: cols }, vels: { value: vels }, sizes: { value: KINDS.map(k => k[1]) }, sway: { value: KINDS.map(k => k[3]) }, alph: { value: KINDS.map(k => k[4]) }, box: { value: new THREE.Vector3(BOX, BOX * 0.6, BOX) } },
    vertexShader: `attribute float kind; attribute float seed; uniform float time; uniform vec3 cam; uniform vec3 box; uniform float w[5]; uniform vec3 cols[5]; uniform vec3 vels[5]; uniform float sizes[5]; uniform float sway[5]; uniform float alph[5];
      varying vec3 vC; varying float vA;
      void main(){ int k = int(kind + 0.5); float wk = w[k]; vC = cols[k];
        vec3 p = position + vels[k] * time + vec3(sin(time * 0.6 + seed * 40.0), sin(time * 0.4 + seed * 23.0) * 0.5, cos(time * 0.5 + seed * 31.0)) * sway[k];
        p = mod(p - cam + box * 0.5, box) - box * 0.5 + cam; // カメラのまわりの箱の中で折り返す
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        float edge = 1.0 - smoothstep(box.x * 0.38, box.x * 0.5, length(p.xz - cam.xz)); // 箱の端で消える（折り返しが見えない）
        float flick = k == 1 ? 0.6 + 0.4 * sin(time * 9.0 + seed * 60.0) : 1.0;
        vA = wk * alph[k] * edge * flick * smoothstep(0.6, 3.0, d);
        gl_PointSize = wk > 0.01 ? sizes[k] * (60.0 / max(d, 0.5)) + 0.6 : 0.0;
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ if (vA < 0.004) discard; float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.12, d)); }`,
  })
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = 'motes'; scene.add(pts)
  const W = [0, 0, 0, 0, 1]
  return {
    points: pts, weights: W,
    update(dt, cam, tm, zone) {
      const want = MOTE_ZONE[zone] ?? 4, k = 1 - Math.exp(-dt / 0.8) // 約 2.5 秒で入れ替わる
      for (let i = 0; i < W.length; i++) W[i] += ((i === want ? 1 : 0) - W[i]) * k
      const u = mat.uniforms; u.time.value = tm; u.cam.value.copy(cam); u.w.value = W
    },
  }
}
