// SKY BIKE v65 狭い足場へ跳ぶ（本人の注文）: 旗 → 助走 → ちょうどいい速さのジャンプ → 幅 2m の狭い足場に着地してブレーキ → 足場の先で直角に曲がって、また走り出す
//   遅いと切れ目に落ち、速すぎると足場を跳び越すか、曲がりで止まりきれず外へ（縁石の曲がり: 自動の減速なし。少し速いと横滑り、かなり速いと投げ出される）
const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
const DEG = Math.PI / 180
export const LP = { gap: +(globalThis.__lpGap ?? 5.5), dy: +(globalThis.__lpDy ?? -1.0), lip: 10, pad: +(globalThis.__lpPad ?? 10), w: 2.0, R: 4.5, vJump: 10 }
export function landPad(B) {
  const D = { w: 4.2, mat: 'castle', thick: 1.2 }, L = { w: 3.2, mat: 'castle', thick: 1.0, back: 0 }
  B.zone = 'castle'
  B.road(3, D)
  B.cp('狭い足場の前', { w: 4.2, rest: true })
  B.mark('狭い足場へ跳ぶ')
  B.sign('着地したら すぐブレーキ', { at: 3 })
  B.road(16, { ...L, back: 0.6 })
  // 踏み切りの小さな台（10 度）
  const sl = LP.lip * DEG; B.road(2.4 / Math.cos(sl), { ...L, slope: sl, mat: 'plank', thick: 0.5 })
  B.path[B.path.length - 1].kind = 'lip'; B.path[B.path.length - 1].vNeed = LP.vJump
  B.gap(LP.gap, LP.dy, 'jump'); B.path[B.path.length - 1].vJump = LP.vJump
  // 狭い足場（板）と、その先の直角の曲がり（同じ幅）。縁石の曲がり（自動の減速なし）
  const i0 = B.path.length
  B.road(LP.pad, { w: LP.w, mat: 'plank', thick: 0.45, back: 0, kind: 'landing' })
  const fI = B.path.length
  B.curve(LP.R, -90 * DEG, { w: LP.w, mat: 'plank', thick: 0.45 })
  const i1 = B.path.length - 1
  for (let k = i0; k <= i1; k++) B.path[k].narrowPad = true
  for (let k = fI; k <= i1; k++) B.path[k].curb = 1
  B.decor = B.decor || []; B.decor.push({ kind: "curb", i0: fI, i1, type: 1 })
  // 足場を支える柱
  for (let k = i0; k <= i1; k += 6) { const q = B.path[k]; B.cyl({ a: [q.p[0], q.p[1] - 26, q.p[2]], b: [q.p[0], q.p[1] - 0.45, q.p[2]], r: 0.22, mat: 'girder', tag: 'post' }) }
  B.road(10, { ...L, back: 0 })
  B.road(4, D)
  B.closeMark()
}
