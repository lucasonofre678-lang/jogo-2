// O Andarilho: controlador em terceira pessoa feito para velocidade.
//   corrida como padrão (Shift anda, C se esgueira), salto variável, coyote
//   time, controle aéreo que preserva o momento, pulo na parede, agarrar e
//   escalar bordas, deslizar (C correndo), Gancho do Véu (balançar em
//   âncoras), correntes de vento, Passo do Véu (estado de avanço),
//   plataformas móveis que carregam o jogador (e o arremessam quando batem),
//   trampolins, surf em rampas inclinadas (como no surf do CS), corrida na
//   parede (muros rúnicos) e Fios de Luz (tirolesas).
// O visual (modelo, tecido e animações) fica em character.js.
// A velocidade do jogador é relativa à plataforma em que ele está de pé; ao
// sair dela, a velocidade da plataforma é somada (herança de momento).
import * as THREE from 'three';
import { PhysicsWorld, SOLID, VEIL, ALL } from './physics.js';
import { SKINS } from './skins.js';
import { Character, ROLL_TIME } from './character.js';

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

// surf: rampas íngremes sem atrito; segure contra a rampa para não cair
export const SURF_MAX = 50;
// "air strafe" (como no CS): logo depois de surfar, virar o mouse segurando
// A/D no ar ganha velocidade. Cada quadro só soma até SURF_WISH na direção
// pedida; perpendicular à velocidade, isso faz o vetor crescer.
const SURF_AIR_TIME = 1.4;
const SURF_WISH = 2.4;
const SURF_AIR_ACCEL = 140;
const SURF_JUMP = 7.5;
const SURF_ACCEL = 45; // controle forte contra a rampa (como o airaccelerate alto dos servidores de surf)
const SURF_GRAVITY = 0.55; // fração da gravidade enquanto surfa
const SURF_LAND_SOAK = 0.7; // quanto do escorregão some ao pousar na rampa
const SURF_RADIUS = 0.42;
const FLIP_SPEED = 12.5; // saltar mais rápido que isso dá cambalhota

// corrida na parede (só nos muros rúnicos): entrando de lado no ar, o
// andarilho corre pela parede; a gravidade volta aos poucos e saltar lança
// para o lado oposto (dá para ir de parede em parede)
const WALLRUN_MIN_SPEED = 5.5;
const WALLRUN_SPEED = 11.5;
const WALLRUN_TIME = 1.35;
const WALLRUN_JUMP_OUT = 7.5;
const WALLRUN_JUMP_UP = 8.6;
const WALLRUN_COYOTE = 0.16; // ainda dá para saltar logo depois que a parede acaba

// Fios de Luz: segure E perto de um fio para deslizar pendurado; a
// inclinação acelera (descida) ou freia (subida) e o fim do fio lança você
export const ZIP_RANGE = 2.4;
const ZIP_MIN_SPEED = 5;
const ZIP_MAX_SPEED = 22;
const ZIP_DRAG = 0.2;
const ZIP_JUMP_UP = 7.5;
const ZIP_END_UP = 4.5;

function damp(a, b, k, dt) {
  return a + (b - a) * (1 - Math.exp(-k * dt));
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export class Player {
  constructor(scene, world) {
    this.world = world;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.state = 'normal'; // normal | hang | climb | dash | slide | swing | wallrun | zip
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
    this.wallRun = { nx: 0, nz: 0, tx: 0, tz: 0, speed: 0, t: 0 };
    this.runCol = null; // muro rúnico encostado neste quadro
    this.runNx = 0;
    this.runNz = 0;
    this.lastRunNx = 0;
    this.lastRunNz = 0;
    this.runCoyote = 0;
    this.zips = [];
    this.zip = { line: null, u: 0, speed: 0 };
    this.zipU = 0;
    this.zipCooldown = 0;
    this.wind = null;
    this.impactSpeed = 0;
    this.fallStartY = 0;
    this.roll = 0;
    this.celebrate = false;
    this.veilCharge = 1;
    this.surfing = false;
    this.surfTimer = 0;
    this.surfNormal = new THREE.Vector3(0, 1, 0);

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
    this.onWallRun = null;
    this.onZip = null;

    this.model = new Character(scene);
    this.root = this.model.root;
    this.setSkin(SKINS[0]);
  }

  // ------------------------------------------------------------------ visual
  setSkin(skin) {
    this.skin = skin;
    this.model.setSkin(skin);
  }

  // Mostra/esconde o andarilho inteiro (primeira pessoa, menus).
  setVisible(v) {
    this.model.setVisible(v);
  }

  get cloakMat() {
    return this.model.cloakMat;
  }

  get trimMat() {
    return this.model.trimMat;
  }

  get eyeMat() {
    return this.model.eyeMat;
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
    this.wake = 0;
    this.swing.anchor = null;
    this.zip.line = null;
    this.lastRunNx = this.lastRunNz = 0;
    this.runCoyote = 0;
    this.zipCooldown = 0;
    this.facing = yaw + Math.PI; // de costas para a câmera
    this.fallStartY = pos.y;
    this.surfing = false;
    this.surfTimer = 0;
    this.cloakMat.emissiveIntensity = 0;
    this.model.reset();
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
    return this.grounded || this.coyote > 0 || !this.airDashUsed || this.state === 'swing' || this.state === 'zip' || this.state === 'wallrun';
  }

  startDash(dir) {
    let cx = 0;
    let cz = 0;
    if (this.grounded && this.groundCol) {
      cx = this.groundCol.vx;
      cz = this.groundCol.vz;
    }
    if (this.state === 'swing') this.releaseSwing(false);
    if (this.state === 'zip') this.leaveZip(false);
    if (this.state === 'wallrun') this.endWallRun();
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
    if (this.state === 'zip') this.leaveZip(false);
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
    this.surfTimer -= dt;
    this.surfing = this.surfTimer > 0 && !this.grounded && this.state === 'normal';
    this.prevGrounded = this.grounded;
    this.grabCooldown -= dt;
    this.coyote -= dt;
    this.jumpBuffer -= dt;
    this.wallTimer -= dt;
    this.wallLock -= dt;
    this.runCoyote -= dt;
    this.zipCooldown -= dt;
    if (ctrl.jumpPressed) this.jumpBuffer = JUMP_BUFFER;

    const moveLen = Math.hypot(ctrl.move.x, ctrl.move.z);
    this.sneaking = ((ctrl.sneak && this.state === 'normal') || (this.low && this.state === 'normal')) && this.grounded;
    this.sprinting = !ctrl.sneak && !ctrl.walk && moveLen > 0.1;
    if (this.state !== 'slide' && this.low && !(ctrl.sneak && this.grounded)) this.tryStand();
    // agachado (esgueirando) também cabe em passagens baixas
    if (ctrl.sneak && this.grounded && this.state === 'normal') this.height = SLIDE_HEIGHT;

    this.applyCarry();

    // E: um Fio de Luz ao alcance tem preferência sobre as âncoras; segurando
    // E no ar, o andarilho agarra o fio sozinho ao passar perto dele
    if (ctrl.grapplePressed && this.state !== 'swing' && this.state !== 'zip') {
      if (!this.tryZip()) this.tryGrapple();
    } else if (ctrl.grappleHeld && !this.grounded && this.zipCooldown <= 0 && (this.state === 'normal' || this.state === 'wallrun')) {
      this.tryZip();
    }

    if (this.state === 'hang') this.updateHang(dt, ctrl);
    else if (this.state === 'wallrun') this.updateWallRun(dt, ctrl);
    else if (this.state === 'zip') this.updateZip(dt, ctrl);
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
      const surfAir = !this.surfing && this.surfTimer > -SURF_AIR_TIME && this.airSpeedCap > RUN;
      const acc = this.surfing ? SURF_ACCEL : AIR_ACCEL;
      this.vel.x += ax * acc * dt;
      this.vel.z += az * acc * dt;
      if (moveLen < 0.05 && !this.surfing && !surfAir) {
        const k = Math.max(0, 1 - AIR_IDLE_DRAG * dt);
        this.vel.x *= k;
        this.vel.z *= k;
      }
      if (this.surfing) this.airSpeedCap = Math.min(SURF_MAX, Math.max(this.airSpeedCap, this.horizontalSpeed));
      const cap = Math.min(this.surfing || surfAir ? SURF_MAX : MAX_AIR_SPEED, Math.max(speed, this.airSpeedCap));
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (hs > cap) {
        this.vel.x *= cap / hs;
        this.vel.z *= cap / hs;
      }
      if (surfAir) {
        // ganho do strafe: só soma na direção pedida até SURF_WISH
        const al = Math.hypot(ax, az);
        if (al > 0.05) {
          const wx = ax / al;
          const wz = az / al;
          const add = SURF_WISH * al - (this.vel.x * wx + this.vel.z * wz);
          if (add > 0) {
            const a = Math.min(SURF_AIR_ACCEL * dt, add);
            this.vel.x += wx * a;
            this.vel.z += wz * a;
          }
        }
        this.airSpeedCap = Math.min(SURF_MAX, Math.max(this.airSpeedCap, this.horizontalSpeed));
      }
    }
    this.applyWind(dt);

    // Salto (com buffer e coyote time) ou pulo na parede
    if (this.jumpBuffer > 0 && (this.grounded || this.coyote > 0) && !this.low) {
      this.doJump(speed);
    } else if (this.jumpBuffer > 0 && !this.grounded && this.runCoyote > 0) {
      this.wallRunJump();
    } else if (this.jumpBuffer > 0 && !this.grounded && this.wallTimer > 0 && this.canWallJump()) {
      this.wallJump();
    } else if (this.jumpBuffer > 0 && this.surfing) {
      // salto para fora da rampa
      const n = this.surfNormal;
      this.vel.x += n.x * SURF_JUMP;
      this.vel.y = Math.max(this.vel.y, 0) + 4 + n.y * SURF_JUMP * 0.5;
      this.vel.z += n.z * SURF_JUMP;
      this.jumpBuffer = 0;
      this.surfing = false;
      this.surfTimer = 0;
      this.airSpeedCap = Math.min(SURF_MAX, this.horizontalSpeed);
      this.jumping = false;
      this.onJump?.();
    }
    // Salto variável: soltar o botão corta a subida.
    if (this.jumping && !ctrl.jumpHeld && this.vel.y > 0 && !this.jumpCut) {
      this.vel.y *= JUMP_CUT;
      this.jumpCut = true;
    }
    if (this.vel.y <= 0) this.jumping = false;

    // Gravidade em duas metades (antes e depois do movimento): a altura do
    // salto fica igual em 30, 60 ou 144 fps.
    const g = this.surfing ? GRAVITY * SURF_GRAVITY : this.vel.y < 0 ? GRAVITY * FALL_MULT : GRAVITY;
    this.vel.y = Math.max(this.vel.y - g * dt * 0.5, -MAX_FALL);

    const before = this.grounded ? this.groundCol : null;
    const wasGrounded = this.grounded;
    this.move(dt, false);
    if (!this.grounded) this.vel.y = Math.max(this.vel.y - g * dt * 0.5, -MAX_FALL);
    this.convertFrame(before, this.grounded ? this.groundCol : null);

    if (this.runCol && !this.grounded && this.canWallRun(ctrl, moveLen)) {
      this.startWallRun();
      return;
    }

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
    if (this.horizontalSpeed > FLIP_SPEED) this.model.startFlip('front');
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
    this.model.startFlip(Math.random() < 0.5 ? 'twistL' : 'twistR');
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

  // ------------------------------------------------------------ parede
  canWallRun(ctrl, moveLen) {
    if (this.state !== 'normal' || this.surfing || moveLen < 0.3 || this.vel.y < -14) return false;
    const nx = this.runNx;
    const nz = this.runNz;
    // a mesma parede só de novo depois de pousar (não dá para escalar saltando)
    if (nx * this.lastRunNx + nz * this.lastRunNz > 0.7) return false;
    // pedindo para sair da parede
    if (ctrl.move.x * nx + ctrl.move.z * nz > 0.4) return false;
    const vn = this.vel.x * nx + this.vel.z * nz;
    return Math.hypot(this.vel.x - vn * nx, this.vel.z - vn * nz) >= WALLRUN_MIN_SPEED;
  }

  startWallRun() {
    const w = this.wallRun;
    const nx = this.runNx;
    const nz = this.runNz;
    const vn = this.vel.x * nx + this.vel.z * nz;
    const tx = this.vel.x - vn * nx;
    const tz = this.vel.z - vn * nz;
    const sp = Math.hypot(tx, tz);
    w.nx = nx;
    w.nz = nz;
    w.tx = tx / sp;
    w.tz = tz / sp;
    w.t = 0;
    w.speed = Math.max(sp, Math.min(WALLRUN_SPEED, sp + 3));
    this.state = 'wallrun';
    this.vel.y = Math.max(this.vel.y * 0.4, 3.4);
    this.jumping = false;
    this.airDashUsed = false;
    this.wallSliding = false;
    this.onWallRun?.(this.wallRunSide());
  }

  // 1: parede à direita do andarilho, -1: à esquerda
  wallRunSide() {
    const w = this.wallRun;
    // direita de quem olha para (tx, tz) = (-tz, tx); a parede fica em -n
    return w.nx * w.tz - w.nz * w.tx >= 0 ? 1 : -1;
  }

  updateWallRun(dt, ctrl) {
    const w = this.wallRun;
    w.t += dt;
    // segurar para frente mantém a corrida; soltar desacelera
    const fwdIn = ctrl.move.x * w.tx + ctrl.move.z * w.tz;
    const target = fwdIn > 0.2 ? WALLRUN_SPEED : 2;
    w.speed += (target - w.speed) * Math.min(1, (w.speed > target ? 0.8 : 2.5) * dt);
    if (this.jumpBuffer > 0) {
      this.wallRunJump();
      return;
    }
    // a gravidade volta aos poucos
    const k = Math.min(1, w.t / WALLRUN_TIME);
    this.vel.y = Math.max(this.vel.y - GRAVITY * (0.1 + 0.75 * k * k * k) * dt, -MAX_FALL);
    this.vel.x = w.tx * w.speed - w.nx * 1.5; // encosta na parede
    this.vel.z = w.tz * w.speed - w.nz * 1.5;
    this.move(dt, false);
    this.stepPhase += dt * (5 + w.speed * 1.05);
    const idx = Math.floor(this.stepPhase / Math.PI);
    if (idx !== this.lastStepIndex) {
      this.lastStepIndex = idx;
      this.onStep?.('run');
    }
    if (this.grounded) {
      this.state = 'normal';
      this.vel.x = w.tx * w.speed;
      this.vel.z = w.tz * w.speed;
      return;
    }
    const away = ctrl.move.x * w.nx + ctrl.move.z * w.nz;
    const onWall = this.runCol && this.runNx * w.nx + this.runNz * w.nz > 0.9;
    if (!onWall || w.t > WALLRUN_TIME || w.speed < 3 || away > 0.6) {
      this.endWallRun();
      // a parede acabou: um instante para ainda saltar dela
      if (!onWall) this.runCoyote = WALLRUN_COYOTE;
    }
  }

  endWallRun() {
    const w = this.wallRun;
    this.state = 'normal';
    this.vel.x = w.tx * w.speed + w.nx * 1.2;
    this.vel.z = w.tz * w.speed + w.nz * 1.2;
    this.lastRunNx = w.nx;
    this.lastRunNz = w.nz;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, w.speed));
    this.fallStartY = this.pos.y;
    this.wallTimer = 0;
  }

  wallRunJump() {
    const w = this.wallRun;
    this.state = 'normal';
    this.runCoyote = 0;
    this.vel.x = w.tx * w.speed + w.nx * WALLRUN_JUMP_OUT;
    this.vel.z = w.tz * w.speed + w.nz * WALLRUN_JUMP_OUT;
    this.vel.y = WALLRUN_JUMP_UP;
    // nem correr nem pular de novo nesta mesma parede antes de pousar
    this.lastRunNx = this.lastWallNx = w.nx;
    this.lastRunNz = this.lastWallNz = w.nz;
    this.wallNx = w.nx;
    this.wallNz = w.nz;
    this.wallLock = 0.22;
    this.wallTimer = 0;
    this.jumpBuffer = 0;
    this.jumping = true;
    this.jumpCut = false;
    this.airDashUsed = false;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, Math.hypot(this.vel.x, this.vel.z)));
    this.facing = Math.atan2(this.vel.x, this.vel.z);
    this.fallStartY = this.pos.y;
    this.model.startFlip(this.wallRunSide() > 0 ? 'twistL' : 'twistR');
    this.onWallJump?.();
  }

  // ------------------------------------------------------------ fios
  // Fio de Luz mais perto das mãos (guarda em zipU o ponto do fio).
  findZip() {
    let best = null;
    let bestD = ZIP_RANGE;
    const hx = this.pos.x;
    const hy = this.pos.y + HAND_Y;
    const hz = this.pos.z;
    for (const z of this.zips) {
      const u = THREE.MathUtils.clamp((hx - z.a.x) * z.dir.x + (hy - z.a.y) * z.dir.y + (hz - z.a.z) * z.dir.z, 0.3, z.len - 0.6);
      const d = Math.hypot(z.a.x + z.dir.x * u - hx, z.a.y + z.dir.y * u - hy, z.a.z + z.dir.z * u - hz);
      if (d < bestD) {
        bestD = d;
        best = z;
        this.zipU = u;
      }
    }
    return best;
  }

  tryZip() {
    if (this.state === 'hang' || this.state === 'climb' || this.state === 'dash' || this.state === 'zip') return false;
    const z = this.findZip();
    if (!z) return false;
    if (this.state === 'slide') this.tryStand();
    if (this.state === 'swing') this.swing.anchor = null;
    if (this.grounded && this.groundCol) this.convertFrame(this.groundCol, null);
    const d = z.dir;
    let s = this.vel.x * d.x + this.vel.y * d.y + this.vel.z * d.z;
    // começa ao menos na velocidade mínima: a favor da descida (ou do embalo)
    if (Math.abs(s) < ZIP_MIN_SPEED) s = (Math.abs(d.y) > 0.03 ? -Math.sign(d.y) : Math.sign(s) || 1) * ZIP_MIN_SPEED;
    this.state = 'zip';
    this.zip.line = z;
    this.zip.u = this.zipU;
    this.zip.speed = s;
    this.grounded = false;
    this.groundCol = null;
    this.jumping = false;
    this.airDashUsed = false;
    this.height = HEIGHT;
    this.onZip?.(z);
    return true;
  }

  updateZip(dt, ctrl) {
    const zp = this.zip;
    const z = zp.line;
    if (!ctrl.grappleHeld) {
      this.leaveZip(false);
      return;
    }
    if (this.jumpBuffer > 0) {
      this.leaveZip(true);
      return;
    }
    // a inclinação acelera ou freia; W/S empurram de leve
    zp.speed -= GRAVITY * z.dir.y * dt;
    zp.speed += (ctrl.move.x * z.dir.x + ctrl.move.z * z.dir.z) * 4 * dt;
    zp.speed -= zp.speed * ZIP_DRAG * dt;
    zp.speed = THREE.MathUtils.clamp(zp.speed, -ZIP_MAX_SPEED, ZIP_MAX_SPEED);
    zp.u += zp.speed * dt;
    const end = zp.u >= z.len || zp.u <= 0;
    zp.u = THREE.MathUtils.clamp(zp.u, 0, z.len);
    this.pos.set(z.a.x + z.dir.x * zp.u, z.a.y + z.dir.y * zp.u - HAND_Y - 0.08, z.a.z + z.dir.z * zp.u);
    this.vel.set(z.dir.x * zp.speed, z.dir.y * zp.speed, z.dir.z * zp.speed);
    this.fallStartY = this.pos.y;
    if (end) this.leaveZip(false, true);
  }

  // jump: salto para fora · atEnd: o fio acabou e lança o andarilho
  leaveZip(jump, atEnd = false) {
    const z = this.zip.line;
    const s = this.zip.speed;
    this.state = 'normal';
    this.zip.line = null;
    if (z) this.vel.set(z.dir.x * s, z.dir.y * s, z.dir.z * s);
    if (jump) this.vel.y = Math.max(this.vel.y, 0) + ZIP_JUMP_UP;
    else if (atEnd) this.vel.y = Math.max(this.vel.y, 0) + ZIP_END_UP;
    this.jumpBuffer = 0;
    this.jumping = false;
    this.airDashUsed = false;
    this.zipCooldown = 0.4;
    this.airSpeedCap = Math.min(MAX_AIR_SPEED, Math.max(RUN, this.horizontalSpeed));
    this.fallStartY = this.pos.y;
    this.onRelease?.(jump || atEnd);
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
    this.runCol = null;

    for (let s = 0; s < steps; s++) {
      this.pos.x += this.vel.x * h;
      this.pos.z += this.vel.z * h;
      this.resolveHorizontal(mask, wasGrounded || this.grounded ? STEP_UP : 0.25, !wasGrounded && !this.grounded);

      const before = this.pos.y;
      this.pos.y += this.vel.y * h;
      this.resolveVertical(mask, before);
      if (this.world.ramps.length) this.resolveRamps();
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
          // muro rúnico cobrindo o corpo: dá para correr nele
          if (c.runnable && c.maxY > this.pos.y + 1.3 && c.minY < this.pos.y + 0.5) {
            this.runCol = c;
            this.runNx = push.nx;
            this.runNz = push.nz;
          }
        }
        any = true;
      }
      if (!any) break;
    }
  }

  // Rampas de surf: empurra para fora da face e tira a velocidade que entra
  // nela. Sem atrito: a gravidade escorrega o jogador pela face.
  resolveRamps() {
    const r = SURF_RADIUS;
    const cy = this.pos.y + r;
    for (const ramp of this.world.ramps) {
      if (!ramp.enabled) continue;
      const hit = ramp.contact(this.pos.x, cy, this.pos.z, r) ?? ramp.insidePush(this.pos.x, this.pos.y, this.pos.z, RADIUS, this.height);
      if (!hit) continue;
      if (hit.solid) {
        // bateu na ponta ou por baixo: só sai, sem surfar
        this.pos.x += hit.nx * hit.depth;
        this.pos.y += hit.ny * hit.depth;
        this.pos.z += hit.nz * hit.depth;
        const vin = this.vel.x * hit.nx + this.vel.y * hit.ny + this.vel.z * hit.nz;
        if (vin < 0) {
          this.vel.x -= hit.nx * vin;
          this.vel.y -= hit.ny * vin;
          this.vel.z -= hit.nz * vin;
        }
        continue;
      }
      this.pos.x += hit.nx * hit.depth;
      this.pos.y += hit.ny * hit.depth;
      this.pos.z += hit.nz * hit.depth;
      const vn = this.vel.x * hit.nx + this.vel.y * hit.ny + this.vel.z * hit.nz;
      if (vn < 0) {
        this.vel.x -= hit.nx * vn;
        this.vel.y -= hit.ny * vn;
        this.vel.z -= hit.nz * vn;
      }
      if (this.surfTimer <= 0) {
        // pouso macio: absorve boa parte do escorregão face abaixo
        const gx = hit.nx * hit.ny;
        const gy = hit.ny * hit.ny - 1;
        const gz = hit.nz * hit.ny;
        const gl = Math.hypot(gx, gy, gz) || 1;
        const vd = (this.vel.x * gx + this.vel.y * gy + this.vel.z * gz) / gl;
        if (vd > 0) {
          const k = (vd * SURF_LAND_SOAK) / gl;
          this.vel.x -= gx * k;
          this.vel.y -= gy * k;
          this.vel.z -= gz * k;
        }
        this.onSurf?.();
      }
      this.surfTimer = 0.14;
      this.surfNormal.set(hit.nx, hit.ny, hit.nz);
      this.airDashUsed = false;
      this.jumping = false;
      this.fallStartY = this.pos.y;
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
    this.lastRunNx = this.lastRunNz = 0;
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
    let targetFacing = this.facing;
    if (this.state === 'normal' && hs > 0.4) targetFacing = Math.atan2(this.vel.x, this.vel.z);
    if (this.state === 'swing' && hs > 0.5) targetFacing = Math.atan2(this.vel.x, this.vel.z);
    if (this.state === 'slide') targetFacing = Math.atan2(this.slide.dir.x, this.slide.dir.z);
    if (this.state === 'dash') targetFacing = Math.atan2(this.dashDir.x, this.dashDir.z);
    if (this.state === 'hang' || this.state === 'climb') targetFacing = Math.atan2(-this.hang.nx, -this.hang.nz);
    if (this.wallSliding) targetFacing = Math.atan2(-this.wallNx, -this.wallNz);
    if (this.state === 'wallrun') targetFacing = Math.atan2(this.wallRun.tx, this.wallRun.tz);
    if (this.state === 'zip' && this.zip.line) {
      const d = this.zip.line.dir;
      const sg = this.zip.speed >= 0 ? 1 : -1;
      if (Math.hypot(d.x, d.z) > 0.05) targetFacing = Math.atan2(d.x * sg, d.z * sg);
    }
    this.facing += wrapAngle(targetFacing - this.facing) * (1 - Math.exp(-14 * dt));
    this.model.update(dt, this, this.world);
  }

}
