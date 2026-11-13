// 道の明るさの検査: 第1面を一定の間隔で撮り、道の上の面に当たる画素だけの明るさの平均と散らばり（標準偏差）を数える。
// 黒い帯（平均が暗すぎる、または模様が見えない）の区間を見つける。node tools/roadlum.mjs [撮る数]
import '../mute-auto.mjs'
import { chromium } from 'playwright'
import { MUTE_LAUNCH, muteContext } from '../mute.mjs'
const PORT = process.env.PORT = process.env.PORT || '5385'
await import('../server.mjs')
const N = +(process.argv[2] || 24)
const br = await chromium.launch({ ...MUTE_LAUNCH, args: [...(MUTE_LAUNCH.args || []), '--use-gl=angle', '--ignore-gpu-blocklist'] })
const ctx = await br.newContext({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1, locale: 'ja-JP' }); await muteContext(ctx)
const page = await ctx.newPage()
await page.goto(`http://localhost:${PORT}/?stay=1`)
await page.waitForFunction('window.__skyReady', null, { timeout: 40000 }); await page.waitForTimeout(3000)
await page.evaluate(() => window.sky.startRun('stage1'))
const rows = []
for (let k = 0; k < N; k++) {
  const f = (k + 0.5) / N
  await page.evaluate(f => {
    const G = window.sky, A = G.api, path = G.course.path
    let i = Math.floor(path.length * f); const bad = j => !path[j].p || !path[j].w || [path[j - 2], path[j - 1], path[j], path[j + 1], path[j + 2], path[j + 3]].some(q => q && (q.kind === 'jump' || q.kind === 'stepUp')); while (bad(i)) i++
    const q = path[i], b = A.createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw: q.yaw }); for (let s = 0; s < 20; s++) A.stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 })
    A.placeBike(b); G.running = true; G.keys.add('thr'); G.__i = i
  }, f)
  await page.waitForTimeout(1300)
  await page.evaluate(() => { const G = window.sky; G.keys.delete('thr'); G.keys.add('brk') })
  await page.waitForTimeout(250)
  const r = await page.evaluate(async () => {
    const G = window.sky, A = G.api, T = A.three, R = A.renderer, sc = A.scene
    G.keys.delete('brk'); G.hold = true
    await new Promise(r => requestAnimationFrame(r)); await new Promise(r => requestAnimationFrame(r))
    const grab = () => new Promise(res => { const img = new Image(); img.onload = () => { const c = document.createElement('canvas'); c.width = 240; c.height = 135; const x = c.getContext('2d'); x.drawImage(img, 0, 0, 240, 135); res(x.getImageData(0, 0, 240, 135).data) }; img.src = R.domElement.toDataURL() })
    // 本番の絵（後処理あり）
    G.hold = true
    const frame = await new Promise(res => requestAnimationFrame(async () => res(await grab())))
    // 道の上の面だけ白い絵（法線が上向きの面）。ほかは黒
    const mask = new T.ShaderMaterial({ vertexShader: 'varying float vy; void main(){ vy = normalize(mat3(modelMatrix) * normal).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: 'varying float vy; void main(){ gl_FragColor = vec4(vec3(vy > 0.75 ? 1.0 : 0.0), 1.0); }' })
    const hide = [], swap = []
    sc.traverse(o => { if (!o.isMesh && !o.isPoints && !o.isSprite && !o.isInstancedMesh) return; if (o.parent && o.parent.name === 'course' && o.name.startsWith('course:')) { swap.push([o, o.material]); o.material = mask } else if (o.visible) { hide.push(o); o.visible = false } })
    const bg = sc.background; sc.background = new T.Color(0); const fog = sc.fog; sc.fog = null
    R.setRenderTarget(null); R.toneMapping = T.NoToneMapping; R.render(sc, A.camera)
    const m = await grab()
    R.toneMapping = T.ACESFilmicToneMapping; sc.fog = fog; sc.background = bg
    for (const [o, mt] of swap) o.material = mt; for (const o of hide) o.visible = true
    G.hold = false
    let n = 0, s = 0, s2 = 0
    for (let i = 0; i < m.length; i += 4) if (m[i] > 128) { const l = 0.2126 * frame[i] + 0.7152 * frame[i + 1] + 0.0722 * frame[i + 2]; n++; s += l; s2 += l * l }
    const mean = n ? s / n : 0, sd = n ? Math.sqrt(Math.max(0, s2 / n - mean * mean)) : 0
    const q = G.course.path[G.__i]
    return { i: G.__i, kind: q.kind, mat: (G.world.shapes[(G.bike.cn[0] || G.bike.cn[1] || { id: 0 }).id] || {}).mat, px: n, mean: +mean.toFixed(1), sd: +sd.toFixed(1) }
  })
  r.f = +f.toFixed(2); r.ng = r.px > 300 && (r.mean < 28 || r.sd < 6); rows.push(r)
}
console.table(rows)
console.log('黒い帯の疑い', rows.filter(r => r.ng).length, '/', rows.length, ' 道の画素の明るさ 最小平均', Math.min(...rows.filter(r => r.px > 300).map(r => r.mean)))
await br.close(); process.exit(0)
