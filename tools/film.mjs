// 通しのプレイを区間ごとに撮る: 上手い bot で各区間の最初の休憩所から 60 秒走らせ、2 秒ごとに 1 枚。
// 区間ごとに 6x5 の一覧画像（shots/film/<tag>_<区間>.png）を作る。 node tools/film.mjs <tag> [区間名,...]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
process.chdir(new URL('..', import.meta.url).pathname)
const TAG = process.argv[2] || 'now', ONLY = process.argv[3] ? process.argv[3].split(',') : null
const PORT = process.env.PORT = process.env.PORT || '6211'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 640, height: 360 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1&bot=good`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() })
const zones = await page.evaluate(corr => {
  const c = window.sky.course, seen = {}, out = []
  if (corr) {
    // 回廊（名前に「回廊」の付く区間）の手前の休憩所から撮る
    const ci = c.cps.map((q, i) => ({ q, i, pi: c.path.reduce((bi, z, k) => z.p && Math.hypot(z.p[0] - q.p[0], z.p[2] - q.p[2]) + Math.abs(z.p[1] - q.p[1]) * 2 < (bi.d) ? { k, d: Math.hypot(z.p[0] - q.p[0], z.p[2] - q.p[2]) + Math.abs(z.p[1] - q.p[1]) * 2 } : bi, { k: 0, d: 1e9 }).k }))
    for (const m of c.marks.filter(m => /回廊/.test(m.name))) { const before = ci.filter(o => o.q.rest && o.pi <= m.i0 + 2).pop(); if (before && !seen[m.name]) { seen[m.name] = 1; out.push([c.path[m.i0].zone + '_corr', before.i]) } }
    return out
  }
  c.cps.forEach((q, i) => { if (q.rest && !seen[q.zone]) { seen[q.zone] = 1; out.push([q.zone, i]) } }); return out
}, !!process.env.CORR)
const dir = (process.env.OUTDIR || 'shots/film') + '/' + TAG; mkdirSync(dir, { recursive: true })
for (const [zone, cpi] of zones) {
  if (ONLY && !ONLY.includes(zone)) continue
  await page.evaluate(cpi => { const G = window.sky; G.R.cp = cpi; G.R.rest = cpi; G.api.spawnAt(cpi); G.running = true }, cpi)
  for (let k = 0; k < 30; k++) { await page.waitForTimeout(2000); await page.screenshot({ path: `${dir}/${zone}_${String(k).padStart(2, '0')}.png` }) }
  execSync(`ffmpeg -loglevel error -y -framerate 1 -i ${dir}/${zone}_%02d.png -vf "scale=320:180,tile=6x5" -frames:v 1 shots/film/${TAG}_${zone}.png`)
  console.log(zone, 'done')
}
console.log('errors', errs.length, errs.slice(0, 3))
await br.close(); process.exit(0)
