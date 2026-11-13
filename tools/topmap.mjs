// コース全体を上から見た図（俯瞰図）を PNG に描く。道は高さで色を変え、塔は円、旗は点、区間の名前を添える。
//   node tools/topmap.mjs [出力.png]   JS=<js フォルダ> で別の版のコースを描ける（v15 と比べる時）
import { chromium } from 'playwright'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const jsDir = process.env.JS ? path.resolve(process.env.JS) : path.resolve('js')
const { COURSES } = await import(pathToFileURL(path.join(jsDir, 'course.js')).href)
const c = COURSES[process.env.COURSE || 'stage1']()
const out = process.argv[2] || 'shots/topmap.png'
const P = c.path.filter(q => q.p)
let mn = [1e9, 1e9], mx = [-1e9, -1e9], y0 = 1e9, y1 = -1e9
for (const q of P) { mn[0] = Math.min(mn[0], q.p[0]); mn[1] = Math.min(mn[1], q.p[2]); mx[0] = Math.max(mx[0], q.p[0]); mx[1] = Math.max(mx[1], q.p[2]); y0 = Math.min(y0, q.p[1]); y1 = Math.max(y1, q.p[1]) }
const span = +(process.env.SPAN || Math.max(mx[0] - mn[0], mx[1] - mn[1]) + 60)
const cxw = (mn[0] + mx[0]) / 2, czw = (mn[1] + mx[1]) / 2
const S = 1000, k = S / span
const X = x => (x - cxw) * k + S / 2, Z = z => (z - czw) * k + S / 2
const col = y => { const t = (y - y0) / Math.max(1, y1 - y0); const h = 200 - t * 170; return `hsl(${h},70%,${45 + t * 15}%)` }
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S + 60}" style="background:#11161a;font-family:sans-serif">`
for (const T of c.towers || (c.tower ? [c.tower] : [])) svg += `<circle cx="${X(T.cx)}" cy="${Z(T.cz)}" r="${T.r * k}" fill="#3a3f44" stroke="#8a9096" stroke-width="1.5"/>`
for (let i = 1; i < P.length; i++) {
  const a = P[i - 1], b = P[i]
  if (Math.hypot(a.p[0] - b.p[0], a.p[2] - b.p[2]) > 12) continue
  svg += `<line x1="${X(a.p[0]).toFixed(1)}" y1="${Z(a.p[2]).toFixed(1)}" x2="${X(b.p[0]).toFixed(1)}" y2="${Z(b.p[2]).toFixed(1)}" stroke="${col(b.p[1])}" stroke-width="${Math.max(1.5, (b.w || 1) * k)}" stroke-linecap="round" opacity="${b.branch ? 0.7 : 1}"/>`
}
for (const q of c.cps) if (q.rest || q.finish) svg += `<circle cx="${X(q.p[0])}" cy="${Z(q.p[2])}" r="3.5" fill="${q.finish ? '#ffd24a' : '#f4f1e0'}"/>`
// 区間の名前（区間の最初の点）
const seen = new Set()
for (const q of P) if (q.zone && !seen.has(q.zone)) { seen.add(q.zone); svg += `<text x="${X(q.p[0]) + 6}" y="${Z(q.p[2]) - 6}" fill="#e8e2cc" font-size="15">${q.zone} ${q.p[1].toFixed(0)}m</text>` }
const tot = (() => { let L = 0; for (let i = 1; i < P.length; i++) if (!P[i].branch) L += Math.min(12, Math.hypot(P[i].p[0] - P[i - 1].p[0], P[i].p[2] - P[i - 1].p[2])); return L })()
svg += `<line x1="20" y1="${S + 30}" x2="${20 + 100 * k}" y2="${S + 30}" stroke="#fff" stroke-width="3"/><text x="${28 + 100 * k}" y="${S + 35}" fill="#fff" font-size="15">100m</text>`
svg += `<text x="${S - 20}" y="${S + 35}" fill="#fff" font-size="15" text-anchor="end">${process.env.LABEL || ''}  広さ ${(mx[0] - mn[0]).toFixed(0)}×${(mx[1] - mn[1]).toFixed(0)}m  高さ ${y0.toFixed(0)}〜${y1.toFixed(0)}m  道 ${(tot / 1000).toFixed(2)}km  塔 ${(c.towers || [c.tower]).filter(Boolean).length}</text></svg>`
const br = await chromium.launch()
const pg = await br.newPage({ viewport: { width: S, height: S + 60 } })
await pg.setContent(`<body style="margin:0">${svg}</body>`)
await pg.screenshot({ path: out })
await br.close()
console.log('wrote', out, 'span', span.toFixed(0))
