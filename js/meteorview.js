// SKY BIKE v77 隕石の見た目（判定は js/meteor.js）
//  兆し: 前の空の高い所に橙の火の点が灯って大きくなる・霧が赤く焼ける（game.js aimLights）・落ちる所の地面に影が広がり縁が橙に光る
//  落下: 黒い玄武岩の塊（ひびが橙に光る）が、尾を引いて前の空から斜めに落ちる。灰色の煙の尾
//  着弾: 白橙の閃光・火の粉・灰青の煙の柱・砕けた石。地面に焦げ跡（残り火がしばらく光る）と、半分埋まった塊が冷えていく
//  光は足さない（光の数を変えると全部の材料のシェーダが作り直しになる）。光る面と後処理の光のにじみだけで見せる
import * as THREE from 'three'

function canvasT(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t }
const radial = (stops) => canvasT(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); for (const [k, c] of stops) gr.addColorStop(k, c); g.fillStyle = gr; g.fillRect(0, 0, w, h) })
// 塊のひび（光る線）
const crackTex = () => canvasT(256, 128, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h)
  for (let k = 0; k < 34; k++) { let x = Math.random() * w, y = Math.random() * h; g.strokeStyle = `rgba(255,${120 + Math.random() * 80 | 0},40,${0.6 + Math.random() * 0.4})`; g.lineWidth = 1 + Math.random() * 2.5; g.beginPath(); g.moveTo(x, y); for (let s = 0; s < 6; s++) { x += (Math.random() - 0.5) * 34; y += (Math.random() - 0.5) * 22; g.lineTo(x, y) } g.stroke() }
})
// 残り火（焦げ跡に重ねる加算の点）
const emberTex = () => canvasT(256, 256, (g, w, h) => {
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h)
  for (let k = 0; k < 70; k++) { const a = Math.random() * Math.PI * 2, r = w * 0.3 * Math.sqrt(Math.random()), x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r, s = 0.6 + Math.random() * 1.8; g.fillStyle = `rgba(255,${80 + Math.random() * 70 | 0},25,${0.25 + Math.random() * 0.45})`; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill() }
  for (let k = 0; k < 18; k++) { const a = Math.random() * Math.PI * 2, r0 = w * 0.05, r1 = w * (0.14 + Math.random() * 0.14); g.strokeStyle = `rgba(255,${90 + Math.random() * 60 | 0},30,${0.3 + Math.random() * 0.3})`; g.lineWidth = 1 + Math.random() * 1.5; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0); g.lineTo(w / 2 + Math.cos(a) * r1, h / 2 + Math.sin(a) * r1); g.stroke() } /* 地面の割れ目に残る火 */
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w * 0.2); gr.addColorStop(0, 'rgba(255,140,50,0.8)'); gr.addColorStop(1, 'rgba(255,90,20,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h)
})
// 尾: 根元が明るく、後ろへ細く消える
const tailTex = () => canvasT(64, 256, (g, w, h) => {
  g.clearRect(0, 0, w, h)
  const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,0)'); gx.addColorStop(0.5, 'rgba(255,255,255,1)'); gx.addColorStop(1, 'rgba(0,0,0,0)')
  const gy = g.createLinearGradient(0, 0, 0, h); gy.addColorStop(0, 'rgba(255,200,120,0)'); gy.addColorStop(0.75, 'rgba(255,150,60,0.75)'); gy.addColorStop(1, 'rgba(255,236,190,1)')
  g.fillStyle = gy; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'destination-in'; g.fillStyle = gx; g.fillRect(0, 0, w, h)
})

// 焦げ跡の形: 頂点の色で描く円盤を、下の道の色に掛け算する（白＝そのまま、黒＝真っ黒）。縁はぎざぎざで外へ伸びる黒い筋
//  透明度で重ねる形は道の上で見えなかった（2026-11-19。不透明の単色なら見える・原因は未特定）ので、掛け算で暗くする
function scorchGeo() {
  const N = 72, R = [0, 0.22, 0.38, 0.5], pos = [0, 0, 0], col = [0.07, 0.06, 0.05], idx = []
  const jit = Array.from({ length: N }, () => 0.75 + Math.random() * 0.5)
  for (let r = 1; r < R.length; r++) for (let k = 0; k < N; k++) { const a = k / N * Math.PI * 2, j = r === R.length - 1 ? jit[k] * (1 + (k % 6 === 0 ? 0.5 : 0)) : 0.92 + jit[k] * 0.08, rr = R[r] * j; pos.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); const c = r === 1 ? 0.1 : r === 2 ? 0.28 + 0.3 * (jit[k] - 0.75) : 1; col.push(c, c * 0.92, c * 0.85) }
  for (let k = 0; k < N; k++) { const k1 = (k + 1) % N; idx.push(0, 1 + k1, 1 + k) }
  for (let r = 1; r < R.length - 1; r++) for (let k = 0; k < N; k++) { const k1 = (k + 1) % N, a = 1 + (r - 1) * N, b = 1 + r * N; idx.push(a + k, a + k1, b + k, a + k1, b + k1, b + k) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeBoundingSphere(); return g
}
export function buildMeteor(scene, dust) {
  const group = new THREE.Group(); group.name = 'meteor'; scene.add(group)
  // 塊: でこぼこの多面体
  const rg = new THREE.IcosahedronGeometry(0.95, 1); { const a = rg.attributes.position; for (let i = 0; i < a.count; i++) { const k = 0.78 + Math.random() * 0.4; a.setXYZ(i, a.getX(i) * k, a.getY(i) * k * 0.9, a.getZ(i) * k) } rg.computeVertexNormals() }
  const rockM = new THREE.MeshStandardMaterial({ color: 0x2a2623, roughness: 0.92, metalness: 0.05, emissive: 0xff7a30, emissiveMap: crackTex(), emissiveIntensity: 3, flatShading: true })
  const rock = new THREE.Mesh(rg, rockM); rock.castShadow = false; rock.visible = false; group.add(rock)
  const add = (map, color, o = {}) => new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, blending: o.add ? THREE.AdditiveBlending : THREE.NormalBlending, fog: o.fog ?? true, polygonOffset: !!o.po, polygonOffsetFactor: o.po ? -3 : 0, side: o.side || THREE.FrontSide, toneMapped: o.tm ?? true })
  // 包む火（塊のまわりの熱いもや）
  const haloM = new THREE.SpriteMaterial({ map: radial([[0, 'rgba(255,240,200,1)'], [0.25, 'rgba(255,170,80,0.85)'], [0.6, 'rgba(194,122,64,0.3)'], [1, 'rgba(194,122,64,0)']]), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  const halo = new THREE.Sprite(haloM); halo.visible = false; group.add(halo)
  haloM.color.setRGB(3.2, 2.0, 1.1) /* 焼けた空の前でも浮くように、色を 1 より強く（光のにじみに乗る） */
  // 空の火の点（兆し。遠くの高い所）
  const sparkM = haloM.clone(); const spark = new THREE.Sprite(sparkM); spark.visible = false; group.add(spark)
  // 尾（2 枚を十字に）
  const tailM = add(tailTex(), 0xffb070, { add: true, fog: false, side: THREE.DoubleSide })
  tailM.color.setRGB(2.6, 1.5, 0.7)
  const smokeM = add(tailTex(), 0x2a2b27, { side: THREE.DoubleSide }); smokeM.opacity = 0.85 /* 暗い煙の尾（明るい空の前で形が見える） */
  const tail = new THREE.Group(); for (const r of [0, Math.PI / 2]) { const s = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.25), smokeM); s.rotation.y = r; s.position.y = 0.62; s.renderOrder = 7; tail.add(s); const m = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), tailM); m.rotation.y = r; m.position.y = 0.5; m.renderOrder = 8; tail.add(m) } tail.visible = false; group.add(tail)
  // 地面の影（兆し）: 黒い円と橙の縁
  const shGeo = new THREE.PlaneGeometry(1, 1); shGeo.rotateX(-Math.PI / 2)
  const shadowM = add(radial([[0, 'rgba(4,4,4,0.95)'], [0.55, 'rgba(8,6,5,0.7)'], [0.78, 'rgba(30,14,6,0.35)'], [1, 'rgba(0,0,0,0)']]), 0xffffff, { po: true })
  const shadow = new THREE.Mesh(shGeo, shadowM); shadow.visible = false; shadow.renderOrder = 5; group.add(shadow)
  const rimM = add(radial([[0, 'rgba(0,0,0,0)'], [0.62, 'rgba(0,0,0,0)'], [0.8, 'rgba(255,120,40,0.9)'], [0.9, 'rgba(194,122,64,0.4)'], [1, 'rgba(0,0,0,0)']]), 0xffffff, { add: true, po: true })
  const rim = new THREE.Mesh(shGeo, rimM); rim.visible = false; rim.renderOrder = 6; group.add(rim)
  // 閃光
  const flashM = haloM.clone(); const flashS = new THREE.Sprite(flashM); flashS.visible = false; group.add(flashS)
  // 焦げ跡と残り火・冷えていく塊（4 つまで残す）
  const scM = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, fog: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), scG = scorchGeo(), emT = emberTex()
  const scars = []
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(scG.clone(), scM); s.userData.base = scG.attributes.position.array.slice(); s.renderOrder = 5; /* 濡れた石畳の水たまり（view.js pools、3）と霧の層（4）より後に描く */ s.visible = false; group.add(s)
    const eM = add(emT, 0xffffff, { add: true, po: true }), e = new THREE.Mesh(shGeo, eM); e.renderOrder = 6; e.visible = false; group.add(e)
    const rM = rockM.clone(), r = new THREE.Mesh(rg, rM); r.visible = false; group.add(r)
    scars.push({ s, e, r, t: -1 })
  }
  let scarK = 0
  const st = { ph: 'idle', p: null, f: null, t: 0, sky: null, k: 0, flash: -1 }
  const _lp = new THREE.Vector3(), _n = new THREE.Vector3(0, 1, 0), _q2 = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3(), _q = new THREE.Quaternion()
  function skyFrom(p, f) { return new THREE.Vector3(p[0] + f[0] * 48, p[1] + 26, p[2] + f[2] * 48) } // 前の空の高い所から斜めに落ちてくる（後ろのカメラの画面の上に入る）
  function hideFall() { rock.visible = halo.visible = tail.visible = spark.visible = shadow.visible = rim.visible = false }
  return {
    group,
    get k() { return st.k },
    get skyP() { return st.sky && (st.ph === 'sign' || st.ph === 'fall') ? st.sky : null },
    sign(p, f, n = [0, 1, 0]) { st.ph = 'sign'; st.p = p; st.f = f; st.t = 0; st.sky = skyFrom(p, f); _n.set(n[0], n[1], n[2]); shadow.position.set(p[0], p[1], p[2]).addScaledVector(_n, 0.05); rim.position.copy(shadow.position); shadow.quaternion.setFromUnitVectors(UP, _n); rim.quaternion.copy(shadow.quaternion); spark.position.copy(st.sky) },
    fall(p, f, dur) { st.ph = 'fall'; st.t = 0; st.dur = dur; if (!st.sky) st.sky = skyFrom(p, f) },
    hit(p, onGround, n = [0, 1, 0]) {
      _n.set(n[0], n[1], n[2]); _q.setFromUnitVectors(UP, _n)
      hideFall(); st.ph = 'idle'; st.k = 0
      flashS.position.set(p[0], p[1] + 1.2, p[2]); flashS.visible = true; st.flash = 0
      const S = scars[scarK = (scarK + 1) % scars.length]; S.t = 0
      S.s.position.set(p[0], p[1], p[2]).addScaledVector(_n, 0.07); S.s.scale.set(6.4, 1, 6.4); S.s.quaternion.copy(_q); S.s.visible = true
      { /* 道の外（宙）へはみ出す所は、縁まで縮める（焦げ跡が空中に浮かない） */
        const B = S.s.userData.base, A = S.s.geometry.attributes.position, sc = 6.4, N = (A.count - 1) / 3
        for (let k = 0; k < N; k++) {
          const io = 1 + 2 * N + k, ox = B[io * 3] * sc, oz = B[io * 3 + 2] * sc, Lo = Math.hypot(ox, oz) || 1
          let L = Lo; if (onGround) while (L > 0.3 && !onGround(p[0] + ox / Lo * L, p[2] + oz / Lo * L, p[1] - (_n.x * ox / Lo * L + _n.z * oz / Lo * L) / _n.y)) L -= 0.35 /* 向きごとに、外から内へ地面のある所まで */
          for (let r = 0; r < 3; r++) { const i = 1 + r * N + k, x = B[i * 3] * sc, z = B[i * 3 + 2] * sc, l = Math.hypot(x, z) || 1, m = Math.min(1, Math.max(0, L) / l); A.setXYZ(i, B[i * 3] * m, 0, B[i * 3 + 2] * m) }
        }
        A.needsUpdate = true; S.s.geometry.computeBoundingSphere() }
      S.e.position.set(p[0], p[1], p[2]).addScaledVector(_n, 0.09); S.e.scale.set(4.2, 1, 4.2); S.e.quaternion.copy(_q).multiply(_q2.setFromAxisAngle(UP, Math.random() * 6.28)); S.e.visible = true
      S.r.position.set(p[0], p[1] + 0.2, p[2]); S.r.visible = false /* 塊は砕けて残さない（当たりの無い物を道に置かない） */
      if (dust) {
        dust.emit([p[0], p[1] + 0.3, p[2]], 60, 9, { col: 0xff8a3a, up: 8, size: 1.8 }) // 火の粉
        dust.emit([p[0], p[1] + 0.5, p[2]], 40, 4, { col: 0x3b3b36, up: 6, size: 3.4 }) // 黒い煙
        dust.emit([p[0], p[1] + 0.4, p[2]], 36, 6, { col: 0x497580, up: 4, size: 2.8 }) // 霧の色の灰
        dust.emit([p[0], p[1] + 0.2, p[2]], 40, 8, { col: 0x5c5852, heavy: 1, up: 7, size: 1.0 }) // 砕けた石
      }
    },
    cancel() { if (st.ph !== 'idle') { st.ph = 'idle' } },
    clear() { st.ph = 'idle'; st.k = 0; hideFall() },
    // 毎フレーム。kTarget は兆しの強さ（meteor.js meteorK）
    update(dt, kTarget, cam, fallU = -1) {
      st.k += (kTarget - st.k) * Math.min(1, dt * 6)
      const k = st.k
      if (st.ph === 'sign' || st.ph === 'fall') {
        st.t += dt
        shadow.visible = rim.visible = true
        const sz = 1.2 + k * 2.8; shadow.scale.set(sz, 1, sz); rim.scale.set(sz * 1.08, 1, sz * 1.08)
        shadowM.opacity = Math.min(1, 0.15 + k * 0.95); rimM.opacity = Math.min(1, k * 1.3) * (0.75 + 0.25 * Math.sin(st.t * 18))
      }
      if (st.ph === 'sign') { spark.visible = true; const s = 3 + k * 16; spark.scale.set(s, s, 1); sparkM.opacity = Math.min(1, 0.25 + k) * (0.85 + 0.15 * Math.sin(st.t * 23)) }
      if (st.ph === 'fall' && st.p) {
        spark.visible = false
        const u = fallU >= 0 ? fallU : Math.min(1, st.t / st.dur), e = u * u * (1.6 - 0.6 * u) // 少し加速して落ちる（判定の刻みに合わせる）
        const tp = new THREE.Vector3(st.p[0], st.p[1] + 0.4, st.p[2])
        rock.position.copy(st.sky).lerp(tp, e); rock.visible = halo.visible = tail.visible = true; rock.scale.setScalar(1.35)
        rock.rotation.x += dt * 5; rock.rotation.z += dt * 3.3
        halo.position.copy(rock.position); const hs = 6.5 + 2 * Math.sin(st.t * 31); halo.scale.set(hs, hs, 1); haloM.opacity = 0.95
        _d.copy(st.sky).sub(tp).normalize(); tail.position.copy(rock.position); _q.setFromUnitVectors(UP, _d); tail.quaternion.copy(_q); const tl = 14 + 10 * e; tail.scale.set(1.3, tl, 1.3)
        if (dust && Math.random() < 0.7) dust.emit([rock.position.x + _d.x * 1.2, rock.position.y + _d.y * 1.2, rock.position.z + _d.z * 1.2], 2, 0.8, { col: 0x3b3b36, up: 0.4, size: 2.4 })
      }
      if (st.ph === 'idle' && (shadow.visible || spark.visible) && !rock.visible) { // 動いて消えた: 影と火の点がしぼむ
        shadowM.opacity *= 1 - Math.min(1, dt * 4); rimM.opacity *= 1 - Math.min(1, dt * 5); sparkM.opacity *= 1 - Math.min(1, dt * 3)
        if (shadowM.opacity < 0.02) hideFall()
      }
      if (st.flash >= 0) { st.flash += dt; const u = st.flash / 0.45, s = 5 + 13 * Math.min(1, u * 2.5); flashS.scale.set(s, s, 1); flashM.opacity = Math.max(0, 1 - u); if (u >= 1) { flashS.visible = false; st.flash = -1 } }
      for (const S of scars) { if (S.t < 0) continue; S.t += dt
        S.e.material.opacity = Math.max(0, 1 - S.t / 14) * (0.8 + 0.2 * Math.sin(S.t * 7 + S.r.rotation.x * 9)) // 残り火は 14 秒で消える
        if (S.t < 8 && dust && Math.random() < dt * 5) dust.emit([S.r.position.x + (Math.random() - 0.5) * 1.5, S.r.position.y + 0.6, S.r.position.z + (Math.random() - 0.5) * 1.5], 1, 0.4, { col: 0x3b3b36, up: 1.6, size: 2.6 }) // 細い煙が立つ
        if (S.t > 90) { S.s.visible = S.e.visible = S.r.visible = false; S.t = -1 } }
    },
    // 落ちてくる塊と、着いた直後の火に松明の光を 1 つ借りる（光の数は変えない）
    light() {
      if (rock.visible) return { p: rock.position, i: 60 }
      for (const S of scars) if (S.t >= 0 && S.t < 5) { _lp.copy(S.r.position); _lp.y += 1.6; return { p: _lp, i: 40 * Math.max(0, 1 - S.t / 5) } } /* 地面のすぐ上に強い光を置くと道が白く飛んで焦げ跡が見えなくなる。少し上から */
      return null
    },
    // 近くの残り火（火の音を鳴らす距離）
    nearEmber(p) { let d = 99; for (const S of scars) if (S.t >= 0 && S.t < 14) d = Math.min(d, Math.hypot(S.r.position.x - p.x, S.r.position.y - p.y, S.r.position.z - p.z)); return d },
  }
}
