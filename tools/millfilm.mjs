// 風車の手前から羽根に乗るまでのコマ撮り（羽根が画面に写っているかを見る）。node tools/millfilm.mjs <出力フォルダ> [幅x高さ]（無音）
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || String(6400 + Math.floor(Math.random() * 250))
await import('../server.mjs')
const OUT = (process.argv[2] || 'shots/mill').replace(/\/$/, '') + '/', [W, H] = (process.argv[3] || '1280x720').split('x').map(Number)
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: W, height: H }, locale: 'ja-JP', hasTouch: H > W, isMobile: H > W }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1${process.env.SRC ? '&src=1' : ''}`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll(); window.sky.story.t0 = null }); await page.waitForTimeout(800)
const mill = await page.evaluate(() => window.sky.course.path.findIndex(q => q.kind === 'blade'))
const back = +(process.env.BACK || 26)
await page.evaluate(([i, back]) => { const G = window.sky, A = G.api, P = G.course.path; let k = i, d = 0; while (k > 0 && d < back) { d += Math.hypot(P[k].p[0] - P[k - 1].p[0], P[k].p[2] - P[k - 1].p[2]); k-- } const q = P[k]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); A.placeBike(b); G.state = 'play'; G.running = true }, [mill, back])
await page.waitForTimeout(600)
/* 羽根が画面に写っているか: 4 枚の羽根の箱の 8 隅のうち画面の中に入る点の数（カメラより前） */
const seen = () => page.evaluate(() => { const G = window.sky, A = G.api, T = A.three, cam = A.camera, n = G.course.notes.find(n => n.kind === 'windmill'), I = G.v37.isl; let inS = 0, hid = 0; const v = new T.Vector3(), w = new T.Vector3(), per = []
  const solid = p => { const dx = p.x - I.ctr[0], dz = p.z - I.ctr[2], al = dx * I.f[0] + dz * I.f[2] + I.ctrAl, la = dx * I.r[0] + dz * I.r[2]; if (p.y < I.y0 || p.y > I.y1 || al < I.a0 || al > I.a1 || Math.abs(la) > I.W / 2) return false; if (I.pit && al > I.pit[0] && al < I.pit[1]) return false; if (I.slot && al > I.slot.s0 && al < I.slot.s1 && la > I.slot.l0 && la < I.slot.l1) return false; return true }
  for (const s of n.blades) { const sh = G.world.shapes[s.id], X = sh.ax[0]; let c = 0; for (let k = 0; k <= 8; k++) { const u = (k / 8 * 2 - 1) * sh.h[0]; w.set(sh.c[0] + X[0] * u, sh.c[1] + X[1] * u + 0.2, sh.c[2] + X[2] * u); v.copy(w).project(cam); if (!(v.z < 1 && Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98)) continue; let occ = false; for (let j = 1; j < 60 && !occ; j++) { v.copy(cam.position).lerp(w, j / 60); if (solid(v)) occ = true } if (occ) hid++; else { inS++; c++ } } per.push(c) }
  return { inS, hid, per, i: G.steer.i, kind: G.course.path[G.steer.i].kind, sp: +G.bike.speed.toFixed(1) } })
console.log(JSON.stringify(await seen()))
let f = 0; const log = []
await page.keyboard.down('ArrowUp')
for (let k = 0; k < +(process.env.N || 30); k++) {
  await page.waitForTimeout(350)
  const s = await seen(); if (s.i >= mill - 2 && !process.env.GO) await page.keyboard.up('ArrowUp'); else if (s.sp < 3) await page.keyboard.down('ArrowUp'); else await page.keyboard.up('ArrowUp')
  await page.screenshot({ path: OUT + String(f++).padStart(2, '0') + '.jpg', type: 'jpeg', quality: 70 }); log.push([f - 1, s.i - mill, s.kind, s.sp, s.inS, '隠れ' + s.hid, s.per.join('/')].join(' '))
}
console.log(log.join('\n')); console.log('errors', errs.length, errs.slice(0, 5), 'mute', await page.evaluate(() => window.__muteOk && window.__muteOk()))
await br.close(); process.exit(0)
