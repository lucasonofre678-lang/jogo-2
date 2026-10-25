// As fases de corrida. Todas avançam para -z a partir da origem.
// Números de referência do andarilho: corrida 9,5 m/s, salto de 1,63 m,
// salto com corrida ~6,4 m, salto + Passo do Véu ~13 m.
import * as THREE from 'three';
import { A, paths } from './builder.js';

const MOTE_BLUE = new THREE.Color(0.35, 0.75, 2.0);
const MOTE_ROSE = new THREE.Color(2.0, 0.5, 0.9);
const MOTE_TEAL = new THREE.Color(0.4, 1.8, 1.6);
const MOTE_GOLD = new THREE.Color(2.0, 1.4, 0.5);

// Torre contra a qual as carruagens batem (face voltada para +z em zFace).
function tower(b, x, zFace, top = 11, w = 4.2) {
  b.block(x - w / 2, A, zFace - 5, x + w / 2, top, zFace, b.M.wallDark);
  b.spire(x, top, zFace - 2.5, w, 5);
  b.archPanel(x, top - 6, zFace + 0.02, 0, 1.2, 3, b.M.window);
}

// Barra de energia atravessada sobre as faixas: é preciso pular.
function bar(b, x0, x1, y, z) {
  b.blade(x0, y, z - 0.15, x1, y + 0.25, z + 0.15);
  b.block(x0 - 0.7, A, z - 0.35, x0, y + 1.4, z + 0.35, b.M.wall, { uv: 1.5 });
  b.block(x1, A, z - 0.35, x1 + 0.7, y + 1.4, z + 0.35, b.M.wall, { uv: 1.5 });
  b.spire(x0 - 0.35, y + 1.4, z, 0.7, 1.4);
  b.spire(x1 + 0.35, y + 1.4, z, 0.7, 1.4);
}

// --------------------------------------------------------------- 1
export function despertar(b) {
  b.platform(-3, -8, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-2.5, -19, 2.5, -12, 0);
  b.platform(-2.5, -30, 2.5, -23, 1.2);
  b.platform(-2.5, -50, 2.5, -34, 1.2);
  b.veilWall(-2.5, 1.2, -37, 2.5, 4.8);
  b.platform(-2.5, -70, 2.5, -60, 1.2);
  b.orb(0, 2.6, -77);
  b.platform(-3, -104, 3, -86, 1.2);
  b.goalPortal(0, 1.2, -99);
  b.platform(4.5, -29, 7, -26, 2.4);
  b.memory(5.75, 3.6, -27.5);
  b.hint([-3, -1, -8], [3, 6, 6], 'Você corre sozinho com <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>. <kbd>Espaço</kbd> salta — segure para ir mais alto.<br><kbd>R</kbd> reinicia a fase a qualquer momento.');
  b.hint([-2.5, 0, -36.5], [2.5, 6, -34], '<kbd>Q</kbd> — <b>Passo do Véu</b>: um avanço que atravessa a membrana azul.');
  b.hint([-2.5, 0, -50], [2.5, 6, -42], 'Vão largo: salte e use <kbd>Q</kbd> no ar.');
  b.hint([-2.5, 0, -70], [2.5, 6, -60], 'Cristais recarregam o Passo do Véu.<br>Salte, <kbd>Q</kbd>, pegue o cristal e <kbd>Q</kbd> de novo.');
  b.scenery(0, -50, 110);
  b.motes([-15, -4, -100], [15, 12, 10], 700, MOTE_BLUE);
  b.killY = -14;
}

// --------------------------------------------------------------- 2
export function comboio(b) {
  b.platform(-4, -4, 2, 8, 2.0);
  b.startAt(-1, 2, 4);
  const top = 1.5;
  b.lane({ x: 5, top, speed: 12, spacing: 10, startZ: 80, endZ: -300, crash: [-70] });
  b.lane({ x: 5, top, speed: 13, spacing: 11, startZ: -80, endZ: -300, crash: [-215], phase: 0.4 });
  b.lane({ x: 9.5, top, speed: 15, spacing: 12, startZ: 80, endZ: -300, crash: [-140], phase: 0.2 });
  b.lane({ x: 9.5, top, speed: 16, spacing: 12, startZ: -150, endZ: -292, phase: 0.1 });
  b.lane({ x: 14, top, speed: 11, spacing: 9, startZ: 80, endZ: -300, crash: [-235], phase: 0.5 });
  tower(b, 5, -70);
  tower(b, 9.5, -140);
  tower(b, 5, -215);
  tower(b, 14, -235);
  for (const z of [-40, -110, -185, -255]) bar(b, 2.6, 16.4, top + 0.75, z);
  b.platform(6, -322, 13, -298, 2.5);
  b.goalPortal(9.5, 2.5, -315);
  b.memory(14, 3.7, -120);
  b.hint([-4, 0, -4], [2, 6, 8], 'Pule nas carruagens espectrais. Elas batem nas torres — troque de faixa antes!<br>Saltar de uma carruagem mantém a velocidade dela.');
  b.hint([2, 0, -60], [17, 8, -20], 'Barras de energia: salte por cima delas.');
  b.hint([2, 0, -290], [17, 8, -240], 'Fim da linha! Salte para a plataforma do portal.');
  b.scenery(9, -150, 200);
  b.motes([-5, -4, -320], [22, 12, 20], 1400, MOTE_BLUE);
  b.killY = -20;
}

// --------------------------------------------------------------- 3
export function saltos(b) {
  b.platform(-3, -6, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.pad(0, 0, -4, 18, [0, -12]);
  b.platform(-3, -32, 3, -15, 2);
  b.boostRing(0, 3.6, -30, [0, 0.2, -1], 25);
  b.platform(-3, -64, 3, -42, 0);
  b.orb(0, 2.5, -71.5);
  b.orb(0, 2.5, -78.5);
  b.orb(0, 2.5, -85.5);
  b.platform(-3, -115, 3, -93, 0);
  b.pad(0, 0, -111, 22, [0, -8]);
  b.platform(-3, -140, 3, -121, 7);
  b.boostRing(0, 9, -138, [0, 0.05, -1], 28);
  b.platform(-3, -180, 3, -152, 2);
  b.goalPortal(0, 2, -172);
  b.memory(2.6, 9.6, -117);
  b.hint([-3, -1, -6], [3, 6, 6], 'Trampolins rúnicos lançam você longe. Anéis dourados disparam na direção da seta.');
  b.hint([-3, -1, -64], [3, 6, -42], 'Três cristais: salte e encadeie <kbd>Q</kbd> <kbd>Q</kbd> <kbd>Q</kbd> <kbd>Q</kbd>.');
  b.scenery(0, -90, 150);
  b.motes([-15, -4, -180], [15, 16, 10], 900, MOTE_TEAL);
  b.killY = -16;
}

// --------------------------------------------------------------- 4
export function laminas(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-2.2, -70, 2.2, -4, 0);
  // lâminas que varrem a ponte de um lado ao outro
  b.blade(-0.9, 0, -14.2, 0.9, 2.4, -13.8, paths.swing(3.4, 0, 0, 2.2, 0));
  b.blade(-0.9, 0, -22.2, 0.9, 2.4, -21.8, paths.swing(3.4, 0, 0, 1.8, 0.5));
  b.blade(-0.9, 0, -30.2, 0.9, 2.4, -29.8, paths.swing(3.4, 0, 0, 2.6, 0.25));
  // esmagadores que sobem e descem
  b.blade(-2.2, 0, -38.5, 2.2, 3, -37.5, paths.pingPong(0, 3.4, 0, 1.6, 0));
  b.blade(-2.2, 0, -46.5, 2.2, 3, -45.5, paths.pingPong(0, 3.4, 0, 1.6, 0.5));
  // barra baixa que vai e volta: pule por cima
  b.blade(-2.2, 0.05, -56.15, 2.2, 0.55, -55.85, paths.swing(0, 0, 3, 1.5, 0));
  // pedras que desmoronam
  const xs = [0, 0.9, -0.9, 0.7, -0.5];
  xs.forEach((x, i) => {
    const z0 = -72 - i * 6.5;
    b.crumble(x - 1.6, z0 - 4.5, x + 1.6, z0, 0, 0.45);
  });
  b.platform(-3, -120, 3, -104.5, 0);
  b.veilWall(-3, 0, -109, 3, 3.8);
  b.goalPortal(0, 0, -116);
  b.platform(3.6, -35, 5.6, -31, 1.5);
  b.memory(4.6, 2.7, -33);
  b.hint([-3, -1, -12], [3, 6, 6], 'Energia corrompida mata ao toque. Observe o ritmo das lâminas.');
  b.hint([-2.2, -1, -70], [2.2, 6, -60], 'Pedras rachadas desabam logo depois que você pisa. Não pare!');
  b.scenery(0, -55, 120);
  b.motes([-14, -4, -115], [14, 12, 10], 800, MOTE_ROSE);
  b.killY = -14;
}

// --------------------------------------------------------------- 5
export function desabamento(b) {
  b.platform(-3, -4, 3, 8, 0);
  b.startAt(0, 0, 3);
  const xs = [0, 1, 0, -1];
  for (let i = 0; i < 10; i++) {
    const z0 = -6 - i * 6.5;
    const x = xs[i % 4];
    // só degraus para cima: descer aumenta o voo e o jogador passaria da pedra
    const top = i >= 5 ? 0.7 : 0;
    b.crumble(x - 1.6, z0 - 4.5, x + 1.6, z0, top, 0.55);
  }
  b.platform(-3, -90, 3, -71, 0.7);
  b.veilWall(-3, 0.7, -76, 3, 4.5);
  b.platform(-3, -110, 3, -95.5, 0.7);
  b.pad(0, 0.7, -106, 17, [0, -11]);
  b.platform(-3, -142, 3, -116, 2.5);
  for (let i = 0; i < 4; i++) {
    const z0 = -144 - i * 6.5;
    b.crumble(-1.6, z0 - 4.5, 1.6, z0, 2.5, 0.5);
  }
  b.platform(-3, -186, 3, -170, 2.5);
  b.goalPortal(0, 2.5, -181);
  b.memory(2.3, 1.9, -41);
  b.veilSurge({ minX: -16, maxX: 16, minY: -30, maxY: 18, minZ: 9, maxZ: 10, velocity: [0, 0, -6.6], delay: 1.5 });
  b.hint([-3, -1, -4], [3, 6, 8], 'O Véu corrompido avança atrás de você. <b>Corra!</b>');
  b.scenery(0, -85, 140);
  b.motes([-14, -4, -175], [14, 14, 10], 900, MOTE_ROSE);
  b.killY = -14;
}

// --------------------------------------------------------------- 6
export function engrenagens(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.movingPlatform(-1.6, -11, 1.6, -7, 0, paths.pingPong(0, 0, -12, 4.5));
  b.platform(-3, -36, 3, -26, 0);
  b.movingPlatform(-1.6, -41, 1.6, -38, 0, paths.pingPong(0, 5, 0, 3.6));
  b.platform(-3, -54, 3, -44, 5);
  for (let i = 0; i < 3; i++) {
    const z0 = -58 - i * 7;
    b.movingPlatform(-2, z0 - 4, 2, z0, 5, paths.swing(3, 0, 0, 4, i * 0.33));
  }
  b.platform(-3, -92, 3, -80, 5);
  b.movingPlatform(-1.8, -101.8, 1.8, -98.2, 6, paths.circle(4, 4, 5));
  b.platform(-3, -120, 3, -108, 6);
  b.goalPortal(0, 6, -115);
  b.memory(-4, 7.8, -100);
  b.hint([-3, -1, -4], [3, 6, 6], 'Plataformas em movimento carregam você. Espere o momento certo.');
  b.scenery(0, -60, 130);
  b.motes([-14, -4, -120], [14, 16, 10], 800, MOTE_TEAL);
  b.killY = -14;
}

// --------------------------------------------------------------- 7
export function travessia(b) {
  b.platform(-6, -6, 6, 6, 1.5);
  b.startAt(0, 1.5, 2);
  // sentidos alternados: a velocidade relativa entre vizinhas fica em ~11 m/s
  const rows1 = [[-9.7, 4.5, 1, 11], [-14.2, 6, -1, 13], [-18.7, 4, 1, 11], [-23.2, 6.5, -1, 14]];
  const rows2 = [[-35.6, 5, 1, 12], [-40.1, 6.5, -1, 14], [-44.6, 4.5, 1, 11], [-49.1, 7, -1, 15], [-53.6, 5.5, 1, 12]];
  [...rows1, ...rows2].forEach(([z, speed, dir, spacing], i) => {
    b.lane({ axis: 'x', z, top: 1.5, speed, dir, from: dir > 0 ? -45 : 45, to: dir > 0 ? 45 : -45, spacing, len: 7, phase: (i * 0.37) % 1 });
  });
  b.platform(-5, -32, 5, -26.8, 1.5);
  b.platform(-5, -66, 5, -57.2, 1.5);
  b.goalPortal(0, 1.5, -62);
  b.memory(6, 3.3, -40.1);
  b.hint([-6, 0, -6], [6, 7, 6], 'Rios de carruagens cruzam o caminho. Pule de uma para outra antes que elas levem você embora.');
  b.scenery(0, -30, 110);
  b.motes([-40, -4, -70], [40, 12, 10], 900, MOTE_TEAL);
  b.killY = -14;
}

// --------------------------------------------------------------- 8
export function corredor(b) {
  const M = b.M;
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-2.2, -14, 2.2, -4, 0);
  // fosso entre paredes: pulo na parede
  b.block(-3.4, A, -30, -2.2, 6, -14, M.wall);
  b.block(2.2, A, -30, 3.4, 6, -14, M.wall);
  // área de pouso livre depois de cada fosso
  b.platform(-2.2, -52, 2.2, -30, 0);
  b.blade(-0.9, 0, -37.2, 0.9, 2.4, -36.8, paths.swing(3, 0, 0, 1.9, 0));
  b.veilWall(-2.2, 0, -41.5, 2.2, 3.8);
  b.block(-3.4, A, -70, -2.2, 8, -52, M.wall);
  b.block(2.2, A, -70, 3.4, 8, -52, M.wall);
  b.orb(0, 2.4, -61);
  b.platform(-2.2, -98, 2.2, -70, 0);
  b.blade(-2.2, 0, -82.5, 2.2, 3, -81.5, paths.pingPong(0, 3.4, 0, 1.4, 0));
  b.blade(-2.2, 0, -86.5, 2.2, 3, -85.5, paths.pingPong(0, 3.4, 0, 1.4, 0.5));
  b.goalPortal(0, 0, -93);
  b.memory(0, 6.6, -61);
  b.hint([-2.2, -1, -14], [2.2, 6, -4], 'Fosso entre paredes: salte contra uma parede e aperte <kbd>Espaço</kbd> de novo ao tocá-la.<br>Alterne entre as paredes para atravessar.');
  b.hint([-2.2, -1, -52], [2.2, 6, -43], 'Outro fosso, mais longo. Há um cristal no meio.');
  b.scenery(0, -46, 110);
  b.motes([-12, -4, -100], [12, 14, 10], 700, MOTE_ROSE);
  b.killY = -14;
}

// --------------------------------------------------------------- 9
export function torre(b) {
  const M = b.M;
  b.platform(-4, -5, 4, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -13, 3, -8, 1.2);
  b.platform(-3, -21, 3, -16, 2.4);
  b.platform(-3, -29, 3, -24, 3.6);
  b.pad(0, 3.6, -27, 20, [0, -6]);
  b.platform(-3, -42, 3, -31, 9);
  // chaminé: suba pulando de uma parede para a outra
  b.block(-2.7, 9, -52, -1.7, 18, -42, M.wall);
  b.block(1.7, 9, -52, 2.7, 18, -42, M.wall);
  b.platform(-3, -60, 3, -52, 16.5);
  b.movingPlatform(-1.6, -65, 1.6, -62, 16.5, paths.pingPong(0, 6, 0, 3.5));
  b.platform(-3, -76, 3, -67, 22);
  b.goalPortal(0, 22, -72);
  b.memory(-2.2, 19.3, -47);
  b.veilSurge({ minX: -40, maxX: 40, minY: -60, maxY: -2, minZ: -100, maxZ: 30, velocity: [0, 1.25, 0], delay: 3, horizontal: true });
  b.hint([-4, -1, -5], [4, 6, 6], 'A maré do Véu está subindo. Para cima, rápido!');
  b.hint([-3, 8, -42], [3, 14, -31], 'Chaminé: pule de uma parede para a outra até o topo.');
  b.scenery(0, -40, 110);
  b.motes([-14, 0, -80], [14, 30, 10], 900, MOTE_TEAL);
  b.killY = -14;
}

// --------------------------------------------------------------- 10
export function tempestade(b) {
  b.platform(-3, -4, 2, 8, 2.0);
  b.startAt(-0.5, 2, 4);
  const weave = { amp: 2.5, length: 70 };
  const T0 = b.lane({ x: 5, top: 1.5, speed: 14, spacing: 11, startZ: 80, endZ: -330, crash: [-110], weave });
  const T0b = b.lane({ x: 5, top: 1.5, speed: 15, spacing: 12, startZ: -120, endZ: -330, crash: [-250], weave, phase: 0.4 });
  const T1 = b.lane({ x: 9.5, top: 2.7, speed: 17, spacing: 13, startZ: 80, endZ: -330, crash: [-180], weave, phase: 0.3 });
  const T2 = b.lane({ x: 14, top: 3.9, speed: 12, spacing: 10, startZ: 80, endZ: -322, weave, phase: 0.6 });
  tower(b, b.laneV(T0, -110), -110);
  tower(b, b.laneV(T0b, -250), -250);
  tower(b, b.laneV(T1, -180), -180, 13);
  // cada barra cobre só a sua faixa (as faixas têm alturas diferentes)
  for (const z of [-60, -150, -220, -290]) {
    for (const L of [T0, T1, T2]) {
      const x = b.laneV(L, z);
      b.blade(x - 2.25, L.top + 0.75, z - 0.15, x + 2.25, L.top + 1.0, z + 0.15);
    }
    const x0 = b.laneV(T0, z) - 2.25;
    const x1 = b.laneV(T2, z) + 2.25;
    b.block(x0 - 0.7, A, z - 0.35, x0, 6, z + 0.35, b.M.wall, { uv: 1.5 });
    b.block(x1, A, z - 0.35, x1 + 0.7, 6, z + 0.35, b.M.wall, { uv: 1.5 });
  }
  b.platform(9, -352, 18, -326, 5);
  b.goalPortal(13.5, 5, -344);
  b.memory(b.laneV(T2, -200), T2.top + 2.3, -200);
  b.hint([-3, 0, -4], [2, 6, 8], 'Tempestade: as faixas serpenteiam e ficam em alturas diferentes. A mais alta é a mais lenta.');
  b.scenery(9, -160, 210);
  b.motes([-5, -4, -350], [24, 14, 20], 1400, MOTE_TEAL);
  b.killY = -20;
}

// --------------------------------------------------------------- 11
export function ceu(b) {
  const Y = 20;
  b.platform(-4, -4, 4, 6, Y, { bottom: Y - 14 });
  b.startAt(0, Y, 3);
  b.pad(0, Y, -2, 18, [0, -14]);
  b.platform(-4, -36, 4, -18, Y, { bottom: Y - 12 });
  b.boostRing(0, Y + 2, -35, [0.45, 0.25, -1], 27);
  b.platform(3, -64, 12, -48, Y - 2, { bottom: Y - 14 });
  b.orb(7.5, Y + 0.5, -71.5);
  b.orb(7.5, Y + 0.5, -78.5);
  b.platform(3, -98, 12, -84, Y - 2, { bottom: Y - 12 });
  b.pad(7.5, Y - 2, -95, 24, [-4, -6]);
  b.platform(-4, -120, 7, -102, Y + 6, { bottom: Y - 6 });
  b.boostRing(1.5, Y + 8, -119, [0, 0.1, -1], 30);
  b.platform(-5, -165, 6, -136, Y, { bottom: Y - 14 });
  b.goalPortal(0.5, Y, -157);
  b.platform(-6, -72, -2, -68, Y - 1, { bottom: Y - 8 });
  b.memory(-4, Y + 0.4, -70);
  b.hint([-4, Y - 1, -4], [4, Y + 6, 6], 'Ilhas no céu. Não olhe para baixo.');
  b.scenery(3, -80, 140);
  b.motes([-20, Y - 10, -170], [25, Y + 18, 10], 1200, MOTE_GOLD);
  b.killY = Y - 26;
}

// --------------------------------------------------------------- 12
export function fuga(b) {
  b.platform(-3, -4, 2, 8, 2.0);
  b.startAt(-0.5, 2, 4);
  b.lane({ x: 5, top: 1.5, speed: 15, spacing: 11, startZ: 80, endZ: -262, crash: [-120] });
  b.lane({ x: 9.5, top: 1.5, speed: 18, spacing: 13, startZ: 80, endZ: -262, crash: [-200], phase: 0.3 });
  b.lane({ x: 5, top: 1.5, speed: 16, spacing: 12, startZ: -130, endZ: -262, phase: 0.6 });
  tower(b, 5, -120);
  tower(b, 9.5, -200);
  for (const z of [-70, -160, -235]) bar(b, 2.6, 12, 2.25, z);
  b.platform(1.5, -292, 12.5, -266, 3.5);
  b.veilWall(1.5, 3.5, -273, 12.5, 7.3);
  b.pad(7, 3.5, -284, 24, [0, -10]);
  b.platform(1.5, -318, 12.5, -294, 12);
  b.goalPortal(7, 12, -310);
  b.memory(9.5, 4.0, -95);
  b.veilSurge({ minX: -10, maxX: 25, minY: -30, maxY: 24, minZ: 12, maxZ: 13, velocity: [0, 0, -9], delay: 2 });
  b.hint([-3, 0, -4], [2, 6, 8], 'Fuga final: o Véu é mais rápido que você a pé. Pegue as carruagens!');
  b.scenery(7, -150, 200);
  b.motes([-8, -4, -325], [22, 20, 20], 1400, MOTE_ROSE);
  b.killY = -20;
}
