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

// Rampa de surf: prisma triangular deitado ao longo de z. A crista fica em
// x0 e vai da altura h0 (em z0) a h1 (em z1); as duas faces descem até
// w metros para cada lado, caindo H metros.
export class Ramp {
  constructor({ x0, z0, z1, h0, h1, w, H }) {
    Object.assign(this, { x0, z0, z1, h0, h1, w, H });
    this.zmin = Math.min(z0, z1);
    this.zmax = Math.max(z0, z1);
    this.c = H / w;
    this.slopeZ = (h1 - h0) / (z1 - z0);
    this.enabled = true;
  }

  ridgeAt(z) {
    return this.h0 + this.slopeZ * (z - this.z0);
  }

  // Altura da superfície em (x, z), ou null fora da rampa.
  heightAt(x, z) {
    if (z < this.zmin || z > this.zmax) return null;
    const ax = Math.abs(x - this.x0);
    if (ax > this.w) return null;
    return this.ridgeAt(z) - this.c * ax;
  }

  // Esfera (centro x,y,z e raio r) encostando numa face: normal e profundidade.
  contact(x, y, z, r) {
    if (z < this.zmin || z > this.zmax) return null;
    const dx = x - this.x0;
    const ax = Math.abs(dx);
    if (ax > this.w) return null;
    const side = dx < 0 ? -1 : 1;
    const f = y - this.ridgeAt(z) + this.c * ax;
    const gx = this.c * side;
    const gz = -this.slopeZ;
    const L = Math.sqrt(gx * gx + 1 + gz * gz);
    const d = f / L;
    if (d >= r || d < -1.2) return null;
    return { nx: gx / L, ny: 1 / L, nz: gz / L, depth: r - d };
  }

  // Jogador (cilindro: pés em y) dentro do prisma, longe da face de cima:
  // empurra pela saída mais curta (pontas ou por baixo).
  insidePush(x, y, z, r, h) {
    if (z < this.zmin - r || z > this.zmax + r) return null;
    const ax = Math.abs(x - this.x0);
    if (ax > this.w) return null;
    const ridge = this.ridgeAt(Math.min(this.zmax, Math.max(this.zmin, z)));
    const top = ridge - this.c * ax;
    const base = ridge - this.H;
    if (y > top - 0.5 || y + h < base) return null;
    const outFront = z - (this.zmin - r);
    const outBack = this.zmax + r - z;
    const outBelow = y + h - base;
    const m = Math.min(outFront, outBack, outBelow);
    if (m === outBelow) return { nx: 0, ny: -1, nz: 0, depth: outBelow, solid: true };
    if (m === outFront) return { nx: 0, ny: 0, nz: -1, depth: outFront, solid: true };
    return { nx: 0, ny: 0, nz: 1, depth: outBack, solid: true };
  }

  // O ponto está dentro do prisma?
  containsPoint(x, y, z) {
    if (z < this.zmin || z > this.zmax) return false;
    const ax = Math.abs(x - this.x0);
    if (ax > this.w) return false;
    const ridge = this.ridgeAt(z);
    return y < ridge - this.c * ax && y > ridge - this.H;
  }
}

export class PhysicsWorld {
  constructor() {
    this.colliders = [];
    this.ramps = [];
  }

  clear() {
    this.colliders.length = 0;
    this.ramps.length = 0;
  }

  // Primeira distância em que o raio entra numa rampa (marcha em passos curtos).
  raycastRamps(ox, oy, oz, dx, dy, dz, maxDist) {
    if (!this.ramps.length) return null;
    for (let t = 0.2; t <= maxDist; t += 0.25) {
      const x = ox + dx * t;
      const y = oy + dy * t;
      const z = oz + dz * t;
      for (const r of this.ramps) if (r.enabled && r.containsPoint(x, y, z)) return t;
    }
    return null;
  }

  addRamp(def) {
    const r = new Ramp(def);
    this.ramps.push(r);
    return r;
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
    let best = c ? c.maxY : null;
    for (const ramp of this.ramps) {
      if (!ramp.enabled) continue;
      const h = ramp.heightAt(x, z);
      if (h === null || h > fromY + 0.5 || h < fromY - maxDrop) continue;
      if (best === null || h > best) best = h;
    }
    return best;
  }
}
