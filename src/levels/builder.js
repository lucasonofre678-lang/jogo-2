// Construtor de fases: blocos de pedra, arcos góticos, barreiras do Véu,
// braseiros, estátuas, cenário distante e os elementos dinâmicos das fases
// de corrida (plataformas móveis, comboios, desmoronamentos, trampolins,
// anéis de impulso, cristais, lâminas, muro do Véu e o portal de chegada).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SOLID, VEIL, KILL } from '../physics.js';
import { boxGeometry, cloudTexture } from '../materials.js';

export const A = -30; // fundo do abismo (oculto pela névoa)

// Trajetórias para plataformas móveis e lâminas: (t, out) => deslocamento.
export const paths = {
  // vai e volta suavemente entre a posição inicial e +d
  pingPong(dx, dy, dz, period, phase = 0) {
    return (t, out) => {
      const k = 0.5 - 0.5 * Math.cos((t / period + phase) * Math.PI * 2);
      return out.set(dx * k, dy * k, dz * k);
    };
  },
  // oscila em torno da posição inicial (-d .. +d)
  swing(dx, dy, dz, period, phase = 0) {
    return (t, out) => {
      const k = Math.sin((t / period + phase) * Math.PI * 2);
      return out.set(dx * k, dy * k, dz * k);
    };
  },
  // velocidade constante depois de um atraso (muro do Véu, maré)
  linear(vx, vy, vz, delay = 0) {
    return (t, out) => {
      const s = Math.max(0, t - delay);
      return out.set(vx * s, vy * s, vz * s);
    };
  },
  circle(rx, rz, period, phase = 0) {
    return (t, out) => {
      const a = (t / period + phase) * Math.PI * 2;
      return out.set(Math.cos(a) * rx, 0, Math.sin(a) * rz);
    };
  },
};

const PORTAL_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float s = sin(a * 5.0 + r * 12.0 - uTime * 5.0) * 0.5 + 0.5;
    vec3 col = mix(vec3(0.1, 0.3, 1.0), vec3(0.9, 1.0, 1.7), s * (1.0 - r));
    float alpha = smoothstep(1.0, 0.55, r) * (0.5 + 0.5 * s);
    gl_FragColor = vec4(col * 1.3, alpha);
  }
`;
const UV_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Contorno de um arco ogival (gótico), da base esquerda à base direita.
function pointedArchPoints(w, h, segs = 8, ox = 0, oy = 0) {
  const spring = Math.max(0, h - 0.866 * w);
  const pts = [new THREE.Vector2(ox - w / 2, oy), new THREE.Vector2(ox - w / 2, oy + spring)];
  for (let i = 1; i <= segs; i++) {
    const a = Math.PI - (i / segs) * (Math.PI / 3);
    pts.push(new THREE.Vector2(ox + w / 2 + Math.cos(a) * w, oy + spring + Math.sin(a) * w));
  }
  for (let i = 1; i <= segs; i++) {
    const a = Math.PI / 3 - (i / segs) * (Math.PI / 3);
    pts.push(new THREE.Vector2(ox - w / 2 + Math.cos(a) * w, oy + spring + Math.sin(a) * w));
  }
  pts.push(new THREE.Vector2(ox + w / 2, oy));
  return pts;
}

// Moldura em "U" ao redor de uma abertura ogival que vai até o chão.
function archRingShape(w, h, t) {
  const outer = pointedArchPoints(w + t * 2, h + t, 10);
  const inner = pointedArchPoints(w, h, 10).reverse();
  return new THREE.Shape([...outer, ...inner]);
}

function scaleUV(geo, s) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / s, uv.getY(i) / s);
  return geo;
}

const VEIL_VERT = /* glsl */ `
  varying vec2 vP;
  void main() {
    vP = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const VEIL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uFlash;
  uniform float uOpacity;
  uniform float uHeight;
  uniform vec3 uTint;
  varying vec2 vP;
  void main() {
    float w = sin(vP.y * 5.0 - uTime * 2.2 + sin(vP.x * 3.0 + uTime) * 1.6) * 0.5 + 0.5;
    float streak = smoothstep(0.75, 1.0, sin(vP.x * 11.0 + uTime * 1.7 + vP.y * 1.5) * 0.5 + 0.5);
    float sparkle = step(0.985, fract(sin(dot(floor(vP * 18.0 + vec2(0.0, uTime * 3.0)), vec2(12.9898, 78.233))) * 43758.5453));
    float rise = fract(vP.y / uHeight - uTime * 0.15);
    vec3 deep = vec3(0.05, 0.25, 1.0);
    vec3 bright = vec3(0.55, 0.9, 1.6);
    vec3 col = mix(deep, bright, w * 0.5 + streak * 0.5) * (0.7 + uFlash * 1.1);
    col += vec3(1.2, 1.6, 2.2) * sparkle;
    float a = (0.14 + 0.2 * w + 0.28 * streak + 0.1 * rise) * uOpacity + uFlash * 0.15;
    gl_FragColor = vec4(col * uTint, clamp(a, 0.0, 1.0));
  }
`;

export class LevelBuilder {
  constructor(ctx, def) {
    this.scene = ctx.scene;
    this.world = ctx.world;
    this.M = ctx.materials;
    this.effects = ctx.effects;
    this.def = def;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.checkpoints = [];
    this.hints = [];
    this.veilBarriers = [];
    this.floaters = [];
    this.flames = [];
    this.mists = [];
    this.guardianDefs = [];
    this.artifact = null;
    this.time = 0;
    this.start = { pos: new THREE.Vector3(0, 0, 0), yaw: 0 };
    this.killY = -16;
    this.dyn = []; // colisores que se movem
    this.movers = [];
    this.lanes = [];
    this.crumbles = [];
    this.pads = [];
    this.rings = [];
    this.orbs = [];
    this.hazards = [];
    this.goal = null;
    this.anchors = [];
    this.winds = [];
    this.phases = [];
    this.dimObjs = [];
    this.dim = 0;
    this.gates = [];
    this.runes = [];
    this.fragment = null;
    this.fragmentTaken = false;
    this.shadowDelay = null;
    this.colossus = null;
    this.tmp = new THREE.Vector3();
    this.windVec = new THREE.Vector3();

    def.build(this);
    this.mergeStatic();
    this.reset();
  }

  // Junta toda a geometria estática que usa materiais compartilhados em
  // poucas malhas (uma por material): de ~1000 para dezenas de draw calls.
  mergeStatic() {
    const shared = new Set(Object.values(this.M).filter((m) => m && m.isMaterial));
    const keep = ['position', 'normal', 'uv'];
    this.group.updateMatrixWorld(true);
    const buckets = new Map();
    const merged = [];
    this.group.traverse((o) => {
      if (!o.isMesh || o.userData.dynamic) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.every((m) => shared.has(m))) return;
      const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const parts = [];
      if (Array.isArray(o.material)) {
        for (const grp of geo.groups) {
          const sub = new THREE.BufferGeometry();
          for (const name of keep) sub.setAttribute(name, geo.attributes[name]);
          sub.setIndex(Array.from(geo.index.array.slice(grp.start, grp.start + grp.count)));
          parts.push([o.material[grp.materialIndex], sub]);
        }
      } else {
        parts.push([o.material, geo]);
      }
      for (const [mat, g] of parts) {
        const ng = g.index ? g.toNonIndexed() : g;
        ng.clearGroups();
        for (const name of Object.keys(ng.attributes)) if (!keep.includes(name)) ng.deleteAttribute(name);
        const key = mat.uuid + (o.castShadow ? ':c' : ':n');
        if (!buckets.has(key)) buckets.set(key, { mat, cast: o.castShadow, geos: [] });
        buckets.get(key).geos.push(ng);
      }
      merged.push(o);
    });
    for (const o of merged) o.parent.remove(o);
    for (const b of buckets.values()) {
      const mesh = new THREE.Mesh(mergeGeometries(b.geos, false), b.mat);
      mesh.castShadow = b.cast;
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  // ================================================================ helpers
  block(minX, minY, minZ, maxX, maxY, maxZ, mat, opts = {}) {
    const sx = maxX - minX;
    const sy = maxY - minY;
    const sz = maxZ - minZ;
    const geo = boxGeometry(sx, sy, sz, opts.uv ?? 2.5);
    const material = opts.top ? [mat, mat, opts.top, mat, mat, mat] : mat;
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
    mesh.castShadow = opts.cast ?? true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    if (opts.collide !== false) {
      mesh.userData.collider = this.world.add(minX, minY, minZ, maxX, maxY, maxZ, opts.kind ?? SOLID);
    }
    return mesh;
  }

  // Plataforma com topo de lajotas e cornija nas bordas.
  platform(minX, minZ, maxX, maxZ, top, opts = {}) {
    const m = this.block(minX, opts.bottom ?? A, minZ, maxX, top, maxZ, opts.mat ?? this.M.wall, { top: this.M.floor });
    if (opts.cornice !== false) this.cornice(minX, minZ, maxX, maxZ, top);
    return m;
  }

  cornice(minX, minZ, maxX, maxZ, top) {
    const o = 0.14;
    const y0 = top - 0.5;
    const y1 = top - 0.22;
    const M = this.M.trim;
    const opt = { collide: false, cast: false, uv: 1.5 };
    this.block(minX - o, y0, minZ - o, maxX + o, y1, minZ, M, opt);
    this.block(minX - o, y0, maxZ, maxX + o, y1, maxZ + o, M, opt);
    this.block(minX - o, y0, minZ, minX, y1, maxZ, M, opt);
    this.block(maxX, y0, minZ, maxX + o, y1, maxZ, M, opt);
  }

  column(x, z, y, h, r = 0.5, opts = {}) {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r * 0.92, h - 0.7, 8), M.trim);
    shaft.position.y = h / 2;
    const base = new THREE.Mesh(boxGeometry(r * 2.3, 0.4, r * 2.3, 1.5), M.trim);
    base.position.y = 0.2;
    g.add(shaft, base);
    if (!opts.broken) {
      const cap = new THREE.Mesh(boxGeometry(r * 2.5, 0.35, r * 2.5, 1.5), M.trim);
      cap.position.y = h - 0.17;
      g.add(cap);
    } else {
      shaft.geometry.dispose();
      shaft.geometry = new THREE.CylinderGeometry(r * 0.7, r * 0.92, h - 0.4, 8);
      shaft.position.y = (h - 0.4) / 2 + 0.2;
      const chunk = new THREE.Mesh(new THREE.DodecahedronGeometry(r * 0.8, 0), M.rock);
      chunk.position.set(r * 0.9, 0.3, r * 0.6);
      g.add(chunk);
    }
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.group.add(g);
    if (opts.collide !== false) this.world.add(x - r, y, z - r, x + r, y + h, z + r);
    return g;
  }

  // Painel em arco ogival (janela luminosa, porta selada).
  archPanel(x, y, z, rotY, w, h, mat, frame = true) {
    const shape = new THREE.Shape(pointedArchPoints(w, h));
    const pane = new THREE.Mesh(new THREE.ShapeGeometry(shape, 8), mat);
    pane.position.set(x, y, z);
    pane.rotation.y = rotY;
    this.group.add(pane);
    if (frame) {
      const outer = new THREE.Shape(pointedArchPoints(w + 0.36, h + 0.32, 8, 0, -0.16));
      outer.holes.push(new THREE.Path(pointedArchPoints(w, h).reverse()));
      const geo = scaleUV(new THREE.ExtrudeGeometry(outer, { depth: 0.18, bevelEnabled: false, curveSegments: 8 }), 1.5);
      const fr = new THREE.Mesh(geo, this.M.trim);
      fr.position.copy(pane.position);
      fr.rotation.y = rotY;
      fr.castShadow = true;
      this.group.add(fr);
      // divisória central (tracery)
      const bar = new THREE.Mesh(boxGeometry(0.08, h * 0.85, 0.1), this.M.trim);
      bar.position.set(0, h * 0.42, 0.04);
      pane.add(bar);
    }
    return pane;
  }

  // Muro com uma porta ogival recortada (a porta fica livre).
  archWall(cx, y, cz, rotY, width, height, depth, openW, openH, mat) {
    const pts = [new THREE.Vector2(-width / 2, 0), ...pointedArchPoints(openW, openH, 10), new THREE.Vector2(width / 2, 0),
      new THREE.Vector2(width / 2, height), new THREE.Vector2(-width / 2, height)];
    const shape = new THREE.Shape(pts);
    const geo = scaleUV(new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 }), 2.5);
    geo.translate(0, 0, -depth / 2);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx, y, cz);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    this.group.add(m);
    // contorno decorativo da porta
    const trimShape = archRingShape(openW, openH, 0.28);
    for (const side of [1, -1]) {
      const tg = scaleUV(new THREE.ExtrudeGeometry(trimShape, { depth: 0.12, bevelEnabled: false }), 1.5);
      const t = new THREE.Mesh(tg, this.M.trim);
      t.position.set(cx + Math.sin(rotY) * (depth / 2) * side, y, cz + Math.cos(rotY) * (depth / 2) * side);
      t.rotation.y = rotY + (side < 0 ? Math.PI : 0);
      t.castShadow = true;
      this.group.add(t);
    }
    return m;
  }

  // Membrana do Véu numa abertura em arco. Só o Passo do Véu atravessa.
  veilBarrier(cx, y, cz, rotY, w, h, collider) {
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uOpacity: { value: 1 }, uHeight: { value: h }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: VEIL_VERT,
      fragmentShader: VEIL_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const shape = new THREE.Shape(pointedArchPoints(w - 0.05, h - 0.05, 10));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape, 10), mat);
    mesh.position.set(cx, y, cz);
    mesh.rotation.y = rotY;
    this.group.add(mesh);
    const light = new THREE.PointLight(0x4f9dff, 14, 10, 2);
    light.position.set(cx, y + h * 0.45, cz);
    this.group.add(light);
    const vb = { mesh, mat, light, collider, flash: 0, x: cx, y: y + h * 0.5, z: cz };
    this.veilBarriers.push(vb);
    return vb;
  }

  brazier(x, y, z) {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.25, 8), M.trim);
    base.position.y = 0.12;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.85, 6), M.iron);
    stem.position.y = 0.65;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.22, 0.32, 8, 1, true), M.iron);
    bowl.position.y = 1.2;
    bowl.material = M.iron.clone();
    bowl.material.side = THREE.DoubleSide;
    g.add(base, stem, bowl);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    const flameMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.05, 0.2, 0.75), transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const coreMat = flameMat.clone();
    coreMat.color = new THREE.Color(0.35, 0.65, 1.3);
    const flameGeo = new THREE.SphereGeometry(0.26, 8, 6);
    flameGeo.translate(0, 0.26, 0);
    const fp = flameGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const y = fp.getY(i);
      const k = Math.max(0.05, 1 - y / 0.6);
      fp.setXYZ(i, fp.getX(i) * k, y * 1.9, fp.getZ(i) * k);
    }
    flameGeo.computeVertexNormals();
    const outer = new THREE.Mesh(flameGeo, flameMat);
    outer.position.y = 1.3;
    const inner = new THREE.Mesh(flameGeo, coreMat);
    inner.position.y = 1.3;
    inner.scale.setScalar(0.55);
    g.add(outer, inner);
    const light = new THREE.PointLight(0x6ab0ff, 2, 12, 2);
    light.position.y = 2;
    g.add(light);
    this.group.add(g);
    this.world.add(x - 0.4, y, z - 0.4, x + 0.4, y + 1.35, z + 0.4);
    const b = { group: g, outer, inner, light, flameMat, coreMat, active: false, seed: Math.random() * 10 };
    this.flames.push(b);
    return b;
  }

  runeDecal(x, y, z, size, rotX = -Math.PI / 2, rotY = 0, color = new THREE.Color(0.35, 0.8, 2.2), opacity = 0.7) {
    const mat = new THREE.MeshBasicMaterial({
      map: this.M.runeTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.position.set(x, y, z);
    m.rotation.set(rotX, rotY, 0, 'YXZ');
    if (rotX !== -Math.PI / 2) m.rotation.set(0, rotY, 0);
    this.group.add(m);
    return m;
  }

  rubble(x, y, z, count, spread, size = 0.35) {
    for (let i = 0; i < count; i++) {
      const s = size * (0.4 + Math.random());
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), this.M.rock);
      m.position.set(x + (Math.random() - 0.5) * spread, y + s * 0.5, z + (Math.random() - 0.5) * spread);
      m.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      m.scale.y = 0.6 + Math.random() * 0.4;
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  merlons(x0, z0, x1, z1, y, step = 1.2, size = 0.55, h = 0.6) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.floor(len / step);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i / n;
      const x = x0 + (x1 - x0) * t;
      const z = z0 + (z1 - z0) * t;
      if (Math.random() < 0.2) continue; // ruína
      this.block(x - size / 2, y, z - size / 2, x + size / 2, y + h * (0.6 + Math.random() * 0.4), z + size / 2, this.M.wall, { collide: false, uv: 1.2 });
    }
  }

  statue(x, y, z, rotY, scale = 1) {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    g.scale.setScalar(scale);
    const ped = new THREE.Mesh(boxGeometry(1.2, 1, 1.2, 1.5), M.trim);
    ped.position.y = 0.5;
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.5, 1.7, 7), M.statue);
    robe.position.y = 1.85;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 5), M.statue);
    head.position.set(0, 2.85, 0.05);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.5, 7), M.statue);
    hood.position.set(0, 2.98, -0.04);
    const wingGeo = new THREE.BoxGeometry(0.08, 1.6, 0.7);
    const wl = new THREE.Mesh(wingGeo, M.statue);
    wl.position.set(-0.35, 2.3, -0.35);
    wl.rotation.set(0.3, 0.5, 0.25);
    const wr = wl.clone();
    wr.position.x = 0.35;
    wr.rotation.set(0.3, -0.5, -0.25);
    const arms = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.3), M.statue);
    arms.position.set(0, 2.25, 0.25);
    g.add(ped, robe, head, hood, wl, wr, arms);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    this.group.add(g);
    const r = 0.6 * scale;
    this.world.add(x - r, y, z - r, x + r, y + 3.2 * scale, z + r);
    return g;
  }

  spire(x, y, z, w, h, mat = this.M.wallDark) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(w * 0.72, h, 4), mat);
    m.position.set(x, y + h / 2, z);
    m.rotation.y = Math.PI / 4;
    m.castShadow = true;
    this.group.add(m);
    return m;
  }

  checkpoint(x, y, z, bx, bz, yaw = 0) {
    const brazier = this.brazier(bx, y, bz);
    const decal = this.runeDecal(x, y + 0.02, z, 2.4, -Math.PI / 2, 0, new THREE.Color(0.25, 0.6, 1.8), 0.25);
    const cp = { pos: new THREE.Vector3(x, y, z), yaw, brazier, decal, active: false, index: this.checkpoints.length };
    this.checkpoints.push(cp);
    return cp;
  }

  activateCheckpoint(cp) {
    cp.active = true;
    cp.brazier.active = true;
    cp.decal.material.opacity = 0.75;
    const p = cp.brazier.group.position;
    this.effects.sparks(p.x, p.y + 1.7, p.z, 50, { speed: 3, life: 1.2, spread: 0.4 });
    this.effects.ring(cp.pos.x, cp.pos.y, cp.pos.z, 4, 1.2, undefined, false);
  }

  floater(mesh, amp = 0.3, speed = 1, spin = 0.3) {
    mesh.traverse((o) => { o.userData.dynamic = true; });
    this.floaters.push({ mesh, baseY: mesh.position.y, amp, speed, spin, seed: Math.random() * 10 });
  }

  // ============================================================ início
  startAt(x, y, z, yaw = 0) {
    this.start.pos.set(x, y, z);
    this.start.yaw = yaw;
    // marca de largada
    this.runeDecal(x, y + 0.03, z, 2.2, -Math.PI / 2, 0, new THREE.Color(0.3, 0.7, 2), 0.5);
  }

  // ============================================================ movimento
  addMover(c, mesh, path) {
    if (mesh) mesh.traverse((o) => { o.userData.dynamic = true; });
    const m = { c, mesh, base: mesh ? mesh.position.clone() : null, min: new THREE.Vector3(c.minX, c.minY, c.minZ), path, off: new THREE.Vector3() };
    this.movers.push(m);
    this.dyn.push(c);
    return m;
  }

  // Bloco de pedra que se move ao longo de uma trajetória.
  mover(minX, minY, minZ, maxX, maxY, maxZ, mat, path, opts = {}) {
    const mesh = this.block(minX, minY, minZ, maxX, maxY, maxZ, mat, { top: opts.top, uv: opts.uv, cast: opts.cast, collide: false });
    const c = this.world.add(minX, minY, minZ, maxX, maxY, maxZ, opts.kind ?? SOLID);
    return this.addMover(c, mesh, path);
  }

  // Plataforma móvel com topo de lajotas e runas nas laterais.
  movingPlatform(minX, minZ, maxX, maxZ, top, path, thick = 1.2) {
    const m = this.mover(minX, top - thick, minZ, maxX, top, maxZ, this.M.trim, path, { top: this.M.floor });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(maxX - minX + 0.06, 0.08, maxZ - minZ + 0.06), this.M.slabGlow);
    glow.position.y = -thick / 2 + 0.15;
    m.mesh.add(glow);
    glow.userData.dynamic = true;
    return m;
  }

  placeMover(m, teleport) {
    m.path(this.time, m.off);
    const c = m.c;
    const dx = m.min.x + m.off.x - c.minX;
    const dy = m.min.y + m.off.y - c.minY;
    const dz = m.min.z + m.off.z - c.minZ;
    c.translate(dx, dy, dz);
    if (teleport) c.beginFrame();
    if (m.mesh) m.mesh.position.copy(m.base).add(m.off);
  }

  // ============================================================ perigos
  // Lâmina de energia corrompida: encostar mata.
  blade(minX, minY, minZ, maxX, maxY, maxZ, path = paths.linear(0, 0, 0)) {
    const m = this.mover(minX, minY, minZ, maxX, maxY, maxZ, this.M.blade, path, { kind: KILL, cast: false });
    this.hazards.push(m);
    return m;
  }

  // Muro (ou maré) do Véu corrompido que avança e mata ao tocar.
  veilSurge({ minX, maxX, minY, maxY, minZ, maxZ, velocity, delay = 1.5, horizontal = false }) {
    const c = this.world.add(minX, minY, minZ, maxX, maxY, maxZ, KILL);
    const w = maxX - minX;
    const h = horizontal ? maxZ - minZ : maxY - minY;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0.4 }, uOpacity: { value: 1.6 }, uHeight: { value: h }, uTint: { value: new THREE.Vector3(1.8, 0.35, 0.75) } },
      vertexShader: VEIL_VERT, fragmentShader: VEIL_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h, 1, 1), mat);
    if (horizontal) {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set((minX + maxX) / 2, maxY, (minZ + maxZ) / 2);
    } else {
      mesh.position.set((minX + maxX) / 2, (minY + maxY) / 2, minZ);
    }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.25, 0.02, 0.08), transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide,
    }));
    back.position.z = horizontal ? -0.4 : 0.6;
    mesh.add(back);
    this.group.add(mesh);
    const m = this.addMover(c, mesh, paths.linear(velocity[0], velocity[1], velocity[2], delay));
    m.surge = { mat, horizontal };
    this.hazards.push(m);
    return m;
  }

  // ============================================================ comboio
  // Uma faixa de carruagens espectrais. Por padrão correm para -z (rumo ao
  // objetivo); com axis 'x' cruzam o caminho (dir +1 = +x, -1 = -x).
  // Batem em obstáculos (crash) ou na que parou à frente e despencam no fim.
  // Coordenadas internas: u diminui no sentido da viagem; v é a lateral.
  lane(opts) {
    const axis = opts.axis ?? 'z';
    const s = axis === 'z' ? -1 : opts.dir ?? 1; // sentido da coordenada do eixo
    const toU = (c) => -s * c;
    const L = {
      axis, s, v0: axis === 'z' ? opts.x : opts.z, top: opts.top, speed: opts.speed, spacing: opts.spacing ?? 11,
      startU: toU(opts.from ?? opts.startZ), endU: toU(opts.to ?? opts.endZ),
      crash: (opts.crash ?? []).map(toU), weave: opts.weave ?? null,
      phase: opts.phase ?? 0, w: opts.width ?? 3.2, len: opts.len ?? 6, thick: opts.thick ?? 1.3,
      slabs: [], pool: [], spawnTimer: 0, last: null,
      yaw: axis === 'z' ? 0 : s > 0 ? -Math.PI / 2 : Math.PI / 2,
    };
    const count = Math.ceil((L.startU - L.endU) / L.spacing) + 8;
    const bodyGeo = boxGeometry(L.w, L.thick, L.len, 2);
    const glowParts = [];
    const under = new THREE.PlaneGeometry(L.w * 0.85, L.len * 0.85);
    under.rotateX(Math.PI / 2);
    under.translate(0, -L.thick / 2 - 0.03, 0);
    glowParts.push(under);
    for (const side of [-1, 1]) {
      const strip = new THREE.BoxGeometry(0.06, 0.1, L.len * 0.92);
      strip.translate(side * (L.w / 2 + 0.02), L.thick / 2 - 0.2, 0);
      glowParts.push(strip);
    }
    const prow = new THREE.BoxGeometry(L.w * 0.7, 0.12, 0.06);
    prow.translate(0, L.thick / 2 - 0.2, -L.len / 2 - 0.02);
    glowParts.push(prow);
    const glowGeo = mergeGeometries(glowParts.map((g) => {
      const ng = g.index ? g.toNonIndexed() : g;
      for (const n of Object.keys(ng.attributes)) if (n !== 'position') ng.deleteAttribute(n);
      return ng;
    }), false);
    L.body = new THREE.InstancedMesh(bodyGeo, [this.M.slab, this.M.slab, this.M.floor, this.M.slab, this.M.slab, this.M.slab], count);
    L.glow = new THREE.InstancedMesh(glowGeo, this.M.slabGlow, count);
    for (const im of [L.body, L.glow]) {
      im.userData.dynamic = true;
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(im);
    }
    L.body.castShadow = true;
    L.body.receiveShadow = true;
    // meias-medidas do colisor no mundo
    L.hx = axis === 'z' ? L.w / 2 : L.len / 2;
    L.hz = axis === 'z' ? L.len / 2 : L.w / 2;
    for (let i = 0; i < count; i++) {
      const c = this.world.add(0, -500, 0, L.hx * 2, -500 + L.thick, L.hz * 2);
      c.enabled = false;
      this.dyn.push(c);
      L.pool.push({ c, i, state: 'idle', u: 0, v: 0, y: 0, vy: 0, vu: 0, t: 0, leader: null });
    }
    this.lanes.push(L);
    return L;
  }

  laneV(L, u) {
    return L.weave ? L.v0 + Math.sin((u / L.weave.length) * Math.PI * 2) * L.weave.amp : L.v0;
  }

  // posição no mundo do centro do topo de uma carruagem
  slabWorld(L, u, v, out) {
    if (L.axis === 'z') return out.set(v, 0, u);
    return out.set(-L.s * u, 0, v);
  }

  setSlab(L, sl, u, y, v, teleport) {
    const c = sl.c;
    const p = this.slabWorld(L, u, v, this.tmp);
    c.translate(p.x - L.hx - c.minX, y - L.thick - c.minY, p.z - L.hz - c.minZ);
    if (teleport) c.beginFrame();
    sl.u = u;
    sl.y = y;
    sl.v = v;
  }

  spawnSlab(L, ahead) {
    const sl = L.pool.pop();
    if (!sl) return;
    const u = L.startU - ahead * L.speed;
    sl.state = 'run';
    sl.t = 0;
    sl.vy = 0;
    sl.vu = -L.speed;
    sl.pileUp = false;
    sl.leader = L.last;
    L.last = sl;
    sl.c.enabled = true;
    this.setSlab(L, sl, u, L.top, this.laneV(L, u), true);
    L.slabs.push(sl);
  }

  // A carruagem bateu: quem está em cima é arremessado para frente.
  crashSlab(L, sl, vLat) {
    sl.state = 'crash';
    sl.t = 0;
    sl.c.jolt = L.axis === 'z' ? { x: vLat, z: -L.speed } : { x: L.s * L.speed, z: vLat };
    this.onSlabCrash?.(sl, L);
  }

  updateLane(L, dt) {
    L.spawnTimer -= dt;
    while (L.spawnTimer <= 0) {
      this.spawnSlab(L, -L.spawnTimer);
      L.spawnTimer += L.spacing / L.speed;
    }
    for (const sl of L.slabs) {
      if (sl.state === 'run') {
        let nu = sl.u - L.speed * dt;
        const oldFront = sl.u - L.len / 2;
        let front = nu - L.len / 2;
        for (const cu of L.crash) {
          if (oldFront > cu - 0.01 && front <= cu) {
            nu = cu + L.len / 2;
            front = cu;
            this.crashSlab(L, sl, (this.laneV(L, nu) - sl.v) / dt);
            sl.pileUp = false;
          }
        }
        const ld = sl.leader;
        // só bate na da frente enquanto ela está parada (não depois que despenca)
        if (sl.state === 'run' && ld && ld.state === 'crash') {
          const ldBack = ld.u + L.len / 2;
          if (front <= ldBack + 0.05) {
            nu = ldBack + 0.05 + L.len / 2;
            this.crashSlab(L, sl, 0);
            sl.pileUp = true;
          }
        }
        if (sl.state === 'run' && front < L.endU) {
          sl.state = 'fall';
          sl.t = 0;
          sl.vy = 0;
          sl.vu = -L.speed;
        }
        this.setSlab(L, sl, nu, sl.y, this.laneV(L, nu), false);
      } else if (sl.state === 'crash') {
        sl.t += dt;
        // a primeira bate e treme; as de trás despencam logo para não travar a faixa
        if (sl.t > (sl.pileUp ? 0.12 : 0.35)) {
          sl.state = 'fall';
          sl.t = 0;
          sl.vy = 0;
          sl.vu = 0;
        }
      } else if (sl.state === 'fall') {
        sl.t += dt;
        sl.vy -= 28 * dt;
        this.setSlab(L, sl, sl.u + sl.vu * dt, sl.y + sl.vy * dt, sl.v, false);
        if (sl.y < L.top - 45) {
          sl.state = 'idle';
          sl.c.enabled = false;
        }
      }
    }
    // devolve as carruagens que sumiram
    for (let i = L.slabs.length - 1; i >= 0; i--) {
      const sl = L.slabs[i];
      if (sl.state === 'idle') {
        L.slabs.splice(i, 1);
        L.pool.push(sl);
        if (L.last === sl) L.last = null;
        for (const o of L.slabs) if (o.leader === sl) o.leader = null;
      }
    }
  }

  drawLane(L) {
    const m = this.laneMat ??= new THREE.Matrix4();
    const q = this.laneQ ??= new THREE.Quaternion();
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), L.yaw);
    const qt = new THREE.Quaternion();
    const ax = new THREE.Vector3(1, 0, 0);
    const p = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < L.body.count; i++) {
      L.body.setMatrixAt(i, hidden);
      L.glow.setMatrixAt(i, hidden);
    }
    for (const sl of L.slabs) {
      let jx = 0;
      let jy = 0;
      if (sl.state === 'crash') {
        jx = (Math.random() - 0.5) * 0.12;
        jy = (Math.random() - 0.5) * 0.08;
      }
      const tilt = sl.state === 'fall' ? -Math.min(sl.t * 0.9, 0.9) * (sl.vu ? 1 : 0.4) : 0;
      qt.setFromAxisAngle(ax, tilt);
      q.copy(qy).multiply(qt);
      this.slabWorld(L, sl.u, sl.v, p);
      p.x += jx;
      p.y = sl.y - L.thick / 2 + jy;
      m.compose(p, q, one);
      L.body.setMatrixAt(sl.i, m);
      L.glow.setMatrixAt(sl.i, m);
    }
    L.body.instanceMatrix.needsUpdate = true;
    L.glow.instanceMatrix.needsUpdate = true;
  }

  resetLane(L) {
    for (const sl of L.slabs) {
      sl.state = 'idle';
      sl.c.enabled = false;
      L.pool.push(sl);
    }
    L.slabs.length = 0;
    L.last = null;
    for (const sl of L.pool) sl.leader = null;
    L.spawnTimer = L.phase;
    // pré-aquece: o comboio já está em movimento quando a fase começa
    const dt = 1 / 30;
    const T = (L.startU - L.endU) / L.speed + 2;
    for (let t = 0; t < T; t += dt) this.updateLane(L, dt);
    for (const sl of L.slabs) sl.c.beginFrame();
  }

  // ============================================================ desmoronam
  crumble(minX, minZ, maxX, maxZ, top, delay = 0.45, thick = 1.2) {
    const mesh = this.block(minX, top - thick, minZ, maxX, top, maxZ, this.M.crumble, { collide: false });
    mesh.userData.dynamic = true;
    const c = this.world.add(minX, top - thick, minZ, maxX, top, maxZ);
    const cr = { c, mesh, base: mesh.position.clone(), min: new THREE.Vector3(minX, top - thick, minZ), state: 'idle', t: 0, vy: 0, delay };
    c.onStand = () => {
      if (cr.state === 'idle') {
        cr.state = 'shake';
        cr.t = 0;
        this.onCrumble?.(cr);
      }
    };
    this.crumbles.push(cr);
    this.dyn.push(c);
    return cr;
  }

  updateCrumbles(dt) {
    for (const cr of this.crumbles) {
      if (cr.state === 'shake') {
        cr.t += dt;
        cr.mesh.position.set(cr.base.x + (Math.random() - 0.5) * 0.1, cr.base.y + (Math.random() - 0.5) * 0.05, cr.base.z + (Math.random() - 0.5) * 0.1);
        if (cr.t >= cr.delay) {
          cr.state = 'fall';
          cr.t = 0;
          cr.vy = 0;
        }
      } else if (cr.state === 'fall') {
        cr.t += dt;
        cr.vy -= 25 * dt;
        cr.c.translate(0, cr.vy * dt, 0);
        cr.mesh.position.y += cr.vy * dt;
        cr.mesh.rotation.x += dt * 0.6;
        if (cr.t > 2.5) {
          cr.state = 'gone';
          cr.c.enabled = false;
          cr.mesh.visible = false;
        }
      }
    }
  }

  resetCrumbles() {
    for (const cr of this.crumbles) {
      const c = cr.c;
      c.translate(cr.min.x - c.minX, cr.min.y - c.minY, cr.min.z - c.minZ);
      c.beginFrame();
      c.enabled = true;
      cr.state = 'idle';
      cr.t = 0;
      cr.mesh.visible = true;
      cr.mesh.position.copy(cr.base);
      cr.mesh.rotation.set(0, 0, 0);
    }
  }

  // ============================================================ ajudas
  // Trampolim rúnico: pisar lança para cima (e opcionalmente para frente).
  pad(x, groundY, z, power = 20, launch = null, size = 2.4) {
    const top = groundY + 0.3;
    this.block(x - size / 2, groundY - 0.2, z - size / 2, x + size / 2, top - 0.02, z + size / 2, this.M.trim, { collide: false, uv: 1.5 });
    const c = this.world.add(x - size / 2, groundY - 0.2, z - size / 2, x + size / 2, top, z + size / 2);
    c.bounce = power;
    c.launch = launch ? { x: launch[0], z: launch[1] } : null;
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.0, 1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(size * 0.42, 24), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, top + 0.02, z);
    disc.userData.dynamic = true;
    this.group.add(disc);
    const decal = this.runeDecal(x, top + 0.04, z, size * 0.95, -Math.PI / 2, 0, new THREE.Color(0.4, 1.4, 2.2), 0.8);
    decal.userData.dynamic = true;
    if (launch) {
      // seta indicando a direção do lançamento
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 3), mat);
      arrow.position.set(x, top + 0.3, z);
      arrow.rotation.set(-Math.PI / 2, Math.atan2(-launch[0], -launch[1]), 0, 'YXZ');
      arrow.userData.dynamic = true;
      this.group.add(arrow);
    }
    const p = { c, mat, disc, pulse: 0 };
    c.pad = p;
    this.pads.push(p);
    return p;
  }

  // Anel de impulso: atravessá-lo lança na direção indicada.
  boostRing(x, y, z, dir = [0, 0.12, -1], speed = 26) {
    const d = new THREE.Vector3(...dir).normalize();
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.1, 0.35) });
    const torus = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.09, 8, 40), mat);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 6, 40), mat);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1.4, 32), new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.6, 0.45, 0.1), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    g.add(torus, inner, fill);
    g.traverse((o) => { o.userData.dynamic = true; });
    this.group.add(g);
    g.lookAt(x + d.x, y + d.y, z + d.z);
    const r = { g, inner, mat, pos: new THREE.Vector3(x, y, z), dir: d, speed, cd: 0 };
    this.rings.push(r);
    return r;
  }

  // Cristal do Véu: recarrega o Passo do Véu no ar.
  orb(x, y, z) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.2) });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.34, 0), mat);
    mesh.position.set(x, y, z);
    mesh.scale.y = 1.4;
    const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.2, 0.5, 1.2), wireframe: true, transparent: true, opacity: 0.6,
    }));
    mesh.add(shell);
    mesh.traverse((o) => { o.userData.dynamic = true; });
    this.group.add(mesh);
    const o = { mesh, shell, pos: new THREE.Vector3(x, y, z), active: true, t: 0 };
    this.orbs.push(o);
    return o;
  }

  // Portal de chegada.
  goalPortal(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const M = this.M;
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.5, 3) });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.12, 8, 48), ringMat);
    ring.position.y = 1.9;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } }, vertexShader: UV_VERT, fragmentShader: PORTAL_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.62, 48), mat);
    disc.position.y = 1.9;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.4, 30, 16, 1, true), new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.15, 0.35, 0.9), transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    beam.position.y = 16;
    g.add(ring, disc, beam);
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(boxGeometry(0.5, 4.2, 0.6, 1.5), M.trim);
      pillar.position.set(s * 2.05, 2.1, 0);
      pillar.castShadow = true;
      g.add(pillar);
    }
    g.traverse((o) => { o.userData.dynamic = true; });
    const light = new THREE.PointLight(0x7ab8ff, 24, 16, 2);
    light.position.y = 2;
    g.add(light);
    this.group.add(g);
    this.decorDecal(x, y, z);
    this.goal = { pos: new THREE.Vector3(x, y, z), group: g, mat, ring, disc, light };
    return this.goal;
  }

  decorDecal(x, y, z) {
    const d = this.runeDecal(x, y + 0.03, z, 3.6, -Math.PI / 2, 0, new THREE.Color(0.4, 0.9, 2.4), 0.8);
    d.userData.dynamic = true;
    return d;
  }

  // Membrana retangular do Véu entre dois pilares (só o Passo do Véu passa).
  veilWall(minX, minY, z, maxX, maxY, light = true) {
    const M = this.M;
    const c = this.world.add(minX, minY, z - 0.15, maxX, maxY, z + 0.15, VEIL);
    const w = maxX - minX;
    const h = maxY - minY;
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlash: { value: 0 }, uOpacity: { value: 1 }, uHeight: { value: h }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
      vertexShader: VEIL_VERT, fragmentShader: VEIL_FRAG,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set((minX + maxX) / 2, minY + h / 2, z);
    this.group.add(mesh);
    this.block(minX - 0.6, A, z - 0.4, minX, maxY + 0.6, z + 0.4, M.wall, { uv: 1.5 });
    this.block(maxX, A, z - 0.4, maxX + 0.6, maxY + 0.6, z + 0.4, M.wall, { uv: 1.5 });
    this.block(minX - 0.6, maxY, z - 0.4, maxX + 0.6, maxY + 0.6, z + 0.4, M.trim, { uv: 1.5 });
    let pl = null;
    if (light) {
      pl = new THREE.PointLight(0x4f9dff, 10, 10, 2);
      pl.position.set((minX + maxX) / 2, minY + h * 0.5, z + 0.5);
      this.group.add(pl);
    }
    const vb = { mesh, mat, light: pl, collider: c, flash: 0, x: (minX + maxX) / 2, y: minY + h / 2, z };
    this.veilBarriers.push(vb);
    return vb;
  }

  // ============================================================ cenário
  scenery(cx, cz, radius = 120) {
    const M = this.M;
    // torres e agulhas góticas no horizonte (silhuetas)
    let seed = 1234 + Math.round(Math.abs(cz) * 7 + radius);
    const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand() * 0.2;
      const r = radius + rand() * 90;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      const h = 25 + rand() * 55;
      const w = 5 + rand() * 9;
      const mat = r > radius + 50 ? M.silhouetteFar : M.silhouette;
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h + 60, w), mat);
      tower.position.set(x, h / 2 - 30, z);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, h * 0.45, 4), mat);
      cap.position.set(x, h + h * 0.225, z);
      cap.rotation.y = Math.PI / 4;
      this.group.add(tower, cap);
      for (const s of [-1, 1]) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(w * 0.18, h * 0.35, 4), mat);
        sp.position.set(x + s * w * 0.45, h + h * 0.1, z);
        this.group.add(sp);
      }
      if (rand() < 0.5) {
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.15, h * 0.12), M.distantWindow);
        win.position.set(x, h * 0.6, z);
        win.lookAt(cx, h * 0.6, cz);
        win.translateZ(w / 2 + 0.05);
        this.group.add(win);
      }
    }
    // a grande catedral no horizonte
    const cathedral = new THREE.Group();
    const cath = new THREE.Mesh(new THREE.BoxGeometry(40, 120, 30), M.silhouette);
    cath.position.set(0, 10, 0);
    const cathSpire = new THREE.Mesh(new THREE.ConeGeometry(14, 70, 4), M.silhouette);
    cathSpire.position.set(0, 105, 0);
    cathSpire.rotation.y = Math.PI / 4;
    const rose = new THREE.Mesh(new THREE.CircleGeometry(5, 24), M.distantWindow);
    rose.position.set(0, 45, 15.1);
    cathedral.add(cath, cathSpire, rose);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(10, 130, 10), M.silhouette);
      t.position.set(s * 26, 15, 5);
      const c = new THREE.Mesh(new THREE.ConeGeometry(7.5, 40, 4), M.silhouette);
      c.position.set(s * 26, 100, 5);
      c.rotation.y = Math.PI / 4;
      cathedral.add(t, c);
    }
    cathedral.position.set(cx + 95, 0, cz - radius - 55);
    cathedral.lookAt(cx, 0, cz);
    this.group.add(cathedral);

    // rochas flutuantes ao redor
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1 + rand() * 2.5, 0), M.rock);
      rock.position.set(cx + side * (24 + rand() * 25), -6 + rand() * 18, cz + radius * 0.45 - rand() * radius * 0.9);
      rock.scale.y = 0.6;
      rock.rotation.set(rand() * 3, rand() * 3, rand() * 3);
      rock.castShadow = true;
      this.group.add(rock);
      this.floater(rock, 0.6, 0.2 + rand() * 0.3, 0.05);
    }

    // névoa em camadas no abismo
    const cloud = cloudTexture();
    const size = Math.max(420, radius * 3.5);
    for (const [y, op, sc] of [[-5, 0.55, 1], [-11, 0.65, 1.6], [-18, 0.8, 2.2]]) {
      const tex = cloud.clone();
      tex.needsUpdate = true;
      tex.repeat.set(3 * sc * (size / 420), 3 * sc * (size / 420));
      const mat = new THREE.MeshBasicMaterial({
        map: tex, color: this.M.mistColor, transparent: true, opacity: op, depthWrite: false,
      });
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      plane.rotation.x = -Math.PI / 2;
      plane.position.set(cx, y, cz);
      plane.userData.dynamic = true;
      this.group.add(plane);
      this.mists.push({ tex, speed: 0.004 / sc });
    }
  }

  motes(min, max, count, color, size = 0.07, speed = 0.3) {
    const pts = this.effects.addMotes(new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max)), count, color, size, speed);
    (this.motePoints ??= []).push(pts);
  }

  hint(min, max, text) {
    this.hints.push({ min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), text, shown: false });
  }

  resetHints() {
    for (const h of this.hints) h.shown = false;
  }

  hintAt(p) {
    for (const h of this.hints) {
      if (h.shown) continue;
      if (p.x > h.min.x && p.x < h.max.x && p.y > h.min.y && p.y < h.max.y && p.z > h.min.z && p.z < h.max.z) {
        h.shown = true;
        return h.text;
      }
    }
    return null;
  }

  // ============================================================ mecânicas
  ownMat(m) {
    (this.ownMats ??= []).push(m);
    return m;
  }

  // Âncora do Gancho do Véu: segure E perto dela para balançar.
  anchor(x, y, z) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = this.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.2, 2.4) }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 28), mat);
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), mat);
    const halo = new THREE.Mesh(new THREE.RingGeometry(0.75, 0.82, 32), this.ownMat(new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.3, 0.9, 2), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    })));
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 40, 4), this.M.iron);
    chain.position.y = 20.5;
    const cap = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), this.M.rock);
    cap.position.y = 0.75;
    g.add(ring, core, halo, chain, cap);
    g.traverse((o) => { o.userData.dynamic = true; });
    this.group.add(g);
    const a = { pos: new THREE.Vector3(x, y, z), g, ring, core, halo, mat, hot: 0 };
    this.anchors.push(a);
    return a;
  }

  // Corrente de vento numa caixa: force = aceleração [x, y, z] (y > 26 levanta).
  wind(min, max, force) {
    const box = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    const f = new THREE.Vector3(...force);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const mat = this.ownMat(new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.25, 0.7, 0.8), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.DoubleSide,
    }));
    const vol = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
    vol.position.copy(center);
    vol.userData.dynamic = true;
    this.group.add(vol);
    if (f.y > 0) {
      const d = this.runeDecal(center.x, min[1] + 0.05, center.z, Math.min(size.x, size.z) * 0.9, -Math.PI / 2, 0, new THREE.Color(0.3, 1.6, 1.6), 0.7);
      d.userData.dynamic = true;
    }
    const w = { box, force: f, mat, rate: Math.min(60, size.x * size.y * size.z * 0.08) };
    this.winds.push(w);
    return w;
  }

  windAt(p) {
    let any = false;
    this.windVec.set(0, 0, 0);
    this.tmp.set(p.x, p.y + 0.9, p.z);
    for (const w of this.winds) {
      if (w.box.containsPoint(this.tmp)) {
        this.windVec.add(w.force);
        any = true;
      }
    }
    return any ? this.windVec : null;
  }

  // Plataforma de ritmo: existe só em parte do ciclo (on = fração sólida).
  phasePlatform(minX, minZ, maxX, maxZ, top, { period = 2.4, phase = 0, on = 0.5, thick = 0.6 } = {}) {
    const color = new THREE.Color(0.35, 0.95, 1.6);
    const mat = this.ownMat(new THREE.MeshStandardMaterial({
      color: 0x335a7a, roughness: 0.4, emissive: color, emissiveIntensity: 0.5, transparent: true, opacity: 0.92,
    }));
    const mesh = this.block(minX, top - thick, minZ, maxX, top, maxZ, mat, { collide: false, uv: 1.5 });
    mesh.userData.dynamic = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), this.ownMat(new THREE.LineBasicMaterial({ color: new THREE.Color(0.5, 1.4, 2.4), transparent: true })));
    mesh.add(edges);
    edges.userData.dynamic = true;
    const c = this.world.add(minX, top - thick, minZ, maxX, top, maxZ);
    c.noGrab = true;
    const p = { c, mesh, mat, edges, period, phase, on, solid: true, frac: 0 };
    this.phases.push(p);
    return p;
  }

  // Blocos que só existem num dos dois mundos (0 = real, 1 = Véu). F alterna.
  dimBlock(minX, minY, minZ, maxX, maxY, maxZ, d) {
    this.dimMats ??= {
      active: [this.M.wall, this.ownMat(new THREE.MeshStandardMaterial({
        color: 0x4a3a8a, roughness: 0.35, metalness: 0.1, emissive: new THREE.Color(0.55, 0.2, 1.3), emissiveIntensity: 0.55, flatShading: true,
      }))],
      ghost: [0, 1].map((i) => this.ownMat(new THREE.MeshBasicMaterial({
        color: i ? new THREE.Color(0.6, 0.25, 1.3) : new THREE.Color(0.45, 0.6, 1.0), transparent: true, opacity: 0.07,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }))),
      edge: [0, 1].map((i) => this.ownMat(new THREE.LineBasicMaterial({
        color: i ? new THREE.Color(1.4, 0.5, 2.6) : new THREE.Color(0.7, 1.0, 1.8), transparent: true, opacity: 0.5,
      }))),
    };
    const mesh = this.block(minX, minY, minZ, maxX, maxY, maxZ, this.dimMats.active[d], { collide: false, uv: 2 });
    mesh.userData.dynamic = true;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), this.dimMats.edge[d]);
    edges.userData.dynamic = true;
    mesh.add(edges);
    const c = this.world.add(minX, minY, minZ, maxX, maxY, maxZ);
    const o = { d, c, mesh, edges };
    this.dimObjs.push(o);
    return o;
  }

  dimPlatform(minX, minZ, maxX, maxZ, top, d, thick = 1.2) {
    return this.dimBlock(minX, top - thick, minZ, maxX, top, maxZ, d);
  }

  setDimension(d) {
    this.dim = d;
    for (const o of this.dimObjs) {
      const on = o.d === d;
      o.c.enabled = on;
      o.mesh.material = on ? this.dimMats.active[o.d] : this.dimMats.ghost[o.d];
      o.mesh.castShadow = on;
    }
    if (this.dimMats) {
      this.dimMats.edge[d].opacity = 0.35;
      this.dimMats.edge[1 - d].opacity = 0.9;
    }
  }

  get hasDimensions() {
    return this.dimObjs.length > 0;
  }

  // O jogador ficaria preso dentro de um bloco do outro mundo?
  dimBlocked(p, d, radius, height) {
    for (const o of this.dimObjs) {
      if (o.d !== d) continue;
      const c = o.c;
      if (c.maxY <= p.y + 0.05 || c.minY >= p.y + height) continue;
      if (p.x + radius > c.minX && p.x - radius < c.maxX && p.z + radius > c.minZ && p.z - radius < c.maxZ) return true;
    }
    return false;
  }

  // Portão de pedra que desce quando sua runa é tocada.
  gate(minX, minY, minZ, maxX, maxY, maxZ, id) {
    const mesh = this.block(minX, minY, minZ, maxX, maxY, maxZ, this.M.wallDark, { collide: false, uv: 1.5 });
    mesh.userData.dynamic = true;
    const glowMat = this.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.4) }));
    const w = maxX - minX;
    const d = maxZ - minZ;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(Math.max(w, d) * 0.8, 0.12, Math.min(w, d) + 0.04), glowMat);
    strip.rotation.y = w >= d ? 0 : Math.PI / 2;
    strip.position.y = (maxY - minY) * 0.25;
    strip.userData.dynamic = true;
    mesh.add(strip);
    const c = this.world.add(minX, minY, minZ, maxX, maxY, maxZ);
    c.noGrab = true;
    const g = { id, c, mesh, glowMat, base: mesh.position.clone(), min: new THREE.Vector3(minX, minY, minZ), h: maxY - minY + 0.1, open: 0, target: 0 };
    this.gates.push(g);
    this.dyn.push(c);
    return g;
  }

  // Runa que abre portões (duration > 0: eles voltam a fechar depois).
  rune(x, y, z, ids, duration = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const mat = this.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 0.4) }));
    const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), mat);
    glyph.scale.y = 1.6;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 30), mat);
    g.add(glyph, ring);
    g.traverse((o) => { o.userData.dynamic = true; });
    this.group.add(g);
    const r = { pos: new THREE.Vector3(x, y, z), g, glyph, ring, mat, ids: [].concat(ids), duration, lit: false, timer: 0 };
    this.runes.push(r);
    return r;
  }

  lightRune(r) {
    r.lit = true;
    r.timer = r.duration;
    for (const g of this.gates) if (r.ids.includes(g.id)) g.target = 1;
  }

  // Fragmento de memória (um por fase, opcional).
  memory(x, y, z) {
    const mat = this.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 1.2) }));
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
    mesh.scale.set(0.7, 1.5, 0.7);
    mesh.position.set(x, y, z);
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), this.ownMat(new THREE.MeshBasicMaterial({
      map: this.M.runeTex, color: new THREE.Color(1.4, 1.1, 0.6), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false,
    })));
    mesh.add(halo);
    const light = new THREE.PointLight(0xffd890, 6, 6, 2);
    mesh.add(light);
    mesh.traverse((o) => { o.userData.dynamic = true; });
    this.group.add(mesh);
    this.fragment = { pos: new THREE.Vector3(x, y, z), mesh, halo, mat, light, active: true };
    return this.fragment;
  }

  // A Sombra: um eco do andarilho que refaz o seu caminho com atraso.
  shadowChaser(delay = 2.4) {
    this.shadowDelay = delay;
  }

  // Barra corrompida na altura do peito: só deslizando por baixo.
  lowBar(x0, x1, top, z, path) {
    const m = this.blade(x0, top + 1.05, z - 0.18, x1, top + 2.3, z + 0.18, path);
    // barra larga: brilho mais contido para não estourar o bloom de perto
    this.lowBarMat ??= this.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.15, 0.12, 0.42) }));
    m.mesh.material = this.lowBarMat;
    if (!path) {
      this.block(x0 - 0.6, A, z - 0.35, x0, top + 3, z + 0.35, this.M.wall, { uv: 1.5 });
      this.block(x1, A, z - 0.35, x1 + 0.6, top + 3, z + 0.35, this.M.wall, { uv: 1.5 });
      const frame = this.block(x0 - 0.6, top + 2.3, z - 0.35, x1 + 0.6, top + 3, z + 0.35, this.M.trim, { uv: 1.5 });
      frame.userData.collider.noGrab = true;
    }
    return m;
  }

  // Passagem baixa de pedra: só cabe deslizando.
  crawl(minX, maxX, z0, z1, top) {
    this.block(minX, top + 1.0, Math.min(z0, z1), maxX, top + 4.5, Math.max(z0, z1), this.M.wall, { uv: 2 });
    const zf = Math.max(z0, z1) + 0.02;
    return this.block(minX + 0.2, top + 0.92, zf, maxX - 0.2, top + 1.0, zf + 0.06, this.M.runeSoft, { collide: false, cast: false });
  }

  // O Colosso: guardião gigante no fim do mundo (só cenário — os braços
  // são lâminas criadas pela fase).
  colossusAt(x, y, z, scale = 1) {
    const M = this.M;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(4, 9, 26, 10, 1, true), M.silhouette);
    robe.position.y = 13;
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 4.5, 8, 10), M.silhouetteFar);
    chest.position.y = 29;
    const head = new THREE.Group();
    head.position.y = 36;
    const hood = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 10), M.silhouette);
    hood.scale.set(1, 1.15, 1.1);
    const face = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), this.ownMat(new THREE.MeshBasicMaterial({ color: 0x020104, fog: false })));
    face.position.set(0, -0.3, 1.9);
    face.scale.set(1, 1.1, 0.6);
    const eyeMat = this.ownMat(new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 1.1), fog: false }));
    const eyeGeo = new THREE.SphereGeometry(0.45, 8, 6);
    const eyes = [-1.1, 1.1].map((ex) => {
      const e = new THREE.Mesh(eyeGeo, eyeMat);
      e.position.set(ex, 0, 3.6);
      e.scale.set(1.6, 0.6, 1);
      return e;
    });
    const horn = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7, 6), M.silhouette);
    horn.position.set(0, 3.8, -2.5);
    horn.rotation.x = -1.0;
    head.add(hood, face, ...eyes, horn);
    const light = new THREE.PointLight(0xff3080, 40, 60, 1.5);
    light.position.set(0, 0, 6);
    head.add(light);
    for (const s of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(4, 10, 8), M.silhouetteFar);
      sh.position.set(s * 7, 30, 0);
      sh.scale.set(1, 0.8, 1);
      g.add(sh);
    }
    g.add(robe, chest, head);
    g.traverse((o) => {
      o.userData.dynamic = true;
      if (o.isMesh) o.castShadow = false;
    });
    this.group.add(g);
    this.colossus = { g, head, eyeMat, light, baseY: y };
    return this.colossus;
  }

  resetMechanics() {
    for (const a of this.anchors) a.hot = 0;
    if (this.dimObjs.length) this.setDimension(0);
    for (const g of this.gates) {
      g.open = 0;
      g.target = 0;
      this.placeGate(g);
      g.c.beginFrame();
    }
    for (const r of this.runes) {
      r.lit = false;
      r.timer = 0;
    }
    if (this.fragment) {
      this.fragment.active = true;
      this.fragment.mesh.visible = true;
    }
    this.updateMechanics(0);
  }

  placeGate(g) {
    const c = g.c;
    const y = g.min.y - g.h * g.open;
    c.translate(0, y - c.minY, 0);
    g.mesh.position.y = g.base.y - g.h * g.open;
  }

  updateMechanics(dt) {
    for (const p of this.phases) {
      const f = (((this.time / p.period + p.phase) % 1) + 1) % 1;
      p.solid = f < p.on;
      p.frac = f;
      p.c.enabled = p.solid;
    }
    for (const r of this.runes) {
      if (r.lit && r.duration) {
        r.timer -= dt;
        if (r.timer <= 0) {
          r.lit = false;
          for (const g of this.gates) if (r.ids.includes(g.id)) g.target = 0;
        }
      }
    }
    const pl = this.playerRef;
    for (const g of this.gates) {
      if (g.open === g.target) continue;
      const next = g.target > g.open ? Math.min(1, g.open + dt * 2.2) : Math.max(0, g.open - dt * 1.6);
      if (next < g.open && pl) {
        // não fecha sobre o jogador
        const c = g.c;
        const top = g.min.y + g.h - 0.1 - g.h * next;
        if (pl.pos.x + 0.4 > c.minX && pl.pos.x - 0.4 < c.maxX && pl.pos.z + 0.4 > c.minZ && pl.pos.z - 0.4 < c.maxZ && pl.pos.y < top) continue;
      }
      g.open = next;
      this.placeGate(g);
    }
  }

  updateMechanicVisuals(dt, time) {
    for (const a of this.anchors) {
      a.ring.rotation.y = time * 1.5;
      a.ring.rotation.x = Math.sin(time * 0.7) * 0.4;
      a.core.rotation.y = -time * 2;
      const k = 1 + a.hot * 1.2 + Math.sin(time * 4) * 0.1;
      a.mat.color.setRGB(0.4 * k, 1.2 * k, 2.4 * k);
      a.halo.material.opacity = a.hot * (0.6 + Math.sin(time * 10) * 0.2);
      a.halo.scale.setScalar(1 + Math.sin(time * 6) * 0.08);
      if (this.cameraPos) a.halo.lookAt(this.cameraPos);
    }
    for (const w of this.winds) {
      const n = w.rate * dt;
      const count = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0);
      const f = w.force;
      const fl = f.length() || 1;
      for (let i = 0; i < count; i++) {
        const b = w.box;
        this.effects.sparks(b.min.x + Math.random() * (b.max.x - b.min.x), b.min.y + Math.random() * (b.max.y - b.min.y),
          b.min.z + Math.random() * (b.max.z - b.min.z), 1,
          { speed: 0.3, life: 0.9, size: 0.09, gravity: 0, drag: 0, vx: (f.x / fl) * 9, vy: (f.y / fl) * 9, vz: (f.z / fl) * 9, color: WIND_COLOR, whiteChance: 0.3 });
      }
    }
    for (const p of this.phases) {
      // pisca antes de sumir
      const left = (p.on - p.frac) * p.period;
      const warn = p.solid && left < 0.45 ? (Math.sin(time * 40) > 0 ? 0.35 : 1) : 1;
      p.mat.opacity = p.solid ? 0.92 * warn : 0.1;
      p.mat.emissiveIntensity = p.solid ? 0.6 * warn : 0.2;
      p.edges.material.opacity = p.solid ? 0.9 : 0.35;
      p.mesh.castShadow = p.solid;
    }
    for (const r of this.runes) {
      r.glyph.rotation.y = time * (r.lit ? 4 : 1.2);
      r.ring.rotation.x = Math.PI / 2;
      r.ring.rotation.z = time * 0.8;
      const k = r.lit ? 1.6 : 0.8 + Math.sin(time * 3) * 0.2;
      if (r.lit) r.mat.color.setRGB(0.6 * k, 2.0 * k, 1.2 * k);
      else r.mat.color.setRGB(2.2 * k, 1.4 * k, 0.4 * k);
      r.ring.scale.setScalar(r.lit && r.duration ? 0.4 + 0.6 * (r.timer / r.duration) : 1);
    }
    for (const g of this.gates) {
      const k = 1 - g.open;
      g.glowMat.color.setRGB(2.2 * k + 0.2, 1.4 * k + 0.2, 0.4 * k + 0.2);
    }
    const f = this.fragment;
    if (f && f.active) {
      f.mesh.position.y = f.pos.y + Math.sin(time * 2) * 0.2;
      f.mesh.rotation.y = time * 1.5;
      f.halo.rotation.z = -time;
      const dim = this.fragmentTaken ? 0.35 : 1;
      f.mat.color.setRGB(2.4 * dim, 2.0 * dim, 1.2 * dim);
      f.light.intensity = 6 * dim;
      if (Math.random() < dt * 8 * dim) {
        this.effects.sparks(f.pos.x, f.mesh.position.y, f.pos.z, 1, { speed: 0.4, life: 1.2, gravity: -0.8, size: 0.08, color: FRAG_COLOR, whiteChance: 0.4 });
      }
    }
    const col = this.colossus;
    if (col) {
      const pl = this.playerRef;
      if (pl) {
        const hp = col.g.position;
        const want = Math.atan2(pl.pos.x - hp.x, pl.pos.z - hp.z);
        col.head.rotation.y += (THREE.MathUtils.clamp(want, -0.8, 0.8) - col.head.rotation.y) * (1 - Math.exp(-2 * dt));
      }
      const k = 1 + Math.sin(time * 2.5) * 0.25;
      col.eyeMat.color.setRGB(3 * k, 0.4 * k, 1.1 * k);
      col.light.intensity = 40 * k;
      col.g.position.y = col.baseY + Math.sin(time * 0.9) * 0.4;
    }
  }

  // ============================================================ ciclo
  reset() {
    this.time = 0;
    for (const cp of this.checkpoints) {
      cp.active = false;
      cp.brazier.active = false;
      cp.decal.material.opacity = 0.25;
    }
    for (const vb of this.veilBarriers) {
      vb.collider.enabled = true;
      vb.mat.uniforms.uOpacity.value = 1;
      vb.mesh.visible = true;
      vb.flash = 0;
    }
    const a = this.artifact;
    if (a) {
      a.collected = false;
      a.group.position.copy(a.home);
      a.group.scale.setScalar(1);
      a.group.visible = true;
      a.beam.material.opacity = 0.09;
    }
    for (const m of this.movers) this.placeMover(m, true);
    for (const L of this.lanes) this.resetLane(L);
    this.resetCrumbles();
    for (const o of this.orbs) {
      o.active = true;
      o.mesh.visible = true;
    }
    for (const r of this.rings) r.cd = 0;
    for (const c of this.dyn) {
      c.beginFrame();
      c.vx = c.vy = c.vz = 0;
      c.jolt = null;
    }
    for (const L of this.lanes) this.drawLane(L);
    this.resetHints();
    this.resetMechanics();
  }

  // Avança o mundo. Os colisores móveis registram deslocamento e velocidade
  // antes do jogador se mover, para que ele seja carregado no mesmo quadro.
  update(dt, time) {
    this.time += dt;
    for (const c of this.dyn) {
      c.beginFrame();
      c.jolt = null;
    }
    for (const m of this.movers) this.placeMover(m, false);
    for (const L of this.lanes) this.updateLane(L, dt);
    this.updateCrumbles(dt);
    this.updateMechanics(dt);
    for (const c of this.dyn) c.endFrame(dt);
    for (const L of this.lanes) this.drawLane(L);
    this.updateVisuals(dt, time);
  }

  updateVisuals(dt, time) {
    for (const vb of this.veilBarriers) {
      vb.flash = Math.max(0, vb.flash - dt * 2);
      vb.mat.uniforms.uTime.value = time;
      vb.mat.uniforms.uFlash.value = vb.flash;
      if (vb.light) vb.light.intensity = (vb.collider.enabled ? 12 : 0) + Math.sin(time * 3) * 2 + vb.flash * 12;
      if (vb.collider.enabled && Math.random() < dt * 8) {
        this.effects.sparks(vb.x + (Math.random() - 0.5) * 2, vb.y + (Math.random() - 0.5) * 3, vb.z, 1, { speed: 0.4, life: 1.5, gravity: -0.6, size: 0.08 });
      }
    }
    for (const b of this.flames) {
      const f = 0.85 + Math.sin(time * 13 + b.seed) * 0.08 + Math.sin(time * 7.3 + b.seed * 2) * 0.07;
      const s = b.active ? 1 : 0.35;
      b.outer.scale.set(s * f, s * (f + 0.15), s * f);
      b.inner.scale.set(s * 0.55, s * 0.55 * f, s * 0.55);
      b.outer.rotation.y = time * 2;
      b.light.intensity = b.active ? 22 * f : 2.5;
      if (b.active && Math.random() < dt * 10) {
        const p = b.group.position;
        this.effects.sparks(p.x, p.y + 1.7, p.z, 1, { speed: 0.6, life: 1, gravity: -1.5, size: 0.08, spread: 0.3 });
      }
    }
    for (const fl of this.floaters) {
      fl.mesh.position.y = fl.baseY + Math.sin(time * fl.speed + fl.seed) * fl.amp;
      fl.mesh.rotation.y += fl.spin * dt;
    }
    for (const m of this.mists) {
      m.tex.offset.x += m.speed * dt * 10;
      m.tex.offset.y += m.speed * dt * 4;
    }
    for (const h of this.hazards) {
      if (h.surge) {
        h.surge.mat.uniforms.uTime.value = time;
        if (Math.random() < dt * 30) {
          const c = h.c;
          const x = c.minX + Math.random() * (c.maxX - c.minX);
          if (h.surge.horizontal) this.effects.sparks(x, c.maxY, c.minZ + Math.random() * (c.maxZ - c.minZ), 1, { speed: 1.5, life: 1, gravity: -2, size: 0.18, color: SURGE_COLOR, whiteChance: 0 });
          else this.effects.sparks(x, c.minY + Math.random() * (c.maxY - c.minY), c.minZ, 1, { speed: 2, life: 0.8, size: 0.18, vz: -3, color: SURGE_COLOR, whiteChance: 0 });
        }
      } else if (Math.random() < dt * 6) {
        const c = h.c;
        this.effects.sparks((c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2, (c.minZ + c.maxZ) / 2, 1,
          { speed: 1.2, life: 0.6, size: 0.12, spread: Math.min(2, c.maxX - c.minX), color: SURGE_COLOR, whiteChance: 0.1 });
      }
    }
    for (const p of this.pads) {
      p.pulse = Math.max(0, p.pulse - dt * 2.5);
      const k = 0.55 + 0.25 * Math.sin(time * 5) + p.pulse;
      p.mat.color.setRGB(0.3 * k, 1.0 * k, 1.6 * k);
      p.disc.scale.setScalar(1 + p.pulse * 0.4);
    }
    for (const r of this.rings) {
      r.cd = Math.max(0, r.cd - dt);
      r.inner.rotation.z = time * 2;
      const k = 1 + 0.25 * Math.sin(time * 6) + r.cd * 2;
      r.mat.color.setRGB(1.4 * k, 1.1 * k, 0.35 * k);
    }
    for (const o of this.orbs) {
      if (!o.active) {
        o.t += dt;
        if (o.t > 2.2) {
          o.active = true;
          o.mesh.visible = true;
        }
      }
      o.mesh.position.y = o.pos.y + Math.sin(time * 3 + o.pos.z) * 0.15;
      o.mesh.rotation.y = time * 2;
      o.shell.rotation.x = time * 1.3;
    }
    if (this.goal) {
      this.goal.mat.uniforms.uTime.value = time;
      this.goal.ring.rotation.z = time * 0.5;
      this.goal.light.intensity = 22 + Math.sin(time * 4) * 6;
      if (Math.random() < dt * 20) {
        const p = this.goal.pos;
        const a = Math.random() * Math.PI * 2;
        this.effects.sparks(p.x + Math.cos(a) * 1.6, p.y + 1.9 + Math.sin(a) * 1.6, p.z, 1, { speed: 0.5, life: 1.2, gravity: -1.2, size: 0.1 });
      }
    }
    this.updateMechanicVisuals(dt, time);
    const a = this.artifact;
    if (a && !a.collected) {
      a.group.position.y = a.home.y + Math.sin(time * 1.6) * 0.12;
      a.crystal.rotation.y = time * 0.8;
      a.core.rotation.y = -time * 1.6;
      a.rings[0].rotation.z = time * 0.7;
      a.rings[1].rotation.z = -time * 0.5;
      a.shards.forEach((s, i) => {
        const ang = time * 1.3 + (i * Math.PI) / 2;
        s.position.set(Math.cos(ang) * 0.65, Math.sin(time * 2 + i) * 0.25, Math.sin(ang) * 0.65);
        s.rotation.x = time * 2 + i;
      });
      a.light.intensity = 28 + Math.sin(time * 2.4) * 6;
      if (Math.random() < dt * 14) {
        const p = a.group.position;
        this.effects.sparks(p.x + (Math.random() - 0.5) * 1.5, p.y - 1, p.z + (Math.random() - 0.5) * 1.5, 1,
          { speed: 0.3, life: 2, gravity: -0.9, size: 0.09 });
      }
    }
  }

  // Anéis, cristais e o portal. Retorna a lista de eventos do quadro.
  triggers(player, veil) {
    const events = [];
    const px = player.pos.x;
    const py = player.pos.y + 0.9;
    const pz = player.pos.z;
    for (const r of this.rings) {
      if (r.cd > 0) continue;
      if (Math.hypot(px - r.pos.x, py - r.pos.y, pz - r.pos.z) < 1.75) {
        r.cd = 0.6;
        player.boost(r.dir.x, r.dir.y, r.dir.z, r.speed);
        veil.cooldown = 0;
        events.push({ type: 'ring', pos: r.pos });
      }
    }
    for (const o of this.orbs) {
      if (!o.active) continue;
      if (Math.hypot(px - o.pos.x, py - o.mesh.position.y, pz - o.pos.z) < 1.35 && (player.airDashUsed || veil.cooldown > 0.05)) {
        o.active = false;
        o.t = 0;
        o.mesh.visible = false;
        player.airDashUsed = false;
        veil.cooldown = 0;
        events.push({ type: 'orb', pos: o.pos });
      }
    }
    for (const r of this.runes) {
      if (r.lit && !r.duration) continue;
      if (Math.hypot(px - r.pos.x, py - r.pos.y, pz - r.pos.z) < 1.7 && (!r.lit || r.timer < r.duration - 0.5)) {
        this.lightRune(r);
        events.push({ type: 'rune', pos: r.pos, duration: r.duration });
      }
    }
    const f = this.fragment;
    if (f && f.active && Math.hypot(px - f.pos.x, py - f.mesh.position.y, pz - f.pos.z) < 1.5) {
      f.active = false;
      f.mesh.visible = false;
      events.push({ type: 'fragment', pos: f.pos });
    }
    if (this.goal) {
      const g = this.goal.pos;
      if (Math.hypot(px - g.x, pz - g.z) < 1.8 && player.pos.y > g.y - 0.6 && player.pos.y < g.y + 3) events.push({ type: 'goal' });
    }
    return events;
  }

  artifactReachable(p) {
    const a = this.artifact;
    if (!a || a.collected) return false;
    const dx = p.x - a.home.x;
    const dz = p.z - a.home.z;
    return Math.hypot(dx, dz) < 1.9 && p.y > 0.3 && p.y < 3;
  }

  dispose() {
    this.scene.remove(this.group);
    for (const mat of this.ownMats ?? []) mat.dispose();
    const shared = new Set(Object.values(this.M).filter((m) => m && m.isMaterial));
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        if (shared.has(m)) continue;
        if (m.map && m.map !== this.M.runeTex) m.map.dispose();
        m.dispose();
      }
    });
    for (const p of this.motePoints ?? []) this.effects.removeMotes(p);
  }
}

const SURGE_COLOR = new THREE.Color(2.2, 0.3, 0.8);
const WIND_COLOR = new THREE.Color(0.5, 1.6, 1.5);
const FRAG_COLOR = new THREE.Color(2.2, 1.7, 0.8);
