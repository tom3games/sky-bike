// 公開物をまとめる: node tools/build.mjs で dist/game.js（js/game.js から three まで 1 ファイル）を作る。js/ を直したら毎回
// esbuild はリポジトリに入れない。入っていなければ: mkdir -p ~/tools/esb && cd ~/tools/esb && npm i esbuild
// iOS Safari 14 でも動くように es2020（トップレベルの await は作らない）
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { resolve, dirname } from 'node:path'
const esbuild = createRequire(homedir() + '/tools/esb/x.js')('esbuild')
const ROOT = resolve(import.meta.dirname, '..')
// import の ?v=N を外す（同じファイルが 2 回入らないように）
const noQuery = { name: 'no-query', setup(b) { b.onResolve({ filter: /\?/ }, a => ({ path: resolve(a.resolveDir || dirname(a.importer), a.path.split('?')[0]) })) } }
const r = await esbuild.build({
  absWorkingDir: ROOT, entryPoints: ['js/game.js'], outfile: 'dist/game.js', bundle: true, format: 'esm', minify: true,
  target: 'es2020', // safari14 指定は esbuild が分割代入で止まる（esbuild の表の都合）。es2020 は iOS 14 の Safari で動く範囲で、トップレベルの await は作れない（作ると止まる） charset: 'utf8', legalComments: 'eof', alias: { three: resolve(ROOT, 'vendor/three.module.js') },
  plugins: [noQuery], logLevel: 'warning', metafile: true
})
const out = r.metafile.outputs['dist/game.js']
console.log('dist/game.js', (out.bytes / 1024).toFixed(0) + 'KB', Object.keys(r.metafile.inputs).length + ' files')
