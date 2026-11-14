// SKY BIKE v41 落石の坂（finale の綱渡りの後、天空城への大ジャンプの前）
// 旗 → 崩れた門 → まっすぐな登り坂（坂の上に大きな丸い岩が止まっている）。坂を半分ほど登ると地鳴り・小石・坂の上の土煙（2 秒）→ 坂の上から大きな丸い岩が転がってくる。
// ブレーキを押し続けてバックで坂を下がり、門まで逃げる（岩は門の柱に挟まって割れる）。岩は坂を下がるバックの速さ（7〜8m/s）より少しだけ遅い 6.5m/s。
// 割れたらもう一度登って先へ。同じ走りで 1 回（追いつかれて旗から出し直すと、岩はまた来る）。高さは上って下りて元へ戻す（先の道の高さを変えない）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
export const ROCK = { lat: -8.5, laneW: 9.4, R: 2.1, vMax: 6.5, acc: 3.5, warn: 2.0, gateHalf: 1.95, slopeLen: 34, slopeDeg: 9, trigFrac: 0.45, catchD: 0.6 }

export function v41(B) {
  const D = { w: 4.2, mat: 'cobble', thick: 1.2 }
  // 先の大ジャンプの着地が前の区間（鐘楼の道）の真上に重ならないように、横へ曲がってから坂へ入り、最後に元の向きへ戻す
  const TURN = (globalThis.__v41turn ?? 90) * DEG
  if (TURN) B.curve(7, TURN, { ...D, pw: 4.2 })
  B.road(6, D)
  B.cp('落石の坂の下', { w: 4.2, rest: true })
  B.road(5, D)
  // 崩れた門（左右の柱。道の外。岩は柱の間を通れない）
  const gateP = B.t.p.slice(), yaw = B.t.yaw, f = B.dir(yaw), R = B.right(yaw), gateI = B.path.length
  for (const sg of [-1, 1]) {
    const c = add3(gateP, R, sg * (ROCK.gateHalf + 0.55))
    B.box({ c: [c[0], c[1] + 2.4, c[2]], h: [0.55, 2.4 + 0.6, 0.55], yaw, mat: 'ruinwall', tag: 'pillar' })
  }
  { const c = add3(gateP, R, 1.5); B.box({ c: [c[0], c[1] + 5.2, c[2]], h: [0.6, 0.35, 1.6], yaw, mat: 'ruinwall', tag: 'pillar' }) } // 片側だけ残ったまぐさ石（道の上 4.8m）
  // v41b 岩の通り道（道の左に広げた石畳。カメラは道の右後ろにいるので、岩は左寄りを転がると画面の真ん中に来る）。門の左は壁で、岩はここで割れる
  const laneC = -(D.w / 2 + ROCK.laneW / 2), lane = (p0, len, sl) => { const fr = B.dir(yaw, sl), up = B.upv(yaw, sl); B.box({ c: add3(add3(add3(p0, fr, len / 2), up, -0.6), R, laneC), h: [len / 2, 0.6, ROCK.laneW / 2], yaw, pitch: sl, mat: 'cobble', mu: 1.0, tag: 'road' }) }
  { const c = add3(gateP, R, laneC - 0.4); B.box({ c: [c[0], c[1] + 1.8, c[2]], h: [0.6, 2.4, ROCK.laneW / 2], yaw, mat: 'ruinwall', tag: 'pillar' }) }
  lane(add3(gateP, f, 0.6), 5.4, 0)
  B.road(6, D)
  B.mark('落石の坂')
  const slopeI0 = B.path.length, slopeP0 = B.t.p.slice()
  lane(slopeP0, ROCK.slopeLen, ROCK.slopeDeg * DEG)
  B.road(ROCK.slopeLen, { ...D, slope: ROCK.slopeDeg * DEG, kind: 'road' })
  const slopeI1 = B.path.length
  lane(B.t.p.slice(), 10, 0)
  B.road(10, D)
  const topI = B.path.length, topP = B.t.p.slice()
  // 坂の向こうは下り（高さを元へ戻す）
  B.road(ROCK.slopeLen, { ...D, slope: -ROCK.slopeDeg * DEG, back: 0 })
  B.road(4, D)
  if (TURN) B.curve(7, -TURN, { ...D, pw: 4.2 })
  B.closeMark()
  B.boulder = { gateI, slopeI0, slopeI1, topI, gateP, topP, slopeP0, yaw, f }
}
