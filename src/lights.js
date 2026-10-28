// Luzes pontuais em vagas fixas. O three.js recompila os shaders de todos os
// materiais iluminados sempre que muda a quantidade de luzes na cena (um
// rastro do Passo do Véu, a Sombra aparecendo, um fragmento coletado...) e
// cada luz a mais pesa em cada pixel. As luzes do jogo (PoolLight) são só
// marcadores: a cada quadro as mais próximas ocupam um número fixo de luzes
// reais, então a quantidade nunca muda e os shaders compilam uma vez só.
import * as THREE from 'three';

export class PoolLight extends THREE.Object3D {
  constructor(color = 0xffffff, intensity = 1, distance = 0, decay = 2) {
    super();
    this.isPoolLight = true;
    this.type = 'PoolLight';
    this.color = new THREE.Color(color);
    this.intensity = intensity;
    this.distance = distance;
    this.decay = decay;
    this.weight = 0; // aparece aos poucos ao ganhar uma vaga
    this.slot = -1;
    this.score = 0;
    this.worldPos = new THREE.Vector3();
  }

  copy(source, recursive) {
    super.copy(source, recursive);
    this.color.copy(source.color);
    this.intensity = source.intensity;
    this.distance = source.distance;
    this.decay = source.decay;
    return this;
  }
}

const FADE_IN = 6; // 1/s
const KEEP_BONUS = 1.25; // quem já tem vaga só perde para uma luz bem mais relevante

export class LightPool {
  constructor(scene, size) {
    this.scene = scene;
    this.real = [];
    this.found = [];
    this.held = [];
    this.setSize(size);
  }

  // Mudar o tamanho troca os shaders (só acontece ao mudar a qualidade).
  setSize(size) {
    while (this.real.length < size) {
      const l = new THREE.PointLight(0xffffff, 0, 1, 2);
      this.scene.add(l);
      this.real.push(l);
    }
    while (this.real.length > size) this.scene.remove(this.real.pop());
    for (const l of this.held) l.slot = -1;
    this.held = [];
  }

  get size() {
    return this.real.length;
  }

  // focus: ponto de interesse (um pouco à frente da câmera).
  update(focus, dt) {
    const found = this.found;
    found.length = 0;
    this.scene.traverseVisible((o) => {
      if (o.isPoolLight && o.intensity > 0.01) found.push(o);
    });
    for (const l of found) {
      l.getWorldPosition(l.worldPos);
      const reach = (l.distance > 0 ? l.distance : 20) + 14;
      const d = l.worldPos.distanceTo(focus);
      l.score = d < reach ? (1 - d / reach) * (l.slot >= 0 ? KEEP_BONUS : 1) : 0;
    }
    found.sort((a, b) => b.score - a.score);
    const n = this.real.length;
    for (const l of this.held) l.keep = false;
    for (let i = 0; i < found.length; i++) {
      const l = found[i];
      l.keep = i < n && l.score > 0;
      if (!l.keep && l.slot < 0) l.weight = 0;
    }
    // libera as vagas de quem saiu e entrega às novas
    const next = [];
    for (const l of this.held) {
      if (l.keep) next.push(l);
      else {
        l.slot = -1;
        l.weight = 0;
      }
    }
    for (let i = 0; i < found.length && next.length < n; i++) {
      const l = found[i];
      if (l.keep && l.slot < 0) next.push(l);
    }
    this.held = next;
    const used = new Set();
    for (const l of next) if (l.slot >= 0) used.add(l.slot);
    for (const l of next) {
      if (l.slot < 0) {
        let s = 0;
        while (used.has(s)) s++;
        l.slot = s;
        used.add(s);
      }
      l.weight = Math.min(1, l.weight + dt * FADE_IN);
      const r = this.real[l.slot];
      r.color.copy(l.color);
      r.intensity = l.intensity * l.weight;
      r.distance = l.distance;
      r.decay = l.decay;
      r.position.copy(l.worldPos);
    }
    for (let s = 0; s < n; s++) if (!used.has(s)) this.real[s].intensity = 0;
  }
}
