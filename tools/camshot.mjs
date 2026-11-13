// 自由なカメラ位置からのスクショ（仕掛けの見た目の確認）。node tools/camshot.mjs '[{"cam":[x,y,z],"tgt":[x,y,z]}]'  OUT=出力の頭
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
process.chdir(new URL('..', import.meta.url).pathname)
const PORT = process.env.PORT = '5379'
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); page.on('pageerror', e => console.log('ERR', e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 40000 })
await page.evaluate(() => window.sky.startRun('stage1')); await page.waitForTimeout(500)
const shots = JSON.parse(process.argv[2])
for (const [k, sh] of shots.entries()) {
  await page.evaluate(([cam, tgt]) => { const G = window.sky, cm = G.api.camera; G.state = 'debug'; cm.position.set(...cam); cm.lookAt(...tgt) }, [sh.cam, sh.tgt])
  await page.waitForTimeout(sh.wait || 900)
  await page.screenshot({ path: `${process.env.OUT || 'shots/cam'}_${k}.png` })
}
await br.close(); process.exit(0)
