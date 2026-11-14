// SKY BIKE v41 落石の坂の見た目: 坂の上に止まっている大きな丸い岩（ごつごつ）。転がる間は道のりに合わせて回る。割れたら消える（破片と土煙は game.js）
import * as THREE from 'three'
import { pathS } from './run.js?v=44'
import { ROCK } from './v41.js?v=44'

export function buildBoulder(course, group, M) {
  const B = course.boulder; if (!B) return null
  const S = pathS(course), P = course.path
  const posAt = s => { let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] < s) lo = m; else hi = m } const a = P[lo], b = P[hi] && P[hi].p ? P[hi] : a, u = S[hi] > S[lo] ? (s - S[lo]) / (S[hi] - S[lo]) : 0; return { p: [a.p[0] + (b.p[0] - a.p[0]) * u, a.p[1] + (b.p[1] - a.p[1]) * u, a.p[2] + (b.p[2] - a.p[2]) * u], yaw: a.yaw } }
  // ごつごつした丸い岩（頂点をずらした球）
  const g = new THREE.IcosahedronGeometry(ROCK.R, 3), p = g.attributes.position, v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 2.1 + 1.3) * Math.sin(v.y * 1.7 + 0.4) * Math.sin(v.z * 2.3 + 2.1); v.multiplyScalar(1 + 0.09 * n + 0.04 * Math.sin(v.x * 6 + v.z * 5)); p.setXYZ(i, v.x, v.y, v.z) }
  g.computeVertexNormals()
  const mesh = new THREE.Mesh(g, M.boulder || M.rockdark || M.rock); mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'boulder'
  group.add(mesh)
  const s0 = S[B.topI] + 1.5, R = [Math.sin(B.yaw), 0, Math.cos(B.yaw)], axis = new THREE.Vector3(R[0], 0, R[2]).normalize()
  const q0 = new THREE.Quaternion(), qr = new THREE.Quaternion()
  let lastS = s0, ang = 0
  return {
    mesh, gateP: B.gateP, topP: B.topP, f: B.f,
    sOf: st => (st && st.s != null ? st.s : s0),
    update(st) {
      const broken = st && st.ph === 'broken'
      mesh.visible = !broken
      if (broken) return
      const s = st && (st.ph === 'roll' || st.ph === 'hit') ? st.s : s0
      // v44 本人: 坂の上の道の真ん中から、まっすぐ転がり下りる（v41b の左の通り道はやめた）
      const q = posAt(s), lat = globalThis.__rockLat ?? 0
      mesh.position.set(q.p[0] + R[0] * lat, q.p[1] + ROCK.R * 0.92, q.p[2] + R[2] * lat)
      ang += (lastS - s) / ROCK.R; lastS = s // 下る向きに前転（軸は道の右向き。上×進む向き）
      if (s === s0) { ang = 0 }
      qr.setFromAxisAngle(axis, ang); mesh.quaternion.copy(q0).multiply(qr)
    },
    posAt,
  }
}
