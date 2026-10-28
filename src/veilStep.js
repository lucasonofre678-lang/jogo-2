// PASSO DO VÉU (tecla Q): avanço rápido na direção do movimento que deixa um
// rastro azul, atravessa barreiras mágicas (mas não paredes sólidas), pode ser
// usado uma vez no ar e libera um eco que alerta guardiões próximos.
import * as THREE from 'three';
import { RADIUS, HEIGHT } from './player.js';

export const VEIL_COOLDOWN = 0.9;
export const ECHO_RADIUS = 16;
const ECHO_STRENGTH = 0.65;

const dir = new THREE.Vector3();

export class VeilStep {
  constructor(game) {
    this.game = game;
    this.cooldown = 0;
    this.ghostTimer = 0;
    this.denied = 0;
    this.uses = 0;
  }

  reset() {
    this.cooldown = 0;
    this.denied = 0;
    this.uses = 0;
  }

  // Disponível agora? (usado também pela interface)
  get ready() {
    return this.cooldown <= 0 && this.game.player.canDash();
  }

  get fraction() {
    return 1 - Math.max(0, this.cooldown) / VEIL_COOLDOWN;
  }

  tryActivate(move, camForward) {
    const { player, effects, audio } = this.game;
    if (!this.ready) {
      this.denied = 0.35;
      audio.denied();
      return false;
    }
    if (move.lengthSq() > 0.01) dir.set(move.x, 0, move.z).normalize();
    else dir.set(camForward.x, 0, camForward.z).normalize();

    player.startDash(dir);
    this.cooldown = VEIL_COOLDOWN;
    this.ghostTimer = 0;
    this.uses++;

    const p = player.pos;
    effects.ring(p.x, p.y, p.z, ECHO_RADIUS * 0.55, 1.1);
    effects.sparks(p.x, p.y + 1, p.z, 24, { speed: 4, life: 0.7, spread: 0.6, whiteChance: 0.1 });
    audio.veil();
    // O eco mágico: ruído forte que os guardiões ouvem de longe.
    this.game.emitNoise(p.x, p.y + 1, p.z, ECHO_RADIUS, ECHO_STRENGTH);
    this.game.cam.addShake(0.15);
    return true;
  }

  update(dt) {
    const { player, effects, level } = this.game;
    this.cooldown -= dt;
    this.denied = Math.max(0, this.denied - dt);

    if (player.state === 'dash') {
      this.ghostTimer -= dt;
      if (this.ghostTimer <= 0) {
        effects.ghost();
        this.ghostTimer = 0.038;
      }
      const p = player.pos;
      effects.sparks(p.x, p.y + 0.9, p.z, 2, {
        speed: 1.2, life: 0.6, spread: 0.7, gravity: -0.8,
        vx: -player.dashDir.x * 3, vz: -player.dashDir.z * 3,
      });
      // Atravessando uma barreira: faz ela ondular e soltar faíscas.
      for (const vb of level.veilBarriers) {
        if (!vb.collider.enabled) continue;
        const c = vb.collider;
        if (p.x + RADIUS > c.minX && p.x - RADIUS < c.maxX && p.z + RADIUS > c.minZ && p.z - RADIUS < c.maxZ
          && p.y < c.maxY && p.y + HEIGHT > c.minY) {
          if (vb.flash < 0.5) {
            this.game.audio.veilPass();
            this.game.flowMove('travessia');
          }
          vb.flash = 1;
          effects.sparks(p.x, p.y + 1, p.z, 4, { speed: 5, life: 0.9, spread: 1.4, whiteChance: 0.2 });
        }
      }
    }
  }
}
