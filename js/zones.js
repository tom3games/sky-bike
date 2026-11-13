// v13 で足した区間（塔のまわり）。どの区間も「歩くキャラクターでは成り立たない」ことが決まり:
//   1 勢い（速さがないと越えられない）2 バイクの体の動き（ウィリー・段のよじ登り・空中の角度）
//   3 重さと力で世界を動かす（シーソー・体当たりで扉を壊す）4 速さが生む山場（追ってくる溶岩・崩れる橋）
// 時間を読むだけの仕掛け（動く床・鉄球）は、必ず 1〜4 と組み合わせる。
// ctx = { B, orbit, ogap, ostep, otorch, outer, excursion, W, RM, DEG }

// 塔のまわりの道で木箱の段（ostep + 短い円弧）
function ocrates(x, heights, gapAng = 0.16, o = {}) {
  for (const h of heights) { x.ostep(h); x.orbit(gapAng, 0, { mat: 'crate', kind: 'crate', mu: o.mu }) }
}
// 塔のまわりの道で、進む向きと逆へ流れる水路（止まると押し戻される）
function ochannel(x, ang, rise, u = 2.0) {
  const s = x.orbit(ang, rise, { mat: 'wetstone', mu: 0.72, kind: 'water' })
  s.flowT = -u * x.B.orbitSign
  x.B.waters.push({ arc: s, u, tan: x.B.orbitSign })
  return s
}

// 周を重ねて登る（抜ける床・溝・崩れる敷石が 2 本に 1 本。半周ごとに松明、真ん中に旗）
export function laps(x, n, name) {
  const { B, orbit, otorch, W } = x
  B.mark(name)
  for (let k = 0; k < n * 12; k++) {
    orbit(0.52, 1.05)
    if (k % 3 === 2) otorch()
    if (k === n * 6) B.cp(name + 'の途中', { w: W, rest: true })
  }
}

// ================= 墓所と地下水路（暗い。主役: 逆に流れる水路と、体当たりで壊す朽ちた扉。始まりは下から溶岩が追ってくる）
export function crypt(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.zone = 'crypt'; B.omat = 'cobble'
  B.cp('墓所の入口', { w: W, rest: true })
  // 4 溶岩に追われて登る（止まると追いつかれる。段は勢いで越える低い物だけ）
  B.mark('溶岩に追われて')
  const r0 = B.path.length, y0 = B.t.p[1]
  B.decoOn = false // 追われる区間には、抜ける床や溝を仕込まない
  orbit(0.5, 1.2); otorch()
  x.ostep(0.28); orbit(0.5, 1.1)
  orbit(0.5, 1.2); otorch()
  x.ostep(0.3); orbit(0.5, 1.2)
  orbit(0.55, 1.3); otorch()
  orbit(0.5, 1.2)
  B.risers.push({ i0: r0 + 2, i1: B.path.length, y0: y0 - 3.2, rate: 0.72, yTop: B.t.p[1] - 0.4, delay: 1.0 })
  B.decoOn = true
  B.cp('溶岩の上', { w: W, rest: true })
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
  orbit(0.2, 0)
  ochannel(x, 0.2, 0, 1.6)
  x.ostep(0.42); ochannel(x, 0.22, 0, 1.6)
  x.ostep(0.42); ochannel(x, 0.22, 0, 1.6)
  orbit(0.4, 0.6); otorch()
  orbit(0.45, 1.0)
  // 3+2 扉の向こうに木箱（扉を破る速さのまま段には行けない。破ったら止まって段をよじ登る）
  B.mark('扉と木箱')
  excursion({
    Ru: 6, Rs: 12, sRise: 7.2, w: 3.0, mat: 'cobble', plat: 'cobble', thick: 1.2,
    out: () => {
      const S = { w: 3.0, mat: 'cobble', thick: 1.2 }
      B.road(13, { ...S, back: 0 }); B.door(1.5, { breakV: 6 }); B.road(13, S)
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
  laps(x, 3, '墓所の回廊')
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
      B.road(11, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
    },
    back: () => { B.road(6, { w: 2.8, slope: 12 * x.DEG, mat: 'cobble', thick: 1.0 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  laps(x, 3, '廃墟の回廊')
  B.cp('廃墟の街の上', { w: x.W, rest: true })
  // 4+2 崩れる足場の上の段（止まると崩れる。勢いを殺さずに段へ）
  B.mark('崩れる足場と段')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.2, w: 2.8, mat: 'cobble', plat: 'cobble', thick: 1.0,
    out: () => {
      B.road(8, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0 })
      B.crumbleRun(8, 4, 2.6, 0.45)
      B.road(6, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0, noOverlap: true })
      B.step(0.45); B.road(4, { w: 2.8, mat: 'cobble', thick: 1.0, noOverlap: true })
      B.crumbleRun(6, 3, 2.6, 0.45)
      B.road(8, { w: 2.8, mat: 'cobble', thick: 1.0, back: 0, noOverlap: true })
    },
    back: () => { B.road(6, { w: 2.8, slope: 10 * x.DEG, mat: 'cobble', thick: 1.0 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
}

// ================= 工場に足す: 動く床（必ず勢いかよじ登りと組み合わせる）
export function factoryMore(x) {
  const { B, orbit, otorch, excursion, W } = x
  B.cp('歯車の踊り場', { w: W, rest: true })
  // 前後に動く床 → 着いた先は高い段（床の上で待って、向こうの端で段によじ登る）
  B.mark('動く床と高い段')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.6, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(5, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      B.mover('fwd', { len: 9, size: 3, w: 3.0, dwell: 2.2, move: 2.8 })
      B.road(1.5, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
      B.step(0.7); B.road(5, { w: 3.0, mat: 'rust', thick: 1.2, noOverlap: true })
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
      B.step(0.6); B.road(5, { w: 3.0, mat: 'rust', thick: 1.0, noOverlap: true })
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
      B.road(10, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      const rise = B.kicker(2.2, 12 * x.DEG, { w: 2.8, mat: 'rust', thick: 0.6 })
      B.path[B.path.length - 1].vNeed = 8.5
      B.mover('side', { len: 8, plen: 3.6, w: 3.2, amp: 3.2, dy: rise - 0.4, vGo: 8.5, vJump: 8.5, runup: 10 })
      B.road(2, { w: 3.0, mat: 'rust', thick: 0.6, back: 0 })
      B.step(0.7); B.road(5, { w: 3.0, mat: 'grate', thick: 1.2, noOverlap: true })
    },
    back: () => { B.road(6, { w: 3.0, slope: 10 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  // 回る橋（向きがそろった一瞬に、勢いで渡り切る）
  B.mark('回る橋')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.4, w: 3.0, mat: 'grate', plat: 'rust', thick: 0.6,
    out: () => {
      B.road(12, { w: 3.0, mat: 'grate', thick: 0.6, back: 0 })
      B.spinBridge(8, { w: 3.4, rate: 0.3, vGo: 8 })
      B.road(7, { w: 4.0, mat: 'rust', thick: 0.6, back: 0 })
    },
    back: () => { B.road(6, { w: 3.0, slope: 11 * x.DEG, mat: 'grate', thick: 0.6 }) },
  })
  orbit(0.45, 1.0); otorch()
  orbit(0.4, 0.8)
  laps(x, 3, '工場の回廊')
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
  B.cp('鐘楼の下', { w: W, rest: true })
  // 3 シーソー（ゆっくり乗ると重さで傾いて向こうへ下りる。速いと上がったままの端から飛び出して、向こうの壁に当たる）
  B.mark('シーソー')
  excursion({
    Ru: 6, Rs: 12, sRise: 5.8, w: 3.0, mat: 'plank', plat: 'cobble', thick: 0.8,
    out: () => {
      B.road(6, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.seesaw(8, { w: 2.8, ang: 0.2 })
      B.road(2.4, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.step(0.6); B.road(6, { w: 3.0, mat: 'cobble', thick: 1.4, noOverlap: true })
    },
    back: () => { B.road(6, { w: 3.0, slope: 8 * x.DEG, mat: 'cobble', thick: 0.8 }) },
  })
  orbit(0.45, 1.0); otorch()
  // 2+時間 鐘の下の木箱（揺れる鐘の間を、段をよじ登りながら抜ける）
  B.mark('鐘と木箱')
  orbit(0.2, 0)
  x.ostep(0.55); B.pendulum(4.5, { w: W, T: 3.6, ph: 0 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
  x.ostep(0.55); B.pendulum(4.5, { w: W, T: 3.6, ph: 1.8 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
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
      B.road(2.2, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.step(0.5); B.road(5, { w: 3.0, mat: 'cobble', thick: 1.3, noOverlap: true })
    },
    back: () => { B.road(6, { w: 3.0, slope: 8 * x.DEG, mat: 'cobble', thick: 0.8 }) },
  })
  orbit(0.45, 1.0); otorch()
  // 2+時間 鐘の連続の下の木箱（3 つ目は高い）
  B.mark('鐘の連続')
  orbit(0.2, 0)
  x.ostep(0.5); B.pendulum(4.5, { w: W, T: 3.2, ph: 0.4 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
  x.ostep(0.6); B.pendulum(4.5, { w: W, T: 3.2, ph: 2.0 }); orbit(0.5, 0, { mat: 'crate', kind: 'crate' })
  x.ostep(0.72); orbit(0.4, 0.3)
  orbit(0.45, 0.8); otorch()
  orbit(0.4, 0.9)
  laps(x, 3, '鐘楼の回廊')
  B.cp('鐘楼の上', { w: W, rest: true })
  // 3 シーソーで下りた先の扉（ゆっくり下りたあと、短い助走で扉を破る）
  B.mark('シーソーと扉')
  excursion({
    Ru: 6, Rs: 12, sRise: 6.0, w: 3.0, mat: 'plank', plat: 'cobble', thick: 0.8,
    out: () => {
      B.road(5, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
      B.seesaw(7, { w: 2.8, ang: 0.2 })
      B.road(14, { w: 3.0, mat: 'cobble', thick: 0.8, back: 0 })
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
  laps(x, 3, '嵐の回廊')
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
  orbit(0.25, 0, { w: 3.0 }); x.ostep(0.5); orbit(0.25, 0, { w: 3.0 }); x.ostep(0.5); orbit(0.3, 0.2, { w: 3.0 })
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
