// Ecos do andarilho: o fantasma do seu recorde (gravado e reproduzido) e a
// Sombra, que refaz o seu caminho com alguns segundos de atraso e mata ao
// alcançar você.
import * as THREE from 'three';

const GHOST_KEY = 'veil.ghost.';
const SAMPLE_DT = 0.05;
const MAX_SAMPLES = 20 * 60 * 10; // 10 minutos

// Cópia simplificada do modelo do andarilho, animada só pela velocidade.
class EchoFigure {
  constructor(scene, player, { body, accent, eye }) {
    const src = player.root;
    this.group = src.clone(true);
    this.group.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.material === player.eyeMat) o.material = eye;
      else if (o.material === player.trimMat) o.material = accent;
      else o.material = body;
    });
    // uma capa curta (o tecido simulado do jogador fica fora do modelo)
    const capeGeo = new THREE.PlaneGeometry(0.46, 0.9);
    capeGeo.translate(0, -0.45, 0);
    this.cape = new THREE.Mesh(capeGeo, body);
    this.cape.position.set(0, 1.44, -0.22);
    this.cape.rotation.x = 0.25;
    this.body = this.group.children[0];
    this.body.add(this.cape);
    this.parts = {};
    this.group.traverse((o) => {
      if (o.name) this.parts[o.name] = o;
    });
    this.group.visible = false;
    this.phase = 0;
    scene.add(this.group);
  }

  pose(x, y, z, facing, speed, airborne, dt) {
    const g = this.group;
    g.position.set(x, y, z);
    g.rotation.y = facing;
    const p = this.parts;
    const run = Math.min(1, speed / 9.5);
    this.phase += dt * (5 + speed * 1.05);
    const sw = Math.sin(this.phase);
    if (airborne) {
      if (p.legL) p.legL.rotation.x = -0.8;
      if (p.legR) p.legR.rotation.x = 0.4;
      if (p.kneeL) p.kneeL.rotation.x = 1.1;
      if (p.armL) p.armL.rotation.x = -0.6;
      if (p.armR) p.armR.rotation.x = -1.0;
      this.body.rotation.x = 0.2;
      this.cape.rotation.x = 1.0;
    } else {
      if (p.legL) p.legL.rotation.x = sw * 1.1 * run;
      if (p.legR) p.legR.rotation.x = -sw * 1.1 * run;
      if (p.kneeL) p.kneeL.rotation.x = 0.1 + Math.max(0, Math.sin(this.phase + 1.6)) * 1.3 * run;
      if (p.kneeR) p.kneeR.rotation.x = 0.1 + Math.max(0, Math.sin(this.phase + 1.6 + Math.PI)) * 1.3 * run;
      if (p.armL) p.armL.rotation.x = -sw * 0.75 * run;
      if (p.armR) p.armR.rotation.x = sw * 0.75 * run;
      this.body.rotation.x = run * 0.28;
      this.cape.rotation.x = 0.15 + run * 0.8;
    }
  }

  set visible(v) {
    this.group.visible = v;
  }

  get visible() {
    return this.group.visible;
  }

  dispose(scene) {
    scene.remove(this.group);
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
      if (this.samples.length / 4 >= MAX_SAMPLES) return;
      const r = (v) => Math.round(v * 100) / 100;
      this.samples.push(r(player.pos.x), r(player.pos.y), r(player.pos.z), r(player.facing));
    }
  }

  data() {
    return { v: 1, dt: SAMPLE_DT, s: this.samples };
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
    if (d && d.v === 1 && Array.isArray(d.s) && d.s.length >= 8) return d;
  } catch {
    /* ignorado */
  }
  return null;
}

// Interpola uma trilha [x, y, z, facing, ...] amostrada a cada dt segundos.
function sampleTrack(s, dt, t, out) {
  const n = s.length / 4;
  const f = Math.max(0, t / dt);
  const i = Math.min(n - 1, Math.floor(f));
  const j = Math.min(n - 1, i + 1);
  const k = Math.min(1, f - i);
  const a = i * 4;
  const b = j * 4;
  out.x = s[a] + (s[b] - s[a]) * k;
  out.y = s[a + 1] + (s[b + 1] - s[a + 1]) * k;
  out.z = s[a + 2] + (s[b + 2] - s[a + 2]) * k;
  let df = s[b + 3] - s[a + 3];
  while (df > Math.PI) df -= Math.PI * 2;
  while (df < -Math.PI) df += Math.PI * 2;
  out.f = s[a + 3] + df * k;
  out.done = f >= n - 1;
  return out;
}

// --------------------------------------------------------------- fantasma
export class GhostRunner {
  constructor(scene, player) {
    const body = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.35, 0.6, 1.2), transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.2, 2.2), transparent: true, opacity: 0.6, depthWrite: false });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.2, 3) });
    this.fig = new EchoFigure(scene, player, { body, accent, eye });
    this.data = null;
    this.cur = { x: 0, y: 0, z: 0, f: 0, done: false };
    this.prev = new THREE.Vector3();
  }

  load(data) {
    this.data = data;
    this.fig.visible = false;
  }

  clear() {
    this.data = null;
    this.fig.visible = false;
  }

  update(t, dt, enabled) {
    if (!this.data || !enabled) {
      this.fig.visible = false;
      return;
    }
    const c = sampleTrack(this.data.s, this.data.dt, t, this.cur);
    const speed = dt > 0 ? Math.hypot(c.x - this.prev.x, c.z - this.prev.z) / dt : 0;
    const airborne = dt > 0 && Math.abs(c.y - this.prev.y) / dt > 1.5;
    this.prev.set(c.x, c.y, c.z);
    this.fig.visible = !c.done;
    this.fig.pose(c.x, c.y, c.z, c.f, Math.min(speed, 14), airborne, dt);
  }
}

// --------------------------------------------------------------- a Sombra
export class Shadow {
  constructor(scene, player) {
    const body = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.03, 0.0, 0.035), transparent: true, opacity: 0.92 });
    const accent = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.25, 0.9) });
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.4, 1.4) });
    this.fig = new EchoFigure(scene, player, { body, accent, eye });
    this.light = new THREE.PointLight(0xff3090, 0, 7, 2);
    this.fig.group.add(this.light);
    this.light.position.y = 1.4;
    this.trail = [];
    this.active = false;
    this.delay = 2.5;
    this.time = 0;
    this.cur = { x: 0, y: 0, z: 0, f: 0, done: false };
    this.prev = new THREE.Vector3();
    this.pos = new THREE.Vector3();
  }

  start(delay) {
    this.active = true;
    this.delay = delay;
    this.trail = [];
    this.time = 0;
    this.acc = SAMPLE_DT;
    this.fig.visible = false;
  }

  stop() {
    this.active = false;
    this.fig.visible = false;
    this.light.intensity = 0;
  }

  // Grava o jogador e move a Sombra. Retorna true se ela alcançou o jogador.
  update(dt, player) {
    if (!this.active) return false;
    this.time += dt;
    this.acc += dt;
    while (this.acc >= SAMPLE_DT) {
      this.acc -= SAMPLE_DT;
      this.trail.push(player.pos.x, player.pos.y, player.pos.z, player.facing);
    }
    const t = this.time - this.delay;
    if (t < 0) {
      this.fig.visible = false;
      return false;
    }
    const c = sampleTrack(this.trail, SAMPLE_DT, t, this.cur);
    const speed = dt > 0 ? Math.hypot(c.x - this.prev.x, c.z - this.prev.z) / dt : 0;
    const airborne = dt > 0 && Math.abs(c.y - this.prev.y) / dt > 1.5;
    this.prev.set(c.x, c.y, c.z);
    this.pos.set(c.x, c.y, c.z);
    this.fig.visible = true;
    this.fig.pose(c.x, c.y, c.z, c.f, Math.min(speed, 14), airborne, dt);
    this.light.intensity = 10 + Math.sin(this.time * 9) * 3;
    if (t < 0.6) return false;
    const d = Math.hypot(player.pos.x - c.x, player.pos.z - c.z);
    return d < 0.75 && Math.abs(player.pos.y - c.y) < 1.4;
  }

  // distância até o jogador (para avisos na interface)
  distanceTo(player) {
    if (!this.fig.visible) return Infinity;
    return this.pos.distanceTo(player.pos);
  }
}
