import './mute-auto.mjs'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
// 公開URLの確認。node live.mjs（ログインしていないブラウザで見る）。SKIPGH=1 で GitHub ページの確認を省く
// sky-bike sky を置き換え、「遊びの通し」をゲームに合わせて書く
import { chromium, webkit } from 'playwright'
import { execSync } from 'node:child_process'
// 個人のアカウント名は公開リポジトリに書かない。実行時に gh から取る（2026-11-02 live.mjs に名前が文字で入ったまま5本公開していた）
const OWNER = (() => { try { return execSync('gh api user -q .login', { encoding: 'utf8' }).trim().toLowerCase() } catch { return '' } })()
const URL0 = 'https://tom3games.github.io/sky-bike/'
const out = []
for (const [name, bt, opts] of [['chromium', chromium, {}], ['webkit', webkit, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const b = await bt.launch(bt === chromium ? MUTE_LAUNCH : {}), ctx = await b.newContext({ locale: 'ja-JP', viewport: { width: 390, height: 844 }, ...opts })
  await muteContext(ctx)
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()) })
  p.on('requestfailed', r => errs.push('fail ' + r.url()))
  await p.goto(URL0 + '?stay=1&t=' + Date.now(), { waitUntil: 'load' })
  await p.waitForFunction(() => window.__skyReady, null, { timeout: 45000 })
  // 遊びの通し: 第1面を始めて進む（PC は ↑、スマホはアクセルのボタン）
  await p.click('.course[data-course="stage1"]'); await p.waitForTimeout(400)
  // アクセルは押している間だけ（スマホも）。離す前に速さを読む
  const ev = { pointerId: 9, isPrimary: true, pointerType: 'touch' }
  if (opts.hasTouch) { await p.dispatchEvent('.tb[data-k="thr"]', 'pointerdown', ev); await p.waitForTimeout(1500) }
  else { await p.keyboard.down('ArrowUp'); await p.waitForTimeout(1500) }
  const st = await p.evaluate(() => ({ v: +window.sky.bike.speed.toFixed(1), t: +window.sky.time.toFixed(1), mute: window.__muteOk ? window.__muteOk() : 'n/a' }))
  if (opts.hasTouch) await p.dispatchEvent('.tb[data-k="thr"]', 'pointerup', ev); else await p.keyboard.up('ArrowUp')
  out.push(`${name}: play ${JSON.stringify(st)}`)
  await p.screenshot({ path: `shots/live-${name}.png` })
  const og = await p.evaluate(async () => { const r = await fetch('og.png?v=1'); return r.status + ' ' + r.headers.get('content-type') })
  out.push(`${name}: og=${og} errors=${errs.length ? errs.join(' | ') : 'none'}`)
  await b.close()
}
if (process.env.SKIPGH) { console.log(out.join('\n')); process.exit(0) }
// ログアウト状態でリポジトリ・更新履歴に個人のIDが出ていないか
const b = await chromium.launch(MUTE_LAUNCH), p = await b.newPage()
for (const u of ['https://github.com/tom3games/sky-bike', 'https://github.com/tom3games/sky-bike/commits/main']) {
  const res = await p.goto(u, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  out.push(`${u} status=${res.status()} owner=${OWNER && (await p.content()).toLowerCase().includes(OWNER) ? 'FOUND' : 'none'}`)
}
await b.close()
console.log(out.join('\n'))
