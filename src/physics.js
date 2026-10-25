// Mundo de colisão simples e previsível: toda superfície é uma caixa alinhada
// aos eixos (AABB). O jogador e os guardiões são cilindros verticais.
//   SOLID — bloqueia sempre
//   VEIL  — bloqueia, exceto durante o Passo do Véu
//   KILL  — não bloqueia; encostar mata (lâminas, muro do Véu, maré)
// Colisores podem se mover (plataformas, comboios): a fase registra o
// deslocamento do quadro (dx,dy,dz) e a velocidade (vx,vy,vz) para o jogador
// ser carregado e herdar o momento ao saltar.

export const SOLID = 1;
export const VEIL = 2;
export const KILL = 4;
export const ALL = SOLID | VEIL;

export class Collider {
  constructor(minX, minY, minZ, maxX, maxY, maxZ, kind = SOLID) {
    this.minX = Math.min(minX, maxX);
    this.minY = Math.min(minY, maxY);
    this.minZ = Math.min(minZ, maxZ);
    this.maxX = Math.max(minX, maxX);
    this.maxY = Math.max(minY, maxY);
    this.maxZ = Math.max(minZ, maxZ);
    this.kind = kind;
    this.enabled = true;
    // movimento do último quadro
    this.dx = 0;
    this.dy = 0;
    this.dz = 0;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    // tranco (plataforma que bateu): o jogador em cima é arremessado
    this.jolt = null;
    // trampolim: velocidade vertical ao pousar e impulso horizontal opcional
    this.bounce = 0;
    this.launch = null;
    // chamado a cada quadro em que o jogador está em pé sobre o colisor
    this.onStand = null;
  }

  translate(dx, dy, dz) {
    this.minX += dx;
    this.maxX += dx;
    this.minY += dy;
    this.maxY += dy;
    this.minZ += dz;
    this.maxZ += dz;
    this.dx += dx;
    this.dy += dy;
    this.dz += dz;
  }

  // Zera o deslocamento acumulado no início do quadro.
  beginFrame() {
    this.dx = this.dy = this.dz = 0;
  }

  endFrame(dt) {
    if (dt > 0) {
      this.vx = this.dx / dt;
      this.vy = this.dy / dt;
      this.vz = this.dz / dt;
    }
  }

  get moving() {
    return this.dx !== 0 || this.dy !== 0 || this.dz !== 0;
  }
}

// Interseção raio x caixa pelo método das "slabs". Retorna a distância ou -1.
function rayBox(c, ox, oy, oz, dx, dy, dz) {
  let tmin = 0;
  let tmax = Infinity;

  if (dx === 0) {
    if (ox < c.minX || ox > c.maxX) return -1;
  } else {
    let t1 = (c.minX - ox) / dx;
    let t2 = (c.maxX - ox) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (dy === 0) {
    if (oy < c.minY || oy > c.maxY) return -1;
  } else {
    let t1 = (c.minY - oy) / dy;
    let t2 = (c.maxY - oy) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  if (dz === 0) {
    if (oz < c.minZ || oz > c.maxZ) return -1;
  } else {
    let t1 = (c.minZ - oz) / dz;
    let t2 = (c.maxZ - oz) / dz;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin;
}

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
  }

  clear() {
    this.colliders.length = 0;
  }

  add(minX, minY, minZ, maxX, maxY, maxZ, kind = SOLID) {
    const c = new Collider(minX, minY, minZ, maxX, maxY, maxZ, kind);
    this.colliders.push(c);
    return c;
  }

  // Vetor mínimo para tirar um círculo (plano XZ) de dentro de uma caixa.
  static circlePush(c, x, z, r) {
    const cx = x < c.minX ? c.minX : x > c.maxX ? c.maxX : x;
    const cz = z < c.minZ ? c.minZ : z > c.maxZ ? c.maxZ : z;
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return null;
    if (d2 > 1e-10) {
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      return { x: nx * (r - d), z: nz * (r - d), nx, nz };
    }
    // Centro dentro do retângulo: sai pelo lado mais próximo.
    const left = x - c.minX;
    const right = c.maxX - x;
    const back = z - c.minZ;
    const front = c.maxZ - z;
    const m = Math.min(left, right, back, front);
    if (m === left) return { x: -(left + r), z: 0, nx: -1, nz: 0 };
    if (m === right) return { x: right + r, z: 0, nx: 1, nz: 0 };
    if (m === back) return { x: 0, z: -(back + r), nx: 0, nz: -1 };
    return { x: 0, z: front + r, nx: 0, nz: 1 };
  }

  static circleOverlaps(c, x, z, r) {
    const cx = x < c.minX ? c.minX : x > c.maxX ? c.maxX : x;
    const cz = z < c.minZ ? c.minZ : z > c.maxZ ? c.maxZ : z;
    const dx = x - cx;
    const dz = z - cz;
    return dx * dx + dz * dz < r * r;
  }

  // Primeiro colisor que intersecta o cilindro (base em y, altura h).
  overlapCylinder(x, y, z, r, h, mask = SOLID) {
    for (const c of this.colliders) {
      if (!c.enabled || !(c.kind & mask)) continue;
      if (c.maxY <= y || c.minY >= y + h) continue;
      if (PhysicsWorld.circleOverlaps(c, x, z, r)) return c;
    }
    return null;
  }

  // Raio normalizado (dx,dy,dz). Retorna { t, collider } ou null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist, mask = SOLID) {
    let best = maxDist;
    let hit = null;
    for (const c of this.colliders) {
      if (!c.enabled || !(c.kind & mask)) continue;
      const t = rayBox(c, ox, oy, oz, dx, dy, dz);
      if (t >= 0 && t < best) {
        best = t;
        hit = c;
      }
    }
    return hit ? { t: best, collider: hit } : null;
  }

  // Colisor de topo mais alto sob um círculo, entre fromY e fromY - maxDrop.
  groundColliderBelow(x, z, r, fromY, maxDrop, mask = SOLID) {
    let best = null;
    for (const c of this.colliders) {
      if (!c.enabled || !(c.kind & mask)) continue;
      if (c.maxY > fromY + 1e-3 || c.maxY < fromY - maxDrop) continue;
      if (!PhysicsWorld.circleOverlaps(c, x, z, r)) continue;
      if (best === null || c.maxY > best.maxY) best = c;
    }
    return best;
  }

  groundBelow(x, z, r, fromY, maxDrop, mask = SOLID) {
    const c = this.groundColliderBelow(x, z, r, fromY, maxDrop, mask);
    return c ? c.maxY : null;
  }
}
