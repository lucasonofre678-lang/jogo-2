// Guardião espectral: patrulha por pontos, detecta o jogador por cone de visão
// com linha de visão, por proximidade e por ruído. Estados:
//   patrol -> suspicious (investiga) -> chase (persegue) -> return (volta à rota)
import * as THREE from 'three';
import { PhysicsWorld, SOLID } from './physics.js';
import { PoolLight } from './lights.js';

export const VIEW_RANGE = 15;
const HALF_FOV = THREE.MathUtils.degToRad(50);
const COS_HALF_FOV = Math.cos(HALF_FOV);
const PROXIMITY = 2.8;
const CAPTURE_RADIUS = 1.3;
const BODY_RADIUS = 0.45;
const FAN_SEGMENTS = 30;

const SPEED = { patrol: 2.2, suspicious: 2.9, chase: 6.1, return: 2.6 };
const SUSPICIOUS_AT = 0.3;

const COLORS = {
  patrol: new THREE.Color(0x5fa8ff),
  suspicious: new THREE.Color(0xffb347),
  chase: new THREE.Color(0xff3448),
  return: new THREE.Color(0x8fa6ff),
};

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function markerTexture(glyph, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 96px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 24;
  g.fillStyle = color;
  g.fillText(glyph, 64, 70);
  g.shadowBlur = 0;
  g.fillStyle = '#fff6e8';
  g.font = 'bold 84px Georgia, serif';
  g.fillText(glyph, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let markerTex = null;

export class Guardian {
  constructor(scene, world, def) {
    this.scene = scene;
    this.world = world;
    this.def = def;
    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.state = 'patrol';
    this.suspicion = 0;
    this.investigate = new THREE.Vector3();
    this.lastSeen = new THREE.Vector3();
    this.timeSinceSeen = 99;
    this.color = COLORS.patrol.clone();
    this.time = Math.random() * 10;
    this.onStateChange = null;
    this.dissolve = 0;

    if (!markerTex) {
      markerTex = { q: markerTexture('?', '#ffb347'), e: markerTexture('!', '#ff3448') };
    }
    this.buildMesh();
    this.buildFan();
    this.reset();
  }

  // ------------------------------------------------------------- visual
  buildMesh() {
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);
    this.root = root;
    this.body = body;

    const robeMat = new THREE.MeshStandardMaterial({
      color: 0x1d2130, roughness: 1, flatShading: true, side: THREE.DoubleSide,
      emissive: new THREE.Color(0.02, 0.05, 0.14), transparent: true, opacity: 1,
      forceSinglePass: true, // só fica translúcido ao se desfazer: uma passada basta
    });
    const darkMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true });
    this.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 2, 4) });
    this.auraMat = new THREE.MeshBasicMaterial({
      color: 0x3f7fff, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending,
      depthWrite: false, side: THREE.BackSide,
    });
    this.robeMat = robeMat;
    this.darkMat = darkMat;

    const add = (geo, mat, x, y, z, parent = body) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = mat === robeMat;
      parent.add(m);
      return m;
    };

    // Manto longo com barra rasgada
    const robeGeo = new THREE.CylinderGeometry(0.32, 0.78, 2.1, 10, 4, true);
    const p = robeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      if (y < -0.9) p.setY(i, y - (Math.sin(i * 3.1) * 0.5 + 0.5) * 0.35);
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      const wob = 1 + Math.sin(ang * 5 + y * 2) * 0.05;
      p.setX(i, p.getX(i) * wob);
      p.setZ(i, p.getZ(i) * wob);
    }
    robeGeo.computeVertexNormals();
    add(robeGeo, robeMat, 0, 1.25, 0);
    const aura = add(new THREE.CylinderGeometry(0.42, 0.95, 2.5, 10, 1, true), this.auraMat, 0, 1.25, 0);
    aura.castShadow = false;
    this.aura = aura;

    // Ombros e capuz pontudo
    add(new THREE.ConeGeometry(0.62, 0.62, 10, 1, true), robeMat, 0, 2.28, 0);
    const hood = add(new THREE.SphereGeometry(0.3, 9, 7), robeMat, 0, 2.52, -0.02);
    hood.scale.set(1, 1.15, 1.1);
    const tip = add(new THREE.ConeGeometry(0.22, 0.55, 7), robeMat, 0, 2.82, -0.12);
    tip.rotation.x = -0.5;
    const face = add(new THREE.SphereGeometry(0.21, 9, 7), darkMat, 0, 2.48, 0.12);
    face.scale.set(1, 1.15, 0.65);
    const eyeGeo = new THREE.SphereGeometry(0.038, 6, 4);
    add(eyeGeo, this.glowMat, -0.08, 2.52, 0.27);
    add(eyeGeo, this.glowMat, 0.08, 2.52, 0.27);

    // Auréola rúnica
    const halo = add(new THREE.TorusGeometry(0.42, 0.022, 6, 36), this.glowMat, 0, 2.95, -0.08);
    halo.rotation.x = Math.PI / 2 - 0.35;
    this.halo = halo;

    // Braços longos e a lanterna
    const armGeo = new THREE.ConeGeometry(0.11, 1.15, 6);
    armGeo.translate(0, -0.55, 0);
    const armL = add(armGeo, robeMat, -0.48, 2.2, 0.05);
    armL.rotation.z = 0.18;
    const armR = add(armGeo, robeMat, 0.48, 2.2, 0.05);
    armR.rotation.set(-0.7, 0, -0.15);
    const lantern = new THREE.Group();
    lantern.position.set(0.55, 1.42, 0.62);
    body.add(lantern);
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 4), robeMat, 0, 0.18, 0, lantern);
    const cage = add(new THREE.OctahedronGeometry(0.15, 0), new THREE.MeshBasicMaterial({ color: 0x0b0d12, wireframe: true }), 0, 0, 0, lantern);
    cage.scale.y = 1.4;
    const core = add(new THREE.OctahedronGeometry(0.075, 0), this.glowMat, 0, 0, 0, lantern);
    core.scale.y = 1.4;
    this.light = new PoolLight(0x5fa8ff, 6, 11, 2);
    this.light.position.set(0.5, 1.0, 1.5);
    body.add(this.light);
    this.lantern = lantern;

    // Marcador ? / ! acima da cabeça
    this.markerMat = new THREE.SpriteMaterial({ map: markerTex.q, transparent: true, depthWrite: false, opacity: 0 });
    this.marker = new THREE.Sprite(this.markerMat);
    this.marker.scale.set(0.8, 0.8, 0.8);
    this.marker.position.set(0, 3.5, 0);
    root.add(this.marker);

    this.scene.add(root);
  }

  // Cone de visão desenhado no chão, recortado pelas paredes.
  buildFan() {
    const geo = new THREE.BufferGeometry();
    const n = FAN_SEGMENTS + 2;
    this.fanPos = new Float32Array(n * 3);
    this.fanCol = new Float32Array(n * 3);
    const idx = [];
    for (let i = 0; i < FAN_SEGMENTS; i++) idx.push(0, i + 1, i + 2);
    geo.setIndex(idx);
    geo.setAttribute('position', new THREE.BufferAttribute(this.fanPos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.fanCol, 3).setUsage(THREE.DynamicDrawUsage));
    this.fanMat = new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, forceSinglePass: true,
    });
    this.fan = new THREE.Mesh(geo, this.fanMat);
    this.fan.frustumCulled = false;
    this.fan.renderOrder = 3;
    this.scene.add(this.fan);
  }

  // ------------------------------------------------------------- estado
  reset() {
    const start = this.def.waypoints[0];
    this.pos.set(start.x, this.def.floorY, start.z);
    const next = this.def.waypoints[1] ?? start;
    this.yaw = start.look ?? Math.atan2(next.x - start.x, next.z - start.z);
    this.wpIndex = 0;
    this.waitTimer = start.wait ?? 0;
    this.lookTimer = 0;
    this.baseYaw = this.yaw;
    this.suspicion = 0;
    this.timeSinceSeen = 99;
    this.outOfZone = 0;
    this.dissolve = 0;
    this.root.visible = this.fan.visible = true;
    this.robeMat.opacity = 1;
    this.setState('patrol', true);
  }

  setState(s, silent = false) {
    const prev = this.state;
    this.state = s;
    this.stateTime = 0;
    this.reached = false;
    this.moveTimer = 0;
    this.lookTimer = 0;
    if (s === 'return') {
      // volta para o ponto de patrulha mais próximo
      let best = 0;
      let bd = Infinity;
      this.def.waypoints.forEach((w, i) => {
        const d = Math.hypot(w.x - this.pos.x, w.z - this.pos.z);
        if (d < bd) { bd = d; best = i; }
      });
      this.wpIndex = best;
      this.waitTimer = 0;
    }
    if (!silent && prev !== s) this.onStateChange?.(this, s, prev);
  }

  // Ouve um ruído (passos, aterrissagem, eco do Véu).
  hear(x, y, z, radius, strength) {
    if (this.dissolve > 0) return;
    // Ruídos fora do domínio do guardião (ex.: a varanda) são ignorados.
    if (!this.inZone({ x, z })) return;
    const d = Math.hypot(x - this.pos.x, y - (this.pos.y + 1.5), z - this.pos.z);
    if (d > radius) return;
    let s = strength * (1 - 0.5 * (d / radius));
    const dx = x - this.pos.x;
    const dy = y - (this.pos.y + 1.5);
    const dz = z - this.pos.z;
    const blocked = d > 0.5 && this.world.raycast(this.pos.x, this.pos.y + 1.5, this.pos.z, dx / d, dy / d, dz / d, d - 0.3, SOLID);
    if (blocked) {
      // paredes abafam o som
      if (d > radius * 0.6) return;
      s *= 0.5;
    }
    this.suspicion = Math.min(1, this.suspicion + s);
    if (this.state === 'chase') {
      if (this.timeSinceSeen > 0.5) this.lastSeen.set(x, y, z);
    } else {
      this.investigate.set(x, y, z);
      if (this.state === 'suspicious') {
        this.reached = false;
        this.moveTimer = 0;
        this.stateTime = Math.max(this.stateTime, 0.6);
      }
    }
  }

  // Taxa de suspeita por segundo se o jogador estiver visível; 0 se não.
  perceive(player) {
    const ex = this.pos.x;
    const ey = this.pos.y + 2.3;
    const ez = this.pos.z;
    const ty = player.pos.y + (player.sneaking ? 0.6 : 1.35);
    const dx = player.pos.x - ex;
    const dy = ty - ey;
    const dz = player.pos.z - ez;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > VIEW_RANGE || dist < 1e-4) return 0;
    const hd = Math.hypot(dx, dz) || 1e-4;
    const cosA = (dx * Math.sin(this.yaw) + dz * Math.cos(this.yaw)) / hd;
    const inCone = cosA > COS_HALF_FOV && Math.abs(dy) < hd * 1.2 + 1;
    const near = dist < PROXIMITY;
    const tracking = this.state === 'chase';
    if (!inCone && !near && !tracking) return 0;
    if (this.world.raycast(ex, ey, ez, dx / dist, dy / dist, dz / dist, dist - 0.3, SOLID)) return 0;

    let rate = near ? 2.6 : 0.35 + 1.7 * (1 - dist / VIEW_RANGE) ** 2;
    const hs = player.horizontalSpeed;
    if (player.state === 'dash') rate *= 2.2;
    else if (player.sneaking) rate *= 0.5;
    else if (player.sprinting && hs > 1) rate *= 1.6;
    else if (hs < 0.3) rate *= 0.7;
    if (this.state === 'suspicious') rate *= 1.25;
    return rate;
  }

  turnToward(target, rate, dt) {
    const diff = wrapAngle(target - this.yaw);
    const step = rate * dt;
    this.yaw = wrapAngle(this.yaw + Math.max(-step, Math.min(step, diff)));
  }

  moveTo(x, z, speed, dt) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.4) return true;
    const desired = Math.atan2(dx, dz);
    this.turnToward(desired, this.state === 'chase' ? 9 : 4.5, dt);
    const diff = Math.abs(wrapAngle(desired - this.yaw));
    const f = Math.max(0.15, Math.cos(Math.min(diff, Math.PI / 2)));
    const step = Math.min(d, speed * dt * f);
    this.pos.x += (dx / d) * step;
    this.pos.z += (dz / d) * step;
    this.collide();
    return false;
  }

  collide() {
    // Flutua sobre obstáculos baixos; contorna pilares e paredes.
    for (const c of this.world.colliders) {
      if (!c.enabled || c.kind !== SOLID) continue;
      if (c.maxY <= this.pos.y + 1.1 || c.minY >= this.pos.y + 2.6) continue;
      const push = PhysicsWorld.circlePush(c, this.pos.x, this.pos.z, BODY_RADIUS);
      if (push) {
        this.pos.x += push.x;
        this.pos.z += push.z;
      }
    }
    const z = this.def.zone;
    this.pos.x = Math.max(z.minX + 0.5, Math.min(z.maxX - 0.5, this.pos.x));
    this.pos.z = Math.max(z.minZ + 0.5, Math.min(z.maxZ - 0.5, this.pos.z));
  }

  lookAround(dt, amplitude = 0.9) {
    this.lookTimer += dt;
    this.turnToward(this.baseYaw + Math.sin(this.lookTimer * 1.3) * amplitude, 2.6, dt);
  }

  clampToZone(p) {
    const z = this.def.zone;
    p.x = Math.max(z.minX + 1, Math.min(z.maxX - 1, p.x));
    p.z = Math.max(z.minZ + 1, Math.min(z.maxZ - 1, p.z));
  }

  inZone(p) {
    const z = this.def.zone;
    return p.x > z.minX && p.x < z.maxX && p.z > z.minZ && p.z < z.maxZ;
  }

  // Retorna true se capturou o jogador neste quadro.
  update(dt, player) {
    this.time += dt;
    this.stateTime += dt;
    if (this.dissolve > 0) {
      this.updateDissolve(dt);
      return false;
    }

    const playerInZone = this.inZone(player.pos);
    // Fora do domínio só um guardião já em perseguição continua olhando.
    const rate = !playerInZone && this.state !== 'chase' ? 0 : this.perceive(player);
    const seen = rate > 0;
    if (seen) {
      this.lastSeen.copy(player.pos);
      this.timeSinceSeen = 0;
      this.suspicion = Math.min(1, this.suspicion + rate * dt);
    } else {
      this.timeSinceSeen += dt;
    }
    this.outOfZone = playerInZone ? 0 : this.outOfZone + dt;

    let captured = false;
    switch (this.state) {
      case 'patrol': {
        if (seen) this.investigate.copy(player.pos);
        else this.suspicion = Math.max(0, this.suspicion - dt * 0.12);
        if (this.suspicion >= 1) { this.setState('chase'); break; }
        if (this.suspicion >= SUSPICIOUS_AT) { this.setState('suspicious'); break; }
        this.updatePatrol(dt);
        break;
      }
      case 'suspicious': {
        if (seen) {
          this.investigate.copy(player.pos);
          if (this.reached && player.horizontalSpeed > 0.5) this.reached = false;
        }
        if (this.suspicion >= 1) { this.setState('chase'); break; }
        if (this.stateTime < 0.6) {
          // pausa de alerta: vira para a origem da suspeita
          this.turnToward(Math.atan2(this.investigate.x - this.pos.x, this.investigate.z - this.pos.z), 5, dt);
        } else if (!this.reached) {
          this.moveTimer += dt;
          if (this.moveTo(this.investigate.x, this.investigate.z, SPEED.suspicious, dt) || this.moveTimer > 6) {
            this.reached = true;
            this.lookTimer = 0;
            this.baseYaw = this.yaw;
          }
        } else {
          this.lookAround(dt, 1.3);
        }
        if (!seen) this.suspicion = Math.max(0, this.suspicion - dt * (this.reached ? 0.16 : 0.05));
        if ((this.reached && this.lookTimer > 3.5 && this.suspicion < 0.35) || this.stateTime > 18) {
          this.setState('return');
        }
        break;
      }
      case 'chase': {
        if (seen) this.suspicion = 1;
        const target = seen ? player.pos : this.lastSeen;
        this.moveTo(target.x, target.z, SPEED.chase, dt);
        if (this.timeSinceSeen > 3.2 || this.outOfZone > 3) {
          this.investigate.copy(this.lastSeen);
          this.clampToZone(this.investigate);
          this.suspicion = 0.7;
          this.setState('suspicious');
          this.stateTime = 0.6;
          break;
        }
        const hd = Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        const vd = player.pos.y - this.pos.y;
        // Durante o Passo do Véu o andarilho está "dentro do véu" e escapa.
        if (hd < CAPTURE_RADIUS && vd > -1.5 && vd < 2.4 && player.state !== 'dash') captured = true;
        break;
      }
      case 'return': {
        if (seen) this.investigate.copy(player.pos);
        else this.suspicion = Math.max(0, this.suspicion - dt * 0.2);
        if (this.suspicion >= SUSPICIOUS_AT) { this.setState('suspicious'); break; }
        const wp = this.def.waypoints[this.wpIndex];
        if (this.moveTo(wp.x, wp.z, SPEED.return, dt)) {
          this.state = 'patrol';
          this.waitTimer = 0.8;
          this.baseYaw = this.yaw;
          this.onStateChange?.(this, 'patrol', 'return');
        }
        break;
      }
    }

    this.updateHeight(dt, player);
    this.updateVisuals(dt);
    return captured;
  }

  updatePatrol(dt) {
    const wps = this.def.waypoints;
    const wp = wps[this.wpIndex];
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      if (wp.look !== undefined) this.baseYaw = wp.look;
      this.lookAround(dt, wp.sweep ?? 0.8);
      if (this.waitTimer <= 0) this.wpIndex = (this.wpIndex + 1) % wps.length;
      return;
    }
    if (this.moveTo(wp.x, wp.z, SPEED.patrol, dt)) {
      this.waitTimer = wp.wait ?? 0;
      this.baseYaw = this.yaw;
      this.lookTimer = 0;
      if (this.waitTimer <= 0) this.wpIndex = (this.wpIndex + 1) % wps.length;
    }
  }

  updateHeight(dt, player) {
    const ground = this.world.groundBelow(this.pos.x, this.pos.z, 0.3, this.pos.y + 1.1, 60) ?? this.def.floorY;
    let desired = ground;
    if (this.state === 'chase') desired = Math.max(ground, Math.min(player.pos.y, ground + 4.5));
    const diff = desired - this.pos.y;
    const step = 5 * dt;
    this.pos.y += Math.max(-step, Math.min(step, diff));
    if (this.pos.y < ground - 0.01 && diff > 0) this.pos.y = Math.min(ground, this.pos.y + 8 * dt);
  }

  updateVisuals(dt) {
    const target = COLORS[this.state] ?? COLORS.patrol;
    this.color.lerp(target, 1 - Math.exp(-6 * dt));
    this.glowMat.color.copy(this.color).multiplyScalar(3.2);
    this.auraMat.color.copy(this.color);
    this.auraMat.opacity = 0.04 + 0.025 * Math.sin(this.time * 3) + (this.state === 'chase' ? 0.05 : 0);
    this.light.color.copy(this.color);
    this.light.intensity = this.state === 'chase' ? 12 : 6;

    const bob = Math.sin(this.time * 1.8) * 0.12;
    this.root.position.set(this.pos.x, this.pos.y + 0.15 + bob, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.body.rotation.x = this.state === 'chase' ? 0.25 : 0.05;
    this.halo.rotation.z = this.time * 0.6;
    this.lantern.rotation.z = Math.sin(this.time * 2.3) * 0.15;

    // Marcador
    let op = 0;
    if (this.state === 'chase') {
      this.markerMat.map = markerTex.e;
      op = 1;
    } else if (this.state === 'suspicious' || this.suspicion > 0.04) {
      this.markerMat.map = markerTex.q;
      op = this.state === 'suspicious' ? 1 : Math.min(1, this.suspicion * 2.5);
    }
    this.markerMat.opacity += (op - this.markerMat.opacity) * (1 - Math.exp(-10 * dt));
    const pulse = 1 + Math.sin(this.time * 8) * 0.06 * op;
    this.marker.scale.setScalar(0.8 * pulse);
    this.marker.visible = this.markerMat.opacity > 0.02;

    this.updateFan();
  }

  updateFan() {
    const ox = this.pos.x;
    const oy = this.pos.y + 1.3;
    const oz = this.pos.z;
    const fy = this.pos.y + 0.06;
    const c = this.color;
    const strength = this.state === 'chase' ? 0.3 : this.state === 'suspicious' ? 0.24 : 0.2;
    this.fanPos[0] = ox;
    this.fanPos[1] = fy;
    this.fanPos[2] = oz;
    this.fanCol[0] = c.r * strength;
    this.fanCol[1] = c.g * strength;
    this.fanCol[2] = c.b * strength;
    for (let i = 0; i <= FAN_SEGMENTS; i++) {
      const a = this.yaw - HALF_FOV + (i / FAN_SEGMENTS) * HALF_FOV * 2;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const hit = this.world.raycast(ox, oy, oz, dx, 0, dz, VIEW_RANGE, SOLID);
      const d = hit ? hit.t : VIEW_RANGE;
      const j = (i + 1) * 3;
      this.fanPos[j] = ox + dx * d;
      this.fanPos[j + 1] = fy;
      this.fanPos[j + 2] = oz + dz * d;
      const fade = strength * 0.3 * (1 - (d / VIEW_RANGE) * 0.5);
      this.fanCol[j] = c.r * fade;
      this.fanCol[j + 1] = c.g * fade;
      this.fanCol[j + 2] = c.b * fade;
    }
    const g = this.fan.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.computeBoundingSphere();
  }

  dispose() {
    this.scene.remove(this.root);
    this.scene.remove(this.fan);
    this.root.traverse((o) => o.geometry?.dispose());
    this.fan.geometry.dispose();
  }

  // Desfaz o guardião ao fim da fase.
  startDissolve() {
    this.dissolve = 0.0001;
  }

  updateDissolve(dt) {
    this.dissolve += dt;
    const t = Math.min(this.dissolve / 2, 1);
    this.robeMat.opacity = 1 - t;
    this.darkMat.opacity = 1 - t;
    this.auraMat.opacity = 0.2 * (1 - t);
    this.glowMat.color.setRGB(1, 2, 4).multiplyScalar(1 - t);
    this.light.intensity = 6 * (1 - t);
    this.root.position.y = this.pos.y + 0.15 + t * 1.5;
    this.body.scale.set(1 - t * 0.6, 1 + t * 0.4, 1 - t * 0.6);
    this.markerMat.opacity = 0;
    this.fan.visible = false;
    if (t >= 1) this.root.visible = false;
  }
}
