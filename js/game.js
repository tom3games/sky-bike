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
import { buildGimmicks } from './gimmicks.js?v=46'
import { DT, World, createBike, stepBike, basis, hashBike, BIKE, wheelCenter, closest } from './physics.js?v=46'
import { COURSES } from './course.js?v=46'
import { buildCourse, buildDecor, buildMountains, buildChains, buildUnderRocks, buildFloaters, buildGrass, buildTitleIsland, buildCards, buildLava, buildFogLayers, buildFlames, updateFlames, buildSigns, buildSky, setAniso, updateMovers, updateLOD, buildValley, buildCrown, buildSupportDecor, FOG_FACTOR, PAL } from './view.js?v=46'
import { BikeView, snap } from './bikeview.js?v=46'
import { createBot, botInput, resetBot } from './bot.js?v=46'
import { judge, doRespawn, spawnAtCp, riserY } from './run.js?v=46'
import { createSteer, steerFor, resetSteer, assist } from './steer.js?v=46'
import { Birds } from './birds.js?v=46'
import { crowPush } from './strike.js?v=46'
import { buildV35, hankieDataURL } from './v35view.js?v=46'
import { buildV36 } from './v36view.js?v=46'
import { buildLady } from './lady.js?v=46'
import { buildBoulder } from './v41view.js?v=46'
import { buildMotes } from './motes.js?v=46'
import { buildMurals } from './murals.js?v=46'
import { buildV37 } from './v37view.js?v=46'
import { doorAng } from './traps.js?v=46'
import { resetDrums } from './physics.js?v=46'

window.__jsUp = true
const $ = id => document.getElementById(id)
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window
if (isTouch) document.documentElement.classList.add('touchui')
const Q = new URLSearchParams(location.search)

// ------------------------------------------------------------ 高さで変わる霧（three の霧の部品を差し替える）
// THREE.Fog の near を「濃さ」、far を「霧が薄くなり始める高さ」として使う。低い所ほど濃い（下の道が霧に沈む）。
// v16 広い世界: 遠くまで指数で効き、最大 0.93 で止める（次の塔・来た道の影が霧の中に残る）
THREE.ShaderChunk.fog_pars_vertex = '#ifdef USE_FOG\n varying float vFogDepth; varying vec3 vFogW;\n#endif'
THREE.ShaderChunk.fog_vertex = '#ifdef USE_FOG\n vFogDepth = - mvPosition.z; vFogW = (inverse(viewMatrix) * mvPosition).xyz;\n#endif'
THREE.ShaderChunk.fog_pars_fragment = '#ifdef USE_FOG\n uniform vec3 fogColor; varying float vFogDepth; varying vec3 vFogW;\n #ifdef FOG_EXP2\n uniform float fogDensity;\n #else\n uniform float fogNear; uniform float fogFar; uniform float fogTime;\n #endif\n#endif'
// v43 霧をゆっくり流す: 霧の式の濃さに、時間で流れる模様を掛ける。時間はすべての材料で同じ物を共有する（Material の既定の onBeforeCompile で配る）
const FOGT = { value: 0 }
THREE.Material.prototype.onBeforeCompile = function (sh) { sh.uniforms.fogTime = FOGT }
THREE.ShaderChunk.fog_fragment = `#ifdef USE_FOG
 #ifdef FOG_EXP2
  float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
 #else
  ${FOG_FACTOR}
 #endif
 gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, clamp( fogFactor, 0.0, 1.0 ) );
#endif`

// ------------------------------------------------------------ 言葉（日英）
const TXT = {
  ja: { loading: '塔へ向かう', kicker: '奈落の底から、雲の上の城まで。', c_practice: '練習場', c_stage1: '登る', c_stage1_sub: '第1面 奈落から天空へ', how: '遊び方', sound_on: '音 あり', sound_off: '音 なし', how_lead: 'ハンドルは自動で道をなぞる。操るのはアクセル・ブレーキ・体重の前後・ニトロだけ。PC はマウスでカメラも回せる。', k_thr: 'アクセル', k_brk: 'ブレーキ（止まると下がる）', k_back: '後ろ体重', k_fwd: '前体重', k_nit: 'ニトロ（押すだけで全開。旗と燃料の缶で満タン）', k_cam: 'カメラ（クリックでマウスを固定・Esc で外す）', kc_thr: '左クリック / ↑', kc_brk: '右クリック / ↓ / S', kc_cam: 'マウス', k_cp: '休憩所からやり直す', k_pause: '一時停止', tip1: '段の前は後ろ体重で前輪を上げ、乗ったら前体重', tip2: '登りは前体重、下りは後ろ体重', tip3: '空中は体重で車体を着地の坂に合わせる', tip4: '曲がる前はブレーキ。速すぎると外へふくらむ', tip5: '後ろ体重のあとすぐ前体重で、車体が跳ねる', tip6: '止まっている時・ゆっくり惰性の時は、後ろ体重だけで前輪が上がる（約33度で止まる）。前体重だけで前輪で立つ（約22度。ブレーキも押すと約32度）', tip7: '回りすぎ・頭から落ちると転んで、最後に通った休憩所の旗から。道の外へ落ちたら着いた所から登り直し（深く落ちたら旗から）', tip8: '高い縁は ゆっくり近づき 後ろ体重＋アクセルで前輪を掛け、ブレーキで耐え、前体重＋アクセルで登る', tip9: '扉は速さで破る。シーソーはゆっくり。ひびの入った床は速さで越える', tip10: '猿に追われたら、ニトロ・ウィリー・ジャンプ台で引き離す', tip11: '油の上は何も押さずに惰性で抜ける。落とし扉はきしむ音のあと開く', tip12: '鉄骨は影が濃くなると落ちる。回る筒の中はアクセルを入れたまま', tip13: '風車は羽根に乗ると回り、上で止まったら降りる。綱渡りは横風の合間に', logo_sub: '崩れた塔を、雲の上まで', t_climb: '高い縁: 後ろ体重＋アクセルで掛け、前体重＋アクセル', cr: [['t', 'SKY BIKE'], ['img', '作者のとも'], ['h', '作った人'], ['', 'とも（ひまつぶし横丁）'], ['', 'X @ktomo_dev'], ['h', 'ほかのゲーム'], ['', 'tom3games.com'], ['h', '声'], ['', 'とも'], ['h', '音楽'], ['', 'とも'], ['h', '素材'], ['', 'カラス: Crow / Poly by Google（CC BY 3.0）'], ['', '火の音: Work With Sounds / La Fonderie（CC BY 4.0）'], ['', 'ほか CC0 の素材（Poly Haven・Quaternius・Kenney ほか）'], ['end', '遊んでくれてありがとう']], credit: '素材: Poly Haven・Quaternius・Kenney ほか（CC0）。火の音: Work With Sounds / La Fonderie（CC BY 4.0）。カラス: Poly by Google（CC BY 3.0）。一覧は CREDITS.md', back: 'もどる', faults: 'フォルト', arrived: '到着', time: '時間', best: '自己ベスト', retry: 'もう一回', next: '登る', share: 'Xでポスト', menu: 'メニュー', paused: '一時停止', resume: '続ける', restart: '最初から', why_head: '頭を打った', why_back: '後ろへ回りすぎた', why_front: '前へ回った', why_body: '体が当たった', why_hard: '着地が強すぎ', why_belly: '車体の下を強く打った', why_fall: '落ちた', medal: ['金', '銀', '銅', '完走'], newBest: '自己ベスト更新', rest: 'セーブした', fell: 'Nm 落ちた', net: '休憩所に戻った', lava: '溶岩に落ちた', best_alt: '最高', hard_on: 'ハードコア 入', hard_off: 'ハードコア 切', t_thr: 'アクセル', t_back: '段の前は 後ろ体重', t_fwd: '登りは 前体重', t_air: '空中は体重で角度を合わせる', t_brk: '曲がる前は ブレーキ', why_boulder: '岩にはね飛ばされた', why_monkey: 'はたき落とされた', story0: '兄は、ここへ行くと言って帰ってこなかった。', letter: '先に行く。お前なら来ると思った。', items: '持ち物', hankie: '黄ばんだハンカチ', ly: ['何しにきたの？', 'お兄さんがここに？', '……イケメンなら覚えてたんだけどね。', 'ホクロのでかい男ならきたわよ。'], hm: ['よお、こんなところで何してんだ。', 'よく見たら汚ねえ顔してんな。', 'これで顔拭けや。'], hmGot: '黄ばんだハンカチを貰った。', tapNext: 'タップ / クリックで次へ', keys: '<b>左クリック</b>アクセル <b>右クリック</b>ブレーキ <b>A</b>後ろ体重 <b>D</b>前体重 <b>W</b>ニトロ <b>マウス</b>カメラ <i></i><b>R</b>休憩所へ <b>Esc</b>止める' },
  en: { loading: 'Heading to the tower', kicker: 'From the abyss to the castle above the clouds.', c_practice: 'Practice Yard', c_stage1: 'Climb', c_stage1_sub: 'Stage 1: Abyss to the Sky', how: 'How to play', sound_on: 'Sound on', sound_off: 'Sound off', how_lead: 'Steering is automatic. You only control throttle, brake, leaning back or forward, and nitro. On PC the mouse turns the camera.', k_thr: 'Throttle', k_brk: 'Brake (reverse when stopped)', k_back: 'Lean back', k_fwd: 'Lean forward', k_nit: 'Nitro (full throttle on its own; refill at flags and fuel cans)', k_cam: 'Camera (click to lock the mouse, Esc to release)', kc_thr: 'Left click / ↑', kc_brk: 'Right click / ↓ / S', kc_cam: 'Mouse', k_cp: 'Back to rest point', k_pause: 'Pause', tip1: 'Lean back to lift the front onto a step, then lean forward', tip2: 'Lean forward going up, back going down', tip3: 'In the air, lean to match the landing slope', tip4: 'Brake before corners. Too fast and you run wide', tip5: 'Lean back then quickly forward to hop', tip6: 'Stopped or rolling slowly, just lean back to lift the front (holds at about 33°). Just lean forward to stand on the front wheel (about 22°, about 32° with the brake)', tip7: 'Loop out or land on your head and you restart from the last rest flag. Fall off and you climb from where you land (fall too far and it is the flag)', tip8: 'Tall ledge: creep up, lean back + throttle to hook the front wheel, hold the brake, then lean forward + throttle to climb', tip9: 'Smash doors with speed. Ride seesaws slowly. Keep your speed over cracking floors', tip10: 'Chased by monkeys? Nitro, a wheelie or a kicker jump shakes them off', tip11: 'On oil, press nothing and coast. Trapdoors creak just before they open', tip12: 'A girder drops when its shadow darkens. Keep the throttle on inside the drum', tip13: 'Ride a windmill blade up and step off when it stops. Cross the cable between gusts', logo_sub: 'Ride the ruined tower above the clouds', t_climb: 'Tall ledge: lean back + throttle to hook, lean forward + throttle', cr: [['t', 'SKY BIKE'], ['img', 'Tomo, the maker'], ['h', 'Made by'], ['', 'Tomo (Himatsubushi Yokocho)'], ['', 'X @ktomo_dev'], ['h', 'More games'], ['', 'tom3games.com'], ['h', 'Voice'], ['', 'Tomo'], ['h', 'Music'], ['', 'Tomo'], ['h', 'Assets'], ['', 'Crow: Crow / Poly by Google (CC BY 3.0)'], ['', 'Fire sound: Work With Sounds / La Fonderie (CC BY 4.0)'], ['', 'Other CC0 assets (Poly Haven, Quaternius, Kenney and others)'], ['end', 'Thank you for playing']], credit: 'Assets: Poly Haven, Quaternius, Kenney and others (CC0). Fire sound: Work With Sounds / La Fonderie (CC BY 4.0). Crow: Poly by Google (CC BY 3.0). Full list in CREDITS.md', back: 'Back', faults: 'Faults', arrived: 'Arrived', time: 'Time', best: 'Best', retry: 'Retry', next: 'Climb', share: 'Post on X', menu: 'Menu', paused: 'Paused', resume: 'Resume', restart: 'Restart', why_head: 'Head hit', why_back: 'Looped out backward', why_front: 'Over the bars', why_body: 'Body hit', why_hard: 'Landing too hard', why_belly: 'Bottomed out hard', why_fall: 'Fell', medal: ['GOLD', 'SILVER', 'BRONZE', 'DONE'], newBest: 'New best', rest: 'Saved', fell: 'Fell Nm', net: 'Back to rest point', lava: 'Into the lava', best_alt: 'Best', hard_on: 'Hardcore ON', hard_off: 'Hardcore OFF', t_thr: 'Throttle', t_back: 'Lean back before a step', t_fwd: 'Lean forward going up', t_air: 'Lean to match the landing', t_brk: 'Brake before the corner', why_boulder: 'Flattened by the boulder', why_monkey: 'Knocked off', story0: 'My brother said he was going up there, and never came back.', letter: "I went on ahead. I knew you'd make it.", items: 'Items', hankie: 'Yellowed handkerchief', ly: ['What brings you here?', 'Your brother came here?', "...I'd have remembered him if he was handsome.", 'A guy with a huge mole did come by, though.'], hm: ["Yo, what're you doing out here?", 'Man, your face is filthy.', 'Here, wipe it with this.'], hmGot: 'Got a yellowed handkerchief.', tapNext: 'Tap / click for next', keys: '<b>Left click</b>throttle <b>Right click</b>brake <b>A</b>lean back <b>D</b>lean fwd <b>W</b>nitro <b>Mouse</b>camera <i></i><b>R</b>rest point <b>Esc</b>pause' },
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
renderer.info.autoReset = false // 1 コマの合計（後処理を含む）を数える
renderer.shadowMap.type = THREE.PCFShadowMap // PCFSoft は今の three では PCF に置き換わる（警告を出さない）
setAniso(Math.min(8, renderer.capabilities.getMaxAnisotropy()))
$('view').appendChild(renderer.domElement)
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 3000)
const sky = buildSky(scene)
const hemi = new THREE.HemisphereLight(0x7aa6ae, 0x2e2a24, 1.35); scene.add(hemi)
// 区間ごとの明るさ: col 霧に混ぜる色・tint 混ぜる量・hemi 空の明るさ・dens 霧の濃さの足し
// dens は霧の濃さの倍率（1 = ふつう）
// v38 区間の光の色 [月の光, 補助光, 空の照り返し]
const ZL_VALLEY = [0x92cbbd, 0x4f9488, 0x6aa8a0], ZL_ICE = [0xd4e8f8, 0x8cb0d4, 0xa2c4dc]
const ZLIGHT = { ground: ZL_VALLEY, crypt: ZL_VALLEY, ruin: ZL_VALLEY, storm: [0xa9c8cf, 0x5f8f98, 0x7aa6ae], factory: [0xf0b07a, 0xa86c3c, 0x9c8068], bell: [0xe2c8a0, 0x8a7a5a, 0x8e9a90], ice: ZL_ICE, roof: ZL_ICE, sky: ZL_ICE, castle: ZL_ICE, tower: ZL_VALLEY, tunnel: [0xa9c8cf, 0x5f8f98, 0x7aa6ae], meadow: [0xfff2da, 0xfff0d8, 0xbcd8ee] }
const ZONEP = { ground: { col: 0x5a3b2c, tint: 0.2, hemi: 1.45, dens: 0.8 }, crypt: { col: 0x141c1b, tint: 0.6, hemi: 0.5, dens: 1.35 }, ruin: { col: 0x2d474e, tint: 0, hemi: 1.35, dens: 1 }, factory: { col: 0x4a3c30, tint: 0.35, hemi: 1.15, dens: 1.15 }, bell: { col: 0x5a5040, tint: 0.3, hemi: 1.25, dens: 1.05 }, ice: { col: 0x5f7f86, tint: 0.45, hemi: 1.4, dens: 1.1 }, storm: { col: 0x34424a, tint: 0.5, hemi: 0.95, dens: 1.3 }, roof: { col: 0x2d474e, tint: 0, hemi: 1.35, dens: 0.85 }, sky: { col: 0x6a8a90, tint: 0.2, hemi: 1.45, dens: 0.75 }, tunnel: { col: 0x07090b, tint: 0.92, hemi: 0.16, dens: 2.4 }, meadow: { col: 0xbcd6e6, tint: 0.55, hemi: 1.7, dens: 0.05 }, castle: { col: 0x6a8a90, tint: 0.2, hemi: 1.45, dens: 0.75 } }
const FOG_BASE = 0.0062
// 月の反対側から弱い青緑の補助光（影は付けない。影の側が真っ黒にならないように）
const fill = new THREE.DirectionalLight(0x5f8f98, 0.55); fill.position.set(60, 40, 50); scene.add(fill)
const MOON = new THREE.Vector3(-0.5, 0.55, -0.4).normalize()
const moon = new THREE.DirectionalLight(0xa9c8cf, 1.7); scene.add(moon, moon.target)
moon.castShadow = true
moon.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048)
Object.assign(moon.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 180 })
moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.04
scene.fog = new THREE.Fog(0x2d474e, FOG_BASE, 0)
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
Snd.def({ pusu: ['snd/pusu_0.mp3', 'snd/pusu_1.mp3', 'snd/pusu_2.mp3'], mudfart: ['snd/mudfart_0.mp3', 'snd/mudfart_1.mp3', 'snd/mudfart_2.mp3'], land: ['snd/land1.mp3', 'snd/land2.mp3', 'snd/land3.mp3'], crash: ['snd/crash1.mp3', 'snd/crash2.mp3'], clank: ['snd/clank1.mp3', 'snd/clank2.mp3'], spring: 'snd/spring.mp3', gate: 'snd/gate.mp3', finish: 'snd/finish.mp3', swish: 'snd/swish.mp3', crack: ['snd/crack1.mp3', 'snd/crack2.mp3'], creak: ['snd/creak_a.mp3', 'snd/creak_b.mp3', 'snd/creak_c.mp3'], chain: ['snd/chain_a.mp3', 'snd/chain_b.mp3'], rumble: ['snd/rumble_a.mp3', 'snd/rumble_b.mp3', 'snd/rumble_c.mp3'], splash: ['snd/splash1.mp3', 'snd/splash2.mp3'], save: 'snd/save.mp3', cloth: 'snd/cloth.mp3', rockfall: 'snd/rockfall.mp3', rockbreak: 'snd/rockbreak.mp3', pebbles: 'snd/pebbles.mp3', ballhit: 'snd/ballhit.mp3', whoosh: 'snd/whoosh.mp3', scream: 'snd/fall_ahhh.mp3', grunt: ['snd/grunt1.mp3', 'snd/grunt2.mp3', 'snd/grunt3.mp3'], gravel: ['snd/gravel1.mp3', 'snd/gravel2.mp3', 'snd/gravel3.mp3'], flap: 'snd/flap.mp3', caw: ['snd/crow_caw.mp3', 'snd/crow_0.mp3'], boom: 'snd/explosion.mp3', horn: 'snd/horn_0.mp3', monkey: ['snd/monkey_0.mp3', 'snd/monkey_1.mp3', 'snd/monkey_2.mp3', 'snd/monkey_3.mp3', 'snd/monkey_4.mp3', 'snd/monkey_5.mp3'], monkeyTaunt: ['snd/monkey_taunt.mp3'], manVoice: ['snd/man_voice.mp3'], oneeVoice: ['snd/onee_voice.mp3'], bgmBuild: 'snd/bgm_final_build.mp3', bgmClimax: 'snd/bgm_final_climax.mp3', bgmGate: 'snd/bgm_gate.mp3', patter: ['snd/patter_01.mp3', 'snd/patter_02.mp3'] })
try { Snd.muted = localStorage.getItem('sky-mute') === '1' } catch (e) {}
function startAudio() {
  Snd.init()
  if (Snd.ctx && !Snd.loops.engine) { Snd.loop('engine', 'snd/engine.wav', 0.0001, 0.2); Snd.loop('engineHi', 'snd/engine_hi.wav', 0.0001, 0.2); Snd.loop('nitro', 'snd/nitro.mp3', 0.0001, 0.2); Snd.loop('wind', 'snd/wind_howl.wav', 0.0001, 0.8); Snd.loop('fire', 'snd/fire.wav', 0.0001, 0.5); Snd.loop('water', 'snd/water.mp3', 0.0001, 0.5) }
}
let ambT = 9, creakT = 4
// ------------------------------------------------------------ v36 最後の BGM（店主が用意した曲）: 大ジャンプの助走で build → 踏み切りの瞬間に climax → 着地で落とす → 門の前で gate（One Last Note・3 分 7 秒）を結果画面まで最後まで流す。もう一回・メニュー・横丁へ戻る時は 1 秒で消す
// 曲は Snd.def で読む（最初に触った時に裏で読み込む。最初の画面を遅くしない）。出し直したら止めて、助走路に入ったらまた build から
const BGM = { cur: null, ph: 'off', log: [] }
function bgmSrc(name, o = {}) {
  const c = Snd.ctx, buf = c && Snd.bufs[Snd.files[name] && Snd.files[name][0]]; if (!buf || buf === 'loading' || Snd.away) return null
  const s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.connect(g); g.connect(Snd.master); const me = { s, g }; s.onended = () => { me.ended = true }
  if (o.loopFrom != null) { s.loop = true; s.loopStart = o.loopFrom; s.loopEnd = buf.duration - (o.loopTrim || 0) }
  const t = c.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(o.vol ?? 0.7, t + (o.fade ?? 0.3))
  s.start(t, o.offset || 0); return Object.assign(me, { name, dur: buf.duration, t0: t - (o.offset || 0) }) // v38 曲が終わったら ended（エンジンを下げっぱなしにしない）
}
function bgmFade(x, sec, to = 0.0001) { if (!x || !Snd.ctx) return; const t = Snd.ctx.currentTime, g = x.g.gain; g.cancelScheduledValues(t); g.setValueAtTime(Math.max(0.0001, g.value), t); g.linearRampToValueAtTime(to, t + sec); if (to <= 0.001) try { x.s.stop(t + sec + 0.05) } catch (e) {} }
function bgmTo(name, o = {}) { const old = BGM.cur; const n = name ? bgmSrc(name, o) : null; if (old) bgmFade(old, o.out ?? 0.3); BGM.cur = n; BGM.log.push({ t: G.world ? +G.world.time.toFixed(3) : 0, name, ok: !!n }); return n }
function bgmStop(sec = 0.3) { if (BGM.cur) bgmFade(BGM.cur, sec); BGM.cur = null; BGM.ph = 'off' }
function bgmStep(dt) {
  const c = G.course, b = G.bike; if (!c || !c.climb || !Snd.ctx) return
  const mj = (c.notes || []).find(n => n.kind === 'megaJump'), ci = c.cps.findIndex(q => q.name === '大ジャンプの助走'), fin = c.cps.find(q => q.finish)
  if (!mj || ci < 0) return
  if (G.ending) { if (BGM.ph !== 'gate') { BGM.ph = 'gate'; bgmTo('bgmGate', { vol: 0.6, fade: 0.8, out: 1.0 }) } return } // 最後の場面: 門の前からの曲をそのまま最後まで（切らない・繰り返さない）
  if (G.state !== 'play' || !b) return
  const hx = Math.cos(mj.yaw), hz = -Math.sin(mj.yaw), al = (b.p[0] - mj.lip[0]) * hx + (b.p[2] - mj.lip[2]) * hz
  const air = !b.g[0] && !b.g[1]
  if (BGM.ph === 'off' && (G.R.rest || 0) >= ci && al < 0 && al > -70 && !b.crashed) { BGM.ph = 'build'; bgmTo('bgmBuild', { vol: 0.25, fade: 0.8, loopFrom: 17.75, loopTrim: 0.5 }) } // build の後半を繰り返す
  if (BGM.ph === 'build' && BGM.cur) { const k = Math.max(0, Math.min(1, (al + 60) / 55)); BGM.cur.g.gain.setTargetAtTime(0.25 + 0.5 * k, Snd.ctx.currentTime, 0.4) } // 助走でだんだん上げる
  if (BGM.ph === 'build' && air && al > -0.5 && al < 12) { BGM.ph = 'climax'; BGM.climaxAt = G.world.time; bgmTo('bgmClimax', { vol: 0.85, fade: 0.05, out: 0.3 }) } // 踏み切りの瞬間に頭から
  if (BGM.ph === 'climax' && !air && al > 15) { BGM.ph = 'land'; if (BGM.cur) bgmFade(BGM.cur, 2.6, 0.12) }
  if ((BGM.ph === 'land' || BGM.ph === 'climax') && fin && Math.hypot(b.p[0] - fin.p[0], b.p[2] - fin.p[2]) < 26) { BGM.ph = 'gate'; bgmTo('bgmGate', { vol: 0.6, fade: 1.2, out: 1.0 }) }
}
// v38 本人「エンジン音、小さくない？」: 1.8 → 2.5 倍（低い音・高い音とも。スマホのスピーカーでは高い音が主に聞こえる）。音割れは出口のリミッターで防ぐ（sfx.js）
const ENGINE_GAIN = 2.5
function soundUpdate(dt) {
  if (!Snd.ctx || Snd.away) return
  const L = Snd.loops, c = Snd.ctx.currentTime
  const b = G.bike, playing = G.state === 'play' && b
  const sp = playing ? Math.abs(b.speed) : 0
  if (L.engine && L.engine.node) {
    // エンジン: 速さとギアから回転数を出す（ギアが上がると回転が落ちる段差）。空中でアクセルをあおると空ぶかし、後輪が空回りすると吹け上がる。
    // 離した直後は回転がばらつく。低い回転と高い回転の録音を、回転数で混ぜてピッチを変える（合成音にしない）
    const thr = playing && !b.crashed ? G.inp.thr : 0, gr = b && (b.g[0] || b.g[1])
    const GEARS = [0, 3.5, 6.5, 9.5, 12.5, 16, 21], gi = Math.max(0, GEARS.findIndex((v, k) => sp < GEARS[k + 1]))
    const lo = GEARS[gi], hi = GEARS[gi + 1] || 24, frac = Math.min(1, (sp - lo) / (hi - lo))
    if (G.gear != null && gi > G.gear && thr > 0) G.shiftT = 0.09 // シフトアップの一瞬の切れ目
    G.gear = gi
    const spin = b && b.g[0] && thr > 0 && Math.abs(b.speed) < 2.5 // 登れずに後輪が空回り
    let tgt = gr ? 0.18 + 0.7 * frac * (0.4 + 0.6 * thr) + thr * 0.12 : (thr ? 1.05 : 0.3)
    if (spin) tgt = Math.max(tgt, 0.85)
    if (b && b.nitroOn) tgt = Math.min(1.25, tgt + 0.22)
    G.rpm += (tgt - G.rpm) * Math.min(1, dt * (thr ? (gr ? 7 : 11) : 2.6))
    if (G.prevThr > 0 && !thr) G.burble = 0.7
    G.prevThr = thr
    let wob = 0; if (G.burble > 0) { G.burble -= dt; wob = (Math.random() - 0.5) * 0.09 * G.burble }
    G.shiftT = Math.max(0, (G.shiftT || 0) - dt)
    const on = playing && !b.crashed, bgL = BGM.cur && !BGM.cur.ended ? Math.min(1, BGM.cur.g.gain.value / 0.5) : 0, cut = (G.shiftT > 0 ? 0.35 : 1) * ENGINE_GAIN * (1 - 0.4 * bgL), r = G.rpm // v26 本人「バイクの音少し小さい」: エンジンの2つの音を 1.4 倍 → v36 本人「もう少し大きく」1.8 倍（声の録音の間は環境音ごと少し下げる）
    L.engine.node.playbackRate.setTargetAtTime(0.6 + r * 0.75 + wob, c, 0.025)
    L.engine.g.gain.setTargetAtTime(on ? (0.1 + (1 - Math.min(1, r)) * 0.12) * cut : 0.0001, c, 0.04)
    if (L.engineHi && L.engineHi.node) { L.engineHi.node.playbackRate.setTargetAtTime(0.62 + r * 0.55 + wob, c, 0.025); L.engineHi.g.gain.setTargetAtTime(on ? Math.max(0.0001, (r - 0.25) * 0.24 * (0.5 + thr * 0.5)) * cut : 0.0001, c, 0.04) }
    if (L.nitro && L.nitro.node) L.nitro.g.gain.setTargetAtTime(on && b.nitroOn ? 0.5 : 0.0001, c, b && b.nitroOn ? 0.03 : 0.15)
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
  keys: new Set(), touch: { thr: false, brk: false, back: false, fwd: false, nit: false }, nearFire: 99, nearChain: 99, tut: null,
}
window.sky = G; G.BGM = BGM // テストで曲の状態を見る
try { G.best = JSON.parse(localStorage.getItem('sky-best16') || '{}') } catch (e) { G.best = {} }
try { G.hard = localStorage.getItem('sky-hard') === '1' } catch (e) {}
let built = null, bikeView = null
const courseCache = {}

function fmt(sec) { if (sec == null) return '—'; const m = Math.floor(sec / 60), s = sec - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2) }
function refreshBest() {
  for (const [k, id] of [['practice', 'bestPractice'], ['stage1', 'bestStage1']]) {
    const b = G.best[k]; $(id).textContent = b ? `${t('best')} ${fmt(b.time)}  ${t('faults')} ${b.faults}` : (k === 'stage1' ? t('c_stage1_sub') : '')
  }
}

// v31 途中で初めて出る物（ニトロの炎・爆発・ライトのにじみ・ゴースト・カラス・缶など）のシェーダを、読み込みの時に先に作る。
// 隠れている物も一度だけ見える扱いにして compile する（途中で初めて描くと、スマホで 0.1〜0.2 秒止まっていた）
function warmShaders() {
  const hid = []; scene.traverse(o => { if (!o.visible) { hid.push(o); o.visible = true } })
  // v38: 画面は後処理の下書き（線形の色の描画先）へ描くので、その描画先でシェーダを作っておく（画面へ直接の形だけ作ると、初めて見えた時にスマホで止まっていた: 爆発の火の玉・猿など）
  try { const prev = renderer.getRenderTarget(); renderer.setRenderTarget(composer.readBuffer); renderer.compile(scene, camera); renderer.setRenderTarget(prev) } catch (e) {}
  for (const o of hid) o.visible = false
}
// v42 準備完了に要らない人物（廃墟の男・お姉さん・猿）は、準備完了の後に裏で読む（出番は数分後。届く前でも当たりは無く、待ちも止まらない）
let readyRes = null; const readyP = new Promise(r => { readyRes = r })
const lateLoader = () => { const ld = new GLTFLoader(); return { loadAsync: u => readyP.then(() => new Promise(r => setTimeout(r, 300))).then(() => ld.loadAsync(u)) } }
function loadCourse(id) {
  if (built) { for (const o of built.objs) if (o) scene.remove(o); built.group.traverse(o => o.geometry && o.geometry.dispose()) }
  const LM = window.__loadMarks = window.__loadMarks || {}, lt = () => performance.now(); let l0 = lt()
  const c = courseCache[id] || (courseCache[id] = COURSES[id]())
  LM.course = Math.round(lt() - l0); l0 = lt()
  G.course = c
  G.world = new World(c.shapes); G.world.winds = c.winds || []
  const wide = !!(c.towers && c.towers.length) // v16 広い世界（塔がいくつもある）
  const spotI = wide ? titleIndex(c) : 0
  // 最初に細かく作るのは、出発点とタイトルの場面から 110m 以内の升目だけ。残りは準備完了の後に、カメラに近い升目から 1 コマに 1 つ
  const nowZ = wide ? (() => { const ref = [c.cps[0].p, c.path[spotI].p]; return s => ref.some(r => Math.hypot((s.min[0] + s.max[0]) / 2 - r[0], (s.min[2] + s.max[2]) / 2 - r[2]) < 110) })() : null
  const { group, movers, M, more, laterZones, chunkMap } = buildCourse(c, scene, nowZ)
  LM.mesh = Math.round(lt() - l0); l0 = lt()
  G.gim = buildGimmicks(c, scene, M)
  G.v35 = c.climb ? buildV35(c, scene, M, lateLoader()) : null // v35 回る筒・廃墟の男・兄の跡
  if (G.v35) G.v35.hermit.onReady = () => setTimeout(warmShaders, 0)
  if (G.ladyG) scene.remove(G.ladyG); G.ladyG = new THREE.Group(); G.ladyG.name = 'lady'; scene.add(G.ladyG)
  G.ladyV = c.climb ? buildLady(c, G.ladyG, M, lateLoader()) : null // v40 序盤の旗のそばのお姉さん
  if (G.ladyV) G.ladyV.onReady = () => setTimeout(warmShaders, 0)
  G.bv = c.climb ? buildBoulder(c, G.ladyG, M) : null // v41 落石の坂の岩
  G.v36 = c.climb ? buildV36(c, scene, M, lateLoader()) : null // v36 罠と猿
  if (G.v36) G.v36.imps.onReady = () => setTimeout(warmShaders, 0)
  G.murals = c.climb ? buildMurals(c, scene, M) : null // v36 塔の壁の古い壁画 4 枚
  G.v37 = c.climb ? buildV37(c, scene, M) : null // v37 草原・風車
  LM.gim = Math.round(lt() - l0); l0 = lt()
  const spot = wide ? { q: c.path[spotI], side: -1 } : null
  const signs = buildSigns(c, scene)
  // 練習場（塔なし）は飾りを今まとめて作る。広い世界は準備完了の後に近い順に
  const decor = wide ? { group: null, wallFlames: [] } : buildDecor(c, scene, M)
  const chains = wide ? null : buildChains(c, scene, M), under = wide ? null : buildUnderRocks(c, scene, M)
  LM.decor = Math.round(lt() - l0); l0 = lt()
  // 塔の頭（遠くからの目印）は最初から
  const crowns = wide ? c.towers.map(T => buildCrown(c, T, M)) : []
  const crownG = new THREE.Group(); crownG.name = 'crowns'; for (const cr of crowns) crownG.add(cr.group); if (wide) crownG.add(buildSupportDecor(c, M)); scene.add(crownG)
  LM.crown = Math.round(lt() - l0); l0 = lt()
  const mn = [1e9, 1e9], mx = [-1e9, -1e9]; for (const s of c.shapes) if (s.tag !== 'ground') { mn[0] = Math.min(mn[0], s.min[0]); mn[1] = Math.min(mn[1], s.min[2]); mx[0] = Math.max(mx[0], s.max[0]); mx[1] = Math.max(mx[1], s.max[2]) }
  const ctr = [(mn[0] + mx[0]) / 2, 0, (mn[1] + mx[1]) / 2], rad = Math.max(mx[0] - mn[0], mx[1] - mn[1]) / 2 + 40
  const far = wide ? null : buildMountains(scene, ctr, rad, M), farLights = far ? far.userData.lights || [] : [] // 広い世界の谷の廃墟は準備完了の後に
  const lava = buildLava(scene, ctr, c.lavaY ?? -8, wide ? rad + 700 : 115)
  // 上がってくる溶岩（追われて登る区間）の面。追われる塔（道の点 i0 に一番近い塔）に置く。始まった時だけ見せる
  const rT = wide && c.risers && c.risers[0] ? (() => { const q = c.path[c.risers[0].i0] || c.path[0]; return c.towers.reduce((a, T) => Math.hypot(T.cx - q.p[0], T.cz - q.p[2]) < Math.hypot(a.cx - q.p[0], a.cz - q.p[2]) ? T : a) })() : c.tower
  const riser = new THREE.Mesh(new THREE.CircleGeometry(rT ? rT.r + 14 : 60, 48), lava.material); riser.rotation.x = -Math.PI / 2; riser.visible = false; riser.name = 'riser'; if (rT) riser.position.set(rT.cx, 0, rT.cz); scene.add(riser)
  // 雲海の層: 溶岩の上から一番高い道まで 45m ごと
  const topY = Math.max(...c.path.filter(q => q.p).map(q => q.p[1]))
  const fogLayers = wide ? (() => { const L = [[(c.lavaY ?? -8) + 6, 0.9]]; for (let y = (c.lavaY ?? -8) + 40; y < topY - 10; y += 45) L.push([y, 0.55]); return L })() : [[-2, 0.6]]
  const fogL = buildFogLayers(scene, ctr, fogLayers)
  const flamePts = (c.torches || []).concat(decor.wallFlames)
  const farGlow = buildFlames(scene, farLights.concat(...crowns.map(cr => cr.flames)), M)
  const flames = buildFlames(scene, flamePts, M)
  LM.rest = Math.round(lt() - l0); l0 = lt()
  built = { more, riser, group, signs, M, objs: [...G.gim.objs, G.ladyG, G.v35 && G.v35.group, G.v36 && G.v36.group, G.murals && G.murals.group, G.v37 && G.v37.group, G.v37 && G.v37.daySky, riser, group, crownG, farGlow.group, decor.group, signs, chains, under, far, lava, fogL.group, flames.group], movers, M, lava, fogL, flames, farGlow, flamePts, ctr, props: null, chunkMap, decos: [], tasks: [] }
  G.castleAt = c.castleAt
  if (wide) {
    // 準備完了の後の仕事（1 コマに 1 つ、今のカメラに近い物から）
    const T_ = built.tasks
    for (const lz of laterZones()) T_.push({ at: lz.at, run: () => more(lz.zone) })
    for (const T of c.towers) T_.push({ at: [T.cx, (T.y0 + T.top) / 2, T.cz], run: () => {
      const d = buildDecor(c, scene, M, T), ch = buildChains(c, null, M, T)
      if (ch) d.group.add(ch)
      built.decos.push(d.group); built.objs.push(d.group); if (d.grass) { built.decos.push(d.grass); built.objs.push(d.grass) }
      if (d.wallFlames.length) { built.flames.add(d.wallFlames); built.flamePts.push(...d.wallFlames); G._lt = 0 }
    } })
    T_.push({ at: c.cps[0].p, run: () => {
      const d = buildDecor(c, scene, M, null), ch = buildChains(c, scene, M), un = buildUnderRocks(c, scene, M); built.objs.push(d.group, ch, un)
      if (ch) built.decos.push(...ch.children) // 鎖は升目ごとに、遠い所は描かない
      // 塔と塔の間の道の縁にも、ところどころ小さな灯り（遠くから来た道・次の道が灯りの点々で読める）
      let sd = 97; const rr = () => ((sd = (sd * 16807) % 2147483647) / 2147483647), pts = []
      for (const sh of c.shapes) if (sh.tag === 'parapet' && rr() < 0.13 && !c.towers.some(T => Math.hypot(sh.c[0] - T.cx, sh.c[2] - T.cz) < T.r + 9)) pts.push([sh.c[0], sh.c[1] + sh.h[1] + 0.12, sh.c[2], 2])
      if (pts.length) { built.flames.add(pts); built.flamePts.push(...pts); G._lt = 0 }
    } })
    T_.push({ at: ctr, run: () => { const v = buildValley(c, scene, M); built.objs.push(v); built.farGlow.add(v.userData.lights || []) } })
  }
  G._lt = 0; G._near = null // 松明の光の割り当てを作り直す（前のコースの番号を使わない）
  G.steer = createSteer(c.path)
  // v27: 序盤の赤いドラム缶のうち、道がいちばん先に近くを通る 1 個は、近くを通ると爆発する（見た目と音だけ。バイクには何もしない）
  G.boom = null
  // v36 本人「上の缶が爆発しない」: 積んである缶の山（横に並んだ缶・上に乗った缶）のうち、道がいちばん先に近くを通る山の一番下の缶が爆発し、山の缶は全部 0.2〜0.4 秒ずつ遅れて連鎖する
  if (c.climb) { const cand = []; c.shapes.forEach((sh, si) => { if (sh.tag !== 'barrel') return; let bi = -1, bd = 1e9; c.path.forEach((q, i) => { if (!q.p || q.branch) return; const d = Math.hypot(q.p[0] - sh.a[0], q.p[2] - sh.a[2]); if (Math.abs(q.p[1] - sh.a[1]) < 1.5 && d < bd) { bd = d; bi = i } }); if (bd < 4.5) cand.push({ si, i: bi, a: sh.a.slice(), b: sh.b.slice() }) })
    const pile = x => { const out = [], todo = [x], seen = new Set([x.si]); while (todo.length) { const y = todo.pop(); c.shapes.forEach((sh, si) => { if (sh.tag !== 'barrel' || seen.has(si)) return; const dy = sh.a[1] - y.a[1]; if (dy > -0.3 && dy < 1.2 && Math.hypot(sh.a[0] - y.a[0], sh.a[2] - y.a[2]) < 1.0) { seen.add(si); const z = { si, a: sh.a.slice(), b: sh.b.slice() }; out.push(z); todo.push(z) } }) } return out }
    cand.sort((p, q) => p.i - q.i)
    let best = cand.find(x => pile(x).some(z => z.a[1] > x.a[1] + 0.5) && !pile(x).some(z => z.a[1] < x.a[1] - 0.3)) || cand[0] || null
    if (best) { best.ups = pile(best).sort((p, q) => (p.a[1] - q.a[1]) || (Math.hypot(p.a[0] - best.a[0], p.a[2] - best.a[2]) - Math.hypot(q.a[0] - best.a[0], q.a[2] - best.a[2]))).map((z, k) => ({ ...z, delay: 0.2 + 0.18 * k })) }
    G.boom = best }
  // v22: 道に止まっているカラス（近づくと飛び立つ。当たりなし）
  if (G.birds) G.birds.dispose()
  G.birds = c.climb ? new Birds(scene, c) : null
  if (G.birds) G.birds.load('assets/models/crow.glb').then(warmShaders).catch(() => {})
  // 道の点ごとに「鎖や木のきしむ物が近いか」（橋・広場）
  G.creakPts = c.path.filter(q => q.p && (q.kind === 'bridge' || q.kind === 'uturn' || q.kind === 'crumble')).map(q => q.p)
  if (propsReady) placeProps()
  setTimeout(warmShaders, 0)
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
  setTimeout(warmShaders, 0)
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
// タイトルの場面: 廃墟の塔のまわりの張り出しを、塔の外側の斜め後ろ・高めから（片側に塔の壁、反対に霧の谷、奥に次の塔）
function titleTower(c) { return (c.towers && (c.towers[1] || c.towers[0])) || c.tower } // 2 本目の塔（廃墟の塔）: 霧の谷の上の高さで、遠くに次の塔が見える
function titleIndex(c) {
  const p = c.path, T = titleTower(c)
  if (T && c.towers && c.towers.length) {
    const ids = []
    p.forEach((q, i) => { if (q.p && !q.branch && q.kind === 'orbit' && Math.abs(Math.hypot(q.p[0] - T.cx, q.p[2] - T.cz) - T.rm) < 1.5 && q.p[1] > T.y0 - 1) ids.push(i) })
    if (ids.length) return ids[Math.floor(ids.length * 0.45)]
  }
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

// ------------------------------------------------------------ v27 爆発するドラム缶
const boomLight = new THREE.PointLight(0xff8a3a, 0, 16, 2); scene.add(boomLight)
const boomLight2 = new THREE.PointLight(0xff8a3a, 0, 14, 2); scene.add(boomLight2) // 連鎖の2つ目（最初から置いて明るさ 0。光の数を変えない）
// 火の玉と煙の玉（中心が明るいぼかしの板。カメラを向く）
const boomTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'), g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv) })()
const boomFire = new THREE.Sprite(new THREE.SpriteMaterial({ map: boomTex, color: 0xff9a40, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 })); boomFire.visible = false; scene.add(boomFire)
const boomSmoke = new THREE.Sprite(new THREE.SpriteMaterial({ map: boomTex, color: 0x2a2826, depthWrite: false, transparent: true, opacity: 0 })); boomSmoke.visible = false; scene.add(boomSmoke)
const boomFire2 = new THREE.Sprite(boomFire.material.clone()); boomFire2.visible = false; scene.add(boomFire2)
// 置物（樽）の中から、位置がいちばん近い物
function propNear(p) { if (!built || !built.props) return null; let m = null, bd = 1e9; built.props.children.forEach(o => { const d = Math.hypot(o.position.x - p[0], o.position.y - p[1], o.position.z - p[2]); if (d < bd) { bd = d; m = o } }); return bd < 0.3 ? m : null }
function boomMesh() { const B = G.boom; if (!B || !built || !built.props) return null; if (B.mesh && B.mesh.parent) return B.mesh; let m = null, bd = 1e9; built.props.children.forEach(o => { const d = Math.hypot(o.position.x - B.a[0], o.position.z - B.a[2]); if (d < bd) { bd = d; m = o } }); B.mesh = bd < 0.3 ? m : null; if (B.mesh) B.home = { p: B.mesh.position.clone(), r: B.mesh.rotation.clone() }; return B.mesh }
function boomReset() {
  const B = G.boom; if (!B) return
  B.done = false; B.t = 0
  const sh = G.world && G.world.shapes[B.si]; if (sh) { sh.a = B.a.slice(); sh.b = B.b.slice() }
  const m = boomMesh(); if (m && B.home) { m.position.copy(B.home.p); m.rotation.copy(B.home.r); m.visible = true }
  boomLight.intensity = 0; boomFire.visible = false; boomSmoke.visible = false
  boomLight2.intensity = 0; boomFire2.visible = false
  for (const u of B.ups || []) { u.done = false; u.vel = null; const s2 = G.world && G.world.shapes[u.si]; if (s2) { s2.a = u.a.slice(); s2.b = u.b.slice() } if (!u.mesh || !u.mesh.parent) u.mesh = propNear(u.a); if (u.mesh) { if (!u.home) u.home = { p: u.mesh.position.clone(), r: u.mesh.rotation.clone() }; u.mesh.position.copy(u.home.p); u.mesh.rotation.copy(u.home.r); u.mesh.visible = true } }
  B.ups0 = (B.ups || []).length
}
function boomUpdate(dt) {
  const B = G.boom; if (!B) return
  if (!B.done) {
    const b = G.bike; if (G.state !== 'play' || !b || b.ghost) return
    // v38 本人「爆発はもうちょっと早く」: 缶が前に見えているうちに（缶まで約 1.3 秒・最小 8m）。前にある時だけ
    const dx = B.a[0] - b.p[0], dz = B.a[2] - b.p[2], dd = Math.hypot(dx, dz), ahead = dx * Math.cos(b.psi) - dz * Math.sin(b.psi)
    if ((dd < Math.max(8, Math.max(0, b.speed) * 1.3) && ahead > 0.3 * dd || dd < 3) && Math.abs(b.p[1] - 0.8 - B.a[1]) < 3) {
      B.done = true; B.t = 0; G.boomN = (G.boomN || 0) + 1
      // 当たりの円柱は遠くへ（バイクには何も当たらない・押さない）
      const sh = G.world.shapes[B.si]; if (sh) { sh.a = [B.a[0], -9999, B.a[2]]; sh.b = [B.b[0], -9998, B.b[2]] }
      const p = [B.a[0], B.a[1] + 0.5, B.a[2]]
      Snd.play('boom', { vol: 1 }); setTimeout(() => Snd.play('clank', { vol: 0.6 }), 350); setTimeout(() => Snd.play('rockfall', { vol: 0.5 }), 500)
      dust.emit(p, 40, 7, { col: 0xff7a2a, up: 7, size: 2.2 }) // 火の粉
      dust.emit(p, 18, 3, { col: 0xffc060, up: 4, size: 2.2 }) // 炎
      dust.emit(p, 30, 2.5, { col: 0x2e2c2a, up: 3, size: 2.6 }) // 煙
      dust.emit(p, 22, 8, { col: 0x8a2a20, heavy: 1, up: 6, size: 1.0 }) // 缶の破片
      boomLight.position.set(p[0], p[1] + 1, p[2]); boomLight.intensity = 90
      const m = boomMesh(); if (m) { B.vel = [(Math.random() - 0.5) * 3, 9, (Math.random() - 0.5) * 3]; B.spin = [(Math.random() - 0.5) * 12, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 12] }
    }
    return
  }
  B.t += dt
  boomLight.intensity = Math.max(0, 90 * (1 - B.t / 0.7))
  { const t = B.t, fireS = 1.2 + 4.5 * Math.min(1, t / 0.18), smokeS = 2 + 5 * Math.min(1, t / 1.6)
    boomFire.visible = t < 0.7; boomFire.position.set(B.a[0], B.a[1] + 1 + t * 1.5, B.a[2]); boomFire.scale.set(fireS, fireS, 1); boomFire.material.opacity = Math.max(0, 1 - t / 0.7) * 0.95
    boomSmoke.visible = t < 2.6; boomSmoke.position.set(B.a[0], B.a[1] + 1.3 + t * 1.2, B.a[2]); boomSmoke.scale.set(smokeS, smokeS, 1); boomSmoke.material.opacity = Math.min(0.75, t * 3) * Math.max(0, 1 - t / 2.6) }
  if (B.t < 1.2) { const p = [B.a[0], B.a[1] + 0.4, B.a[2]]; if (Math.random() < dt * 30) dust.emit(p, 2, 1.2, { col: 0x3a3836, up: 2.5, size: 2.4 }); if (B.t < 0.6 && Math.random() < dt * 40) dust.emit(p, 2, 1.5, { col: 0xff9a40, up: 3, size: 1.4 }) }
  // 連鎖: 上の缶が 0.2〜0.4 秒遅れて爆発し、上へ吹き飛ぶ
  for (const u of B.ups || []) {
    if (!u.done && B.t >= u.delay) { u.done = true; G.boomChain = (G.boomChain || 0) + 1
      const s2 = G.world.shapes[u.si]; if (s2) { s2.a = [u.a[0], -9999, u.a[2]]; s2.b = [u.b[0], -9998, u.b[2]] }
      const q = [u.a[0], u.a[1] + 0.5, u.a[2]]
      Snd.play('boom', { vol: 0.8, rate: 1.12 })
      dust.emit(q, 28, 6, { col: 0xff7a2a, up: 8, size: 2.0 }); dust.emit(q, 14, 3, { col: 0xffc060, up: 5, size: 2.0 }); dust.emit(q, 16, 7, { col: 0x8a2a20, heavy: 1, up: 7, size: 0.9 })
      boomLight2.position.set(q[0], q[1] + 1, q[2]); u.t0 = B.t
      if (!u.mesh || !u.mesh.parent) u.mesh = propNear(u.a); if (u.mesh && !u.home) u.home = { p: u.mesh.position.clone(), r: u.mesh.rotation.clone() }
      u.vel = [(Math.random() - 0.5) * 2.5, 12 + Math.random() * 2, (Math.random() - 0.5) * 2.5]; u.spin = [(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 14] }
    if (u.done && u.t0 != null) { const t2 = B.t - u.t0; boomLight2.intensity = Math.max(boomLight2.intensity * 0, 70 * Math.max(0, 1 - t2 / 0.6)); const fs = 1 + 3.6 * Math.min(1, t2 / 0.16); boomFire2.visible = t2 < 0.6; boomFire2.position.set(u.a[0], u.a[1] + 1 + t2 * 1.6, u.a[2]); boomFire2.scale.set(fs, fs, 1); boomFire2.material.opacity = Math.max(0, 1 - t2 / 0.6) * 0.95 }
    if (u.mesh && u.vel && u.mesh.visible) { u.vel[1] -= 9.81 * dt; u.mesh.position.x += u.vel[0] * dt; u.mesh.position.y += u.vel[1] * dt; u.mesh.position.z += u.vel[2] * dt; u.mesh.rotation.x += u.spin[0] * dt; u.mesh.rotation.y += u.spin[1] * dt; u.mesh.rotation.z += u.spin[2] * dt; if (u.mesh.position.y < u.a[1] - 30) u.mesh.visible = false }
  }
  const m = boomMesh(); if (m && B.vel && m.visible) { B.vel[1] -= 9.81 * dt; m.position.x += B.vel[0] * dt; m.position.y += B.vel[1] * dt; m.position.z += B.vel[2] * dt; m.rotation.x += B.spin[0] * dt; m.rotation.y += B.spin[1] * dt; m.rotation.z += B.spin[2] * dt; if (m.position.y < B.a[1] - 30) m.visible = false }
}
// ------------------------------------------------------------ v28 クラクション: 居座るカラスの群れの 7.5m 手前で自動で「ぷっぷー」、ライトが 2 回パッパッ。1.2 秒後に群れが飛ぶ
function hornUpdate(dt) {
  const Bd = G.birds, f = Bd && Bd.blocker, b = G.bike
  if (!f || !b) return
  const H = G.horn
  if (H && H.on) {
    H.t += dt
    const t = H.t, k = (t < 0.13 || (t > 0.27 && t < 0.42)) ? 1 : 0
    if (bikeView) bikeView.setLamp(k)
    if (t >= 1.2 && !H.flushed) { H.flushed = true; Bd.flush(f, b.p); Snd.play('flap', { vol: 0.9, rate: 1.5 }); setTimeout(() => Snd.play('caw', { vol: 0.6 }), 150) }
    if (t > 1.6) { H.on = false; if (bikeView) bikeView.setLamp(0) }
    return
  }
  if (f.state !== 'perch' || G.state !== 'play' || b.crashed || b.ghost || (H && H.done)) return
  const hx = Math.cos(f.yaw), hz = -Math.sin(f.yaw), ahead = (f.p[0] - b.p[0]) * hx + (f.p[2] - b.p[2]) * hz, lat = Math.abs(-(f.p[0] - b.p[0]) * hz + (f.p[2] - b.p[2]) * hx)
  if (ahead > 0 && ahead < 7.5 && lat < 3 && Math.abs(b.p[1] - 0.8 - f.p[1]) < 2) { G.horn = { on: true, t: 0, done: true }; G.hornN = (G.hornN || 0) + 1; Snd.duck(0.55, 1.0); Snd.play('horn', { vol: 1 }) }
}
function placeBike(b) {
  if (G.fallFrom) for (const n of [G.fallFrom.scream, G.fallFrom.crack]) if (n && n.stop) { try { n.stop() } catch (e) {} }
  G.bike = b; G.prev = snap(b); G.camYaw = b.psi; G.fallFrom = null; if (G.skip && G.skip.ph !== 'in') { G.skip = { ph: 'in', t: 0 } }
  if (G.camOff) { G.camOff.yaw = 0; G.camOff.pitch = 0; G.camOff.idle = 9 } // v19: 出し直したら、マウスで回したカメラも後ろへ戻す（前を向いたまま後ろ向きのカメラで、前へ進むのが後ろへ下がって見えていた）
  if (G.steer) resetSteer(G.steer, b)
  if (G.birds) G.birds.reset() // 出し直したら、鳥はまた止まっている
  boomReset()
  G.horn = null; if (bikeView) bikeView.setLamp(0) // 出し直したら、群れはまた居座っている
  G.patter = false
  if (BGM.ph !== 'off' && G.state === 'play') bgmStop(0.3) // v36 出し直したら曲は止める（助走路に入ったら build から）
  hermitReset() // v35 廃墟の男: もらう前なら隠れ直す。もらった後は手を振るだけ
  ladyReset()
  G.strikeVis = false // 体当たりのカラスも戻る（バイクは新しく作るので、当たった印も消える）
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
  resetDrums(G.world) // v35 回る筒の口を最初の形へ
  $('letter').classList.remove('on', 'quiet', 'peek'); G.ending = null; bgmStop(1.0); if (G.v35 && G.v35.tracks) G.v35.tracks.visible = false
  G.hank = false; G.hm = { ph: 'wait' }; G.ly = { ph: 'wait' }; G.ladyDone = false; G.story = { seen: {}, t0: G.course.climb ? 0.6 : null }; storyOff(); talkOff()
  for (const cn of G.course.cans || []) cn.t = null; skid.clear()
  spawnAt(0)
  G.rec = { course: id, inp: [], ev: [] }
  const bst = G.best[id]
  G.ghost = null
  if (bst && bst.rec && !!bst.hard === !!G.R.hard) { G.ghost = { rec: unpack(bst.rec), ev: (bst.ev || []).slice(), i: 0, cp: 0 }; G.ghost.bike = ghostSpawn({ cp: 0 }) }
  if (!G.ghostView) { G.ghostView = new BikeView(scene, { ghost: true }); setTimeout(warmShaders, 0) }
  G.ghostView.root.visible = !!G.ghost
  if (Q.get('ff')) G.ff = +Q.get('ff')
  if (Q.get('bot')) { G.bot = createBot(G.course, { skill: Q.get('bot') }); G.bot.world = G.world; G.bot.R = G.R; resetBot(G.bot, G.bike); G.testInput = () => botInput(G.bot, G.bike) }
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
function show(id) { if (id !== 'hud') unlockMouse(); for (const s of ['loading', 'title', 'how', 'result', 'pause']) $(s).hidden = s !== id; $('hud').hidden = !(id === 'hud' || id === 'pause'); if (id !== 'hud' && id !== 'pause') $('touch').hidden = true }

// ------------------------------------------------------------ 入力（アクセル・ブレーキ・後ろ体重・前体重の4つ。ハンドルは自動）
const KEYMAP = { ArrowUp: 'thr', ArrowDown: 'brk', KeyS: 'brk', ArrowLeft: 'back', KeyA: 'back', ArrowRight: 'fwd', KeyD: 'fwd', KeyW: 'nit' } // v38 本人「ニトロは W に」: W はニトロだけ（押すだけで全開）。Space・Shift・N は外した。アクセルは左クリックと ↑ // v17: Space もニトロ（走っている間だけ。結果の画面では「もう一回」）
addEventListener('keydown', e => {
  if (G.credits) { e.preventDefault(); if (!e.repeat && G._crSkip) G._crSkip(); return }
  if (!e.repeat && G.state === 'play' && G.fallFrom && fallSkipNow()) { e.preventDefault() } // 長い落下はキーで飛ばす // v39 エンドクレジットはキーで飛ばす（結果の「もう一回」は押さない）
  if (e.repeat) { if (KEYMAP[e.code]) e.preventDefault(); return }
  startAudio()
  if (KEYMAP[e.code]) { G.keys.add(KEYMAP[e.code]); e.preventDefault() }
  if (G.state === 'play' && talking() && (KEYMAP[e.code] || e.code === 'Enter')) talkNext()
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
addEventListener('blur', () => { G.keys.clear(); G.mouse.thr = G.mouse.brk = false })
// ------------------------------------------------------------ PC のマウス（v17）: 左クリックを押す間アクセル・右クリックを押す間ブレーキ（止まると下がる）・マウスを動かしてカメラ
// クリックでマウスを画面に固定（Pointer Lock）。Esc で外れる（もう一度 Esc で一時停止）。ハンドルは今まで通り自動（道に沿う）
G.mouse = { thr: false, brk: false }
G.camOff = { yaw: 0, pitch: 0, idle: 9 }
const lockEl = () => renderer.domElement
const onGame = e => G.state === 'play' && !isTouch && !(e.target && e.target.closest && e.target.closest('button, a, input, .tb, #touch, .screen'))
addEventListener('mousedown', e => {
  if (!onGame(e)) return
  startAudio()
  if (talking()) talkNext()
  if (e.button === 0) G.mouse.thr = true
  if (e.button === 2) G.mouse.brk = true
  if (document.pointerLockElement !== lockEl()) { try { const pr = lockEl().requestPointerLock(); if (pr && pr.catch) pr.catch(() => {}) } catch (err) {} }
  e.preventDefault()
})
addEventListener('mouseup', e => { if (e.button === 0) G.mouse.thr = false; if (e.button === 2) G.mouse.brk = false })
addEventListener('contextmenu', e => { if (G.state === 'play' || G.state === 'pause') e.preventDefault() })
addEventListener('mousemove', e => {
  if (G.state !== 'play' || (document.pointerLockElement !== lockEl() && !G.camFree)) return
  G.camOff.yaw -= (e.movementX || 0) * 0.0032; G.camOff.yaw = Math.atan2(Math.sin(G.camOff.yaw), Math.cos(G.camOff.yaw))
  G.camOff.pitch = Math.max(-0.35, Math.min(0.75, G.camOff.pitch + (e.movementY || 0) * 0.0024)); G.camOff.idle = 0
})
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== lockEl()) { G.mouse.thr = G.mouse.brk = false } })
const unlockMouse = () => { try { if (document.pointerLockElement) document.exitPointerLock() } catch (e) {} }
let padPrev = {}
function readPad() {
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null
  if (!gp) return null
  const ax = i => { const v = gp.axes[i] || 0; return Math.abs(v) < 0.15 ? 0 : v }
  const bt = i => gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0
  const p = { thr: bt(7), brk: bt(6), nit: bt(0) > 0.5, lean: Math.max(-1, Math.min(1, ax(0))), b: bt(1) > 0.5, y: bt(3) > 0.5, start: bt(9) > 0.5 }
  if (p.b && !padPrev.b && G.state === 'play') retryCp(true)
  if (p.y && !padPrev.y && G.state === 'play') startRun(G.course.id)
  if (p.start && !padPrev.start) togglePause()
  padPrev = p
  return p
}
// スマホ: どのボタンも押している間だけ効く。押した指を捕まえておくので、指がボタンの外へずれても切れない。指ごとに別のボタンを同時に押せる
document.querySelectorAll('.tb').forEach(btn => {
  const k = btn.dataset.k, ids = new Set()
  const down = e => { e.preventDefault(); startAudio(); if (talking()) talkNext(); ids.add(e.pointerId); try { btn.setPointerCapture(e.pointerId) } catch (err) {} G.touch[k] = true; btn.classList.add('down') }
  const up = e => { e.preventDefault(); ids.delete(e.pointerId); if (!ids.size) { G.touch[k] = false; btn.classList.remove('down') } }
  btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up); btn.addEventListener('lostpointercapture', up)
})
function gatherInput() {
  if (G.skip && G.skip.ph === 'ff') return { thr: 0, brk: 0, lean: 0, steer: G.bike && !G.bike.crashed && G.steer ? steerFor(G.steer, G.bike) : 0, nitro: 0 } // 落下を飛ばしている間は手を離した入力
  if (G.testInput) { const ti = G.testInput(); if (Q.get('hm')) { hermitHold(ti); ladyHold(ti) } return ti }
  const K = G.keys, T = G.touch, pad = readPad()
  const M = G.mouse || {}
  let thr = K.has('thr') || T.thr || M.thr ? 1 : 0, brk = K.has('brk') || T.brk || M.brk ? 1 : 0
  let lean = (K.has('fwd') || T.fwd ? 1 : 0) - (K.has('back') || T.back ? 1 : 0)
  let nit = K.has('nit') || T.nit ? 1 : 0
  if (pad) { thr = Math.max(thr, pad.thr); brk = Math.max(brk, pad.brk); if (pad.lean) lean = pad.lean; if (pad.nit) nit = 1 }
  if (T.brk && T.thr) thr = 0
  // v17: ニトロを押している間は、アクセルを押していなくても全開（2 つ同時に押さなくていい）。ブレーキ（バック）を押している時はブレーキが先（ニトロは点かない）
  if (nit && !brk) thr = 1
  const steer = G.bike && !G.bike.crashed && G.steer ? steerFor(G.steer, G.bike) : 0
  // 記録できる細かさに丸める（同じ入力なら同じ結果）
  const inp = { thr: Math.round(thr * 8) / 8, brk: Math.round(brk * 8) / 8, lean: Math.round(lean * 16) / 16, steer: Math.round(steer * 16) / 16, nitro: nit }
  hornHold(inp)
  hermitHold(inp)
  ladyHold(inp)
  // 曲がりの手前の自動の減速（アクセルを押しっぱなしでも、ふつうの曲がりでははみ出さない）
  return G.bike && !G.bike.crashed && G.steer ? assist(G.steer, G.bike, inp) : inp
}
// v28: 道をふさぐカラスの群れの手前では、自動でゆっくり減速して止まる（ひかない）。群れが飛んだら普通に進める
function hornHold(inp) {
  const f = G.birds && G.birds.blocker, b = G.bike
  if (!f || f.state !== 'perch' || !b || b.crashed) return
  const hx = Math.cos(f.yaw), hz = -Math.sin(f.yaw), ahead = (f.p[0] - b.p[0]) * hx + (f.p[2] - b.p[2]) * hz, lat = Math.abs(-(f.p[0] - b.p[0]) * hz + (f.p[2] - b.p[2]) * hx)
  if (ahead < 0 || ahead > 28 || lat > 3 || Math.abs(b.p[1] - 0.8 - f.p[1]) > 2) return
  const d = ahead - 3.6, vmax = Math.sqrt(Math.max(0, 2 * 2.6 * d))
  if (b.speed > vmax + 0.1) { inp.thr = 0; inp.brk = Math.min(1, (b.speed - vmax) * 0.6 + 0.35); inp.nitro = 0 }
  else if (d < 0.4) { inp.thr = 0; inp.brk = b.speed > 0.3 ? 0.6 : 0; inp.nitro = 0 } // 止まったら、ブレーキは離す（押し続けると下がるので）
}

// ------------------------------------------------------------ v35 廃墟に住む男（ハンカチ）: 中盤の明るい平らな所。道の脇から出てきて手を上げる → 自動でゆっくり止まる → 1 行ずつ話す
// 同じ走りの中で 1 回だけ。もらった後に出し直したら、脇で手を振るだけ
const HM_STOP = 5.0
function hmGeom(b) { const H = G.v35 && G.v35.hermit, sp = H && H.spot; if (!sp || !b) return null; const hx = Math.cos(sp.yaw), hz = -Math.sin(sp.yaw); return { H, sp, ahead: (sp.p[0] - b.p[0]) * hx + (sp.p[2] - b.p[2]) * hz, lat: Math.abs(-(sp.p[0] - b.p[0]) * hz + (sp.p[2] - b.p[2]) * hx), dy: Math.abs(b.p[1] - 0.8 - sp.p[1]) } }
function hermitHold(inp) {
  const b = G.bike, M = G.hm; if (!M || G.state !== 'play' || !b || b.crashed) return
  const g = hmGeom(b); if (!g) return
  if (G.hank) { if (g.ahead > -3 && g.ahead < 30 && g.lat < 4 && g.dy < 2.5) g.H.set('bye'); return }
  if (M.ph === 'wait') { if (g.ahead > HM_STOP && g.ahead < 34 && g.lat < 3 && g.dy < 2) { M.ph = 'stop'; g.H.set('out') } else return }
  if (M.ph === 'stop') {
    if (g.ahead < 0 || g.lat > 4 || g.dy > 3) { M.ph = 'wait'; g.H.set('hide'); return } // 跳んで越えた・落ちた
    const d = g.ahead - HM_STOP, vmax = Math.sqrt(Math.max(0, 2 * 2.4 * d))
    if (b.speed > vmax + 0.1) { inp.thr = 0; inp.brk = Math.min(1, (b.speed - vmax) * 0.6 + 0.35); inp.nitro = 0 }
    else if (d < 0.6) { M.hold = (M.hold || 0) + 1; inp.thr = 0; inp.brk = M.hold % 20 ? 1 : 0; inp.nitro = 0; if (Math.abs(b.speed) < 0.25 && b.g[0] && b.g[1]) { M.ph = 'talk'; M.line = 0; M.t = 0; g.H.set('talk'); talkShow(t('hm')[0]); G.manVoice = (G.manVoice || 0) + 1; Snd.duck(0.5, 1.5); Snd.play('manVoice', { vol: 1, jitter: 0 }) /* v38 最初のセリフの時だけ、店主の声の録音を 1 回 */ } }
    return
  }
  // 話している間は止まったまま（ブレーキは離す。押し続けると下がる）
  M.hold = (M.hold || 0) + 1; inp.thr = 0; inp.brk = M.hold % 20 ? 1 : 0; inp.lean = 0; inp.nitro = 0 // ゆるい坂でも下がらない（押し続けると 0.45 秒で下がるので、20 コマに 1 回だけ離す）
}
function hermitStep(dt) { // 1 コマごと（話の送り: 数秒で自動でも進む）
  const M = G.hm; if (!M || (M.ph !== 'talk' && M.ph !== 'item')) return
  M.t += dt
  if (M.t > (M.ph === 'item' ? 3.4 : 3.2)) talkNext()
}
function talkNext() {
  if (G.ly && G.ly.ph === 'talk') return ladyNext()
  const M = G.hm, H = G.v35 && G.v35.hermit; if (!M || M.t < 0.35) return
  if (M.ph === 'talk') {
    M.line++; M.t = 0
    if (M.line < t('hm').length) { talkShow(t('hm')[M.line]); if (M.line === 2 && H) H.set('give') }
    else { M.ph = 'item'; G.hank = true; talkShow(t('hmGot'), hankieDataURL()); Snd.play('cloth', { vol: 0.8 }) }
  } else if (M.ph === 'item') { M.ph = 'done'; talkOff(); if (H) H.set('aside') }
}
function talkShow(txt, img) { const el = $('talk'); $('talkTxt').innerHTML = (img ? `<img src="${img}" alt="">` : '') + txt; $('talkNx').textContent = t('tapNext'); el.classList.add('on') }
function talkOff() { $('talk').classList.remove('on') }
const talking = () => (G.hm && (G.hm.ph === 'talk' || G.hm.ph === 'item')) || (G.ly && G.ly.ph === 'talk')
function hermitReset() { const H = G.v35 && G.v35.hermit; if (!G.hm) return; if (talking() || G.hm.ph === 'stop') { talkOff() } if (!G.hank) { G.hm.ph = 'wait'; if (H) H.set('hide') } else { G.hm.ph = 'done'; if (H) H.set('bye') } }
// v40 序盤の旗のそばのお姉さん: 近づくと自動でゆっくり止まり、4 行（タップ/クリック/キーで送る・3.2 秒で自動）。同じ走りで 1 回だけ。出し直し後は手を振るだけ
function lyGeom(b) { const L = G.ladyV, sp = L && L.spot; if (!sp || !b) return null; const hx = Math.cos(sp.yaw), hz = -Math.sin(sp.yaw); return { L, sp, ahead: (sp.p[0] - b.p[0]) * hx + (sp.p[2] - b.p[2]) * hz, lat: Math.abs(-(sp.p[0] - b.p[0]) * hz + (sp.p[2] - b.p[2]) * hx), dy: Math.abs(b.p[1] - 0.8 - sp.p[1]) } }
function ladyHold(inp) {
  const b = G.bike, M = G.ly; if (!M || G.state !== 'play' || !b || b.crashed) return
  const g = lyGeom(b); if (!g || !g.L.ready) return
  if (G.ladyDone) { if (M.ph !== 'talk' && g.ahead > -3 && g.ahead < 30 && g.lat < 4 && g.dy < 2.5) g.L.set('bye'); if (M.ph !== 'talk') return }
  if (M.ph === 'wait') { if (g.ahead > HM_STOP && g.ahead < 30 && g.lat < 3 && g.dy < 2) { M.ph = 'stop'; g.L.set('look') } else return }
  if (M.ph === 'stop') {
    if (g.ahead < 0 || g.lat > 4 || g.dy > 3) { M.ph = 'wait'; g.L.set('lean'); return }
    const d = g.ahead - HM_STOP, vmax = Math.sqrt(Math.max(0, 2 * 2.4 * d))
    if (b.speed > vmax + 0.1) { inp.thr = 0; inp.brk = Math.min(1, (b.speed - vmax) * 0.6 + 0.35); inp.nitro = 0 }
    else if (d < 0.6) { M.hold = (M.hold || 0) + 1; inp.thr = 0; inp.brk = M.hold % 20 ? 1 : 0; inp.nitro = 0; if (Math.abs(b.speed) < 0.25 && b.g[0] && b.g[1]) { M.ph = 'talk'; M.line = 0; M.t = 0; G.ladyDone = true; G.ladyTalks = (G.ladyTalks || 0) + 1; g.L.set('talk'); talkShow(t('ly')[0]); G.oneeVoice = (G.oneeVoice || 0) + 1; Snd.duck(0.5, 1.2); Snd.play('oneeVoice', { vol: 1, jitter: 0 }) } }
    return
  }
  if (M.ph === 'talk') { M.hold = (M.hold || 0) + 1; inp.thr = 0; inp.brk = M.hold % 20 ? 1 : 0; inp.lean = 0; inp.nitro = 0 }
}
function ladyStep(dt) { const M = G.ly; if (!M || M.ph !== 'talk') return; M.t += dt; if (M.t > 3.2) ladyNext() }
function ladyNext() {
  const M = G.ly; if (!M || M.ph !== 'talk' || M.t < 0.35) return
  M.line++; M.t = 0
  if (M.line < t('ly').length) talkShow(t('ly')[M.line])
  else { M.ph = 'done'; talkOff(); if (G.ladyV) G.ladyV.set('after') }
}
function ladyReset() { const L = G.ladyV, M = G.ly; if (!M) return; if (M.ph === 'talk' || M.ph === 'stop') talkOff(); if (!G.ladyDone) { M.ph = 'wait'; if (L && L.set) L.set('lean') } else { M.ph = 'done'; if (L && L.set) L.set('bye') } }
// v37 真っ暗な通路ではヘッドライト、草原では昼の光（月の光の色と強さだけ変える。光の数は同じ）と、風と鳥の声だけ（曲は鳴っていない所）
const MOONC = new THREE.Color(0xa9c8cf), SUNC = new THREE.Color(0xfff2da), DAYT = new THREE.Color(0x3f7fc8), DAYM = new THREE.Color(0x9cc6e4), DAYB = new THREE.Color(0xdde8ec)
function v37Step(dt, tm) {
  if (!G.v37 || !G.course) return
  const zq = G.course.path[(G.steer && G.bike ? G.steer.i : 0) || 0], zone = zq && zq.zone
  G.v37.update(dt, tm, camera.position, G.world, G.state === 'play' || G.state === 'pause' ? zone : null)
  const k = G.v37.meadowK
  moon.color.copy(G.zlc ? G.zlc.moon : MOONC).lerp(SUNC, k); moon.intensity = 1.7 + 1.3 * k; fill.intensity = 0.55 + 0.4 * k
  { const u = sky.material.uniforms; if (!G.skyOrig) G.skyOrig = { top: u.top.value.clone(), mid: u.mid.value.clone(), bot: u.bot.value.clone() }
    if (k < 0.02) G.skyOrig.pano = u.hasPano.value
    u.top.value.copy(G.skyOrig.top).lerp(DAYT, k); u.mid.value.copy(G.skyOrig.mid).lerp(DAYM, k); u.bot.value.copy(G.skyOrig.bot).lerp(DAYB, k)
    if (G.skyOrig.pano) u.hasPano.value = k > 0.35 ? 0 : 1 } // 草原では青空（夜の空の絵を消して、空の色を昼に）
  bloom.strength = 0.55 * (1 - 0.85 * k); renderer.toneMappingExposure = 1 - 0.28 * k // 昼の明るさでにじみが画面を白くしないように
  if (bikeView && !(G.horn && G.horn.on)) bikeView.setLamp(zone === 'tunnel' && G.state === 'play' ? 1 : 0)
  if (Snd.ctx) { const want = k > 0.5 && G.state === 'play'; if (want && !Snd.loops.birds) Snd.loop('birds', 'snd/birds_garden.mp3', 0.5, 2); if (!want && Snd.loops.birds) Snd.loop('birds', null, 0, 1.5) }
}
// v35 回る筒のうなり（近い時だけ。間をおいて低い音）
let drumSndT = 0
function drumSound(dt) {
  if (!G.world || !G.world.drums.length) return
  drumSndT -= dt; if (drumSndT > 0) return
  const cp = camera.position; let d = 1e9; for (const D of G.world.drums) d = Math.min(d, Math.hypot(cp.x - D.c[0], cp.y - D.c[1], cp.z - D.c[2]))
  if (d < 45) { Snd.play('rumble', { vol: Math.min(0.55, (1 - d / 45) * 0.7), rate: 0.7 }); drumSndT = 2.6 } else drumSndT = 1
}
addEventListener('pointerdown', e => { if (G.state === 'play' && talking() && isTouch) talkNext(); if (G.state === 'play' && G.fallFrom) fallSkipNow() })
// v41 落石の坂: 予告（地鳴り・小石がぱらぱら・坂の上の土煙）→ 転がる音 → 門で割れる（破片と土煙）/ はね飛ばされる
let bRumbleT = 0
function boulderFx(e, b) {
  const V = G.bv; if (!V) return
  if (e.ph === 'warn') { Snd.duck(0.6, 2.2); Snd.play('rumble', { vol: 1, rate: 0.55 }); Snd.play('rockfall', { vol: 0.45, rate: 0.8 }); G.boulderN = (G.boulderN || 0) + 1 }
  if (e.ph === 'roll') { Snd.play('rockfall', { vol: 0.9, rate: 0.7 }); Snd.play('rumble', { vol: 1, rate: 0.5 }) }
  if (e.ph === 'broken') { const p = V.mesh.position; Snd.play('boom', { vol: 0.7, rate: 0.6 }); Snd.play('rockfall', { vol: 1, rate: 0.9 }); setTimeout(() => Snd.play('clank', { vol: 0.5, rate: 0.6 }), 200)
    dust.emit([p.x, p.y, p.z], 40, 7, { col: 0x5c5852, heavy: 1, up: 6, size: 1.6 }); dust.emit([p.x, p.y, p.z], 34, 3, { col: 0x7a746a, up: 3, size: 3.2 }); G.boulderBroken = (G.boulderBroken || 0) + 1 }
  if (e.ph === 'hit') { Snd.play('crash', { vol: 1 }); Snd.play('rockfall', { vol: 0.8 }); why(t('why_boulder')); flash('bad') }
}
function boulderAmbient(dt) {
  const st = G.R && G.R.bo, V = G.bv, b = G.bike; if (!st || !V || !b || G.state !== 'play') return
  if (st.ph !== 'warn' && st.ph !== 'roll') return
  bRumbleT -= dt
  if (bRumbleT <= 0) { bRumbleT = st.ph === 'warn' ? 0.6 : 0.45; Snd.play('rumble', { vol: st.ph === 'warn' ? 0.7 : 0.9, rate: 0.5 + Math.random() * 0.1 }) }
  // 小石がぱらぱら（バイクのまわりの上から）・坂の上の土煙・転がる岩の下の土煙
  if (Math.random() < dt * 14) dust.emit([b.p[0] + (Math.random() - 0.5) * 6, b.p[1] + 3 + Math.random() * 2, b.p[2] + (Math.random() - 0.5) * 6], 2, 1.2, { col: 0x6a645c, heavy: 1, up: -1, size: 0.6 })
  const m = V.mesh.position
  if (Math.random() < dt * (st.ph === 'warn' ? 10 : 18)) dust.emit([m.x, m.y - 1.6, m.z], 3, 2.2, { col: 0x8a8278, up: 2.5, size: 2.8 })
}
// v36 小さな猿のような生き物: 予告に鳴く・走る足音・はたかれたら乗り手だけ道の外へ（叫び声は長い落下の声）
let patterT = 0
// v38 鳴き声は店主の声の録音 6 種。毎回ランダム・高さを 0.9〜1.15 で揺らし、匹ごとに少しずらして重ねる（何匹もがキキッと鳴く）
function monkeyCall(n, vol, at = 0) { for (let k = 0; k < n; k++) Snd.play('monkey', { vol: vol * (0.75 + 0.25 * Math.random()), rate: 0.9 + Math.random() * 0.25, jitter: 0, delay: at + k * (0.06 + Math.random() * 0.12) }) }
let chatterT = 0
function chaseFx(c, b) {
  // 予告の鳴き声は、見張り台から飛び降りる時（v36view の impEvents）
  if (c.ph === 'run') { monkeyCall(4, 1); G.patter = true; chatterT = 0.8 }
  if (c.ph === 'lost') monkeyCall(2, 0.6)
  if (c.ph === 'done') { G.patter = false; monkeyCall(1, 0.5) }
  if (c.ph === 'caught') { G.patter = false; Snd.play('monkeyTaunt', { vol: 1, jitter: 0 }); Snd.play('ballhit', { vol: 0.9 }); Snd.play('crash', { vol: 0.8 }); if (bikeView && bikeView.knockOff) bikeView.knockOff(b, scene, b.crashed ? b.crashed.side : 1); setTimeout(() => Snd.play('scream', { vol: 0.75 }), 250); why(t('why_monkey')); flash('bad') }
}
function patterStep(dt) { if (!G.patter || G.state !== 'play') return; chatterT -= dt; if (chatterT <= 0) { chatterT = 0.7 + Math.random() * 0.6; monkeyCall(1 + Math.floor(Math.random() * 3), 0.7) } patterT -= dt; if (patterT <= 0) { patterT = 0.11 + Math.random() * 0.06; Snd.play('patter', { vol: 0.35, rate: 1.5 + Math.random() * 0.4 }) } }
// v36 落とし扉: 開く 1 秒前にきしむ（v37: 0.55→1 秒）（近い時だけ・1 回ずつ）
function doorCreak() {
  const b = G.bike; if (!b || !G.course.traps) return
  for (const T of G.course.traps) { if (T.kind !== 'door') continue; const d = Math.hypot(T.p[0] - b.p[0], T.p[2] - b.p[2]); if (d > 40) continue
    const st = doorAng(T.m, G.world.time), k = st.at === 'lo' && st.left < 1.0 ? 1 : 0
    if (k && !T._cr) Snd.play('creak', { vol: Math.max(0.3, 1 - d / 40), rate: 0.75 }); if (st.at === 'up' && !T._cl) { Snd.play('clank', { vol: Math.max(0.2, 0.8 - d / 50), rate: 0.7 }); T._cl = true } if (st.at !== 'up') T._cl = false; T._cr = k }
}
// ------------------------------------------------------------ v35 兄の跡: 通る時に画面の下へ小さく 1 行（走りは止めない）
let storyT = 0
function storyShow(txt, sec = 4) { const el = $('story'); el.textContent = txt; el.classList.add('on'); clearTimeout(storyT); storyT = setTimeout(() => el.classList.remove('on'), sec * 1000) }
function storyOff() { clearTimeout(storyT); $('story').classList.remove('on') }
function storyStep() {
  const S = G.story, b = G.bike; if (!S || !b || !G.v35) return
  if (S.t0 != null && G.time >= S.t0 && G.running) { S.t0 = null; storyShow(t('story0'), 5) }
  const si = G.steer ? G.steer.i : 0
  for (const tr of G.v35.traces) { if (S.seen[tr.k]) continue; if (si >= tr.i - 6 && si < tr.i + 12 && Math.hypot(b.p[0] - tr.p[0], b.p[2] - tr.p[2]) < 14 && Math.abs(b.p[1] - 0.8 - tr.p[1]) < 3) { S.seen[tr.k] = true; storyShow(lang === 'ja' ? tr.ja : tr.en, 4) } }
}
const pack = arr => { const u = new Uint8Array(arr.length * 4); arr.forEach((v, i) => { u[i * 4] = v.thr * 8 + (v.nitro ? 16 : 0); u[i * 4 + 1] = v.brk * 8 + (v.ab || 0) * 8 * 16; u[i * 4 + 2] = Math.round(v.lean * 16) + 16; u[i * 4 + 3] = Math.round(v.steer * 16) + 16 }); let s = ''; for (const c of u) s += String.fromCharCode(c); return btoa(s) }
function unpack(s) { const r = atob(s), out = []; for (let i = 0; i + 3 < r.length; i += 4) out.push({ thr: (r.charCodeAt(i) & 15) / 8, nitro: r.charCodeAt(i) >> 4 & 1, brk: (r.charCodeAt(i + 1) & 15) / 8, ab: (r.charCodeAt(i + 1) >> 4) / 8, lean: (r.charCodeAt(i + 2) - 16) / 16, steer: (r.charCodeAt(i + 3) - 16) / 16 }); return out }

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
  if (G.state === 'play') { G.state = 'pause'; unlockMouse(); show('pause') }
  else if (G.state === 'pause') { G.state = 'play'; show('hud'); if (isTouch) $('touch').hidden = false }
}
let toastT = 0
function toast(html, sub) { const el = $('toast'); el.innerHTML = html + (sub ? `<small>${sub}</small>` : ''); el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1700) }
let whyT = 0
function why(txt) { const el = $('why'); el.textContent = txt; el.classList.add('on'); clearTimeout(whyT); whyT = setTimeout(() => el.classList.remove('on'), 1800) }
function flash(kind) { const f = $('flash'); f.className = kind; requestAnimationFrame(() => requestAnimationFrame(() => { f.className = '' })) }

// v32 横から飛んできたカラスがライダーに当たる（js/strike.js。押す量はバイクの状態だけで決まるので、ゴーストも同じに押す）
function strikeStep(b, main) {
  const S = G.birds && G.birds.striker; if (!S || !G.course.climb) return
  const r = crowPush(b, S); if (!r || !main) return
  if (r.t === 'near' && !G.strikeVis && r.along > -Math.max(5, b.speed * 0.6)) {
    G.strikeVis = true
    const hx = Math.cos(S.yaw), hz = -Math.sin(S.yaw), rx = Math.sin(S.yaw), rz = Math.cos(S.yaw), dur = Math.max(0.35, -r.along / Math.max(1, b.speed))
    const to = [S.p[0], S.p[1] + 1.7, S.p[2]], from = [to[0] + rx * S.side * 9 + hx * 2, to[1] + 1.2, to[2] + rz * S.side * 9 + hz * 2]
    G.birds.strikeStart(from, to, dur); Snd.play('flap', { vol: 0.7, rate: 1.4 })
  }
  if (r.t === 'hit') {
    G.strikeN = (G.strikeN || 0) + 1
    const p = G.birds.strikeHit(r.h[0], r.h[1]) || [b.p[0], b.p[1] + 0.9, b.p[2]]
    Snd.play('caw', { vol: 1, rate: 1.45 }); Snd.play('flap', { vol: 0.9, rate: 1.7 }); Snd.play('grunt', { vol: 0.8 })
    dust.emit(p, 26, 2.6, { col: 0x1a1a1e, up: 1.5, size: 0.7 }) // 羽が散る
    dust.emit(p, 10, 2.0, { col: 0x3a3a40, up: 0.8, size: 0.5 })
    if (bikeView && bikeView.flinch) bikeView.flinch()
  }
}
function fixedStep() {
  const b = G.bike, c = G.course
  const inp = gatherInput()
  G.inp = inp
  if (!G.running && (inp.thr > 0 || inp.brk > 0 || inp.lean)) G.running = true
  const ev = []
  G.prev = snap(b)
  if (G.running) G.world.tick()
  stepBike(G.world, b, inp, ev)
  strikeStep(b, true)
  if (G.running) { G.rec.inp.push(inp); G.steps++; G.time = G.steps * DT }
  if (G.ghost && G.running) stepGhost()
  for (const e of ev) {
    if (e.t === 'crash') {
      if (bikeView) bikeView.throwRider(b, scene)
      Snd.play('crash', { vol: 0.9 }); Snd.play('clank', { vol: 0.7, delay: 0.12 }); G.shake = 0.2; flash('bad')
      why(t('why_' + e.why) + (e.why === 'hard' ? ` ${e.v.toFixed(1)}m/s` : ''))
    }
    if (e.t === 'land') { const k = Math.min(1, e.impact / 9); Snd.play('land', { vol: 0.25 + k * 0.7 }); if (e.impact > 3) Snd.play('spring', { vol: k * 0.5 }); G.shake = Math.max(G.shake, k * 0.08) }
    if (e.t === 'hop') Snd.play('spring', { vol: 0.5 })
    if (e.t === 'nitro') Snd.play('whoosh', { vol: 0.8 })
    if (e.t === 'launch' && e.to > 11) Snd.play('swish', { vol: 0.6, rate: 0.85 }) // 大ジャンプの踏み切りの風切り（音だけ。画面は変えない）
    if (e.t === 'nitroEmpty') Snd.play('clank', { vol: 0.25, rate: 1.7 })
    if (e.t === 'nitroOff' && e.empty) { G.pusus = (G.pusus || 0) + 1; Snd.duck(0.55, 0.9); Snd.play('pusu', { vol: 0.95, rate: 0.95 + Math.random() * 0.1 }); if (b && b.p) dust.emit([b.p[0] - Math.cos(b.psi) * 0.9, b.p[1] - 0.1, b.p[2] + Math.sin(b.psi) * 0.9], 6, 0.6, { col: 0x8a8a8a, heavy: 0.1, size: 1.1 }) } // ニトロが空になった瞬間、マフラーから「プスッ」（店主の声。v25）
    if (e.t === 'hang') { Snd.play('creak', { vol: 0.7 }); Snd.play('pebbles', { vol: 0.5 }); dust.emit(e.p, 6, 0.8, { col: 0x8a8278, heavy: 1 }) } // 前輪が縁に食い込むきしみと、こぼれる小石
    if (e.t === 'hangWarn') { Snd.play('crack', { vol: 0.6 }); Snd.play('pebbles', { vol: 0.9 }); dust.emit(e.p, 14, 1.2, { col: 0x8a8278, heavy: 1 }) }
    if (e.t === 'hangBreak') { Snd.play('rockbreak', { vol: 0.8 }); dust.emit(e.p, 20, 2, { col: 0x8a8278, heavy: 1 }) }
    if (e.t === 'hangUp') Snd.play('spring', { vol: 0.4 })
    if (e.t === 'thud') { const k = Math.min(1, e.v / 16); Snd.play('land', { vol: 0.7 + k * 0.3 }); Snd.play('clank', { vol: 0.3 + k * 0.4 }); G.shake = Math.max(G.shake, 0.1 + k * 0.1); flash('bad'); if (b.cn[0]) dust.emit(b.cn[0].q, 14, 3.5) }
    if (e.t === 'crumble') { Snd.play('crack', { vol: e.fast ? 1 : 0.7 }); Snd.play('creak', { vol: 0.5 }); if (e.fast) Snd.play('rockfall', { vol: 0.7 }); const sh = G.world.shapes[e.id], c0 = sh && (sh.c || sh.tc); if (c0) { const h = [Math.cos(b.psi), 0, -Math.sin(b.psi)]; dust.emit([c0[0], c0[1] + 0.2, c0[2]], 26, 3, { col: 0x8a7a68, up: 2, size: 1.6 }); dust.emit([c0[0] + h[0] * 0.5, c0[1] + 0.1, c0[2] + h[2] * 0.5], 18, 4, { col: 0x5a4a3c, heavy: 1, up: 3, size: 0.8 }) } }
    // v31: 崩れる板に乗った瞬間（どの速さでも）: 大きくきしむ・ひびの音・砂ぼこり
    if (e.t === 'crumbleTouch') { Snd.play('creak', { vol: 0.9, rate: 1.1 }); Snd.play('crack', { vol: 0.45, rate: 1.3 }); const sh = G.world.shapes[e.id], c0 = sh && (sh.c || sh.tc); if (c0) dust.emit([c0[0], c0[1] + 0.15, c0[2]], 14, 2.2, { col: 0x9a8a76, up: 1.2, size: 1.2 })
      // v32 これから乗る前の板（8m 先まで）にも先にひびが入り、揺れて沈み始める・破片が前と横へ飛ぶ（前を見ていて分かる）
      if (c0) { const hx = Math.cos(b.psi), hz = -Math.sin(b.psi); G.crumbles = G.crumbles || G.world.shapes.filter(x => x.mov && x.mov.type === 'crumble')
        for (const x of G.crumbles) { if (x.gone || x.preWarn != null && G.world.time - x.preWarn < 4) continue; const c1 = x.c || x.tc; if (!c1) continue; const dx = c1[0] - c0[0], dz = c1[2] - c0[2], al = dx * hx + dz * hz; if (al > 0.5 && al < 8 && Math.abs(-dx * hz + dz * hx) < 3 && Math.abs(c1[1] - c0[1]) < 1.5) { x.preWarn = G.world.time; dust.emit([c1[0], c1[1] + 0.1, c1[2]], 6, 2.4, { col: 0x6a5a48, heavy: 1, up: 2.2, size: 0.6 }) } } } }
    if (e.t === 'trapwarn') { Snd.play('pebbles', { vol: 0.9 }); Snd.play('creak', { vol: 0.6 }); dust.emit(e.p, 10, 1.5) }
    if (e.t === 'trapfall') { Snd.play('crack', { vol: 0.9 }); Snd.play('rockfall', { vol: 0.6 }); dust.emit(e.p, 22, 3) }
    if (e.t === 'break') { Snd.play('crack', { vol: 1 }); Snd.play('rockbreak', { vol: 0.7 }); G.shake = Math.max(G.shake, 0.12); dust.emit(b.p, 30, 5) }
    if (e.t === 'knock') { Snd.play(e.tag === 'rock' ? 'rockbreak' : 'ballhit', { vol: 1 }); Snd.play('clank', { vol: 0.6, delay: 0.05 }); G.shake = Math.max(G.shake, 0.2); flash('bad'); dust.emit(b.p, 12, 3) }
  }
  for (const e of ev) { if (e.t === 'girderWarn') { Snd.play('creak', { vol: 1, rate: 0.6 }); Snd.play('chain', { vol: 0.8 }); setTimeout(() => Snd.play('pebbles', { vol: 0.8 }), 400) } if (e.t === 'girderLand') { Snd.play('clank', { vol: 1, rate: 0.5 }); Snd.play('rockbreak', { vol: 0.9 }); dust.emit(e.p, 34, 3.5, { col: 0x6a5a48, up: 1.4, size: 1.3 }) } }
  for (const e of ev) if (e.t === 'drumTurn') { Snd.play('clank', { vol: 0.9, rate: 0.6 }); Snd.play('creak', { vol: 0.9, rate: 0.7 }); Snd.play('rumble', { vol: 0.7 }) } // v35 筒の口の板が回る
  storyStep()
  if (b.hang && Math.random() < DT * 1.2) { Snd.play('creak', { vol: 0.35, rate: 1.1 }); if (b.cn[1]) dust.emit(b.cn[1].q, 2, 0.5, { col: 0x8a8278, heavy: 1, size: 0.6 }) }
  b.impact = 0
  const wasAir = !b.g[0] && !b.g[1]
  const j = judge(G.world, c, G.R, b, G.prev.p)
  G.cpIdx = G.R.cp
  if (j.finish) { finish(); return }
  if (j.can) { Snd.play('clank', { vol: 0.5, rate: 1.3 }); Snd.play('whoosh', { vol: 0.3, rate: 1.4 }) }
  if (j.refill) Snd.play('whoosh', { vol: 0.35, rate: 1.2, delay: 0.25 })
  if (j.gate != null) { const cp = c.cps[j.gate]; if (cp.rest) { (G.R.restSeen = G.R.restSeen || {})[j.gate] = true; Snd.play('save', { vol: 0.55 }); Snd.play('cloth', { vol: 0.7, delay: 0.1 }) } else Snd.play('gate', { vol: 0.5, rate: 0.8 }); toast(cp.name, cp.rest ? t('rest') : fmt(G.time)); flash('on') }
  if (!wasAir) { const cn = b.cn[0] || b.cn[1]; G.lastTag = cn ? G.world.shapes[cn.id].tag : G.lastTag }
  if (wasAir && G.R.fallTop - b.p[1] > 4 && G.lastTag !== 'kicker') {
    if (!G.fallFrom) { G.fallFrom = { y: G.R.fallTop, t: 0 }; Snd.play('swish', { vol: 0.6, rate: 0.6 }); Snd.duck(0.3, 1.2) }
    G.fallFrom.t += DT
    // 長く落ちている時（1.2 秒以上か 8m 以上）は乗り手が叫ぶ。さらに長いと声が裏返る。同じ落下では 1 回、続けて落ちても 5 秒はあける
    const F = G.fallFrom, drop = F.y - b.p[1]
    if (!F.scream && !b.crashed && (F.t > 1.2 || drop > 8) && G.time - (G.lastScream ?? -99) > 5) { F.scream = Snd.play('scream', { vol: 0.75, rate: 0.9 + Math.random() * 0.14, jitter: 0 }); F.sAt = F.t; G.lastScream = G.time; G.screams = (G.screams || 0) + 1 }
    if (F.scream && !F.crack && F.t - F.sAt > 2.6) { F.crack = Snd.play('scream', { vol: 0.55, rate: 1.22 + Math.random() * 0.08, jitter: 0, offset: 0.35 }) || true }
  } else if (!wasAir && G.fallFrom) {
    const d = G.fallFrom.y - b.p[1]
    // 着いたら叫びを止めて、短く「うっ」
    for (const n of [G.fallFrom.scream, G.fallFrom.crack]) if (n && n.stop) { try { n.stop() } catch (e) {} }
    if (G.fallFrom.scream || d > 6) Snd.play('grunt', { vol: 0.6 })
    if (d > 4) { why(t('fell').replace('N', Math.round(d))); G.shake = Math.max(G.shake, Math.min(0.25, 0.1 + d / 80)); flash('bad'); Snd.play('land', { vol: 1 }); Snd.play('clank', { vol: 0.6 }); if (b.cn[0]) dust.emit(b.cn[0].q, 24, 4) }
    G.fallFrom = null
  }
  if (j.chase) chaseFx(j.chase, b)
  if (j.boulder) boulderFx(j.boulder, b)
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
  strikeStep(gh.bike, false)
  gh.i++
}
// v35 最後の場面: 手紙（ENDING.peek 秒まで）→ 門の隙間から、奥へ続く兄のタイヤの跡（2.8 秒）→ 暗くして結果。門の向こうの建物は映さない（床だけを狭く）
const ENDING = { peek: 3.4, dark: 6.2, res: 6.6 }
function endingStep(dt) {
  const E = G.ending; if (!E) return
  E.t += dt
  const tr = G.v35 && G.v35.tracks, peek = E.t >= ENDING.peek && E.t < ENDING.dark, L = $('letter')
  if (tr) tr.visible = peek
  if (bikeView) bikeView.root.visible = !peek && E.t < ENDING.peek
  if (G.ghostView && peek) G.ghostView.root.visible = false
  L.classList.toggle('peek', peek)
  if (peek) { L.classList.remove('on'); $('hud').hidden = true }
  if (E.t >= ENDING.dark && !E.dk) { E.dk = true; L.classList.add('on', 'quiet') } // 結果の後ろは暗いまま
}
function endingCam() {
  const E = G.ending; if (!E || E.t < ENDING.peek || E.t >= ENDING.dark) return false
  const fin = G.course.cps.find(q => q.finish); if (!fin) return false
  const f = [Math.cos(fin.yaw), 0, -Math.sin(fin.yaw)], u = (E.t - ENDING.peek) / (ENDING.dark - ENDING.peek)
  camera.position.set(fin.p[0] - f[0] * (2.6 - u * 0.5), fin.p[1] + 1.3, fin.p[2] - f[2] * (2.6 - u * 0.5))
  camera.lookAt(fin.p[0] + f[0] * 6.5, fin.p[1] - 1.3, fin.p[2] + f[2] * 6.5) // 床だけ（奥の建物は画面の外）
  camera.fov = 34 + (innerWidth < innerHeight ? 14 : 0); camera.updateProjectionMatrix()
  aimLights(camera.position)
  return true
}
// v40 エンドクレジットの作者の写真（丸く小さく）。ページを開いた時に読み込んでおく
const CR_IMG = new Image(); CR_IMG.decoding = 'async'; CR_IMG.width = CR_IMG.height = 72; CR_IMG.src = 'assets/credits/tomo.webp'
function showCredits(done) {
  const C = $('credits'), R = $('crRoll'); G.credits = true; G.creditsN = (G.creditsN || 0) + 1
  R.innerHTML = t('cr').map(([k, v]) => k === 'img' ? `<p class="cr-img"></p>` : `<p class="${k ? 'cr-' + k : ''}">${v}</p>`).join('')
  { const ph = R.querySelector('.cr-img'), im = CR_IMG; im.alt = t('cr').find(x => x[0] === 'img')[1]; if (ph) ph.appendChild(im) } // 先に読み込んである写真（出た瞬間に空白にしない）
  R.classList.remove('roll'); C.hidden = false; void R.offsetWidth; R.classList.add('roll')
  let over = false
  const end = () => { if (over) return; over = true; G.credits = false; C.hidden = true; R.classList.remove('roll'); R.removeEventListener('animationend', end); C.removeEventListener('pointerdown', skip); done() }
  const skip = e => { if (e) { e.preventDefault(); e.stopPropagation() } G.creditsSkipped = (G.creditsSkipped || 0) + 1; end() }
  R.addEventListener('animationend', end); C.addEventListener('pointerdown', skip); G._crSkip = skip
}
function finish() {
  G.state = 'result'
  Snd.play('finish', { vol: 0.7 })
  const id = G.course.id, prev = G.best[id]
  const nb = !prev || G.time < prev.time
  if (nb) { G.best[id] = { time: G.time, faults: G.faults, hard: !!G.R.hard, rec: pack(G.rec.inp), ev: G.rec.ev }; try { localStorage.setItem('sky-best16', JSON.stringify(G.best)) } catch (e) {} }
  const m = MEDAL[id], mi = G.time <= m[0] && G.faults === 0 ? 0 : G.time <= m[1] ? 1 : G.time <= m[2] ? 2 : 3
  $('rCourse').textContent = t(CNAME[id])
  $('rTime').textContent = fmt(G.time); $('rFaults').textContent = G.faults; $('rBest').textContent = fmt(G.best[id].time) + (nb && prev ? '  ' + t('newBest') : '')
  const st = $('rMedal'); st.textContent = t('medal')[mi]; st.classList.remove('pop'); void st.offsetWidth; st.classList.add('pop')
  $('rNext').hidden = id !== 'practice'
  const txt = lang === 'ja' ? `SKY BIKE「${t(CNAME[id])}」を ${fmt(G.time)}（フォルト ${G.faults}）で登りきった` : `Reached the castle in ${fmt(G.time)} (${G.faults} faults) - ${t(CNAME[id])}`
  $('rShare').href = 'https://x.com/intent/post?text=' + encodeURIComponent(txt + ' #SKYBIKE') + '&url=' + encodeURIComponent('https://tom3games.com/play/sky-bike/')
  // v35 持ち物（廃墟の男にもらったハンカチ）
  { const it = $('rItem'); if (G.hank) { it.style.display = ''; it.hidden = false; $('rItemImg').src = hankieDataURL(); $('rItemTxt').textContent = t('hankie') } else { it.style.display = 'none'; it.hidden = true } }
  // v35 第1面: 門の前の兄のヘルメットと手紙。門の向こうは描かずに、暗くして結果へ
  const letter = id === 'stage1'
  if (letter) { $('letterTxt').textContent = t('letter'); $('letter').classList.add('on'); storyOff(); talkOff(); G.ending = { t: 0 } } // 手紙 → 門の隙間から奥へ続く兄のタイヤの跡 → 暗くして結果（endingStep）
  // v39 本人「シンプルなエンドクレジット」: 門の場面の後、曲は流したまま黒地に白い字で下から上へ（約 36 秒）。タップ・クリック・キーで飛ばせる。その後に結果
  setTimeout(() => { if (G.state !== 'result') return; const res = () => { if (G.state === 'result') { show('result'); $('hud').hidden = false } }; if (letter) showCredits(res); else res() }, letter ? ENDING.res * 1000 : 900)
  refreshBest()
}

// ------------------------------------------------------------ チュートリアル（第1面の序盤で1つずつ。やったら消える）
const TUT_KEY = { thr: '左クリック', back: 'A', fwd: 'D', air: 'A D', brk: '右クリック', climb: 'A D 左クリック' } // PC（v17 のマウスと A/D）
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
    if (q.key === 'climb') done = (T.hung && !b.hang && b.g[0]) || si > q.i + 24; if (b.hang) T.hung = true
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
const _dv = new THREE.Vector3()
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
  // v16: 塔のそばでは、カメラを塔と反対の側に置く（塔の壁に寄って画面の半分が壁になるのを防ぐ）
  for (const T of G.course.towers || []) {
    if (Math.hypot(bp.x - T.cx, bp.z - T.cz) > T.r + 9 || bp.y < T.y0 - 6 || bp.y > (T.top2 ?? T.top) + 4) continue
    const side = s => { const a2 = G.camYaw + Math.PI + s * 0.62; return Math.hypot(bp.x + Math.cos(a2) * 6.4 - T.cx, bp.z - Math.sin(a2) * 6.4 - T.cz) }
    G.camSideT = side(1) >= side(-1) ? 1 : -1
  }
  G.camSide += ((G.camSideT ?? 1) - G.camSide) * Math.min(1, dt * 1.2)
  let ang = 0.62 + (air ? Math.min(0.3, b.airT * 0.4) : 0)
  G.camAng = G.camAng == null ? ang : G.camAng + (ang - G.camAng) * Math.min(1, dt * 1.8)
  // v17: マウスで回したカメラ（バイクのまわりを回る・上下）。動かさずに 2 秒たつと、走っている間はゆっくり後ろへ戻る
  const CO = G.camOff || { yaw: 0, pitch: 0, idle: 9 }
  CO.idle += dt
  if (CO.idle > 2 && Math.abs(b.speed) > 1.5 && !G.fallFrom) { const k = Math.min(1, dt * 1.2); CO.yaw -= CO.yaw * k; CO.pitch -= CO.pitch * k }
  const a = G.camYaw + Math.PI + G.camSide * G.camAng * Math.max(0, 1 - Math.abs(CO.yaw) * 1.5) + CO.yaw
  const dist = 6.4 * (1 - CO.pitch * 0.25), hgt = 2.7 + CO.pitch * 4.2
  const lookYaw = G.camYaw + CO.yaw, hx = Math.cos(lookYaw), hz = -Math.sin(lookYaw)
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
  // v35 回る筒の中: 筒の横の壁の近く（軸の高さ）から、回るバイクを見る（後ろのカメラは筒の壁に埋まる）
  { let k = 0
    for (const d of (G.world && G.world.drums) || []) { const dx = bp.x - d.c[0], dy = bp.y - d.c[1], dz = bp.z - d.c[2], lat = dx * d.ax[0] + dz * d.ax[2], fw = dx * d.f[0] + dz * d.f[2]; if (Math.abs(lat) < d.hw + 0.5 && Math.hypot(fw, dy) < d.R + 0.6 && Math.abs(fw) < d.R * 0.88) { k = 1; G.drumD = d } }
    G.drumK = (G.drumK || 0) + (k - (G.drumK || 0)) * Math.min(1, dt * 3)
    if (G.drumK > 0.01 && G.drumD) { const d = G.drumD, s0 = d.hw - 0.6
      _dv.set(d.c[0] - d.ax[0] * s0 + (bp.x - d.c[0]) * 0.3, d.c[1] + (bp.y - d.c[1]) * 0.3, d.c[2] - d.ax[2] * s0 + (bp.z - d.c[2]) * 0.3)
      _v.lerp(_dv, G.drumK); _t.lerp(_dv.set(bp.x, bp.y, bp.z), G.drumK) } }
  if (isNaN(G.camPos.x)) { G.camPos.copy(_v); G.camTgt.copy(_t) }
  G.camPos.lerp(_v, Math.min(1, dt * 6)); G.camTgt.lerp(_t, Math.min(1, dt * 9))
  camera.position.copy(G.camPos)
  G.shake = 0 // 画面の揺れは入れない（本人の決まり: 揺れ・視野角の変化・速さの演出なし）
  camera.lookAt(G.camTgt)
  G.fov = 56
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
  G.zl = G.zl || { tint: 0, hemi: 1.35, dens: 1, col: new THREE.Color(fogBase) }
  G.zl.col.lerp(_c1.setHex(zp.col), zk); G.zl.tint += (zp.tint - G.zl.tint) * zk; G.zl.hemi += (zp.hemi - G.zl.hemi) * zk; G.zl.dens += (zp.dens - G.zl.dens) * zk
  scene.fog.color.copy(fogBase).lerp(_c1.setHex(0x5a3b2c), lava * 0.55).lerp(G.zl.col, G.zl.tint)
  scene.fog.near = FOG_BASE * G.zl.dens * (1 - Math.min(0.3, Math.max(0, y - 150) / 700)) // 高い所ほど澄む
  scene.fog.far = y - 9
  hemi.intensity = G.zl.hemi
  // v38 区間ごとの光の色（谷は青緑・工場は橙・氷は青白・草原は昼）。光の数は同じで色だけ、2〜3 秒かけて寄せる
  { const L = ZLIGHT[(zq && zq.zone) || 'ruin'] || ZLIGHT.ruin, now = performance.now() / 1000, ldt = Math.min(0.1, now - (G._lct || now)); G._lct = now
    const lk = G.zlc ? 1 - Math.exp(-ldt / 0.85) : 1
    G.zlc = G.zlc || { moon: new THREE.Color(L[0]), fill: new THREE.Color(L[1]), hemi: new THREE.Color(L[2]) }
    G.zlc.moon.lerp(_c1.setHex(L[0]), lk); G.zlc.fill.lerp(_c1.setHex(L[1]), lk); G.zlc.hemi.lerp(_c1.setHex(L[2]), lk)
    fill.color.copy(G.zlc.fill); hemi.color.copy(G.zlc.hemi) }
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
const motes = buildMotes(scene, lowEnd) // v43
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

// 土ぼこり・砂利・雪・水しぶき（後輪が巻き上げる・着地・急ブレーキ）。粒ごとに色と重さ
const SURF = { cobble: [0x76706a, 0.5], stone: [0x76706a, 0.5], ruinwall: [0x76706a, 0.5], dirt: [0x6a5a48, 0.4], ground: [0x5a4a3a, 0.4], basalt: [0x4a4644, 0.6], rock: [0x5c5852, 0.6], mud: [0x3e3022, 1.6], snowrock: [0xe8eef4, 0.25], ice: [0xd8e6f2, 0.3], snow: [0xf2f6fa, 0.2], wetstone: [0xbcd4e0, 1.2], water: [0xc8e0f0, 1.2], plank: [0x8a7458, 0.5], plankold: [0x7a6650, 0.5], crate: [0x8a7458, 0.5], bridgeplank: [0x8a7458, 0.5], castle: [0x9a948c, 0.5], grate: [0x6a4a38, 0.6], rust: [0x6a4a38, 0.6] }
const dust = (() => {
  const N = 420, geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), al = new Float32Array(N), col = new Float32Array(N * 3), sz = new Float32Array(N)
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('alpha', new THREE.BufferAttribute(al, 1)); geo.setAttribute('col', new THREE.BufferAttribute(col, 3)); geo.setAttribute('sz', new THREE.BufferAttribute(sz, 1))
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: 'attribute float alpha; attribute vec3 col; attribute float sz; varying float vA; varying vec3 vC; void main(){ vA = alpha; vC = col; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = ((1.0 - alpha) * 260.0 * sz + 30.0 * sz) / -mv.z + 3.0; gl_Position = projectionMatrix * mv; }', fragmentShader: 'varying float vA; varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC, vA * 0.55 * (1.0 - d * 2.0)); }' })
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; scene.add(pts)
  const P = Array.from({ length: N }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, g: 0, fade: 1.4 }))
  let k = 0; const cc = new THREE.Color()
  return {
    // p 位置・n 数・spd 散る速さ・o: { col 色, back [x,z] 後ろへ飛ばす向き, heavy 重さ（落ちる速さ）, size 大きさ }
    emit(p, n, spd, o = {}) { cc.setHex(o.col ?? 0x6a6660); for (let i = 0; i < n; i++) { const q = P[k = (k + 1) % N]; q.p.set(p[0], p[1] + 0.05, p[2]); const bx = o.back ? o.back[0] : 0, bz = o.back ? o.back[1] : 0; q.v.set((Math.random() - 0.5) * spd + bx * (0.5 + Math.random()), Math.random() * spd * 0.6 + (o.up || 0) * Math.random(), (Math.random() - 0.5) * spd + bz * (0.5 + Math.random())); q.life = 1; q.g = (o.heavy || 0) * 9.81; q.fade = o.heavy > 0.9 ? 2.2 : 1.4; col[k * 3] = cc.r; col[k * 3 + 1] = cc.g; col[k * 3 + 2] = cc.b; sz[k] = o.size || 1 } geo.attributes.col.needsUpdate = true; geo.attributes.sz.needsUpdate = true },
    update(dt) { for (let i = 0; i < N; i++) { const q = P[i]; if (q.life > 0) { q.life -= dt * q.fade; q.v.y -= q.g * dt; q.p.addScaledVector(q.v, dt); q.v.multiplyScalar(1 - dt * 2) } pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z; al[i] = Math.max(0, q.life) } geo.attributes.position.needsUpdate = true; geo.attributes.alpha.needsUpdate = true },
  }
})()
// タイヤの跡（急ブレーキ・空回り）: 道の面に貼る黒い帯。古い物から消える
const skid = (() => {
  const N = 600, g = new THREE.PlaneGeometry(0.16, 0.42); g.rotateX(-Math.PI / 2)
  const m = new THREE.MeshBasicMaterial({ color: 0x0a0908, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
  const im = new THREE.InstancedMesh(g, m, N); im.frustumCulled = false; im.count = 0; scene.add(im)
  const o = new THREE.Object3D(); let k = 0, last = null
  return {
    mark(p, n, yaw) {
      if (last && Math.hypot(p[0] - last[0], p[2] - last[2]) < 0.3) return
      last = p.slice(); o.position.set(p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02)
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(n[0], n[1], n[2])); o.rotateY(yaw - Math.PI / 2); o.updateMatrix()
      im.setMatrixAt(k, o.matrix); k = (k + 1) % N; im.count = Math.max(im.count, k === 0 ? N : k); im.instanceMatrix.needsUpdate = true
    },
    lift() { last = null },
    clear() { im.count = 0; k = 0; last = null },
  }
})()
// 路面とのやりとり: 後輪が巻き上げる粒（路面ごとに色と重さ）、急ブレーキの跡と砂利の音、ニトロの火の粉
let gravT = 0
function surfaceFx(b, dt) {
  const pa = b._airPrev || 0; b._airPrev = b.airT; b._prevAir = pa
  if (G.state !== 'play' || b.crashed) { skid.lift(); return }
  const cn = b.cn[0], sh = cn && b.g[0] ? G.world.shapes[cn.id] : null, sp = Math.abs(b.speed)
  const sf = sh ? (sh.mud ? SURF.mud : sh.flowR || sh.flowT ? SURF.water : SURF[sh.mat] || [0x6a6660, 0.5]) : null
  const hx = Math.cos(b.psi), hz = -Math.sin(b.psi)
  // 泥から後輪が抜けた瞬間に「ブリュッ」（本人の声。v24）
  const onMud = !!(sh && sh.mud); b._mudT = onMud || (!sh && b._wasMud) ? (b._mudT || 0) + dt : b._mudT || 0 // 泥の上で跳ねた間も泥の時間に数える
  b._offMud = onMud ? 0 : sh ? (b._offMud || 0) + dt : b._offMud || 0 // 浮いている間は数えない
  if (b._wasMud && sh && !sh.mud && b._mudT > 0.3 && sp > 0.8 && !(G._mudFartT > performance.now() / 1000 - 3)) { G.mudFarts = (G.mudFarts || 0) + 1; Snd.duck(0.55, 0.9); Snd.play('mudfart', { vol: 0.9, rate: 0.95 + Math.random() * 0.1 }); G._mudFartT = performance.now() / 1000; if (cn) dust.emit(cn.q, 8, 1.6, { col: SURF.mud[0], heavy: 1.6, up: 2.5, size: 0.8 }) }
  if (b._offMud > 0.3) b._mudT = 0 // 泥の上で一瞬だけ別の面に触れても数え直さない
  if (sh && (onMud || b._offMud > 0.12)) b._wasMud = onMud // 跳ねて浮いた間は泥にいたまま扱い（1回の泥で2回鳴らない）
  if (sf) {
    const thr = G.inp.thr, acc = thr > 0 ? Math.min(1, 0.3 + thr * (sp < 6 ? 1 : 0.5)) : 0
    const nAcc = acc * (b.nitroOn ? 2.5 : 1) * dt * (sp < 3 ? 28 : 16)
    if (Math.random() < nAcc) dust.emit(cn.q, 1 + (b.nitroOn ? 1 : 0), 1.2 + sf[1], { col: sf[0], back: [-hx * (2 + sp * 0.25), -hz * (2 + sp * 0.25)], heavy: sf[1], up: sf[1] > 1 ? 2.5 : 0.8, size: sf[1] > 1 ? 0.7 : 1 })
    // 急ブレーキ: タイヤの跡・粒・砂利の音
    const hard = G.inp.brk > 0 && sp > 4
    if (hard) { skid.mark(cn.q, cn.nw || cn.n, b.psi); if (Math.random() < dt * 30) dust.emit(cn.q, 1, 0.8, { col: sf[0], back: [hx * 1.5, hz * 1.5], heavy: sf[1] * 0.5, size: 0.8 }); gravT -= dt; if (gravT < 0) { gravT = 0.16; Snd.play('gravel', { vol: Math.min(0.55, 0.15 + sp / 30), rate: 0.9 + sp / 40 }) } }
    else skid.lift()
  } else skid.lift()
  // 着地の砂ぼこり
  if (b._landDust !== b.steps && cn && b.airT === 0 && b._prevAir > 0.35) { dust.emit(cn.q, 16, 3.2, { col: sf ? sf[0] : 0x6a6660, heavy: 0.2, size: 1.3 }); b._landDust = b.steps }
  // ニトロの量（スマホのボタンの輪・画面左上のボトル）
  const n = b.nitro ?? 1
  if (G._nShown !== Math.round(n * 50) || G._nOn !== b.nitroOn) {
    G._nShown = Math.round(n * 50); G._nOn = b.nitroOn
    const bt = document.querySelector('.tb.nit'); if (bt) { bt.style.setProperty('--n', n.toFixed(3)); bt.classList.toggle('empty', n <= 0.001) }
    const f = $('nitroFill'); if (f) { f.setAttribute('height', (29 * n).toFixed(1)); f.setAttribute('y', (7 + 29 * (1 - n)).toFixed(1)) }
    $('nitroHud').classList.toggle('on', !!b.nitroOn)
  }
}
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
// v44 本人「落下した時、ずっと下まで落ちるまで待たなあかん」: 長い落下（1.2 秒たっても、まだ 0.8 秒以上落ちそうな時）は、
// 0.3 秒で暗くして、物理をそのまま早送り（着地・旗へ戻す などの結果は待った時と同じ）→ 明るくする。落ちている間にタップ/クリック/キーで、すぐ飛ばせる。
// ジャンプ台・大ジャンプ（kicker から）は G.fallFrom が立たないので対象外。短い落下も対象外
function fallRemain(b) { const r = G.world.rayDown(b.p[0], b.p[2], b.p[1] - 0.5, b.p[1] - 400); const vy = -b.v[1]; if (!isFinite(r.y)) return 99; const h = Math.max(0, b.p[1] - 0.8 - r.y), g = 9.81; return (-vy + Math.sqrt(vy * vy + 2 * g * h)) / g }
function fallSkipWant(force) {
  const F = G.fallFrom, b = G.bike; if (!F || !b || G.skip || G.state !== 'play' || G.noFallSkip) return false
  if (F.t < (force ? 0.35 : 1.2)) return false
  return fallRemain(b) > 0.8
}
function fallSkipStep(dt) {
  const fd = $('fade')
  if (!G.skip) { if (fallSkipWant(false)) { G.skip = { ph: 'out', t: 0 }; G.fallSkips = (G.fallSkips || 0) + 1 } else return false }
  const S = G.skip; S.t += dt
  if (S.ph === 'out') { fd.style.opacity = Math.min(1, S.t / 0.3); if (S.t < 0.3) return false; S.ph = 'ff' } // 暗くなる間は落ち続ける
  if (S.ph === 'ff') {
    fd.style.opacity = 1
    const b0 = G.bike; let n = 0
    while (n < 60 * 25 && G.state === 'play' && G.bike === b0 && G.fallFrom) { fixedStep(); n++ } // 着地するか、旗へ戻されるまで
    G.acc = 0; G.prev = snap(G.bike); G.camPos.set(NaN, 0, 0); S.ph = 'in'; S.t = 0; S.n = n; return true
  }
  if (S.ph === 'in') { fd.style.opacity = Math.max(0, 1 - S.t / 0.3); if (S.t >= 0.3) { G.skip = null; fd.style.opacity = 0 } return false }
  return false
}
function fallSkipNow() { if (fallSkipWant(true)) { G.skip = { ph: 'out', t: 0.2 }; G.fallSkips = (G.fallSkips || 0) + 1; G.fallSkipTap = (G.fallSkipTap || 0) + 1; return true } return false }
// ------------------------------------------------------------ 主ループ（物理は固定 60Hz）
let last = performance.now(), frames = 0, fpsT = 0
G.fps = 0
function frame(now) {
  requestAnimationFrame(frame)
  let dt = Math.min(0.1, (now - last) / 1000); last = now
  frames++; fpsT += dt; if (fpsT > 1) { G.fps = frames / fpsT; frames = 0; fpsT = 0 }
  if (G.state === 'play' && !G.paused && !G.hold) { if (fallSkipStep(dt)) dt = 0; else dt = advance(dt) }
  const alpha = G.state === 'play' ? Math.min(1, G.acc / DT) : 1
  if (G.bike && bikeView) {
    bikeView.sync(G.bike, G.prev, alpha)
    const b = G.bike
    surfaceFx(b, dt)
  }
  if (G.ghost && G.ghostView) { const gh = G.ghost; G.ghostView.root.visible = gh.i < gh.rec.length; if (gh.bike) G.ghostView.sync(gh.bike, gh.prevSnap, alpha) }
  dust.update(dt)
  const tm = now / 1000
  if (built) {
    // 準備完了の後の仕事を 1 コマに 1 つ（今のカメラに一番近い物から）
    if (built.tasks.length && window.__skyReady) runTask()
    // 近い升目は細かく、遠い升目は軽い影に。塔の飾りは塔から 320m 以内だけ
    if (!G.lodAll && (G._lodN = (G._lodN || 0) + 1) % 6 === 0) lod()
    if (built.movers.length) updateMovers(built.movers, G.world, G.lodAll ? null : camera.position)
    boomUpdate(Math.min(dt, 0.05))
    hornUpdate(Math.min(dt, 0.05))
    if (G.v35) G.v35.update(Math.min(dt, 0.05), tm, camera.position)
    if (G.bv) { G.bv.update(G.R && G.R.bo); boulderAmbient(Math.min(dt, 0.05)) }
    if (G.ladyV) G.ladyV.update(Math.min(dt, 0.05), camera.position, G.state === 'play' || G.state === 'pause' ? G.bike : null)
    if (G.v36) { G.v36.update(Math.min(dt, 0.05), tm, camera.position, G.world, G.R, G.state === 'play' ? G.bike : null); for (const k of G.v36.impEvents()) if (G.state === 'play') { monkeyCall(2, 0.95); monkeyCall(2, 0.8, 0.25) } for (const e of G.v36.pressEvents()) { Snd.play('clank', { vol: 1, rate: 0.55 }); Snd.play('rockbreak', { vol: 0.7, rate: 0.8 }); Snd.play('crack', { vol: 0.6 }); dust.emit([e.p[0], e.p[1] + 2.4, e.p[2]], 30, 2.5, { col: 0x6a5a48, up: 0.5, size: 1.2 }); dust.emit([e.p[0], e.p[1] + 2.4, e.p[2]], 14, 1.6, { col: 0x8a7a68, heavy: 1, size: 0.6 }) } }
    if (G.state === 'play') doorCreak()
    if (G.state === 'play') { hermitStep(Math.min(dt, 0.05)); ladyStep(Math.min(dt, 0.05)) }
    patterStep(Math.min(dt, 0.05))
    bgmStep(Math.min(dt, 0.05))
    drumSound(dt)
    v37Step(Math.min(dt, 0.05), tm)
    if (G.birds) for (const e of G.birds.update(Math.min(dt, 0.05), G.state === 'play' && G.bike && !G.bike.ghost ? { p: G.bike.p, speed: G.bike.speed } : null, camera.position)) {
      const d = Math.hypot(camera.position.x - e.p[0], camera.position.y - e.p[1], camera.position.z - e.p[2]), v = Math.max(0, 1 - d / 40)
      if (v > 0) { Snd.play('flap', { vol: Math.min(1, 0.45 + e.n * 0.1) * v, rate: 1.5 + Math.random() * 0.3 }); if (e.n > 1 || Math.random() < 0.5) setTimeout(() => Snd.play('caw', { vol: 0.5 * v, rate: 0.9 + Math.random() * 0.2 }), 120 + Math.random() * 300) }
      G.birdEv = (G.birdEv || 0) + 1
    }
    { let ry = null; const R = G.R; if (R && R.rise && G.course.risers) G.course.risers.forEach((rs, k) => { const t0 = R.rise[k]; if (t0 != null && t0 >= 0) ry = riserY(rs, G.world.time - t0) }); built.riser.visible = ry != null; if (ry != null) built.riser.position.y = ry }
    if (G.gim && G.world) for (const e of G.gim.update(G.world, G.state === 'play' ? G.bike : null, Math.min(dt, 0.05), tm, G.R, camera.position)) {
      const d = Math.hypot(camera.position.x - e.p[0], camera.position.y - e.p[1], camera.position.z - e.p[2]), v = Math.max(0, 1 - d / 45)
      if (v <= 0) continue
      if (e.t === 'splash') Snd.play('splash', { vol: 0.8 })
      if (e.t === 'rockWarn') Snd.play('pebbles', { vol: v * 0.8 })
      if (e.t === 'rockFall') Snd.play('rockfall', { vol: v * 0.9 })
      if (e.t === 'collapse') { Snd.play('rumble', { vol: Math.min(1, v * 1.2) }); setTimeout(() => Snd.play('rockbreak', { vol: v * 0.9 }), 600 + Math.random() * 300) }
      if (e.t === 'rockHit') { Snd.play('rockbreak', { vol: v }); if (d < 14) G.shake = Math.max(G.shake, 0.08 * v) }
    }
    updateFlames(built.flames, tm); updateFlames(built.farGlow, tm)
    built.lava.material.uniforms.time.value = tm
    built.fogL.update(camera.position, tm)
  }
  sky.material.uniforms.time.value = tm
  grade.uniforms.time.value = tm % 100
  if (bikeView && G.world) bikeView.updateRider(Math.min(dt, 0.05), G.world)
  endingStep(Math.min(dt, 0.05))
  if (G.state === 'play' || G.state === 'pause' || G.state === 'result') { if (!endingCam()) updateCamera(dt, alpha); if (G.state !== 'result') hud() }
  else if (G.state !== 'debug') titleCam(tm)
  ash.update(Math.min(dt, 0.05), camera.position, tm)
  if (!G.fogFreeze) FOGT.value = tm // v43 霧の流れ（テストで止められる）
  { const zq = G.course && G.course.path[(G.steer && G.bike ? G.steer.i : G.titleI) || 0]; motes.update(Math.min(dt, 0.05), camera.position, tm, zq && zq.zone) } // v43 区間ごとに舞う粒
  soundUpdate(dt)
  renderer.info.reset()
  if (G.noPost) renderer.render(scene, camera); else composer.render(dt)
}
function runTask() {
  const T = built.tasks, cp = camera.position
  let bi = 0, bd = 1e18
  T.forEach((t, i) => { const d = (t.at[0] - cp.x) ** 2 + (t.at[1] - cp.y) ** 2 + (t.at[2] - cp.z) ** 2; if (d < bd) { bd = d; bi = i } })
  const t = T.splice(bi, 1)[0]; t.run()
  lod()
}
function lod() {
  if (!built || !built.chunkMap) return
  const cp = camera.position
  if (G.lodAll) { for (const ch of built.chunkMap.values()) { for (const m of ch.det) m.visible = true; if (ch.far) ch.far.visible = !ch.built } for (const d of built.decos) d.visible = true; return }
  updateLOD(built.chunkMap.values(), cp)
  for (const d of built.decos) { const c = d.userData.ctr; d.visible = !c || Math.hypot(c[0] - cp.x, c[1] - cp.y, c[2] - cp.z) < 320 }
}
function advance(dt) {
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
  const p = G.course.path, i = G.titleI ?? (G.titleI = titleShot()), q = p[i]
  // 塔が画面の右に来る向きから見る（左はメニュー）。道の進む向きで塔が左になるなら、道を逆向きに見る
  const TT = titleTower(G.course)
  const back = TT && G.course.towers && G.course.towers.length ? (q.p[0] - TT.cx) * Math.sin(q.yaw) + (q.p[2] - TT.cz) * Math.cos(q.yaw) > 0 : false
  const a = p[Math.max(0, Math.min(p.length - 1, i + (back ? -16 : 16)))]
  const yaw = q.yaw + (back ? Math.PI : 0), hx = Math.cos(yaw), hz = -Math.sin(yaw), rx = Math.sin(yaw), rz = Math.cos(yaw)
  const sway = Math.sin(tm * 0.12) * 0.5
  const side = -1 // カメラは塔の外側（左）
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
    const tis = buildTitleIsland(G.course, scene, built.M, cands, titleTower(G.course))
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
function toMenu() { bgmStop(1.0); $('letter').classList.remove('on', 'quiet', 'peek'); G.ending = null; if (G.v35 && G.v35.tracks) G.v35.tracks.visible = false; G.state = 'title'; G.bike = null; $('tut').classList.remove('on'); if (G.ghostView) G.ghostView.root.visible = false; show('title'); if (G.course.id !== 'stage1') loadCourse('stage1') }

// ------------------------------------------------------------ 起動（最初の画面に要る物だけ待つ。模型・環境光・乗り手はあとから）
async function boot() {
  const fill = $('ldFill')
  applyLang()
  loadCourse('stage1'); fill.style.width = '45%'
  bikeView = new BikeView(scene)
  bikeView.root.visible = false
  setTimeout(warmShaders, 0)
  await new Promise(r => setTimeout(r, 30))
  const LM = window.__loadMarks = window.__loadMarks || {}, c0 = performance.now(); LM.boot = Math.round(c0)
  try { await renderer.compileAsync(scene, camera) } catch (e) { renderer.compile(scene, camera) } fill.style.width = '100%'; LM.compile = Math.round(performance.now() - c0)
  G.state = 'title'; show('title')
  window.__skyReady = true; if (readyRes) readyRes()
  if (Q.get('course')) startRun(Q.get('course'))
  // 後から読む物
  bikeView.loadRider('assets/models/Rider.glb').catch(e => console.warn('rider', e))
  loadEnv(); loadProps(); loadBackdrop()
}
G.startRun = startRun
G.bgm = BGM
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a'); if (a && /tom3games\.com\/?$|横丁/.test(a.href + a.textContent)) bgmStop(1.0) }, true) // 横丁へ戻る時も 1 秒で消す
G.api = { buildAll: () => { while (built && built.tasks && built.tasks.length) runTask() }, lodAll: on => { G.lodAll = on; lod() }, closest: (s, x, y, z) => { const o = closest(s, x, y, z, { q: [0, 0, 0], n: [0, 0, 0], d: 0, feat: 0 }); return { d: o.d } }, advance, loadCourse, DT, stepBike, hashBike, createBike, World, BIKE, basis, wheelCenter, scene, camera, renderer, three: THREE, get built() { return built }, get bikeView() { return bikeView }, fixedStep, spawnAt, retryCp, placeBike, toast, setLang: l => { lang = l; applyLang() } }
requestAnimationFrame(frame)
boot()
