// SKY BIKE v48 下山の終わりの小屋の見た目: 窓の暖かい灯り（光は足さない。光る板と、にじむ板）・扉・横に錆びた古いトライアルバイク（草原の倒れたバイクと同じ型）
import * as THREE from 'three'
import { rustyBike } from './v37view.js?v=49'

export function buildEpi(course, scene, M) {
  const group = new THREE.Group(); group.name = 'v48'; scene.add(group)
  const E = course.epi; if (!E || !E.cabin) return { group }
  const C = E.cabin, yaw = C.yaw
  const f = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)), r = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))
  const face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), f.clone().negate()) // 板の表を手前（来る側）へ
  // 窓: 格子の入った暖かい光の板（壁の面の少し手前）と、まわりににじむ光
  const win = new THREE.Group(); win.position.set(...C.win); win.quaternion.copy(face); group.add(win)
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.75), new THREE.MeshBasicMaterial({ color: 0xffc070 })); win.add(glass)
  const frameM = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.9 })
  for (const [w, h, x, y] of [[1.0, 0.07, 0, 0.41], [1.0, 0.07, 0, -0.41], [0.07, 0.86, 0.48, 0], [0.07, 0.86, -0.48, 0], [0.05, 0.75, 0, 0], [0.9, 0.05, 0, 0]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), frameM); b.position.set(x, y, 0.03); win.add(b) }
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(255,190,110,0.85)'); gr.addColorStop(0.35, 'rgba(255,160,80,0.28)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv) })()
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); glow.position.z = 0.08; win.add(glow)
  // 扉（閉まっている。隙間から少し光）
  const door = new THREE.Group(); door.position.set(...C.door); door.quaternion.copy(face); group.add(door)
  const dm = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.9, 0.08), new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 })); dm.position.set(0, 0, 0.04); door.add(dm)
  const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 1.8), new THREE.MeshBasicMaterial({ color: 0xffb060 })); crack.position.set(0.49, 0, 0.09); door.add(crack)
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshStandardMaterial({ color: 0x8a7040, metalness: 0.6, roughness: 0.5 })); knob.position.set(-0.35, 0, 0.12); door.add(knob)
  // 錆びたバイク（小屋の横に立てかけてある。字幕なし）
  const bk = rustyBike(M); bk.position.set(...C.bike); bk.rotation.y = yaw; bk.rotateX(-0.14); group.add(bk)
  return { group }
}
