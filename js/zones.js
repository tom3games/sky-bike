import { hbeam } from './course.js?v=37'
// v13 で足した区間（塔のまわり）。どの区間も「歩くキャラクターでは成り立たない」ことが決まり:
//   1 勢い（速さがないと越えられない）2 バイクの体の動き（ウィリー・段のよじ登り・空中の角度）
//   3 重さと力で世界を動かす（シーソー・体当たりで扉を壊す）4 速さが生む山場（追ってくる溶岩・崩れる橋）
// 時間を読むだけの仕掛け（動く床・鉄球）は、必ず 1〜4 と組み合わせる。
// ctx = { B, orbit, ogap, ostep, otorch, outer, excursion, W, RM, DEG }

// 直線の道の切れ目（4m を超える。下りながら跳ぶ）
function xgap(B, len, dy) { const w = B.last ? B.last.w : 3; B.kicker(1.6, 11 * Math.PI / 180, { w: w - 0.4, mat: 'plank', thick: 0.5 }); B.path[B.path.length - 1].vNeed = 9; B.gap(len, dy, 'jump'); B.path[B.path.length - 1].vJump = 9 } // 小さな踏み切り台から跳ぶ
// 塔のまわりの道で木箱の段（ostep + 短い円弧）
function ocrates(x, heights, gapAng = 0.16, o = {}) {
  for (const h of heights) { x.ostep(h); x.orbit(gapAng, 0, { mat: 'crate', kind: 'crate', mu: o.mu }) }
}
// 塔のまわりの道で、進む向きと逆へ流れる水路（止まると押し戻される）
function ochannel(x, ang, rise, u = 2.0) {
  const s = x.orbit(ang, rise, { mat: 'wetstone', mu: 0.72, kind: 'water', sweep: 0.05 })
  s.flowT = -u * x.B.orbitSign
  x.B.waters.push({ arc: s, u, tan: x.B.orbitSign })
  return s
}

// 周を重ねて登る（v13）。v15 で長い回廊は gauntlet に置き換えた（同じ曲がり・同じ幅・同じ景色が長く続いて退屈だった）
export function laps(x, n, name) {
  const { B, orbit, otorch, W } = x
  B.mark(name)
  for (let k = 0; k < n * 12; k++) {
    orbit(0.52, 1.05)
    if (k % 3 === 2) otorch()
    if (k === n * 6) B.cp(name + 'の途中', { w: W, rest: true })
  }
}

// ================= v15 回廊の作り直し: 短く切った形を、前と同じ物を続けずに並べる。どれも歩く人では越えられない（速さ・ウィリー・よじ登り・体当たり）
// 形: drop（4m 超の切れ目を下りながら跳ぶ）/ hop（ジャンプ台で 4.6m を跳ぶ。速すぎると着地の先の壁）/ gal（屋根と窓のある塔の中の通路。入口の扉を破り、中は崩れる床）
//     steep（38 度・10m の坂を勢いで登る）/ nsteep（41 度。ニトロでしか登れない。手前に燃料の缶）/ hang（1.6m の縁に前輪を掛けて耐え、上を通る物を待って登る）
//     whoop（丸太の連続）/ pinch（外が開けた細い道）/ wide（広い張り出し）
export function gauntlet(x, name, seq, o = {}) {
  const { B, orbit, orbitRaw, ogap, otorch, gallery, W, DEG } = x
  B.cp(name + 'の入口', { w: W, rest: true }) // 長い回廊の前に旗（転んだら旗から）
  orbitRaw(0.3, 0.3)
  B.mark(name)
  const mat = B.omat, galMat = o.galMat || 'castle'
  let k = 0
  for (const e of seq) {
    k++
    if (e === 'drop') { orbitRaw(0.7, 0.5); B.noDeco = 0; ogap(4.4, -0.6); orbitRaw(0.32, 0.3, { kind: 'landing' }) }
    else if (e === 'hop') {
      orbitRaw(0.75, 0.4)
      const rise = B.kicker(2.0, 12 * DEG, { w: W - 0.8, mat: 'plank', thick: 0.6 }); B.path[B.path.length - 1].vNeed = 9.5
      ogap(4.3, rise - 0.25); B.path[B.path.length - 1].vJump = 9.5
      orbitRaw(0.42, 0, { kind: 'landing', w: 5.4 }); x.ostep(0.7); orbitRaw(0.3, 0.3) // 着地は広め。速すぎる（ニトロのまま）と着地の先の壁に当たる
    }
    else if (e === 'gal') {
      orbitRaw(0.6, 0.4) // 扉を破る助走
      B.door(0.6, { breakV: 6, w: W, mat: 'bridgeplank' })
      const a = orbitRaw(0.42, 0.6, { mat: galMat === 'castle' ? 'cobble' : mat })
      const n = 3, al = 0.33
      const cr = []; for (let j = 0; j < n; j++) { const s3 = x.seg(al * 17.1 / n, 0, { w: W, mat: 'plankold', thick: 0.35, kind: 'crumble' }); s3.mov = { type: 'crumble', delay: 0.26, back: 1e9, once: true }; cr.push(s3) }
      const c = orbitRaw(0.4, 0.8, { mat: galMat === 'castle' ? 'cobble' : mat })
      for (const s2 of [a, ...cr, c]) gallery(s2, { mat: galMat })
    }
    else if (e === 'steep' || e === 'nsteep') {
      if (e === 'nsteep') B.can(3)
      orbitRaw(0.7, 0.3)
      orbitRaw(0.16, 0.9)
      const s2 = orbitRaw(0.6, e === 'nsteep' ? 8.9 : 8.0, { kind: 'steep', mat: e === 'nsteep' ? 'rust' : mat, mu: 0.95 })
      if (e === 'nsteep') { const i1 = B.path.length; for (let j = i1 - 12; j < i1; j++) B.path[j].nitro = true }
      orbitRaw(0.16, 0.9); orbitRaw(0.3, 0.2)
    }
    else if (e === 'hang') {
      orbitRaw(0.3, 0)
      B.hangLedge(1.6, 3.4, { w: W, max: o.hangMax ?? 8, mat })
      if (o.hangHz === 'ball') B.pendulum(-2.8, { w: W, T: (o.T ?? 3.4) + 1.4, ph: o.ph ?? 0, L: 3.6 }) // 縁の上を横切る鉄球（縁に掛けて耐えている間は頭の上を通る）
      orbitRaw(0.3, 0.3)
    }
    else if (e === 'whoop') { orbitRaw(0.15, 0.1); for (let j = 0; j < 3; j++) B.log(1.5 + j * 2.4, 0.17, W - 0.4, 'log'); orbitRaw(0.5, 0.3) }
    else if (e === 'pinch') orbitRaw(0.45, 0.6, { w: 2.4, kind: 'narrow' })
    else if (e === 'wide') orbitRaw(0.4, 0.6, { w: 5.6 })
    if (k % 3 === 0) otorch()
    if (o.cpAt === k) { orbitRaw(0.25, 0); B.cp(name + 'の途中', { w: W, rest: true }) } // 旗は平らな所に（坂や崩れる床の上だと通った判定が取れない）
  }
}

// ================= 墓所と地下水路（暗い。主役: 逆に流れる水路と、体当たりで壊す朽ちた扉。始まりは下から溶岩が追ってくる）
export function crypt(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'crypt'; B.omat = 'cobble'
  B.cp('墓所の入口', { w: W, rest: true })
  x.tower({ sign: 1, r: 22, name: '墓所の塔' }) // v16: 溶岩に追われて、墓所の塔のまわりを半周だけ登る
  // 4 溶岩に追われて登る（止まると追いつかれる。段は勢いで越える低い物だけ）
  B.mark('溶岩に追われて')
  const r0 = B.path.length, y0 = B.t.p[1]
  B.decoOn = false // 追われる区間には、抜ける床や溝を仕込まない
  orbit(0.5, 1.2); otorch()
  x.ostep(0.28); orbit(0.5, 1.1)
  orbit(0.5, 1.2); otorch()
  x.ostep(0.3); B.log(2, 0.15, W - 0.4); orbit(0.5, 1.2)
  orbit(0.55, 1.3); otorch()
  orbit(0.3, 0.7, { plain: true }); x.ogap(4.3, -0.5); orbit(0.35, 0.8) // 溶岩に追われながら、勢いで切れ目を跳ぶ
  B.risers.push({ i0: r0 + 2, i1: B.path.length, y0: y0 - 3.2, rate: 0.72, yTop: B.t.p[1] - 0.4, delay: 1.0 })
  B.decoOn = true
  B.cp('溶岩の上', { w: W, rest: true })
  x.free({ to: [300, -600], amp: 0.3, lam: 140 }) // ここから崖沿いの道（塔を離れて北へ）
  orbit(0.3, 0.3)
  // 3 朽ちた扉（速さ 6m/s 以上で体当たりすると壊れる。遅いと跳ね返る）。助走の長さは自分で選ぶ
  B.mark('朽ちた扉を破る')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.6, w: 3.2, mat: 'cobble', plat: 'cobble', thick: 1.2,
    out: () => {
      const S = { w: 3.2, mat: 'cobble', thick: 1.2 }
      B.road(14, { ...S, back: 0 }); B.torch(-1, -7, { w: 3.2, down: 1 }); B.torch(1, -7, { w: 3.2, down: 1 })
      B.door(2, { breakV: 6 }); B.road(4, S)
      B.road(8, S)
    },
    back: () => { B.road(6, { w: 3.2, slope: 12 * x.DEG, mat: 'cobble', thick: 1.2 }) },
  })
  orbit(0.4, 0.8); otorch()
  // 1 逆に流れる水路（止まると押し戻されて下まで戻る。アクセルを入れ続けて登り切る）
  B.mark('逆流の水路')
  orbit(0.2, 0)
  ochannel(x, 0.75, 2.0, 2.4)
  B.door(1.2, { breakV: 6 }); orbit(0.3, 0.3); otorch()
  orbit(0.4, 0.9)
  B.cp('水路の踊り場', { w: W, rest: true })
  // 1+2 水の中の木箱（流れに押されながら、ウィリーで段を越える）
  B.mark('水の中の木箱')
  orbit(1.3, 0.3, { plain: true }); x.ogap(4.3, -0.5); orbit(0.25, 0) // 水路の手前の切れ目（勢いで）
  ochannel(x, 0.2, 0, 1.2)
  x.ostep(0.36); ochannel(x, 0.22, 0, 1.2)
  x.ostep(0.36); ochannel(x, 0.22, 0, 1.2)
  orbit(0.4, 0.6); otorch()
  orbit(0.45, 1.0)
  // 3+2 扉の向こうに木箱（扉を破る速さのまま段には行けない。破ったら止まって段をよじ登る）
  B.mark('扉と木箱')
  excursion({
    Ru: 6, Rs: 12, sRise: 7.2, w: 3.0, mat: 'cobble', plat: 'cobble', thick: 1.2,
    out: () => {
      const S = { w: 3.0, mat: 'cobble', thick: 1.2 }
      B.road(5, { ...S, back: 0 }); B.trapStraight({ ...S }); B.road(8, { ...S, back: 0 }); B.door(1.5, { breakV: 6 }); B.road(11, S)
      B.crates([0.6, 0.75], 2.8, { w: 3.0 })
      B.road(4, { ...S, thick: 2.6 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 6 * x.DEG, mat: 'cobble', thick: 1.2 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  // 1+3 流れに逆らって登り、上で扉（水路の途中で止まると、扉を破る速さが出ない）
  B.mark('逆流と扉')
  orbit(0.3, 0)
  ochannel(x, 0.5, 1.4, 2.0); B.door(1.0, { breakV: 6.5 }); orbit(0.25, 0.1)
  ochannel(x, 0.45, 1.2, 2.2); orbit(0.3, 0.3); otorch()
  orbit(0.45, 1.0)
  forkAt(x, 1)
  gauntlet(x, '墓所の回廊', ['drop', 'gal', 'whoop', 'hop', 'pinch', 'steep', 'drop', 'gal', 'hang', 'wide', 'hop'], { cpAt: 6, galMat: 'castle' })
  B.cp('墓所の奥', { w: W, rest: true })
  // 試験: 天井の低い暗い水路（ウィリーすると頭を打つ）→ 流れに逆らって登る → 扉を破る
  B.mark('暗い水路と扉')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.2, w: 3.0, mat: 'cobble', plat: 'cobble', thick: 1.2,
    out: () => {
      const S = { w: 3.0, mat: 'cobble', thick: 1.2 }
      B.road(4, { ...S, back: 0 })
      B.ceiling(9, { w: 3.0 }); B.log(3.5, 0.14, 2.8, 'log'); B.road(9, S)
      const c = B.channel(9, 7 * x.DEG, { w: 3.0, thick: 1.2, u: 1.8 }); B.torch(1, -4, { w: 3, down: 1 })
      B.door(2.5, { breakV: 5.5 }); B.road(5, S)
    },
    back: () => { B.road(6, { w: 3.0, slope: 10 * x.DEG, mat: 'cobble', thick: 1.2 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
}

// ================= 廃墟の街に足す: 崩れていく橋を全開で駆け抜ける（4）
export function ruinsMore(x) {
  const { B, orbit, otorch, excursion } = x
  B.mark('崩れていく石の橋')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.4, w: 2.8, mat: 'cobble', plat: 'cobble', thick: 1.0,
    out: () => {
      B.road(6, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
      B.crumbleRun(15, 7, 2.6, 0.18)
      B.road(2, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0, noOverlap: true })
      { const rise = B.kicker(2.2, 13 * x.DEG, { w: 2.6, mat: 'cobble', thick: 0.8 }); B.gap(3.2, rise - 0.3, 'jump') }
      B.road(4, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 }); B.trapStraight({ w: 2.8, mat: 'cobble' }); B.road(5, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
    },
    back: () => { B.road(6, { w: 2.8, slope: 12 * x.DEG, mat: 'cobble', thick: 1.0 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  gauntlet(x, '廃墟の回廊', ['hop', 'gal', 'drop', 'steep', 'whoop', 'hang', 'pinch', 'drop', 'gal', 'hop', 'wide'], { cpAt: 6, galMat: 'castle', hangHz: 'ball', T: 3.6 })
  B.cp('廃墟の街の上', { w: x.W, rest: true })
  // 4+2 崩れる足場の上の段（止まると崩れる。勢いを殺さずに段へ）
  B.mark('崩れる足場と段')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.2, w: 2.8, mat: 'cobble', plat: 'cobble', thick: 1.0,
    out: () => {
      B.road(3, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 }); B.trapStraight({ w: 2.8, mat: 'cobble' }); B.road(4, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
      B.crumbleRun(8, 4, 2.6, 0.45)
      B.road(6, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0, noOverlap: true })
      B.step(0.45); B.road(4, { w: 2.8, mat: 'cobble', thick: 1.0, noOverlap: true })
      B.crumbleRun(6, 3, 2.6, 0.45)
      B.road(5, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0, noOverlap: true }); B.trapStraight({ w: 2.8, mat: 'cobble' }); B.road(7, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
      xgap(B, 4.3, -0.5); B.road(5, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
    },
    back: () => { B.road(6, { w: 2.8, slope: 10 * x.DEG, mat: 'cobble', thick: 1.0 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  x.decoKeep(() => {
  // v17 片輪しか乗らない杭（2）: 高い縁を登った直後（速さが出せない）。杭の頭は車輪の間より短く、杭の間は前輪が落ちる幅。ウィリーで後輪だけで乗り継ぐ
  B.mark('片輪の杭')
  excursion({
    sRise: 4.2,
    out: () => {
      B.road(6, { w: 3.2, mat: 'cobble', thick: 1.0, back: 0 }) // 縁の前で速さを落とす長さ（3m だと止まり切れず、縁に掛からない）
      B.hangLedge(1.6, 2.2, { w: 3.2, mat: 'cobble', max: 10 })
      x.P17.pegRow(B, {})
      B.road(3, { w: 3.2, mat: 'cobble', thick: 1.0, back: 0 })
    },
  })
  orbit(0.45, 1.0); otorch()
  })
}

// ================= 工場に足す: 動く床（必ず勢いかよじ登りと組み合わせる）
export function factoryMore(x) {
  const { B, orbit, otorch, excursion, W } = x
  x.free({ to: x.target() })
  B.cp('歯車の踊り場', { w: W, rest: true })
  B.mark('回る歯車'); orbit(0.4, 0.2); x.P.gearRun(B, { exit: 3.6 }); x.ostep(0.7); B.road(4, { w: 3.2, mat: 'rust', thick: 1.0, noOverlap: true, back: 0 }); orbit(0.4, 0.3); otorch() // 出口は短く、先に段の壁（勢いのまま来ると当たる）
  B.mark('倒れる煙突'); B.can(3); B.road(24, { w: 3.2, mat: 'rust', thick: 1.0, back: 0 }); x.P.chimney(B, {}); orbit(0.4, 0.3)
  B.cp('煙突の向こう', { w: W, rest: true })
  x.decoKeep(() => {
  // v17 段のある動く床（2+時間）: 手前で止まった床に乗り、床の上の段（0.5m）へウィリーで前輪を掛けて上がり、段の上で止まって運ばれる。向こうで止まったら高い縁を登る
  B.mark('段のある動く床')
  excursion({
    sRise: 5.2,
    out: () => {
      B.road(8, { w: 3.2, mat: 'grate', thick: 0.6, back: 0 })
      x.P17.stepLift(B, {})
      B.road(3, { w: 3.2, mat: 'rust', thick: 1.0, back: 0 })
    },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.9, 0.6) // v17 後（短いと鐘楼の塔の円柱が工場の道を飲む）
  })
  // 前後に動く床 → 着いた先は高い段（床の上で待って、向こうの端で段によじ登る）
  B.mark('動く床と高い段')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.6, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(5, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      B.mover('fwd', { len: 9, size: 3, w: 3.0, dwell: 2.2, move: 2.8 })
      B.road(1.5, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
      B.hangLedge(1.6, 5, { w: 3.0, mat: 'rust', max: 8, thick: 0.8 }) // 動く床の端から高い縁へ前輪を掛ける
    },
    back: () => { B.road(5, { w: 3.0, slope: 6 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  // 上がる床（上で降りるとすぐ高い段）
  B.mark('上がる床')
  excursion({
    Ru: 6, Rs: 12, sRise: 8.6, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(6, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      B.mover('up', { rise: 3.2, size: 3.2, w: 3.0, dwell: 2.4, move: 2.6 })
      B.road(1.2, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
      B.step(0.6); B.road(5, { w: 3.0, mat: 'rust', thick: 1.0, noOverlap: true }); B.road(9, { w: 3.0, mat: 'rust', thick: 1.0 })
      xgap(B, 4.3, -0.5); B.road(5, { w: 3.0, mat: 'rust', thick: 1.0, back: 0 })
    },
    back: () => { B.road(5, { w: 3.0, slope: 4 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.9)
  B.cp('鉄骨の踊り場', { w: W, rest: true })
  // 横に動く床へ、助走して跳び移る（1+時間）
  B.mark('横に動く床へ跳ぶ')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.6, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(15, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      const rise = B.kicker(2.2, 12 * x.DEG, { w: 2.8, mat: 'rust', thick: 0.6 })
      B.path[B.path.length - 1].vNeed = 8.5
      B.mover('side', { len: 8, plen: 3.6, w: 3.2, amp: 3.2, dy: rise - 0.4, vGo: 8.5, vJump: 8.5, runup: 10 })
      B.road(2, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
      B.step(0.7); B.road(5, { w: 3.0, mat: 'grate', thick: 1.2, noOverlap: true }); B.road(9, { w: 3.0, mat: 'grate', thick: 1.2 })
      xgap(B, 4.3, -0.5); B.road(5, { w: 3.0, mat: 'grate', thick: 1.0, back: 0 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 10 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  B.cp('回る橋の手前', { w: W, rest: true })
  // 回る橋（向きがそろった一瞬に、勢いで渡り切る）
  B.mark('回る橋')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.4, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(5, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 }); B.trapStraight({ w: 3.0, mat: 'grate' }); B.road(5, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      B.spinBridge(8, { w: 3.4, rate: 0.3, vGo: 8 })
      B.road(5, { w: 4.0, mat: 'rust', thick: 0.6, back: 0 }); B.trapStraight({ w: 4.0, mat: 'rust' }); B.road(6, { w: 4.0, mat: 'rust', thick: 0.6, back: 0 })
      xgap(B, 4.3, -0.5); B.road(5, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 11 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  gauntlet(x, '工場の回廊', ['steep', 'drop', 'gal', 'hop', 'pinch', 'nsteep', 'whoop', 'hang', 'drop', 'gal', 'hop'], { cpAt: 6, galMat: 'rust', hangHz: 'ball', T: 3.2, ph: 1.1 })
  B.cp('歯車の天井', { w: W, rest: true })
  // 試験: 動く床で渡って、すぐ上がる床、降りたら段
  B.mark('工場の試験')
  excursion({
    Ru: 6, Rs: 12, sRise: 9.0, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(12, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      B.door(1.5, { breakV: 6, mat: 'rust' }); B.road(15, { w: 3.0, mat: 'rust', thick: 0.6 })
      B.mover('up', { rise: 2.6, size: 3.2, w: 3.0, dwell: 3.0, move: 2.4, ph: 0.7 })
      B.road(1.2, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
      B.step(0.55); B.road(5, { w: 3.0, mat: 'rust', thick: 1.0, noOverlap: true })
    },
    back: () => { B.road(5, { w: 3.0, slope: 4 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
}

// ================= 鐘楼（主役: 重さで傾くシーソーと、揺れる鐘）
export function belfry(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'bell'; B.omat = 'cobble'
  x.free({ to: [470, -260], amp: 0.45, lam: 190 })
  B.cp('鐘楼の下', { w: W, rest: true })
  // 3 シーソー（ゆっくり乗ると重さで傾いて向こうへ下りる。速いと上がったままの端から飛び出して、向こうの壁に当たる）
  B.mark('シーソー')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.8, w: 3.0, mat: 'plank', plat: 'cobble', thick: 0.8,
    out: () => {
      B.road(6, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.seesaw(8, { w: 2.8, ang: 0.2 })
      B.road(5, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 }); B.trapStraight({ w: 3.0, mat: 'cobble' }); B.road(7, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      xgap(B, 4.3, -0.5); B.road(6, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 8 * x.DEG, mat: 'cobble', thick: 0.8 }) },
  })
  orbit(0.45, 1.0); otorch()
  // 2+時間 鐘の下の木箱（揺れる鐘の間を、段をよじ登りながら抜ける）
  x.tower({ sign: 1, r: 16, name: '鐘楼' })
  B.mark('鐘と木箱')
  orbit(0.2, 0)
  x.ostep(0.55); B.pendulum(4.5, { w: W, T: 3.6, ph: 0 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
  orbit(0.15, 0); B.hangLedge(1.6, 3.4, { w: W, max: 8, mat: B.omat }); B.pendulum(-2.8, { w: W, T: 4.8, ph: 1.8, L: 3.6 }); orbit(0.4, 0) // 鐘が縁の上を通り過ぎるまで、前輪を掛けて耐える
  orbit(0.45, 0.8); otorch()
  orbit(0.4, 0.9)
  B.cp('鐘楼の中ほど', { w: W, rest: true })
  // 3 シーソーの連続（2 枚目は短く急）
  B.mark('シーソーの連続')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.4, w: 3.0, mat: 'plank', plat: 'cobble', thick: 0.8,
    out: () => {
      B.road(5, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.seesaw(7, { w: 2.8, ang: 0.2, beam: false })
      B.road(2.2, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.seesaw(6, { w: 2.6, ang: 0.24 })
      B.road(5, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 }); B.trapStraight({ w: 3.0, mat: 'cobble' }); B.road(7, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      xgap(B, 4.3, -0.5); B.road(5, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 8 * x.DEG, mat: 'cobble', thick: 0.8 }) },
  })
  orbit(0.45, 1.0); otorch()
  // 2+時間 鐘の連続の下の木箱（3 つ目は高い）
  B.mark('鐘の連続')
  orbit(0.2, 0)
  x.ostep(0.5); B.pendulum(4.5, { w: W, T: 3.2, ph: 0.4 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
  x.ostep(0.6); B.pendulum(4.5, { w: W, T: 3.2, ph: 2.0 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
  orbit(0.15, 0); B.hangLedge(1.6, 3.4, { w: W, max: 7, mat: B.omat }); orbit(0.4, 0.3)
  orbit(0.45, 0.8); otorch()
  orbit(0.4, 0.9)
  gauntlet(x, '鐘楼の回廊', ['gal', 'drop', 'hang', 'hop', 'whoop', 'steep', 'pinch', 'gal', 'drop', 'hop', 'wide'], { cpAt: 6, galMat: 'castle', hangHz: 'ball', T: 3.0, hangMax: 7 })
  B.cp('鐘楼の上', { w: W, rest: true })
  B.mark('坂のウィリーの溝'); orbit(0.3, 0); B.road(3, { w: 3.2, mat: B.omat, thick: 1.0, back: 0 }); x.P.wheelieGrooves(B, { hang: 1.6, n: 7, slope: 0.16 }); orbit(0.4, 0.3)
  // 3 シーソーで下りた先の扉（ゆっくり下りたあと、短い助走で扉を破る）
  B.mark('シーソーと扉')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.0, w: 3.0, mat: 'plank', plat: 'cobble', thick: 0.8,
    out: () => {
      B.road(5, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.seesaw(7, { w: 2.8, ang: 0.2 })
      B.road(6, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 }); B.log(1.2, 0.15, 2.8); B.road(8, { w: 3.0, mat: 'cobble', thick: 0.8 })
      B.door(0.5, { breakV: 6 }); B.road(6, { w: 3.0, mat: 'cobble', thick: 0.8 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 8 * x.DEG, mat: 'cobble', thick: 0.8 }) },
  })
  orbit(0.45, 1.0); otorch()
  // 試験: 扉を破った勢いのまま段へ → 鐘
  B.mark('鐘楼の試験')
  excursion({
    Ru: 6, Rs: 12, sRise: 7.0, w: 3.0, mat: 'cobble', plat: 'cobble', thick: 0.8,
    out: () => {
      B.road(12, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.door(1.5, { breakV: 6.5 }); B.road(4, { w: 3.0, mat: 'cobble', thick: 0.8 })
      B.seesaw(7, { w: 2.8, ang: 0.2 })
      B.road(2.4, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.step(0.65); B.road(5, { w: 3.0, mat: 'cobble', thick: 1.4, noOverlap: true })
    },
    back: () => { B.road(6, { w: 3.0, slope: 8 * x.DEG, mat: 'cobble', thick: 0.8 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
}

// ================= 嵐の吊り橋（主役: 崩れる吊り橋を全開で駆け抜ける・突風の中の大ジャンプ）
export function storm(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'storm'; B.omat = 'snowrock'
  x.free({ to: [-380, 20], amp: 0.5, lam: 210 })
  B.cp('嵐の吊り橋', { w: W, rest: true })
  // 4 崩れていく吊り橋（横から突風）
  B.mark('崩れる吊り橋')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.6, w: 2.6, mat: 'plank', plat: 'snowrock', thick: 0.5,
    out: () => {
      const i0 = B.path.length
      B.road(7, { w: 2.6, mat: 'plank', thick: 0.5, back: 0 })
      B.gust(16, { sgn: 1, a: 4, T: 4.6, vGo: 9 })
      B.crumbleRun(16, 8, 2.4, 0.34)
      B.road(5, { w: 2.6, mat: 'plank', thick: 0.5, back: 0, noOverlap: true })
      B.chainRails(i0 + 1, B.path.length - 1, 2.6)
    },
    back: () => { B.road(6, { w: 2.8, slope: 11 * x.DEG, mat: 'plank', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  B.mark('揺れる鎖の吊り橋'); orbit(0.4, 0.2); B.road(3, { w: 2.6, mat: B.omat, thick: 1.0, back: 0 }); x.P.swingBridge(B, 22, {}); B.road(3, { w: 2.6, mat: B.omat, thick: 1.0, back: 0 }); orbit(0.4, 0.4, { w: 2.6 }); otorch()
  B.cp('吊り橋の向こう', { w: W, rest: true })
  forkAt(x, 2)
  // 1+2 嵐の中の大ジャンプ（速さの帯: 遅いと谷、速すぎると向こうの壁）
  B.mark('嵐の大ジャンプ')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.0, w: 3.0, mat: 'snowrock', plat: 'snowrock', thick: 1.0,
    out: () => {
      B.road(16, { w: 3.0, mat: 'snowrock', thick: 1.0, back: 0 })
      const rise = B.kicker(3, 18 * x.DEG, { w: 2.8, mat: 'plank', thick: 0.6 })
      B.path[B.path.length - 1].vNeed = 9.5
      B.gap(6, rise - 0.6, 'jump')
      B.road(5, { w: 3.4, mat: 'snowrock', thick: 1.0, back: 0, kind: 'landing' })
      B.step(0.75); B.road(5, { w: 3.0, mat: 'snowrock', thick: 1.0, noOverlap: true })
    },
    back: () => { B.road(6, { w: 3.0, slope: 9 * x.DEG, mat: 'snowrock', thick: 1.0 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  gauntlet(x, '嵐の回廊', ['hop', 'drop', 'nsteep', 'gal', 'pinch', 'hang', 'whoop', 'drop', 'steep', 'hop', 'gal'], { cpAt: 6, galMat: 'snowrock', hangHz: 'ball', T: 2.8, hangMax: 6 })
  B.cp('嵐の踊り場', { w: W, rest: true })
  // 1+2 下り坂から跳ぶ長い谷（速いほど遠い。着地のすぐ先に段の壁）
  B.mark('嵐の谷')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.4, w: 3.0, mat: 'snowrock', plat: 'snowrock', thick: 1.0,
    out: () => {
      B.road(8, { w: 3.0, mat: 'snowrock', thick: 1.0, back: 0 })
      B.road(8, { w: 3.0, mat: 'snowrock', thick: 1.0, slope: -6 * x.DEG })
      const rise = B.kicker(2.6, 15 * x.DEG, { w: 2.8, mat: 'plank', thick: 0.6 })
      B.path[B.path.length - 1].vNeed = 10
      B.gap(7, rise - 1.2, 'jump')
      B.road(4.5, { w: 3.4, mat: 'snowrock', thick: 1.0, back: 0, kind: 'landing' })
      B.step(0.7); B.road(5, { w: 3.0, mat: 'snowrock', thick: 1.0, noOverlap: true })
    },
    back: () => { B.road(6, { w: 3.0, slope: 9 * x.DEG, mat: 'snowrock', thick: 1.0 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  // 2+風 突風の中の段（風の弱い間に、ウィリーで段を越える）
  B.mark('嵐の段')
  orbit(0.3, 0.2)
  B.gust(10, { sgn: -x.outer(), a: 4, T: 9.0, ph: 0.6, vGo: 4 })
  orbit(0.25, 0, { w: 3.0 }); x.ostep(0.5); orbit(0.25, 0, { w: 3.0 }); B.hangLedge(1.6, 3.2, { w: 3.0, max: 7, mat: B.omat }); orbit(0.3, 0.2, { w: 3.0 }) // 風の中で縁に前輪を掛けて耐え、風が止んだら登る
  orbit(0.45, 0.9); otorch()
  orbit(0.4, 0.9)
  // 試験: 突風の中、崩れる橋 → 段
  B.mark('嵐の試験')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.4, w: 2.6, mat: 'plank', plat: 'snowrock', thick: 0.5,
    out: () => {
      B.road(9, { w: 2.6, mat: 'plank', thick: 0.5, back: 0 })
      B.gust(12, { sgn: -1, a: 4, T: 4.2, ph: 1.3, vGo: 9 })
      B.crumbleRun(12, 6, 2.4, 0.34)
      B.road(2.5, { w: 2.6, mat: 'plank', thick: 0.5, back: 0, noOverlap: true })
      B.step(0.6); B.road(5, { w: 2.8, mat: 'snowrock', thick: 1.0, noOverlap: true })
    },
    back: () => { B.road(6, { w: 2.8, slope: 9 * x.DEG, mat: 'plank', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
}

// ================= v16 廃墟の街と水道橋（v15 の B 廃墟を自由な道に）。最後に廃墟の塔のまわりを少しだけ登る
export function ruins(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'ruin'; B.omat = 'cobble'
  x.free({ to: [-260, -660], amp: 0.3, lam: 170 })
  B.cp('廃墟の張り出し', { w: W, rest: true })
  orbit(0.55, 0.9); otorch()
  B.log(1.6, 0.16, W - 0.3, 'marble')
  B.mark('崩れた張り出し'); orbit(0.5, 0.8)
  x.ogap(3.4, -0.5)
  orbit(0.5, 0.6); otorch()
  B.mark('崩れた石の段'); for (const h of [0.5, 0.62, 0.72]) { x.ostep(h); orbit(0.16, 0, { mat: 'crate', kind: 'crate' }) }
  orbit(0.85, 0.5, { plain: true }); x.ogap(4.3, -0.5); orbit(0.3, 0.3); otorch()
  B.mark('泥の坂')
  orbit(0.8, 0.2)
  { const s = orbit(0.6, 4.0, { mat: 'mud', mu: 0.3, kind: 'mud' }); s.mud = 60 }
  orbit(0.25, 0.75)
  orbit(0.6, 0.4)
  B.mark('跳ね板'); B.road(15, { w: 3.2, mat: B.omat, thick: 1.0, back: 0 }); x.P.springPlank(B, { beam: false }) /* v29 本人「最初の跳ね板のあと、頭上の枠いらない」: 着地坂の上の鉄骨の梁と柱を取った */; orbit(0.35, 0.3); otorch()
  B.mark('ウィリーの溝'); orbit(0.3, 0); B.road(3, { w: 3.2, mat: B.omat, thick: 1.0, back: 0 }); x.P.wheelieGrooves(B, { hang: 1.6, n: 4 }); orbit(0.4, 0.4)
  B.tut('brk')
  B.mark('朽ちた木の橋')
  excursion({
    sRise: 5.2, w: 2.8, mat: 'cobble', thick: 1.0,
    out: () => {
      const P = { w: 2.2, mat: 'plank', thick: 0.35, kind: 'bridge' }, i0 = B.path.length
      B.road(5, { ...P, back: 0 }); B.gap(1.3, 0, 'jump'); B.crumbleRun(7, 4, 2.2, 0.3)
      B.road(10, { ...P, slope: 3 * x.DEG }); B.road(5, P)
      B.chainRails(i0 + 1, B.path.length - 1, 2.2)
    },
    back: () => { B.road(6, { w: 2.8, slope: 12 * x.DEG, mat: 'cobble', thick: 1.0 }) },
  })
  orbit(0.6, 1.4); otorch()
  B.log(1.6, 0.18, W - 0.3, 'marble')
  orbit(0.4, 0.8)
  // 廃墟の塔: 湧き水の流れ（塔の壁から湧いて道を横切って外へ落ちる。立ち止まると流される）
  x.tower({ sign: 1, r: 18, name: '廃墟の塔' })
  B.mark('湧き水の流れ')
  orbit(0.12, 0)
  { const s = orbit(0.3, 0, { mat: 'wetstone', mu: 0.7, kind: 'water' }); s.flowR = 1.8; B.waters.push({ arc: s, u: 1.8 }) }
  orbit(0.5, 0.6)
  x.ogap(3.6, -0.4)
  orbit(0.5, 1.0); otorch()
  orbit(0.45, 1.0)
  x.free({ to: x.target() })
}

// ================= v16 工場（さびた鉄骨）。細い鉄骨を渡ってから、歯車の塔のまわりで段と跳ね橋
export function factory(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'factory'; B.omat = 'grate'
  x.free({ to: [180, 260], amp: 0.6, lam: 170 })
  B.cp('鉄の階', { w: W, rest: true })
  orbit(0.5, 0.8); otorch()
  B.mark('細い鉄骨と急な登り')
  excursion({
    sRise: 5.4, w: 2.6, mat: 'grate', thick: 0.5,
    out: () => {
      B.road(3, { w: 2.6, mat: 'grate', thick: 0.5, back: 0 })
      hbeam(B, 8, 0.62, 0, 'narrow')
      B.last = null
      B.road(3, { w: 2.6, mat: 'grate', thick: 0.5, back: 0 })
      B.road(8, { w: 2.6, mat: 'grate', slope: 26 * x.DEG, thick: 0.5, mu: 0.48, kind: 'steep' })
      B.road(3, { w: 2.6, mat: 'grate', thick: 0.5 })
      B.road(9, { w: 2.6, mat: 'grate', thick: 0.5 })
    },
    back: () => {
      B.road(1.5, { w: 2.6, mat: 'rust', thick: 0.5, back: 0 })
      B.crumbleRun(5.4, 3, 2.4, 0.5)
      B.road(1.2, { w: 2.6, mat: 'rust', thick: 0.5, back: 0, noOverlap: true })
    },
  })
  orbit(0.55, 1.3); otorch()
  x.tower({ sign: 1, r: 20, name: '歯車の塔' })
  B.mark('ウィリーの段'); orbit(0.25, 0); x.ostep(0.44); orbit(0.8, 0.6, { plain: true }); x.ogap(4.3, -0.5); orbit(0.4, 0.4)
  orbit(0.45, 0.8); otorch()
  B.mark('三段の壁'); orbit(0.2, 0)
  for (let k = 0; k < 2; k++) { x.ostep(0.72); orbit(0.16, 0) }
  orbit(0.12, 0); B.hangLedge(1.6, 3.4, { w: W, max: 9, mat: B.omat }); orbit(0.3, 0)
  orbit(0.25, 0.3)
  B.mark('跳ね橋'); orbit(0.6, 0.6)
  {
    const p0 = B.t.p.slice(), i0 = B.path.length
    B.curve(x.RM, 3.2 / x.RM * B.orbitSign, { noShape: true, rise: 0, kind: 'draw', pw: 3 })
    for (let k = i0; k < B.path.length; k++) B.path[k].w = 3
    const p1 = B.t.p.slice()
    B.drawbridgeAt(p0, p1, { w: 3.2, ph: 0, roadW: W })
  }
  orbit(0.85, 0.8, { plain: true }); x.ogap(4.3, -0.5); orbit(0.3, 0.4); otorch()
  x.ostep(0.44); orbit(0.45, 0.8)
  orbit(0.4, 0.8)
  x.free({ to: x.target() })
}

// ================= v16 氷の尖塔（最後の塔。屋上から谷を跳んで天空城へ）
export function ice(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'ice'; B.omat = 'snowrock'
  x.free({ to: [520, -360], amp: 0.3 })
  B.cp('氷の階', { w: W, rest: true })
  orbit(0.45, 0.6); otorch()
  forkAt(x, 3)
  B.mark('風の吊り橋'); orbit(0.4, 0.2); B.road(3, { w: 2.6, mat: B.omat, thick: 1.0, back: 0 }); x.P.swingBridge(B, 24, { wind: true }); B.road(3, { w: 2.6, mat: B.omat, thick: 1.0, back: 0 }); orbit(0.4, 0.3, { w: 2.6 })
  B.mark('氷の岩を跳ぶ')
  excursion({
    sRise: 5.2, w: 2.8, mat: 'snowrock', thick: 1.2,
    out: () => {
      const S = { w: 3.0, mat: 'snowrock', thick: 1.2 }
      B.road(6, { ...S, back: 0 }); B.road(3, S)
      { const rise = B.kicker(2.4, 14 * x.DEG, { w: 2.6, mat: 'snowrock', thick: 0.8 }); B.path[B.path.length - 1].vNeed = 8; B.gap(4.2, rise - 0.5, 'jump') }
      B.road(3.5, { ...S, back: 0, kind: 'landing' }); B.step(0.7); B.road(3, { ...S, noOverlap: true }); B.torch(-1, 1, { w: 3, down: 1 })
      B.road(7, { w: 2.6, mat: 'ice', thick: 0.8, slope: 4 * x.DEG, back: 0 })
      B.road(4, S)
    },
    back: () => { B.road(6, { w: 2.8, slope: 12 * x.DEG, mat: 'snowrock', thick: 1.2 }) },
  })
  orbit(0.5, 1.2, { mat: 'ice' }); otorch()
  B.mark('濡れた段'); orbit(0.4, 0.3, { plain: true }); x.ogap(4.2, -0.5); orbit(0.3, 0.2)
  x.ostep(0.72); orbit(0.3, 0, { mat: 'ice', mu: 0.62 })
  B.mark('凍った急坂'); orbit(0.45, 0.2)
  orbit(0.6, 4.6, { mat: 'ice', mu: 0.4, kind: 'steep' }); orbit(0.25, 0.1)
  orbit(0.35, 0.4, { mat: 'ice' })
  B.cp('凍った坂の上', { w: W, rest: true })
  x.tower({ sign: 1, r: 15, name: '氷の尖塔', crown: 0 }) // 最後の塔: 屋上を走って谷を跳ぶ（v15 と同じ大きさ）
  B.mark('落石'); orbit(0.15, 0)
  B.rockfall(2.5, { ph: 0, hd: 5.6 }); B.rockfall(7.5, { ph: 1.7, hd: 7.2, lat: 0.6 })
  orbit(0.65, 4.6, { mat: 'ice', mu: 0.6 }) // v31: 0.45→0.6（落石で止まった後、止まった所からアクセルで登り直せる。0.45 は止まると滑って下がり続けた）
  orbit(0.4, 0.8)
  B.cp('突風の手前', { w: W, rest: true })
  B.mark('突風の細い張り出し')
  orbit(0.55, 0.3)
  B.gust(9, { sgn: -x.outer(), a: 5.5, T: 6.5 })
  orbit(0.55, 1.0, { mat: 'ice', mu: 0.5, w: 2.7 })
  orbit(0.3, 0.2)
  x.ogap(3.0, -0.3)
  orbit(0.45, 0.9); otorch()
  orbit(0.5, 0.9)
}

// ================= v16 道を選ぶ横に動く床（3 か所。後ほど短い道と長い道の差が大きい）
// 短い道（技）: 1 段と急な登り / 2 高い縁と細い梁 / 3 高い縁・ウィリーの溝・ニトロの坂
// 長い道（安全）: 遠回りで燃料の缶と見どころ。途中の朽ちた扉は勢いで破る（歩く人は通れない）
export function forkAt(x, lv) {
  const { B } = x, DEG = x.DEG
  const w = 3.2, mat = B.omat
  if (lv === 1) B.cp('分かれ道' + lv, { w: 3.2, rest: true }) // 2・3 は直前に旗がある（吊り橋の向こう・氷の階）
  B.mark('道を選ぶ床' + lv)
  const L = [0, 46, 74, 110][lv]
  x.fork({
    main: lv === 2 ? 'R' : 'L', ahead: [0, 46, 52, 62][lv], rise: [0, 4, 6, 9][lv], amp: 6, w, mat,
    hard: (S, sg) => {
      const R = { w, mat, thick: 1.0 }
      S.road(2, { ...R, back: 0 }); S.step(lv === 1 ? 0.6 : 0.7); S.road(3, { ...R, noOverlap: true })
      if (lv === 1) { S.road(7, { ...R, slope: 38 * DEG, kind: 'steep', mu: 0.95 }); S.road(3, R) }
      if (lv === 2) { S.hangLedge(1.6, 4, { w, mat, max: 8 }); S.road(9, { w: 0.6, mat: 'beam', thick: 0.3, kind: 'narrow', back: 0 }); S.road(3, { ...R, back: 0 }) }
      if (lv === 3) { S.hangLedge(1.6, 3, { w, mat, max: 8 }); x.P.wheelieGrooves(S, { n: 4 }); S.can(2); S.road(6, R); S.road(9, { ...R, slope: 41 * DEG, kind: 'steep', mu: 0.95 }); for (let j = S.path.length - 15; j < S.path.length; j++) S.path[j].nitro = true; S.road(3, R) }
    },
    safe: (B2, sg) => {
      const R = { w, mat, thick: 1.0 }
      B2.road(4, { ...R, back: 0 })
      B2.curve(14, -sg * 0.7, R)
      B2.road(L * 0.15, R); B2.can(2); B2.trapStraight({ w, mat }); B2.road(L * 0.15, { ...R, back: 0 }); B2.door(6, { breakV: 6 }); B2.torch(-sg, 2, { w })
      B2.road(L * 0.12, R); B2.gap(1.5, 0, 'jump'); B2.path[B2.path.length - 1].vJump = 5.5; B2.road(L * 0.13, { ...R, back: 0 })
      B2.curve(14, sg * 0.7, R)
      B2.road(L * 0.1, R); B2.trapStraight({ w, mat }); B2.road(L * 0.1, { ...R, back: 0 }); if (lv === 3) B2.can(3)
    },
  })
}
