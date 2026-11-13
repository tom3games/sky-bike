import './mute-auto.mjs'
// 天空城までバイクで の検査。node verify.mjs（重い検査は同時に2本まで）
import { chromium, webkit } from 'playwright'
import { MUTE_LAUNCH, muteContext } from './mute.mjs'
import { readFileSync, mkdirSync } from 'node:fs'
const ROOT = import.meta.dirname
mkdirSync(ROOT + '/shots', { recursive: true })
process.env.PORT = process.env.VPORT || '5393'
await import('./server.mjs')
const URL0 = `http://localhost:${process.env.PORT}/`
const REC = JSON.parse(readFileSync(ROOT + '/tools/rec_practice.json', 'utf8'))
let pass = 0, fail = 0
const results = []
async function t(name, fn) {
  try { const r = await fn(); if (r === false) throw new Error('false'); pass++; results.push(`ok   ${name}${r && r !== true ? '  ' + JSON.stringify(r) : ''}`) }
  catch (e) { fail++; results.push(`FAIL ${name}  ${String(e.message).split('\n')[0]}`) }
}
const expect = (c, msg) => { if (!c) throw new Error(msg) }
async function open(browser, opts = {}, q = '') {
  const ctx = await browser.newContext({ locale: 'ja-JP', viewport: { width: 1280, height: 720 }, ...opts })
  await muteContext(ctx)
  await ctx.addInitScript(() => { try { localStorage.clear() } catch (e) {} })
  const p = await ctx.newPage(); p.errs = []
  p.on('pageerror', e => p.errs.push('pageerror ' + e.message))
  p.on('console', m => { if (m.type() === 'error') p.errs.push('console ' + m.text()) })
  p.on('requestfailed', r => { const ft = (r.failure() || {}).errorText || ''; if (!/fonts\.(googleapis|gstatic)/.test(r.url()) && !/ERR_ABORTED|cancel/i.test(ft)) p.errs.push('reqfail ' + r.url() + ' ' + ft) }) // 画面を閉じる時に読みかけで打ち切られた物は数えない
  await p.goto(URL0 + q); await p.waitForFunction(() => window.__skyReady, null, { timeout: 30000 })
  return p
}
// 見た目のメッシュと物理の形の高さを比べる（上から光線）
const visCheck = (p, cid, step) => p.evaluate(async ({ cid, step }) => {
  const G = window.sky, A = G.api, T = A.three
  G.state = 'debug'; A.loadCourse(cid); A.buildAll(); await new Promise(r => setTimeout(r, 50))
  const w = G.world, built = A.built
  // 見た目の三角形を XZ の格子に入れる（コースのメッシュと看板の文字）
  const tris = [], CELL = 2, grid = new Map(), bigTris = []
  const addMesh = m => {
    m.updateWorldMatrix(true, false)
    const g = m.geometry, pos = g.attributes.position, idx = g.index, M = m.matrixWorld, v = new T.Vector3()
    const P = []; for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(M); P.push(v.x, v.y, v.z) }
    const n = idx ? idx.count : pos.count
    for (let i = 0; i < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2
      const tr = [P[a * 3], P[a * 3 + 1], P[a * 3 + 2], P[b * 3], P[b * 3 + 1], P[b * 3 + 2], P[c * 3], P[c * 3 + 1], P[c * 3 + 2]]
      const id = tris.push(tr) - 1
      const x0 = Math.floor(Math.min(tr[0], tr[3], tr[6]) / CELL), x1 = Math.floor(Math.max(tr[0], tr[3], tr[6]) / CELL)
      const z0 = Math.floor(Math.min(tr[2], tr[5], tr[8]) / CELL), z1 = Math.floor(Math.max(tr[2], tr[5], tr[8]) / CELL)
      if ((x1 - x0 + 1) * (z1 - z0 + 1) > 2000) { bigTris.push(id); continue }
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) { const k = x * 100000 + z; let L = grid.get(k); if (!L) grid.set(k, L = []); L.push(id) }
    }
  }
  built.group.traverse(o => { if (o.isMesh && o.name !== 'mover' && !o.userData.far) addMesh(o) }) // 遠くの軽い影のメッシュ（LOD）は比べない（近くの本物と入れ替わる）
  built.signs.traverse(o => { if (o.isMesh) addMesh(o) })
  const visDown = (x, z, y0) => {
    const L = (grid.get(Math.floor(x / CELL) * 100000 + Math.floor(z / CELL)) || []).concat(bigTris)
    let best = -Infinity
    for (const id of L) {
      const t = tris[id]
      // 点 (x,z) が三角形の XZ 投影の中か（重心座標）→ その高さ
      const ax = t[0], az = t[2], bx = t[3], bz = t[5], cx = t[6], cz = t[8]
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(d) < 1e-12) continue
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, l3 = 1 - l1 - l2
      if (l1 < -1e-7 || l2 < -1e-7 || l3 < -1e-7) continue
      const y = l1 * t[1] + l2 * t[4] + l3 * t[7]
      if (y <= y0 && y > best) best = y
    }
    return best
  }
  const DR = ['road', 'pad', 'spiral', 'kicker', 'pipe', 'island', 'log', 'gate', 'sign', 'boulder', 'wall', 'web', 'flange', 'post', 'tower']
  let n = 0, ng = 0, worst = 0, onlyVis = 0, onlyPhy = 0, edges = 0, models = 0
  const ex = []
  for (const s of w.shapes) {
    if (!DR.includes(s.tag) || s.mov) continue // 動く物（跳ね橋など）は時刻で形が変わるので比べない
    const nx = Math.ceil((s.max[0] - s.min[0]) / step), nz = Math.ceil((s.max[2] - s.min[2]) / step)
    const k = Math.max(1, Math.ceil(Math.sqrt(nx * nz / 6000)))
    for (let i = 0; i <= nx; i += k) for (let j = 0; j <= nz; j += k) {
      const x = s.min[0] + i * step + 0.013, z = s.min[2] + j * step + 0.017
      // 出発点は、どの形の中にも入っていない高さまで上げる（見た目と物理で同じ点から下ろす）
      let yTop = s.max[1] + 0.5
      for (let g = 0; g < 1400; g++) { let inside = false; for (const id of w.near(x, yTop, z, 0.05)) { const o = A.closest(w.shapes[id], x, yTop, z); if (o.d < 0.01) { inside = true; break } } if (!inside) break; yTop += 0.5 }
      const rr = w.rayDown(x, z, yTop, s.min[1] - 0.5), ph = rr.y
      // 樽・像は模型で見せる（当たりは模型を包む円柱）。高さの比べ方が合わないので数を別に数える
      if (rr.id >= 0 && (['statue', 'barrel'].includes(w.shapes[rr.id].tag) || w.shapes[rr.id].mov)) { models++; continue }
      // 形の縦の縁から 1cm 以内は、円柱の多角形の誤差（6mm 以内）でどちらにも転ぶので数えない
      let edgy = false
      for (const [ox, oz] of [[0.012, 0], [-0.012, 0], [0, 0.012], [0, -0.012]]) { const p2 = w.rayDown(x + ox, z + oz, yTop, s.min[1] - 0.5).y; if (!(Math.abs(p2 - ph) < 0.02) && !(p2 === ph)) { edgy = true; break } }
      if (edgy) { edges++; continue }
      const vi = visDown(x, z, yTop)
      const phOk = ph > s.min[1] - 0.4, viOk = vi > s.min[1] - 0.4
      if (!phOk && !viOk) continue
      n++
      // 同じ高さなのに、形の底の目安（底 - 0.4m）の境目でどちらかだけに転んだ物は数えない（v17）
      if (phOk !== viOk && !(Math.abs(ph - vi) < 0.01)) { ng++; if (phOk) onlyPhy++; else onlyVis++; if (ex.length < 6 || (ex.length < 40 && ng % 300 === 0)) ex.push({ x: +x.toFixed(2), z: +z.toFixed(2), ph, vi, tag: s.tag }); continue }
      const d = Math.abs(ph - vi); worst = Math.max(worst, d)
      if (d > 0.01) { ng++; if (ex.length < 6) ex.push({ x: +x.toFixed(2), z: +z.toFixed(2), ph: +ph.toFixed(3), vi: +vi.toFixed(3), tag: s.tag }) }
    }
  }
  return { n, ng, onlyVis, onlyPhy, edges, models, worst: +worst.toFixed(4), ex }
}, { cid, step })

const shots = []
const ENG = process.env.ENG ? process.env.ENG.split(',') : ['chromium', 'webkit']
for (const [name, eng] of [['chromium', chromium], ['webkit', webkit]].filter(e => ENG.includes(e[0]))) {
  const browser = await eng.launch(name === 'chromium' ? { ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] } : {})
  const p = await open(browser)
  await t(`${name}: 起動時にエラーが出ない`, async () => { expect(p.errs.length === 0, p.errs.join('|')) })
  await t(`${name}: 同じ入力なら node と同じ結果（指紋）`, async () => {
    const h = await p.evaluate(rec => {
      const A = window.sky.api, c = window.sky.course
      A.loadCourse('practice')
      const G = window.sky, w = G.world, q = G.course.cps[0]
      const b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let k = 0; k < 20; k++) A.stepBike(w, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
      for (const i of rec.inp) A.stepBike(w, b, i)
      return A.hashBike(b)
    }, REC)
    expect(h === REC.hash, `page ${h} node ${REC.hash}`); return h
  })
  await t(`${name}: 画面の速さ（30fps と 144fps）で結果が変わらない`, async () => {
    const r = await p.evaluate(rec => {
      const G = window.sky, A = G.api
      const run = fps => {
        G.startRun('practice'); G.hold = true; G.ff = 1
        G.testInput = () => rec.inp[G.steps] || { thr: 0, brk: 0, lean: 0, steer: 0 }
        G.running = true
        let tt = 0; while (G.steps < 600) { A.advance(1 / fps); tt++; if (tt > 100000) break }
        G.testInput = null; G.hold = false
        return A.hashBike(G.bike) + '@' + G.steps
      }
      return [run(30), run(144), run(60)]
    }, REC)
    expect(r[0] === r[1] && r[1] === r[2], r.join(' ')); return r[0]
  })
  if (name === 'chromium') {
    for (const cid of ['practice', 'stage1']) await t(`${name}: 見た目と当たりの高さのずれ（${cid}・25cm 間隔）`, async () => {
      const r = await visCheck(p, cid, 0.25)
      expect(r.ng === 0, JSON.stringify(r)); return { 点: r.n, 縁で除いた点: r.edges, 模型の円柱で除いた点: r.models, 最大のずれm: r.worst }
    })
  }
  // 遊びの通し: タイトル → 第1面 → 走る → 門へ戻る
  const p2 = await open(browser)
  await t(`${name}: タイトルから走り出せる・↑で進む・R で門へ戻る`, async () => {
    await p2.click('.course[data-course="stage1"]'); await p2.waitForTimeout(300)
    expect(await p2.evaluate(() => document.getElementById('tut').classList.contains('on')), 'tutorial first prompt')
    expect(await p2.isVisible('#hud'), 'hud')
    await p2.keyboard.down('ArrowUp'); await p2.waitForTimeout(1500); await p2.keyboard.up('ArrowUp')
    const sp = await p2.evaluate(() => ({ v: window.sky.bike.speed, t: window.sky.time }))
    expect(sp.v > 1 && sp.t > 0.2, JSON.stringify(sp))
    await p2.keyboard.press('KeyR'); await p2.waitForTimeout(200)
    const f = await p2.evaluate(() => window.sky.faults); expect(f === 1, 'faults ' + f)
    await p2.keyboard.press('Escape'); expect(await p2.isVisible('#pause'), 'pause')
    await p2.keyboard.press('Escape'); expect(!(await p2.isVisible('#pause')), 'resume')
    const mute = await p2.evaluate(() => window.__muteOk ? window.__muteOk() : 'none')
    expect(mute === true, 'mute ' + mute)
    return sp
  })
  await t(`${name}: bot が練習場を完走し、結果の券が出る`, async () => {
    const p3 = await open(browser, {}, '?course=practice&bot=good&ff=6')
    await p3.waitForFunction(() => window.sky.state === 'result', null, { timeout: 60000 })
    await p3.waitForTimeout(1200)
    expect(await p3.isVisible('#result'), 'result')
    const r = await p3.evaluate(() => ({ t: window.sky.time, f: window.sky.faults, medal: document.getElementById('rMedal').textContent }))
    await p3.screenshot({ path: `shots/v_${name}_result.png` })
    expect(p3.errs.length === 0, p3.errs.join('|'))
    await p3.context().close()
    return r
  })
  // 画面の大きさ
  for (const [W, H, tag, touch] of [[1280, 720, 'pc', false], [1920, 1080, 'fhd', false], [1366, 768, 'laptop', false], [390, 844, 'phone', true], [844, 390, 'phone-land', true]]) {
    await t(`${name}: ${tag} ${W}x${H} で崩れない（タイトル・走行・遊び方）`, async () => {
      const q = await open(browser, { viewport: { width: W, height: H }, hasTouch: touch, isMobile: touch && name === 'chromium' })
      const chk = () => q.evaluate(() => {
        const W = innerWidth, H = innerHeight, bad = []
        for (const el of document.querySelectorAll('button, .watch, .alt, #keysMini, .tablet, .panel, .logo, #tut')) {
          if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') continue
          const r = el.getBoundingClientRect(); if (!r.width) continue
          if (r.right > W + 1 || r.left < -1 || r.bottom > H + 1 || r.top < -1) bad.push((el.id || el.className) + ':' + [r.left, r.top, r.right, r.bottom].map(Math.round))
        }
        return { sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, W, H, bad: bad.slice(0, 4) }
      })
      const a = await chk(); await q.screenshot({ path: `shots/v_${name}_${tag}_title.png` })
      expect(a.bad.length === 0 && a.sw <= a.W && a.sh <= a.H, 'title ' + JSON.stringify(a))
      await q.click('.course[data-course="stage1"]'); await q.waitForTimeout(800)
      const b = await chk(); await q.screenshot({ path: `shots/v_${name}_${tag}_play.png` })
      expect(b.bad.length === 0, 'play ' + JSON.stringify(b))
      if (touch) {
        expect(await q.isVisible('.tb[data-k="thr"]'), 'touch ui')
        // アクセルは押している間だけ（v11 で本人の指定。スイッチ式ではない）。細かい確かめは tools/touchtest.mjs
        await q.dispatchEvent('.tb[data-k="thr"]', 'pointerdown', { pointerId: 7, isPrimary: true, pointerType: 'touch' }); await q.waitForTimeout(700)
        const on = await q.evaluate(() => ({ on: window.sky.touch.thr, v: window.sky.bike.speed }))
        await q.dispatchEvent('.tb[data-k="thr"]', 'pointerup', { pointerId: 7, isPrimary: true, pointerType: 'touch' }); const off = await q.evaluate(() => window.sky.touch.thr)
        expect(on.on && on.v > 1 && !off, JSON.stringify({ on, off }))
        // ボタン同士が重ならない
        const ov = await q.evaluate(() => { const r = [...document.querySelectorAll('.tb')].map(b => b.getBoundingClientRect()); let n = 0; for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (!(r[i].right <= r[j].left || r[j].right <= r[i].left || r[i].bottom <= r[j].top || r[j].bottom <= r[i].top)) n++; return n })
        expect(ov === 0, 'overlap ' + ov)
      }
      await q.evaluate(() => document.getElementById('bMenu').click()); await q.waitForTimeout(100)
      await q.evaluate(() => document.getElementById('pHow').click()); await q.waitForTimeout(200)
      const c = await chk(); await q.screenshot({ path: `shots/v_${name}_${tag}_how.png` })
      expect(c.bad.length === 0, 'how ' + JSON.stringify(c))
      expect(q.errs.length === 0, q.errs.join('|'))
      await q.context().close()
    })
  }
  await browser.close()
}
console.log(results.join('\n'))
console.log(`\n${pass} ok / ${fail} fail`)
process.exit(fail ? 1 : 0)
