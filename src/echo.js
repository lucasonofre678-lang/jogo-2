// Ecos do andarilho: o fantasma do seu recorde (gravado e reproduzido) e a
// Sombra, que refaz o seu caminho com alguns segundos de atraso e mata ao
// alcançar você. Os dois usam o modelo completo (character.js), com capa de
// tecido e as mesmas animações do jogador.
import * as THREE from 'three';
import { Character } from './character.js';

const GHOST_KEY = 'veil.ghost.';
const SAMPLE_DT = 0.05;
const MAX_SAMPLES = 20 * 60 * 10; // 10 minutos
const STRIDE = 5; // x, y, z, direção, estado

// estado gravado: 0 chão · 1 ar · 2 deslize · 3 gancho · 4 avanço · 5/6 surf
// (rampa à esquerda/direita) · 7 borda · 8 esgueirando
function stateCode(p) {
  if (p.state === 'slide') return 2;
  if (p.state === 'swing') return 3;
  if (p.state === 'dash') return 4;
  if (p.state === 'hang' || p.state === 'climb') return 7;
  if (p.surfing) {
    const right = Math.cos(p.facing) * p.surfNormal.x - Math.sin(p.facing) * p.surfNormal.z;
    return right > 0 ? 6 : 5;
  }
  if (!p.grounded) return 1;
  return p.sneaking ? 8 : 0;
}

// Estado falso que o modelo lê como se fosse o jogador.
class EchoState {
  constructor() {
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.facing = 0;
    this.state = 'normal';
    this.grounded = true;
    this.stepPhase = 0;
    this.sneaking = false;
    this.low = false;
    this.wallSliding = false;
    this.celebrate = false;
    this.roll = 0;
    this.landSquash = 0;
    this.veilCharge = 1;
    this.wind = null;
    this.surfing = false;
    this.surfNormal = new THREE.Vector3(0, 1, 0);
    this.slide = { dir: new THREE.Vector3() };
    this.dashDir = new THREE.Vector3();
    this.swing = { anchor: null };
    this.hang = { nx: 0, nz: 1 };
    this.climb = { t: 0 };
    this.anchor = { pos: new THREE.Vector3() };
  }

  get horizontalSpeed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  // Aplica uma amostra interpolada (cur) e a velocidade estimada.
  apply(cur, dt) {
    const prevY = this.pos.y;
    if (dt > 0) {
      const k = 1 - Math.exp(-12 * dt);
      this.vel.x += ((cur.x - this.pos.x) / dt - this.vel.x) * k;
      this.vel.y += ((cur.y - prevY) / dt - this.vel.y) * k;
      this.vel.z += ((cur.z - this.pos.z) / dt - this.vel.z) * k;
    }
    this.pos.set(cur.x, cur.y, cur.z);
    this.facing = cur.f;
    const c = cur.code;
    const wasAir = !this.grounded;
    this.state = c === 2 ? 'slide' : c === 3 ? 'swing' : c === 4 ? 'dash' : c === 7 ? 'hang' : 'normal';
    this.grounded = c === 0 || c === 2 || c === 8;
    this.sneaking = c === 8;
    this.surfing = c === 5 || c === 6;
    const fx = Math.sin(cur.f);
    const fz = Math.cos(cur.f);
    if (this.surfing) {
      const s = c === 6 ? 1 : -1;
      this.surfNormal.set(Math.cos(cur.f) * s * 0.8, 0.55, -Math.sin(cur.f) * s * 0.8);
    }
    this.slide.dir.set(fx, 0, fz);
    this.dashDir.set(fx, 0, fz);
    this.hang.nx = -fx;
    this.hang.nz = -fz;
    if (c === 3) {
      this.anchor.pos.set(cur.x + fx * 1.5, cur.y + 7, cur.z + fz * 1.5);
      this.swing.anchor = this.anchor;
    } else {
      this.swing.anchor = null;
    }
    if (this.grounded && wasAir && this.vel.y < -6) this.landSquash = Math.min(1, -this.vel.y / 16);
    const hs = this.horizontalSpeed;
    if (this.grounded && hs > 0.4) this.stepPhase += dt * (5 + Math.min(hs, 14) * 1.05);
  }
}

// --------------------------------------------------------------- gravação
export class Recorder {
  constructor() {
    this.samples = [];
    this.acc = 0;
  }

  start() {
    this.samples = [];
    this.acc = SAMPLE_DT; // grava o primeiro quadro
  }

  update(dt, player) {
    this.acc += dt;
    while (this.acc >= SAMPLE_DT) {
      this.acc -= SAMPLE_DT;
      if (this.samples.length / STRIDE >= MAX_SAMPLES) return;
      const r = (v) => Math.round(v * 100) / 100;
      this.samples.push(r(player.pos.x), r(player.pos.y), r(player.pos.z), r(player.facing), stateCode(player));
    }
  }

  data() {
    return { v: 2, dt: SAMPLE_DT, s: this.samples };
  }
}

export function saveGhost(id, data) {
  try {
    localStorage.setItem(GHOST_KEY + id, JSON.stringify(data));
  } catch {
    /* armazenamento cheio ou indisponível */
  }
}

export function loadGhost(id) {
  try {
    const d = JSON.parse(localStorage.getItem(GHOST_KEY + id) ?? 'null');
    if (d && (d.v === 1 || d.v === 2) && Array.isArray(d.s) && d.s.length >= 8) return d;
  } catch {
    /* ignorado */
  }
  return null;
}

// Interpola uma trilha amostrada a cada dt segundos (stride 4 na versão 1).
function sampleTrack(s, dt, t, out, stride = STRIDE) {
  const n = Math.floor(s.length / stride);
  const f = Math.max(0, t / dt);
  const i = Math.min(n - 1, Math.floor(f));
  const j = Math.min(n - 1, i + 1);
  const k = Math.min(1, f - i);
  const a = i * stride;
  const b = j * stride;
  out.x = s[a] + (s[b] - s[a]) * k;
  out.y = s[a + 1] + (s[b + 1] - s[a + 1]) * k;
  out.z = s[a + 2] + (s[b + 2] - s[a + 2]) * k;
  let df = s[b + 3] - s[a + 3];
  while (df > Math.PI) df -= Math.PI * 2;
  while (df < -Math.PI) df += Math.PI * 2;
  out.f = s[a + 3] + df * k;
  out.code = stride > 4 ? s[(k < 0.5 ? a : b) + 4] : 0;
  out.done = f >= n - 1;
  return out;
}

// Um eco desenhado com o modelo completo.
class EchoFigure {
  constructor(scene, world, materials, light) {
    this.world = world;
    this.model = new Character(scene, { ghost: materials, light: false });
    this.state = new EchoState();
    if (light) this.model.root.add(light);
    this.setVisible(false);
  }

  setSkin(skin) {
    this.model.setSkin(skin);
  }

  setVisible(v) {
    this.visible = v;
    this.model.setVisible(v);
  }

  show(cur, dt, teleport) {
    if (teleport) {
      this.state.pos.set(cur.x, cur.y, cur.z);
      this.state.vel.set(0, 0, 0);
      this.model.reset();
    }
    this.state.apply(cur, dt);
    if (!this.visible) this.setVisible(true);
    this.model.update(dt, this.state, this.world);
  }
}

// --------------------------------------------------------------- fantasma
export class GhostRunner {
  constructor(scene, world) {
    const body = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.3, 0.55, 1.15), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.2, 2.2), transparent: true, opacity: 0.6, depthWrite: false });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 3) });
    this.fig = new EchoFigure(scene, world, { body, accent, eye });
    this.data = null;
    this.cur = { x: 0, y: 0, z: 0, f: 0, code: 0, done: false };
    this.wasHidden = true;
  }

  load(data) {
    this.data = data;
    this.fig.setVisible(false);
    this.wasHidden = true;
  }

  clear() {
    this.load(null);
  }

  setSkin(skin) {
    this.fig.setSkin(skin);
  }

  update(t, dt, enabled) {
    if (!this.data || !enabled) {
      if (this.fig.visible) this.fig.setVisible(false);
      this.wasHidden = true;
      return;
    }
    const c = sampleTrack(this.data.s, this.data.dt, t, this.cur, this.data.v === 1 ? 4 : STRIDE);
    if (c.done) {
      if (this.fig.visible) this.fig.setVisible(false);
      return;
    }
    this.fig.show(c, dt, this.wasHidden);
    this.wasHidden = false;
  }
}

// --------------------------------------------------------------- a Sombra
export class Shadow {
  constructor(scene, world) {
    const body = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.0, 0.035), transparent: true, opacity: 0.94, side: THREE.DoubleSide });
    const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.25, 0.9) });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 1.4) });
    this.light = new THREE.PointLight(0xff3090, 0, 7, 2);
    this.light.position.y = 1.4;
    this.fig = new EchoFigure(scene, world, { body, accent, eye }, this.light);
    this.trail = [];
    this.active = false;
    this.delay = 2.5;
    this.time = 0;
    this.cur = { x: 0, y: 0, z: 0, f: 0, code: 0, done: false };
    this.pos = new THREE.Vector3();
    this.shown = false;
  }

  setSkin(skin) {
    this.fig.setSkin(skin);
  }

  start(delay) {
    this.active = true;
    this.delay = delay;
    this.trail = [];
    this.time = 0;
    this.acc = SAMPLE_DT;
    this.shown = false;
    this.fig.setVisible(false);
  }

  stop() {
    this.active = false;
    this.fig.setVisible(false);
    this.light.intensity = 0;
  }

  // Grava o jogador e move a Sombra. Retorna true se ela alcançou o jogador.
  update(dt, player) {
    if (!this.active) return false;
    this.time += dt;
    this.acc += dt;
    while (this.acc >= SAMPLE_DT) {
      this.acc -= SAMPLE_DT;
      this.trail.push(player.pos.x, player.pos.y, player.pos.z, player.facing, stateCode(player));
    }
    const t = this.time - this.delay;
    if (t < 0) {
      this.fig.setVisible(false);
      return false;
    }
    const c = sampleTrack(this.trail, SAMPLE_DT, t, this.cur);
    this.pos.set(c.x, c.y, c.z);
    this.fig.show(c, dt, !this.shown);
    this.shown = true;
    this.light.intensity = 10 + Math.sin(this.time * 9) * 3;
    if (t < 0.6) return false;
    const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
    return d < 0.75 && Math.abs(player.pos.y - c.y) < 1.4;
  }

  get visible() {
    return this.fig.visible;
  }

  // distância até o jogador (para avisos na interface)
  distanceTo(player) {
    if (!this.fig.visible) return Infinity;
    return this.pos.distanceTo(player.pos);
  }
}
