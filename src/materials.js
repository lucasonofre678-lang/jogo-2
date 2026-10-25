// Texturas procedurais desenhadas em canvas e materiais compartilhados.
import * as THREE from 'three';

function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeCanvas(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return [c, c.getContext('2d')];
}

function addNoise(ctx, size, rand, amount) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 1.1;
  }
  ctx.putImageData(img, 0, 0);
}

// Manchas grandes e suaves (umidade, líquen azulado, desgaste).
function addStains(ctx, size, rand, count, colors) {
  for (let i = 0; i < count; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = size * (0.05 + rand() * 0.18);
    const col = colors[Math.floor(rand() * colors.length)];
    for (const ox of [-size, 0, size]) {
      for (const oy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
        g.addColorStop(0, col);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
      }
    }
  }
}

function addCracks(ctx, size, rand, count) {
  ctx.strokeStyle = 'rgba(15,16,22,0.55)';
  for (let i = 0; i < count; i++) {
    let x = rand() * size;
    let y = rand() * size;
    ctx.lineWidth = 0.6 + rand() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const n = 4 + Math.floor(rand() * 6);
    for (let k = 0; k < n; k++) {
      x += (rand() - 0.5) * 34;
      y += (rand() - 0.5) * 34;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function finish(canvas, anisotropy) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

function brickTexture(seed, anisotropy) {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(seed);
  g.fillStyle = '#3b3e46';
  g.fillRect(0, 0, S, S);
  const rows = 8;
  const cols = 4;
  const bh = S / rows;
  const bw = S / cols;
  for (let y = 0; y < rows; y++) {
    const shades = Array.from({ length: cols }, () => 92 + r() * 52);
    const off = (y % 2) * bw * 0.5;
    for (let x = -1; x <= cols; x++) {
      const s = shades[(x + cols) % cols];
      g.fillStyle = `rgb(${s | 0},${(s + 3) | 0},${(s + 10) | 0})`;
      const px = x * bw + off + 3;
      const py = y * bh + 3;
      g.fillRect(px, py, bw - 6, bh - 6);
      // bordas lascadas
      g.fillStyle = 'rgba(30,32,38,0.35)';
      g.fillRect(px, py + bh - 10, bw - 6, 4);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(px, py, bw - 6, 3);
    }
  }
  addStains(g, S, r, 14, ['rgba(20,30,50,0.35)', 'rgba(60,80,110,0.18)', 'rgba(10,10,14,0.4)']);
  addCracks(g, S, r, 10);
  addNoise(g, S, r, 34);
  return finish(c, anisotropy);
}

function flagstoneTexture(seed, anisotropy) {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(seed);
  g.fillStyle = '#2c2f37';
  g.fillRect(0, 0, S, S);
  const n = 4;
  const cell = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const s = 88 + r() * 40;
      g.fillStyle = `rgb(${s | 0},${(s + 4) | 0},${(s + 12) | 0})`;
      const inset = 3 + r() * 3;
      if (r() < 0.25 && x < n - 1) {
        // laje dupla
        g.fillRect(x * cell + inset, y * cell + inset, cell * 2 - inset * 2, cell - inset * 2);
        x++;
      } else {
        g.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
      }
    }
  }
  addStains(g, S, r, 18, ['rgba(40,70,120,0.18)', 'rgba(10,12,18,0.45)', 'rgba(90,100,120,0.12)']);
  addCracks(g, S, r, 16);
  addNoise(g, S, r, 30);
  return finish(c, anisotropy);
}

function roughTexture(seed, anisotropy) {
  const S = 256;
  const [c, g] = makeCanvas(S);
  const r = rng(seed);
  g.fillStyle = '#5d626e';
  g.fillRect(0, 0, S, S);
  addStains(g, S, r, 40, ['rgba(20,22,30,0.5)', 'rgba(120,128,145,0.25)', 'rgba(40,60,95,0.25)']);
  addCracks(g, S, r, 14);
  addNoise(g, S, r, 46);
  return finish(c, anisotropy);
}

// Círculo arcano usado em decalques e no chão dos pontos de controle.
export function runeTexture() {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(99);
  g.translate(S / 2, S / 2);
  g.strokeStyle = 'rgba(160,215,255,1)';
  g.shadowColor = 'rgba(90,170,255,1)';
  g.shadowBlur = 14;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(0, 0, 230, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, 200, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(0, 0, 95, 0, Math.PI * 2);
  g.stroke();
  // estrela de sete pontas
  g.beginPath();
  for (let i = 0; i <= 7; i++) {
    const a = (i * 3 * Math.PI * 2) / 7 - Math.PI / 2;
    const px = Math.cos(a) * 195;
    const py = Math.sin(a) * 195;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();
  // glifos no anel
  g.font = 'bold 26px serif';
  g.fillStyle = 'rgba(170,220,255,1)';
  const glyphs = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.save();
    g.rotate(a);
    g.fillText(glyphs[Math.floor(r() * glyphs.length)], -9, -206);
    g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Mancha macia para névoa e sombra circular.
export function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  const S = 128;
  const [c, g] = makeCanvas(S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(c);
}

export function cloudTexture() {
  const S = 512;
  const [c, g] = makeCanvas(S);
  const r = rng(5);
  for (let i = 0; i < 60; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 40 + r() * 110;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        const grad = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        grad.addColorStop(0, `rgba(255,255,255,${0.05 + r() * 0.08})`);
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = grad;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function createMaterials(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const brick = brickTexture(7, aniso);
  const brickDark = brickTexture(21, aniso);
  const flag = flagstoneTexture(3, aniso);
  const rough = roughTexture(11, aniso);

  const std = (opts) => new THREE.MeshStandardMaterial({ roughness: 0.93, metalness: 0, ...opts });

  return {
    wall: std({ map: brick, bumpMap: brick, bumpScale: 1.6, color: 0x9aa2b6 }),
    wallDark: std({ map: brickDark, bumpMap: brickDark, bumpScale: 1.6, color: 0x6b7286 }),
    floor: std({ map: flag, bumpMap: flag, bumpScale: 1.2, color: 0x8c93a6 }),
    rock: std({ map: rough, bumpMap: rough, bumpScale: 2, color: 0x7d8496, flatShading: true }),
    trim: std({ map: rough, color: 0x666d80 }),
    dark: std({ color: 0x1a1d26, roughness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: 0x23262e, roughness: 0.45, metalness: 0.75 }),
    statue: std({ map: rough, color: 0x8f97a8, flatShading: true }),
    window: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.2, 0.6) }),
    windowDim: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.04, 0.1) }),
    rune: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 1.4, 3.2) }),
    runeSoft: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.45, 1.1) }),
    silhouette: new THREE.MeshBasicMaterial({ color: 0x080c18, fog: false }),
    silhouetteFar: new THREE.MeshBasicMaterial({ color: 0x0c1222, fog: false }),
    distantWindow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.15, 0.35, 0.9), fog: false }),
    // carruagens espectrais do comboio
    slab: std({ map: brickDark, bumpMap: brickDark, bumpScale: 1.2, color: 0x6f7891 }),
    slabGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 0.75, 2.4), side: THREE.DoubleSide }),
    // pedra rachada que desmorona ao ser pisada
    crumble: std({ map: rough, bumpMap: rough, bumpScale: 2.5, color: 0xa07a68, flatShading: true,
      emissive: new THREE.Color(0.25, 0.05, 0.02), emissiveIntensity: 1 }),
    // energia corrompida do Véu: mata ao tocar
    blade: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.3, 0.95) }),
    mistColor: new THREE.Color(0.35, 0.45, 0.75),
    runeTex: runeTexture(),
  };
}

// BoxGeometry com UVs proporcionais ao tamanho real (textura não estica).
export function boxGeometry(sx, sy, sz, scale = 2.5) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.attributes.uv;
  const dims = [
    [sz, sy], [sz, sy],
    [sx, sz], [sx, sz],
    [sx, sy], [sx, sy],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / scale, (uv.getY(i) * dims[f][1]) / scale);
    }
  }
  return g;
}
