// O visual do Andarilho: modelo com esqueleto (quadril → tronco → pescoço →
// cabeça, braços e pernas com cotovelos e joelhos), capa e cachecol de tecido
// simulado (Verlet com colisão contra o corpo), acessórios por manto (capuz,
// chifres, coroa, máscara, ombreiras), rastro de luz e todas as animações:
// parado, marcha, corrida, esgueirar, saltos, cambalhotas, rolamento, avanço,
// deslize, gancho, surf, parede, borda e comemoração.
// A física fica em player.js; aqui só se lê o estado do jogador.
import * as THREE from 'three';
import { softTexture } from './materials.js';
import { SKINS } from './skins.js';

const TAU = Math.PI * 2;
const BODY_PIVOT = 0.9; // centro de massa: cambalhotas e inclinações giram aqui
export const FLIP_TIME = 0.5;
export const ROLL_TIME = 0.42;

function damp(a, b, k, dt) {
  return a + (b - a) * (1 - Math.exp(-k * dt));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

// ===================================================================== tecido
// Malha de pontos (colunas x linhas) presa no topo a pontos do corpo.
// Restrições estruturais, de cisalhamento e de dobra; arrasto do ar
// proporcional à velocidade (é isso que faz a capa voar para trás ao correr);
// colisão contra esferas e cápsulas do corpo.
class Cloth {
  constructor(scene, mat, { cols, rows, length, widthTop, widthBottom, pins, drag = 3, gravity = 12, flutter = 1, shadow = true }) {
    this.cols = cols;
    this.rows = rows;
    this.pins = pins; // [{ obj, local }] por coluna
    this.drag = drag;
    this.gravity = gravity;
    this.flutter = flutter;
    const n = cols * (rows + 1);
    this.n = n;
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3);
    this.pinNow = pins.map(() => new THREE.Vector3());
    this.pinPrev = pins.map(() => new THREE.Vector3());
    this.setShape(length, widthTop, widthBottom);

    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    const uv = new Float32Array(n * 2);
    const index = [];
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        uv[i * 2] = c / (cols - 1);
        uv[i * 2 + 1] = 1 - r / rows;
        if (r < rows && c < cols - 1) {
          const a = i;
          const b = i + 1;
          const d = i + cols;
          const e = d + 1;
          index.push(a, d, b, b, d, e);
        }
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    scene.add(this.mesh);
    this.needsReset = true;
  }

  // Comprimento e larguras (no topo e na barra); recria as restrições.
  setShape(length, widthTop, widthBottom) {
    const { cols, rows } = this;
    const seg = length / rows;
    this.seg = seg;
    const C = [];
    const id = (c, r) => r * cols + c;
    const w = (r) => lerp(widthTop, widthBottom, r / rows) / (cols - 1);
    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c < cols - 1) C.push(id(c, r), id(c + 1, r), w(r), 1);
        if (r < rows) C.push(id(c, r), id(c, r + 1), seg, 1);
        if (r < rows && c < cols - 1) {
          const h = (w(r) + w(r + 1)) / 2;
          const d = Math.hypot(h, seg);
          C.push(id(c, r), id(c + 1, r + 1), d, 0.6);
          C.push(id(c + 1, r), id(c, r + 1), d, 0.6);
        }
        if (r < rows - 1) C.push(id(c, r), id(c, r + 2), seg * 2, 0.35);
      }
    }
    this.cons = new Float32Array(C);
    this.needsReset = true;
  }

  readPins(out) {
    for (let c = 0; c < this.cols; c++) {
      const pin = this.pins[c];
      out[c].copy(pin.local);
      pin.obj.localToWorld(out[c]);
    }
  }

  reset(back) {
    this.readPins(this.pinNow);
    for (let c = 0; c < this.cols; c++) this.pinPrev[c].copy(this.pinNow[c]);
    for (let r = 0; r <= this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = (r * this.cols + c) * 3;
        const a = this.pinNow[c];
        this.p[i] = a.x - back.x * 0.05 * r;
        this.p[i + 1] = a.y - this.seg * r;
        this.p[i + 2] = a.z - back.z * 0.05 * r;
        this.q[i] = this.p[i];
        this.q[i + 1] = this.p[i + 1];
        this.q[i + 2] = this.p[i + 2];
      }
    }
    this.needsReset = false;
  }

  // colliders: { spheres: [[x,y,z,r]], capsules: [[ax,ay,az,bx,by,bz,r]] }
  update(dt, colliders, floorY, wind, time, speedK, side, fwd) {
    if (this.needsReset) this.reset(fwd);
    const P = this.p;
    const Q = this.q;
    const cols = this.cols;
    for (let c = 0; c < cols; c++) this.pinPrev[c].copy(this.pinNow[c]);
    this.readPins(this.pinNow);
    const steps = Math.max(2, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    const keep = Math.exp(-this.drag * h);
    const h2 = h * h;
    const wx = wind ? wind.x * 0.5 : 0;
    const wy = wind ? wind.y * 0.3 : 0;
    const wz = wind ? wind.z * 0.5 : 0;
    const cons = this.cons;
    for (let s = 0; s < steps; s++) {
      // o topo acompanha o corpo suavemente (sem trancos no avanço rápido)
      const k = (s + 1) / steps;
      for (let c = 0; c < cols; c++) {
        const a = this.pinPrev[c];
        const b = this.pinNow[c];
        const i = c * 3;
        P[i] = a.x + (b.x - a.x) * k;
        P[i + 1] = a.y + (b.y - a.y) * k;
        P[i + 2] = a.z + (b.z - a.z) * k;
        Q[i] = P[i];
        Q[i + 1] = P[i + 1];
        Q[i + 2] = P[i + 2];
      }
      const tt = time + s * h;
      for (let i = cols; i < this.n; i++) {
        const j = i * 3;
        const r = Math.floor(i / cols);
        const vx = (P[j] - Q[j]) * keep;
        const vy = (P[j + 1] - Q[j + 1]) * keep;
        const vz = (P[j + 2] - Q[j + 2]) * keep;
        Q[j] = P[j];
        Q[j + 1] = P[j + 1];
        Q[j + 2] = P[j + 2];
        // tremulação: mais forte na barra e com velocidade
        const fl = Math.sin(tt * 17 + r * 1.3 + (i % cols) * 2.1) * this.flutter * (2 + speedK * 16) * (r / this.rows);
        P[j] += vx + (wx + side.x * fl) * h2;
        P[j + 1] += vy + (wy - this.gravity + fl * 0.4) * h2;
        P[j + 2] += vz + (wz + side.z * fl) * h2;
      }
      for (let it = 0; it < 4; it++) {
        for (let m = 0; m < cons.length; m += 4) {
          const a = cons[m];
          const b = cons[m + 1];
          const ia = a * 3;
          const ib = b * 3;
          const dx = P[ib] - P[ia];
          const dy = P[ib + 1] - P[ia + 1];
          const dz = P[ib + 2] - P[ia + 2];
          const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
          const diff = ((L - cons[m + 2]) / L) * cons[m + 3];
          const pa = a < cols;
          const pb = b < cols;
          if (pa && pb) continue;
          const wa = pa ? 0 : pb ? 1 : 0.5;
          const wb = pb ? 0 : pa ? 1 : 0.5;
          P[ia] += dx * diff * wa;
          P[ia + 1] += dy * diff * wa;
          P[ia + 2] += dz * diff * wa;
          P[ib] -= dx * diff * wb;
          P[ib + 1] -= dy * diff * wb;
          P[ib + 2] -= dz * diff * wb;
        }
        this.collide(colliders, floorY);
      }
    }
    const pos = this.geo.attributes.position.array;
    pos.set(P);
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
  }

  collide({ spheres, capsules }, floorY) {
    const P = this.p;
    for (let i = this.cols; i < this.n; i++) {
      const j = i * 3;
      let x = P[j];
      let y = P[j + 1];
      let z = P[j + 2];
      for (const s of spheres) {
        const dx = x - s[0];
        const dy = y - s[1];
        const dz = z - s[2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < s[3] * s[3] && d2 > 1e-8) {
          const k = s[3] / Math.sqrt(d2);
          x = s[0] + dx * k;
          y = s[1] + dy * k;
          z = s[2] + dz * k;
        }
      }
      for (const c of capsules) {
        const abx = c[3] - c[0];
        const aby = c[4] - c[1];
        const abz = c[5] - c[2];
        const ab2 = abx * abx + aby * aby + abz * abz || 1e-6;
        let t = ((x - c[0]) * abx + (y - c[1]) * aby + (z - c[2]) * abz) / ab2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const cx = c[0] + abx * t;
        const cy = c[1] + aby * t;
        const cz = c[2] + abz * t;
        const dx = x - cx;
        const dy = y - cy;
        const dz = z - cz;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < c[6] * c[6] && d2 > 1e-8) {
          const k = c[6] / Math.sqrt(d2);
          x = cx + dx * k;
          y = cy + dy * k;
          z = cz + dz * k;
        }
      }
      if (y < floorY + 0.03) y = floorY + 0.03;
      P[j] = x;
      P[j + 1] = y;
      P[j + 2] = z;
    }
  }

  // ponto central da barra (para o rastro de luz)
  hemCenter(out) {
    const r = this.rows;
    const c = Math.floor(this.cols / 2);
    const j = (r * this.cols + c) * 3;
    return out.set(this.p[j], this.p[j + 1], this.p[j + 2]);
  }
}

// ===================================================================== texturas
// Estampas da capa: mapa de cor (claro = cor do manto) e de brilho (runas).
const patternCache = new Map();

function capePattern(pattern) {
  if (patternCache.has(pattern)) return patternCache.get(pattern);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const make = (glow) => {
    seed = 7;
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = glow ? '#000' : '#fff';
    x.fillRect(0, 0, 128, 256);
    if (!glow) {
      // trama do tecido
      for (let i = 0; i < 700; i++) {
        x.fillStyle = `rgba(0,0,0,${rnd() * 0.07})`;
        x.fillRect(rnd() * 128, rnd() * 256, 1 + rnd() * 2, 4 + rnd() * 12);
      }
      // escurece perto da barra (desgaste)
      const g = x.createLinearGradient(0, 180, 0, 256);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.25)');
      x.fillStyle = g;
      x.fillRect(0, 180, 128, 76);
    }
    const ink = glow ? '#fff' : '#b8b8b8';
    x.strokeStyle = ink;
    x.fillStyle = ink;
    x.lineWidth = 2.5;
    if (pattern === 'runas') {
      x.fillRect(0, 222, 128, 3);
      x.fillRect(0, 248, 128, 3);
      for (let i = 0; i < 6; i++) {
        const cx = 11 + i * 21;
        x.beginPath();
        x.moveTo(cx, 228);
        x.lineTo(cx + 6, 236);
        x.lineTo(cx, 244);
        x.lineTo(cx - 6, 236);
        x.closePath();
        x.stroke();
      }
      x.beginPath();
      x.moveTo(64, 70);
      x.lineTo(80, 112);
      x.lineTo(64, 154);
      x.lineTo(48, 112);
      x.closePath();
      x.moveTo(64, 88);
      x.lineTo(64, 136);
      x.moveTo(52, 112);
      x.lineTo(76, 112);
      x.stroke();
    } else if (pattern === 'estrelas') {
      for (let i = 0; i < 70; i++) {
        const px = rnd() * 128;
        const py = rnd() * 256;
        const s = rnd() < 0.15 ? 5 : 1.4;
        if (s > 2) {
          x.beginPath();
          x.moveTo(px, py - s);
          x.lineTo(px + 1, py - 1);
          x.lineTo(px + s, py);
          x.lineTo(px + 1, py + 1);
          x.lineTo(px, py + s);
          x.lineTo(px - 1, py + 1);
          x.lineTo(px - s, py);
          x.lineTo(px - 1, py - 1);
          x.fill();
        } else {
          x.fillRect(px, py, s, s);
        }
      }
      x.fillRect(0, 250, 128, 2);
    } else if (pattern === 'chamas') {
      for (let i = 0; i < 9; i++) {
        const cx = i * 15 + rnd() * 6;
        const top = 120 + rnd() * 70;
        const g = x.createLinearGradient(0, top, 0, 256);
        g.addColorStop(0, glow ? 'rgba(255,255,255,0)' : 'rgba(150,150,150,0)');
        g.addColorStop(1, glow ? 'rgba(255,255,255,1)' : 'rgba(160,160,160,0.9)');
        x.fillStyle = g;
        x.beginPath();
        x.moveTo(cx - 9, 256);
        x.quadraticCurveTo(cx - 10, top + 40, cx, top);
        x.quadraticCurveTo(cx + 9, top + 40, cx + 9, 256);
        x.fill();
      }
    } else if (pattern === 'penas') {
      for (let r = 0; r < 12; r++) {
        for (let i = 0; i < 6; i++) {
          const cx = i * 24 + (r % 2) * 12;
          const cy = 30 + r * 19;
          x.beginPath();
          x.ellipse(cx, cy, 11, 17, 0, 0, Math.PI);
          x.stroke();
          if (glow && r > 8) {
            x.beginPath();
            x.moveTo(cx, cy);
            x.lineTo(cx, cy + 14);
            x.stroke();
          }
        }
      }
    } else if (pattern === 'listras') {
      for (const sx of [22, 42, 86, 106]) x.fillRect(sx, 0, 4, 256);
      x.fillRect(0, 238, 128, 5);
    } else {
      x.fillRect(0, 250, 128, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = glow ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    return t;
  };
  const tex = { map: make(false), glow: make(true) };
  patternCache.set(pattern, tex);
  return tex;
}

// ===================================================================== modelo
export class Character {
  // opts.ghost = { body, accent, eye }: troca todos os materiais (fantasma,
  // Sombra); opts.light = false tira a luz própria.
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.opts = opts;
    this.time = 0;
    this.airTime = 0;
    this.idleTime = 0;
    this.lastFacing = 0;
    this.turnRate = 0;
    this.flip = 0;
    this.flipKind = 'front';
    this.v = new THREE.Vector3();
    this.v2 = new THREE.Vector3();
    this.fwd = new THREE.Vector3();
    this.side = new THREE.Vector3();
    this.colliders = { spheres: [], capsules: [] };
    this.build(scene);
    this.setSkin(SKINS[0]);
    if (opts.ghost) this.applyGhost(opts.ghost);
  }

  build(scene) {
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x262b3a, roughness: 0.85, flatShading: true, side: THREE.DoubleSide,
      emissive: new THREE.Color(0.2, 0.5, 1.4), emissiveIntensity: 0,
    });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.7, flatShading: true });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a90a0, roughness: 0.35, metalness: 0.8, flatShading: true });
    const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.8, 2.4) });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x010103 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.8, 4.2) });
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x262b3a, roughness: 0.9, side: THREE.DoubleSide,
      emissive: new THREE.Color(0.3, 0.8, 2.4), emissiveIntensity: 0.6,
    });
    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0x262b3a, roughness: 0.8, side: THREE.DoubleSide, flatShading: true,
      emissive: new THREE.Color(0.3, 0.8, 2.4), emissiveIntensity: 0.25,
    });
    Object.assign(this, { cloakMat, innerMat, leatherMat, metalMat, trimMat, voidMat, eyeMat, capeMat, scarfMat });

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    const mesh = (geo, mat, x, y, z, parent, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      parent.add(m);
      return m;
    };

    // ---------------------------------------------------------- quadril
    const hips = new THREE.Group();
    hips.position.y = 0.95;
    body.add(hips);
    // saia do casaco (aberta na frente para as pernas)
    const skirtProf = [[0.43, 0.34], [0.37, 0.55], [0.3, 0.78], [0.26, 0.98], [0.255, 1.06]].map(([r, y]) => new THREE.Vector2(r, y - 0.95));
    const skirtGeo = new THREE.LatheGeometry(skirtProf, 16);
    const sp = skirtGeo.attributes.position;
    for (let i = 0; i < sp.count; i++) {
      if (sp.getY(i) < -0.5) {
        const a = Math.atan2(sp.getZ(i), sp.getX(i));
        sp.setY(i, sp.getY(i) - (Math.sin(a * 6) * 0.5 + 0.5) * 0.07);
        if (Math.sin(a) > 0.55) sp.setY(i, sp.getY(i) + 0.24);
      }
    }
    skirtGeo.computeVertexNormals();
    this.skirt = mesh(skirtGeo, cloakMat, 0, 0, 0, hips);
    const belt = mesh(new THREE.TorusGeometry(0.262, 0.036, 6, 22), leatherMat, 0, 0.07, 0, hips);
    belt.rotation.x = Math.PI / 2;
    const buckle = mesh(new THREE.OctahedronGeometry(0.05), trimMat, 0, 0.07, 0.275, hips, false);
    buckle.scale.set(1, 1.3, 0.5);
    // bolsinha no cinto
    mesh(new THREE.BoxGeometry(0.1, 0.12, 0.06), leatherMat, -0.2, 0.0, 0.17, hips).rotation.y = -0.6;
    const strip = mesh(new THREE.BoxGeometry(0.035, 0.4, 0.01), trimMat, 0, -0.2, 0.33, hips, false);
    strip.rotation.x = -0.18;

    // pernas: coxa → joelho → canela + bota
    const thighGeo = new THREE.CapsuleGeometry(0.08, 0.24, 3, 8);
    thighGeo.translate(0, -0.18, 0);
    const shinGeo = new THREE.CapsuleGeometry(0.068, 0.22, 3, 8);
    shinGeo.translate(0, -0.16, 0);
    const bootGeo = new THREE.BoxGeometry(0.15, 0.13, 0.28);
    bootGeo.translate(0, -0.32, 0.05);
    const toeGeo = new THREE.BoxGeometry(0.13, 0.08, 0.08);
    toeGeo.translate(0, -0.345, 0.2);
    const wrapGeo = new THREE.CylinderGeometry(0.076, 0.082, 0.12, 8);
    wrapGeo.translate(0, -0.22, 0);
    const legs = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(sx * 0.11, -0.23, 0);
      const knee = new THREE.Group();
      knee.position.y = -0.36;
      leg.add(knee);
      mesh(thighGeo, innerMat, 0, 0, 0, leg);
      mesh(shinGeo, innerMat, 0, 0, 0, knee);
      mesh(wrapGeo, leatherMat, 0, 0, 0, knee);
      mesh(bootGeo, leatherMat, 0, 0, 0, knee);
      mesh(toeGeo, leatherMat, 0, 0, 0, knee);
      hips.add(leg);
      legs.push({ leg, knee });
    }
    [this.legL, this.legR] = legs.map((l) => l.leg);
    [this.kneeL, this.kneeR] = legs.map((l) => l.knee);

    // ---------------------------------------------------------- tronco
    const spine = new THREE.Group();
    spine.position.y = 0.08;
    hips.add(spine);
    const torsoProf = [[0.255, 1.0], [0.27, 1.2], [0.27, 1.32], [0.22, 1.44], [0.12, 1.5]].map(([r, y]) => new THREE.Vector2(r, y - 1.03));
    mesh(new THREE.LatheGeometry(torsoProf, 16), cloakMat, 0, 0, 0, spine);
    // gola cruzada na frente
    const lapel = mesh(new THREE.BoxGeometry(0.05, 0.36, 0.02), innerMat, 0.05, 0.25, 0.25, spine);
    lapel.rotation.set(-0.12, 0, 0.35);
    const lapel2 = mesh(new THREE.BoxGeometry(0.05, 0.36, 0.02), innerMat, -0.05, 0.25, 0.25, spine);
    lapel2.rotation.set(-0.12, 0, -0.35);
    const mantle = mesh(new THREE.ConeGeometry(0.38, 0.34, 12, 1, true), cloakMat, 0, 0.39, 0, spine);
    mantle.rotation.y = 0.2;
    // ombreiras (uma ou duas, conforme o manto)
    this.pauldrons = [-1, 1].map((sx) => {
      const g = new THREE.Group();
      g.position.set(sx * 0.28, 0.4, 0);
      const shell = mesh(new THREE.SphereGeometry(0.135, 10, 6, 0, TAU, 0, Math.PI / 2), leatherMat, 0, 0, 0, g);
      shell.scale.set(1.1, 0.85, 1.15);
      const plate = mesh(new THREE.SphereGeometry(0.12, 10, 5, 0, TAU, 0, Math.PI / 2.4), metalMat, 0, 0.04, 0, g);
      plate.scale.set(1.15, 0.7, 1.2);
      const stud = mesh(new THREE.OctahedronGeometry(0.03), trimMat, sx * 0.04, 0.1, 0.06, g, false);
      stud.scale.y = 1.5;
      g.userData.plate = plate;
      spine.add(g);
      return g;
    });

    // ---------------------------------------------------------- cabeça
    const neck = new THREE.Group();
    neck.position.y = 0.45;
    spine.add(neck);
    const head = new THREE.Group();
    neck.add(head);
    const HOOD_GAP = 1.7;
    this.hood = mesh(new THREE.SphereGeometry(0.25, 18, 12, Math.PI / 2 + HOOD_GAP / 2, TAU - HOOD_GAP), cloakMat, 0, 0.14, -0.02, head);
    this.hood.scale.set(1, 1.1, 1.1);
    // borda do capuz
    const rim = mesh(new THREE.TorusGeometry(0.2, 0.025, 5, 16, Math.PI * 1.2), innerMat, 0, 0.15, 0.12, head);
    rim.rotation.set(-0.25, 0, -0.1 * Math.PI); // arco sobre o rosto
    this.tip = mesh(new THREE.ConeGeometry(0.15, 0.44, 8), cloakMat, 0, 0.3, -0.2, head);
    this.tip.rotation.x = -1.15;
    const face = mesh(new THREE.SphereGeometry(0.19, 12, 9), voidMat, 0, 0.12, 0.03, head, false);
    face.scale.set(1, 1.12, 0.85);
    const eyeGeo = new THREE.SphereGeometry(0.026, 8, 6);
    this.eyes = [-1, 1].map((sx) => {
      const e = mesh(eyeGeo, eyeMat, sx * 0.062, 0.14, 0.188, head, false);
      e.scale.set(1.5, 0.7, 1);
      return e;
    });
    // acessórios (ligados por manto)
    this.horns = [-1, 1].map((sx) => {
      const g = new THREE.Group();
      g.position.set(sx * 0.15, 0.3, -0.02);
      g.rotation.set(-0.35, 0, sx * -0.7);
      const h1 = mesh(new THREE.ConeGeometry(0.05, 0.22, 7), metalMat, 0, 0.1, 0, g);
      const h2 = mesh(new THREE.ConeGeometry(0.03, 0.16, 6), metalMat, sx * -0.02, 0.24, -0.04, g);
      h2.rotation.x = -0.5;
      h1.castShadow = true;
      head.add(g);
      return g;
    });
    this.crown = new THREE.Group();
    this.crown.position.y = 0.3;
    const crownRing = mesh(new THREE.TorusGeometry(0.2, 0.014, 5, 28), trimMat, 0, 0, 0, this.crown, false);
    crownRing.rotation.x = Math.PI / 2 - 0.25;
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i - 2) * 0.45;
      const sp2 = mesh(new THREE.OctahedronGeometry(0.03), trimMat, Math.cos(a) * 0.2, 0.05 + (i === 2 ? 0.04 : 0), Math.sin(a) * 0.2, this.crown, false);
      sp2.scale.y = i === 2 ? 2.4 : 1.6;
    }
    head.add(this.crown);
    this.mask = new THREE.Group();
    for (const sx of [-1, 1]) {
      const line = mesh(new THREE.BoxGeometry(0.11, 0.012, 0.01), trimMat, sx * 0.05, 0.075, 0.2, this.mask, false);
      line.rotation.z = sx * 0.55;
    }
    mesh(new THREE.BoxGeometry(0.012, 0.07, 0.01), trimMat, 0, 0.21, 0.19, this.mask, false);
    head.add(this.mask);
    // gola do cachecol
    this.collar = mesh(new THREE.TorusGeometry(0.135, 0.055, 8, 18), scarfMat, 0, -0.02, -0.01, neck);
    this.collar.rotation.x = Math.PI / 2 + 0.15;
    this.collar.scale.set(1, 1.05, 0.8);

    // ---------------------------------------------------------- braços
    const upperGeo = new THREE.CapsuleGeometry(0.064, 0.2, 3, 8);
    upperGeo.translate(0, -0.15, 0);
    const foreGeo = new THREE.CapsuleGeometry(0.056, 0.18, 3, 8);
    foreGeo.translate(0, -0.13, 0);
    const bracerGeo = new THREE.CylinderGeometry(0.066, 0.072, 0.15, 8);
    bracerGeo.translate(0, -0.16, 0);
    const handGeo = new THREE.BoxGeometry(0.09, 0.1, 0.06);
    handGeo.translate(0, -0.31, 0.01);
    const thumbGeo = new THREE.BoxGeometry(0.03, 0.06, 0.03);
    thumbGeo.translate(0.04, -0.29, 0.04);
    const arms = [];
    for (const sx of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(sx * 0.3, 0.37, 0);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      arm.add(elbow);
      mesh(upperGeo, cloakMat, 0, 0, 0, arm);
      mesh(foreGeo, innerMat, 0, 0, 0, elbow);
      mesh(bracerGeo, leatherMat, 0, 0, 0, elbow);
      mesh(handGeo, leatherMat, 0, 0, 0, elbow);
      const th = mesh(thumbGeo, leatherMat, 0, 0, 0, elbow);
      th.position.x = sx > 0 ? -0.08 : 0;
      spine.add(arm);
      arms.push({ arm, elbow });
    }
    [this.armL, this.armR] = arms.map((a) => a.arm);
    [this.elbowL, this.elbowR] = arms.map((a) => a.elbow);
    // runa na mão (de onde sai o Gancho do Véu)
    this.handRune = mesh(new THREE.OctahedronGeometry(0.045), trimMat, 0, -0.34, 0.07, this.elbowR, false);
    this.handR = new THREE.Object3D();
    this.handR.position.set(0, -0.32, 0.02);
    this.elbowR.add(this.handR);
    // faixa rúnica no braço
    const armBand = mesh(new THREE.TorusGeometry(0.068, 0.01, 4, 14), trimMat, 0, -0.1, 0, this.elbowL, false);
    armBand.rotation.x = Math.PI / 2;

    // luz de preenchimento própria: o andarilho fica legível em qualquer cenário
    this.fill = new THREE.PointLight(0xbcd2ff, 4.5, 5, 1.6);
    this.fill.position.set(0.8, 2.3, 1.6);
    if (this.opts.light !== false) root.add(this.fill);
    Object.assign(this, { root, body, hips, spine, neck, head });
    for (const n of ['hips', 'spine', 'neck', 'head', 'legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'elbowL', 'elbowR']) this[n].name = n;
    scene.add(root);

    // ---------------------------------------------------------- tecido
    const CAPE_COLS = 5;
    this.capePins = [];
    for (let c = 0; c < CAPE_COLS; c++) {
      const u = c / (CAPE_COLS - 1) * 2 - 1;
      this.capePins.push({ obj: spine, local: new THREE.Vector3(u * 0.22, 0.42 - 0.05 * u * u, -0.24 - 0.06 * (1 - u * u)) });
    }
    this.cape = new Cloth(scene, capeMat, { cols: CAPE_COLS, rows: 11, length: 1.05, widthTop: 0.44, widthBottom: 0.62, pins: this.capePins, drag: 3.2, flutter: 1 });
    this.scarves = [[-0.11, -0.045, 0.52], [0.045, 0.11, 0.64]].map(([x0, x1, len]) => new Cloth(scene, scarfMat, {
      cols: 2, rows: 6, length: len, widthTop: x1 - x0, widthBottom: 0.05,
      pins: [{ obj: neck, local: new THREE.Vector3(x0, -0.04, -0.17) }, { obj: neck, local: new THREE.Vector3(x1, -0.04, -0.17) }],
      drag: 2.4, gravity: 9, flutter: 1.6, shadow: false,
    }));
    this.cloth = [this.cape, ...this.scarves];

    // rastro de luz em alta velocidade
    this.trailN = 24;
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.trailN * 3), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(this.trailN * 3), 3));
    this.trailMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    this.trail = new THREE.Line(tg, this.trailMat);
    this.trail.frustumCulled = false;
    this.trailPts = Array.from({ length: this.trailN }, () => new THREE.Vector3());
    this.trailAlpha = 0;
    scene.add(this.trail);

    // corda do gancho
    const ropeGeo = new THREE.BufferGeometry();
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3 * 9), 3));
    this.ropeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.2), transparent: true, opacity: 0.95 });
    this.rope = new THREE.Line(ropeGeo, this.ropeMat);
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    scene.add(this.rope);

    // sombra circular sob o jogador (ajuda a calcular saltos)
    const blobMat = new THREE.MeshBasicMaterial({
      map: softTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    scene.add(this.blob);
    this.blobMat = blobMat;
    this.trailColor = new THREE.Color();
  }

  // Fantasmas: um material para o corpo, um para os detalhes e um para os olhos.
  applyGhost({ body, accent, eye }) {
    const swap = (o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      o.receiveShadow = false;
      if (o.material === this.eyeMat) o.material = eye;
      else if (o.material === this.trimMat) o.material = accent;
      else o.material = body;
    };
    this.root.traverse(swap);
    for (const c of this.cloth) swap(c.mesh);
    this.blob.visible = false;
    this.trailMat.opacity = 0.5;
  }

  // ------------------------------------------------------------ manto
  setSkin(skin) {
    this.skin = skin;
    this.cloakMat.color.set(skin.cloak);
    this.capeMat.color.set(skin.cape ?? skin.cloak);
    this.scarfMat.color.set(skin.scarf ?? skin.cloak);
    this.innerMat.color.set(skin.inner);
    this.leatherMat.color.set(skin.leather);
    this.metalMat.color.set(skin.metal ?? 0x8a90a0);
    this.trimMat.color.setRGB(...skin.trim);
    this.capeMat.emissive.setRGB(...skin.trim).multiplyScalar(0.5);
    this.scarfMat.emissive.setRGB(...skin.trim).multiplyScalar(0.5);
    this.cloakMat.emissive.setRGB(...skin.trim).multiplyScalar(0.5);
    this.ropeMat.color.setRGB(...skin.trim).multiplyScalar(1.3);
    this.trailColor.setRGB(...skin.trim);
    this.eyeBase = new THREE.Color(...skin.eye);
    this.eyeMat.color.copy(this.eyeBase);
    const tex = capePattern(skin.pattern ?? 'runas');
    this.capeMat.map = tex.map;
    this.capeMat.emissiveMap = tex.glow;
    this.capeMat.needsUpdate = true;
    const hood = skin.hood ?? 'ponta';
    this.tip.visible = hood === 'ponta' || hood === 'chifres';
    for (const h of this.horns) h.visible = hood === 'chifres';
    this.crown.visible = hood === 'coroa';
    this.mask.visible = !!skin.mask;
    const pd = skin.pauldrons ?? 1;
    this.pauldrons[0].visible = pd >= 1;
    this.pauldrons[1].visible = pd >= 2;
    for (const p of this.pauldrons) p.userData.plate.visible = !!skin.armor;
    this.cape.setShape(1.05 * (skin.capeLen ?? 1), 0.44, 0.62 * (skin.capeWidth ?? 1));
  }

  setVisible(v) {
    this.root.visible = v;
    for (const c of this.cloth) c.mesh.visible = v;
    if (!v) {
      this.rope.visible = false;
      this.trail.visible = false;
    }
  }

  reset() {
    for (const c of this.cloth) c.needsReset = true;
    this.body.rotation.set(0, 0, 0);
    this.flip = 0;
    this.airTime = 0;
    this.idleTime = 0;
    this.trailAlpha = 0;
    this.trailInit = false;
  }

  startFlip(kind) {
    this.flip = FLIP_TIME;
    this.flipKind = kind;
  }

  // ------------------------------------------------------------ colisão
  buildColliders() {
    const C = this.colliders;
    C.spheres.length = 0;
    C.capsules.length = 0;
    const w = (obj, x, y, z) => this.v.set(x, y, z).applyMatrix4(obj.matrixWorld).toArray();
    const head = w(this.head, 0, 0.16, 0);
    C.spheres.push([...head, 0.24]);
    // ombros + peito numa esfera só (os pinos da capa ficam fora dela)
    const mantle = w(this.spine, 0, 0.1, 0);
    C.spheres.push([...mantle, 0.39]);
    const skirtA = w(this.hips, 0, -0.18, -0.02);
    C.spheres.push([...skirtA, 0.33]);
    const skirtB = w(this.hips, 0, -0.42, -0.03);
    C.spheres.push([...skirtB, 0.39]);
    for (const [leg, knee] of [[this.legL, this.kneeL], [this.legR, this.kneeR]]) {
      const a = w(leg, 0, 0, 0);
      const b = w(knee, 0, 0, 0);
      const c = w(knee, 0, -0.34, 0.05);
      C.capsules.push([...a, ...b, 0.12], [...b, ...c, 0.11]);
    }
    return C;
  }

  // ------------------------------------------------------------ animação
  // P: o jogador (estado da física). Chamado todo quadro.
  update(dt, P, world) {
    this.time += dt;
    const t = this.time;
    const root = this.root;
    root.position.copy(P.pos);
    root.rotation.y = P.facing;
    const hs = P.horizontalSpeed;
    const k = 16;

    // velocidade de giro (inclinar nas curvas)
    if (dt > 0) {
      const rate = wrapAngle(P.facing - this.lastFacing) / dt;
      this.turnRate = damp(this.turnRate, clamp(rate, -12, 12), 10, dt);
    }
    this.lastFacing = P.facing;
    this.airTime = P.grounded || P.state !== 'normal' ? 0 : this.airTime + dt;
    this.idleTime = P.grounded && hs < 0.3 && P.state === 'normal' && !P.celebrate ? this.idleTime + dt : 0;

    // pose alvo (radianos)
    const s = {
      legL: 0, legR: 0, kneeL: 0.08, kneeR: 0.08, legSpread: 0.03,
      armL: 0.05, armR: 0.05, spreadL: 0.08, spreadR: 0.08, elbowL: -0.2, elbowR: -0.2,
      hipsX: 0, hipsY: 0, hipsZ: 0, spineX: 0, spineY: 0, spineZ: 0,
      headX: 0, headY: 0, lean: 0, bank: 0, twist: 0, bodyY: 0, bodyZ: 0,
    };
    let kPose = k;
    const run = clamp((hs - 1.5) / 8, 0, 1);
    const walk = clamp(hs / 2.5, 0, 1);
    const ph = P.stepPhase;
    const sw = Math.sin(ph);
    const cw = Math.cos(ph);

    if (P.wake > 0) {
      // deitado de costas, levantando aos poucos
      const w = P.wake;
      const mid = Math.sin(Math.min(1, w) * Math.PI);
      s.lean = -1.45 * w;
      s.bodyY = -0.78 * w;
      s.armL = s.armR = -0.3 * w;
      s.spreadL = s.spreadR = 0.9 * w + 0.1;
      s.elbowL = s.elbowR = -0.2 - mid * 1.2;
      s.legL = -0.1 * w - mid * 0.6;
      s.legR = 0.05 * w - mid * 0.3;
      s.kneeL = 0.1 + mid * 1.6;
      s.kneeR = 0.1 + mid * 0.9;
      s.headX = -0.6 * w + Math.sin(t * 0.8) * 0.1 * w;
      s.headY = Math.sin(t * 0.5) * 0.4 * w;
      s.spineX = mid * 0.5;
      kPose = 6;
    } else if (P.celebrate) {
      s.armL = s.armR = -2.75;
      s.spreadL = s.spreadR = 0.45;
      s.elbowL = s.elbowR = -0.25;
      s.bodyY = Math.abs(Math.sin(t * 4)) * 0.12;
      s.kneeL = s.kneeR = 0.2 + Math.abs(Math.sin(t * 4)) * 0.4;
      s.headX = -0.35;
      s.spineX = -0.15;
    } else if (P.state === 'hang') {
      s.armL = s.armR = -2.9;
      s.spreadL = s.spreadR = 0.22;
      s.elbowL = s.elbowR = -0.1;
      s.legL = Math.sin(t * 2) * 0.15 - 0.1;
      s.legR = -Math.sin(t * 2) * 0.15 + 0.05;
      s.kneeL = s.kneeR = 0.35;
      s.headX = -0.4;
      s.lean = -0.06;
    } else if (P.state === 'climb') {
      const c = P.climb.t;
      s.armL = s.armR = c < 0.6 ? -2.7 + c * 2.4 : -0.7;
      s.elbowL = s.elbowR = -0.8;
      s.legL = -1.2 * Math.sin(c * Math.PI);
      s.kneeL = 1.6 * Math.sin(c * Math.PI);
      s.legR = 0.35;
      s.kneeR = 0.5;
      s.lean = 0.45;
      s.headX = -0.3;
    } else if (P.state === 'dash') {
      s.armL = s.armR = 1.25;
      s.spreadL = s.spreadR = 0.3;
      s.elbowL = s.elbowR = -0.1;
      s.legL = 0.55;
      s.legR = -0.35;
      s.kneeL = 1.0;
      s.kneeR = 0.7;
      s.lean = 0.85;
      s.headX = -0.7;
      kPose = 26;
    } else if (P.state === 'slide') {
      s.lean = -1.12;
      s.legL = 0.3;
      s.kneeL = 0.08;
      s.legR = 0.85;
      s.kneeR = 1.6;
      s.armL = 0.55;
      s.spreadL = 0.95;
      s.elbowL = -0.1;
      s.armR = -1.3;
      s.spreadR = 0.4;
      s.elbowR = -0.6;
      s.headX = 0.75;
      s.spineX = 0.25;
      kPose = 22;
    } else if (P.state === 'swing' && P.swing.anchor) {
      // o corpo se alinha com a corda
      const a = P.swing.anchor.pos;
      this.fwd.set(Math.sin(P.facing), 0, Math.cos(P.facing));
      const dx = a.x - P.pos.x;
      const dz = a.z - P.pos.z;
      const along = dx * this.fwd.x + dz * this.fwd.z;
      const dy = a.y - (P.pos.y + 1.25);
      s.lean = clamp(Math.atan2(along, Math.max(0.1, dy)), -1.1, 1.1);
      s.armR = -3.05;
      s.armL = -2.85;
      s.spreadL = s.spreadR = 0.1;
      s.elbowL = -0.15;
      s.elbowR = -0.05;
      const fv = P.vel.x * this.fwd.x + P.vel.z * this.fwd.z;
      s.legL = clamp(-fv * 0.03, -0.7, 0.5) + 0.15;
      s.legR = s.legL + 0.35;
      s.kneeL = 0.45;
      s.kneeR = 0.95;
      s.headX = -0.2;
      kPose = 12;
    } else if (P.surfing) {
      // surf: de lado, joelhos dobrados, braços abertos, inclinado na rampa
      const n = P.surfNormal;
      const right = this.side.set(Math.cos(P.facing), 0, -Math.sin(P.facing));
      const sideSign = Math.sign(n.x * right.x + n.z * right.z) || 1;
      s.twist = -sideSign * 1.05;
      s.headY = sideSign * 0.9;
      s.bank = sideSign * 0.45;
      s.legL = -0.45;
      s.kneeL = 1.1;
      s.legR = 0.5;
      s.kneeR = 1.2;
      s.legSpread = 0.18;
      s.bodyY = -0.18;
      s.armL = -0.4;
      s.armR = 0.3;
      s.spreadL = s.spreadR = 1.3;
      s.elbowL = s.elbowR = -0.3;
      s.spineX = 0.25;
      kPose = 10;
    } else if (P.wallSliding) {
      s.armL = -1.9;
      s.spreadL = 0.9;
      s.armR = -0.6;
      s.spreadR = 0.6;
      s.legL = -0.6;
      s.kneeL = 1.0;
      s.legR = 0.15;
      s.kneeR = 0.4;
      s.lean = -0.15;
      s.headX = 0.2;
    } else if (!P.grounded) {
      const rising = P.vel.y > 0;
      if (rising) {
        s.legL = -1.0;
        s.kneeL = 1.5;
        s.legR = 0.35;
        s.kneeR = 0.7;
        s.armL = -0.5;
        s.armR = -1.7;
        s.spreadL = 0.5;
        s.spreadR = 0.3;
        s.elbowL = s.elbowR = -0.5;
        s.headX = -0.15;
      } else if (this.airTime > 0.9 && P.vel.y < -12) {
        // queda longa: braços se debatem
        s.armL = -1.6 + Math.sin(t * 11) * 1.1;
        s.armR = -1.6 + Math.sin(t * 11 + Math.PI) * 1.1;
        s.spreadL = s.spreadR = 1.0;
        s.legL = -0.4 + Math.sin(t * 9) * 0.4;
        s.legR = -0.4 - Math.sin(t * 9) * 0.4;
        s.kneeL = s.kneeR = 0.6;
        s.headX = 0.5;
        kPose = 20;
      } else {
        s.legL = -0.45;
        s.kneeL = 0.55;
        s.legR = 0.25;
        s.kneeR = 0.35;
        s.armL = -0.5;
        s.armR = -0.6;
        s.spreadL = s.spreadR = 0.85;
        s.elbowL = s.elbowR = -0.35;
        s.headX = 0.15;
      }
      s.lean = Math.min(hs / 9.5, 1.6) * 0.18;
      s.bank = -clamp(this.turnRate * Math.min(hs, 14) * 0.02, -0.4, 0.4);
    } else {
      // no chão: parado, marcha, corrida ou esgueirando
      const sneak = P.sneaking;
      const low = P.low;
      const amp = sneak ? 0.45 : lerp(0.55, 1.05, run);
      s.legL = sw * amp * walk;
      s.legR = -s.legL;
      const kneeAmp = sneak ? 0.8 : lerp(0.75, 1.65, run);
      s.kneeL = 0.12 + Math.max(0, -cw) * kneeAmp * walk + Math.max(0, sw) * 0.15 * walk;
      s.kneeR = 0.12 + Math.max(0, cw) * kneeAmp * walk + Math.max(0, -sw) * 0.15 * walk;
      const armAmp = sneak ? 0.25 : lerp(0.45, 0.9, run);
      s.armL = -s.legL * armAmp / Math.max(amp, 0.01) * walk;
      s.armR = -s.legR * armAmp / Math.max(amp, 0.01) * walk;
      s.elbowL = s.elbowR = -(0.3 + run * 1.15);
      s.spreadL = s.spreadR = 0.1 + run * 0.05;
      s.hipsY = sw * lerp(0.1, 0.16, run) * walk;
      s.spineY = -sw * lerp(0.14, 0.26, run) * walk;
      s.hipsZ = sw * lerp(0.06, 0.03, run) * walk;
      s.bodyY = (Math.abs(sw) - 0.6) * lerp(0.035, 0.085, run) * walk;
      s.spineX = run * 0.16;
      s.lean = run * 0.12 + clamp(hs - 9.5, 0, 6) * 0.03;
      s.headX = -(s.spineX + s.lean) * 0.7;
      s.bank = -clamp(this.turnRate * Math.min(hs, 14) * 0.035, -0.45, 0.45);
      if (sneak) {
        const deep = low ? 1 : 0.6;
        s.bodyY -= 0.26 * deep;
        s.kneeL += 0.9 * deep;
        s.kneeR += 0.9 * deep;
        s.legL -= 0.45 * deep;
        s.legR -= 0.45 * deep;
        s.spineX += 0.3 + 0.25 * deep;
        s.armL = s.armL * 0.5 + 0.45;
        s.armR = s.armR * 0.5 + 0.45;
        s.elbowL = s.elbowR = -0.9;
        s.headX = -0.35;
      }
      if (hs < 0.3) {
        // parado: respira, transfere o peso e olha em volta
        const br = Math.sin(t * 2.1);
        s.spineX = br * 0.025 + (sneak ? s.spineX : 0);
        s.hipsZ = Math.sin(t * 0.55) * 0.035;
        s.spineZ = -s.hipsZ * 0.6;
        s.legSpread = 0.07;
        s.kneeL = sneak ? s.kneeL : 0.1 + Math.max(0, Math.sin(t * 0.55)) * 0.12;
        s.kneeR = sneak ? s.kneeR : 0.1 + Math.max(0, -Math.sin(t * 0.55)) * 0.12;
        s.armL = s.armR = 0.04 + br * 0.02;
        s.spreadL = s.spreadR = 0.1;
        s.elbowL = s.elbowR = -0.22;
        s.headY = Math.sin(t * 0.37) * 0.35 + Math.sin(t * 0.91) * 0.12;
        s.headX = Math.sin(t * 0.29) * 0.08;
        s.bank = 0;
        // depois de um tempo parado: olha a runa na mão
        const cyc = (this.idleTime % 9) / 9;
        if (this.idleTime > 4 && cyc > 0.55 && cyc < 0.9 && !sneak) {
          s.armR = -1.15;
          s.spreadR = -0.15;
          s.elbowR = -1.75;
          s.headY = -0.3;
          s.headX = 0.45;
        }
        kPose = 6;
      }
    }

    // aterrissagem: joelhos absorvem o impacto
    P.landSquash = damp(P.landSquash, 0, 7, dt);
    const sq = P.landSquash;
    s.kneeL += sq * 1.2;
    s.kneeR += sq * 1.2;
    s.legL -= sq * 0.5;
    s.legR -= sq * 0.5;
    s.bodyY -= sq * 0.25;
    s.spineX += sq * 0.35;

    // aplica as articulações com suavização
    const J = (o, axis, v, kk = kPose) => { o.rotation[axis] = damp(o.rotation[axis], v, kk, dt); };
    J(this.legL, 'x', s.legL);
    J(this.legR, 'x', s.legR);
    J(this.legL, 'z', -s.legSpread);
    J(this.legR, 'z', s.legSpread);
    J(this.kneeL, 'x', s.kneeL);
    J(this.kneeR, 'x', s.kneeR);
    J(this.armL, 'x', s.armL);
    J(this.armR, 'x', s.armR);
    J(this.armL, 'z', -s.spreadL);
    J(this.armR, 'z', s.spreadR);
    J(this.elbowL, 'x', s.elbowL);
    J(this.elbowR, 'x', s.elbowR);
    J(this.hips, 'x', s.hipsX);
    J(this.hips, 'y', s.hipsY);
    J(this.hips, 'z', s.hipsZ);
    J(this.spine, 'x', s.spineX);
    J(this.spine, 'y', s.spineY);
    J(this.spine, 'z', s.spineZ);
    J(this.head, 'x', s.headX, 8);
    J(this.head, 'y', s.headY, 6);
    this.bodyYv = damp(this.bodyYv ?? 0, s.bodyY, kPose, dt);

    // corpo inteiro: inclinação, cambalhota, rolamento, giro e inclinação lateral
    let rx;
    let ry = damp(this.twistV ?? 0, s.twist, 8, dt);
    this.twistV = ry;
    this.leanV = damp(this.leanV ?? 0, s.lean, P.state === 'slide' || P.state === 'dash' ? 20 : 10, dt);
    rx = this.leanV;
    if (P.roll > 0) {
      P.roll -= dt;
      const r = 1 - Math.max(0, P.roll) / ROLL_TIME;
      rx += r * TAU;
      this.kneeL.rotation.x = this.kneeR.rotation.x = 1.8;
      this.legL.rotation.x = this.legR.rotation.x = -1.4;
    }
    if (this.flip > 0) {
      this.flip -= dt;
      const r = 1 - Math.max(0, this.flip) / FLIP_TIME;
      const e = r * r * (3 - 2 * r);
      if (this.flipKind === 'front') {
        rx += e * TAU;
        this.kneeL.rotation.x = this.kneeR.rotation.x = 1.9 * Math.sin(r * Math.PI);
        this.legL.rotation.x = this.legR.rotation.x = -1.5 * Math.sin(r * Math.PI);
      } else {
        ry += e * TAU * (this.flipKind === 'twistL' ? -1 : 1);
      }
    }
    this.bankV = damp(this.bankV ?? 0, s.bank, 8, dt);
    const b = this.body;
    b.rotation.set(rx, ry, this.bankV, 'YXZ');
    // gira em torno do centro de massa (e não dos pés)
    const py = BODY_PIVOT;
    b.position.set(0, this.bodyYv + py - py * Math.cos(rx), -py * Math.sin(rx));
    b.scale.setScalar(1);

    // brilho: avanço, gancho e carga do Véu nos olhos e nas runas
    const glow = P.state === 'dash' ? 1.4 : P.state === 'swing' ? 0.25 : 0;
    this.cloakMat.emissiveIntensity = damp(this.cloakMat.emissiveIntensity, glow, 20, dt);
    const charge = clamp(P.veilCharge, 0, 1);
    this.eyeMat.color.copy(this.eyeBase).multiplyScalar(0.25 + 0.75 * charge * charge);
    this.capeMat.emissiveIntensity = 0.3 + charge * 0.7 + this.cloakMat.emissiveIntensity;
    this.scarfMat.emissiveIntensity = 0.12 + charge * 0.25 + this.cloakMat.emissiveIntensity * 0.5;
    this.handRune.scale.setScalar(0.8 + charge * 0.4 + (this.idleTime > 4 ? Math.sin(t * 6) * 0.15 : 0));

    // sombra circular
    const ground = world.groundBelow(P.pos.x, P.pos.z, 0.05, P.pos.y + 0.05, 40);
    if (ground !== null) {
      const hgt = P.pos.y - ground;
      this.blob.visible = this.root.visible && !this.opts.ghost;
      this.blob.position.set(P.pos.x, ground + 0.03, P.pos.z);
      const sc = 0.9 + Math.min(hgt, 8) * 0.06;
      this.blob.scale.set(sc, sc, sc);
      this.blobMat.opacity = Math.max(0.15, 0.75 - hgt * 0.06);
    } else {
      this.blob.visible = false;
    }

    // tecido
    root.updateMatrixWorld(true);
    this.fwd.set(Math.sin(P.facing), 0, Math.cos(P.facing));
    this.side.set(Math.cos(P.facing), 0, -Math.sin(P.facing));
    const floorY = ground !== null ? ground : P.pos.y - 50;
    const speed = P.state === 'dash' ? 30 : Math.hypot(hs, P.vel.y);
    const speedK = Math.min(1, speed / 14);
    if (dt > 0) {
      const cols = this.buildColliders();
      const airWind = P.demoWind ?? P.wind;
      for (const c of this.cloth) {
        c.mesh.visible = this.root.visible;
        c.update(Math.min(dt, 0.05), cols, floorY, airWind, t, speedK, this.side, this.fwd);
      }
    }

    // rastro de luz da barra da capa
    const fast = P.state === 'dash' || P.state === 'swing' || P.surfing || speed > 13;
    this.trailAlpha = damp(this.trailAlpha, fast && this.root.visible ? 1 : 0, fast ? 8 : 3, dt);
    this.updateTrail();

    // corda do gancho (com leve curva)
    const a = P.state === 'swing' ? P.swing.anchor : null;
    this.rope.visible = !!a && this.root.visible;
    if (a) {
      this.handR.getWorldPosition(this.v);
      const arr = this.rope.geometry.attributes.position.array;
      const n = 9;
      for (let i = 0; i < n; i++) {
        const u = i / (n - 1);
        const sag = Math.sin(u * Math.PI) * 0.15;
        arr[i * 3] = this.v.x + (a.pos.x - this.v.x) * u;
        arr[i * 3 + 1] = this.v.y + (a.pos.y - this.v.y) * u - sag;
        arr[i * 3 + 2] = this.v.z + (a.pos.z - this.v.z) * u;
      }
      this.rope.geometry.attributes.position.needsUpdate = true;
    }
  }

  updateTrail() {
    const pts = this.trailPts;
    const hem = this.cape.hemCenter(this.v2);
    if (!this.trailInit) {
      for (const p of pts) p.copy(hem);
      this.trailInit = true;
    }
    for (let i = pts.length - 1; i > 0; i--) pts[i].copy(pts[i - 1]);
    pts[0].copy(hem);
    this.trail.visible = this.trailAlpha > 0.02;
    if (!this.trail.visible) return;
    const pos = this.trail.geometry.attributes.position.array;
    const col = this.trail.geometry.attributes.color.array;
    const c = this.trailColor;
    for (let i = 0; i < pts.length; i++) {
      pts[i].toArray(pos, i * 3);
      const f = (1 - i / pts.length) * this.trailAlpha * 0.6;
      col[i * 3] = c.r * f;
      col[i * 3 + 1] = c.g * f;
      col[i * 3 + 2] = c.b * f;
    }
    this.trail.geometry.attributes.position.needsUpdate = true;
    this.trail.geometry.attributes.color.needsUpdate = true;
  }
}
