// O Andarilho: controlador em terceira pessoa feito para velocidade.
//   corrida como padrão (Shift anda, C se esgueira), salto variável, coyote
//   time, controle aéreo que preserva o momento, pulo na parede, agarrar e
//   escalar bordas, deslizar (C correndo), Gancho do Véu (balançar em
//   âncoras), correntes de vento, Passo do Véu (estado de avanço),
//   plataformas móveis que carregam o jogador (e o arremessam quando batem)
//   e trampolins.
// A velocidade do jogador é relativa à plataforma em que ele está de pé; ao
// sair dela, a velocidade da plataforma é somada (herança de momento).
import * as THREE from 'three';
import { PhysicsWorld, SOLID, VEIL, ALL } from './physics.js';
import { softTexture } from './materials.js';
import { SKINS } from './skins.js';

export const RADIUS = 0.35;
export const HEIGHT = 1.8;
export const SLIDE_HEIGHT = 0.95;
const STEP_UP = 0.42;

export const RUN = 9.5;
export const WALK = 5.0;
const SNEAK = 2.3;
const GRAVITY = 26;
const FALL_MULT = 1.25;
const JUMP_V = 9.2;
const JUMP_CUT = 0.5;
const MAX_FALL = 40;
const COYOTE = 0.12;
const JUMP_BUFFER = 0.14;

const AIR_ACCEL = 30;
const AIR_IDLE_DRAG = 0.6;
export const MAX_AIR_SPEED = 34;

const WALL_JUMP_UP = 8.8;
const WALL_JUMP_OUT = 8;
const WALL_SLIDE = 3.5;
const WALL_MEMORY = 0.14;

export const DASH_SPEED = 34;
export const DASH_TIME = 0.2;

const HANG_OFFSET = 1.62; // distância dos pés até a borda agarrada
const CLIMB_TIME = 0.42;

const SLIDE_MIN_SPEED = 6.5; // precisa estar correndo para deslizar
const SLIDE_BOOST = 3.5;
const SLIDE_MAX = 15;
const SLIDE_TIME = 0.75;

export const GRAPPLE_RANGE = 13;
const HAND_Y = 1.25; // altura da mão que segura a corda
const SWING_ACCEL = 12;
const SWING_REEL = 4;
const SWING_MIN_LEN = 3.5;
const SWING_MAX_SPEED = 30;
const SWING_RELEASE_UP = 5.5;

const WIND_MAX_UP = 13;
const ROLL_IMPACT = 17;
const ROLL_TIME = 0.42;
const BODY_PIVOT = 0.5; // centro de rotação do corpo (inclinação, rolamento)

function damp(a, b, k, dt) {
  return a + (b - a) * (1 - Math.exp(-k * dt));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Faixa de tecido simulada com Verlet (capa, pontas do cachecol): uma
// corrente de pontos presa a uma âncora no corpo, desenhada como uma tira.
class Ribbon {
  constructor(scene, anchor, mat, { segments, length, width, taper = 0, behind = 0.06, damping = 0.965, flutter = 0.02 }) {
    this.anchor = anchor;
    this.n = segments;
    this.seg = length / segments;
    this.width = width;
    this.taper = taper;
    this.behind = behind;
    this.damping = damping;
    this.flutter = flutter;
    this.pts = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
    this.prev = Array.from({ length: segments + 1 }, () => new THREE.Vector3());
    const rows = segments + 1;
    const pos = new Float32Array(rows * 3 * 3);
    const uv = new Float32Array(rows * 3 * 2);
    const idx = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < 3; j++) {
        uv[(i * 3 + j) * 2] = j / 2;
        uv[(i * 3 + j) * 2 + 1] = 1 - i / segments;
      }
      if (i < segments) {
        for (let j = 0; j < 2; j++) {
          const a = i * 3 + j;
          const b = a + 1;
          const c = a + 3;
          const d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    this.a = new THREE.Vector3();
    this.tmp = new THREE.Vector3();
    this.needsReset = true;
  }

  reset(fwd) {
    this.anchor.getWorldPosition(this.a);
    for (let i = 0; i <= this.n; i++) {
      this.pts[i].copy(this.a).addScaledVector(fwd, -0.04 * i);
      this.pts[i].y -= this.seg * i;
      this.prev[i].copy(this.pts[i]);
    }
    this.needsReset = false;
  }

  // fwd/right: direções do corpo no plano XZ; floorY: chão sob o jogador
  update(dt, fwd, right, floorY, time, speedK, wind) {
    if (this.needsReset) this.reset(fwd);
    this.anchor.getWorldPosition(this.a);
    const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
    const h = dt / steps;
    const g = -14 * h * h;
    for (let s = 0; s < steps; s++) {
      this.pts[0].copy(this.a);
      this.prev[0].copy(this.a);
      for (let i = 1; i <= this.n; i++) {
        const p = this.pts[i];
        const q = this.prev[i];
        const vx = (p.x - q.x) * this.damping;
        const vy = (p.y - q.y) * this.damping;
        const vz = (p.z - q.z) * this.damping;
        q.copy(p);
        p.x += vx + (wind ? wind.x * h * h * 0.6 : 0);
        p.y += vy + g + (wind ? wind.y * h * h * 0.4 : 0);
        p.z += vz + (wind ? wind.z * h * h * 0.6 : 0);
      }
      for (let it = 0; it < 3; it++) {
        for (let i = 1; i <= this.n; i++) {
          const a = this.pts[i - 1];
          const b = this.pts[i];
          const d = this.tmp.subVectors(b, a);
          const len = d.length() || 1e-6;
          d.multiplyScalar(this.seg / len);
          b.copy(a).add(d);
        }
      }
      for (let i = 1; i <= this.n; i++) {
        const p = this.pts[i];
        // mantém o tecido atrás do corpo e acima do chão
        const rx = p.x - this.a.x;
        const rz = p.z - this.a.z;
        const along = rx * fwd.x + rz * fwd.z;
        const limit = -this.behind - i * 0.012;
        if (along > limit) {
          p.x -= fwd.x * (along - limit);
          p.z -= fwd.z * (along - limit);
        }
        if (p.y < floorY + 0.03) p.y = floorY + 0.03;
      }
    }
    const pos = this.geo.attributes.position.array;
    for (let i = 0; i <= this.n; i++) {
      const p = this.pts[i];
      const w = (this.width * (1 - this.taper * (i / this.n))) / 2;
      const fl = Math.sin(time * 14 + i * 1.3) * this.flutter * speedK * (i / this.n);
      const o = i * 9;
      pos[o] = p.x - right.x * w;
      pos[o + 1] = p.y + fl;
      pos[o + 2] = p.z - right.z * w;
      pos[o + 3] = p.x - fwd.x * 0.03 * Math.min(1, i);
      pos[o + 4] = p.y - fl;
      pos[o + 5] = p.z - fwd.z * 0.03 * Math.min(1, i);
      pos[o + 6] = p.x + right.x * w;
      pos[o + 7] = p.y + fl;
      pos[o + 8] = p.z + right.z * w;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

// Textura da capa: tecido com runas brilhantes na barra (usada como mapa de
// emissão, então só as runas acendem).
function capeTextures() {
  const make = (glow) => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = glow ? '#000' : '#fff';
    x.fillRect(0, 0, 64, 256);
    if (!glow) {
      for (let i = 0; i < 400; i++) {
        x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`;
        x.fillRect(Math.random() * 64, Math.random() * 256, 1 + Math.random() * 2, 4 + Math.random() * 10);
      }
    }
    // barra rúnica perto da ponta
    x.fillStyle = glow ? '#fff' : '#bbb';
    x.fillRect(0, 222, 64, 3);
    x.fillRect(0, 248, 64, 3);
    x.strokeStyle = glow ? '#fff' : '#ccc';
    x.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const cx = 8 + i * 16;
      x.beginPath();
      x.moveTo(cx, 228);
      x.lineTo(cx + 5, 236);
      x.lineTo(cx, 244);
      x.lineTo(cx - 5, 236);
      x.closePath();
      x.stroke();
    }
    // runa grande no meio da capa
    x.beginPath();
    x.moveTo(32, 90);
    x.lineTo(42, 120);
    x.lineTo(32, 150);
    x.lineTo(22, 120);
    x.closePath();
    x.moveTo(32, 104);
    x.lineTo(32, 136);
    x.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = glow ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    return t;
  };
  return { map: make(false), glow: make(true) };
}

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.state = 'normal'; // normal | hang | climb | dash | slide | swing
    this.height = HEIGHT;
    this.grounded = false;
    this.prevGrounded = false;
    this.groundCol = null;
    this.bounceCol = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumping = false;
    this.jumpCut = false;
    this.airSpeedCap = 0;
    this.airDashUsed = false;
    this.grabCooldown = 0;
    this.sneaking = false;
    this.sprinting = false;
    this.dashing = false;
    this.dashDir = new THREE.Vector3();
    this.dashCarry = new THREE.Vector3();
    this.dashExit = RUN;
    this.dashTime = 0;
    this.dashExtra = 0;
    this.wallTimer = 0;
    this.wallNx = 0;
    this.wallNz = 0;
    this.lastWallNx = 0;
    this.lastWallNz = 0;
    this.wallLock = 0;
    this.wallSliding = false;
    this.hang = { top: 0, nx: 0, nz: 0, push: 0, time: 0, col: null };
    this.climb = { from: new THREE.Vector3(), to: new THREE.Vector3(), t: 0 };
    this.slide = { t: 0, speed: 0, dir: new THREE.Vector3() };
    this.swing = { anchor: null, len: 0 };
    this.anchors = [];
    this.wind = null;
    this.impactSpeed = 0;
    this.fallStartY = 0;
    this.roll = 0;
    this.celebrate = false;
    this.veilCharge = 1;

    this.facing = 0;
    this.stepPhase = 0;
    this.lastStepIndex = 0;
    this.landSquash = 0;
    this.time = 0;
    this.fwd = new THREE.Vector3();
    this.rightV = new THREE.Vector3();
    this.tmpV = new THREE.Vector3();

    // Callbacks configurados pelo jogo.
    this.onJump = null;
    this.onLand = null;
    this.onStep = null;
    this.onGrab = null;
    this.onClimb = null;
    this.onWallJump = null;
    this.onBounce = null;
    this.onJolt = null;
    this.onSlide = null;
    this.onGrapple = null;
    this.onRelease = null;
    this.onRoll = null;

    this.buildModel(scene);
    this.setSkin(SKINS[0]);
  }

  // ------------------------------------------------------------------ modelo
  buildModel(scene) {
    const cloakMat = new THREE.MeshStandardMaterial({
      color: 0x262b3a, roughness: 0.88, flatShading: true, side: THREE.DoubleSide,
      emissive: new THREE.Color(0.2, 0.5, 1.4), emissiveIntensity: 0,
    });
    const innerMat = new THREE.MeshStandardMaterial({ color: 0x14161e, roughness: 1, flatShading: true, side: THREE.DoubleSide });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.75, flatShading: true });
    const trimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.8, 2.4) });
    const voidMat = new THREE.MeshBasicMaterial({ color: 0x010103 });
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.8, 4.2) });
    const tex = capeTextures();
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x262b3a, roughness: 0.9, side: THREE.DoubleSide, map: tex.map,
      emissive: new THREE.Color(0.3, 0.8, 2.4), emissiveMap: tex.glow, emissiveIntensity: 0.6,
    });
    const scarfMat = new THREE.MeshStandardMaterial({
      color: 0x262b3a, roughness: 0.8, side: THREE.DoubleSide,
      emissive: new THREE.Color(0.3, 0.8, 2.4), emissiveIntensity: 0.25,
    });
    this.cloakMat = cloakMat;
    this.innerMat = innerMat;
    this.leatherMat = leatherMat;
    this.trimMat = trimMat;
    this.eyeMat = eyeMat;
    this.capeMat = capeMat;
    this.scarfMat = scarfMat;

    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const mesh = (geo, mat, x = 0, y = 0, z = 0, parent = body, shadow = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      parent.add(m);
      return m;
    };

    // Pernas: coxa (pivô no quadril) e canela (pivô no joelho)
    const thighGeo = new THREE.CapsuleGeometry(0.078, 0.24, 3, 8);
    thighGeo.translate(0, -0.18, 0);
    const shinGeo = new THREE.CapsuleGeometry(0.068, 0.22, 3, 8);
    shinGeo.translate(0, -0.16, 0);
    const bootGeo = new THREE.BoxGeometry(0.15, 0.12, 0.27);
    bootGeo.translate(0, -0.32, 0.045);
    const wrapGeo = new THREE.CylinderGeometry(0.075, 0.08, 0.1, 8);
    wrapGeo.translate(0, -0.22, 0);
    this.legL = new THREE.Group();
    this.legR = new THREE.Group();
    this.kneeL = new THREE.Group();
    this.kneeR = new THREE.Group();
    this.legL.position.set(-0.11, 0.72, 0);
    this.legR.position.set(0.11, 0.72, 0);
    for (const [leg, knee] of [[this.legL, this.kneeL], [this.legR, this.kneeR]]) {
      mesh(thighGeo, innerMat, 0, 0, 0, leg);
      knee.position.y = -0.36;
      leg.add(knee);
      mesh(shinGeo, innerMat, 0, 0, 0, knee);
      mesh(wrapGeo, leatherMat, 0, 0, 0, knee);
      mesh(bootGeo, leatherMat, 0, 0, 0, knee);
      body.add(leg);
    }

    // Manto: casaco longo com barra irregular (torno)
    const prof = [[0.42, 0.36], [0.36, 0.56], [0.29, 0.8], [0.24, 1.02], [0.27, 1.24], [0.25, 1.38], [0.16, 1.48]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const robeGeo = new THREE.LatheGeometry(prof, 14);
    const rp = robeGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      if (rp.getY(i) < 0.4) {
        const a = Math.atan2(rp.getZ(i), rp.getX(i));
        rp.setY(i, rp.getY(i) - (Math.sin(a * 5) * 0.5 + 0.5) * 0.1);
        // a frente do casaco é aberta para as pernas
        if (Math.sin(a) > 0.6) rp.setY(i, rp.getY(i) + 0.22);
      }
    }
    robeGeo.computeVertexNormals();
    mesh(robeGeo, cloakMat);
    // cinto com fivela rúnica
    const belt = mesh(new THREE.TorusGeometry(0.255, 0.035, 5, 20), leatherMat, 0, 1.02, 0);
    belt.rotation.x = Math.PI / 2;
    const buckle = mesh(new THREE.OctahedronGeometry(0.05), trimMat, 0, 1.02, 0.27, body, false);
    buckle.scale.set(1, 1.3, 0.5);
    // faixa rúnica descendo pela frente
    const strip = mesh(new THREE.BoxGeometry(0.035, 0.42, 0.01), trimMat, 0, 0.74, 0.32, body, false);
    strip.rotation.x = -0.16;
    // ombros: manto curto + ombreira
    const mantle = mesh(new THREE.ConeGeometry(0.37, 0.34, 10, 1, true), cloakMat, 0, 1.42, 0);
    mantle.rotation.y = 0.2;
    const pauldron = mesh(new THREE.SphereGeometry(0.13, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), leatherMat, -0.27, 1.42, 0);
    pauldron.scale.set(1.1, 0.8, 1.1);
    const stud = mesh(new THREE.OctahedronGeometry(0.03), trimMat, -0.3, 1.5, 0.05, body, false);
    stud.scale.y = 1.5;

    // Capuz pontudo, cara de vazio e olhos que brilham com o Véu
    // casca do capuz aberta na frente (o vazio do rosto aparece)
    const HOOD_GAP = 1.7;
    const hood = mesh(new THREE.SphereGeometry(0.25, 16, 10, Math.PI / 2 + HOOD_GAP / 2, Math.PI * 2 - HOOD_GAP), cloakMat, 0, 1.62, -0.02);
    hood.scale.set(1, 1.1, 1.1);
    const tip = mesh(new THREE.ConeGeometry(0.15, 0.42, 8), cloakMat, 0, 1.78, -0.2);
    tip.rotation.x = -1.15;
    const face = mesh(new THREE.SphereGeometry(0.19, 12, 9), voidMat, 0, 1.6, 0.03, body, false);
    face.scale.set(1, 1.12, 0.85);
    const eyeGeo = new THREE.SphereGeometry(0.026, 8, 6);
    mesh(eyeGeo, eyeMat, -0.062, 1.62, 0.188, body, false).scale.set(1.5, 0.7, 1);
    mesh(eyeGeo, eyeMat, 0.062, 1.62, 0.188, body, false).scale.set(1.5, 0.7, 1);

    // Braços: ombro → cotovelo → mão
    const upperGeo = new THREE.CapsuleGeometry(0.062, 0.2, 3, 8);
    upperGeo.translate(0, -0.15, 0);
    const foreGeo = new THREE.CapsuleGeometry(0.056, 0.18, 3, 8);
    foreGeo.translate(0, -0.13, 0);
    const bracerGeo = new THREE.CylinderGeometry(0.064, 0.07, 0.14, 8);
    bracerGeo.translate(0, -0.16, 0);
    const handGeo = new THREE.SphereGeometry(0.06, 8, 6);
    handGeo.translate(0, -0.3, 0);
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.elbowL = new THREE.Group();
    this.elbowR = new THREE.Group();
    this.armL.position.set(-0.29, 1.4, 0);
    this.armR.position.set(0.29, 1.4, 0);
    for (const [arm, elbow] of [[this.armL, this.elbowL], [this.armR, this.elbowR]]) {
      mesh(upperGeo, cloakMat, 0, 0, 0, arm);
      elbow.position.y = -0.3;
      arm.add(elbow);
      mesh(foreGeo, innerMat, 0, 0, 0, elbow);
      mesh(bracerGeo, leatherMat, 0, 0, 0, elbow);
      mesh(handGeo, leatherMat, 0, 0, 0, elbow);
      body.add(arm);
    }
    // Runa na mão direita (de onde sai o Gancho do Véu)
    mesh(new THREE.OctahedronGeometry(0.045), trimMat, 0, -0.34, 0.06, this.elbowR, false);
    this.handR = new THREE.Object3D();
    this.handR.position.set(0, -0.32, 0.02);
    this.elbowR.add(this.handR);

    // Âncoras da capa e do cachecol (tecido simulado fica fora do grupo)
    this.capeAnchor = new THREE.Object3D();
    this.capeAnchor.position.set(0, 1.44, -0.2);
    body.add(this.capeAnchor);
    this.scarfAnchors = [-0.07, 0.07].map((x) => {
      const o = new THREE.Object3D();
      o.position.set(x, 1.47, -0.17);
      body.add(o);
      return o;
    });

    this.root = root;
    this.body = body;
    for (const n of ['legL', 'legR', 'kneeL', 'kneeR', 'armL', 'armR', 'elbowL', 'elbowR']) this[n].name = n;
    scene.add(root);

    this.cape = new Ribbon(scene, this.capeAnchor, capeMat, { segments: 9, length: 1.05, width: 0.5, taper: -0.25, behind: 0.08, damping: 0.95, flutter: 0.03 });
    this.scarves = this.scarfAnchors.map((a, i) => new Ribbon(scene, a, scarfMat, {
      segments: 6, length: 0.55 + i * 0.12, width: 0.08, taper: 0.4, behind: 0.12, damping: 0.97, flutter: 0.05,
    }));
    this.cloth = [this.cape, ...this.scarves];

    // Corda do Gancho do Véu
    const ropeGeo = new THREE.BufferGeometry();
    ropeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    this.ropeMat = new THREE.LineBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.2), transparent: true, opacity: 0.9 });
    this.rope = new THREE.Line(ropeGeo, this.ropeMat);
    this.rope.frustumCulled = false;
    this.rope.visible = false;
    scene.add(this.rope);

    // Sombra circular sob o jogador (ajuda a calcular saltos).
    const blobMat = new THREE.MeshBasicMaterial({
      map: softTexture('rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), blobMat);
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.renderOrder = 2;
    scene.add(this.blob);
    this.blobMat = blobMat;
  }

  setSkin(skin) {
    this.skin = skin;
    this.cloakMat.color.set(skin.cloak);
    this.capeMat.color.set(skin.cloak);
    this.scarfMat.color.set(skin.cloak);
    this.innerMat.color.set(skin.inner);
    this.leatherMat.color.set(skin.leather);
    this.trimMat.color.setRGB(...skin.trim);
    this.capeMat.emissive.setRGB(...skin.trim).multiplyScalar(0.5);
    this.scarfMat.emissive.setRGB(...skin.trim).multiplyScalar(0.5);
    this.cloakMat.emissive.setRGB(...skin.trim).multiplyScalar(0.5);
    this.ropeMat.color.setRGB(...skin.trim).multiplyScalar(1.3);
    this.eyeBase = new THREE.Color(...skin.eye);
    this.eyeMat.color.copy(this.eyeBase);
  }

  // Mostra/esconde o andarilho inteiro (primeira pessoa, menus).
  setVisible(v) {
    this.root.visible = v;
    for (const r of this.cloth) r.mesh.visible = v;
    if (!v) this.rope.visible = false;
  }

  // ------------------------------------------------------------------ estado
  respawn(pos, yaw) {
    this.pos.copy(pos);
    this.vel.set(0, 0, 0);
    this.state = 'normal';
    this.height = HEIGHT;
    this.dashing = false;
    this.grounded = false;
    this.prevGrounded = false;
    this.groundCol = null;
    this.bounceCol = null;
    this.airDashUsed = false;
    this.airSpeedCap = 0;
    this.jumping = false;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.grabCooldown = 0;
    this.wallTimer = 0;
    this.wallLock = 0;
    this.lastWallNx = this.lastWallNz = 0;
    this.landSquash = 0;
    this.roll = 0;
    this.celebrate = false;
    this.swing.anchor = null;
    this.facing = yaw + Math.PI; // de costas para a câmera
    this.fallStartY = pos.y;
    this.cloakMat.emissiveIntensity = 0;
    for (const r of this.cloth) r.needsReset = true;
    this.body.rotation.x = 0;
    this.animate(0.016);
  }

  get horizontalSpeed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  // Velocidade em relação ao mundo (inclui a plataforma sob os pés).
  get worldSpeed() {
    const c = this.grounded ? this.groundCol : null;
    return Math.hypot(this.vel.x + (c ? c.vx : 0), this.vel.z + (c ? c.vz : 0));
  }

  get low() {
    return this.height < HEIGHT;
  }

  canDash() {
    if (this.state === 'hang' || this.state === 'climb' || this.state === 'dash') return false;
    return this.grounded || this.coyote > 0 || !this.airDashUsed || this.state === 'swing';
  }

  startDash(dir) {
    let cx = 0;
    let cz = 0;
    if (this.grounded && this.groundCol) {
      cx = this.groundCol.vx;
      cz = this.groundCol.vz;
    }
    if (this.state === 'swing') this.releaseSwing(false);
    this.dashDir.copy(dir).setY(0).normalize();
    // mantém o embalo: sai do avanço tão rápido quanto entrou
    const along = this.vel.x * this.dashDir.x + this.vel.z * this.dashDir.z;
    this.dashExit = Math.max(RUN, Math.min(along, MAX_AIR_SPEED));
    this.dashCarry.set(cx, 0, cz);
    if (!this.grounded && this.coyote <= 0) this.airDashUsed = true;
    this.state = 'dash';
    this.dashing = true;
    this.dashTime = DASH_TIME;
    this.dashExtra = 0.3;
    this.jumping = false;
    this.groundCol = null;
    this.facing = Math.atan2(this.dashDir.x, this.dashDir.z);
  }

  // Anel de impulso: lança na direção dada (velocidade absoluta).
  boost(dx, dy, dz, speed) {
    if (this.state === 'hang' || this.state === 'climb') return;
    if (this.state === 'swing') this.releaseSwing(false);
    this.state = 'normal';
    this.dashing = false;
    this.vel.set(dx * speed, dy * speed, dz * speed);
    this.grounded = false;
    this.groundCol = null;
    this.jumping = false;
    this.airDashUsed = false;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, Math.hypot(this.vel.x, this.vel.z)));
    this.fallStartY = this.pos.y;
  }

  // Tenta ficar de pé depois de deslizar (precisa de espaço sobre a cabeça).
  tryStand() {
    if (this.height >= HEIGHT) return true;
    if (this.world.overlapCylinder(this.pos.x, this.pos.y + 0.05, this.pos.z, RADIUS * 0.9, HEIGHT - 0.1, ALL)) return false;
    this.height = HEIGHT;
    return true;
  }

  // ctrl = { move, walk, sneak, jumpPressed, jumpHeld, dropPressed,
  //          slidePressed, grapplePressed, grappleHeld }
  update(dt, ctrl) {
    this.time += dt;
    this.prevGrounded = this.grounded;
    this.grabCooldown -= dt;
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.wallTimer -= dt;
    this.wallLock -= dt;
    if (ctrl.jumpPressed) this.jumpBuffer = JUMP_BUFFER;

    const moveLen = Math.hypot(ctrl.move.x, ctrl.move.z);
    this.sneaking = ((ctrl.sneak && this.state === 'normal') || (this.low && this.state === 'normal')) && this.grounded;
    this.sprinting = !ctrl.sneak && !ctrl.walk && moveLen > 0.1;
    if (this.state !== 'slide' && this.low && !(ctrl.sneak && this.grounded)) this.tryStand();
    // agachado (esgueirando) também cabe em passagens baixas
    if (ctrl.sneak && this.grounded && this.state === 'normal') this.height = SLIDE_HEIGHT;

    this.applyCarry();

    if (ctrl.grapplePressed && this.state !== 'swing') this.tryGrapple();

    if (this.state === 'hang') this.updateHang(dt, ctrl);
    else if (this.state === 'climb') this.updateClimb(dt);
    else if (this.state === 'dash') this.updateDash(dt);
    else if (this.state === 'slide') this.updateSlide(dt, ctrl);
    else if (this.state === 'swing') this.updateSwing(dt, ctrl, moveLen);
    else this.updateNormal(dt, ctrl, moveLen);

    if (this.grounded && !this.prevGrounded) this.handleLanding();
    if (!this.grounded && this.prevGrounded) this.fallStartY = this.pos.y;

    this.animate(dt);
  }

  // Plataforma em movimento: leva o jogador junto (ou o arremessa se bateu).
  applyCarry() {
    const hanging = this.state === 'hang' || this.state === 'climb';
    const c = hanging ? this.hang.col : this.grounded ? this.groundCol : null;
    if (!c) return;
    if (!c.enabled) {
      if (!hanging) {
        this.vel.x += c.vx;
        this.vel.z += c.vz;
        this.grounded = false;
        this.groundCol = null;
      } else {
        this.state = 'normal';
      }
      return;
    }
    if (c.jolt && !hanging && (this.state === 'normal' || this.state === 'slide')) {
      this.state = 'normal';
      this.vel.x += c.jolt.x;
      this.vel.z += c.jolt.z;
      this.vel.y = Math.max(this.vel.y, 5.5);
      this.grounded = false;
      this.groundCol = null;
      this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, Math.hypot(this.vel.x, this.vel.z)));
      this.onJolt?.();
      return;
    }
    if (c.dx === 0 && c.dy === 0 && c.dz === 0) return;
    this.pos.x += c.dx;
    this.pos.y += c.dy;
    this.pos.z += c.dz;
    if (this.state === 'climb') {
      this.climb.from.x += c.dx;
      this.climb.from.y += c.dy;
      this.climb.from.z += c.dz;
      this.climb.to.x += c.dx;
      this.climb.to.y += c.dy;
      this.climb.to.z += c.dz;
    }
  }

  // Vento: empurra no ar; correntes para cima levantam até do chão.
  applyWind(dt) {
    const w = this.wind;
    if (!w) return;
    if (w.y > 0 && this.grounded) {
      this.grounded = false;
      this.groundCol = null;
      this.coyote = 0;
    }
    if (this.grounded) return;
    this.vel.x += w.x * dt;
    this.vel.z += w.z * dt;
    if (w.y > 0) this.vel.y = Math.min(this.vel.y + w.y * dt, WIND_MAX_UP);
    else this.vel.y += w.y * dt;
    if (w.x !== 0 || w.z !== 0) this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(this.airSpeedCap, this.horizontalSpeed));
    this.airDashUsed = w.y > 0 ? false : this.airDashUsed;
  }

  updateNormal(dt, ctrl, moveLen) {
    const speed = (ctrl.sneak || this.low) && this.grounded ? SNEAK : ctrl.walk ? WALK : RUN;

    // Deslizar: C correndo no chão
    if (ctrl.slidePressed && this.grounded && this.horizontalSpeed > SLIDE_MIN_SPEED) {
      this.startSlide();
      this.updateSlide(dt, ctrl);
      return;
    }

    if (this.grounded) {
      const tx = ctrl.move.x * speed;
      const tz = ctrl.move.z * speed;
      const accel = moveLen > 0.05 ? 80 : 60;
      const dx = tx - this.vel.x;
      const dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz);
      const maxDelta = accel * dt;
      if (dl > maxDelta) {
        this.vel.x += (dx / dl) * maxDelta;
        this.vel.z += (dz / dl) * maxDelta;
      } else {
        this.vel.x = tx;
        this.vel.z = tz;
      }
    } else {
      // No ar: acelera na direção pedida sem perder o embalo.
      let ax = ctrl.move.x;
      let az = ctrl.move.z;
      if (this.wallLock > 0) {
        const into = -(ax * this.wallNx + az * this.wallNz);
        if (into > 0) {
          ax += into * this.wallNx;
          az += into * this.wallNz;
        }
      }
      this.vel.x += ax * AIR_ACCEL * dt;
      this.vel.z += az * AIR_ACCEL * dt;
      if (moveLen < 0.05) {
        const k = Math.max(0, 1 - AIR_IDLE_DRAG * dt);
        this.vel.x *= k;
        this.vel.z *= k;
      }
      const cap = Math.min(MAX_AIR_SPEED, Math.max(speed, this.airSpeedCap));
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > cap) {
        this.vel.x *= cap / hs;
        this.vel.z *= cap / hs;
      }
    }
    this.applyWind(dt);

    // Salto (com buffer e coyote time) ou pulo na parede
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && !this.low) {
      this.doJump(speed);
    } else if (this.jumpBuffer > 0 && !this.grounded && this.wallTimer > 0 && this.canWallJump()) {
      this.wallJump();
    }
    // Salto variável: soltar o botão corta a subida.
    if (this.jumping && !ctrl.jumpHeld && this.vel.y > 0 && !this.jumpCut) {
      this.vel.y *= JUMP_CUT;
      this.jumpCut = true;
    }
    if (this.vel.y <= 0) this.jumping = false;

    // Gravidade em duas metades (antes e depois do movimento): a altura do
    // salto fica igual em 30, 60 ou 144 fps.
    const g = this.vel.y < 0 ? GRAVITY * FALL_MULT : GRAVITY;
    this.vel.y = Math.max(this.vel.y - g * dt * 0.5, -MAX_FALL);

    const before = this.grounded ? this.groundCol : null;
    const wasGrounded = this.grounded;
    this.move(dt, false);
    if (!this.grounded) this.vel.y = Math.max(this.vel.y - g * dt * 0.5, -MAX_FALL);
    this.convertFrame(before, this.grounded ? this.groundCol : null);

    // Deslizar na parede: segurando contra ela, a queda fica lenta.
    this.wallSliding = false;
    if (!this.grounded && this.wallTimer > WALL_MEMORY - 0.05 && this.vel.y < -WALL_SLIDE
      && -(ctrl.move.x * this.wallNx + ctrl.move.z * this.wallNz) > 0.3) {
      this.vel.y = -WALL_SLIDE;
      this.wallSliding = true;
    }

    if (wasGrounded && !this.grounded && this.vel.y <= 0) {
      this.coyote = COYOTE;
      this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(this.horizontalSpeed, speed));
    }

    if (this.bounceCol) this.applyBounce();

    // Passos (som + ruído para os guardiões)
    if (this.grounded) {
      const hs = this.horizontalSpeed;
      if (hs > 0.4) {
        this.stepPhase += dt * (5 + hs * 1.05);
        const idx = Math.floor(this.stepPhase / Math.PI);
        if (idx !== this.lastStepIndex) {
          this.lastStepIndex = idx;
          this.onStep?.(this.sneaking ? 'sneak' : hs > 7 ? 'run' : 'walk');
        }
      }
    }

    this.tryLedgeGrab(ctrl, moveLen);
  }

  doJump(speed) {
    if (this.grounded && this.groundCol) {
      this.vel.x += this.groundCol.vx;
      this.vel.z += this.groundCol.vz;
    }
    const lift = this.grounded && this.groundCol ? Math.max(0, this.groundCol.vy) : 0;
    this.vel.y = JUMP_V + lift;
    this.grounded = false;
    this.groundCol = null;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumping = true;
    this.jumpCut = false;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(this.horizontalSpeed, speed));
    this.fallStartY = this.pos.y;
    this.onJump?.();
  }

  // Troca de referencial ao subir/descer de uma plataforma em movimento.
  convertFrame(before, after) {
    if (before === after) return;
    if (before) {
      this.vel.x += before.vx;
      this.vel.z += before.vz;
    }
    if (after) {
      this.vel.x -= after.vx;
      this.vel.z -= after.vz;
    }
  }

  canWallJump() {
    if (this.state !== 'normal') return false;
    // não deixa escalar uma mesma parede pulando nela repetidamente
    return this.wallNx * this.lastWallNx + this.wallNz * this.lastWallNz < 0.7;
  }

  wallJump() {
    const nx = this.wallNx;
    const nz = this.wallNz;
    const vn = this.vel.x * nx + this.vel.z * nz;
    const tx = this.vel.x - vn * nx;
    const tz = this.vel.z - vn * nz;
    this.vel.x = tx * 0.9 + nx * WALL_JUMP_OUT;
    this.vel.z = tz * 0.9 + nz * WALL_JUMP_OUT;
    this.vel.y = WALL_JUMP_UP;
    this.wallLock = 0.2;
    this.lastWallNx = nx;
    this.lastWallNz = nz;
    this.wallTimer = 0;
    this.jumpBuffer = 0;
    this.jumping = true;
    this.jumpCut = false;
    this.airDashUsed = false;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(this.airSpeedCap, this.horizontalSpeed, WALK));
    this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.fallStartY = this.pos.y;
    this.onWallJump?.();
  }

  applyBounce() {
    const c = this.bounceCol;
    this.bounceCol = null;
    this.vel.y = c.bounce;
    if (c.launch) {
      this.vel.x = c.launch.x + this.vel.x * 0.25;
      this.vel.z = c.launch.z + this.vel.z * 0.25;
    }
    this.grounded = false;
    this.groundCol = null;
    this.jumping = false;
    this.airDashUsed = false;
    this.lastWallNx = this.lastWallNz = 0;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, this.horizontalSpeed));
    this.fallStartY = this.pos.y;
    this.onBounce?.(c);
  }

  // ------------------------------------------------------------ deslizar
  startSlide() {
    const hs = this.horizontalSpeed;
    this.state = 'slide';
    this.slide.t = 0;
    this.slide.speed = Math.min(SLIDE_MAX, Math.max(hs, RUN) + SLIDE_BOOST);
    this.slide.dir.set(this.vel.x / hs, 0, this.vel.z / hs);
    this.height = SLIDE_HEIGHT;
    this.onSlide?.();
  }

  updateSlide(dt, ctrl) {
    const s = this.slide;
    s.t += dt;
    s.speed = Math.max(4, s.speed - 7 * dt);
    // leve controle de direção
    const ml = Math.hypot(ctrl.move.x, ctrl.move.z);
    if (ml > 0.1) {
      const cur = Math.atan2(s.dir.x, s.dir.z);
      const want = Math.atan2(ctrl.move.x, ctrl.move.z);
      const a = cur + THREE.MathUtils.clamp(wrapAngle(want - cur), -2.2 * dt, 2.2 * dt);
      s.dir.set(Math.sin(a), 0, Math.cos(a));
    }
    this.vel.x = s.dir.x * s.speed;
    this.vel.z = s.dir.z * s.speed;

    // pulo deslizando: mantém a velocidade
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && this.tryStand()) {
      this.state = 'normal';
      this.doJump(s.speed);
      this.airSpeedCap = Math.min(MAX_AIR_SPEED, s.speed);
    }
    if (this.state === 'slide') {
      const g = GRAVITY * FALL_MULT;
      this.vel.y = Math.max(this.vel.y - g * dt, -MAX_FALL);
    }
    const before = this.grounded ? this.groundCol : null;
    const wasGrounded = this.grounded;
    this.move(dt, false);
    this.convertFrame(before, this.grounded ? this.groundCol : null);
    if (this.state !== 'slide') return;
    if (wasGrounded && !this.grounded) {
      this.coyote = COYOTE;
      this.state = 'normal';
      this.airSpeedCap = Math.min(MAX_AIR_SPEED, s.speed);
      return;
    }
    if (this.bounceCol) {
      this.tryStand();
      this.state = 'normal';
      this.applyBounce();
      return;
    }
    if (s.t > SLIDE_TIME && (!ctrl.sneak || s.speed <= 4.5) && this.tryStand()) {
      this.state = 'normal';
      this.vel.x = s.dir.x * Math.min(s.speed, RUN);
      this.vel.z = s.dir.z * Math.min(s.speed, RUN);
    }
  }

  // ------------------------------------------------------------ gancho
  // Âncora mais próxima ao alcance, acima e mais ou menos à frente.
  findAnchor() {
    let best = null;
    let bestScore = Infinity;
    const fx = Math.sin(this.facing);
    const fz = Math.cos(this.facing);
    const hx = this.pos.x;
    const hy = this.pos.y + HAND_Y;
    const hz = this.pos.z;
    for (const a of this.anchors) {
      const dx = a.pos.x - hx;
      const dy = a.pos.y - hy;
      const dz = a.pos.z - hz;
      if (dy < 0.6) continue;
      const d = Math.hypot(dx, dy, dz);
      if (d > GRAPPLE_RANGE || d < 1.5) continue;
      const hd = Math.hypot(dx, dz) || 1;
      const front = (dx * fx + dz * fz) / hd;
      if (front < -0.35 && hd > 2) continue;
      const score = d - front * 4;
      if (score < bestScore) {
        bestScore = score;
        best = a;
      }
    }
    return best;
  }

  tryGrapple() {
    if (this.state === 'hang' || this.state === 'climb' || this.state === 'dash') return false;
    const a = this.findAnchor();
    if (!a) return false;
    if (this.state === 'slide') this.tryStand();
    this.state = 'swing';
    this.swing.anchor = a;
    this.swing.len = Math.max(SWING_MIN_LEN, Math.hypot(a.pos.x - this.pos.x, a.pos.y - (this.pos.y + HAND_Y), a.pos.z - this.pos.z));
    if (this.grounded && this.groundCol) this.convertFrame(this.groundCol, null);
    if (this.grounded) this.vel.y = Math.max(this.vel.y, 4.5); // pequeno impulso para sair do chão
    this.grounded = false;
    this.groundCol = null;
    this.jumping = false;
    this.airDashUsed = false;
    this.onGrapple?.(a);
    return true;
  }

  releaseSwing(jump) {
    this.state = 'normal';
    this.swing.anchor = null;
    if (jump) {
      this.vel.y = Math.max(this.vel.y, 0) + SWING_RELEASE_UP;
      this.jumpBuffer = 0;
    }
    this.airDashUsed = false;
    this.jumping = false;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, this.horizontalSpeed));
    this.fallStartY = this.pos.y;
    this.onRelease?.(jump);
  }

  updateSwing(dt, ctrl, moveLen) {
    const a = this.swing.anchor;
    if (!ctrl.grappleHeld || !a) {
      this.releaseSwing(false);
      return;
    }
    if (this.jumpBuffer > 0) {
      this.releaseSwing(true);
      return;
    }
    // embalar: acelerar na direção pedida
    if (moveLen > 0.05) {
      this.vel.x += ctrl.move.x * SWING_ACCEL * dt;
      this.vel.z += ctrl.move.z * SWING_ACCEL * dt;
    }
    this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -MAX_FALL);
    this.applyWind(dt);
    const sp = this.vel.length();
    if (sp > SWING_MAX_SPEED) this.vel.multiplyScalar(SWING_MAX_SPEED / sp);
    this.swing.len = Math.max(SWING_MIN_LEN, this.swing.len - SWING_REEL * dt);

    this.move(dt, false);
    // restrição da corda
    const dx = this.pos.x - a.pos.x;
    const dy = this.pos.y + HAND_Y - a.pos.y;
    const dz = this.pos.z - a.pos.z;
    const d = Math.hypot(dx, dy, dz);
    if (d > this.swing.len) {
      const nx = dx / d;
      const ny = dy / d;
      const nz = dz / d;
      const k = d - this.swing.len;
      const tx = this.pos.x - nx * k;
      const ty = this.pos.y - ny * k;
      const tz = this.pos.z - nz * k;
      if (!this.world.overlapCylinder(tx, ty + 0.05, tz, RADIUS * 0.9, this.height - 0.1, ALL)) this.pos.set(tx, ty, tz);
      const vr = this.vel.x * nx + this.vel.y * ny + this.vel.z * nz;
      if (vr > 0) {
        this.vel.x -= nx * vr;
        this.vel.y -= ny * vr;
        this.vel.z -= nz * vr;
      }
    }
    if (this.horizontalSpeed > 0.5) this.facing = Math.atan2(this.vel.x, this.vel.z);
    if (this.grounded) {
      this.releaseSwing(false);
    }
  }

  updateDash(dt) {
    this.dashTime -= dt;
    this.vel.set(this.dashDir.x * DASH_SPEED + this.dashCarry.x, 0, this.dashDir.z * DASH_SPEED + this.dashCarry.z);
    this.move(dt, true);
    this.groundCol = null; // durante o avanço o jogador não é carregado
    if (this.dashTime <= 0) {
      // Nunca termina o avanço dentro de uma barreira do Véu.
      const inside = this.world.overlapCylinder(this.pos.x, this.pos.y, this.pos.z, RADIUS, this.height, VEIL);
      if (inside && this.dashExtra > 0) {
        this.dashExtra -= dt;
        return;
      }
      this.state = 'normal';
      this.dashing = false;
      this.vel.set(this.dashDir.x * this.dashExit + this.dashCarry.x, 0, this.dashDir.z * this.dashExit + this.dashCarry.z);
      this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.hypot(this.vel.x, this.vel.z));
      this.fallStartY = this.pos.y;
      if (this.grounded) {
        const c = this.world.groundColliderBelow(this.pos.x, this.pos.z, RADIUS * 0.9, this.pos.y + 0.01, 0.05);
        this.groundCol = c;
        if (c) {
          this.vel.x -= c.vx;
          this.vel.z -= c.vz;
        }
      }
    }
  }

  // Movimento com sub-passos para não atravessar paredes em alta velocidade.
  move(dt, dashing) {
    const maxComp = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z));
    const steps = Math.min(14, Math.max(1, Math.ceil((maxComp * dt) / 0.15)));
    const h = dt / steps;
    const mask = dashing ? SOLID : ALL;
    const wasGrounded = this.grounded;
    this.grounded = false;
    this.groundCol = null;

    for (let s = 0; s < steps; s++) {
      this.pos.x += this.vel.x * h;
      this.pos.z += this.vel.z * h;
      this.resolveHorizontal(mask, wasGrounded || this.grounded ? STEP_UP : 0.25, !wasGrounded && !this.grounded);

      const before = this.pos.y;
      this.pos.y += this.vel.y * h;
      this.resolveVertical(mask, before);
    }

    // Mantém contato ao descer degraus pequenos.
    if (!this.grounded && wasGrounded && this.vel.y <= 0 && !dashing && !this.bounceCol && !(this.wind && this.wind.y > 0)) {
      const c = this.world.groundColliderBelow(this.pos.x, this.pos.z, RADIUS * 0.9, this.pos.y + 0.01, STEP_UP + 0.05, mask);
      if (c) {
        this.pos.y = c.maxY;
        this.vel.y = 0;
        this.grounded = true;
        this.groundCol = c;
      }
    }
  }

  resolveHorizontal(mask, stepAllow, airborne) {
    for (let iter = 0; iter < 2; iter++) {
      let any = false;
      for (const c of this.world.colliders) {
        if (!c.enabled || !(c.kind & mask)) continue;
        if (c.maxY <= this.pos.y + stepAllow || c.minY >= this.pos.y + this.height) continue;
        const push = PhysicsWorld.circlePush(c, this.pos.x, this.pos.z, RADIUS);
        if (!push) continue;
        this.pos.x += push.x;
        this.pos.z += push.z;
        const vn = this.vel.x * push.nx + this.vel.z * push.nz;
        if (vn < 0) {
          this.vel.x -= vn * push.nx;
          this.vel.z -= vn * push.nz;
        }
        // parede alta o bastante para pular nela
        if (airborne && c.kind === SOLID && c.maxY > this.pos.y + 1.0 && c.minY < this.pos.y + 0.8) {
          this.wallTimer = WALL_MEMORY;
          this.wallNx = push.nx;
          this.wallNz = push.nz;
        }
        any = true;
      }
      if (!any) break;
    }
  }

  resolveVertical(mask, before) {
    for (const c of this.world.colliders) {
      if (!c.enabled || !(c.kind & mask)) continue;
      if (!PhysicsWorld.circleOverlaps(c, this.pos.x, this.pos.z, RADIUS * 0.9)) continue;
      if (this.vel.y <= 0) {
        if (this.pos.y <= c.maxY + 1e-4 && before >= c.maxY - STEP_UP && this.pos.y + this.height > c.maxY) {
          this.impactSpeed = Math.max(this.impactSpeed, -this.vel.y);
          this.pos.y = c.maxY;
          this.vel.y = 0;
          this.grounded = true;
          this.groundCol = c;
          if (c.bounce > 0 && (this.state === 'normal' || this.state === 'slide')) this.bounceCol = c;
        }
      } else {
        const head = this.pos.y + this.height;
        if (head > c.minY && before + this.height <= c.minY + 0.05) {
          this.pos.y = c.minY - this.height;
          this.vel.y = 0;
        }
      }
    }
  }

  handleLanding() {
    const impact = this.impactSpeed;
    this.impactSpeed = 0;
    this.airDashUsed = false;
    this.airSpeedCap = 0;
    this.jumping = false;
    this.lastWallNx = this.lastWallNz = 0;
    const drop = this.fallStartY - this.pos.y;
    // queda alta correndo: rolamento (sem o baque)
    if (impact > ROLL_IMPACT && this.horizontalSpeed > 4 && this.state === 'normal' && !this.bounceCol) {
      this.roll = ROLL_TIME;
      this.onRoll?.();
    } else if (impact > 3) {
      this.landSquash = Math.min(1, impact / 16);
    }
    this.onLand?.(impact, drop, this.roll > 0);
  }

  // ------------------------------------------------------------ bordas
  tryLedgeGrab(ctrl, moveLen) {
    if (this.grounded || this.vel.y > 2.5 || this.grabCooldown > 0 || moveLen < 0.3 || this.state !== 'normal') return;
    const dx = ctrl.move.x / moveLen;
    const dz = ctrl.move.z / moveLen;
    const px = this.pos.x + dx * (RADIUS + 0.3);
    const pz = this.pos.z + dz * (RADIUS + 0.3);

    let best = null;
    for (const c of this.world.colliders) {
      if (!c.enabled || c.kind !== SOLID || c.bounce > 0 || c.noGrab) continue;
      if (px < c.minX || px > c.maxX || pz < c.minZ || pz > c.maxZ) continue;
      const rel = c.maxY - this.pos.y;
      if (rel < 0.8 || rel > 2.1) continue;
      if (best && c.maxY <= best.maxY) continue;
      // Precisa haver espaço livre sobre a borda.
      const free = !this.world.overlapCylinder(this.pos.x + dx * (RADIUS + 0.5), c.maxY + 0.05,
        this.pos.z + dz * (RADIUS + 0.5), RADIUS * 0.8, HEIGHT - 0.2, ALL);
      if (free) best = c;
    }
    if (!best) return;

    const c = best;
    const ox1 = c.minX - this.pos.x;
    const ox2 = this.pos.x - c.maxX;
    const oz1 = c.minZ - this.pos.z;
    const oz2 = this.pos.z - c.maxZ;
    const m = Math.max(ox1, ox2, oz1, oz2);
    if (m < -0.05) return;
    let nx = 0;
    let nz = 0;
    if (m === ox1) nx = -1;
    else if (m === ox2) nx = 1;
    else if (m === oz1) nz = -1;
    else nz = 1;
    if (-(dx * nx + dz * nz) < 0.45) return;

    const hx = nx === -1 ? c.minX - RADIUS - 0.02 : nx === 1 ? c.maxX + RADIUS + 0.02
      : THREE.MathUtils.clamp(this.pos.x, Math.min(c.minX + 0.15, (c.minX + c.maxX) / 2), Math.max(c.maxX - 0.15, (c.minX + c.maxX) / 2));
    const hz = nz === -1 ? c.minZ - RADIUS - 0.02 : nz === 1 ? c.maxZ + RADIUS + 0.02
      : THREE.MathUtils.clamp(this.pos.z, Math.min(c.minZ + 0.15, (c.minZ + c.maxZ) / 2), Math.max(c.maxZ - 0.15, (c.minZ + c.maxZ) / 2));
    const hy = c.maxY - HANG_OFFSET;
    if (this.world.overlapCylinder(hx, hy + 0.05, hz, RADIUS * 0.9, HEIGHT - 0.1, ALL)) return;

    this.pos.set(hx, hy, hz);
    this.vel.set(0, 0, 0);
    this.state = 'hang';
    this.jumping = false;
    this.airDashUsed = false;
    this.hang.top = c.maxY;
    this.hang.nx = nx;
    this.hang.nz = nz;
    this.hang.push = 0;
    this.hang.time = 0;
    this.hang.col = c;
    this.facing = Math.atan2(-nx, -nz);
    this.onGrab?.();
  }

  updateHang(dt, ctrl) {
    this.vel.set(0, 0, 0);
    this.hang.time += dt;
    const { nx, nz } = this.hang;
    const toward = -(ctrl.move.x * nx + ctrl.move.z * nz);
    this.hang.push = toward > 0.5 ? this.hang.push + dt : 0;

    if (ctrl.jumpPressed || this.hang.push > 0.12) {
      const tx = this.pos.x - nx * (RADIUS + 0.4);
      const tz = this.pos.z - nz * (RADIUS + 0.4);
      const ty = this.hang.col ? this.hang.col.maxY : this.hang.top;
      if (!this.world.overlapCylinder(tx, ty + 0.02, tz, RADIUS * 0.9, HEIGHT - 0.1, ALL)) {
        this.state = 'climb';
        this.climb.from.copy(this.pos);
        this.climb.to.set(tx, ty, tz);
        this.climb.t = 0;
        this.onClimb?.();
      }
    } else if ((ctrl.dropPressed || toward < -0.5) && this.hang.time > 0.15) {
      const c = this.hang.col;
      this.state = 'normal';
      this.vel.set(nx * 1.5 + (c ? c.vx : 0), 0, nz * 1.5 + (c ? c.vz : 0));
      this.grabCooldown = 0.45;
      this.fallStartY = this.pos.y;
    }
    if (this.hang.col && !this.hang.col.enabled) this.state = 'normal';
  }

  updateClimb(dt) {
    this.climb.t += dt / CLIMB_TIME;
    const t = Math.min(this.climb.t, 1);
    const { from, to } = this.climb;
    if (t < 0.6) {
      const k = t / 0.6;
      const e = 1 - (1 - k) * (1 - k);
      this.pos.set(from.x, from.y + (to.y + 0.05 - from.y) * e, from.z);
    } else {
      const k = (t - 0.6) / 0.4;
      const e = k * k * (3 - 2 * k);
      this.pos.set(from.x + (to.x - from.x) * e, to.y + 0.05 * (1 - e), from.z + (to.z - from.z) * e);
    }
    if (t >= 1) {
      this.pos.copy(to);
      this.state = 'normal';
      this.vel.set(0, 0, 0);
      this.grounded = true;
      this.prevGrounded = true;
      this.groundCol = this.hang.col;
      this.airDashUsed = false;
    }
  }

  // ----------------------------------------------------------- animação
  animate(dt) {
    const hs = this.horizontalSpeed;
    const k = 16;
    let targetFacing = this.facing;
    if (this.state === 'normal' && hs > 0.4) targetFacing = Math.atan2(this.vel.x, this.vel.z);
    if (this.state === 'slide') targetFacing = Math.atan2(this.slide.dir.x, this.slide.dir.z);
    if (this.state === 'dash') targetFacing = Math.atan2(this.dashDir.x, this.dashDir.z);
    if (this.state === 'hang' || this.state === 'climb') targetFacing = Math.atan2(-this.hang.nx, -this.hang.nz);
    if (this.wallSliding) targetFacing = Math.atan2(-this.wallNx, -this.wallNz);
    this.facing += wrapAngle(targetFacing - this.facing) * (1 - Math.exp(-14 * dt));

    this.root.position.copy(this.pos);
    this.root.rotation.y = this.facing;

    const runAmt = Math.min(hs / RUN, 1);
    const sw = Math.sin(this.stepPhase);
    let legL = 0, legR = 0, armL = 0, armR = 0, armSpread = 0;
    let kneeL = 0.08, kneeR = 0.08, elbowL = -0.25, elbowR = -0.25;
    let lean = 0, bodyY = 0, crouch = 0;

    if (this.celebrate) {
      armL = armR = -2.7;
      armSpread = 0.5;
      elbowL = elbowR = -0.2;
      bodyY = Math.abs(Math.sin(this.time * 3)) * 0.05;
      lean = -0.1;
    } else if (this.state === 'hang') {
      armL = armR = -2.85;
      armSpread = 0.25;
      elbowL = elbowR = 0;
      legL = Math.sin(this.time * 2) * 0.12;
      legR = -legL;
      kneeL = kneeR = 0.3;
      lean = -0.08;
    } else if (this.state === 'climb') {
      const t = this.climb.t;
      armL = armR = t < 0.6 ? -2.6 + t * 2.2 : -0.6;
      elbowL = elbowR = -0.6;
      legL = -1.0 * Math.sin(t * Math.PI);
      kneeL = 1.2 * Math.sin(t * Math.PI);
      legR = 0.3;
      lean = 0.35;
    } else if (this.state === 'dash') {
      armL = armR = 1.1;
      armSpread = 0.35;
      elbowL = elbowR = 0;
      legL = 0.6;
      legR = -0.3;
      kneeL = 0.9;
      kneeR = 0.6;
      lean = 0.65;
    } else if (this.state === 'slide') {
      lean = -1.15;
      legL = 0.35;
      kneeL = 0.1;
      legR = 0.9;
      kneeR = 1.5;
      armL = 0.6;
      armR = -1.4;
      armSpread = 0.6;
      elbowR = -0.4;
    } else if (this.state === 'swing') {
      const sv = this.vel.y;
      armR = -3.0;
      armL = -2.4;
      armSpread = 0.15;
      elbowL = elbowR = -0.05;
      legL = THREE.MathUtils.clamp(-sv * 0.05, -0.8, 0.6) - 0.3;
      legR = legL + 0.5;
      kneeL = 0.5;
      kneeR = 0.9;
      lean = THREE.MathUtils.clamp(hs * 0.025, 0, 0.4);
    } else if (this.wallSliding) {
      armL = armR = -1.7;
      armSpread = 0.5;
      legL = -0.5;
      kneeL = 0.8;
      legR = 0.2;
      lean = -0.2;
    } else if (!this.grounded) {
      const rising = this.vel.y > 0;
      legL = rising ? -0.9 : -0.4;
      kneeL = rising ? 1.3 : 0.5;
      legR = rising ? 0.5 : 0.25;
      kneeR = rising ? 0.9 : 0.4;
      armL = -0.6;
      armR = rising ? -1.2 : -0.4;
      armSpread = 0.45;
      elbowL = elbowR = -0.4;
      lean = Math.min(this.horizontalSpeed / RUN, 1.6) * 0.2;
    } else {
      const amp = this.sneaking ? 0.55 : 0.95;
      legL = sw * amp * runAmt * 1.15;
      legR = -legL;
      kneeL = 0.1 + Math.max(0, Math.sin(this.stepPhase + 1.6)) * 1.4 * runAmt;
      kneeR = 0.1 + Math.max(0, Math.sin(this.stepPhase + 1.6 + Math.PI)) * 1.4 * runAmt;
      armL = -sw * 0.75 * runAmt;
      armR = -armL;
      elbowL = elbowR = -0.25 - runAmt * 1.0;
      bodyY = Math.abs(Math.cos(this.stepPhase)) * 0.07 * runAmt;
      lean = runAmt * 0.28;
      if (this.sneaking) {
        crouch = this.low ? 1.9 : 1;
        lean += this.low ? 0.55 : 0.35;
        kneeL += 0.5;
        kneeR += 0.5;
        armL = armL * 0.5 + 0.35;
        armR = armR * 0.5 + 0.35;
      }
      if (hs < 0.3) {
        // respiração parada
        bodyY = Math.sin(this.time * 2.2) * 0.012;
        armL = armR = 0.05;
        elbowL = elbowR = -0.15;
      }
    }

    this.legL.rotation.x = damp(this.legL.rotation.x, legL, k, dt);
    this.legR.rotation.x = damp(this.legR.rotation.x, legR, k, dt);
    this.kneeL.rotation.x = damp(this.kneeL.rotation.x, kneeL, k, dt);
    this.kneeR.rotation.x = damp(this.kneeR.rotation.x, kneeR, k, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, armL, k, dt);
    this.armR.rotation.x = damp(this.armR.rotation.x, armR, k, dt);
    this.elbowL.rotation.x = damp(this.elbowL.rotation.x, elbowL, k, dt);
    this.elbowR.rotation.x = damp(this.elbowR.rotation.x, elbowR, k, dt);
    this.armL.rotation.z = damp(this.armL.rotation.z, -armSpread, k, dt);
    this.armR.rotation.z = damp(this.armR.rotation.z, armSpread, k, dt);

    // rolamento: uma cambalhota completa sobre o centro do corpo
    let rot;
    if (this.roll > 0) {
      this.roll -= dt;
      const t = 1 - Math.max(0, this.roll) / ROLL_TIME;
      rot = lean + t * Math.PI * 2;
      crouch = 1;
      if (this.roll <= 0) rot = lean;
      this.body.rotation.x = rot;
    } else {
      this.body.rotation.x = damp(this.body.rotation.x, lean, this.state === 'slide' ? 18 : 10, dt);
      rot = this.body.rotation.x;
    }

    this.crouch = damp(this.crouch ?? 0, crouch, 12, dt);
    this.landSquash = damp(this.landSquash, 0, 7, dt);
    const sq = this.landSquash;
    const sy = 1 - 0.24 * sq - 0.18 * this.crouch;
    const sxz = 1 + 0.14 * sq;
    this.body.scale.set(sxz, sy, sxz);
    // gira em torno do centro (e não dos pés)
    const py = BODY_PIVOT * sy;
    this.body.position.set(0, bodyY + py - py * Math.cos(rot), -py * Math.sin(rot));
    if (this.state === 'slide') this.body.position.y -= 0.05;

    // brilho durante o avanço e olhos que acompanham a carga do Véu
    const glow = this.state === 'dash' ? 1.4 : this.state === 'swing' ? 0.25 : 0;
    this.cloakMat.emissiveIntensity = damp(this.cloakMat.emissiveIntensity, glow, 20, dt);
    const charge = THREE.MathUtils.clamp(this.veilCharge, 0, 1);
    const eyeK = 0.25 + 0.75 * charge * charge;
    this.eyeMat.color.copy(this.eyeBase).multiplyScalar(eyeK);
    this.capeMat.emissiveIntensity = 0.3 + charge * 0.6 + this.cloakMat.emissiveIntensity;
    this.scarfMat.emissiveIntensity = 0.12 + charge * 0.25 + this.cloakMat.emissiveIntensity * 0.5;

    // sombra circular
    const ground = this.world.groundBelow(this.pos.x, this.pos.z, 0.05, this.pos.y + 0.05, 40);
    if (ground !== null) {
      const hgt = this.pos.y - ground;
      this.blob.visible = true;
      this.blob.position.set(this.pos.x, ground + 0.03, this.pos.z);
      const s = 0.9 + Math.min(hgt, 8) * 0.06;
      this.blob.scale.set(s, s, s);
      this.blobMat.opacity = Math.max(0.15, 0.75 - hgt * 0.06);
    } else {
      this.blob.visible = false;
    }

    // tecido (capa e cachecol)
    this.root.updateMatrixWorld(true);
    this.fwd.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    this.rightV.set(Math.cos(this.facing), 0, -Math.sin(this.facing));
    const floorY = ground !== null ? ground : this.pos.y - 50;
    const speedK = Math.min(1, (this.state === 'dash' ? 30 : Math.hypot(hs, this.vel.y)) / 14);
    if (dt > 0) {
      for (const r of this.cloth) {
        r.mesh.visible = this.root.visible;
        r.update(Math.min(dt, 0.05), this.fwd, this.rightV, floorY, this.time, speedK, this.wind);
      }
    }

    // corda do gancho
    const a = this.state === 'swing' ? this.swing.anchor : null;
    this.rope.visible = !!a && this.root.visible;
    if (a) {
      this.handR.getWorldPosition(this.tmpV);
      const arr = this.rope.geometry.attributes.position.array;
      arr[0] = this.tmpV.x;
      arr[1] = this.tmpV.y;
      arr[2] = this.tmpV.z;
      arr[3] = a.pos.x;
      arr[4] = a.pos.y;
      arr[5] = a.pos.z;
      this.rope.geometry.attributes.position.needsUpdate = true;
    }
  }
}
