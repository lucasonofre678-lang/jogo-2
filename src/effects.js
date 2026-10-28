// Efeitos visuais: partículas (magia e poeira), imagens residuais do Passo do
// Véu, anéis de eco e partículas ambientes flutuantes.
import * as THREE from 'three';

const PARTICLE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const PARTICLE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float a = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

class ParticlePool {
  constructor(scene, max, blending, scaleUniform) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.gravity = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.cursor = 0;
    this.awake = false; // há partículas vivas (ou zeros a enviar)?

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.colAttr = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    this.alphaAttr = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aColor', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setAttribute('aAlpha', this.alphaAttr);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: scaleUniform },
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    this.points.visible = false;
    scene.add(this.points);
  }

  spawn(x, y, z, vx, vy, vz, o) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.max;
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = vx;
    this.vel[i3 + 1] = vy;
    this.vel[i3 + 2] = vz;
    const c = o.color;
    this.col[i3] = c.r;
    this.col[i3 + 1] = c.g;
    this.col[i3 + 2] = c.b;
    this.life[i] = this.maxLife[i] = o.life;
    this.size0[i] = o.size;
    this.size1[i] = o.sizeEnd ?? o.size * 0.2;
    this.alpha0[i] = o.alpha ?? 1;
    this.gravity[i] = o.gravity ?? 0;
    this.drag[i] = o.drag ?? 1;
    this.awake = true;
    this.colAttr.needsUpdate = true;
  }

  update(dt) {
    if (!this.awake) return;
    let alive = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      alive++;
      this.life[i] -= dt;
      const t = 1 - Math.max(this.life[i], 0) / this.maxLife[i];
      const i3 = i * 3;
      const damp = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= damp;
      this.vel[i3 + 1] = this.vel[i3 + 1] * damp - this.gravity[i] * dt;
      this.vel[i3 + 2] *= damp;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      this.size[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alpha[i] = this.alpha0[i] * (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85);
    }
    this.posAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.alphaAttr.needsUpdate = true;
    this.points.visible = alive > 0;
    this.awake = alive > 0;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.points.visible = false;
    this.awake = false;
  }
}

// Esfera do eco: só a borda brilha (efeito fresnel).
const SHELL_VERT = /* glsl */ `
  varying float vRim;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vRim = 1.0 - abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }
`;
const SHELL_FRAG = /* glsl */ `
  uniform vec3 color;
  uniform float opacity;
  varying float vRim;
  void main() {
    gl_FragColor = vec4(color, pow(vRim, 4.0) * opacity);
  }
`;

const VEIL_BLUE = new THREE.Color(0.35, 0.75, 2.2);
const VEIL_WHITE = new THREE.Color(1.4, 1.9, 2.6);
const DUST = new THREE.Color(0.42, 0.45, 0.52);
const GHOST_LIFE = 0.42;
// cor de cada cópia do rastro no início (já com a antiga opacidade de 0,32)
const GHOST_COLOR = new THREE.Color(0.2, 0.48, 1.35).multiplyScalar(0.32);
const GHOST_DARK = new THREE.Color(0, 0, 0);

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.scaleUniform = { value: 600 };
    this.magic = new ParticlePool(scene, 2400, THREE.AdditiveBlending, this.scaleUniform);
    this.dustPool = new ParticlePool(scene, 700, THREE.NormalBlending, this.scaleUniform);
    this.ghostParts = [];
    this.ghostLife = [];
    this.ghostCursor = 0;
    this.ghostsAlive = false;
    this.rings = [];
    this.motes = [];
    this.tmpColor = new THREE.Color();

    const ringGeo = new THREE.RingGeometry(0.92, 1, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const shellGeo = new THREE.SphereGeometry(1, 32, 16);
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: VEIL_BLUE, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
        depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
      });
      const ring = new THREE.Mesh(ringGeo, mat);
      const shellMat = new THREE.ShaderMaterial({
        uniforms: { color: { value: VEIL_BLUE.clone() }, opacity: { value: 0 } },
        vertexShader: SHELL_VERT,
        fragmentShader: SHELL_FRAG,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, forceSinglePass: true,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      ring.visible = shell.visible = false;
      scene.add(ring, shell);
      this.rings.push({ ring, shell, life: 0, max: 1, radius: 1 });
    }
  }

  setViewport(height, fov) {
    this.scaleUniform.value = (height * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  }

  // Imagens residuais azuis do andarilho: uma InstancedMesh por peça do
  // corpo, cada cópia é uma instância. O rastro inteiro custa uma chamada de
  // desenho por peça, não uma por peça de cada cópia.
  initGhosts(source, count = 14) {
    this.ghostSource = source;
    this.ghostCount = count;
    this.ghostMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.ghostGroup = new THREE.Group();
    this.ghostGroup.visible = false;
    this.scene.add(this.ghostGroup);
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
    source.traverse((o) => {
      if (!o.isMesh) return;
      const im = new THREE.InstancedMesh(o.geometry, this.ghostMat, count);
      im.frustumCulled = false;
      im.matrixAutoUpdate = false;
      for (let i = 0; i < count; i++) {
        im.setMatrixAt(i, hidden);
        im.setColorAt(i, GHOST_DARK);
      }
      this.ghostGroup.add(im);
      this.ghostParts.push({ src: o, im });
    });
    this.ghostLife = new Float32Array(count);
    this.ghostHidden = hidden;
  }

  ghost() {
    if (!this.ghostParts.length) return;
    const slot = this.ghostCursor;
    this.ghostCursor = (this.ghostCursor + 1) % this.ghostCount;
    const root = this.ghostSource;
    root.updateMatrixWorld(true);
    for (const { src, im } of this.ghostParts) {
      // a peça aparece se ela e os pais estão visíveis (o corpo inteiro pode
      // estar oculto na primeira pessoa: o rastro aparece mesmo assim)
      let vis = true;
      for (let q = src; q && q !== root; q = q.parent) if (!q.visible) vis = false;
      im.setMatrixAt(slot, vis ? src.matrixWorld : this.ghostHidden);
      im.instanceMatrix.needsUpdate = true;
    }
    this.ghostLife[slot] = GHOST_LIFE;
    this.ghostsAlive = true;
    this.ghostGroup.visible = true;
  }

  ring(x, y, z, radius, duration = 0.9, color = VEIL_BLUE, withShell = true) {
    const r = this.rings.find((q) => q.life <= 0) ?? this.rings[0];
    r.ring.position.set(x, y + 0.05, z);
    r.shell.position.set(x, y + 1, z);
    r.ring.material.color.copy(color);
    r.shell.material.uniforms.color.value.copy(color);
    r.ring.visible = true;
    r.shell.visible = withShell;
    r.life = r.max = duration;
    r.radius = radius;
  }

  sparks(x, y, z, count, opts = {}) {
    const spread = opts.spread ?? 0.4;
    const speed = opts.speed ?? 2;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 2 - 1;
      const s = Math.sqrt(1 - u * u);
      const v = speed * (0.4 + Math.random() * 0.8);
      this.magic.spawn(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread,
        z + (Math.random() - 0.5) * spread,
        Math.cos(a) * s * v + (opts.vx ?? 0),
        u * v + (opts.vy ?? 0),
        Math.sin(a) * s * v + (opts.vz ?? 0),
        {
          color: Math.random() < (opts.whiteChance ?? 0.25) ? VEIL_WHITE : opts.color ?? VEIL_BLUE,
          life: (opts.life ?? 0.8) * (0.6 + Math.random() * 0.6),
          size: (opts.size ?? 0.12) * (0.6 + Math.random() * 0.8),
          sizeEnd: 0.01,
          gravity: opts.gravity ?? -0.5,
          drag: opts.drag ?? 2,
          alpha: opts.alpha ?? 1,
        },
      );
    }
  }

  dust(x, y, z, count, power = 1) {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const v = (1.5 + Math.random() * 2) * power;
      this.dustPool.spawn(x + Math.cos(a) * 0.25, y + 0.08, z + Math.sin(a) * 0.25,
        Math.cos(a) * v, 0.4 + Math.random() * 0.8 * power, Math.sin(a) * v, {
          color: DUST, life: 0.55 + Math.random() * 0.4, size: 0.28, sizeEnd: 0.6,
          gravity: 0.6, drag: 4, alpha: 0.45,
        });
    }
  }

  // Partículas ambientes animadas na GPU (pouco custo de CPU).
  addMotes(box, count, color, size = 0.09, speed = 0.25) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = box.min.x + Math.random() * (box.max.x - box.min.x);
      pos[i * 3 + 1] = box.min.y + Math.random() * (box.max.y - box.min.y);
      pos[i * 3 + 2] = box.min.z + Math.random() * (box.max.z - box.min.z);
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uScale: this.scaleUniform,
        uColor: { value: color },
        uSize: { value: size },
        uSpeed: { value: speed },
        uHeight: { value: box.max.y - box.min.y },
        uBaseY: { value: box.min.y },
      },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime, uScale, uSize, uSpeed, uHeight, uBaseY;
        varying float vA;
        void main() {
          vec3 p = position;
          float t = uTime * uSpeed * (0.5 + aSeed);
          p.y = uBaseY + mod(p.y - uBaseY + t, uHeight);
          p.x += sin(t * 1.3 + aSeed * 30.0) * 0.6;
          p.z += cos(t * 1.1 + aSeed * 17.0) * 0.6;
          float edge = smoothstep(0.0, 0.15, (p.y - uBaseY) / uHeight) * smoothstep(1.0, 0.8, (p.y - uBaseY) / uHeight);
          vA = edge * (0.45 + 0.55 * sin(uTime * 2.0 + aSeed * 50.0));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float r = length(gl_PointCoord - 0.5);
          if (r > 0.5) discard;
          gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, r) * vA);
        }
      `,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    this.motes.push(mat);
    return points;
  }

  // O material não é descartado: o shader das partículas fica no cache e a
  // próxima fase não recompila.
  removeMotes(points) {
    this.scene.remove(points);
    points.geometry.dispose();
    this.motes = this.motes.filter((m) => m !== points.material);
  }

  update(dt, time) {
    this.magic.update(dt);
    this.dustPool.update(dt);
    for (const m of this.motes) m.uniforms.uTime.value = time;

    if (this.ghostsAlive) this.updateGhosts(dt);

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - Math.max(r.life, 0) / r.max;
      const e = 1 - Math.pow(1 - t, 3);
      const s = 0.3 + e * r.radius;
      r.ring.scale.set(s, 1, s);
      r.shell.scale.setScalar(s * 0.6);
      r.ring.material.opacity = (1 - t) * 0.6;
      r.shell.material.uniforms.opacity.value = (1 - t) * 0.35;
      if (r.life <= 0) r.ring.visible = r.shell.visible = false;
    }
  }

  // Esmaece cada cópia pela cor da instância (com mistura aditiva, cor mais
  // escura = mais transparente).
  updateGhosts(dt) {
    let alive = 0;
    const c = this.tmpColor;
    for (let i = 0; i < this.ghostCount; i++) {
      if (this.ghostLife[i] <= 0) continue;
      this.ghostLife[i] -= dt;
      const k = Math.max(0, this.ghostLife[i] / GHOST_LIFE);
      if (this.ghostLife[i] > 0) alive++;
      c.copy(GHOST_COLOR).multiplyScalar(k);
      for (const { im } of this.ghostParts) im.setColorAt(i, c);
    }
    for (const { im } of this.ghostParts) im.instanceColor.needsUpdate = true;
    this.ghostsAlive = alive > 0;
    if (!alive) this.ghostGroup.visible = false;
  }

  clear() {
    this.magic.clear();
    this.dustPool.clear();
    if (this.ghostParts.length) {
      this.ghostLife.fill(0);
      this.ghostsAlive = false;
      this.ghostGroup.visible = false;
    }
    for (const r of this.rings) {
      r.life = 0;
      r.ring.visible = r.shell.visible = false;
    }
  }
}
