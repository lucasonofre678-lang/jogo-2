// Câmera em terceira (ou primeira) pessoa: segue o jogador com suavização,
// evita atravessar paredes e reage à velocidade (FOV e distância), ao Passo
// do Véu e às aterrissagens.
import * as THREE from 'three';
import { ALL } from './physics.js';

const SENSITIVITY = 0.0024;
const MIN_PITCH = -0.45;
const MAX_PITCH = 1.15;
const FP_PITCH = 1.35;

export class CameraController {
  constructor(camera, world) {
    this.camera = camera;
    this.world = world;
    this.yaw = 0;
    this.pitch = 0.28;
    this.distance = 5.4;
    this.currentDist = 5.4;
    this.focus = new THREE.Vector3();
    this.shake = 0;
    this.dip = 0;
    this.roll = 0; // inclina a imagem na corrida na parede
    this.baseFov = 68;
    this.fov = 68;
    this.firstPerson = false;
    this.sensitivity = 1;
    this.padSensitivity = 1;
    this.invertY = false;
    this.shakeScale = 1;
    this.tmp = new THREE.Vector3();
    this.dir = new THREE.Vector3();
  }

  handleMouse(dx, dy) {
    const s = SENSITIVITY * this.sensitivity;
    if (this.invertY) dy = -dy;
    this.yaw -= dx * s;
    if (this.firstPerson) this.pitch = THREE.MathUtils.clamp(this.pitch + dy * s, -FP_PITCH, FP_PITCH);
    else this.pitch = THREE.MathUtils.clamp(this.pitch + dy * s, MIN_PITCH, MAX_PITCH);
  }

  // Analógico direito: x, y em -1..1 (curva quadrática para mira fina)
  handlePad(x, y, dt) {
    if (!x && !y) return;
    const k = this.padSensitivity / (SENSITIVITY * this.sensitivity);
    this.handleMouse(Math.sign(x) * x * x * 3.2 * k * dt, Math.sign(y) * y * y * 2.2 * k * dt);
  }

  setFirstPerson(on) {
    this.firstPerson = on;
    if (!on) this.pitch = THREE.MathUtils.clamp(this.pitch, MIN_PITCH, MAX_PITCH);
  }

  snap(playerPos, yaw = this.yaw) {
    this.yaw = yaw;
    this.pitch = this.firstPerson ? 0.05 : 0.28;
    this.focus.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
    this.currentDist = this.distance;
    this.dip = 0;
    this.shake = 0;
  }

  // Direção "para frente" no plano do chão, a partir da câmera.
  forward(out) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  right(out) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  addShake(amount) {
    this.shake = Math.min(1, this.shake + amount * this.shakeScale);
  }

  addDip(amount) {
    this.dip = Math.min(0.6, this.dip + amount);
  }

  update(dt, player) {
    const speed = player.state === 'dash' ? 34 : player.worldSpeed;
    const speedK = THREE.MathUtils.clamp((speed - 8) / 18, 0, 1);
    const crouchOffset = player.state === 'slide' ? 0.9 : player.sneaking || player.low ? 1.1 : 1.5;
    const tx = player.pos.x;
    const ty = player.pos.y + (this.firstPerson ? (player.sneaking || player.low ? 0.8 : 1.62) : crouchOffset);
    const tz = player.pos.z;
    const kxz = this.firstPerson ? 1 : 1 - Math.exp(-22 * dt);
    const ky = this.firstPerson ? 1 - Math.exp(-30 * dt) : 1 - Math.exp(-(player.grounded ? 12 : 8) * dt);
    this.focus.x += (tx - this.focus.x) * kxz;
    this.focus.z += (tz - this.focus.z) * kxz;
    this.focus.y += (ty - this.focus.y) * ky;
    // Nunca deixa o foco ficar longe demais (ex.: após o avanço).
    const lag = Math.hypot(tx - this.focus.x, tz - this.focus.z);
    if (lag > 2.5) {
      const f = 1 - 2.5 / lag;
      this.focus.x += (tx - this.focus.x) * f;
      this.focus.z += (tz - this.focus.z) * f;
    }

    this.dip += (0 - this.dip) * (1 - Math.exp(-6 * dt));
    this.shake = Math.max(0, this.shake - dt * 1.8);

    const cp = Math.cos(this.pitch);
    this.dir.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const fy = this.focus.y - this.dip;
    const cam = this.camera;

    if (this.firstPerson) {
      cam.position.set(this.focus.x, fy, this.focus.z);
      this.tmp.set(this.focus.x - this.dir.x, fy - this.dir.y, this.focus.z - this.dir.z);
    } else {
      const want = this.distance + speedK * 1.6;
      // Barreiras do Véu também seguram a câmera (atravessá-las ofusca a visão).
      const hit = this.world.raycast(this.focus.x, fy, this.focus.z, this.dir.x, this.dir.y, this.dir.z, want + 0.3, ALL);
      const rampT = this.world.raycastRamps(this.focus.x, fy, this.focus.z, this.dir.x, this.dir.y, this.dir.z, want + 0.3);
      const t = Math.min(hit ? hit.t : Infinity, rampT ?? Infinity);
      const wanted = isFinite(t) ? Math.max(0.7, t - 0.3) : want;
      if (wanted < this.currentDist) this.currentDist = wanted;
      else this.currentDist += (wanted - this.currentDist) * (1 - Math.exp(-3.5 * dt));
      cam.position.set(
        this.focus.x + this.dir.x * this.currentDist,
        fy + this.dir.y * this.currentDist,
        this.focus.z + this.dir.z * this.currentDist,
      );
      this.tmp.set(this.focus.x, fy, this.focus.z);
    }
    if (this.shake > 0) {
      const s = this.shake * this.shake * 0.25;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
    }
    cam.lookAt(this.tmp);
    // correndo na parede, o horizonte inclina para longe dela
    const rollTarget = player.state === 'wallrun' ? (player.wallSide ?? player.wallRunSide()) * 0.085 : 0;
    this.roll += (rollTarget - this.roll) * (1 - Math.exp(-7 * dt));
    if (Math.abs(this.roll) > 0.001) cam.rotateZ(this.roll);

    let fovTarget = this.baseFov + speedK * 22;
    if (player.state === 'dash') fovTarget = 92;
    this.fov += (fovTarget - this.fov) * (1 - Math.exp(-(player.state === 'dash' ? 18 : 6) * dt));
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
    return speedK;
  }

  // Câmera livre para cenas (tela título e final).
  cinematic(pos, look, dt, k = 2) {
    const cam = this.camera;
    const f = dt <= 0 ? 1 : 1 - Math.exp(-k * dt);
    cam.position.lerp(pos, f);
    this.tmp.lerp(look, f);
    cam.lookAt(this.tmp);
    if (Math.abs(cam.fov - this.baseFov) > 0.01) {
      cam.fov = this.fov = this.baseFov;
      cam.updateProjectionMatrix();
    }
  }
}
