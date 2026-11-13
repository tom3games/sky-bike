// SKY BIKE — 本体
import * as THREE from 'three'
import { EffectComposer } from '../vendor/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from '../vendor/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from '../vendor/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from '../vendor/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from '../vendor/jsm/postprocessing/ShaderPass.js'
import { GTAOPass } from '../vendor/jsm/postprocessing/GTAOPass.js'
import { HDRLoader } from '../vendor/jsm/loaders/HDRLoader.js'
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js'
import { buildGimmicks } from './gimmicks.js?v=14'
import { DT, World, createBike, stepBike, basis, hashBike, BIKE, wheelCenter, closest } from './physics.js?v=14'
import { COURSES } from './course.js?v=14'
import { buildCourse, buildDecor, buildMountains, buildChains, buildUnderRocks, buildFloaters, buildGrass, buildTitleIsland, buildCards, buildLava, buildFogLayers, buildFlames, updateFlames, buildSigns, buildSky, setAniso, updateMovers, PAL } from './view.js?v=14'
import { BikeView, snap } from './bikeview.js?v=14'
import { createBot, botInput, resetBot } from './bot.js?v=14'
import { judge, doRespawn, spawnAtCp, riserY } from './run.js?v=14'
import { createSteer, steerFor, resetSteer, assist } from './steer.js?v=14'

window.__jsUp = true
const $ = id => document.getElementById(id)
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
if (isTouch) document.documentElement.classList.add('touchui')
const Q = new URLSearchParams(location.search)

// ------------------------------------------------------------ 高さで変わる霧（three の霧の部品を差し替える）
// THREE.Fog の near を「濃さ」、far を「霧が薄くなり始める高さ」として使う。低い所ほど濃い（下の周が霧に沈む）
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogW;\n#endif'
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogW = (inverse(viewMatrix) * mvPosition).xyz;\n#endif'
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogW;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar;\n #endif\n#endif'
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
 #else
  float hk = exp( - max( 0.0, vFogW.y - fogFar ) * 0.05 );
  float fogFactor = 1.0 - exp( - fogNear * fogNear * vFogDepth * vFogDepth * ( 0.4 + 1.6 * hk ) );
 #endif
 gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
#endif`

// ------------------------------------------------------------ 言葉（日英）
const TXT = {
  ja: { loading: '塔へ向かう', kicker: '奈落の底から、雲の上の城まで。', c_practice: '練習場', c_stage1: '登る', c_stage1_sub: '第1面 奈落から天空へ', how: '遊び方', sound_on: '音 あり', sound_off: '音 なし', how_lead: 'ハンドルは自動で道をなぞる。操るのはアクセル・ブレーキ・体重の前後の4つだけ。', k_thr: 'アクセル', k_brk: 'ブレーキ（止まると下がる）', k_back: '後ろ体重', k_fwd: '前体重', k_cp: '休憩所からやり直す', k_pause: '一時停止', tip1: '段の前は後ろ体重で前輪を上げ、乗ったら前体重', tip2: '登りは前体重、下りは後ろ体重', tip3: '空中は体重で車体を着地の坂に合わせる', tip4: '曲がる前はブレーキ。速すぎると外へふくらむ', tip5: '後ろ体重のあとすぐ前体重で、車体が跳ねる', tip6: '止まったまま後ろ体重で前輪が上がる（約33度で止まる）。前体重＋ブレーキで前輪で立つ', tip7: '回りすぎ・頭から落ちると転んで少し前から。道の外へ落ちたら着いた所から登り直し', tip8: '高い段は ゆっくり ←＋↑ で前輪を掛け、→＋↑ でよじ登る', tip9: '扉は速さで破る。シーソーはゆっくり。ひびの入った床は速さで越える', logo_sub: '崩れた塔を、雲の上まで', t_climb: '高い段は ゆっくり ←＋↑ → ＋↑', credit: '素材: Poly Haven・Quaternius・Kenney ほか（CC0）。火の音: Work With Sounds / La Fonderie（CC BY 4.0）。一覧は CREDITS.md', back: 'もどる', faults: 'フォルト', arrived: '到着', time: '時間', best: '自己ベスト', retry: 'もう一回', next: '登る', share: 'Xでポスト', menu: 'メニュー', paused: '一時停止', resume: '続ける', restart: '最初から', why_head: '頭を打った', why_back: '後ろへ回りすぎた', why_front: '前へ回った', why_body: '体が当たった', why_hard: '着地が強すぎ', why_belly: '車体の下を強く打った', why_fall: '落ちた', medal: ['金', '銀', '銅', '完走'], newBest: '自己ベスト更新', rest: 'セーブした', fell: 'Nm 落ちた', net: '休憩所に戻った', lava: '溶岩に落ちた', best_alt: '最高', hard_on: 'ハードコア 入', hard_off: 'ハードコア 切', t_thr: 'アクセル', t_back: '段の前は 後ろ体重', t_fwd: '登りは 前体重', t_air: '空中は体重で角度を合わせる', t_brk: '曲がる前は ブレーキ', keys: '<b>↑</b>アクセル <b>↓</b>ブレーキ <b>←</b>後ろ体重 <b>→</b>前体重 <i></i><b>R</b>休憩所へ <b>Esc</b>止める' },
  en: { loading: 'Heading to the tower', kicker: 'From the abyss to the castle above the clouds.', c_practice: 'Practice Yard', c_stage1: 'Climb', c_stage1_sub: 'Stage 1: Abyss to the Sky', how: 'How to play', sound_on: 'Sound on', sound_off: 'Sound off', how_lead: 'Steering is automatic. You only control throttle, brake and leaning back or forward.', k_thr: 'Throttle', k_brk: 'Brake (reverse when stopped)', k_back: 'Lean back', k_fwd: 'Lean forward', k_cp: 'Back to rest point', k_pause: 'Pause', tip1: 'Lean back to lift the front onto a step, then lean forward', tip2: 'Lean forward going up, back going down', tip3: 'In the air, lean to match the landing slope', tip4: 'Brake before corners. Too fast and you run wide', tip5: 'Lean back then quickly forward to hop', tip6: 'Standing still, lean back to lift the front (holds at about 33°). Lean forward + brake to stand on the front wheel', tip7: 'Loop out or land on your head and you restart a little way back. Fall off and you climb from where you land', tip8: 'Tall ledge: creep with ← + ↑ to hook the front, then → + ↑ to climb', tip9: 'Smash doors with speed. Ride seesaws slowly. Keep your speed over cracking floors', logo_sub: 'Ride the ruined tower above the clouds', t_climb: 'Tall ledge: creep ← + ↑, then → + ↑', credit: 'Assets: Poly Haven, Quaternius, Kenney and others (CC0). Fire sound: Work With Sounds / La Fonderie (CC BY 4.0). Full list in CREDITS.md', back: 'Back', faults: 'Faults', arrived: 'Arrived', time: 'Time', best: 'Best', retry: 'Retry', next: 'Climb', share: 'Post on X', menu: 'Menu', paused: 'Paused', resume: 'Resume', restart: 'Restart', why_head: 'Head hit', why_back: 'Looped out backward', why_front: 'Over the bars', why_body: 'Body hit', why_hard: 'Landing too hard', why_belly: 'Bottomed out hard', why_fall: 'Fell', medal: ['GOLD', 'SILVER', 'BRONZE', 'DONE'], newBest: 'New best', rest: 'Saved', fell: 'Fell Nm', net: 'Back to rest point', lava: 'Into the lava', best_alt: 'Best', hard_on: 'Hardcore ON', hard_off: 'Hardcore OFF', t_thr: 'Throttle', t_back: 'Lean back before a step', t_fwd: 'Lean forward going up', t_air: 'Lean to match the landing', t_brk: 'Brake before the corner', keys: '<b>↑</b>throttle <b>↓</b>brake <b>←</b>lean back <b>→</b>lean fwd <i></i><b>R</b>rest point <b>Esc</b>pause' },
}
let lang = 'ja'
try { lang = localStorage.getItem('sky-lang') || ((navigator.language || 'ja').slice(0, 2) === 'ja' ? 'ja' : 'en') } catch (e) {}
const t = k => (TXT[lang][k] ?? TXT.ja[k])
function applyLang() {
  document.documentElement.lang = lang
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t) })
  $('langBtn').textContent = lang === 'ja' ? 'English' : '日本語'
  $('muteBtn').textContent = Snd.muted ? t('sound_off') : t('sound_on')
  $('hardBtn').textContent = G && G.hard ? t('hard_on') : t('hard_off')
  $('keysMini').innerHTML = t('keys')
  refreshBest()
}
const MEDAL = { practice: [62, 80, 110], stage1: [130, 170, 260] }
const CNAME = { practice: 'c_practice', stage1: 'c_stage1_sub' }

// ------------------------------------------------------------ 描画の土台
const lowEnd = isTouch && Math.min(screen.width, screen.height) < 500
const QUAL = Q.get('q') || (isTouch ? 'mid' : 'high')
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.25 : 1.75))
renderer.setSize(innerWidth, innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()))
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 3000)
const sky = buildSky(scene)
const hemi = new THREE.HemisphereLight(0x7aa6ae, 0x2e2a24, 1.35); scene.add(hemi)
// 区間ごとの明るさ: col 霧に混ぜる色・tint 混ぜる量・hemi 空の明るさ・dens 霧の濃さの足し
const ZONEP = { ground: { col: 0x5a3b2c, tint: 0.2, hemi: 1.45, dens: -0.0065 }, crypt: { col: 0x141c1b, tint: 0.75, hemi: 0.32, dens: 0.007 }, ruin: { col: 0x2d474e, tint: 0, hemi: 1.35, dens: 0 }, factory: { col: 0x4a3c30, tint: 0.35, hemi: 1.15, dens: 0.002 }, bell: { col: 0x5a5040, tint: 0.3, hemi: 1.25, dens: 0.001 }, ice: { col: 0x5f7f86, tint: 0.5, hemi: 1.4, dens: 0.003 }, storm: { col: 0x34424a, tint: 0.55, hemi: 0.95, dens: 0.005 }, roof: { col: 0x2d474e, tint: 0, hemi: 1.35, dens: -0.002 }, sky: { col: 0x6a8a90, tint: 0.2, hemi: 1.45, dens: -0.004 }, castle: { col: 0x6a8a90, tint: 0.2, hemi: 1.45, dens: -0.004 } }
// 月の反対側から弱い青緑の補助光（影は付けない。影の側が真っ黒にならないように）
const fill = new THREE.DirectionalLight(0x5f8f98, 0.55); fill.position.set(60, 40, 50); scene.add(fill)
const MOON = new THREE.Vector3(-0.5, 0.55, -0.4).normalize()
const moon = new THREE.DirectionalLight(0xa9c8cf, 1.7); scene.add(moon, moon.target)
moon.castShadow = true
moon.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048)
Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 180 })
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04
scene.fog = new THREE.Fog(0x2d474e, 0.012, 0)
// 松明の実際の光（近くの数個だけ。ほかは光る板だけ）
const torchLights = Array.from({ length: lowEnd ? 3 : 5 }, () => { const l = new THREE.PointLight(0xff9248, 0, 11, 2); scene.add(l); return l })
// 後処理: 描く → 物の陰（GTAO）→ にじむ光 → ACES トーンマップ → 色の調子・周辺減光・粒
const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: lowEnd ? 0 : 4 }))
composer.setPixelRatio(renderer.getPixelRatio())
composer.addPass(new RenderPass(scene, camera))
let gtao = null
if (QUAL === 'high') {
  gtao = new GTAOPass(scene, camera, innerWidth, innerHeight)
  gtao.blendIntensity = 0.85
  gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 })
  gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 5, rings: 2, samples: 12 })
  composer.addPass(gtao)
}
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.55, 0.92)
composer.addPass(bloom)
composer.addPass(new OutputPass())
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(innerWidth, innerHeight) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform vec2 res; varying vec2 vUv;
    void main(){ vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, 0.86);
      c.rgb += vec3(-0.012, 0.010, 0.016) * (1.0 - smoothstep(0.0, 0.5, l));
      vec2 d = vUv - 0.5; float v = smoothstep(0.88, 0.3, length(d * vec2(1.15, 1.0)));
      c.rgb *= mix(0.52, 1.0, v);
      float g = fract(sin(dot(vUv * res + time, vec2(12.9898, 78.233))) * 43758.5453);
      c.rgb += (g - 0.5) * 0.022;
      gl_FragColor = c; }`,
})
composer.addPass(grade)
addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); if (gtao) gtao.setSize(innerWidth, innerHeight); grade.uniforms.res.value.set(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix() })

// ------------------------------------------------------------ 音（風・火・鎖のきしみ・遠くの崩落。鳥はいない）
Snd.def({ land: ['snd/land1.mp3', 'snd/land2.mp3', 'snd/land3.mp3'], crash: ['snd/crash1.mp3', 'snd/crash2.mp3'], clank: ['snd/clank1.mp3', 'snd/clank2.mp3'], spring: 'snd/spring.mp3', gate: 'snd/gate.mp3', finish: 'snd/finish.mp3', swish: 'snd/swish.mp3', crack: ['snd/crack1.mp3', 'snd/crack2.mp3'], creak: ['snd/creak_a.mp3', 'snd/creak_b.mp3', 'snd/creak_c.mp3'], chain: ['snd/chain_a.mp3', 'snd/chain_b.mp3'], rumble: ['snd/rumble_a.mp3', 'snd/rumble_b.mp3', 'snd/rumble_c.mp3'], splash: ['snd/splash1.mp3', 'snd/splash2.mp3'], save: 'snd/save.mp3', cloth: 'snd/cloth.mp3', rockfall: 'snd/rockfall.mp3', rockbreak: 'snd/rockbreak.mp3', pebbles: 'snd/pebbles.mp3', ballhit: 'snd/ballhit.mp3' })
try { Snd.muted = localStorage.getItem('sky-mute') === '1' } catch (e) {}
function startAudio() {
  Snd.init()
  if (Snd.ctx && !Snd.loops.engine) { Snd.loop('engine', 'snd/engine.wav', 0.0001, 0.2); Snd.loop('wind', 'snd/wind_howl.wav', 0.0001, 0.8); Snd.loop('fire', 'snd/fire.wav', 0.0001, 0.5); Snd.loop('water', 'snd/water.mp3', 0.0001, 0.5) }
}
let ambT = 9, creakT = 4
function soundUpdate(dt) {
  if (!Snd.ctx || Snd.away) return
  const L = Snd.loops, c = Snd.ctx.currentTime
  const b = G.bike, playing = G.state === 'play' && b
  const sp = playing ? Math.abs(b.speed) : 0
  if (L.engine && L.engine.node) {
    const thr = playing && !b.crashed ? G.inp.thr : 0
    G.rpm += ((0.25 + thr * 0.55 + Math.min(sp / 30, 0.6) * (b && (b.g[0] || b.g[1]) ? 1 : 0.5) + (thr && b && !b.g[0] ? 0.35 : 0)) - G.rpm) * Math.min(1, dt * (thr ? 6 : 3))
    L.engine.node.playbackRate.setTargetAtTime(0.55 + G.rpm * 0.9, c, 0.03)
    L.engine.g.gain.setTargetAtTime(playing && !b.crashed ? 0.09 + G.rpm * 0.14 : 0.0001, c, 0.08)
  }
  const y = camera.position.y
  if (L.wind && L.wind.node) L.wind.g.gain.setTargetAtTime(Math.min(0.55, 0.16 + sp / 70 + Math.max(0, y) / 160 + (b && b.airT > 0.3 ? 0.1 : 0) + (G.gim ? G.gim.gust * 0.35 : 0)), c, 0.3)
  if (L.water && L.water.node) L.water.g.gain.setTargetAtTime(Math.max(0.0001, Math.min(0.5, (1 - (G.gim ? G.gim.nearWater : 99) / 38) * 0.5)), c, 0.3)
  if (L.fire && L.fire.node) L.fire.g.gain.setTargetAtTime(Math.max(0.0001, Math.min(0.4, (1 - G.nearFire / 9) * 0.4)), c, 0.2)
  // 遠くの崩落（こもった音・響き）と、近くの鎖・木のきしみ
  ambT -= dt; creakT -= dt
  if (ambT < 0) { ambT = 14 + Math.random() * 22; Snd.play('rumble', { vol: 0.55, dest: 'muf', room: 0.8, rate: 0.7 }) }
  if (creakT < 0) { creakT = 3 + Math.random() * 5; if (G.nearChain < 10) Snd.play(Math.random() < 0.6 ? 'creak' : 'chain', { vol: 0.18 * (1 - G.nearChain / 10) + 0.04, dest: 'muf', room: 0.4 }) }
}

// ------------------------------------------------------------ 状態
const G = {
  state: 'load', course: null, world: null, bike: null, prev: null, inp: { thr: 0, brk: 0, lean: 0, steer: 0 },
  cpIdx: 0, faults: 0, time: 0, running: false, steps: 0, acc: 0, camYaw: 0, camPos: new THREE.Vector3(), camTgt: new THREE.Vector3(), camSide: 1,
  rec: null, ghost: null, ghostView: null, best: {}, rpm: 0, shake: 0, hitStop: 0, fov: 58, fallFrom: null, paused: false, maxAlt: 0, testInput: null,
  keys: new Set(), touch: { thr: false, brk: false, back: false, fwd: false }, nearFire: 99, nearChain: 99, tut: null,
}
window.sky = G
try { G.best = JSON.parse(localStorage.getItem('sky-best6') || '{}') } catch (e) { G.best = {} }
try { G.hard = localStorage.getItem('sky-hard') === '1' } catch (e) {}
let built = null, bikeView = null
const courseCache = {}

function fmt(sec) { if (sec == null) return '—'; const m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2) }
function refreshBest() {
  for (const [k, id] of [['practice', 'bestPractice'], ['stage1', 'bestStage1']]) {
    const b = G.best[k]; $(id).textContent = b ? `${t('best')} ${fmt(b.time)}  ${t('faults')} ${b.faults}` : (k === 'stage1' ? t('c_stage1_sub') : '')
  }
}

function loadCourse(id) {
  if (built) { for (const o of built.objs) if (o) scene.remove(o); built.group.traverse(o => o.geometry && o.geometry.dispose()) }
  const LM = window.__loadMarks = window.__loadMarks || {}, lt = () => performance.now(); let l0 = lt()
  const c = courseCache[id] || (courseCache[id] = COURSES[id]())
  LM.course = Math.round(lt() - l0); l0 = lt()
  G.course = c
  G.world = new World(c.shapes); G.world.winds = c.winds || []
  const { group, movers, M, more } = buildCourse(c, scene, c.tower ? new Set(['ground', 'ruin']) : null) // 上の区間は、準備完了の後に 1 コマに 1 区間ずつ作る
  LM.mesh = Math.round(lt() - l0); l0 = lt()
  G.gim = buildGimmicks(c, scene, M)
  LM.gim = Math.round(lt() - l0); l0 = lt()
  const spot = c.tower ? (() => { const i = titleIndex(c); return { q: c.path[i], side: -1 } })() : null
  // 塔の飾り（窓・ツタ・鎖・張り出しの下の岩）は、第1面では準備完了の後に作る（読み込みを速く）
  const lateDeco = !!c.tower
  const decor = lateDeco ? { group: null, wallFlames: [] } : buildDecor(c, scene, M); LM.decor = Math.round(lt() - l0); l0 = lt()
  const signs = buildSigns(c, scene), chains = lateDeco ? null : buildChains(c, scene, M); LM.chains = Math.round(lt() - l0); l0 = lt()
  const under = lateDeco ? null : buildUnderRocks(c, scene, M); LM.under = Math.round(lt() - l0); l0 = lt()
  const floaters = buildFloaters(c, scene, M), grass = buildGrass(c, scene); LM.float = Math.round(lt() - l0); l0 = lt()
  const mn = [1e9, 1e9], mx = [-1e9, -1e9]; for (const s of c.shapes) if (s.tag !== 'ground') { mn[0] = Math.min(mn[0], s.min[0]); mn[1] = Math.min(mn[1], s.min[2]); mx[0] = Math.max(mx[0], s.max[0]); mx[1] = Math.max(mx[1], s.max[2]) }
  const ctr = c.tower ? [c.tower.cx, 0, c.tower.cz] : [(mn[0] + mx[0]) / 2, 0, (mn[1] + mx[1]) / 2], rad = Math.max(mx[0] - mn[0], mx[1] - mn[1]) / 2 + 40
  const far = c.tower ? null : buildMountains(scene, ctr, rad, M), farLights = far ? far.userData.lights || [] : [] // 第1面の遠景は描いた背景（後から読む）
  const lava = buildLava(scene, ctr, c.lavaY ?? -8)
  // 上がってくる溶岩（追われて登る区間）の面。始まった時だけ見せる
  const riser = new THREE.Mesh(new THREE.CircleGeometry(60, 40), lava.material); riser.rotation.x = -Math.PI / 2; riser.visible = false; riser.name = 'riser'; if (c.tower) riser.position.set(c.tower.cx, 0, c.tower.cz); scene.add(riser)
  const fogL = buildFogLayers(scene, ctr, c.tower ? [[(c.lavaY ?? -8) + 6, 0.9], [-10, 0.6], [8, 0.4], [28, 0.4], [44, 0.5]] : [[-2, 0.6]])
  const flamePts = (c.torches || []).concat(decor.wallFlames, floaters.flames)
  const farGlow = buildFlames(scene, farLights, M)
  const flames = buildFlames(scene, flamePts, M)
  built = { more, riser, group, signs, M, objs: [...G.gim.objs, riser, group, grass, farGlow.group, decor.group, signs, chains, under, floaters.group, far, lava, fogL.group, flames.group], movers, M, lava, fogL, flames, flamePts, ctr, props: null }
  G.castleAt = c.castleAt
  if (lateDeco) built.late = () => {
    const d = buildDecor(c, scene, M), ch = buildChains(c, scene, M), un = buildUnderRocks(c, scene, M)
    built.objs.push(d.group, ch, un)
    if (d.wallFlames.length) { const fl = buildFlames(scene, d.wallFlames, M); built.objs.push(fl.group); built.flames.list.push(...fl.list); built.flamePts.push(...d.wallFlames); G._lt = 0 }
  }
  G._lt = 0; G._near = null // 松明の光の割り当てを作り直す（前のコースの番号を使わない）
  G.steer = createSteer(c.path)
  // 道の点ごとに「鎖や木のきしむ物が近いか」（橋・広場）
  G.creakPts = c.path.filter(q => q.p && (q.kind === 'bridge' || q.kind === 'uturn' || q.kind === 'crumble')).map(q => q.p)
  if (propsReady) placeProps()
  if (cardTex && c.tower) { built.cards = buildCards(c, scene, cardTex); built.objs.push(built.cards) }
  sky.material.uniforms.hasPano.value = c.tower && panoTex ? 1 : 0
  // 背景の月が、タイトルの場面の左上に来るように回す（世界のどこから見ても同じ向き）
  if (spot) sky.material.uniforms.panoRot.value = (spot.q.yaw + 0.42) / (Math.PI * 2)
}

// ------------------------------------------------------------ 模型（樽・像・門。最初の画面のあとで読む）
let propsReady = null
async function loadProps() {
  const ld = new GLTFLoader(), get = u => ld.loadAsync(u).then(g => g.scene).catch(() => null)
  const [barrel, statue, gate] = await Promise.all([get('assets/models/Barrel_01/Barrel_01_1k.gltf'), get('assets/models/gothic_statue/gothic_statue_1k.gltf'), get('assets/models/large_iron_gate/large_iron_gate_1k.gltf')])
  propsReady = { barrel, statue, gate }
  for (const m of Object.values(propsReady)) if (m) m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true } })
  placeProps()
}
function placeProps() {
  if (!built || !propsReady) return
  if (built.props) scene.remove(built.props)
  const g = new THREE.Group(); g.name = 'props'
  const c = G.course
  for (const p of c.props || []) {
    const src = propsReady[p.kind]; if (!src) continue
    const m = src.clone()
    if (p.kind === 'barrel') { m.position.set(p.p[0], p.p[1], p.p[2]); m.rotation.y = p.rot || 0 }
    if (p.kind === 'statue') {
      // 像は高さ 2.3m・台の上（当たりは半径 1.0m の円柱）
      const box = new THREE.Box3().setFromObject(src), s = 2.3 / (box.max.y - box.min.y)
      m.scale.setScalar(s); m.position.set(p.p[0], p.p[1] - box.min.y * s, p.p[2]); m.rotation.y = p.yaw + Math.PI / 2
    }
    g.add(m)
  }
  // 天空城の門: 上げた鉄の格子（頭の上。通り抜ける所には何も下りていない）
  const fin = c.cps.find(q => q.finish)
  if (fin && propsReady.gate) { const m = propsReady.gate.clone(); m.scale.setScalar(2.05); m.position.set(fin.p[0], fin.p[1] + 3.4, fin.p[2]); m.rotation.y = fin.yaw + Math.PI / 2; g.add(m) }
  scene.add(g); built.props = g; built.objs.push(g)
}
function titleIndex(c) {
  // 廃墟の右回りの張り出し（最初の U ターンの後）。外側の斜め後ろ・高めから、右に塔・左に霧の谷・下に登ってきた周
  const p = c.path
  const m0 = (c.marks || []).find(m => m.name.includes('木の橋')), from = m0 ? m0.i0 : 0
  let i = p.findIndex((q, k) => k >= from && q.kind === 'uturn'); if (i < 0) return 40
  while (i < p.length && p[i].kind !== 'orbit') i++
  return Math.min(p.length - 20, i + 8)
}
// 遠景の描いた背景（360度）と、霧の層の間の描いた廃墟の板。最初の画面のあとで読む
let panoTex = null, cardTex = null
const fogBase = new THREE.Color(0x2d474e)
async function loadBackdrop() {
  const tl = new THREE.TextureLoader()
  try {
    const t = await tl.loadAsync('assets/pano.webp')
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4
    panoTex = t; const u = sky.material.uniforms; u.pano.value = t; u.hasPano.value = G.course && G.course.tower ? 1 : 0
    // 霧の色を、背景の地平線の少し下の色に合わせる（3D とのつなぎ目を消す）
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 32; const x = cv.getContext('2d'); x.drawImage(t.image, 0, 0, 64, 32)
    const d = x.getImageData(0, 17, 64, 3).data; let r = 0, g2 = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g2 += d[i + 1]; b += d[i + 2] } const n = d.length / 4
    fogBase.setRGB(r / n / 255, g2 / n / 255, b / n / 255, THREE.SRGBColorSpace)
  } catch (e) { console.warn('pano', e) }
  // 描いた廃墟の板（assets/cards）は、霧の中で切り抜いた紙に見えて背景の絵と合わなかったので使わない（2026-11-13 v7 で試した）
}
async function loadEnv() {
  try {
    const hdr = await new HDRLoader().loadAsync('assets/moonless_golf_1k.hdr')
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromEquirectangular(hdr).texture; scene.environmentIntensity = 0.8; pm.dispose(); hdr.dispose()
  } catch (e) { console.warn('env', e) }
}

function placeBike(b) {
  G.bike = b; G.prev = snap(b); G.camYaw = b.psi; G.fallFrom = null
  if (G.steer) resetSteer(G.steer, b)
  if (G.bot) resetBot(G.bot, b)
  G.camPos.set(NaN, 0, 0)
  if (bikeView) bikeView.resetRider()
  return b
}
function spawnAt(cpi) { return placeBike(spawnAtCp(G.world, G.course, cpi)) }
function startRun(id) {
  if (!G.course || G.course.id !== id) loadCourse(id)
  G.cpIdx = 0; G.faults = 0; G.time = 0; G.running = false; G.steps = 0; G.acc = 0; G.maxAlt = 0
  G.R = { cp: 0, rest: 0, hard: G.hard && !!G.course.climb, restSeen: { 0: true } }
  G.world.setTime(0); for (const s of G.world.moving) { s.gone = false; s.touch = 0 }
  spawnAt(0)
  G.rec = { course: id, inp: [], ev: [] }
  const bst = G.best[id]
  G.ghost = null
  if (bst && bst.rec && !!bst.hard === !!G.R.hard) { G.ghost = { rec: unpack(bst.rec), ev: (bst.ev || []).slice(), i: 0, cp: 0 }; G.ghost.bike = ghostSpawn({ cp: 0 }) }
  if (!G.ghostView) G.ghostView = new BikeView(scene, { ghost: true })
  G.ghostView.root.visible = !!G.ghost
  if (Q.get('ff')) G.ff = +Q.get('ff')
  if (Q.get('bot')) { G.bot = createBot(G.course, { skill: Q.get('bot') }); G.bot.world = G.world; resetBot(G.bot, G.bike); G.testInput = () => botInput(G.bot, G.bike) }
  G.state = 'play'; G.paused = false
  G.tut = { k: 0, on: null, hold: 0, air: false, doneT: 0 }
  try { if (localStorage.getItem('sky-tut-done') === '1') G.tut.k = 99 } catch (e) {}
  if (bikeView) bikeView.root.visible = true
  show('hud'); if (isTouch) $('touch').hidden = false
  $('altBest').style.display = 'none'; G.bestAlt = null
  try { const ba = +localStorage.getItem('sky-alt5-' + id); if (ba) G.bestAlt = ba } catch (e) {}
  $('ft').textContent = '0'; $('tm').textContent = fmt(0)
  for (const k in G.touch) G.touch[k] = false; document.querySelectorAll('.tb').forEach(b => b.classList.remove('on', 'down'))
}
function ghostSpawn(rs) { const b = doRespawn(G.world, G.course, { rest: 0 }, rs); b.ghost = true; return b }
function show(id) { for (const s of ['loading', 'title', 'how', 'result', 'pause']) $(s).hidden = s !== id; $('hud').hidden = !(id === 'hud' || id === 'pause'); if (id !== 'hud' && id !== 'pause') $('touch').hidden = true }

// ------------------------------------------------------------ 入力（アクセル・ブレーキ・後ろ体重・前体重の4つ。ハンドルは自動）
const KEYMAP = { ArrowUp: 'thr', KeyW: 'thr', ArrowDown: 'brk', KeyS: 'brk', ArrowLeft: 'back', KeyA: 'back', ArrowRight: 'fwd', KeyD: 'fwd' }
addEventListener('keydown', e => {
  if (e.repeat) { if (KEYMAP[e.code]) e.preventDefault(); return }
  startAudio()
  if (KEYMAP[e.code]) { G.keys.add(KEYMAP[e.code]); e.preventDefault() }
  if (G.state === 'play') {
    if (e.code === 'Backspace' || (e.code === 'KeyR' && !e.shiftKey)) { e.preventDefault(); retryCp(true) }
    if (e.code === 'Delete' || (e.code === 'KeyR' && e.shiftKey)) { e.preventDefault(); startRun(G.course.id) }
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause()
  } else if (G.state === 'pause') {
    if (e.code === 'Escape' || e.code === 'KeyP') togglePause()
  } else if (G.state === 'result') {
    if (e.code === 'Enter' || e.code === 'Space') $('rRetry').click()
  }
})
addEventListener('keyup', e => { if (KEYMAP[e.code]) G.keys.delete(KEYMAP[e.code]) })
addEventListener('blur', () => G.keys.clear())
let padPrev = {}
function readPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null
  if (!gp) return null
  const ax = i => { const v = gp.axes[i] || 0; return Math.abs(v) < 0.15 ? 0 : v }
  const bt = i => gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0
  const p = { thr: bt(7), brk: bt(6), lean: Math.max(-1, Math.min(1, ax(0))), b: bt(1) > 0.5, y: bt(3) > 0.5, start: bt(9) > 0.5 }
  if (p.b && !padPrev.b && G.state === 'play') retryCp(true)
  if (p.y && !padPrev.y && G.state === 'play') startRun(G.course.id)
  if (p.start && !padPrev.start) togglePause()
  padPrev = p
  return p
}
// スマホ: どのボタンも押している間だけ効く。押した指を捕まえておくので、指がボタンの外へずれても切れない。指ごとに別のボタンを同時に押せる
document.querySelectorAll('.tb').forEach(btn => {
  const k = btn.dataset.k, ids = new Set()
  const down = e => { e.preventDefault(); startAudio(); ids.add(e.pointerId); try { btn.setPointerCapture(e.pointerId) } catch (err) {} G.touch[k] = true; btn.classList.add('down') }
  const up = e => { e.preventDefault(); ids.delete(e.pointerId); if (!ids.size) { G.touch[k] = false; btn.classList.remove('down') } }
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', up)
})
function gatherInput() {
  if (G.testInput) return G.testInput()
  const K = G.keys, T = G.touch, pad = readPad()
  let thr = K.has('thr') || T.thr ? 1 : 0, brk = K.has('brk') || T.brk ? 1 : 0
  let lean = (K.has('fwd') || T.fwd ? 1 : 0) - (K.has('back') || T.back ? 1 : 0)
  if (pad) { thr = Math.max(thr, pad.thr); brk = Math.max(brk, pad.brk); if (pad.lean) lean = pad.lean }
  if (T.brk && T.thr) thr = 0
  const steer = G.bike && !G.bike.crashed && G.steer ? steerFor(G.steer, G.bike) : 0
  // 記録できる細かさに丸める（同じ入力なら同じ結果）
  const inp = { thr: Math.round(thr * 8) / 8, brk: Math.round(brk * 8) / 8, lean: Math.round(lean * 16) / 16, steer: Math.round(steer * 16) / 16 }
  // 曲がりの手前の自動の減速（アクセルを押しっぱなしでも、ふつうの曲がりでははみ出さない）
  return G.bike && !G.bike.crashed && G.steer ? assist(G.steer, G.bike, inp) : inp
}
const pack = arr => { const u = new Uint8Array(arr.length * 4); arr.forEach((v, i) => { u[i * 4] = v.thr * 8; u[i * 4 + 1] = v.brk * 8 + (v.ab || 0) * 8 * 16; u[i * 4 + 2] = Math.round(v.lean * 16) + 16; u[i * 4 + 3] = Math.round(v.steer * 16) + 16 }); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s) }
function unpack(s) { const r = atob(s), out = []; for (let i = 0; i + 3 < r.length; i += 4) out.push({ thr: r.charCodeAt(i) / 8, brk: (r.charCodeAt(i + 1) & 15) / 8, ab: (r.charCodeAt(i + 1) >> 4) / 8, lean: (r.charCodeAt(i + 2) - 16) / 16, steer: (r.charCodeAt(i + 3) - 16) / 16 }); return out }

// ------------------------------------------------------------ 走る
function retryCp(manual) {
  if (G.state !== 'play') return
  respawn({ cp: G.course.climb ? (G.R.rest || 0) : G.R.cp }, manual)
}
function respawn(rs, manual) {
  if (!rs.tumble) { G.faults++; $('ft').textContent = G.faults } // 転んで起こすだけの時はフォルトにしない
  if (G.rec) G.rec.ev.push({ s: G.steps, ...rs })
  placeBike(doRespawn(G.world, G.course, G.R, rs))
  if (manual) toast(G.course.cps[rs.cp ?? 0].name)
}
function togglePause() {
  if (G.state === 'play') { G.state = 'pause'; show('pause') }
  else if (G.state === 'pause') { G.state = 'play'; show('hud'); if (isTouch) $('touch').hidden = false }
}
let toastT = 0
function toast(html, sub) { const el = $('toast'); el.innerHTML = html + (sub ? `<small>${sub}</small>` : ''); el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1700) }
let whyT = 0
function why(txt) { const el = $('why'); el.textContent = txt; el.classList.add('on'); clearTimeout(whyT); whyT = setTimeout(() => el.classList.remove('on'), 1800) }
function flash(kind) { const f = $('flash'); f.className = kind; requestAnimationFrame(() => requestAnimationFrame(() => { f.className = '' })) }

function fixedStep() {
  const b = G.bike, c = G.course
  const inp = gatherInput()
  G.inp = inp
  if (!G.running && (inp.thr > 0 || inp.brk > 0 || inp.lean)) G.running = true
  const ev = []
  G.prev = snap(b)
  if (G.running) G.world.tick()
  stepBike(G.world, b, inp, ev)
  if (G.running) { G.rec.inp.push(inp); G.steps++; G.time = G.steps * DT }
  if (G.ghost && G.running) stepGhost()
  for (const e of ev) {
    if (e.t === 'crash') {
      if (bikeView) bikeView.throwRider(b, scene)
      Snd.play('crash', { vol: 0.9 }); Snd.play('clank', { vol: 0.7, delay: 0.12 }); G.shake = 0.6; G.hitStop = 0.09; flash('bad')
      why(t('why_' + e.why) + (e.why === 'hard' ? ` ${e.v.toFixed(1)}m/s` : ''))
    }
    if (e.t === 'land') { const k = Math.min(1, e.impact / 9); Snd.play('land', { vol: 0.25 + k * 0.7 }); if (e.impact > 3) Snd.play('spring', { vol: k * 0.5 }); G.shake = Math.max(G.shake, k * 0.45); if (k > 0.55) G.hitStop = 0.04 + k * 0.03 }
    if (e.t === 'hop') Snd.play('spring', { vol: 0.5 })
    if (e.t === 'thud') { const k = Math.min(1, e.v / 16); Snd.play('land', { vol: 0.7 + k * 0.3 }); Snd.play('clank', { vol: 0.3 + k * 0.4 }); G.shake = Math.max(G.shake, 0.4 + k * 0.6); G.hitStop = 0.05 + k * 0.04; flash('bad'); if (b.cn[0]) dust.emit(b.cn[0].q, 14, 3.5) }
    if (e.t === 'crumble') { Snd.play('crack', { vol: 0.7 }); Snd.play('creak', { vol: 0.5 }) }
    if (e.t === 'trapwarn') { Snd.play('pebbles', { vol: 0.9 }); Snd.play('creak', { vol: 0.6 }); dust.emit(e.p, 10, 1.5) }
    if (e.t === 'trapfall') { Snd.play('crack', { vol: 0.9 }); Snd.play('rockfall', { vol: 0.6 }); dust.emit(e.p, 22, 3) }
    if (e.t === 'break') { Snd.play('crack', { vol: 1 }); Snd.play('rockbreak', { vol: 0.7 }); G.shake = Math.max(G.shake, 0.5); dust.emit(b.p, 30, 5) }
    if (e.t === 'knock') { Snd.play(e.tag === 'rock' ? 'rockbreak' : 'ballhit', { vol: 1 }); Snd.play('clank', { vol: 0.6, delay: 0.05 }); G.shake = Math.max(G.shake, 0.9); G.hitStop = 0.08; flash('bad'); dust.emit(b.p, 12, 3) }
  }
  b.impact = 0
  const wasAir = !b.g[0] && !b.g[1]
  const j = judge(G.world, c, G.R, b, G.prev.p)
  G.cpIdx = G.R.cp
  if (j.finish) { finish(); return }
  if (j.gate != null) { const cp = c.cps[j.gate]; if (cp.rest) { (G.R.restSeen = G.R.restSeen || {})[j.gate] = true; Snd.play('save', { vol: 0.55 }); Snd.play('cloth', { vol: 0.7, delay: 0.1 }) } else Snd.play('gate', { vol: 0.5, rate: 0.8 }); toast(cp.name, cp.rest ? t('rest') : fmt(G.time)); flash('on') }
  if (!wasAir) { const cn = b.cn[0] || b.cn[1]; G.lastTag = cn ? G.world.shapes[cn.id].tag : G.lastTag }
  if (wasAir && G.R.fallTop - b.p[1] > 4 && G.lastTag !== 'kicker') {
    if (!G.fallFrom) { G.fallFrom = { y: G.R.fallTop, t: 0 }; Snd.play('swish', { vol: 0.6, rate: 0.6 }); G.slowMo = 0.5; Snd.duck(0.3, 1.2) }
    G.fallFrom.t += DT
  } else if (!wasAir && G.fallFrom) {
    const d = G.fallFrom.y - b.p[1]
    if (d > 4) { why(t('fell').replace('N', Math.round(d))); G.shake = Math.max(G.shake, Math.min(1.2, 0.4 + d / 20)); flash('bad'); Snd.play('land', { vol: 1 }); Snd.play('clank', { vol: 0.6 }); if (b.cn[0]) dust.emit(b.cn[0].q, 24, 4) }
    G.fallFrom = null
  }
  if (j.respawn) { if (j.net) why(c.lavaKill != null && b.p[1] < c.lavaKill ? t('lava') : t('net')); respawn(j.respawn, false) }
  G.maxAlt = Math.max(G.maxAlt, b.p[1])
  tutorialStep(inp)
}
function stepGhost() {
  const gh = G.ghost
  while (gh.ev.length && gh.ev[0].s === gh.i) { const e = gh.ev.shift(); gh.bike = ghostSpawn(e) }
  const inp = gh.rec[gh.i]
  if (!inp) return
  gh.prevSnap = snap(gh.bike)
  stepBike(G.world, gh.bike, inp)
  gh.i++
}
function finish() {
  G.state = 'result'
  Snd.play('finish', { vol: 0.7 })
  const id = G.course.id, prev = G.best[id]
  const nb = !prev || G.time < prev.time
  if (nb) { G.best[id] = { time: G.time, faults: G.faults, hard: !!G.R.hard, rec: pack(G.rec.inp), ev: G.rec.ev }; try { localStorage.setItem('sky-best6', JSON.stringify(G.best)) } catch (e) {} }
  const m = MEDAL[id], mi = G.time <= m[0] && G.faults === 0 ? 0 : G.time <= m[1] ? 1 : G.time <= m[2] ? 2 : 3
  $('rCourse').textContent = t(CNAME[id])
  $('rTime').textContent = fmt(G.time); $('rFaults').textContent = G.faults; $('rBest').textContent = fmt(G.best[id].time) + (nb && prev ? '  ' + t('newBest') : '')
  const st = $('rMedal'); st.textContent = t('medal')[mi]; st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop')
  $('rNext').hidden = id !== 'practice'
  const txt = lang === 'ja' ? `SKY BIKE「${t(CNAME[id])}」を ${fmt(G.time)}（フォルト ${G.faults}）で登りきった` : `Reached the castle in ${fmt(G.time)} (${G.faults} faults) - ${t(CNAME[id])}`
  $('rShare').href = 'https://x.com/intent/post?text=' + encodeURIComponent(txt + ' #SKYBIKE') + '&url=' + encodeURIComponent('https://tom3games.com/play/sky-bike/')
  setTimeout(() => { if (G.state === 'result') { show('result'); $('hud').hidden = false } }, 900)
  refreshBest()
}

// ------------------------------------------------------------ チュートリアル（第1面の序盤で1つずつ。やったら消える）
const TUT_KEY = { thr: '↑', back: '←', fwd: '→', air: '← →', brk: '↓', climb: '← → ↑' }
function tutorialStep(inp) {
  const T = G.tut, c = G.course
  if (!T || !c.tuts || !c.tuts.length || G.bot) return
  const b = G.bike, si = G.steer ? G.steer.i : 0
  if (T.on) {
    const q = T.on
    let done = false
    if (q.key === 'thr') done = inp.thr > 0 && b.speed > 2.5
    if (q.key === 'back') { T.hold = inp.lean < -0.4 ? T.hold + 1 : 0; done = T.hold > 10 || si > q.i + 10 }
    if (q.key === 'fwd') { T.hold = inp.lean > 0.4 ? T.hold + 1 : 0; done = T.hold > 10 || si > q.i + 14 }
    if (q.key === 'air') { if (!b.g[0] && !b.g[1] && si > q.i) T.air = true; done = (T.air && b.g[0] && b.g[1]) || si > q.i + 30 }
    if (q.key === 'climb') done = !!b.hook || si > q.i + 16
    if (q.key === 'brk') { T.hold = inp.brk > 0 ? T.hold + 1 : 0; done = T.hold > 6 || si > q.i + 18 }
    if (done) { T.on = null; T.k++; T.hold = 0; T.air = false; $('tut').classList.remove('on'); if (T.k >= c.tuts.length) { try { localStorage.setItem('sky-tut-done', '1') } catch (e) {} } }
    return
  }
  const q = c.tuts[T.k]
  if (q && si >= q.i - 3) {
    T.on = q
    $('tutKey').innerHTML = isTouch ? `<svg viewBox="0 0 48 48">${$('tb-' + (q.key === 'air' || q.key === 'climb' ? 'back' : q.key)).innerHTML}</svg>` : TUT_KEY[q.key]
    $('tutTxt').textContent = t('t_' + q.key)
    $('tut').classList.add('on')
  }
}

// ------------------------------------------------------------ カメラ（道の線に沿って、曲がる外側の斜め後ろ・やや上から）
const _v = new THREE.Vector3(), _t = new THREE.Vector3()
function pathAhead(i, n) { const p = G.course.path; let s = 0, k = 0; for (let j = i; j < Math.min(p.length, i + n); j++) { if (p[j].curv) { s += p[j].curv; k++ } } return k ? s / n : 0 }
function updateCamera(dt, alpha) {
  const b = G.bike
  if (!b) return
  const bp = G.prev ? new THREE.Vector3(G.prev.p[0] + (b.p[0] - G.prev.p[0]) * alpha, G.prev.p[1] + (b.p[1] - G.prev.p[1]) * alpha, G.prev.p[2] + (b.p[2] - G.prev.p[2]) * alpha) : new THREE.Vector3(...b.p)
  const air = !b.g[0] && !b.g[1]
  const path = G.course.path, si = G.steer ? G.steer.i : 0
  // 向き: 少し先の道の向き（曲がり角でバイクより先に回る）。空中・転倒中は止める
  const ah = path[Math.min(path.length - 1, si + 5)]
  if (!air && !b.crashed && ah && ah.yaw != null) { let tgt = Math.abs(b.speed) < 0.5 ? b.psi : ah.yaw; let d = tgt - G.camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); G.camYaw += d * Math.min(1, dt * 2.2) }
  // 曲がる外側にカメラを置く（左へ曲がる道なら右）。まっすぐな所では前の側を保つ
  const cv = pathAhead(si, 18)
  if (Math.abs(cv) > 0.012) G.camSideT = cv > 0 ? 1 : -1
  G.camSide += ((G.camSideT ?? 1) - G.camSide) * Math.min(1, dt * 1.2)
  let ang = 0.62 + (air ? Math.min(0.3, b.airT * 0.4) : 0)
  G.camAng = G.camAng == null ? ang : G.camAng + (ang - G.camAng) * Math.min(1, dt * 1.8)
  const a = G.camYaw + Math.PI + G.camSide * G.camAng
  const dist = 6.4, hgt = 2.7
  const hx = Math.cos(G.camYaw), hz = -Math.sin(G.camYaw)
  let lookUp = 0
  const ah2 = path[Math.min(path.length - 1, si + 9)]; if (ah2 && ah2.p) lookUp = Math.max(-1.5, Math.min(3, ah2.p[1] + 0.8 - bp.y))
  G.lookUp = (G.lookUp || 0) + (lookUp - (G.lookUp || 0)) * Math.min(1, dt * 2)
  _t.set(bp.x + hx * 2.6, bp.y + 0.35 + Math.max(-0.3, G.lookUp * 0.6), bp.z + hz * 2.6)
  _v.set(bp.x + Math.cos(a) * dist, bp.y + hgt + Math.max(0, G.lookUp) * 0.2, bp.z - Math.sin(a) * dist)
  if (G.fallFrom) {
    // 落ちている間: バイクの斜め上（横に 8m 以内）からついていき、下の着地点が見えるように見下ろす
    _v.copy(G.camPos); const dx = _v.x - bp.x, dz = _v.z - bp.z, dh = Math.hypot(dx, dz)
    if (dh > 8) { _v.x = bp.x + dx / dh * 8; _v.z = bp.z + dz / dh * 8 }
    _v.y += (bp.y + 5 - _v.y) * Math.min(1, dt * 4); _t.set(bp.x, bp.y - 2.5, bp.z)
  }
  else {
    // 壁・塔に埋まらないように手前へ（隠れ判定はバイクの胸の高さから）
    const o = [bp.x, bp.y + 1.0, bp.z]
    const dir = [_v.x - o[0], _v.y - o[1], _v.z - o[2]], L = Math.hypot(...dir)
    const ids = G.world.near(o[0], o[1], o[2], L + 1).slice().filter(id => !['gate', 'sign', 'post', 'web', 'flange', 'rail', 'barrel', 'pillar', 'statue'].includes(G.world.shapes[id].tag))
    const hit = G.world.ray(o, dir.map(v => v / L), L, ids)
    if (hit < L) { const k2 = Math.max(2.6, hit - 0.4) / L; _v.set(o[0] + dir[0] * k2, o[1] + dir[1] * k2 + (1 - k2) * 1.4, o[2] + dir[2] * k2) }
  }
  if (isNaN(G.camPos.x)) { G.camPos.copy(_v); G.camTgt.copy(_t) }
  G.camPos.lerp(_v, Math.min(1, dt * 6)); G.camTgt.lerp(_t, Math.min(1, dt * 9))
  camera.position.copy(G.camPos)
  if (G.shake > 0) { camera.position.x += (Math.random() - 0.5) * G.shake * 0.3; camera.position.y += (Math.random() - 0.5) * G.shake * 0.3; G.shake = Math.max(0, G.shake - dt * 2.2) }
  camera.lookAt(G.camTgt)
  const sp = Math.abs(b.speed)
  G.fov += (56 + Math.min(12, Math.max(0, sp - 8) * 0.6) - G.fov) * Math.min(1, dt * 3)
  camera.fov = G.fov + (innerWidth < innerHeight ? 16 : 0); camera.updateProjectionMatrix()
  aimLights(bp)
}
// 月の影の範囲・霧・松明の光を、見ている所に合わせる
function aimLights(p) {
  moon.position.set(p.x + MOON.x * 90, p.y + MOON.y * 90, p.z + MOON.z * 90); moon.target.position.copy(p)
  const y = camera.position.y, c = G.course
  // 低い所は溶岩の照り返しで少し赤く、上の氷の区間は青白く。霧は今より下ほど濃い（下の周が沈む）
  const lava = c.lavaY != null ? Math.max(0, Math.min(1, 1 - (y - (c.lavaY ?? -8)) / 45)) : 0
  // 区間ごとの霧の色・濃さ・空の明るさ（墓所は暗く松明だけ、工場は錆の煙、鐘楼は暖かく、氷と嵐は青白い）。今いる道の点の区間へゆっくり寄せる
  const zq = c.path[(G.steer && G.bike ? G.steer.i : G.titleI) || 0], zp = ZONEP[(zq && zq.zone) || 'ruin'] || ZONEP.ruin
  const zk = Math.min(1, 0.03 + (G._zdt || 0) * 1.5); G._zdt = 0
  G.zl = G.zl || { tint: 0, hemi: 1.35, dens: 0, col: new THREE.Color(fogBase) }
  G.zl.col.lerp(_c1.setHex(zp.col), zk); G.zl.tint += (zp.tint - G.zl.tint) * zk; G.zl.hemi += (zp.hemi - G.zl.hemi) * zk; G.zl.dens += (zp.dens - G.zl.dens) * zk
  scene.fog.color.copy(fogBase).lerp(_c1.setHex(0x5a3b2c), lava * 0.55).lerp(G.zl.col, G.zl.tint)
  scene.fog.near = 0.0125 + G.zl.dens - Math.max(0, y - 200) * 0.00004
  scene.fog.far = y - 9
  hemi.intensity = G.zl.hemi
  scene.environmentIntensity = 0.8 * Math.min(1, G.zl.hemi / 1.35) // 暗い区間（墓所）は空の照り返しも弱く。松明の灯りだけで道を読む
  hemi.groundColor.setHex(0x2a2520).lerp(_c1.setHex(0x6a2a10), lava * 0.6)
  sky.position.copy(camera.position)
  // 近い火に光を付ける（近い順）
  const pts = built.flamePts
  if (pts && pts.length) {
    if (!G._lt || G._lt-- <= 0) { G._lt = 6; G._near = pts.map((q, i) => [i, (q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 * 1.5 + (q[2] - p.z) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, torchLights.length); G.nearFire = G._near.length ? Math.sqrt(G._near[0][1]) : 99 }
    const tm = performance.now() / 1000
    torchLights.forEach((l, k) => { const n = G._near && G._near[k], q = n && pts[n[0]]; if (!q) { l.intensity = 0; return } l.position.set(q[0], q[1] + 0.2, q[2]); l.intensity = (q[3] === 1 ? 22 : 13) * (0.85 + 0.12 * Math.sin(tm * 11 + k * 2.1) + 0.06 * Math.sin(tm * 27 + k)) })
  }
  let nc = 99; for (const q of G.creakPts || []) { const d = Math.hypot(q[0] - p.x, q[1] - p.y, q[2] - p.z); if (d < nc) nc = d } G.nearChain = nc
}
const _c1 = new THREE.Color()

// 灰（ゆっくり降る）と火の粉（下ほど多い）
const ash = (() => {
  const N = lowEnd ? 350 : 800, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), kind = new Float32Array(N)
  for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() - 0.5) * 50; pos[i * 3 + 1] = (Math.random() - 0.5) * 30; pos[i * 3 + 2] = (Math.random() - 0.5) * 50; kind[i] = Math.random() < 0.08 ? 1 : 0 }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('kind', new THREE.BufferAttribute(kind, 1))
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { ember: { value: 0.3 } },
    vertexShader: 'attribute float kind; varying float vK; varying float vD; void main(){ vK = kind; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = -mv.z; gl_PointSize = (kind > 0.5 ? 70.0 : 55.0) / -mv.z + 0.8; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float ember; varying float vK; varying float vD; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float f = smoothstep(0.5, 0.1, d) * smoothstep(40.0, 6.0, vD); if (vK > 0.5) gl_FragColor = vec4(vec3(2.6, 1.0, 0.3) * ember, f * ember); else gl_FragColor = vec4(0.62, 0.64, 0.6, f * 0.55); }' })
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.name = 'ash'; scene.add(pts)
  return {
    update(dt, cam, tm) {
      const lavaK = G.course && G.course.lavaY != null ? Math.max(0.15, Math.min(1, 1 - (cam.y - G.course.lavaY) / 40)) : 0.2
      mat.uniforms.ember.value = lavaK
      for (let i = 0; i < N; i++) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2]
        if (kind[i] > 0.5) { y += dt * 1.1; x += Math.sin(tm * 2 + i) * dt * 0.4 } else { y -= dt * (0.35 + (i % 7) * 0.05); x += Math.sin(tm * 0.6 + i * 0.37) * dt * 0.35; z += Math.cos(tm * 0.5 + i * 0.21) * dt * 0.3 }
        const dx = x - cam.x, dy = y - cam.y, dz = z - cam.z
        if (dx > 25) x -= 50; else if (dx < -25) x += 50
        if (dy > 15) y -= 30; else if (dy < -15) y += 30
        if (dz > 25) z -= 50; else if (dz < -25) z += 50
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      }
      geo.attributes.position.needsUpdate = true
    },
  }
})()

// 土ぼこり（後輪が回って土の上・着地）
const dust = (() => {
  const N = 140, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), al = new Float32Array(N)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1))
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { col: { value: new THREE.Color(0x6a6660) } }, vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (1.0 - alpha) * 260.0 / -mv.z + 6.0; gl_Position = projectionMatrix * mv; }', fragmentShader: 'uniform vec3 col; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(col, vA * 0.45 * (1.0 - d * 2.0)); }' })
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
  const P = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0 }))
  let k = 0
  return {
    emit(p, n, spd) { for (let i = 0; i < n; i++) { const q = P[k = (k + 1) % N]; q.p.set(p[0], p[1] + 0.05, p[2]); q.v.set((Math.random() - 0.5) * spd, Math.random() * spd * 0.6, (Math.random() - 0.5) * spd); q.life = 1 } },
    update(dt) { for (let i = 0; i < N; i++) { const q = P[i]; if (q.life > 0) { q.life -= dt * 1.4; q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 2) } pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; al[i] = Math.max(0, q.life) } geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true },
  }
})()

// ------------------------------------------------------------ 画面の数字
function hud() {
  const b = G.bike, c = G.course
  $('tm').textContent = fmt(G.time)
  const top = c.cps[c.cps.length - 1].p[1] + 2, bot = Math.min(c.cps[0].p[1], c.lavaY ?? c.cps[0].p[1])
  const pos = y => Math.max(0, Math.min(1, (y - bot) / Math.max(1, top - bot))) * 100 + '%'
  $('altMe').style.bottom = pos(b.p[1])
  const h = Math.round(b.p[1] - 0.79 - c.cps[0].p[1])
  if (G.running && (G.bestAlt == null || h > G.bestAlt)) G.bestAlt = Math.max(h, G.bestAlt ?? 0)
  if (G.bestAlt != null) { const e = $('altBest'); e.style.display = 'block'; e.style.bottom = pos(G.bestAlt + c.cps[0].p[1]); e.dataset.v = t('best_alt') + ' ' + G.bestAlt + 'm' }
  $('altNum').textContent = h + 'm'
  if (G.fallFrom) $('altNum').textContent = '-' + Math.max(0, Math.round(G.fallFrom.y - b.p[1])) + 'm'
}
function saveAlt() { try { if (G.course && G.bestAlt != null) { const k = 'sky-alt5-' + G.course.id, o = +localStorage.getItem(k) || 0; if (G.bestAlt > o) localStorage.setItem(k, G.bestAlt) } } catch (e) {} }
setInterval(saveAlt, 5000)
// ------------------------------------------------------------ 主ループ（物理は固定 60Hz）
let last = performance.now(), frames = 0, fpsT = 0
G.fps = 0
function frame(now) {
  requestAnimationFrame(frame)
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  frames++; fpsT += dt; if (fpsT > 1) { G.fps = frames / fpsT; frames = 0; fpsT = 0 }
  if (G.state === 'play' && !G.paused && !G.hold) dt = advance(dt)
  const alpha = G.state === 'play' ? Math.min(1, G.acc / DT) : 1
  if (G.bike && bikeView) {
    bikeView.sync(G.bike, G.prev, alpha)
    const b = G.bike
    if (G.state === 'play' && b.g[0] && b.cn[0] && G.inp.thr > 0 && Math.abs(b.speed) < 12) { const mt = G.world.shapes[b.cn[0].id].mat; if (mt === 'basalt' || mt === 'snowrock' || mt === 'cobble' || mt === 'dirt' || mt === 'rock') dust.emit(b.cn[0].q, 1, 1.6) }
    if (b._landDust !== b.steps && b.cn[0] && b.airT === 0 && G.shake > 0.3) { dust.emit(b.cn[0].q, 10, 3); b._landDust = b.steps }
  }
  if (G.ghost && G.ghostView) { const gh = G.ghost; G.ghostView.root.visible = gh.i < gh.rec.length; if (gh.bike) G.ghostView.sync(gh.bike, gh.prevSnap, alpha) }
  dust.update(dt)
  const tm = now / 1000
  if (built) {
    if (built.late && window.__skyReady) { const f = built.late; built.late = null; f() }
    else if (built.more && window.__skyReady && !built.moreDone) { if (!built.more()) built.moreDone = true }
    // 高さが離れた区間のメッシュは描かない（霧で見えない所）
    { const cy = camera.position.y; for (const m of built.group.children) { const yr = m.userData.yr; if (yr) m.visible = cy > yr[0] - 90 && cy < yr[1] + 140 } }
    if (built.movers.length) updateMovers(built.movers, G.world)
    { let ry = null; const R = G.R; if (R && R.rise && G.course.risers) G.course.risers.forEach((rs, k) => { const t0 = R.rise[k]; if (t0 != null && t0 >= 0) ry = riserY(rs, G.world.time - t0) }); built.riser.visible = ry != null; if (ry != null) built.riser.position.y = ry }
    if (G.gim && G.world) for (const e of G.gim.update(G.world, G.state === 'play' ? G.bike : null, Math.min(dt, 0.05), tm, G.R, camera.position)) {
      const d = Math.hypot(camera.position.x - e.p[0], camera.position.y - e.p[1], camera.position.z - e.p[2]), v = Math.max(0, 1 - d / 45)
      if (v <= 0) continue
      if (e.t === 'splash') Snd.play('splash', { vol: 0.8 })
      if (e.t === 'rockWarn') Snd.play('pebbles', { vol: v * 0.8 })
      if (e.t === 'rockFall') Snd.play('rockfall', { vol: v * 0.9 })
      if (e.t === 'rockHit') { Snd.play('rockbreak', { vol: v }); if (d < 14) G.shake = Math.max(G.shake, 0.3 * v) }
    }
    updateFlames(built.flames, tm)
    built.lava.material.uniforms.time.value = tm
    for (const m of built.fogL.mats) { m.uniforms.time.value = tm; m.uniforms.camY.value = camera.position.y }
  }
  sky.material.uniforms.time.value = tm
  grade.uniforms.time.value = tm % 100
  if (bikeView && G.world) bikeView.updateRider(Math.min(dt, 0.05), G.world)
  if (G.state === 'play' || G.state === 'pause' || G.state === 'result') { updateCamera(dt, alpha); if (G.state !== 'result') hud() }
  else if (G.state !== 'debug') titleCam(tm)
  ash.update(Math.min(dt, 0.05), camera.position, tm)
  soundUpdate(dt)
  if (G.noPost) renderer.render(scene, camera); else composer.render(dt)
}
function advance(dt) {
  if (G.hitStop > 0) { G.hitStop -= dt; dt *= 0.15 }
  else if (G.slowMo > 0) { G.slowMo -= dt; dt *= 0.35 }
  G.acc += dt * (G.ff || 1)
  let n = 0
  while (G.acc >= DT - 1e-9 && n < 5 * (G.ff || 1)) { fixedStep(); G.acc -= DT; n++; if (G.state !== 'play') break }
  if (n >= 5 * (G.ff || 1)) G.acc = 0
  return dt
}
// タイトル: コンセプト画 B と同じ構図。廃墟の右回りの張り出しを、外側の斜め後ろ・上から見る（右に塔、左に霧の谷）
function titleShot() { return titleIndex(G.course) }
function titleCam(tm) {
  if (!G.course) return
  const p = G.course.path, i = G.titleI ?? (G.titleI = titleShot()), q = p[i], a = p[Math.min(p.length - 1, i + 16)]
  const yaw = q.yaw, hx = Math.cos(yaw), hz = -Math.sin(yaw), rx = Math.sin(yaw), rz = Math.cos(yaw)
  const sway = Math.sin(tm * 0.12) * 0.5
  const side = -1 // 右回りの区間なので、塔は右、カメラは外側（左）
  camera.position.set(q.p[0] - hx * 7.5 + rx * side * (5.5 + sway), q.p[1] + 5.8, q.p[2] - hz * 7.5 + rz * side * (5.5 + sway))
  camera.lookAt(a.p[0] + rx * side * 3.5, a.p[1] - 0.9, a.p[2] + rz * side * 3.5)
  camera.fov = innerWidth < innerHeight ? 72 : 56; camera.updateProjectionMatrix()
  if (bikeView && !G.bike) {
    if (!G.titleBike) { const b = createBike({ p: [q.p[0], q.p[1] + 0.79, q.p[2]], yaw }); for (let k = 0; k < 30; k++) stepBike(G.world, b, { thr: 0, brk: 1, lean: 0, steer: 0 }); G.titleBike = b }
    bikeView.root.visible = true; bikeView.sync(G.titleBike, null, 1)
  }
  aimLights(camera.position.clone().addScaledVector(new THREE.Vector3(hx, 0, hz), 6).setY(q.p[1]))
  // 月をタイトルの場面の左上に（一度だけ。以後は同じ向きのまま空と一緒に動く）
  const mo = sky.getObjectByName('moon')
  // タイトルの場面の左の中ほどに、浮いた廃墟の島と鎖の橋を置く（カメラから見た位置で決める。道からは離す）
  if (G.course.tower && !built.tis) {
    camera.updateMatrixWorld()
    const cands = []
    for (const [sx, sy, dist] of [[-0.6, 0.05, 46], [-0.55, 0.1, 52], [-0.65, 0.0, 58], [-0.5, 0.12, 64], [-0.7, 0.05, 70], [-0.45, 0.15, 76]]) { const d = new THREE.Vector3(sx, sy, 0.5).unproject(camera).sub(camera.position).normalize(); cands.push(camera.position.clone().addScaledVector(d, dist).toArray()) }
    const tis = buildTitleIsland(G.course, scene, built.M, cands)
    built.tis = tis.group || true; if (tis.group) built.objs.push(tis.group)
    if (tis.chains.length) { const ch = buildChains({ decor: tis.chains.map(q => ({ kind: 'chain', ...q })), plats: [], shapes: [], path: [] }, scene, built.M); if (ch) built.objs.push(ch) }
    if (tis.flames.length) { const fl = buildFlames(scene, tis.flames, built.M); built.objs.push(fl.group); built.flames.list.push(...fl.list); built.flamePts.push(...tis.flames) }
  }
  if (mo && G.course.tower && !G.moonSet) { camera.updateMatrixWorld(); const d = new THREE.Vector3(-0.52, 0.7, 0.5).unproject(camera).sub(camera.position).normalize(); mo.position.copy(d).multiplyScalar(1500); mo.visible = true; G.moonSet = true }
}

// ------------------------------------------------------------ 画面のボタン
document.querySelectorAll('.course').forEach(b => b.addEventListener('click', () => { startAudio(); Snd.play('gate', { vol: 0.25, rate: 0.7 }); startRun(b.dataset.course) }))
$('howBtn').onclick = () => show('how')
$('howClose').onclick = () => { if (G.state === 'pause') show('pause'); else show('title') }
$('langBtn').onclick = () => { lang = lang === 'ja' ? 'en' : 'ja'; try { localStorage.setItem('sky-lang', lang) } catch (e) {} applyLang() }
$('hardBtn').onclick = () => { G.hard = !G.hard; try { localStorage.setItem('sky-hard', G.hard ? '1' : '0') } catch (e) {} applyLang() }
$('muteBtn').onclick = () => { startAudio(); Snd.setMute(!Snd.muted); try { localStorage.setItem('sky-mute', Snd.muted ? '1' : '0') } catch (e) {} applyLang() }
$('rRetry').onclick = () => startRun(G.course.id)
$('rNext').onclick = () => startRun('stage1')
$('rMenu').onclick = toMenu
$('pResume').onclick = togglePause
$('pRestart').onclick = () => startRun(G.course.id)
$('pHow').onclick = () => show('how')
$('pMenu').onclick = toMenu
$('bCp').onclick = () => retryCp(true)
$('bMenu').onclick = togglePause
function toMenu() { G.state = 'title'; G.bike = null; $('tut').classList.remove('on'); if (G.ghostView) G.ghostView.root.visible = false; show('title'); if (G.course.id !== 'stage1') loadCourse('stage1') }

// ------------------------------------------------------------ 起動（最初の画面に要る物だけ待つ。模型・環境光・乗り手はあとから）
async function boot() {
  const fill = $('ldFill')
  applyLang()
  loadCourse('stage1'); fill.style.width = '45%'
  bikeView = new BikeView(scene)
  bikeView.root.visible = false
  await new Promise(r => setTimeout(r, 30))
  renderer.compile(scene, camera); fill.style.width = '100%'
  G.state = 'title'; show('title')
  window.__skyReady = true
  if (Q.get('course')) startRun(Q.get('course'))
  // 後から読む物
  bikeView.loadRider('assets/models/Rider.glb').catch(e => console.warn('rider', e))
  loadEnv(); loadProps(); loadBackdrop()
}
G.startRun = startRun
G.api = { buildAll: () => { if (built && built.late) { const f = built.late; built.late = null; f() } while (built && built.more && built.more()); if (built) built.moreDone = true }, closest: (s, x, y, z) => { const o = closest(s, x, y, z, { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); return { d: o.d } }, advance, loadCourse, DT, stepBike, hashBike, createBike, World, BIKE, basis, wheelCenter, scene, camera, renderer, three: THREE, get built() { return built }, get bikeView() { return bikeView }, fixedStep, spawnAt, retryCp, placeBike, toast, setLang: l => { lang = l; applyLang() } }
requestAnimationFrame(frame)
boot()
