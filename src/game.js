// Orquestra tudo: carregamento das fases, estados do jogo (título, seleção,
// jogando, pausa, morte, captura, final, opções, guarda-roupa, memórias,
// epílogo), cronômetro, medalhas e recordes, fantasma do recorde, a Sombra,
// os dois mundos do Véu, fragmentos de memória, modo speedrun e a sequência
// do Artefato.
import * as THREE from 'three';
import { createScene, ENVS } from './scene.js';
import { createMaterials } from './materials.js';
import { PhysicsWorld, KILL } from './physics.js';
import { Effects } from './effects.js';
import { LevelBuilder } from './levels/builder.js';
import { LEVELS } from './levels/index.js';
import { Player, RADIUS, HEIGHT } from './player.js';
import { CameraController } from './cameraController.js';
import { VeilStep } from './veilStep.js';
import { Guardian } from './guardian.js';
import { UI } from './ui.js';
import { Input } from './input.js';
import { AudioSystem } from './audio.js';
import { loadSettings, saveSettings } from './settings.js';
import { SKINS, skinById, skinUnlocked } from './skins.js';
import { LORE, CHAPTERS, PROLOGUE_LINES } from './lore.js';
import { Recorder, GhostRunner, Shadow, saveGhost, loadGhost } from './echo.js';

// relógio simples por quadro (o THREE.Clock está obsoleto)
class FrameClock {
  constructor() {
    this.last = performance.now();
  }

  getDelta() {
    const now = performance.now();
    const d = (now - this.last) / 1000;
    this.last = now;
    return d;
  }
}

const BLOOM_STRENGTH = 0.8;
const STATE_RANK = { patrol: 0, return: 0, suspicious: 1, chase: 2 };
const SAVE_KEY = 'veil.progress.v2';
const DEATH_PAUSE = 0.45;
const DEATH_COLOR = new THREE.Color(2.2, 0.3, 0.8);
const RING_COLOR = new THREE.Color(2, 1.5, 0.4);
const FRAG_COLOR = new THREE.Color(2.2, 1.7, 0.8);
const VIOLET = new THREE.Color(1.4, 0.5, 2.6);
const MUSIC_BY_CHAPTER = ['run', 'run', 'run', 'veu', 'final', 'veu'];
const MENU_STATES = new Set(['title', 'select', 'options', 'wardrobe', 'memories', 'epilogue', 'credits', 'intro']);

function freshProgress() {
  return { best: {}, fragments: {}, feats: {}, skin: 'andarilho', speedrunBest: null, unlockAll: false };
}

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null');
    if (p && typeof p === 'object' && p.best) return { ...freshProgress(), ...p };
  } catch {
    /* armazenamento indisponível */
  }
  return freshProgress();
}

export class Game {
  constructor(container, version = 'dev') {
    this.version = version;
    const s = createScene(container);
    this.renderer = s.renderer;
    this.scene = s.scene;
    this.camera = s.camera;
    this.composer = s.composer;
    this.bloom = s.bloom;
    this.moon = s.moon;
    this.sky = s.sky;
    this.followMoon = s.followMoon;
    this.setEnv = s.setEnv;
    this.resizeAll = s.resize;

    this.materials = createMaterials(this.renderer);
    this.world = new PhysicsWorld();
    this.effects = new Effects(this.scene);
    this.player = new Player(this.scene, this.world);
    this.effects.initGhosts(this.player.root);
    this.cam = new CameraController(this.camera, this.world);
    this.audio = new AudioSystem();
    this.veil = new VeilStep(this);
    this.ui = new UI();
    this.input = new Input(this.renderer.domElement);
    this.recorder = new Recorder();
    this.ghost = new GhostRunner(this.scene, this.world);
    this.shadow = new Shadow(this.scene, this.world);
    this.guardians = [];
    this.level = null;
    this.levels = LEVELS;
    this.progress = loadProgress();
    this.settings = loadSettings();
    this.wearSkin(skinById(this.progress.skin));

    this.state = 'title';
    this.time = 0;
    this.stateTime = 0;
    this.slowmo = 0;
    this.shiftCooldown = 0;
    this.navRepeat = 0;
    this.speedrun = null;
    this.optionsReturn = 'select';
    this.stats = { time: 0, deaths: 0, veils: 0, topSpeed: 0 };
    this.move = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();

    this.updateViewport = () => this.effects.setViewport(window.innerHeight * this.renderer.getPixelRatio(), 68);
    this.updateViewport();
    s.resizeListeners.push(this.updateViewport);

    this.applySettings();
    this.wireEvents();
    this.loadLevel(0, true);
    this.openTitle();

    this.clock = new FrameClock();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);

    if (import.meta.env.DEV) {
      window.__veil = this;
      // atalhos de desenvolvimento: ?play=<id da fase> · ?screen=select|wardrobe|memories|options · ?run=1 (segura W)
      const q = new URLSearchParams(location.search);
      const i = this.levels.findIndex((l) => l.id === q.get('play'));
      if (i >= 0) this.playLevel(i);
      const scr = q.get('screen');
      if (scr === 'select') this.openSelect();
      else if (scr === 'wardrobe') this.openWardrobe();
      else if (scr === 'memories') this.openMemories();
      else if (scr === 'options') this.openOptions('select');
      if (q.get('run')) this.input.down.add('KeyW');
      if (q.get('skin')) this.wearSkin(skinById(q.get('skin')));
      if (q.get('anim')) this.demo = q.get('anim');
      if (q.get('pos')) this.respawn(new THREE.Vector3(...q.get('pos').split(',').map(Number)), 0);
      if (q.get('dim')) this.tryShift();
      // ?ff=segundos: avança a simulação (para fotos de ações no meio)
      const ff = Number(q.get('ff') ?? 0);
      for (let t = 0; t < ff; t += 1 / 60) this.tick(1 / 60);
    }
  }

  // Veste o manto no jogador e nos ecos (fantasma e Sombra copiam a forma).
  wearSkin(skin) {
    this.player.setSkin(skin);
    this.ghost?.setSkin(skin);
    this.shadow?.setSkin(skin);
  }

  get levelDef() {
    return this.levels[this.levelIndex];
  }

  get stealth() {
    return this.levelDef.type === 'stealth';
  }

  // ------------------------------------------------------------- opções
  applySettings() {
    const st = this.settings;
    this.input.setBindings(st.keys ?? {});
    this.ui.setKeyLabels?.(this.input);
    this.cam.sensitivity = st.sensitivity;
    this.cam.padSensitivity = st.padSensitivity;
    this.cam.invertY = st.invertY;
    this.cam.baseFov = st.fov;
    this.cam.shakeScale = st.shake ? 1 : 0;
    this.audio.setVolumes(st.volume, st.music);
    const q = st.quality;
    const pr = q === 'alta' ? Math.min(window.devicePixelRatio, 1.5) : q === 'media' ? 1 : 0.75;
    if (Math.abs(this.renderer.getPixelRatio() - pr) > 0.01) {
      this.renderer.setPixelRatio(pr);
      this.composer.setPixelRatio?.(pr);
      this.resizeAll?.();
      this.updateViewport();
    }
    this.bloom.enabled = q !== 'baixa';
    this.moon.castShadow = q !== 'baixa';
    const size = q === 'alta' ? 2048 : 1024;
    if (this.moon.shadow.mapSize.x !== size) {
      this.moon.shadow.mapSize.set(size, size);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
    }
  }

  // ------------------------------------------------------------- eventos
  wireEvents() {
    const p = this.player;
    p.onJump = () => {
      this.audio.jump();
      if (this.stealth) this.emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, p.sprinting ? 5 : 3, 0.04);
    };
    p.onLand = (impact, _drop, rolled) => {
      if (impact < 3) return;
      const k = Math.min(1, impact / 22);
      if (rolled) {
        this.effects.dust(p.pos.x, p.pos.y, p.pos.z, 14, 0.9);
        this.cam.addDip(0.12);
        if (this.stealth) this.emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 5, 0.1);
        return;
      }
      this.audio.land(k);
      this.effects.dust(p.pos.x, p.pos.y, p.pos.z, Math.round(6 + k * 18), 0.5 + k);
      this.cam.addDip(0.06 + k * 0.4);
      if (k > 0.55) this.cam.addShake(k * 0.45);
      if (this.stealth) this.emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 2 + k * 10, 0.04 + k * 0.32);
    };
    p.onStep = (kind) => {
      this.audio.step(kind);
      if (kind === 'run' && Math.random() < 0.35) this.effects.dust(p.pos.x, p.pos.y, p.pos.z, 2, 0.3);
      if (!this.stealth) return;
      if (kind === 'run') this.emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 8, 0.12);
      else if (kind === 'walk') this.emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 3.5, 0.035);
    };
    p.onGrab = () => this.audio.grab();
    p.onClimb = () => this.audio.climb();
    p.onWallJump = () => {
      this.audio.wallJump();
      this.effects.sparks(p.pos.x - p.wallNx * 0.3, p.pos.y + 1, p.pos.z - p.wallNz * 0.3, 10, { speed: 2.5, life: 0.4, spread: 0.3 });
      this.cam.addShake(0.1);
    };
    p.onBounce = (c) => {
      this.audio.bounce();
      if (c.pad) c.pad.pulse = 1;
      this.effects.sparks(p.pos.x, p.pos.y + 0.2, p.pos.z, 30, { speed: 5, life: 0.6, gravity: 4, spread: 1, vy: 4 });
      this.cam.addShake(0.2);
    };
    p.onJolt = () => {
      this.audio.crash();
      this.cam.addShake(0.6);
      this.ui.toast('Batida!', 1.2);
    };
    p.onSlide = () => {
      this.audio.slide();
      this.effects.dust(p.pos.x, p.pos.y, p.pos.z, 10, 0.7);
      if (this.stealth) this.emitNoise(p.pos.x, p.pos.y + 1, p.pos.z, 6, 0.1);
    };
    p.onRoll = () => this.audio.roll();
    p.onGrapple = (a) => {
      this.audio.grapple();
      this.effects.sparks(a.pos.x, a.pos.y, a.pos.z, 20, { speed: 3, life: 0.5 });
      this.stats.grapples = (this.stats.grapples ?? 0) + 1;
    };
    p.onRelease = (jump) => {
      this.audio.release(jump);
      if (jump) this.effects.sparks(p.pos.x, p.pos.y + 1, p.pos.z, 12, { speed: 3, life: 0.4 });
    };

    const ui = this.ui;
    ui.on('start-btn', () => this.startIntro());
    ui.on('continue-btn', () => this.continueGame());
    ui.on('title-select-btn', () => this.openSelect());
    ui.on('title-options-btn', () => this.openOptions('title'));
    ui.on('credits-btn', () => this.openCredits());
    ui.on('credits-back', () => (this.creditsReturn === 'finish' ? this.closeCredits() : this.openTitle()));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && (this.state === 'playing' || this.state === 'dead')) {
        this.input.unlock();
        this.pause();
      }
    });

    ui.on('select-back', () => this.openTitle());
    ui.on('speedrun-btn', () => this.startSpeedrun());
    ui.on('wardrobe-btn', () => this.openWardrobe());
    ui.on('memories-btn', () => this.openMemories());
    ui.on('options-btn', () => this.openOptions('select'));
    ui.on('pause-options-btn', () => this.openOptions('pause'));
    ui.on('options-back', () => this.closeOptions());
    ui.on('wardrobe-back', () => this.openSelect());
    ui.on('memories-back', () => this.openSelect());
    ui.on('epilogue-btn', () => this.closeEpilogue());
    ui.on('resume-btn', () => this.resume());
    ui.pauseEl.addEventListener('click', () => this.resume());
    ui.on('restart-btn', () => {
      this.restartLevel();
      this.resume();
    });
    ui.on('menu-btn', () => this.openSelect());
    ui.on('next-btn', () => this.nextLevel());
    ui.on('again-btn', () => this.retry());
    ui.on('finish-menu-btn', () => this.openSelect());

    this.renderer.domElement.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.locked) this.input.lock();
    });
    this.input.onLockChange = (locked) => {
      if (!locked && (this.state === 'playing' || this.state === 'dead')) this.pause();
    };
    this.input.onPadChange = (on) => this.ui.toast(on ? 'Controle conectado' : 'Controle desconectado', 1.6);
  }

  // Um ruído no mundo: guardiões dentro do raio podem ouvir.
  emitNoise(x, y, z, radius, strength) {
    for (const g of this.guardians) g.hear(x, y, z, radius, strength);
  }

  // ------------------------------------------------------------- fases
  loadLevel(index, silent = false) {
    if (this.level) this.level.dispose();
    for (const g of this.guardians) g.dispose();
    this.world.clear();
    this.effects.clear();
    this.levelIndex = index;
    const def = this.levelDef;
    this.applyEnv(def.env);
    this.level = new LevelBuilder({ scene: this.scene, world: this.world, materials: this.materials, effects: this.effects }, def);
    this.level.playerRef = this.player;
    this.level.cameraPos = this.camera.position;
    this.level.fragmentTaken = !!this.progress.fragments[def.id];
    this.player.anchors = this.level.anchors;
    this.level.onSlabCrash = (sl) => {
      if (sl.c === this.player.groundCol) return;
      const d = Math.hypot(sl.c.minX - this.player.pos.x, sl.c.minZ - this.player.pos.z);
      if (d < 25 && this.state === 'playing') {
        this.audio.crash();
        this.cam.addShake(Math.max(0, 0.4 - d / 60));
      }
    };
    this.level.onCrumble = () => this.audio.crumble();
    this.level.onBossEvent = (type, a, b) => this.bossEvent(type, a, b);
    this.guardians = this.level.guardianDefs.map((d) => new Guardian(this.scene, this.world, d));
    for (const g of this.guardians) {
      g.onStateChange = (_g, st, prev) => {
        if (this.state !== 'playing') return;
        if (st === 'chase') this.audio.alert('chase');
        else if (st === 'suspicious' && prev !== 'chase') this.audio.alert('suspicious');
        else if (st === 'return') this.audio.alert('calm');
      };
    }
    this.ghost.load(loadGhost(def.id));
    this.ui.setStealth(def.type === 'stealth');
    this.ui.setBoss(def.boss ? 0 : null, this.level.boss?.runes.length ?? 0);
    this.ui.setFragment(!!this.level.fragment, this.progress.fragments[def.id]);
    this.stats.deaths = 0;
    this.restartLevel();
    if (!silent && this.pendingChapter) {
      this.audio.startMusic(def.music ?? MUSIC_BY_CHAPTER[def.chapter ?? 0]);
      this.ui.chapterCard(this.pendingChapter);
      this.pendingChapter = null;
    } else if (!silent) {
      this.audio.startMusic(def.music ?? MUSIC_BY_CHAPTER[def.chapter ?? 0]);
      this.ui.splash(`TRAVESSIA ${index + 1}`, def.name, def.subtitle, LORE[def.id]?.intro);
    }
  }

  applyEnv(name) {
    const env = this.setEnv(name);
    this.materials.mistColor.setRGB(...(env.mist ?? ENVS.noite.mist));
  }

  restartLevel() {
    this.level.reset();
    this.checkpoint = this.stealth ? this.level.checkpoints[0] ?? null : null;
    if (this.checkpoint) this.level.activateCheckpoint(this.checkpoint);
    const deaths = this.stats.deaths;
    this.stats = { time: 0, deaths, veils: 0, topSpeed: 0, grapples: 0 };
    this.veil.reset();
    this.effects.clear();
    this.bloom.strength = BLOOM_STRENGTH;
    this.ui.hideHint();
    this.ui.message('');
    this.ui.fade(0, 0.01);
    this.ui.setPrompt(null);
    this.ui.setDanger(0);
    this.ui.setLevel(this.levelIndex, this.levels.length, this.levelDef, this.progress.best[this.levelDef.id] ?? null);
    this.ui.setTimer(0);
    if (this.level.hasDimensions) this.applyEnv(this.levelDef.env);
    this.ui.setDimension(this.level.hasDimensions ? 0 : null);
    if (this.levelDef.intro) this.ui.showHint(this.levelDef.intro, 6);
    this.respawn(this.level.start.pos, this.level.start.yaw);
    this.recorder.start();
    if (this.level.shadowDelay) this.shadow.start(this.level.shadowDelay);
    else this.shadow.stop();
    if (this.state === 'dead' || this.state === 'captured' || this.state === 'finish') this.setState('playing');
  }

  // Morreu numa corrida com ponto de controle: volta nele, o tempo segue.
  respawnAtCheckpoint() {
    const cp = this.checkpoint;
    const lv = this.level;
    lv.resetCrumbles();
    if (lv.hasDimensions) {
      const d = cp.dim ?? 0;
      lv.setDimension(d);
      this.applyEnv(d === 1 ? 'veu' : this.levelDef.env);
      this.ui.setDimension(d);
    }
    this.respawn(cp.pos, cp.yaw);
    if (lv.shadowDelay) this.shadow.start(lv.shadowDelay);
    this.effects.clear();
    this.ui.setDanger(0);
    this.ui.toast('Ponto de controle', 1);
    this.setState('playing');
  }

  respawn(pos, yaw) {
    this.player.demoWind = null;
    this.player.respawn(pos, yaw);
    this.player.setVisible(!this.cam.firstPerson);
    this.cam.snap(this.player.pos, yaw);
    for (const g of this.guardians) g.reset();
    this.veil.cooldown = 0;
  }

  saveProgress() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.progress));
    } catch {
      /* armazenamento indisponível */
    }
  }

  unlockedSkinIds() {
    return new Set(SKINS.filter((s) => skinUnlocked(s, this.progress, this.levels)).map((s) => s.id));
  }

  // ------------------------------------------------------------- telas
  menuReady() {
    this.audio.init();
    this.player.demoWind = null;
    this.input.unlock();
    this.speedrun = null;
    this.ui.setTotal(null);
    this.ui.drawSpeedLines(0, 0);
    this.ui.setDanger(0);
    this.shadow.stop();
    this.ghost.fig.setVisible(false);
    this.player.celebrate = false;
    if (this.state === 'paused' || this.state === 'finish' || this.state === 'playing' || this.state === 'srnext') {
      // volta o cenário do menu para o começo da fase
      this.respawn(this.level.start.pos, this.level.start.yaw);
    }
  }

  openTitle() {
    this.menuReady();
    this.setState('title');
    const next = this.nextLevelIndex();
    this.ui.setupTitle(this.version, next !== null ? this.levels[next].name : null, Object.keys(this.progress.best).length > 0);
    this.ui.showScreen('title');
  }

  // Primeira fase ainda não concluída (ou null se terminou todas).
  nextLevelIndex() {
    const i = this.levels.findIndex((d) => this.progress.best[d.id] === undefined);
    return i < 0 ? null : i;
  }

  continueGame() {
    const i = this.nextLevelIndex();
    if (i === null) this.openSelect();
    else this.playLevel(i);
  }

  openCredits(from = 'title') {
    this.creditsReturn = from;
    if (from === 'title') this.menuReady();
    this.setState('credits');
    this.ui.showScreen('credits');
  }

  closeCredits() {
    this.setState('finish');
    this.ui.showFinish(...this.finishArgs);
  }

  // Abertura: o andarilho acorda enquanto o prólogo aparece.
  startIntro() {
    this.audio.init();
    document.activeElement?.blur?.();
    this.loadLevel(0, true);
    this.audio.startMusic('calm');
    this.setState('intro');
    this.ui.showScreen(null);
    this.ui.hud.classList.add('hidden');
    this.ui.showIntro(PROLOGUE_LINES);
    this.player.wake = 1;
    this.introAngle = this.player.facing + 2.2;
  }

  updateIntro(dt, realDt) {
    const p = this.player;
    const t = this.stateTime;
    const skip = this.input.wasPressed('Space') || this.input.wasPressed('Enter') || this.input.padPressed.has(0) || this.input.wasPressed('Escape');
    const END = 11.5;
    if (skip && t < END - 1.6) this.stateTime = END - 1.6;
    if (t > END - 2.2) p.wake = Math.max(0, p.wake - realDt / 1.6);
    this.level.update(dt, this.time);
    p.vel.set(0, 0, 0);
    p.grounded = true;
    p.animate(dt);
    // câmera: começa no alto e desce em volta do andarilho
    const k = Math.min(1, t / END);
    const ang = this.introAngle + k * 1.6;
    const dist = 9 - k * 4.5;
    const pp = p.pos;
    this.tmp.set(pp.x + Math.sin(ang) * dist, pp.y + 7 - k * 5.2, pp.z + Math.cos(ang) * dist);
    this.tmp2.set(pp.x, pp.y + 0.6 + k * 0.7, pp.z);
    this.cam.cinematic(this.tmp, this.tmp2, dt, 1.4);
    if (t > END) {
      p.wake = 0;
      this.ui.hideIntro();
      this.progress.introSeen = true;
      this.saveProgress();
      this.playLevel(0);
    }
  }

  openSelect() {
    this.menuReady();
    this.setState('select');
    this.ui.buildSelect(this.levels, this.progress, (i) => this.playLevel(i));
    this.ui.showScreen('select');
  }

  openWardrobe() {
    this.menuReady();
    this.setState('wardrobe');
    const build = () => this.ui.buildWardrobe(this.progress, this.levels, this.progress.skin, (id) => {
      this.progress.skin = id;
      this.saveProgress();
      this.wearSkin(skinById(id));
      this.effects.sparks(this.player.pos.x, this.player.pos.y + 1, this.player.pos.z, 40, { speed: 3, life: 0.8 });
      this.audio.menu();
      build();
    });
    build();
    this.ui.buildPoses((pose) => {
      this.demo = pose;
      this.audio.menu();
    });
    this.ui.showScreen('wardrobe');
    this.player.setVisible(true);
  }

  // Prévia de animações no guarda-roupa (o andarilho "corre" parado).
  demoPose(dt) {
    const p = this.player;
    const POSES = ['parado', 'marcha', 'corrida', 'salto', 'surf', 'deslize', 'gancho', 'esgueirar'];
    let pose = this.demo ?? 'auto';
    if (pose === 'auto') pose = POSES[Math.floor(this.stateTime / 3.2) % POSES.length];
    this.ui.setDemoPose?.(pose, this.demo ?? 'auto');
    const f = p.facing;
    const fx = Math.sin(f);
    const fz = Math.cos(f);
    const speed = { parado: 0, marcha: 4, corrida: 9.5, salto: 9, surf: 22, deslize: 13, gancho: 12, esgueirar: 2.3 }[pose];
    p.vel.set(fx * speed, 0, fz * speed);
    p.state = 'normal';
    p.grounded = true;
    p.surfing = false;
    p.sneaking = pose === 'esgueirar';
    p.height = pose === 'esgueirar' ? 0.95 : 1.8;
    p.swing.anchor = null;
    if (speed > 0) p.stepPhase += dt * (5 + speed * 1.05);
    if (pose === 'salto') {
      p.grounded = false;
      p.vel.y = Math.sin(this.time * 2) * 6;
    } else if (pose === 'surf') {
      p.grounded = false;
      p.surfing = true;
      p.surfNormal.set(-Math.cos(f) * 0.8, 0.55, Math.sin(f) * 0.8);
    } else if (pose === 'deslize') {
      p.state = 'slide';
      p.slide.dir.set(fx, 0, fz);
    } else if (pose === 'gancho') {
      p.state = 'swing';
      p.grounded = false;
      this.demoAnchor ??= { pos: new THREE.Vector3() };
      this.demoAnchor.pos.set(p.pos.x + fx * 2, p.pos.y + 7, p.pos.z + fz * 2);
      p.swing.anchor = this.demoAnchor;
    }
    // o vento do "movimento" faz a capa voar como se estivesse correndo
    this.demoWind ??= new THREE.Vector3();
    p.demoWind = this.demoWind.set(-fx * speed * 6.4, 0, -fz * speed * 6.4);
  }

  openMemories() {
    this.menuReady();
    this.setState('memories');
    this.ui.buildMemories(this.levels, this.progress);
    this.ui.showScreen('memories');
  }

  openOptions(from) {
    this.optionsReturn = from;
    if (from !== 'pause') this.menuReady();
    this.setState('options');
    this.ui.buildOptions(this.settings, (key, v) => {
      this.settings[key] = v;
      saveSettings(this.settings);
      this.applySettings();
      if (key === 'volume' || key === 'music') this.audio.menu();
    }, () => {
      try {
        localStorage.removeItem(SAVE_KEY);
        for (const def of this.levels) localStorage.removeItem('veil.ghost.' + def.id);
      } catch {
        /* ignorado */
      }
      this.progress = freshProgress();
      this.wearSkin(skinById('andarilho'));
      this.ghost.clear();
    }, this.input);
    this.ui.showScreen('options');
  }

  closeOptions() {
    if (this.optionsReturn === 'pause') {
      this.setState('paused');
      this.ui.showPause(this.levelDef);
    } else if (this.optionsReturn === 'title') {
      this.openTitle();
    } else {
      this.openSelect();
    }
  }

  playLevel(i) {
    this.audio.init();
    const def = this.levels[i];
    const first = this.levels.findIndex((d) => (d.chapter ?? 0) === (def.chapter ?? 0)) === i;
    if (first && !this.speedrun) this.pendingChapter = CHAPTERS[def.chapter ?? 0];
    document.activeElement?.blur?.();
    this.player.celebrate = false;
    this.loadLevel(i);
    this.setState('playing');
    this.ui.showScreen(null);
    this.input.lock();
  }

  startSpeedrun() {
    this.playLevel(0);
    this.speedrun = { total: 0, splits: [] };
    this.ui.setTotal(0);
    this.ui.toast('Modo speedrun: todas as fases, um cronômetro', 2.5);
  }

  nextLevel() {
    if (this.state !== 'finish') return;
    if (this.levelIndex + 1 < this.levels.length) this.playLevel(this.levelIndex + 1);
    else this.openSelect();
  }

  retry() {
    if (this.state !== 'finish') return;
    this.audio.init();
    this.player.celebrate = false;
    if (this.levelDef.final) this.applyEnv(this.levelDef.env);
    this.restartLevel();
    this.setState('playing');
    this.ui.showScreen(null);
    this.input.lock();
  }

  pause() {
    if (this.state !== 'playing' && this.state !== 'dead') return;
    if (this.state === 'dead') this.restartLevel();
    this.setState('paused');
    this.ui.showPause(this.levelDef);
    this.ui.drawSpeedLines(0, 0);
    this.input.unlock();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.audio.init();
    this.setState('playing');
    this.ui.showScreen(null);
    this.input.lock();
    this.clock.getDelta();
  }

  setState(s) {
    this.state = s;
    this.stateTime = 0;
  }

  // Morte nas fases de corrida: tela vermelha rápida e reinício imediato.
  die() {
    if (this.state !== 'playing') return;
    if (this.stealth) {
      this.fallDeath();
      return;
    }
    this.stats.deaths++;
    this.audio.death();
    this.ui.deathFlash();
    this.cam.addShake(0.6);
    const p = this.player.pos;
    this.effects.sparks(p.x, p.y + 1, p.z, 40, { speed: 5, life: 0.7, color: DEATH_COLOR, whiteChance: 0.2 });
    this.setState('dead');
  }

  capture() {
    this.stats.deaths++;
    this.setState('captured');
    this.audio.capture();
    this.cam.addShake(0.8);
    this.ui.message('Capturado', 'O Guardião devolve você ao último ponto de controle');
    this.ui.fade(1, 1.0);
    this.respawnDelay = 1.6;
  }

  fallDeath() {
    this.stats.deaths++;
    this.setState('captured');
    this.audio.fall();
    this.ui.message('O abismo', 'O Véu devolve você ao último ponto de controle');
    this.ui.fade(1, 0.5);
    this.respawnDelay = 1.0;
  }

  // Troca entre o mundo real e o outro lado do Véu.
  tryShift() {
    const lv = this.level;
    if (!lv.hasDimensions || this.shiftCooldown > 0) return;
    const p = this.player;
    const target = 1 - lv.dim;
    if (lv.dimBlocked(p.pos, target, RADIUS * 0.95, p.height)) {
      this.audio.denied();
      this.ui.toast('Algo ocupa este lugar do outro lado', 1.2);
      return;
    }
    lv.setDimension(target);
    this.shiftCooldown = 0.18;
    this.audio.shift(target === 1);
    this.ui.flash(0.35, target === 1 ? 'violet' : null);
    this.ui.setDimension(target);
    this.applyEnv(target === 1 ? 'veu' : this.levelDef.env);
    this.effects.ring(p.pos.x, p.pos.y, p.pos.z, 7, 0.6, target === 1 ? VIOLET : undefined);
    this.effects.sparks(p.pos.x, p.pos.y + 1, p.pos.z, 20, { speed: 3, life: 0.5, color: target === 1 ? VIOLET : undefined });
    this.stats.shifts = (this.stats.shifts ?? 0) + 1;
  }

  bossEvent(type, a, b) {
    if (this.state !== 'playing') return;
    const p = this.player.pos;
    if (type === 'warn') {
      this.audio.alert('suspicious');
    } else if (type === 'slam') {
      const d = Math.hypot(a.x - p.x, a.z - p.z);
      this.audio.crash();
      this.audio.land(1);
      this.cam.addShake(Math.max(0.15, 0.8 - d / 25));
      this.effects.dust(a.x, a.y, a.z, 40, 2.2);
      this.effects.ring(a.x, a.y, a.z, 6, 0.7, DEATH_COLOR, false);
    } else if (type === 'sweepLow' || type === 'sweepHigh') {
      this.audio.alert('chase');
      this.ui.toast(type === 'sweepLow' ? 'Braço baixo — pule!' : 'Braço alto — deslize!', 1.3);
    } else if (type === 'hit') {
      this.audio.rune();
      this.audio.capture();
      this.cam.addShake(0.7);
      this.ui.flash(0.6);
      this.ui.setBoss(a, b);
      this.ui.toast(a < b ? `O Colosso cambaleia — ${a}/${b}` : 'O Colosso cai!', 2);
      this.slowmo = 0.5;
    } else if (type === 'defeat') {
      this.audio.artifact();
      this.ui.flash(1.6);
      this.cam.addShake(1);
      this.ui.showHint('O rasgo está aberto. Entre no portal e <b>costure o Véu</b>.', 8);
      const g = this.level.goal?.pos;
      if (g) this.effects.sparks(g.x, g.y + 2, g.z, 200, { speed: 8, life: 1.6, gravity: 1, size: 0.15, whiteChance: 0.5 });
    }
  }

  collectFragment(ev) {
    const def = this.levelDef;
    const first = !this.progress.fragments[def.id];
    const before = this.unlockedSkinIds();
    this.progress.fragments[def.id] = true;
    this.saveProgress();
    this.level.fragmentTaken = true;
    this.audio.fragment();
    this.slowmo = 0.45;
    this.effects.sparks(ev.pos.x, ev.pos.y, ev.pos.z, 60, { speed: 4, life: 1, color: FRAG_COLOR, whiteChance: 0.5 });
    this.effects.ring(ev.pos.x, ev.pos.y - 0.9, ev.pos.z, 5, 1, FRAG_COLOR, false);
    this.ui.showMemory(LORE[def.id]?.memory ?? '', !first);
    this.ui.setFragment(true, true);
    if (first) {
      const gained = SKINS.filter((s) => !before.has(s.id) && skinUnlocked(s, this.progress, this.levels));
      if (gained.length) this.ui.toast(`Novo manto: ${gained.map((s) => s.name).join(', ')}`, 3);
    }
  }

  finishLevel() {
    const def = this.levelDef;
    const time = this.stats.time;
    const prev = this.progress.best[def.id];
    const isRecord = prev === undefined || time < prev;
    const before = this.unlockedSkinIds();
    if (isRecord) {
      this.progress.best[def.id] = time;
      saveGhost(def.id, this.recorder.data());
    }
    const feats = this.progress.feats[def.id] ?? {};
    if (this.stats.deaths === 0) feats.noDeath = true;
    if (this.stats.veils === 0) feats.noVeil = true;
    feats.fragment = !!this.progress.fragments[def.id];
    this.progress.feats[def.id] = feats;
    const unlocks = SKINS.filter((s) => !before.has(s.id) && skinUnlocked(s, this.progress, this.levels)).map((s) => `manto ${s.name}`);
    this.saveProgress();
    this.finishAngle = this.cam.yaw;
    this.finishFocus = this.player.pos.clone();
    this.player.celebrate = true;
    this.shadow.stop();
    this.ui.setDanger(0);
    this.ui.setPrompt(null);
    this.audio.finish();
    this.audio.setSpeed(0);
    this.ui.drawSpeedLines(0, 0);
    if (this.level.goal) {
      const g = this.level.goal.pos;
      this.effects.sparks(g.x, g.y + 1.9, g.z, 160, { speed: 7, life: 1.6, gravity: 1, size: 0.15, whiteChance: 0.5 });
      this.effects.ring(g.x, g.y, g.z, 9, 1.4);
      this.ui.flash(0.8);
    }

    const hasNext = this.levelIndex + 1 < this.levels.length;
    // speedrun: segue direto para a próxima fase
    if (this.speedrun) {
      this.speedrun.splits.push(time);
      if (hasNext) {
        this.setState('srnext');
        this.ui.toast(`${def.name} ${this.formatShort(time)} · total ${this.formatShort(this.speedrun.total)}`, 2);
        return;
      }
      const total = this.speedrun.total;
      const srRecord = !this.progress.speedrunBest || total < this.progress.speedrunBest;
      if (srRecord) this.progress.speedrunBest = total;
      this.saveProgress();
      unlocks.unshift(srRecord ? `recorde de speedrun ${this.formatShort(total)}!` : `speedrun ${this.formatShort(total)}`);
      this.speedrun = null;
    }

    this.setState('finish');
    this.input.unlock();
    this.finishArgs = [def, this.levelIndex, this.levels.length, time, this.progress.best[def.id], isRecord, this.stats, hasNext,
      { prevBest: prev ?? null, feats, hasFragment: !!this.level.fragment, unlocks }];
    if (def.final) {
      this.applyEnv('amanhecer');
      this.bloom.strength = BLOOM_STRENGTH * 1.4;
      this.setState('epilogue');
      this.ui.showEpilogue();
      return;
    }
    this.ui.showFinish(...this.finishArgs);
  }

  closeEpilogue() {
    if (this.state !== 'epilogue') return;
    this.openCredits('finish');
  }

  formatShort(t) {
    const m = Math.floor(t / 60);
    const s = (t % 60).toFixed(2).padStart(5, '0');
    return m > 0 ? `${m}:${s}` : `${s}s`;
  }

  startEnding() {
    this.setState('ending');
    this.level.artifact.collected = true;
    this.audio.artifact();
    this.ui.hud.classList.add('hidden');
    this.ui.setAlert(0, 'patrol');
    this.ui.hideHint();
    this.ui.setPrompt(null);
    this.ui.drawSpeedLines(0, 0);
    this.endFlashDone = false;
    const a = this.level.artifact.home;
    this.endAngle = Math.atan2(this.player.pos.x - a.x, this.player.pos.z - a.z);
    this.endStartTime = this.time;
  }

  // ------------------------------------------------------------- loop
  frame() {
    requestAnimationFrame(this.frame);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.tick(dt);
    this.render();
  }

  tick(realDt) {
    this.input.poll();
    // câmera lenta curta (anéis, fragmentos) e assistência de velocidade
    this.slowmo = Math.max(0, this.slowmo - realDt);
    const dt = realDt * this.settings.gameSpeed * (this.slowmo > 0 ? 0.35 : 1);
    this.time += dt;
    this.stateTime += realDt;
    this.shiftCooldown -= dt;
    if (this.speedrun && ['playing', 'dead', 'captured', 'ending', 'srnext'].includes(this.state)) {
      this.speedrun.total += dt;
      this.ui.setTotal(this.speedrun.total);
    }
    switch (this.state) {
      case 'playing': this.updatePlaying(dt); break;
      case 'dead': this.updateDead(dt); break;
      case 'captured': this.updateRespawn(dt); break;
      case 'ending': this.updateEnding(dt); break;
      case 'finish':
      case 'srnext': this.updateFinish(dt); break;
      case 'paused': this.handleMenuInput(realDt); break;
      case 'epilogue': this.updateFinish(dt); break;
      case 'intro': this.updateIntro(dt, realDt); break;
      case 'credits':
        if (this.creditsReturn === 'finish') this.updateFinish(dt);
        else this.updateMenu(dt, realDt);
        break;
      default:
        // opções abertas da pausa: o mundo continua congelado
        if (this.state === 'options' && this.optionsReturn === 'pause') {
          this.handleMenuInput(realDt);
          break;
        }
        if (MENU_STATES.has(this.state)) this.updateMenu(dt, realDt);
        break;
    }
    if (this.state !== 'paused') this.effects.update(dt, this.time);
    this.ui.update(realDt);
    this.input.endFrame();
  }

  render() {
    this.sky.position.copy(this.camera.position);
    this.sky.material.uniforms.uTime.value = this.time;
    this.followMoon(MENU_STATES.has(this.state) && this.state !== 'wardrobe' ? this.level.start.pos : this.player.pos);
    if (this.bloom.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  // Navegação dos menus por teclado e controle.
  handleMenuInput(dt) {
    const i = this.input;
    const ui = this.ui;
    let dir = 0;
    let h = 0;
    if (i.wasPressed('ArrowUp') || i.padPressed.has(12)) dir = -1;
    if (i.wasPressed('ArrowDown') || i.padPressed.has(13)) dir = 1;
    if (i.wasPressed('ArrowLeft') || i.padPressed.has(14)) h = -1;
    if (i.wasPressed('ArrowRight') || i.padPressed.has(15)) h = 1;
    if (i.wasPressed('Tab')) dir = i.isDown('ShiftLeft') ? -1 : 1;
    // analógico com repetição
    const sy = i.padMove.y;
    const sx = i.padMove.x;
    this.navRepeat -= dt;
    if ((Math.abs(sy) > 0.6 || Math.abs(sx) > 0.6) && this.navRepeat <= 0) {
      if (Math.abs(sy) >= Math.abs(sx)) dir = Math.sign(sy);
      else h = Math.sign(sx);
      this.navRepeat = 0.22;
    } else if (Math.abs(sy) < 0.3 && Math.abs(sx) < 0.3) {
      this.navRepeat = 0;
    }
    if (dir) {
      ui.navigate(dir);
      this.audio.tick();
    }
    if (h) {
      ui.adjust(h);
      this.audio.tick();
    }
    const confirm = i.wasPressed('Enter') || i.padPressed.has(0);
    // o mesmo Esc que pausou não pode despausar no quadro seguinte
    const back = (i.wasPressed('Escape') || i.padPressed.has(1)) && !(this.state === 'paused' && this.stateTime < 0.3);
    if (this.state === 'paused' && i.padPressed.has(9) && this.stateTime > 0.2) {
      this.resume();
      return;
    }
    if (confirm) {
      if (!ui.activate()) this.menuConfirm();
    } else if (back) {
      this.menuBack();
    } else if (i.wasPressed('KeyR') && this.state === 'finish') {
      this.retry();
    }
  }

  menuConfirm() {
    switch (this.state) {
      case 'title':
        if (Object.keys(this.progress.best).length) this.continueGame();
        else this.startIntro();
        break;
      case 'credits': this.creditsReturn === 'finish' ? this.closeCredits() : this.openTitle(); break;
      case 'finish': this.nextLevel(); break;
      case 'paused': this.resume(); break;
      case 'epilogue': this.closeEpilogue(); break;
      default: break;
    }
  }

  menuBack() {
    switch (this.state) {
      case 'select': this.openTitle(); break;
      case 'credits': this.creditsReturn === 'finish' ? this.closeCredits() : this.openTitle(); break;
      case 'options': this.closeOptions(); break;
      case 'wardrobe':
      case 'memories': this.openSelect(); break;
      case 'paused': this.resume(); break;
      case 'finish': this.openSelect(); break;
      case 'epilogue': this.closeEpilogue(); break;
      default: break;
    }
  }

  buildControls() {
    const i = this.input;
    const fz = (i.action('up') ? 1 : 0) - (i.action('down') ? 1 : 0) - i.padMove.y;
    const fx = (i.action('right') ? 1 : 0) - (i.action('left') ? 1 : 0) + i.padMove.x;
    this.cam.forward(this.fwd);
    this.cam.right(this.right);
    this.move.set(0, 0, 0).addScaledVector(this.fwd, fz).addScaledVector(this.right, fx);
    const len = this.move.length();
    if (len > 1) this.move.normalize();
    const padStick = Math.hypot(i.padMove.x, i.padMove.y);
    return {
      move: this.move,
      // analógico pouco inclinado = andar
      walk: i.action('walk') || (padStick > 0.05 && padStick < 0.55),
      sneak: i.action('sneak'),
      slidePressed: i.actionPressed('sneak'),
      jumpPressed: i.actionPressed('jump'),
      jumpHeld: i.action('jump'),
      dropPressed: i.actionPressed('sneak'),
      grapplePressed: i.actionPressed('grapple'),
      grappleHeld: i.action('grapple'),
    };
  }

  updatePlaying(dt) {
    const i = this.input;
    if (i.actionPressed('pause')) {
      this.pause();
      return;
    }
    if (i.actionPressed('restart')) {
      this.restartLevel();
      return;
    }
    if (i.actionPressed('view')) {
      this.cam.setFirstPerson(!this.cam.firstPerson);
      this.player.setVisible(!this.cam.firstPerson);
    }
    this.level.update(dt, this.time);

    this.cam.handleMouse(i.mouseDX, i.mouseDY);
    this.cam.handlePad(i.padLook.x, i.padLook.y, dt);
    const ctrl = this.buildControls();
    const p = this.player;
    if (i.actionPressed('veil')) {
      if (this.veil.tryActivate(ctrl.move, this.cam.forward(this.tmp2))) this.stats.veils++;
    }
    if (i.actionPressed('shift')) this.tryShift();

    p.wind = this.level.windAt(p.pos);
    p.veilCharge = this.veil.fraction;
    p.update(dt, ctrl);
    this.veil.update(dt);
    if (p.grounded && p.groundCol?.onStand) p.groundCol.onStand();

    // âncora ao alcance
    const target = p.state === 'swing' ? p.swing.anchor : p.findAnchor();
    for (const a of this.level.anchors) a.hot += ((a === target ? 1 : 0) - a.hot) * Math.min(1, dt * 12);
    const canGrab = target && p.state !== 'swing' && p.state !== 'hang' && p.state !== 'climb';
    this.ui.setPrompt(canGrab ? `<kbd>${this.input.label('grapple')}</kbd> gancho` : null);

    for (const ev of this.level.triggers(p, this.veil)) {
      if (ev.type === 'ring') {
        this.audio.ring();
        this.cam.addShake(0.25);
        this.slowmo = Math.max(this.slowmo, 0.1);
        this.effects.sparks(ev.pos.x, ev.pos.y, ev.pos.z, 30, { speed: 6, life: 0.6, color: RING_COLOR });
      } else if (ev.type === 'orb') {
        this.audio.orb();
        this.effects.sparks(ev.pos.x, ev.pos.y, ev.pos.z, 26, { speed: 4, life: 0.6, whiteChance: 0.5 });
      } else if (ev.type === 'rune') {
        this.audio.rune();
        this.cam.addShake(0.2);
        this.effects.sparks(ev.pos.x, ev.pos.y, ev.pos.z, 30, { speed: 4, life: 0.7, color: RING_COLOR });
        this.ui.toast(ev.duration ? `Portão aberto por ${ev.duration} s` : 'Portão aberto', 1.6);
      } else if (ev.type === 'fragment') {
        this.collectFragment(ev);
      } else if (ev.type === 'goal') {
        this.stats.time += dt;
        this.finishLevel();
        return;
      }
    }

    for (const g of this.guardians) {
      if (g.update(dt, p)) {
        this.capture();
        return;
      }
    }

    for (const cp of this.level.checkpoints) {
      if (cp.active) continue;
      if (Math.hypot(p.pos.x - cp.pos.x, p.pos.z - cp.pos.z) < 3 && Math.abs(p.pos.y - cp.pos.y) < 2) {
        this.level.activateCheckpoint(cp);
        if (!this.checkpoint || cp.index > this.checkpoint.index) this.checkpoint = cp;
        cp.dim = this.level.dim;
        this.audio.checkpoint();
        this.ui.toast('Ponto de controle');
      }
    }

    const hint = this.level.hintAt(p.pos);
    if (hint && this.settings.hints) this.ui.showHint(hint, 9);

    if (p.pos.y < this.level.killY || this.world.overlapCylinder(p.pos.x, p.pos.y + 0.1, p.pos.z, RADIUS * 0.8, p.height - 0.2, KILL)) {
      this.stats.time += dt;
      this.die();
      return;
    }
    // a Sombra
    if (this.shadow.active) {
      if (this.shadow.update(dt, p)) {
        this.stats.time += dt;
        this.ui.toast('A Sombra alcançou você', 1.4);
        this.die();
        return;
      }
      const d = this.shadow.distanceTo(p);
      this.ui.setDanger(isFinite(d) ? Math.max(0, 1 - (d - 1) / 7) * 0.85 : 0);
      if (Math.random() < dt * 25 && this.shadow.fig.visible) {
        const sp = this.shadow.pos;
        this.effects.sparks(sp.x, sp.y + 1, sp.z, 1, { speed: 0.6, life: 0.8, gravity: -1, size: 0.14, color: DEATH_COLOR, whiteChance: 0 });
      }
    }
    if (this.level.artifactReachable(p.pos)) {
      this.startEnding();
      return;
    }

    const speedK = this.cam.update(dt, p);
    this.ui.drawSpeedLines(speedK, dt);
    this.audio.setSpeed(speedK);
    this.stats.time += dt;
    this.stats.topSpeed = Math.max(this.stats.topSpeed, p.state === 'dash' ? 34 : p.worldSpeed);
    this.recorder.update(dt, p);
    this.ghost.update(this.stats.time, dt, this.settings.ghost && !this.stealth);
    this.updateHUD();
  }

  updateHUD() {
    if (this.stealth) {
      let level = 0;
      let top = 'patrol';
      for (const g of this.guardians) {
        level = Math.max(level, g.suspicion);
        if (STATE_RANK[g.state] > STATE_RANK[top]) top = g.state;
      }
      this.ui.setAlert(level, top);
    }
    this.ui.setVeil(this.veil.fraction, this.veil.ready, this.veil.denied);
    this.ui.setTimer(this.stats.time);
    this.ui.setSpeed(this.player.state === 'dash' ? 34 : this.player.worldSpeed);
  }

  updateDead(dt) {
    this.level.update(dt, this.time);
    this.player.animate(dt);
    this.cam.update(dt, this.player);
    this.ui.drawSpeedLines(0, dt);
    this.audio.setSpeed(0);
    if (this.input.actionPressed('restart')) this.restartLevel();
    else if (this.stateTime >= DEATH_PAUSE) {
      if (this.checkpoint) this.respawnAtCheckpoint();
      else this.restartLevel();
    }
  }

  updateRespawn(dt) {
    // o mundo continua vivo enquanto a tela escurece
    this.level.update(dt, this.time);
    for (const g of this.guardians) g.updateVisuals(dt);
    this.player.animate(dt);
    if (this.player.pos.y > this.level.killY - 30) this.cam.update(dt, this.player);
    this.ui.drawSpeedLines(0, dt);
    if (this.respawnDelay > 0 && this.stateTime >= this.respawnDelay) {
      this.respawnDelay = 0;
      const cp = this.checkpoint;
      this.respawn(cp ? cp.pos : this.level.start.pos, cp ? cp.yaw : this.level.start.yaw);
      this.effects.clear();
      this.cam.update(1, this.player);
      this.ui.fade(0, 0.8);
      this.ui.message('');
    }
    if (this.stateTime >= 2.2) {
      this.setState('playing');
      this.clock.getDelta();
    }
  }

  updateFinish(dt) {
    this.level.update(dt, this.time);
    this.player.vel.set(0, 0, 0);
    this.player.grounded = true;
    this.player.animate(dt);
    const f = this.finishFocus;
    const ang = this.finishAngle + this.stateTime * 0.25;
    this.tmp.set(f.x + Math.sin(ang) * 6, f.y + 3, f.z + Math.cos(ang) * 6);
    this.tmp2.set(f.x, f.y + 1.2, f.z);
    this.cam.cinematic(this.tmp, this.tmp2, dt, 2);
    if (this.state === 'srnext') {
      if (this.stateTime > 1.3) {
        const sr = this.speedrun;
        this.playLevel(this.levelIndex + 1);
        this.speedrun = sr;
      }
      return;
    }
    this.handleMenuInput(dt);
  }

  updateMenu(dt, realDt) {
    this.level.update(dt, this.time);
    const t = this.time;
    const s = this.level.start.pos;
    if (this.state === 'wardrobe') {
      // close no andarilho, deslocado para a direita da tela
      const pp = this.player.pos;
      const a = this.player.facing + 0.6 + this.stateTime * 0.3; // volta completa: mostra a capa
      this.tmp.set(pp.x + Math.sin(a) * 3.4, pp.y + 1.5, pp.z + Math.cos(a) * 3.4);
      // olha um pouco à esquerda do andarilho: ele fica à direita do painel
      const vx = -Math.sin(a);
      const vz = -Math.cos(a);
      this.tmp2.set(pp.x + vz * 1.1, pp.y + 1.05, pp.z - vx * 1.1);
      this.cam.cinematic(this.tmp, this.tmp2, dt, 3);
      this.demoPose(dt);
    } else {
      this.tmp.set(s.x + Math.sin(t * 0.08) * 10, s.y + 7 + Math.sin(t * 0.13) * 1.2, s.z + 12 + Math.cos(t * 0.08) * 3);
      this.tmp2.set(s.x, s.y + 1.5, s.z - 25);
      this.cam.cinematic(this.tmp, this.tmp2, dt, 1.5);
    }
    for (const g of this.guardians) g.updateVisuals(dt);
    if (this.state !== 'wardrobe') {
      this.player.grounded = true; // pose parada nos menus
      this.player.vel.set(0, 0, 0);
    }
    this.player.animate(dt);
    this.handleMenuInput(realDt);
  }

  updateEnding(dt) {
    const t = this.stateTime;
    this.level.update(dt, this.time);
    const a = this.level.artifact;
    const home = a.home;
    a.group.position.y = home.y + Math.min(t, 3) * 0.35;
    a.crystal.rotation.y += dt * (1 + t * 3);
    a.core.rotation.y -= dt * (2 + t * 4);
    a.rings[0].rotation.z += dt * (1 + t * 2);
    a.rings[1].rotation.z -= dt * (1 + t * 2);
    const rs = 1 + Math.min(t, 2) * 0.8;
    a.rings[0].scale.setScalar(rs);
    a.rings[1].scale.setScalar(rs * 1.1);
    a.light.intensity = 30 + t * 25;
    a.beam.material.opacity = 0.09 + Math.min(t, 2) * 0.1;
    if (Math.random() < 0.6) {
      const p = a.group.position;
      this.effects.sparks(p.x, p.y, p.z, 3, { speed: 2.5, life: 1.2, gravity: -1, size: 0.12 });
    }

    // o andarilho encara o artefato, envolto em luz
    const pl = this.player;
    pl.facing = Math.atan2(home.x - pl.pos.x, home.z - pl.pos.z);
    pl.vel.set(0, 0, 0);
    pl.setVisible(true);
    pl.animate(dt);
    pl.cloakMat.emissiveIntensity = Math.min(1, t * 0.5);

    if (t > 1.7 && !this.endFlashDone) {
      this.endFlashDone = true;
      this.ui.flash(1.6);
      const p = a.group.position;
      this.effects.sparks(p.x, p.y, p.z, 260, { speed: 9, life: 2.2, gravity: 0.6, size: 0.16, drag: 1.2, whiteChance: 0.5 });
      this.effects.ring(p.x, 0.75, p.z, 14, 1.8);
      this.cam.addShake(0.5);
      for (const g of this.guardians) g.startDissolve();
      for (const vb of this.level.veilBarriers) vb.collider.enabled = false;
    }
    if (this.endFlashDone) {
      const k = Math.min(1, (t - 1.7) / 1.2);
      a.group.scale.setScalar(Math.max(0.001, 1 - k));
      this.bloom.strength = BLOOM_STRENGTH + (1 - k) * 1.2;
      for (const vb of this.level.veilBarriers) vb.mat.uniforms.uOpacity.value = 1 - k;
    }
    for (const g of this.guardians) g.update(dt, pl);

    const ang = this.endAngle + (this.time - this.endStartTime) * 0.18;
    this.tmp.set(home.x + Math.sin(ang) * 4.2, home.y + 1.6, home.z + Math.cos(ang) * 4.2);
    this.tmp2.set(home.x, home.y + 0.2, home.z);
    this.cam.cinematic(this.tmp, this.tmp2, dt, 2.2);

    if (t > 5.2) {
      a.group.visible = false;
      this.bloom.strength = BLOOM_STRENGTH;
      this.finishLevel();
      this.finishFocus = home.clone().setY(0.7);
    }
  }
}

export { HEIGHT };
