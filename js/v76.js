// SKY BIKE v76 頭を使って一工夫する場所 2 つ（本人の案）。道の形・道の点の数は変えない。今ある平らな道の上に物を足すだけ（後ろの区間は 1 つも動かない）
//  A 押す石と門（崩れ落ちる空中回廊の入口。旗「崩れる回廊の手前」のすぐ先）:
//    道に石のブロックが置いてある。体当たりで少しずつ押せる（床の溝に沿って前へだけ）。先の床のボタンに載せると、その先の門が開いたままになる。
//    石はウィリーで乗り越えられる高さなので、気づかないと素通りする。ボタンは自分のバイクが載っている間も門を開けるが、離れるとゆっくり閉じる。
//    門は上から下へ閉じる。ボタンから全開で走っても、くぐる所でぎりぎり頭が当たる（ニトロならあと少し）
//  B ローラーの巻き上げ機と落とし格子（回る筒を出た先の工場の鉄の床。旗「暗い通路の入口」の手前）:
//    床に埋まった 2 本の鉄のローラー。走って通るだけでは何も起きない。後輪をローラーに載せて、ブレーキ（前輪が止まる）とアクセルを同時に押すと
//    後輪だけが空転してローラーが回り、鎖で落とし格子が上がる。離しても歯止めで止まる
// 動きは js/physics.js（V76・step76・track76・blockStep）。見た目は js/v76view.js。形の一覧（当たり）は全部ここで作る
import { V76 } from './physics.js?v=76'
import { Builder } from './course.js?v=76'
import { finish16 } from './parts16.js?v=76'
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const num = (k, d) => +(globalThis[k] ?? d)
// A の寸法（m）。flag からの道のり s で置く
export const PA = {
  flag: '崩れる回廊の手前', mark: '崩れ落ちる空中回廊', name: '押す石と門',
  block: [1.0, 0.5, 1.5], sBlock: num('__pbS', 6.5), push: num('__pbP', 5.0), // 石（前後・高さ・幅）・最初の真ん中・溝の長さ
  plateL: num('__pbL', 2.0), plateW: 2.4, plateUp: 0.06, // ボタン（石が溝の端で止まった時に、石の真ん中がボタンの真ん中）
  D: num('__pgD', 13.0), // ボタンの真ん中から門まで
  Hopen: num('__pgH', 2.03), vUp: num('__pgUp', 1.0), vDown: num('__pgDown', 0.4), Hs: 3.0, th: 0.5, // 門: 開いた時の下端の高さ・上がる速さ・下りる速さ・板の高さ・厚み
}
// B の寸法
export const PB = {
  flag: '暗い通路の入口', mark: '回る筒', name: 'ローラーの巻き上げ機', // 旗から手前へ測る（s は負。筒の一番下からは sRoll 11m・sGrate 18.6m。元からある松明 2 本（13m）がローラーの先で格子を照らす）
  sRoll: -15.0, rollR: 0.2, rollGap: 0.42, rollUp: 0.04, half: 0.45, // 2 本のローラーの真ん中・半径・軸の間・床から出る高さ・後輪が「載っている」と見なす前後の幅
  sGrate: -7.4, Hopen: 2.7, Hs: 3.0, th: 0.16, T: num('__wT', 3.2), notch: 12, // 落とし格子: 場所・上がり切った時の下端・高さ・厚み・全開の空転で上がり切る秒・歯止めの刻み
}

export function v76post(B) {
  if (globalThis.__noV76) { B.v76 = null; return }
  const P = B.path, out = { A: null, B: null }
  B.decor = B.decor || []
  const anchor = (flag) => {
    const cp = B.cps.find(q => q.name === flag); if (!cp) return null
    let i0 = -1, bd = 1e18; P.forEach((z, k) => { if (!z.p || z.branch) return; const d = (z.p[0] - cp.p[0]) ** 2 + (z.p[2] - cp.p[2]) ** 2 + ((z.p[1] - cp.p[1]) * 2) ** 2; if (d < bd) { bd = d; i0 = k } })
    const yaw = cp.yaw, f = B.dir(yaw), R = B.right(yaw), a = cp.p.slice(), w = cp.w, zone = P[i0].zone
    return { cp, i0, yaw, f, R, a, w, zone, at: (s, lat = 0, up = 0) => [a[0] + f[0] * s + R[0] * lat, a[1] + up, a[2] + f[2] * s + R[2] * lat] }
  }
  // 区間の名前を分ける: 旗から仕掛けの終わりまでを新しい区間に。元の区間はその先から（道の点は同じ）
  const splitMark = (old, name, i0, i1) => {
    const ms = B.marks || [], k = ms.findIndex(m => m.name === old); if (k < 0) return
    const m = ms[k]; if (i1 + 1 >= m.i1) return
    ms.splice(k, 0, { name, i0: Math.min(m.i0, i0), i1, end: P[i1].p.slice() }); m.i0 = i1 + 1
  }
  // ---------------- A 押す石・床のボタン・上から閉じる門
  { const X = anchor(PA.flag)
    if (X) {
      const { f, R, at, w, yaw, zone } = X, [bl, bh, bw] = PA.block
      const sEnd = PA.sBlock + PA.push, sGate = sEnd + PA.D
      const G = { kind: 'A', ax: [f[0], 0, f[2]], f, R, yaw, w, y0: X.a[1], len: PA.push, pressAt: PA.push - bl / 2 - PA.plateL / 2 - 0.05, Hopen: PA.Hopen, vUp: PA.vUp, vDown: PA.vDown, Hs: PA.Hs, M: V76.M, mu: V76.mu, sBlock: PA.sBlock, sPlate: sEnd, sGate, D: PA.D, a: X.a.slice(), i0: X.i0, i1: X.i0 + Math.ceil(sGate) + 2 }
      G.block = B.box({ c: at(PA.sBlock, 0, bh / 2), h: [bl / 2, bh / 2, bw / 2], yaw, mat: 'marble', mu: 0.95, tag: 'pblock', zone, mov: { type: 'pblock', g76: G, ext: [Math.abs(f[0]) * PA.push, 0, Math.abs(f[2]) * PA.push] } })
      G.btn = B.box({ c: at(sEnd, 0, PA.plateUp - 0.04), h: [PA.plateL / 2, 0.04, PA.plateW / 2], yaw, mat: 'edgesteel', mu: 1.0, tag: 'pbtn', zone, mov: { type: 'pbtn', g76: G, ext: [0, 0.1, 0] } })
      G.gate = B.box({ c: at(sGate, 0, PA.Hs / 2), h: [PA.th / 2, PA.Hs / 2, w / 2 + 0.15], yaw, mat: 'basalt', mu: 0.8, tag: 'pgate', zone, mov: { type: 'pgate', g76: G, ext: [0, PA.Hopen + 0.2, 0] } })
      // 門の枠: 道の外の 2 本の石の柱と、上の梁（板は柱の間を上下する）。どれも当たりあり
      const top = PA.Hopen + PA.Hs + 0.25, pl = w / 2 + 0.15 + 0.42
      for (const sg of [-1, 1]) B.box({ c: at(sGate, sg * pl, (top - 2.4) / 2), h: [0.55, (top + 2.4) / 2, 0.42], yaw, mat: 'castle', tag: 'gatehouse', zone })
      B.box({ c: at(sGate, 0, top + 0.45), h: [0.7, 0.45, pl + 0.6], yaw, mat: 'castle', tag: 'gatehouse', zone })
      // ボタンの脇の鎖の柱（道の外。ここから門の柱の上の滑車へ鎖が渡る）
      const postLat = -(w / 2 + 0.3), postTop = 0.9
      B.cyl({ a: at(sEnd, postLat, -1.2), b: at(sEnd, postLat, postTop), r: 0.09, mat: 'iron', tag: 'post', zone })
      B.decor.push({ kind: 'v76A', G, rail: [at(PA.sBlock - bl / 2 - 0.3, 0, 0), at(sEnd + bl / 2, 0, 0)], railLat: bw / 2 - 0.22, chainA: at(sEnd, postLat, postTop), chainB: at(sGate - 0.62, -pl, top - 0.2), plate: at(sEnd, 0, 0), plateL: PA.plateL, plateW: PA.plateW, pillarLat: pl, top })
      for (let i = X.i0; i <= G.i1 && i < P.length; i++) if (P[i].p && !P[i].branch) P[i].v76 = G
      splitMark(PA.mark, PA.name, X.i0, G.i1)
      out.A = G
    } }
  // ---------------- B ローラーの巻き上げ機と落とし格子
  { const X = anchor(PB.flag)
    if (X) {
      const { f, R, at, w, yaw, zone } = X
      const G = { kind: 'B', c: at(PB.sRoll, 0, 0.3), f: [f[0], 0, f[2]], R, yaw, w: w - 0.5, half: PB.half, T: PB.T, Hopen: PB.Hopen, Hs: PB.Hs, notch: PB.notch, y0: X.a[1], sRoll: PB.sRoll, sGrate: PB.sGrate, a: X.a.slice(), i0: X.i0 + Math.floor(PB.sRoll) - 3, i1: X.i0 + Math.ceil(PB.sGrate) + 2 }
      // 2 本のローラー（道を横切る鉄の筒。床から 4cm だけ出る。後輪がこの 2 本の間に収まる）
      G.rollers = [-1, 1].map(sg => { const s = B.cyl({ a: at(PB.sRoll + sg * PB.rollGap / 2, -(w / 2 - 0.3), PB.rollUp - PB.rollR), b: at(PB.sRoll + sg * PB.rollGap / 2, w / 2 - 0.3, PB.rollUp - PB.rollR), r: PB.rollR, mat: 'iron', mu: 1.0, tag: 'roller', zone }); s.noView = true; return s })
      G.grate = B.box({ c: at(PB.sGrate, 0, PB.Hs / 2), h: [PB.th / 2, PB.Hs / 2, w / 2 + 0.15], yaw, mat: 'girder', mu: 0.8, tag: 'wgrate', zone, mov: { type: 'wgrate', g76: G, ext: [0, PB.Hopen + 0.2, 0] } })
      G.grate.noView = true // 見た目は格子（v76view）。当たりは同じ外形の板
      // 格子の枠: 道の外の 2 本の鉄骨の柱と上の梁
      const top = PB.Hopen + PB.Hs + 0.2, pl = w / 2 + 0.15 + 0.3
      for (const sg of [-1, 1]) B.box({ c: at(PB.sGrate, sg * pl, (top - 2.4) / 2), h: [0.3, (top + 2.4) / 2, 0.3], yaw, mat: 'girder', tag: 'gatehouse', zone })
      B.box({ c: at(PB.sGrate, 0, top + 0.3), h: [0.4, 0.3, pl + 0.5], yaw, mat: 'girder', tag: 'gatehouse', zone })
      // 巻き上げ機の箱（ローラーの軸がつながる。道の外・左）
      const wl = w / 2 + 0.75 /* 右（左は元からある松明の柱に近い） */
      B.box({ c: at(PB.sRoll, wl, 0.2), h: [0.6, 0.75, 0.45], yaw, mat: 'rust', tag: 'winch', zone })
      B.decor.push({ kind: 'v76B', G, winch: at(PB.sRoll, wl, 0.95), pulley: at(PB.sGrate - 0.45, pl, top + 0.1), top, pillarLat: pl, rollLen: w - 0.6, rollR: PB.rollR, rollGap: PB.rollGap, rollY: PB.rollUp - PB.rollR })
      for (let i = G.i0; i <= G.i1 && i < P.length; i++) if (P[i].p && !P[i].branch) P[i].v76 = G
      { const ms = B.marks || [], k = ms.findIndex(m => m.name === PB.mark), iM = X.i0 + Math.floor(PB.sRoll); if (k >= 0) { const m = ms[k]; m.i1 = iM - 1; m.end = P[m.i1].p.slice(); ms.splice(k + 1, 0, { name: PB.name, i0: iM, i1: G.i1, end: P[G.i1].p.slice() }) } } // 「回る筒」は筒を出た所まで。その先を新しい区間に
      out.B = G
    } }
  B.v76 = out
}

// 試し用の短いコース（まっすぐな道だけ）: 仕掛け 2 つを同じ寸法で置く。道の作りに Math.sin などを使わないので、node・Chromium・WebKit で 1 ビットも違わない（指紋の比べに使う）
export function lab76() {
  const B = new Builder([0, 20, 0], 0)
  B.plats = []; B.props = []
  B.zone = 'castle'; const C = { w: 4.2, mat: 'castle', thick: 1.2 }
  B.road(8, C); B.cp(PA.flag, { w: 4.2, rest: true }); B.mark(PA.mark); B.road(40, C)
  B.zone = 'factory'; const F = { w: 4.2, mat: 'grate', thick: 1.2 }
  B.mark(PB.mark); B.road(30, F); B.cp(PB.flag, { w: 4.2, rest: true }); B.road(10, F); B.cp('試しの出口', { w: 4.2, finish: true }); B.road(8, F)
  B.closeMark(); v76post(B)
  const c = finish16(B, { id: 'lab76', name: 'v76 押す石と門・ローラーの試し', killBelow: 12, spawnBack: 2, climb: true })
  c.v76 = B.v76; return c
}
