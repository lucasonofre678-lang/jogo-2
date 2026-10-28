// Fase final: a Abadia Submersa (parkour + stealth + o Artefato).
//   1. Pátio de entrada (movimento, salto, agarrar bordas)
//   2. Telhados sobre o abismo (feixe estreito / pilares alternativos,
//      Portão do Véu e o Grande Vão — corrida + salto + Passo do Véu)
//   3. Claustro dos Guardiões (stealth, com passarela superior alternativa)
//   4. Santuário com o Artefato do Véu
import * as THREE from 'three';
import { VEIL } from '../physics.js';
import { PoolLight } from '../lights.js';
import { A } from './builder.js';

// ======================================================= 1. Pátio de entrada
function courtyard(b) {
  const M = b.M;
  // chão e paredes
  b.block(-12, A, -6, 12, 0, 18.2, M.wallDark, { top: M.floor, uv: 3 });
  b.block(-12.8, A, 17.2, 12.8, 7.5, 18.4, M.wall);
  b.archPanel(0, 0, 17.18, Math.PI, 3.2, 5.4, M.window);
  b.merlons(-12.4, 17.8, 12.4, 17.8, 7.5);
  b.spire(-12.4, 7.5, 17.8, 1.6, 4);
  b.spire(12.4, 7.5, 17.8, 1.6, 4);

  // parede esquerda arruinada
  b.block(-12.8, A, -6, -12, 4.5, 2, M.wall);
  b.block(-12.8, A, 2, -12, 2.2, 8, M.wall);
  b.block(-12.8, A, 8, -12, 6, 17.2, M.wall);
  b.archPanel(-11.98, 1.2, 12.5, Math.PI / 2, 1.6, 3.4, M.window);
  b.archPanel(-11.98, 0.8, -2, Math.PI / 2, 1.4, 2.8, M.windowDim);
  b.rubble(-11, 0, 5, 10, 3, 0.4);

  // parapeito direito sobre o abismo
  for (const [z0, z1] of [[-6, -1], [1, 7], [9, 17.2]]) {
    b.block(12, A, z0, 12.8, 1.0, z1, M.wall);
    b.merlons(12.4, z0 + 0.4, 12.4, z1 - 0.4, 1.0, 1.3, 0.5, 0.45);
  }

  // colunata à esquerda
  for (const z of [15, 11, 7]) b.column(-9.5, z, 0, 5.6, 0.5);
  b.block(-10.2, 5.6, 6.3, -8.8, 6.2, 15.7, M.trim, { collide: false });
  // colunas quebradas à direita
  b.column(9.5, 15, 0, 3.4, 0.5, { broken: true });
  b.column(9.5, 11, 0, 1.4, 0.5, { broken: true });
  b.rubble(8.5, 0, 10, 6, 2.5);

  // estátuas de anjos
  b.statue(-4.5, 0, 9.5, 0.4);
  b.memory(-4.5, 4.4, 9.5);
  b.statue(4.5, 0, 9.5, -0.4);

  // sarcófago central
  b.block(-1.4, 0, 3, 1.4, 0.8, 5, M.trim);
  b.block(-1.2, 0.8, 3.2, 1.2, 0.95, 4.8, M.statue, { uv: 1.5 });

  // escada quebrada (caminho fácil) à esquerda
  b.block(-10, 0, -3, -7.5, 0.9, -0.5, M.rock, { top: M.floor });
  b.block(-10, 0, -6, -7.5, 1.8, -3, M.rock, { top: M.floor });
  // pilares-degrau à direita
  b.block(5.5, 0, -1.6, 6.7, 1.0, -0.4, M.rock);
  b.block(6.6, 0, -4.2, 7.8, 1.9, -3.0, M.rock);
  b.rubble(4, 0, -2, 5, 3);

  // terraço (escalar a parede: agarrar a borda)
  b.platform(-10, -14, 8, -6, 2.6);
  // runas que indicam onde escalar
  for (const x of [-1.2, 0, 1.2]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.9), M.runeSoft);
    r.position.set(x, 1.55 + (x === 0 ? 0.2 : 0), -5.97);
    b.group.add(r);
  }
  b.runeDecal(0, 2.0, -5.96, 1.2, 0, 0, new THREE.Color(0.3, 0.7, 2), 0.45);
  // arcadas arruinadas no terraço
  for (const x of [-7.2, 7.2]) {
    b.column(x, -8, 2.6, 4.2, 0.45);
    b.column(x, -12.6, 2.6, x < 0 ? 4.2 : 2.2, 0.45, { broken: x > 0 });
  }
  b.block(-7.7, 6.8, -13.1, -6.7, 7.3, -7.5, M.trim, { collide: false });
  b.merlons(-6.6, -6.3, -3.5, -6.3, 2.6, 1.1, 0.45, 0.5);
  b.merlons(3.5, -6.3, 7.6, -6.3, 2.6, 1.1, 0.45, 0.5);

  b.checkpoint(0, 0, 13, 2.8, 13, 0);
}

// ===================================================== 2. Telhados e o Vão
function rooftops(b) {
  const M = b.M;
  // R2: primeiro telhado
  b.platform(-2.5, -19, 2.5, -16.2, 3.2);
  b.archPanel(0, -1.5, -16.18, 0, 1.4, 3, M.windowDim);
  b.archPanel(-2.52, 0, -17.6, -Math.PI / 2, 1, 2.2, M.window);

  // Feixe estreito (caminho principal)
  b.block(-0.3, 2.85, -25, 0.3, 3.2, -19, M.trim, { uv: 1.5 });
  b.block(-0.22, A, -22.2, 0.22, 2.85, -21.8, M.trim, { collide: false });
  for (const z of [-20.5, -23.5]) {
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5, 4), M.iron);
    chain.position.set(0.32, 0.7, z);
    b.group.add(chain);
  }

  // Pilares alternativos (à direita, sobem mais alto)
  b.platform(3.4, -20.6, 4.8, -19.2, 2.7, { mat: M.rock, cornice: false });
  b.platform(4.6, -23.6, 6.0, -22.2, 3.6, { mat: M.rock, cornice: false });
  b.platform(3.0, -26.4, 4.4, -25.0, 4.2, { mat: M.rock, cornice: false });

  // R3: o telhado do Portão
  b.platform(-4, -37, 4, -25, 3.2);
  b.archPanel(-4.02, -2.5, -33, -Math.PI / 2, 1.6, 3.8, M.window);
  b.archPanel(4.02, -2.5, -33, Math.PI / 2, 1.6, 3.8, M.window);
  b.archPanel(-4.02, -2.5, -29.5, -Math.PI / 2, 1.2, 3, M.windowDim);

  // Portão do Véu: muro com arco e membrana mágica
  b.archWall(0, 3.2, -27, 0, 16, 6.3, 0.8, 2.6, 3.8, M.wall);
  b.world.add(-8, 3.2, -27.4, -1.3, 9.5, -26.6);
  b.world.add(1.3, 3.2, -27.4, 8, 9.5, -26.6);
  b.world.add(-1.3, 6.7, -27.4, 1.3, 9.5, -26.6);
  const veilCol = b.world.add(-1.3, 3.2, -27.15, 1.3, 6.7, -26.85, VEIL);
  b.veilBarrier(0, 3.2, -27, 0, 2.6, 3.8, veilCol);
  b.merlons(-7.6, -27, 7.6, -27, 9.5, 1.3, 0.6, 0.7);
  for (const x of [-8.4, 8.4]) {
    b.block(x - 0.8, A, -28.2, x + 0.8, 11, -25.8, M.wallDark);
    b.spire(x, 11, -27, 1.6, 5);
  }
  b.runeDecal(0, 3.22, -25.7, 1.8);
  b.runeDecal(0, 6.0, -26.58, 1.0, 0, 0, new THREE.Color(0.4, 0.8, 2.4), 0.6);

  b.checkpoint(0, 3.2, -31.5, -3.1, -31.8, 0);

  // O Grande Vão (10 m): impossível com um salto comum
  const edge = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 0.12), M.runeSoft);
  edge.position.set(0, 3.22, -36.9);
  b.group.add(edge);
  b.runeDecal(0, 3.22, -35.2, 2.6, -Math.PI / 2, 0, new THREE.Color(0.35, 0.8, 2.4), 0.55);
  // pontes quebradas
  b.block(-1.2, 1.7, -47, 1.2, 2.2, -45.8, M.trim, { collide: false });
  b.block(-1.0, 2.5, -37.9, 1.0, 2.9, -37, M.trim, { collide: false });
  b.rubble(0, 2.2, -46.4, 3, 1.2, 0.2);
  // pedras rúnicas flutuantes marcam o caminho
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -38.5 - Math.floor(i / 2) * 3.3;
    const stone = new THREE.Mesh(new THREE.OctahedronGeometry(0.35 + Math.random() * 0.2, 0), M.rock);
    stone.position.set(side * (4.2 + Math.random()), 4.5 + Math.random(), z);
    stone.scale.y = 1.6;
    const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), M.rune);
    stone.add(glow);
    glow.position.z = 0.25;
    b.group.add(stone);
    b.floater(stone, 0.35, 0.8 + Math.random() * 0.4, 0.4);
  }

  // R5: varanda sobre o claustro. Fica 0,6 m acima do telhado do Portão:
  // assim o Passo do Véu sem salto cai baixo demais para agarrar a borda.
  const B = 3.8;
  b.platform(-6, -53, 6, -47, B);
  b.block(-6, B, -53, -1.8, B + 1, -52.6, M.wall, { uv: 1.5 });
  b.block(1.8, B, -53, 6, B + 1, -52.6, M.wall, { uv: 1.5 });
  b.merlons(-5.8, -52.8, -2.2, -52.8, B + 1, 1.2, 0.4, 0.35);
  b.merlons(2.2, -52.8, 5.8, -52.8, B + 1, 1.2, 0.4, 0.35);
  b.checkpoint(-1, B, -49.4, 3.6, -49.4, 0);
  b.block(5.6, B, -53, 6, B + 1, -47, M.wall, { uv: 1.5 });
  b.archPanel(0, -1.5, -46.98, 0, 1.6, 3.6, M.window);
  // passagem para a passarela da esquerda (desce 0,6 m até ela)
  b.platform(-15, -53, -6, -47, B);
  b.block(-13, A, -53.5, -6, 6.5, -53, M.wall);
  b.block(6, A, -53.5, 16, 6.5, -53, M.wall);
  b.archPanel(-9.5, 0.6, -53.52, Math.PI, 1.6, 3.6, M.window);
  b.archPanel(10.5, 0.6, -53.52, Math.PI, 1.6, 3.6, M.window);

  // Escadaria descendo para o claustro (10 degraus de 0,38 m)
  for (let i = 0; i < 10; i++) {
    const top = B - 0.38 * (i + 1);
    if (top <= 0.01) break;
    b.block(-1.8, 0, -53 - 0.55 * (i + 1), 1.8, top, -53 - 0.55 * i, M.trim, { top: M.floor, uv: 1.5 });
  }
}

// ===================================================== 3. Claustro (stealth)
function cloister(b) {
  const M = b.M;
  b.block(-15, A, -88, 15, 0, -53, M.wallDark, { top: M.floor, uv: 3 });
  // muros
  b.block(-16, A, -88, -15, 8.5, -47, M.wall);
  b.block(15, A, -88, 16, 8.5, -53, M.wall);
  b.archWall(0, 0, -87.5, 0, 32, 9.5, 1, 4, 5.2, M.wall);
  b.world.add(-16, 0, -88, -2, 9.5, -87);
  b.world.add(2, 0, -88, 16, 9.5, -87);
  b.world.add(-2, 5.0, -88, 2, 9.5, -87);
  b.merlons(-15.6, -87.5, 15.6, -87.5, 9.5, 1.4, 0.6, 0.7);
  b.merlons(15.5, -86, 15.5, -54, 8.5, 1.4, 0.6, 0.7);
  for (const z of [-60, -70, -80]) {
    b.archPanel(14.98, 1.5, z, -Math.PI / 2, 1.8, 4.6, M.window);
  }
  for (const x of [-9, 9]) b.archPanel(x, 3.2, -86.98, 0, 1.6, 3.8, M.window);
  for (const [x, z] of [[-15.5, -47.5], [15.5, -53.5], [-15.5, -87.5], [15.5, -87.5]]) {
    b.block(x - 0.9, A, z - 0.9, x + 0.9, 10.5, z + 0.9, M.wallDark);
    b.spire(x, 10.5, z, 1.8, 5);
  }

  // Passarela superior (rota alternativa, mais segura, mas visível)
  b.platform(-15, -62, -13, -50, 3.2, { bottom: 0 });
  b.platform(-15, -74, -13, -64.4, 3.2, { bottom: 0 });
  b.platform(-15, -85.5, -13, -76.6, 3.2, { bottom: 0 });
  for (const z of [-56, -69, -81]) b.archPanel(-12.98, 0, z, Math.PI / 2, 1.2, 2.4, M.windowDim);
  // parapeito baixo e arruinado: agachado atrás dele, ninguém lá embaixo vê
  for (const [z0, z1] of [[-61.6, -53.4], [-73.6, -64.8], [-85.2, -77]]) {
    for (let z = z0; z < z1 - 0.5; z += 3.1) {
      const end = Math.min(z + 2.5, z1);
      b.block(-13.3, 3.2, z, -13, 4.3, end, M.wall, { uv: 1.2 });
    }
  }

  // colunatas
  for (const x of [-9, 9]) {
    for (const z of [-61, -68, -75, -82]) b.column(x, z, 0, 7.5, 0.55);
    b.block(x - 0.5, 7.5, -82.5, x + 0.5, 8.2, -60.5, M.trim, { collide: false });
  }

  // cobertura baixa (agache atrás para se esconder)
  const low = [
    [-6, -64.3, -2, -63.7], [2, -64.3, 6, -63.7],
    [-3, -71.3, 3, -70.7],
    [-12, -70, -11.4, -66], [11.4, -70, 12, -66],
    [-6, -78.3, -2, -77.7], [2, -78.3, 6, -77.7],
  ];
  for (const [x0, z0, x1, z1] of low) {
    b.block(x0, 0, z0, x1, 1.1, z1, M.wall, { uv: 1.5 });
    b.rubble((x0 + x1) / 2, 0, (z0 + z1) / 2 + (Math.random() > 0.5 ? 0.8 : -0.8), 2, 2, 0.22);
  }
  // sarcófagos
  for (const [x, z] of [[-10.75, -57.7], [10.75, -57.7], [-10.75, -78.7], [10.75, -78.7]]) {
    b.block(x - 0.75, 0, z - 1.25, x + 0.75, 0.9, z + 1.25, M.trim);
    b.block(x - 0.65, 0.9, z - 1.15, x + 0.65, 1.05, z + 1.15, M.statue, { uv: 1.5 });
  }
  // muros altos de cobertura junto à escadaria
  b.block(-5, 0, -59, -3, 2.4, -58.4, M.wall);
  b.block(3, 0, -59, 5, 2.4, -58.4, M.wall);
  b.rubble(-4, 2.4, -58.7, 3, 1.5, 0.2);

  // fonte central com estátua (bloqueia a visão)
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.8, 8), M.trim);
  basin.position.set(0, 0.4, -67.5);
  basin.castShadow = basin.receiveShadow = true;
  b.group.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(1.95, 8), new THREE.MeshStandardMaterial({
    color: 0x0a1a3a, roughness: 0.1, metalness: 0.4, emissive: new THREE.Color(0.02, 0.08, 0.25),
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, 0.72, -67.5);
  b.group.add(water);
  b.world.add(-2, 0, -69.5, 2, 0.8, -65.5);
  b.statue(0, 0.8, -67.5, 0, 1.05);

  // runas e destroços
  b.rubble(-7, 0, -85, 6, 3);
  b.rubble(12, 0, -62, 5, 2.5);
  b.runeDecal(0, 0.02, -84.5, 3, -Math.PI / 2, 0, new THREE.Color(0.3, 0.7, 2), 0.35);

  const zone = { minX: -15, maxX: 15, minZ: -99, maxZ: -53 };
  b.guardianDefs.push({
    name: 'Guardião do Claustro', floorY: 0, zone,
    waypoints: [
      { x: -6.5, z: -61, wait: 1.6 }, { x: 6.5, z: -61, wait: 1.6 },
      { x: 6.5, z: -74.5, wait: 1.6 }, { x: -6.5, z: -74.5, wait: 1.6 },
    ],
  });
  b.guardianDefs.push({
    name: 'Sentinela do Santuário', floorY: 0, zone,
    waypoints: [
      { x: -7.5, z: -84, wait: 2.8, look: 0, sweep: 0.7 },
      { x: 7.5, z: -84, wait: 2.8, look: 0, sweep: 0.7 },
    ],
  });
}

// ===================================================== 4. Santuário
function sanctum(b) {
  const M = b.M;
  b.block(-8, A, -99, 8, 0, -88, M.wallDark, { top: M.floor, uv: 3 });
  b.block(-9, A, -99, -8, 11, -88, M.wall);
  b.block(8, A, -99, 9, 11, -88, M.wall);
  b.block(-9, A, -100, 9, 13, -99, M.wall);
  b.archPanel(0, 4, -98.98, 0, 3.4, 7.5, M.window);
  for (const z of [-91, -96]) {
    b.archPanel(-7.98, 2, z, Math.PI / 2, 1.3, 4, M.window);
    b.archPanel(7.98, 2, z, -Math.PI / 2, 1.3, 4, M.window);
  }
  for (const z of [-89, -93.5, -98]) b.block(-8.5, 10.4, z - 0.3, 8.5, 11, z + 0.3, M.trim, { collide: false });
  b.spire(0, 13, -99.5, 2.5, 7);

  // estrado e altar
  b.block(-3.5, 0, -95, 3.5, 0.35, -90, M.trim, { top: M.floor, uv: 1.5 });
  b.block(-2.2, 0.35, -94, 2.2, 0.7, -91, M.trim, { top: M.floor, uv: 1.5 });
  b.block(-0.6, 0.7, -93.1, 0.6, 1.6, -91.9, M.statue, { uv: 1 });
  b.runeDecal(0, 0.72, -92.5, 3.6);
  for (const x of [-5.5, 5.5]) {
    b.statue(x, 0, -94, x < 0 ? 0.6 : -0.6, 0.9);
    b.column(x, -89.5, 0, 9, 0.5);
  }

  // O Artefato do Véu
  const art = new THREE.Group();
  art.position.set(0, 2.75, -92.5);
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), new THREE.MeshStandardMaterial({
    color: 0xa8d4ff, roughness: 0.15, metalness: 0.2, flatShading: true,
    emissive: new THREE.Color(0.25, 0.6, 1.8), emissiveIntensity: 1.4,
  }));
  crystal.scale.y = 1.7;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 4, 6) }));
  core.scale.y = 1.7;
  art.add(crystal, core);
  const rings = [];
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85 + i * 0.25, 0.018, 6, 48), M.rune);
    ring.rotation.x = Math.PI / 2 + (i ? 0.5 : -0.4);
    art.add(ring);
    rings.push(ring);
  }
  const shards = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.TetrahedronGeometry(0.09, 0), M.rune);
    art.add(s);
    shards.push(s);
  }
  const light = new PoolLight(0x7ab8ff, 30, 18, 2);
  art.add(light);
  b.group.add(art);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, 14, 20, 1, true), new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.25, 0.5, 1.2), transparent: true, opacity: 0.09,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  beam.position.set(0, 7.5, -92.5);
  b.group.add(beam);
  art.traverse((o) => { o.userData.dynamic = true; });
  b.artifact = { group: art, crystal, core, rings, shards, light, beam, home: art.position.clone(), collected: false };
}

// ===================================================== dicas contextuais
function hints(b) {
  const h = (min, max, text) => b.hints.push({ min: new THREE.Vector3(...min), max: new THREE.Vector3(...max), text, shown: false });
  h([-12, -1, 7], [12, 6, 18], '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> para mover · <kbd>Mouse</kbd> para olhar · <kbd>Espaço</kbd> para saltar — segure para ir mais alto');
  h([-12, -1, -6], [12, 2.2, 3], 'Salte contra uma borda alta e continue empurrando para se agarrar e subir.<br><kbd>Espaço</kbd> sobe · <kbd>C</kbd> solta. A escada quebrada à esquerda é o caminho fácil.');
  h([-10, 2, -14], [8, 7, -6], 'Atravesse os telhados: o feixe estreito em frente ou os pilares à direita.<br>Segure <kbd>Shift</kbd> para andar com mais precisão.');
  h([-4, 2.5, -26.6], [6, 9, -24.5], '<kbd>Q</kbd> — <b>Passo do Véu</b>: um avanço rápido que atravessa barreiras de energia azul.<br>Paredes de pedra continuam sólidas.');
  h([-4, 2.5, -37], [4, 9, -27.6], 'O vão é largo demais para um salto comum.<br>Corra, salte e use <kbd>Q</kbd> no ar — o Passo do Véu funciona uma vez por salto.');
  h([-15, 2.5, -53], [6, 9, -47], 'Guardiões adiante. Segure <kbd>C</kbd> para se esgueirar ou <kbd>Shift</kbd> para andar: muros baixos escondem quem está agachado.<br>Correr, cair de alto e o eco do Véu fazem barulho.');
  h([-15, 2.5, -86], [-13, 9, -55], 'A passarela tem um parapeito: segure <kbd>C</kbd> e ninguém lá embaixo verá você.<br>De pé, os guardiões ainda podem olhar para cima.');
  h([-8, -1, -99], [8, 6, -88.5], 'O Artefato do Véu. Aproxime-se do altar.');
}

export function buildAbbey(b) {
  courtyard(b);
  rooftops(b);
  cloister(b);
  sanctum(b);
  hints(b);
  b.scenery(0, -40, 120);
  b.motes([-18, -4, -100], [18, 14, 20], 1100, new THREE.Color(0.35, 0.75, 2.0), 0.07, 0.3);
  b.motes([-7, 0, -99], [7, 10, -88], 300, new THREE.Color(0.6, 1.0, 2.4), 0.06, 0.5);
  b.motes([-5, 2, -47], [5, 8, -37], 200, new THREE.Color(0.4, 0.85, 2.4), 0.08, 0.6);
  b.start.pos.set(0, 0, 13);
  b.killY = -14;
}
