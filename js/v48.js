// SKY BIKE v48 下山（エピローグ）: 門の場面とエンドクレジットの後、天空城の来たのとは反対側から下る道。
// ほとんど壊れた道（凸凹の岩道・崩れた橋・ジャンプの連続）を、下り坂で速さに乗って跳び続ける。最大の速さでないと届かない所もある（手前に燃料の缶）。
// 落ちたら近くの旗から（game.js）。猿・罠・人の会話は無し。半分ほど下りた所の小さな山の上に木の小屋（窓に灯り・横に錆びたバイク）。
// 小屋の前に着くと、ゆっくり暗くなって結果へ。道の点は v37added に数える（罠・猿などの置き場所を変えない）。旗は finish の後に並ぶ（climb の休憩所と同じ扱い）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180

// 跳ぶ速さの下限: 角度 ang の台の先から、横 gap・下へ drop の着地の頭へ届く一番遅い速さ（空気の抵抗なし。少し余裕を足して使う）
export function vMinJump(gap, drop, ang) {
  for (let v = 3; v < 30; v += 0.05) { const vx = v * Math.cos(ang), vy = v * Math.sin(ang), d = vy * vy + 2 * 9.81 * drop; const t = (vy + Math.sqrt(d)) / 9.81; if (vx * t >= gap + 0.4) return +v.toFixed(2) }
  return 30
}

export function descent(B, base, yaw0) {
  const E = B.epi = { i0: B.path.length, cps: [] }
  B.zone = 'castle'
  const f0 = B.dir(yaw0), L0 = B.right(yaw0).map(v => -v)
  // 城の土台の左の端（来た門の反対側の奥）から、左へ出る
  B.t.p = add3(add3(base, f0, 28), L0, 18); B.t.yaw = yaw0 + 90 * DEG; B.last = null
  const RK = { w: 4.6, mat: 'rock', thick: 1.6 }, BR = { w: 3.6, mat: 'bridgeplank', thick: 0.35 }, DT = { w: 5, mat: 'dirt', thick: 1.4 }
  const flag = name => { B.cp(name, { w: B.last ? B.last.w : 4.6, rest: true }); E.cps.push(B.cps.length - 1) }
  const down = (len, deg, o = RK) => B.road(len, { ...o, slope: -deg * DEG })
  // 跳ぶ: 平ら 3m → 台 → 切れ目（下へ drop）→ 下り坂の着地。vNeed は台の先の速さ（bot の目安）
  const jump = (gap, drop, o = {}) => {
    const ang = (o.ang ?? 14) * DEG
    B.road(o.flat ?? 4, { ...RK, ...(o.mat ? { mat: o.mat } : {}), w: o.w ?? RK.w })
    const rise = B.kicker(o.klen ?? 3, ang, { w: 3.8, mat: 'plank', thick: 0.7 })
    const vm = vMinJump(gap, drop + rise, ang)
    B.path[B.path.length - 1].vNeed = vm + 1
    B.gap(gap, -rise - drop, 'jump'); B.path[B.path.length - 1].vJump = Math.min(o.vMax ?? 13.2, vm + (o.extra ?? 1.6))
    B.road(o.land ?? 10, { ...RK, w: o.lw ?? 5.4, slope: -(o.lslope ?? 16) * DEG, kind: 'landing', back: 0 })
    return vm
  }
  E.vNeeds = []
  // ---------------- 城の裏の出口
  B.road(10, { w: 6, mat: 'castle', thick: 3 })
  flag('城の裏')
  B.mark('下山 崩れた参道')
  B.road(8, { w: 6, mat: 'castle', thick: 2 })
  down(10, 6); down(16, 12); B.road(2, RK)
  B.step(-0.35); down(12, 10)
  B.step(-0.4); down(10, 13)
  E.vNeeds.push(jump(5.5, 1.2))
  down(14, 11)
  B.step(-0.3); down(10, 8)
  E.vNeeds.push(jump(7.5, 2.0))
  down(12, 12)
  // 右へ曲がって前（城の向き）へ。下りながら
  B.curve(22, -90 * DEG, { ...RK, w: 5.2, rise: -5, pw: 4.6 })
  B.road(6, RK)
  flag('崩れた橋の手前')
  B.mark('下山 崩れた橋')
  down(10, 10)
  // 崩れた橋: 板の切れ目が続く（速さのまま越える）
  B.road(4, BR)
  for (const [g, L] of [[1.6, 7], [2.2, 6], [1.4, 5], [2.8, 8], [1.8, 6]]) { B.gap(g, -0.25, 'jump'); B.path[B.path.length - 1].vJump = 8.5; B.road(L, { ...BR, back: 0, kind: 'landing' }) }
  B.road(3, BR)
  down(12, 9)
  E.vNeeds.push(jump(9, 3.5, { lslope: 18, land: 12 }))
  down(16, 12)
  B.curve(30, 35 * DEG, { ...RK, w: 5.2, rise: -4, pw: 4.6 })
  down(10, 10)
  B.curve(30, -35 * DEG, { ...RK, w: 5.2, rise: -4, pw: 4.6 })
  B.road(6, RK)
  flag('尾根の上')
  B.mark('下山 尾根を跳ぶ')
  down(12, 10)
  E.vNeeds.push(jump(6.5, 1.5, { land: 8, lslope: 12 }))
  B.curve(24, -30 * DEG, { ...RK, w: 5.2, rise: -3, pw: 4.6 })
  down(14, 12)
  B.step(-0.35); down(8, 9); B.step(-0.35); down(8, 9)
  E.vNeeds.push(jump(9.5, 3, { land: 10, lslope: 17 }))
  B.curve(24, 30 * DEG, { ...RK, w: 5.2, rise: -3, pw: 4.6 })
  down(16, 10)
  E.vNeeds.push(jump(12, 4, { land: 12, lslope: 18 }))
  down(10, 8)
  B.road(6, RK)
  flag('跳び石の上')
  B.mark('下山 跳び続ける')
  down(14, 12)
  // 跳んで・下って・また跳ぶ（3 回続けて）
  E.vNeeds.push(jump(8, 2.5, { land: 8 }))
  down(10, 14)
  E.vNeeds.push(jump(9.5, 3, { land: 8 }))
  down(10, 14)
  E.vNeeds.push(jump(10.5, 3.5, { land: 10, lslope: 18 }))
  down(18, 10)
  B.can(4)
  B.road(6, RK)
  flag('大きな切れ目の上')
  B.mark('下山 全開で届く')
  B.can(3)
  // 長い下りの助走 → 全開（約 12.5m/s）でないと届かない切れ目。ニトロなら余裕
  down(6, 8); down(30, 14, { ...RK, mat: 'rock' }); down(6, 6)
  E.vNeeds.push(jump(17, 6, { flat: 4, ang: 13, land: 16, lslope: 20, lw: 6, extra: 1.0, vMax: 13.4 }))
  down(12, 10)
  B.curve(26, 40 * DEG, { ...RK, w: 5.2, rise: -4, pw: 4.6 })
  down(12, 9)
  B.road(4, BR)
  for (const [g, L] of [[2.4, 6], [3.0, 5], [2.0, 7]]) { B.gap(g, -0.3, 'jump'); B.path[B.path.length - 1].vJump = 9; B.road(L, { ...BR, back: 0, kind: 'landing' }) }
  down(10, 10)
  B.curve(26, -40 * DEG, { ...RK, w: 5.2, rise: -3, pw: 4.6 })
  B.road(6, RK)
  flag('小屋の見える所')
  B.mark('下山 小屋へ')
  down(12, 11)
  E.vNeeds.push(jump(8.5, 2.5, { land: 10 }))
  down(16, 9)
  E.vNeeds.push(jump(7, 2, { land: 8, lslope: 12 }))
  down(10, 6, DT); B.road(10, DT)
  // 小さな山: 少し登って、頂上の平らな所（小屋の前）
  B.road(14, { ...DT, slope: 6 * DEG })
  B.road(6, { ...DT, slope: 3 * DEG })
  const top = B.t.p.slice(), yaw = B.t.yaw, f = B.dir(yaw), R = B.right(yaw)
  B.road(13, { w: 12, mat: 'dirt', thick: 2.4 })
  { const c = add3(add3(top, f, 20.5), [0, 1, 0], -1.2); B.box({ c, h: [7.6, 1.2, 6], yaw, mat: 'dirt', tag: 'pad' }) } // 小屋の立つ所（道の点は小屋の手前で終わる）
  B.closeMark()
  E.i1 = B.path.length
  for (const m of B.marks) if (m.name.startsWith('下山')) m.drop = 45 // tools/tech.mjs: 下りなので、落ちたと見なすのは 45m 下
  // 頂上の広場の下の山（岩の塊を下へ細く。当たりあり）
  const mid = add3(top, f, 11)
  B.box({ c: add3(mid, [0, 1, 0], -5.5), h: [11, 3.2, 11], yaw: yaw + 0.2, mat: 'rock', tag: 'castle' })
  B.box({ c: add3(mid, [0, 1, 0], -12), h: [8, 4, 8.5], yaw: yaw + 0.6, mat: 'rockdark', tag: 'castle' })
  B.box({ c: add3(mid, [0, 1, 0], -19.5), h: [5, 4, 5.5], yaw: yaw + 1.0, mat: 'rockdark', tag: 'castle' })
  B.box({ c: add3(mid, [0, 1, 0], -26), h: [2.6, 3, 2.8], yaw: yaw + 1.4, pitch: 0.2, mat: 'rockdark', tag: 'castle' })
  // 山の肩（広場のまわりの斜めの岩。広場より下・道の外）
  for (const [fw, lat, rot, pt, h] of [[2, 9.5, 0.3, 0.5, 4], [16, 10, -0.4, -0.45, 5], [22, -9, 0.5, 0.4, 4.5], [6, -10, -0.2, -0.5, 4], [26, 3, 0.9, 0.35, 5]]) {
    const c0 = add3(add3(add3(top, f, fw), R, lat), [0, 1, 0], -h * 0.9)
    B.box({ c: c0, h: [h * 1.2, h * 0.8, h], yaw: yaw + rot, pitch: pt, roll: pt * 0.6, mat: 'rock', tag: 'castle' })
  }
  // 木の小屋（道の先・少し左。当たりあり）: 床・壁・屋根・煙突。窓と灯りは見た目（v48view）
  const cab = add3(add3(top, f, 21), R, -1.8), cy = yaw
  const at = (fw, side, up) => add3(add3(add3(cab, B.dir(cy), fw), B.right(cy), side), [0, 1, 0], up)
  B.box({ c: at(0, 0, 0.12), h: [2.6, 0.12, 3.2], yaw: cy, mat: 'plank', tag: 'cabin' })
  B.box({ c: at(-2.5, 0, 1.4), h: [0.2, 1.3, 3.2], yaw: cy, mat: 'plankold', tag: 'cabin' }) // 手前の壁（扉と窓のある面）
  B.box({ c: at(2.5, 0, 1.4), h: [0.2, 1.3, 3.2], yaw: cy, mat: 'plankold', tag: 'cabin' })
  for (const s of [-1, 1]) B.box({ c: at(0, s * 3.1, 1.4), h: [2.6, 1.3, 0.2], yaw: cy, mat: 'plankold', tag: 'cabin' })
  for (const s of [-1, 1]) B.box({ c: at(0, s * 1.75, 3.35), h: [2.95, 0.1, 1.95], yaw: cy, roll: s * 0.62, mat: 'plank', tag: 'cabin' }) // 屋根（左右の 2 枚）
  B.box({ c: at(1.2, 1.6, 3.9), h: [0.3, 0.9, 0.3], yaw: cy, mat: 'cobble', tag: 'cabin' }) // 煙突
  E.cabin = { p: cab, yaw: cy, front: at(-4.6, 0, 0), win: at(-2.75, -1.6, 1.55), door: at(-2.75, 1.0, 1.0), bike: at(-1.2, 4.0, 0) }
  E.end = at(-7, 0, 0)
  { const m = B.marks.find(x => x.name === '下山 小屋へ'); if (m) m.end = E.end.slice() }
}
