// Os chefes de cada capítulo. Cada um monta a sua arena e entrega ao
// construtor um controlador (b.bossFight): o padrão de ataques, os perigos
// próprios (kills) e o que acontece a cada runa acesa. As runas 'boss' são
// os acertos; o portal só abre quando todas acendem.
//   I   O Sineiro    — ondas de choque do sino (pule) e sinos que caem
//   II  A Locomotiva — luta em cima de um trem fantasma em movimento
//   III O Vendaval   — rajadas que empurram para o abismo; abrigo e raios
//   IV  O Reflexo    — um mundo apodrece de cada vez: troque de lado (F)
//   VI  O Eclipse    — fora da luz dos braseiros, a escuridão consome
//   VII A Traça      — os muros dourados somem: atrás de você e à frente
import * as THREE from 'three';
import { KILL } from '../physics.js';
import { Character } from '../character.js';
import { PoolLight } from '../lights.js';

const ev = (b, ...a) => b.onBossEvent?.(...a);
const clamp = THREE.MathUtils.clamp;

function glow(b, r, g, bl, extra = {}) {
  return b.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, bl), ...extra }));
}

function soft(b, r, g, bl, opacity) {
  return glow(b, r, g, bl, { transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true });
}

// marca tudo como móvel (não entra na malha estática juntada)
function dyn(o) {
  o.traverse((c) => {
    c.userData.dynamic = true;
  });
  return o;
}

// ---------------------------------------------------------------- peças comuns
// Círculo de aviso no chão (pulsa e enche até o impacto).
class Warn {
  constructor(b, color = [2.6, 0.25, 0.5]) {
    this.mat = soft(b, ...color, 0);
    this.fillMat = soft(b, ...color, 0);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), this.mat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.add(new THREE.Mesh(new THREE.CircleGeometry(0.86, 40), this.fillMat));
    this.ring.visible = false;
    b.group.add(dyn(this.ring));
  }

  show(x, y, z, r, k, t) {
    this.ring.visible = true;
    this.ring.position.set(x, y + 0.07, z);
    this.ring.scale.setScalar(r);
    this.mat.opacity = 0.55 + 0.45 * Math.sin(t * 20);
    this.fillMat.opacity = k * 0.38;
  }

  hide() {
    this.ring.visible = false;
  }
}

// Algo que cai do céu num ponto marcado: sino, carvão, raio, orbe escuro.
class Drop {
  constructor(b, mesh, { radius = 2, tele = 1.1, height = 15, fall = 0.25, color } = {}) {
    this.b = b;
    this.mesh = dyn(mesh);
    mesh.visible = false;
    b.group.add(mesh);
    this.warn = new Warn(b, color);
    this.radius = radius;
    this.teleBase = tele;
    this.height = height;
    this.fall = fall;
    this.pos = new THREE.Vector3();
    this.state = 'idle';
    this.t = 0;
  }

  get busy() {
    return this.state !== 'idle';
  }

  start(x, y, z, pace = 1) {
    this.pos.set(x, y, z);
    this.tele = this.teleBase * pace;
    this.t = 0;
    this.state = 'warn';
    this.mesh.visible = true;
    this.mesh.position.set(x, y + this.height, z);
    ev(this.b, 'sfx', 'alert', 'suspicious');
  }

  update(dt) {
    if (this.state === 'idle') return;
    this.t += dt;
    const p = this.pos;
    if (this.state === 'warn') {
      const k = Math.min(1, this.t / this.tele);
      this.warn.show(p.x, p.y, p.z, this.radius * (1.25 - 0.25 * k), k, this.t);
      this.mesh.position.y = p.y + this.height - k * 2;
      this.mesh.rotation.y += dt * 2;
      if (this.t >= this.tele) {
        this.state = 'fall';
        this.t = 0;
      }
    } else if (this.state === 'fall') {
      const k = Math.min(1, this.t / this.fall);
      this.mesh.position.y = p.y + (this.height - 2) * (1 - k * k);
      if (k >= 1) {
        this.state = 'impact';
        this.t = 0;
        this.warn.hide();
        this.onImpact?.(p);
        ev(this.b, 'slam', p);
      }
    } else if (this.state === 'impact') {
      if (this.t > 0.15) {
        this.state = 'sink';
        this.t = 0;
      }
    } else if (this.t > 0.7) {
      this.reset();
    } else {
      this.mesh.position.y -= dt * 3;
    }
  }

  kills(pl) {
    if (this.state !== 'impact') return false;
    const p = this.pos;
    return Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z) < this.radius && pl.pos.y < p.y + 2.4 && pl.pos.y > p.y - 1.5;
  }

  reset() {
    this.state = 'idle';
    this.mesh.visible = false;
    this.warn.hide();
  }
}

// Onda de choque: um muro baixo de luz que se expande pelo chão (pule).
class Wave {
  constructor(b, color, height = 0.75) {
    this.mat = soft(b, ...color, 0.9);
    this.height = height;
    this.mesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, height, 72, 1, true), this.mat);
    this.mesh.visible = false;
    b.group.add(dyn(this.mesh));
    this.c = new THREE.Vector3();
    this.active = false;
  }

  start(cx, y, cz, r0, speed, rMax) {
    this.c.set(cx, y, cz);
    this.r = r0;
    this.speed = speed;
    this.rMax = rMax;
    this.active = true;
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.active) return;
    this.r += this.speed * dt;
    this.mesh.position.set(this.c.x, this.c.y + this.height / 2, this.c.z);
    this.mesh.scale.set(this.r, 1, this.r);
    this.mat.opacity = 0.9 * Math.min(1, (this.rMax - this.r) / 4);
    if (this.r > this.rMax) this.reset();
  }

  kills(pl) {
    if (!this.active) return false;
    const d = Math.hypot(pl.pos.x - this.c.x, pl.pos.z - this.c.z);
    return Math.abs(d - this.r) < 0.45 && pl.pos.y < this.c.y + this.height - 0.03 && pl.pos.y > this.c.y - 0.6;
  }

  reset() {
    this.active = false;
    this.mesh.visible = false;
  }
}

// Gigante encapuzado feito de sombra (o Sineiro, o Maquinista...).
function hoodedGiant(b, x, y, z, s, eye = [3.2, 1.2, 0.5]) {
  const M = b.M;
  const g = new THREE.Group();
  const robe = new THREE.Mesh(new THREE.ConeGeometry(4.4 * s, 17 * s, 10), M.dark);
  robe.position.y = 8.5 * s;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(2.6 * s, 12, 10), M.dark);
  hood.position.y = 17.2 * s;
  hood.scale.set(1, 1.15, 1);
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.9 * s, 12, 10), M.silhouette);
  face.position.set(0, 16.9 * s, 1.05 * s);
  const eyeMat = glow(b, ...eye);
  const eyes = [-1, 1].map((sd) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 8, 6), eyeMat);
    e.position.set(sd * 0.7 * s, 17.2 * s, 2.7 * s);
    e.scale.set(1, 0.6, 0.5);
    return e;
  });
  const arms = [-1, 1].map((sd) => {
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.9 * s, 7 * s, 4, 8), M.dark);
    a.position.set(sd * 3.4 * s, 12 * s, 1.5 * s);
    a.rotation.set(-0.9, 0, sd * 0.35);
    return a;
  });
  g.add(robe, hood, face, ...eyes, ...arms);
  g.position.set(x, y, z);
  b.group.add(dyn(g));
  return { g, eyeMat, eyeBase: new THREE.Color(...eye), arms, baseY: y };
}

// --------------------------------------------------------------- I. O Sineiro
export function sineiro(b) {
  const M = b.M;
  const Y = 0;
  b.platform(-17, -17, 17, 17, Y, { bottom: -14 });
  b.startAt(0, Y, 13.5);
  b.checkpoint(0, Y, 12, 3.4, 14);
  // torre do sino no centro
  b.block(-2.6, Y, -2.6, 2.6, Y + 2.2, 2.6, M.wallDark);
  for (const [x, z] of [[-2.2, -2.2], [2.2, -2.2], [-2.2, 2.2], [2.2, 2.2]]) b.block(x - 0.35, Y + 2.2, z - 0.35, x + 0.35, Y + 15, z + 0.35, M.wallDark);
  b.block(-3, Y + 15, -3, 3, Y + 16, 3, M.trim);
  b.spire(0, Y + 16, 0, 5, 7);
  // o grande sino
  const bell = new THREE.Group();
  bell.position.set(0, Y + 14.8, 0);
  const bronze = b.ownMat(new THREE.MeshStandardMaterial({
    color: 0x9a7438, metalness: 0.7, roughness: 0.35, emissive: new THREE.Color(0.3, 0.14, 0.03), side: THREE.DoubleSide,
  }));
  const prof = [[2.4, -4.2], [2.3, -3.8], [1.9, -2.6], [1.6, -1.2], [1.2, -0.3], [0.5, 0], [0.01, 0]].map(([r, y]) => new THREE.Vector2(r, y));
  bell.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 28), bronze));
  const clapper = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), bronze);
  clapper.position.y = -3.6;
  bell.add(clapper);
  b.group.add(dyn(bell));
  // pedestais baixos: a onda passa por baixo de quem está em cima
  for (const [x, z] of [[-9, 5], [9, 5], [-13, -2], [13, -2], [-5, -9], [5, -9]]) b.block(x - 1, Y, z - 1, x + 1, Y + 0.9, z + 1, M.trim);
  // três pilares com as runas, com dois degraus virados para a torre
  const pillars = [[-12, -10], [12, -10], [0, -15]];
  for (const [x, z] of pillars) {
    b.block(x - 1.3, Y, z - 1.3, x + 1.3, Y + 4.2, z + 1.3, M.wall);
    const l = Math.hypot(x, z);
    const dx = -x / l;
    const dz = -z / l;
    for (const [off, top] of [[2.0, 2.8], [3.5, 1.4]]) {
      const sx = x + dx * off;
      const sz = z + dz * off;
      b.block(sx - 0.7, Y, sz - 0.7, sx + 0.7, Y + top, sz + 0.7, M.wallDark);
    }
  }
  const giant = hoodedGiant(b, 0, -16, -32, 1.6, [3.2, 1.3, 0.5]);
  const waves = [0, 1, 2, 3].map(() => new Wave(b, [2.4, 0.55, 1.3]));
  const drops = [0, 1, 2].map(() => {
    const m = new THREE.Group();
    m.add(new THREE.Mesh(new THREE.LatheGeometry(prof.map((v) => v.clone().multiplyScalar(0.4)), 16), bronze));
    return new Drop(b, m, { radius: 1.9, tele: 1.15, height: 15 });
  });
  const S = { state: 'wait', t: 0, step: 0, swing: 0, count: 0, emitted: 0, told: false };
  const PATTERNS = [
    ['ring', 'ring', 'drop', 'ring', 'drop2'],
    ['double', 'drop2', 'ring', 'double', 'drop'],
    ['triple', 'drop2', 'double', 'drop3', 'triple'],
  ];
  const dropAt = (n, pace) => {
    const p = b.playerRef.pos;
    const v = b.playerRef.vel;
    const pts = [[p.x, p.z], [p.x + v.x * 0.9, p.z + v.z * 0.9], [p.x + (Math.random() - 0.5) * 7, p.z + (Math.random() - 0.5) * 7]];
    for (let i = 0; i < n; i++) {
      const d = drops.find((q) => !q.busy);
      if (!d) break;
      d.start(clamp(pts[i][0], -15.5, 15.5), Y, clamp(pts[i][1], -15.5, 15.5), pace);
    }
  };
  b.bossFight({
    name: 'O Sineiro',
    runes: pillars.map(([x, z]) => [x, Y + 5.5, z]),
    tick(dt, time) {
      for (const w of waves) w.update(dt);
      for (const d of drops) d.update(dt);
      S.swing *= Math.exp(-1.6 * dt);
      bell.rotation.z = S.swing * Math.sin(time * 5.5) * 0.4;
      giant.arms[1].rotation.x = -0.9 - S.swing * 0.6 * Math.max(0, Math.sin(time * 5.5));
      if (this.defeated) {
        giant.g.position.y -= dt * (2 + this.t * 0.2);
        if (bell.position.y > Y + 4.4) bell.position.y = Math.max(Y + 4.4, bell.position.y - dt * 14);
        return;
      }
      if (!b.playerRef) return;
      const pace = [1, 0.85, 0.72][Math.min(this.lit, 2)];
      S.t += dt;
      if (S.state === 'wait' && S.t > 1.5 * pace) {
        const pick = PATTERNS[Math.min(this.lit, 2)][S.step % 5];
        S.step++;
        S.t = 0;
        if (pick.startsWith('drop')) {
          dropAt(pick === 'drop' ? 1 : pick === 'drop2' ? 2 : 3, pace);
        } else {
          S.state = 'toll';
          S.count = { ring: 1, double: 2, triple: 3 }[pick];
          S.emitted = 0;
          S.swing = 1;
          if (!S.told) {
            S.told = true;
            ev(b, 'toast', 'O sino vai tocar: pule as ondas!', 2);
          }
        }
      } else if (S.state === 'toll') {
        const tele = 0.85 * pace;
        const gap = 0.55 * pace;
        if (S.t >= tele + S.emitted * gap && S.emitted < S.count) {
          const w = waves.find((q) => !q.active) ?? waves[0];
          w.start(0, Y, 0, 3.0, 8.5, 26);
          S.emitted++;
          S.swing = 1;
          ev(b, 'sfx', 'bell');
          ev(b, 'shake', 0.22);
        }
        if (S.emitted >= S.count) {
          S.state = 'wait';
          S.t = 0;
        }
      }
    },
    kills(pl) {
      return waves.some((w) => w.kills(pl)) || drops.some((d) => d.kills(pl));
    },
    reset() {
      for (const w of waves) w.reset();
      for (const d of drops) d.reset();
      Object.assign(S, { state: 'wait', t: 0, step: 0, swing: 0 });
      giant.g.position.y = giant.baseY;
      bell.position.y = Y + 14.8;
      bell.rotation.z = 0;
    },
    onHit() {
      S.swing = 1.5;
      ev(b, 'sfx', 'bell');
    },
  });
  // degrau para o topo da torre (o fragmento fica lá, sob o sino)
  b.block(3.2, Y, -0.7, 4.6, Y + 1.2, 0.7, M.trim);
  b.goalPortal(0, Y, 8);
  b.memory(0, Y + 3.4, 0.0);
  b.hint([-17, -1, 9], [17, 6, 17], 'O Sineiro: acenda as <b>três runas</b> no alto dos pilares. Quando o sino tocar, <b>pule as ondas</b>.');
  b.scenery(0, -10, 150);
  b.motes([-20, -4, -20], [20, 20, 20], 1200, new THREE.Color(1.6, 1.0, 0.5));
  b.killY = -14;
}

// --------------------------------------------------------------- II. A Locomotiva
export function locomotiva(b) {
  const M = b.M;
  const R = 12;
  const ROOF = 0.9;
  const N = 6;
  const GAP = 0.3;
  b.platform(-7, -7, 7, 7, 0, { bottom: -14 });
  b.startAt(0, 0, 4.5);
  b.checkpoint(0, 0, 3.6, 3.6, 5.6);
  // trilhos no ar (só visuais)
  const railMat = glow(b, 0.25, 0.9, 1.1);
  for (const r of [R - 1.1, R + 1.1]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.07, 6, 120), railMat);
    rail.rotation.x = Math.PI / 2;
    rail.position.y = -2.3;
    b.group.add(rail);
  }
  // carruagens: colisores que andam em círculo e levam o jogador junto
  const ghostMat = glow(b, 0.3, 1.4, 1.3);
  const cars = [];
  for (let i = 0; i < N; i++) {
    const g = new THREE.Group();
    const engine = i === 0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.9, 3.2), M.slab);
    body.position.y = ROOF - 1.45;
    body.castShadow = true;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 3.3), M.trim);
    roof.position.y = ROOF - 0.05;
    g.add(body, roof);
    for (const sd of [-1, 1]) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 2.4), ghostMat);
      win.position.set(sd * 1.22, ROOF - 1.0, 0);
      g.add(win);
      for (const zz of [-1, 1]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.25, 12), M.iron);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(sd * 1.2, ROOF - 2.9, zz * 1.05);
        g.add(wheel);
      }
    }
    if (engine) {
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.45, 0.7, 10), M.iron);
      chimney.position.set(0, ROOF + 0.3, 1.0);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), glow(b, 3, 2.4, 1.2));
      lamp.position.set(0, ROOF - 0.9, 1.7);
      const catcherMesh = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.6, 4), glow(b, 2.4, 0.3, 0.6));
      catcherMesh.rotation.set(Math.PI / 2, Math.PI / 4, 0);
      catcherMesh.position.set(0, ROOF - 2.2, 2.2);
      g.add(chimney, lamp, catcherMesh);
    }
    b.group.add(dyn(g));
    const c = b.world.add(-1.4, ROOF - 3.1, -1.4, 1.4, ROOF, 1.4);
    c.noGrab = true;
    b.dyn.push(c);
    cars.push({ g, c });
  }
  const catcher = b.world.add(-0.8, ROOF - 3, -0.8, 0.8, ROOF + 1.2, 0.8, KILL);
  b.dyn.push(catcher);
  const engineLight = new PoolLight(0xffd8a0, 18, 12, 2);
  cars[0].g.add(engineLight);
  engineLight.position.set(0, 1, 2.5);
  // arcos baixos sobre os trilhos: agache (C) ao passar
  const arches = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a) => {
    const sx = Math.sin(a);
    const sz = Math.cos(a);
    const along = Math.abs(sz) > 0.5;
    for (const r of [8.6, 15.4]) b.block(sx * r - 0.4, -3, sz * r - 0.4, sx * r + 0.4, 3.8, sz * r + 0.4, M.wallDark);
    // barra radial (de r = 9,2 a 14,8) e a viga de pedra por cima
    const span = (r0, r1, w) => (along
      ? [-w, Math.min(sz * r0, sz * r1), w, Math.max(sz * r0, sz * r1)]
      : [Math.min(sx * r0, sx * r1), -w, Math.max(sx * r0, sx * r1), w]);
    const [bx0, bz0, bx1, bz1] = span(8.2, 15.8, 0.4);
    b.block(bx0, 3.3, bz0, bx1, 3.8, bz1, M.trim);
    const [x0, z0, x1, z1] = span(9.2, 14.8, 0.2);
    return b.blade(x0, ROOF + 1.05, z0, x1, ROOF + 2.3, z1);
  });
  const coal = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9, 0), glow(b, 2.6, 0.7, 0.2));
    return new Drop(b, m, { radius: 2.0, tele: 1.2, height: 13, color: [2.6, 0.7, 0.2] });
  });
  const S = { th: 0, coalT: 0, told: false };
  const OMEGA = [0.42, 0.52, 0.62];
  const runeCar = [N - 1, 3, 0];
  const place = (dt) => {
    for (let i = 0; i < N; i++) {
      const th = S.th - i * GAP;
      const x = R * Math.sin(th);
      const z = R * Math.cos(th);
      const { c, g } = cars[i];
      c.translate(x - 1.4 - c.minX, 0, z - 1.4 - c.minZ);
      g.position.set(x, 0, z);
      g.rotation.y = Math.atan2(Math.cos(th), -Math.sin(th));
    }
    const ta = S.th + 0.2;
    catcher.translate(R * Math.sin(ta) - 0.8 - catcher.minX, 0, R * Math.cos(ta) - 0.8 - catcher.minZ);
    const boss = b.boss;
    boss.runes.forEach((r, k) => {
      const car = cars[runeCar[k]].g;
      if (k > boss.lit && !r.lit) {
        r.pos.set(0, -500, 0);
      } else {
        // na fornalha (locomotiva) um pouco à frente; nos vagões, no meio
        const th = S.th - runeCar[k] * GAP;
        const f = runeCar[k] === 0 ? 0.6 : 0;
        r.pos.set(car.position.x + Math.cos(th) * f, ROOF + 1.3, car.position.z - Math.sin(th) * f);
      }
      r.g.position.copy(r.pos);
    });
    if (dt > 0 && Math.random() < dt * 18) {
      const e = cars[0].g;
      b.effects.sparks(e.position.x, ROOF + 1.2, e.position.z, 1, { speed: 0.8, life: 1.3, gravity: -2, size: 0.35, color: new THREE.Color(0.4, 1.2, 1.1), whiteChance: 0.3 });
    }
  };
  b.bossFight({
    name: 'A Locomotiva',
    runes: [[0, -500, 0], [0, -500, 0], [0, -500, 0]],
    tick(dt) {
      for (const d of coal) d.update(dt);
      if (this.defeated) {
        // descarrila: as carruagens afundam no abismo
        for (const { c, g } of cars) {
          c.translate(0, -dt * (4 + this.t * 3), 0);
          g.position.y = c.minY - (ROOF - 3.1);
        }
        return;
      }
      const lit = Math.min(this.lit, 2);
      S.th += OMEGA[lit] * dt;
      place(dt);
      arches.forEach((bar, i) => {
        const on = lit >= 1 || i % 2 === 0;
        bar.c.enabled = on;
        bar.mesh.visible = on;
      });
      if (!S.told && b.playerRef && b.playerRef.groundCol && cars.some((q) => q.c === b.playerRef.groundCol)) {
        S.told = true;
        ev(b, 'toast', 'Arco à frente: segure C para se abaixar!', 2.4);
      }
      S.coalT += dt;
      if (S.coalT > [4.2, 3.4, 2.7][lit] && b.playerRef) {
        S.coalT = 0;
        const p = b.playerRef.pos;
        const d = coal.find((q) => !q.busy);
        if (d && Math.hypot(p.x, p.z) < 9) d.start(clamp(p.x, -6.5, 6.5), 0, clamp(p.z, -6.5, 6.5));
      }
    },
    kills(pl) {
      return coal.some((d) => d.kills(pl));
    },
    reset() {
      for (const d of coal) d.reset();
      S.th = Math.PI * 0.6;
      S.coalT = 0;
      for (const { c } of cars) c.translate(0, ROOF - c.maxY, 0);
      place(0);
    },
    onHit() {
      ev(b, 'sfx', 'whistle');
    },
  });
  b.goalPortal(0, 0, -3);
  // fragmento sobre os trilhos, entre dois arcos: salte de cima do trem
  b.memory(R * 0.707, 3.2, R * 0.707);
  b.hint([-7, -1, -7], [7, 6, 7], 'A Locomotiva: pule nos vagões e corra até a <b>runa</b> em cima deles. Uma de cada vez — a última está na fornalha.');
  b.scenery(0, 0, 140);
  b.motes([-20, -6, -20], [20, 14, 20], 1200, new THREE.Color(0.4, 1.4, 1.3));
  b.killY = -14;
}

// --------------------------------------------------------------- III. O Vendaval
export function vendaval(b) {
  const M = b.M;
  const RING = 14;
  const islands = [];
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const x = Math.round(Math.sin(a) * RING * 10) / 10;
    const z = Math.round(Math.cos(a) * RING * 10) / 10;
    b.platform(x - 3, z - 3, x + 3, z + 3, 0, { bottom: -10 });
    // menir do lado de dentro: abrigo contra a rajada
    const mx = Math.sin(a) * (RING - 2.4);
    const mz = Math.cos(a) * (RING - 2.4);
    b.block(mx - 0.6, 0, mz - 0.6, mx + 0.6, 3.6, mz + 0.6, M.statue);
    islands.push({ a, x, z });
  }
  b.startAt(0, 0, RING + 1.5);
  b.checkpoint(0, 0, RING + 2.2, 2.2, RING + 2.6);
  // correntes para cima nas ilhas 2, 4 e 6: as runas no alto
  const updrafts = [2, 4, 6].map((k) => islands[k]);
  for (const u of updrafts) b.wind([u.x - 1.4, -12, u.z - 1.4], [u.x + 1.4, 11.5, u.z + 1.4], [0, 46, 0]);
  // o tornado
  const tw = new THREE.Group();
  const shells = [];
  for (let i = 0; i < 5; i++) {
    const r0 = 1.2 + i * 0.9;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(r0 + 2.6, r0, 34, 24, 1, true), soft(b, 0.25, 0.8 + i * 0.1, 0.8, 0.03 + i * 0.012));
    s.position.y = 5;
    tw.add(s);
    shells.push(s);
  }
  const eyeMat = glow(b, 0.6, 2.8, 2.6);
  const eyes = [-1, 1].map((sd) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), eyeMat);
    e.position.set(sd * 1.4, 15, 3.6);
    e.scale.set(1.3, 0.55, 0.6);
    return e;
  });
  const head = new THREE.Group();
  head.add(...eyes);
  tw.add(head);
  const debris = [];
  for (let i = 0; i < 10; i++) {
    const d = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5 + Math.random() * 0.8, 0), M.rock);
    d.userData.orbit = [4 + Math.random() * 5, Math.random() * Math.PI * 2, -6 + Math.random() * 20, 0.6 + Math.random()];
    tw.add(d);
    debris.push(d);
  }
  b.group.add(dyn(tw));
  // raios (a partir da segunda runa)
  const bolts = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 40, 0.35), glow(b, 2.4, 2.8, 3.4));
    const d = new Drop(b, m, { radius: 1.7, tele: 1.0, height: 20, fall: 0.06, color: [1.6, 2.2, 3.0] });
    d.onImpact = () => {
      ev(b, 'sfx', 'thunder', 0.05);
      ev(b, 'flash', 0.35);
    };
    return d;
  });
  const S = { state: 'wait', t: 0, boltT: 0, told: false, push: new THREE.Vector3() };
  const sheltered = (p) => {
    const dx = p.x;
    const dz = p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.5) return true;
    const hit = b.world.raycast(0, p.y + 1, 0, dx / dist, 0, dz / dist, dist);
    return !!hit && hit.t < dist - 0.4;
  };
  b.bossFight({
    name: 'O Vendaval',
    runes: updrafts.map((u) => [u.x, 12.6, u.z]),
    tick(dt, time) {
      for (const d of bolts) d.update(dt);
      const blowing = S.state === 'blow';
      const spin = blowing ? 2.4 : S.state === 'inhale' ? -0.6 : 0.8;
      shells.forEach((s, i) => {
        s.rotation.y += dt * spin * (1 + i * 0.3);
      });
      const k = S.state === 'inhale' ? Math.min(1, S.t / 1.1) : 0;
      tw.scale.set(1 - k * 0.25, 1, 1 - k * 0.25);
      eyeMat.color.setRGB(0.6 + k * 1.8, 2.8, 2.6 + k);
      for (const d of debris) {
        const [r, ph, y, sp] = d.userData.orbit;
        const ang = ph + time * sp * (blowing ? 3 : 1);
        d.position.set(Math.cos(ang) * r, y + Math.sin(time + ph) * 0.8, Math.sin(ang) * r);
        d.rotation.x += dt;
      }
      const pl = b.playerRef;
      if (pl) head.rotation.y = Math.atan2(pl.pos.x, pl.pos.z);
      if (this.defeated) {
        tw.scale.multiplyScalar(Math.exp(-dt * 0.8));
        tw.position.y -= dt * 3;
        return;
      }
      if (!pl) return;
      const lit = Math.min(this.lit, 2);
      S.t += dt;
      if (S.state === 'wait' && S.t > [3.8, 3.2, 2.6][lit]) {
        S.state = 'inhale';
        S.t = 0;
        ev(b, 'sfx', 'inhale');
        if (!S.told) {
          S.told = true;
          ev(b, 'toast', 'O Vendaval vai soprar: fique atrás de uma pedra!', 2.4);
        }
      } else if (S.state === 'inhale' && S.t > 1.1) {
        S.state = 'blow';
        S.t = 0;
        ev(b, 'sfx', 'gust');
        ev(b, 'shake', 0.35);
      } else if (S.state === 'blow') {
        const p = pl.pos;
        const dist = Math.hypot(p.x, p.z);
        if (dist > 0.5 && !sheltered(p)) {
          const push = [7.5, 8.2, 9][lit] * dt;
          p.x += (p.x / dist) * push;
          p.z += (p.z / dist) * push;
          if (Math.random() < dt * 30) b.effects.sparks(p.x - (p.x / dist) * 3, p.y + 1 + Math.random(), p.z - (p.z / dist) * 3, 1, { speed: 0.5, life: 0.5, size: 0.12, gravity: 0, vx: (p.x / dist) * 14, vz: (p.z / dist) * 14, color: new THREE.Color(0.6, 1.4, 1.4) });
        }
        if (S.t > 1.6) {
          S.state = 'wait';
          S.t = 0;
        }
      }
      if (lit >= 1) {
        S.boltT += dt;
        if (S.boltT > [99, 3.4, 2.6][lit]) {
          S.boltT = 0;
          const d = bolts.find((q) => !q.busy);
          if (d) d.start(pl.pos.x + pl.vel.x * 0.5, 0, pl.pos.z + pl.vel.z * 0.5);
        }
      }
    },
    kills(pl) {
      return bolts.some((d) => d.kills(pl));
    },
    reset() {
      for (const d of bolts) d.reset();
      Object.assign(S, { state: 'wait', t: 0, boltT: 0 });
      tw.scale.setScalar(1);
      tw.position.y = 0;
    },
  });
  b.goalPortal(0, 0, RING - 0.3);
  b.memory(islands[7].x, 2.6, islands[7].z);
  b.hint([-4, -1, RING - 4], [4, 6, RING + 4], 'O Vendaval: suba nas <b>correntes de vento</b> até as runas. Quando ele soprar, esconda-se atrás das pedras.');
  b.scenery(0, 0, 150);
  b.motes([-22, -8, -22], [22, 18, 22], 1200, new THREE.Color(0.4, 1.6, 1.5));
  b.killY = -16;
}

// --------------------------------------------------------------- IV. O Reflexo
export function reflexo(b) {
  b.platform(-15, -15, 15, 15, 0, { bottom: -12 });
  b.startAt(0, 0, 12);
  b.checkpoint(0, 0, 11, 3.4, 13);
  b.shadowChaser(2.6);
  // pilares que só existem num dos mundos, com as runas em cima
  const spots = [[-10, -8, 1], [10, -8, 0], [0, -12, 1]];
  for (const [x, z, d] of spots) b.dimBlock(x - 1, 0, z - 1, x + 1, 1.4, z + 1, d);
  // pedras soltas dos dois mundos: atrapalham a troca de lado
  for (const [x, z, d] of [[-5, 2, 0], [5, 2, 1], [-9, 6, 1], [9, 6, 0], [0, -4, 0]]) b.dimBlock(x - 0.8, 0, z - 0.8, x + 0.8, 2.2, z + 0.8, d);
  // a podridão: cobre o chão do mundo que apodrece (vista só de dentro dele)
  const rot = [0, 1].map((d) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), soft(b, d ? 1.6 : 2.4, 0.15, d ? 1.2 : 0.4, 0));
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.05;
    m.visible = false;
    b.group.add(dyn(m));
    return m;
  });
  // lâminas de um mundo só que varrem a arena (da segunda runa em diante)
  const blades = [0, 1].map((d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(30, 2.6, 0.35), soft(b, d ? 1.4 : 0.4, d ? 0.4 : 1.0, d ? 2.4 : 2.6, 0.8));
    m.visible = false;
    b.group.add(dyn(m));
    return { d, m, z: 0, active: false };
  });
  // o Reflexo: um andarilho gigante do outro lado que imita cada gesto seu
  // a cena de apoio guarda o tecido, o rastro e a sombra do gigante (não aparecem)
  const aside = new THREE.Scene();
  const fig = new Character(aside, {
    light: false,
    ghost: {
      body: b.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.05, 0.02, 0.09) })),
      accent: glow(b, 1.6, 0.4, 2.4),
      eye: glow(b, 3.6, 0.6, 2.2),
    },
  });
  b.group.add(dyn(fig.root));
  const S = { state: 'wait', t: 0, world: 0, second: false, bladeT: 0, told: false, sink: 0 };
  const FIG_Z = -38;
  b.bossFight({
    name: 'O Reflexo',
    runes: spots.map(([x, z]) => [x, 2.7, z]),
    tick(dt, time) {
      const pl = b.playerRef;
      const lit = Math.min(this.lit, 2);
      // o gigante espelha o andarilho (Object.create: lê o jogador sem mexer nele)
      if (pl) {
        const P = Object.create(pl);
        P.pos = new THREE.Vector3(pl.pos.x, -8 - S.sink, FIG_Z);
        P.facing = Math.PI - pl.facing;
        fig.update(dt, P, b.world);
        fig.root.position.copy(P.pos);
        fig.root.scale.setScalar(8.5);
      }
      for (const bl of blades) {
        if (!bl.active) continue;
        bl.z -= dt * 9;
        bl.m.position.set(0, 1.3, bl.z);
        bl.m.material.opacity = b.dim === bl.d ? 0.85 : 0.2;
        if (bl.z < -16) {
          bl.active = false;
          bl.m.visible = false;
        }
      }
      if (this.defeated) {
        S.sink += dt * 6;
        rot[0].visible = rot[1].visible = false;
        return;
      }
      if (!pl) return;
      const pace = [1, 0.85, 0.72][lit];
      S.t += dt;
      if (S.state === 'wait' && S.t > 2.4 * pace) {
        // apodrece o mundo em que o andarilho está
        S.state = 'warn';
        S.t = 0;
        S.world = b.dim;
        S.second = lit >= 2;
        ev(b, 'sfx', 'alert', 'chase');
        if (!S.told) {
          S.told = true;
          ev(b, 'toast', 'O chão deste mundo vai apodrecer: troque de lado (F)!', 2.4);
        }
      } else if (S.state === 'warn' && S.t > 1.3 * pace) {
        S.state = 'rot';
        S.t = 0;
        ev(b, 'shake', 0.3);
      } else if (S.state === 'rot' && S.t > 1.8) {
        if (S.second) {
          // na última fase o outro mundo apodrece logo em seguida
          S.second = false;
          S.state = 'warn';
          S.world = 1 - S.world;
          S.t = 0.35 * pace;
        } else {
          S.state = 'wait';
          S.t = 0;
        }
      }
      rot.forEach((m, d) => {
        const on = (S.state === 'warn' || S.state === 'rot') && S.world === d && b.dim === d;
        m.visible = on;
        if (on) m.material.opacity = S.state === 'rot' ? 0.5 : 0.12 + 0.14 * Math.sin(time * 16);
      });
      if (lit >= 1) {
        S.bladeT += dt;
        if (S.bladeT > [99, 5.5, 4.2][lit]) {
          S.bladeT = 0;
          const bl = blades.find((q) => !q.active);
          if (bl) {
            bl.d = Math.random() < 0.5 ? 0 : 1;
            bl.m.material.color.setRGB(bl.d ? 1.4 : 0.4, bl.d ? 0.4 : 1.0, bl.d ? 2.4 : 2.6);
            bl.active = true;
            bl.z = 16;
            bl.m.visible = true;
            ev(b, 'toast', bl.d === 1 ? 'Lâmina do outro lado!' : 'Lâmina do mundo real!', 1.2);
          }
        }
      }
    },
    kills(pl) {
      const p = pl.pos;
      if (S.state === 'rot' && b.dim === S.world && p.y < 0.6 && p.y > -1) return true;
      return blades.some((bl) => bl.active && bl.d === b.dim && Math.abs(p.z - bl.z) < 0.5 && p.y < 2.5);
    },
    reset() {
      Object.assign(S, { state: 'wait', t: 0, bladeT: 0, sink: 0, second: false });
      for (const bl of blades) {
        bl.active = false;
        bl.m.visible = false;
      }
      rot[0].visible = rot[1].visible = false;
      fig.reset();
    },
    // o corpo está no grupo da fase (o construtor libera); o resto, aqui
    dispose() {
      aside.traverse((o) => o.geometry?.dispose());
    },
  });
  b.goalPortal(0, 0, 4);
  b.memory(-12.5, 1.5, 11.5);
  b.hint([-15, -1, 7], [15, 6, 15], 'O Reflexo: a Sombra corre atrás de você e o chão de um mundo apodrece de cada vez. Troque de lado (<kbd>F</kbd>) e acenda as runas dos pilares.');
  b.scenery(0, -10, 140);
  b.motes([-20, -4, -20], [20, 16, 20], 1200, new THREE.Color(1.3, 0.5, 2.2));
  b.killY = -14;
}

// --------------------------------------------------------------- VI. O Eclipse
export function eclipse(b) {
  const LIGHT_R = 5.5;
  // centro e quatro ilhas, cada uma com um braseiro
  b.platform(-5, -5, 5, 5, 0, { bottom: -12 });
  const sats = [[0, 14], [14, 0], [0, -14], [-14, 0]];
  for (const [x, z] of sats) b.platform(x - 3.5, z - 3.5, x + 3.5, z + 3.5, 0, { bottom: -12 });
  b.startAt(0, 0, 15.5);
  b.checkpoint(0, 0, 16.2, -2.4, 16.6);
  const lamps = [[0, 0], ...sats].map(([x, z]) => {
    const br = b.brazier(x + 1.2, 0, z + 1.2);
    br.active = true;
    return { br, x: x + 1.2, z: z + 1.2, off: 0, warn: 0 };
  });
  // runas no escuro, em plataformas pequenas fora da luz
  const runeSpots = [[-12.5, -9.5], [12.5, -9.5], [0, -22.5]];
  for (const [x, z] of runeSpots) b.platform(x - 1.6, z - 1.6, x + 1.6, z + 1.6, 0, { bottom: -8 });
  // a runa acesa vira uma luz
  const runeLights = runeSpots.map(([x, z]) => {
    const l = new PoolLight(0xffd890, 0, 9, 2);
    l.position.set(x, 2.2, z);
    b.group.add(l);
    return l;
  });
  // o sol negro
  const sun = new THREE.Group();
  sun.position.set(0, 36, -70);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(9, 24, 18), glow(b, 0, 0, 0, { fog: false }));
  const coronaMat = soft(b, 1.5, 0.95, 0.35, 0.3);
  coronaMat.fog = false;
  const corona = new THREE.Mesh(new THREE.TorusGeometry(10.5, 1.4, 8, 64), coronaMat);
  const haloMat = soft(b, 0.9, 0.5, 0.2, 0.06);
  haloMat.fog = false;
  const halo = new THREE.Mesh(new THREE.RingGeometry(9.2, 17, 64), haloMat);
  sun.add(disc, corona, halo);
  b.group.add(dyn(sun));
  // feixe escuro que apaga um braseiro
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 40, 16, 1, true), soft(b, 0.5, 0.1, 0.9, 0));
  beam.visible = false;
  b.group.add(dyn(beam));
  const orbs = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), glow(b, 0.02, 0, 0.05));
    m.add(new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.08, 6, 24), glow(b, 1.6, 0.4, 2.4)));
    return new Drop(b, m, { radius: 2.0, tele: 1.2, height: 14, color: [1.4, 0.3, 2.4] });
  });
  const S = { t: 0, target: null, orbT: 0, told: false };
  b.bossFight({
    name: 'O Eclipse',
    runes: runeSpots.map(([x, z]) => [x, 1.3, z]),
    dark: 0,
    gloom: 0,
    tick(dt, time) {
      for (const d of orbs) d.update(dt);
      corona.rotation.z += dt * 0.2;
      // braseiros: apagados voltam sozinhos
      for (const l of lamps) {
        if (l.off > 0) {
          l.off -= dt;
          l.br.active = false;
          if (l.off <= 0) {
            l.br.active = true;
            ev(b, 'sfx', 'relight');
          }
        } else if (l.warn > 0) {
          l.br.active = Math.sin(time * 30) > 0; // tremula antes de apagar
        } else {
          l.br.active = true;
        }
      }
      runeLights.forEach((l, i) => {
        l.intensity = this.runes[i].lit ? 16 : 0;
      });
      const pl = b.playerRef;
      if (this.defeated) {
        this.dark = Math.max(0, this.dark - dt);
        this.gloom = this.dark;
        sun.position.y += dt * 4;
        beam.visible = false;
        return;
      }
      corona.material.opacity = 0.26 + 0.06 * Math.sin(time * 2);
      if (!pl) return;
      const lit = Math.min(this.lit, 2);
      // escuridão: fora da luz ela sobe; perto de uma luz, desce
      const p = pl.pos;
      let inLight = false;
      for (const l of lamps) if (l.off <= 0 && Math.hypot(p.x - l.x, p.z - l.z) < LIGHT_R && p.y > -2) inLight = true;
      runeSpots.forEach(([x, z], i) => {
        if (this.runes[i].lit && Math.hypot(p.x - x, p.z - z) < LIGHT_R) inLight = true;
      });
      this.dark = inLight ? Math.max(0, this.dark - dt * 0.8) : this.dark + dt / [2.5, 2.2, 1.9][lit];
      this.gloom = Math.min(1, this.dark);
      if (!inLight && !S.told) {
        S.told = true;
        ev(b, 'toast', 'Fique perto da luz: a escuridão consome!', 2.2);
      }
      // o Eclipse escolhe o braseiro mais perto do andarilho
      S.t += dt;
      if (!S.target && S.t > [4.6, 3.8, 3.1][lit]) {
        const litLamps = lamps.filter((l) => l.off <= 0 && l.warn <= 0);
        if (litLamps.length > 2) {
          S.target = litLamps.reduce((a, q) => (Math.hypot(q.x - p.x, q.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? q : a));
          S.target.warn = 1.4 * [1, 0.9, 0.8][lit];
          beam.visible = true;
          ev(b, 'sfx', 'alert', 'suspicious');
        }
        S.t = 0;
      }
      if (S.target) {
        const l = S.target;
        l.warn -= dt;
        beam.position.set(l.x, 20 + l.warn * 6, l.z);
        beam.material.opacity = 0.4 + 0.3 * Math.sin(time * 18);
        if (l.warn <= 0) {
          l.warn = 0;
          l.off = 7;
          S.target = null;
          beam.visible = false;
          ev(b, 'sfx', 'extinguish');
          ev(b, 'shake', 0.25);
        }
      }
      if (lit >= 1) {
        S.orbT += dt;
        if (S.orbT > [99, 3.6, 2.8][lit]) {
          S.orbT = 0;
          const d = orbs.find((q) => !q.busy);
          if (d) d.start(p.x + pl.vel.x * 0.6, 0, p.z + pl.vel.z * 0.6);
        }
      }
    },
    kills(pl) {
      return orbs.some((d) => d.kills(pl));
    },
    onRespawn() {
      this.dark = 0;
    },
    reset() {
      this.dark = 0;
      this.gloom = 0;
      for (const d of orbs) d.reset();
      for (const l of lamps) {
        l.off = 0;
        l.warn = 0;
        l.br.active = true;
      }
      Object.assign(S, { t: 0, target: null, orbT: 0 });
      beam.visible = false;
      sun.position.set(0, 36, -70);
    },
    onHit() {
      corona.material.opacity = 1;
      ev(b, 'flash', 0.5);
    },
  });
  b.goalPortal(0, 0, -2);
  b.memory(14, 2.0, -3.5);
  b.hint([-4, -1, 11], [4, 6, 18], 'O Eclipse: <b>longe da luz</b> a escuridão consome você. Corra até as runas no escuro — cada runa acesa vira uma luz.');
  b.scenery(0, -10, 140);
  b.motes([-20, -6, -26], [20, 14, 20], 900, new THREE.Color(1.2, 0.6, 2.0));
  b.killY = -14;
}

// --------------------------------------------------------------- VII. A Traça
export function traca(b) {
  const M = b.M;
  const RIGHT = [3.2, 3.8];
  const LEFT = [-3.8, -3.2];
  const walls = [];
  // muro que a Traça pode comer (fica fora da malha estática)
  const wall = ([x0, x1], zFar, zNear, h = 10) => {
    const m = b.runWall(x0, -6, zFar, x1, h, zNear);
    m.userData.dynamic = true;
    walls.push({ m, c: m.userData.collider, gone: 0, warn: 0, touched: false });
  };
  b.platform(-3, -12, 3, 6, 0);
  b.startAt(0, 0, 3);
  // trecho 1
  wall(RIGHT, -34, -10);
  wall(LEFT, -50, -28);
  b.platform(-3, -74, 3, -48, 0);
  // poleiros do lado oposto ao próximo muro (não fecham o caminho)
  b.block(0.6, 0, -70, 2.6, 3.2, -68, M.wall);
  b.block(0.6, 0, -67, 2.6, 1.6, -65.6, M.wallDark);
  b.checkpoint(0, 0, -56, 2.2, -54);
  // trecho 2
  wall(LEFT, -96, -72);
  wall(RIGHT, -112, -90);
  wall(LEFT, -128, -106);
  b.platform(-3, -152, 3, -126, 0);
  b.block(-2.6, 0, -148, -0.6, 3.2, -146, M.wall);
  b.block(-2.6, 0, -145, -0.6, 1.6, -143.6, M.wallDark);
  b.checkpoint(0, 0, -134, -2.2, -132);
  // trecho 3: o sprint
  wall(RIGHT, -174, -150);
  wall(LEFT, -190, -168);
  wall(RIGHT, -206, -184);
  wall(LEFT, -222, -200);
  b.platform(-4, -256, 4, -220, 0);
  b.block(-1, 0, -246, 1, 3.2, -244, M.wall);
  b.block(-1, 0, -243, 1, 1.6, -241.6, M.wallDark);
  const perches = [[1.6, 4.5, -69], [-1.6, 4.5, -147], [0, 4.5, -245]];
  // a Traça
  const moth = new THREE.Group();
  const dust = b.ownMat(new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: 1, emissive: new THREE.Color(0.25, 0.18, 0.08), side: THREE.DoubleSide }));
  const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, 3.4, 6, 10), dust);
  bodyM.rotation.x = Math.PI / 2;
  const eyeMat = glow(b, 3.2, 2.2, 0.6);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), eyeMat);
    e.position.set(s * 0.55, 0.3, 2.2);
    return e;
  });
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.bezierCurveTo(2.5, 2.8, 7, 3.2, 8, 0.5);
  wingShape.bezierCurveTo(7.2, -2.4, 3, -3.4, 0, -0.6);
  const wingGeo = new THREE.ShapeGeometry(wingShape, 10);
  const spotMat = glow(b, 2.4, 1.3, 0.4, { side: THREE.DoubleSide });
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    const w = new THREE.Mesh(wingGeo, dust);
    w.rotation.x = -Math.PI / 2;
    w.scale.x = s;
    pivot.add(w);
    // olhos nas asas
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.9, 16), spotMat);
    spot.rotation.x = -Math.PI / 2;
    spot.position.set(s * 4.5, 0.02, -0.4);
    pivot.add(spot);
    return pivot;
  });
  moth.add(bodyM, ...eyes, ...wings);
  b.group.add(dyn(moth));
  const dustDrops = [0, 1].map(() => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), glow(b, 1.6, 1.2, 0.5));
    return new Drop(b, m, { radius: 1.8, tele: 1.1, height: 12, color: [2.2, 1.4, 0.4] });
  });
  const goneMat = soft(b, 1.4, 0.8, 0.3, 0.12);
  const S = { eatT: 0, dropT: 0, told: false, pos: new THREE.Vector3(0, 10, -60), tgt: new THREE.Vector3() };
  const setGone = (w, on) => {
    w.c.enabled = !on;
    w.m.material = on ? goneMat : M.runWall;
  };
  const restoreWalls = () => {
    for (const w of walls) {
      w.gone = 0;
      w.warn = 0;
      w.touched = false;
      w.m.visible = true;
      setGone(w, false);
    }
  };
  b.bossFight({
    name: 'A Traça',
    runes: perches,
    tick(dt, time) {
      for (const d of dustDrops) d.update(dt);
      // voo: paira sobre o próximo poleiro
      const k = Math.min(this.lit, 2);
      if (this.defeated) S.tgt.set(0, -40, -280);
      else S.tgt.set(perches[k][0], perches[k][1] + 4 + Math.sin(time * 1.7) * 0.6, perches[k][2] - 2);
      S.pos.lerp(S.tgt, 1 - Math.exp(-dt * (this.defeated ? 0.8 : 1.6)));
      moth.position.copy(S.pos);
      const flap = Math.sin(time * 9) * 0.55;
      wings[0].rotation.z = flap;
      wings[1].rotation.z = -flap;
      const pl = b.playerRef;
      if (pl) moth.rotation.y = Math.atan2(pl.pos.x - S.pos.x, pl.pos.z - S.pos.z);
      for (const w of walls) {
        if (w.gone > 0) {
          w.gone -= dt;
          if (w.gone <= 0) setGone(w, false);
        } else if (w.warn > 0) {
          w.warn -= dt;
          w.m.visible = Math.sin(time * 26) > -0.3;
          if (w.warn <= 0) {
            w.m.visible = true;
            setGone(w, true);
            w.gone = [4.2, 3.8, 3.4][k];
            ev(b, 'sfx', 'chomp');
          }
        }
      }
      if (this.defeated || !pl) return;
      const p = pl.pos;
      // o muro que você usou se desfaz logo depois
      for (const w of walls) {
        if (pl.state === 'wallrun' && pl.runCol === w.c) w.touched = true;
        else if (w.touched && w.gone <= 0 && w.warn <= 0) {
          w.touched = false;
          w.warn = 0.6;
        }
      }
      // a Traça marca um muro à frente
      S.eatT += dt;
      if (S.eatT > [3.6, 3.0, 2.5][k]) {
        const ahead = walls.filter((w) => w.gone <= 0 && w.warn <= 0 && w.c.maxZ < p.z - 14 && w.c.maxZ > p.z - 36);
        if (ahead.length) {
          ahead.sort((a, q) => q.c.maxZ - a.c.maxZ);
          ahead[0].warn = 1.6;
          ev(b, 'sfx', 'alert', 'suspicious');
          if (!S.told) {
            S.told = true;
            ev(b, 'toast', 'A Traça vai comer aquele muro — espere ele voltar!', 2.4);
          }
        }
        S.eatT = 0;
      }
      // pó nas plataformas
      if (pl.grounded && !pl.groundCol?.runnable) {
        S.dropT += dt;
        if (S.dropT > [3.4, 2.7, 2.1][k]) {
          S.dropT = 0;
          const d = dustDrops.find((q) => !q.busy);
          if (d) d.start(p.x + pl.vel.x * 0.5, p.y, p.z + pl.vel.z * 0.5);
        }
      }
    },
    kills(pl) {
      return dustDrops.some((d) => d.kills(pl));
    },
    reset() {
      for (const d of dustDrops) d.reset();
      restoreWalls();
      Object.assign(S, { eatT: 0, dropT: 0 });
      S.pos.set(0, 10, -60);
    },
    // renascer devolve todos os muros
    onRespawn: restoreWalls,
  });
  b.goalPortal(0, 0, -252);
  b.memory(0, 5.6, -181);
  b.hint([-3, -1, -4], [3, 6, 6], 'A Traça come os muros de Lira. O muro que você usa se desfaz — e o que ela marca some por alguns segundos.');
  b.hint([-3, -1, -74], [3, 6, -60], 'Suba no poleiro e toque a <b>runa</b> sob a Traça.');
  b.scenery(0, -130, 200);
  b.motes([-16, -8, -260], [16, 14, 10], 1400, new THREE.Color(2.0, 1.4, 0.5));
  b.killY = -14;
}
