// 手ざわりの 5 場面（加速・急ブレーキ・コーナー・大ジャンプ・着地）を連番で撮って GIF にする（shots/feel_<場面>.gif）。
// あわせて、長く落ちた時の叫び声が 1 回だけ鳴るか（Snd.played と __soundCalls）を数える
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
process.chdir('/Users/tomoki/Desktop/claudecode/sky-bike')
const PORT = process.env.PORT = process.env.PORT || String(20000 + Math.floor(Math.random() * 20000))
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 640, height: 360 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.mouse.click(5, 5) // 音を有効にする（テストは無音）
await page.evaluate(() => { window.sky.startRun('stage1'); window.sky.api.buildAll() }); await page.waitForTimeout(500)
const dir = '/private/tmp/claude-501/-Users-tomoki-Desktop-tmk-hub/869cecbe-b380-424b-abbe-4c03ee5b4373/scratchpad/feel'; mkdirSync(dir, { recursive: true })
async function clip(name, setup, sec = 3) {
  await page.evaluate(setup)
  for (let k = 0; k < sec * 8; k++) { await page.waitForTimeout(125); await page.screenshot({ path: `${dir}/${name}_${String(k).padStart(3, '0')}.png` }) }
  execSync(`ffmpeg -loglevel error -y -framerate 8 -i ${dir}/${name}_%03d.png -vf "scale=480:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" shots/feel_${name}.gif`)
}
const place = (i, v) => `(() => { const G = window.sky, A = G.api, q = G.course.path[${i}]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); b.v = [Math.cos(q.yaw) * ${v}, 0, -Math.sin(q.yaw) * ${v}]; A.placeBike(b); G.running = true; G.state = 'play' })()`
await clip('accel', `(() => { window.sky.startRun('stage1'); const G = window.sky; let n = 0; G.testInput = () => ({ thr: 1, brk: 0, lean: 0, steer: 0, nitro: (n++ > 90) ? 1 : 0 }) })()`, 3)
await clip('brake', `(() => { window.sky.startRun('stage1'); const G = window.sky; let n = 0; G.testInput = () => (n++ < 105 ? { thr: 1, brk: 0, lean: 0, steer: 0 } : { thr: 0, brk: 1, lean: 0, steer: 0 }) })()`, 3.5)
// コーナーと大ジャンプ・着地は上手い bot に走らせる
await page.evaluate(() => { const G = window.sky; G.testInput = null })
const botOn = () => `(async () => { const G = window.sky; const m = await import('./js/bot.js?v=14'); G.bot = m.createBot(G.course, { skill: 'good' }); G.bot.world = G.world; m.resetBot(G.bot, G.bike); G.testInput = () => m.botInput(G.bot, G.bike) })()`
await clip('run', `(async () => { const G = window.sky; G.startRun('stage1'); G.api.buildAll(); await ${botOn()}; G.running = true })()`, 11)
const gi = await page.evaluate(() => { const P = window.sky.course.path; const k = P.findIndex(q => q.kind === 'orbit' && q.zone === 'crypt'); return k + 40 })
await clip('corner', `(async () => { ${place(0, 0)}; const G = window.sky, A = G.api, q = G.course.path[${gi}]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); b.v = [Math.cos(q.yaw) * 9, 0, -Math.sin(q.yaw) * 9]; A.placeBike(b); await ${botOn()} })()`, 3)
// 長く落ちる: 高い周の道の外側へ押し出す
const before = await page.evaluate(() => ({ s: typeof Snd !== 'undefined' ? (Snd.played.scream || 0) : -1, c: window.__soundCalls }))
const hi = await page.evaluate(() => window.sky.course.path.findIndex((q, i) => q.kind === 'orbit' && q.zone === 'factory'))
await page.evaluate(i => { const G = window.sky, A = G.api, q = G.course.path[i]; const b = A.createBike({ p: [q.p[0], q.p[1] + 0.8, q.p[2]], yaw: q.yaw }); const R = [Math.sin(q.yaw), 0, Math.cos(q.yaw)]; const t = G.course.tower; const out = [q.p[0] - t.cx, 0, q.p[2] - t.cz], L = Math.hypot(out[0], out[2]); b.v = [out[0] / L * 7, 2, out[2] / L * 7]; A.placeBike(b); G.running = true; G.testInput = () => ({ thr: 0, brk: 0, lean: 0, steer: 0 }) }, hi)
await page.waitForTimeout(4500)
const after = await page.evaluate(() => ({ s: typeof Snd !== 'undefined' ? (Snd.played.scream || 0) : -1, g: typeof Snd !== 'undefined' ? (Snd.played.grunt || 0) : -1, c: window.__soundCalls, screams: window.sky.screams || 0, muted: window.__muteOk && window.__muteOk() }))
console.log('落下の叫び', JSON.stringify({ before, after }))
console.log('errors', errs.length, errs.slice(0, 3))
await br.close(); process.exit(0)
