// v36 最後の BGM: 旗「大ジャンプの助走」から全開（本物のキー）で走り、build → 踏み切りで climax → 着地 → 門で gate の呼び出しの記録と、踏み切りとのずれ。出し直しで止まるか。無音（mute）で
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = String(6100 + Math.floor(Math.random() * 800))
await import('../server.mjs')
const br = await chromium.launch({ ...MUTE_LAUNCH, channel: 'chromium', args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle'] })
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } }); await muteContext(ctx)
const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:${PORT}/?stay=1`); await page.waitForFunction('window.__skyReady', null, { timeout: 60000 })
await page.evaluate(() => window.sky.startRun('stage1'))
await page.keyboard.down('ArrowUp'); await page.waitForTimeout(300); await page.keyboard.up('ArrowUp') // 音を起こす（本物のキー）
await page.waitForFunction(() => typeof Snd !== 'undefined' && Snd.ctx && ['bgmBuild', 'bgmClimax', 'bgmGate'].every(k => Snd.bufs[Snd.files[k][0]] && Snd.bufs[Snd.files[k][0]] !== 'loading'), null, { timeout: 60000 })
await page.evaluate(() => { const G = window.sky; G.api.spawnAt(G.course.cps.findIndex(q => q.name === '大ジャンプの助走')); G.running = true; G.bgm.log.length = 0
  const mj = G.course.notes.find(n => n.kind === 'megaJump'); window.__lift = null
  const hx = Math.cos(mj.yaw), hz = -Math.sin(mj.yaw); (function watch() { const b = G.bike; if (b && window.__lift == null && !b.g[0] && !b.g[1] && (b.p[0] - mj.lip[0]) * hx + (b.p[2] - mj.lip[2]) * hz > -0.5) window.__lift = G.world.time; requestAnimationFrame(watch) })() })
await page.keyboard.down('ArrowUp')
await page.waitForFunction(() => window.sky.bgm.ph === 'land' || window.sky.bgm.ph === 'gate', null, { timeout: 60000 })
await page.keyboard.up('ArrowUp')
const r1 = await page.evaluate(() => ({ log: window.sky.bgm.log, lift: window.__lift, climaxAt: window.sky.bgm.climaxAt, ph: window.sky.bgm.ph }))
// 出し直し → 止まる
await page.evaluate(() => window.sky.api.retryCp(true)); await page.waitForTimeout(400)
const r2 = await page.evaluate(() => ({ cur: !!window.sky.bgm.cur, ph: window.sky.bgm.ph }))
console.log(JSON.stringify({ r1, climaxMinusLift: r1.climaxAt != null && r1.lift != null ? +(r1.climaxAt - r1.lift).toFixed(3) : null, afterRetry: r2, muted: await page.evaluate(() => window.__muteOk ? window.__muteOk() : 'n/a') }), 'errors', errs.length, errs.slice(0, 3))
await br.close(); process.exit(0)
