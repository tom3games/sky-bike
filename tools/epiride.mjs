// v51 下山を最初の旗から上手い bot で通しで走り、結果の画面まで（ゲームの中で）。node tools/epiride.mjs（無音）ENGINE=webkit
import '../mute-auto.mjs'
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.VPORT || String(6100 + Math.floor(Math.random() * 800))
await import('../server.mjs')
const ENG = process.env.ENGINE || 'chromium'
const br = ENG === 'webkit' ? await webkit.launch(MUTE_LAUNCH) : await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 960, height: 540 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
await page.goto(`http://localhost:${PORT}/?stay=1&bot=good`); await page.waitForFunction('window.__skyReady', null, { timeout: 90000 })
await page.evaluate(() => { const G = window.sky; G.startRun('stage1'); G.api.buildAll(); G.state = 'result'; G.resDone = 0; G.respawns = 0; G.api.startEpi(() => { G.resDone = 1; document.getElementById('result') && (G.resShown = !document.getElementById('result').hidden) }) })
// 物理を速く進める（1 コマに 8 刻み）
const t0 = Date.now()
const r = await page.evaluate(async () => { const G = window.sky; let n = 0; while (!G.resDone && n < 60 * 400) { if (G.state === 'play') { for (let k = 0; k < 8 && !G.resDone; k++) { G.api.fixedStep(); n++ } } await new Promise(r => requestAnimationFrame(r)) } return { steps: n, sec: +(n / 60).toFixed(1), done: G.resDone, state: G.state, offs: G.wheelOffs, faults: G.faults, time: G.time } })
await new Promise(r => setTimeout(r, 1500))
const vis = await page.evaluate(() => ({ result: !document.getElementById('result')?.hidden, cls: document.getElementById('result')?.className }))
console.log(ENG, JSON.stringify(r), JSON.stringify(vis), 'wall', ((Date.now() - t0) / 1000).toFixed(0) + 's')
console.log('errors', errs.length, errs.slice(0, 6))
await br.close(); process.exit(0)
