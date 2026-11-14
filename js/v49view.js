// SKY BIKE v50 後輪で乗る台のランプ: 台の上の両脇に細い光る帯と、にじむ光（光源は足さない）。待っている間は赤、後輪が乗って動き出したら緑（向こうで止まっている間も緑）
import * as THREE from 'three'
import { SENSE } from './v49.js?v=50'
const RED = new THREE.Color(0xff3a22), GREEN = new THREE.Color(0x3cff6e)
export function buildSenseLamps(course, scene) {
  const group = new THREE.Group(); group.name = 'v49lamps'; scene.add(group)
  const pads = course.shapes.filter(s => s.mov && s.mov.type === 'sense')
  if (!pads.length) return { group, update() {} }
  const glowTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'), gr = g.createRadialGradient(32, 32, 1, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv) })()
  const stripGeo = new THREE.BoxGeometry(SENSE.L - 0.08, 0.025, 0.035), glowGeo = new THREE.PlaneGeometry(1.1, 1.1)
  const L = pads.map(s => {
    const strip = new THREE.MeshBasicMaterial({ color: RED.clone() }), glowM = new THREE.MeshBasicMaterial({ map: glowTex, color: RED.clone(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 })
    const g = new THREE.Group(); group.add(g)
    for (const sg of [-1, 1]) { const m = new THREE.Mesh(stripGeo, strip); m.position.set(0, SENSE.TH / 2 + 0.012, sg * (SENSE.W / 2 - 0.02)); g.add(m) }
    const glow = new THREE.Mesh(glowGeo, glowM); group.add(glow)
    return { s, g, strip, glowM, glow, on: null }
  })
  const q = new THREE.Quaternion()
  return {
    group,
    update(cam) {
      for (const o of L) {
        const s = o.s, on = s.mov.st === 'go' || s.mov.st === 'end'
        o.g.position.set(s.c[0], s.c[1], s.c[2]); o.g.rotation.set(0, s.base.yaw, 0)
        o.glow.position.set(s.c[0], s.c[1] + SENSE.TH / 2 + 0.12, s.c[2]); if (cam) o.glow.quaternion.copy(cam.quaternion)
        if (on !== o.on) { o.on = on; const c = on ? GREEN : RED; o.strip.color.copy(c); o.glowM.color.copy(c) }
      }
    }
  }
}
