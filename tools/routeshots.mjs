// 道に沿った見た目の確認: 区間ごとにバイクを置いてゲームのカメラで撮る＋次の塔の方・来た道の方を見る絵＋タイトル。
//   node tools/routeshots.mjs <出力フォルダ>   SPOTS=crypt:0.3,ruin:0.5 で絞る。コンソールのエラーも数える
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = process.env.PORT || '6417'
await import('../server.mjs')
const out = process.argv[2] || 'shots/route'
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.waitForTimeout(2500)
await page.screenshot({ path: `${out}/title.png` })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() }); await page.waitForTimeout(800)
const spots = (process.env.SPOTS || 'ground:0.2,ground:0.85,crypt:0.3,crypt:0.8,ruin:0.15,ruin:0.6,storm:0.3,storm:0.75,factory:0.3,factory:0.8,bell:0.4,bell:0.9,ice:0.5,roof:0.6,sky:0.5,castle:0.5').split(',')
for (const sp of spots) {
  const [z, f] = sp.split(':')
  const info = await page.evaluate(([z, f]) => {
    const G = window.sky, A = G.api, c = G.course
    const idx = c.path.map((q, i) => q.p && q.zone === z && !q.branch ? i : -1).filter(i => i >= 0); if (!idx.length) return null
    const i = idx[Math.floor((idx.length - 1) * +f)], q = c.path[i]
    A.placeBike(A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw })); G.state = 'play'; G.running = false
    return { i, p: q.p }
  }, [z, f])
  if (!info) continue
  await page.waitForTimeout(1600)
  const tag = `${z}_${f}`
  await page.screenshot({ path: `${out}/${tag}.png` })
  // 先（次の塔）と後ろ（来た道）を、バイクの少し上から見る
  if (process.env.LOOK !== '0') for (const dir of ['ahead', 'back']) {
    await page.evaluate(([i, dir]) => {
      const G = window.sky, c = G.course, P = c.path, q = P[i]
      let tgt
      if (dir === 'ahead') { const T = (c.towers || []).find(T => T.y0 > q.p[1] + 5) || c.tower; tgt = [T.cx, (T.top2 ?? T.top) - 10, T.cz] }
      else { const j = Math.max(0, i - 900); tgt = P[j].p }
      const cm = G.api.camera, d = [tgt[0] - q.p[0], 0, tgt[2] - q.p[2]], L = Math.hypot(d[0], d[2]) || 1
      G.state = 'debug'; cm.position.set(q.p[0] - d[0] / L * 6, q.p[1] + 4, q.p[2] - d[2] / L * 6); cm.fov = 56; cm.updateProjectionMatrix(); cm.lookAt(tgt[0], Math.min(tgt[1], q.p[1] + 30), tgt[2])
    }, [info.i, dir])
    await page.waitForTimeout(700)
    await page.screenshot({ path: `${out}/${tag}_${dir}.png` })
    await page.evaluate(() => { window.sky.state = 'play' })
  }
}
const info = await page.evaluate(() => { const i = window.sky.api.renderer.info.render; return { calls: i.calls, tri: i.triangles } })
console.log('errors', errs.length, [...new Set(errs)].slice(0, 10).join('\n'), JSON.stringify(info))
await br.close(); process.exit(0)
