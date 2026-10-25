// Fases das novas mecânicas: deslizar, Gancho do Véu, correntes de vento,
// plataformas de ritmo, o outro lado do Véu (F), a Sombra e o final.
// Números de referência do andarilho: corrida 9,5 m/s, salto de 1,63 m,
// salto com corrida ~6,4 m, salto + Passo do Véu ~13 m, deslize ~13 m/s.
import * as THREE from 'three';
import { paths } from './builder.js';

const MOTE_BLUE = new THREE.Color(0.35, 0.75, 2.0);
const MOTE_ROSE = new THREE.Color(2.0, 0.5, 0.9);
const MOTE_TEAL = new THREE.Color(0.4, 1.8, 1.6);
const MOTE_VIOLET = new THREE.Color(1.3, 0.5, 2.2);
const MOTE_GOLD = new THREE.Color(2.0, 1.4, 0.5);

// --------------------------------------------------------------- Fendas
export function fendas(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-2.5, -60, 2.5, -4, 0);
  b.lowBar(-2.5, 2.5, 0, -16);
  b.lowBar(-2.5, 2.5, 0, -24);
  b.crawl(-2.5, 2.5, -40, -33, 0);
  b.blade(-0.9, 0, -46.2, 0.9, 2.4, -45.8, paths.swing(1.8, 0, 0, 1.6, 0));
  b.lowBar(-2.5, 2.5, 0, -53);
  // salto deslizando sobre o vão
  b.platform(-2.5, -86, 2.5, -68, 0);
  b.lowBar(-2.5, 2.5, 0, -73);
  b.crawl(-2.5, 2.5, -82, -78, 0);
  b.platform(-2.5, -122, 2.5, -91, 0);
  b.lowBar(-2.5, 2.5, 0, -98);
  b.blade(-2.5, 0, -103.5, 2.5, 2.6, -102.5, paths.pingPong(0, 3.2, 0, 1.5, 0));
  b.lowBar(-2.5, 2.5, 0, -108);
  b.goalPortal(0, 0, -116);
  // fragmento numa saliência lateral
  b.platform(4.5, -30, 7.5, -26.5, 1.2);
  b.memory(6, 2.4, -28.2);
  b.hint([-3, -1, -10], [3, 6, 6], 'Correndo, aperte <kbd>C</kbd> para <b>deslizar</b> por baixo das barras.');
  b.hint([-2.5, -1, -32], [2.5, 6, -27], 'Passagem baixa: deslize e segure <kbd>C</kbd> para continuar lá dentro.');
  b.hint([-2.5, -1, -60], [2.5, 6, -55], 'Pule no meio do deslize: você mantém a velocidade.');
  b.scenery(0, -60, 120);
  b.motes([-14, -4, -120], [14, 12, 10], 800, MOTE_ROSE);
  b.killY = -14;
}

// --------------------------------------------------------------- Gancho
export function gancho(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -14, 3, -4, 0);
  b.anchor(0, 7, -21);
  b.platform(-3, -40, 3, -28, 0);
  b.anchor(0, 8, -47);
  b.platform(-3, -62, 3, -54, 1);
  // duas âncoras em sequência
  b.anchor(0, 9, -70);
  b.anchor(0, 9, -85);
  b.platform(-3, -104, 3, -93, 1);
  b.anchor(0, 10, -113);
  b.platform(-3, -142, 3, -122, 2);
  b.goalPortal(0, 2, -136);
  // fragmento no fundo de um balanço longo
  b.memory(0, -4.0, -47);
  b.hint([-3, -1, -6], [3, 6, 6], 'Segure <kbd>E</kbd> perto de uma âncora de luz para <b>balançar</b>. Solte <kbd>E</kbd> (ou <kbd>Espaço</kbd>) para se lançar.');
  b.hint([-3, -1, -40], [3, 6, -30], 'Embale com <kbd>W</kbd>. Quanto mais longe você agarrar, mais fundo é o balanço.');
  b.hint([-3, 0, -62], [3, 7, -55], 'Duas âncoras: solte uma e agarre a outra no ar.');
  b.hint([-3, 0, -104], [3, 7, -97], 'Solte no alto do arco — e use <kbd>Q</kbd> se faltar distância.');
  b.scenery(0, -70, 130);
  b.motes([-15, -10, -140], [15, 16, 10], 900, MOTE_TEAL);
  b.killY = -16;
}

// --------------------------------------------------------------- Ventos
export function ventos(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -14, 3, -4, 0);
  // corrente ascendente sobre o primeiro vão
  b.wind([-2.6, -12, -21.5], [2.6, 9, -14.6], [0, 48, 0]);
  b.platform(-3, -34, 3, -22, 7);
  // vento lateral: no ar ele empurra para a direita
  b.platform(-1.6, -41, 1.6, -37, 7);
  b.platform(-1.6, -48, 1.6, -44, 7);
  b.platform(-1.6, -55, 1.6, -51, 7);
  b.wind([-14, 5, -57.5], [14, 16, -34.5], [16, 0, 0]);
  b.platform(-3, -70, 3, -58, 7);
  // segunda coluna, mais alta
  b.wind([-2.6, -12, -78.5], [2.6, 17.5, -70.6], [0, 50, 0]);
  b.platform(-3, -92, 3, -79, 15);
  // vento contra: só com salto + Passo do Véu
  b.wind([-6, 13, -102.5], [6, 24, -92.5], [0, 0, 8]);
  b.platform(-3, -124, 3, -102, 15);
  b.goalPortal(0, 15, -117);
  b.memory(5.5, 10.5, -28);
  b.hint([-3, -1, -10], [3, 6, 6], 'Colunas de vento levantam você. Entre nela e flutue até o outro lado.');
  b.hint([-3, 6, -36], [3, 12, -23], 'Vento lateral: no ar, compense para a esquerda.');
  b.hint([-3, 14, -92], [3, 20, -85], 'Vento contra: salte e use <kbd>Q</kbd> no ar.');
  b.scenery(0, -60, 130);
  b.motes([-15, -4, -125], [15, 24, 10], 1000, MOTE_TEAL);
  b.killY = -16;
}

// --------------------------------------------------------------- Ritmo
export function ritmo(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -12, 3, -4, 0);
  b.phasePlatform(-2, -18, 2, -14, 0, { period: 2, phase: 0, on: 0.6 });
  b.phasePlatform(-2, -24, 2, -20, 0, { period: 2, phase: 0.5, on: 0.6 });
  b.phasePlatform(-2, -30, 2, -26, 0, { period: 2, phase: 0, on: 0.6 });
  b.platform(-3, -42, 3, -32, 0);
  // escada que pulsa
  b.phasePlatform(-2, -50, 2, -46, 0.6, { period: 1.8, phase: 0, on: 0.55 });
  b.phasePlatform(-2, -56, 2, -52, 1.2, { period: 1.8, phase: 0.33, on: 0.55 });
  b.phasePlatform(-2, -62, 2, -58, 1.8, { period: 1.8, phase: 0.66, on: 0.55 });
  b.platform(-3, -76, 3, -64, 1.8);
  // pontes longas com lâminas
  b.phasePlatform(-3, -90, 3, -80, 1.8, { period: 3, phase: 0, on: 0.75 });
  b.blade(-0.9, 1.8, -85.2, 0.9, 4.2, -84.8, paths.swing(2.4, 0, 0, 1.5, 0));
  b.phasePlatform(-3, -104, 3, -94, 1.8, { period: 3, phase: 0.4, on: 0.75 });
  b.blade(-3, 1.8, -99.5, 3, 4.6, -98.5, paths.pingPong(0, 3.4, 0, 1.5, 0));
  b.platform(-3, -122, 3, -108, 1.8);
  b.goalPortal(0, 1.8, -116);
  b.phasePlatform(5, -58.5, 7.5, -55.5, 2.6, { period: 1.8, phase: 0.5, on: 0.55 });
  b.memory(6.25, 3.8, -57);
  b.hint([-3, -1, -10], [3, 6, 6], 'Estas pontes respiram. Elas piscam antes de sumir — pule no ritmo.');
  b.scenery(0, -60, 120);
  b.motes([-15, -4, -125], [15, 14, 10], 900, MOTE_TEAL);
  b.killY = -14;
}

// --------------------------------------------------------------- Espelho
export function espelho(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -12, 3, -4, 0);
  // ponte que só existe do outro lado
  b.dimPlatform(-2.5, -24, 2.5, -14, 0, 1);
  b.platform(-3, -50, 3, -26, 0);
  // muro que só existe deste lado
  b.dimBlock(-3, 0, -40, 3, 4, -39, 0);
  b.dimBlock(-3, 0, -46, 3, 4, -45, 1);
  // alternando no ar
  b.dimPlatform(-2, -56, 2, -52, 0, 0);
  b.dimPlatform(-2, -62, 2, -58, 0, 1);
  b.dimPlatform(-2, -68, 2, -64, 0, 0);
  b.platform(-3, -82, 3, -70, 0);
  // escada entre os mundos
  b.dimPlatform(-2, -88, 2, -84, 1.2, 1);
  b.dimPlatform(-2, -94, 2, -90, 2.4, 0);
  b.dimPlatform(-2, -100, 2, -96, 3.6, 1);
  b.platform(-3, -116, 3, -102, 3.6);
  b.goalPortal(0, 3.6, -110);
  // fragmento numa ilha que só existe do outro lado
  b.dimPlatform(5, -33, 8.5, -29, 0.8, 1);
  b.memory(6.75, 2, -31);
  b.hint([-3, -1, -10], [3, 6, 6], 'Aperte <kbd>F</kbd> para <b>atravessar para o outro lado</b> do Véu. Os contornos mostram o que existe no outro mundo.');
  b.hint([-3, -1, -38], [3, 6, -30], 'Um muro deste lado... e nenhum do outro.');
  b.hint([-3, -1, -50], [3, 6, -47], 'Troque de mundo no meio do salto.');
  b.scenery(0, -60, 120);
  b.motes([-15, -4, -118], [15, 14, 10], 900, MOTE_VIOLET);
  b.killY = -14;
}

// --------------------------------------------------------------- Sombra
export function sombra(b) {
  b.platform(-3, -4, 3, 8, 0);
  b.startAt(0, 0, 3);
  b.shadowChaser(2.6);
  b.platform(-2.5, -30, 2.5, -4, 0);
  b.blade(-0.9, 0, -14.2, 0.9, 2.4, -13.8, paths.swing(3.2, 0, 0, 2, 0));
  b.lowBar(-2.5, 2.5, 0, -23);
  const xs = [0, 0.9, -0.9, 0.7, -0.5];
  xs.forEach((x, i) => {
    const z0 = -32 - i * 6;
    b.crumble(x - 1.6, z0 - 4.5, x + 1.6, z0, 0, 0.5);
  });
  b.platform(-3, -80, 3, -62, 0);
  b.blade(-3, 0, -71.5, 3, 2.6, -70.5, paths.pingPong(0, 3.2, 0, 1.4, 0));
  b.anchor(0, 7, -87);
  b.platform(-3, -110, 3, -95, 0);
  b.lowBar(-3, 3, 0, -103);
  b.platform(-3, -140, 3, -122, 0);
  b.veilWall(-3, 0, -128, 3, 3.8);
  b.goalPortal(0, 0, -135);
  b.memory(0, 3.0, -19);
  b.hint([-3, -1, -4], [3, 6, 8], 'A <b>Sombra</b> refaz cada passo seu, segundos depois. Se você parar, ela alcança você.');
  b.scenery(0, -70, 130);
  b.motes([-15, -4, -140], [15, 14, 10], 900, MOTE_ROSE);
  b.killY = -14;
}

// --------------------------------------------------------------- Abismo
export function abismo(b) {
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -12, 3, -4, 0);
  b.dimPlatform(-2, -22, 2, -15, 0, 1);
  b.anchor(0, 8, -30);
  b.dimPlatform(-3, -48, 3, -37, 0, 0);
  b.wind([-2.6, -12, -56.5], [2.6, 10.5, -48.6], [0, 48, 0]);
  b.dimPlatform(-3, -70, 3, -58, 8, 1);
  b.lowBar(-3, 3, 8, -66);
  b.platform(-3, -80, 3, -72, 8);
  b.anchor(0, 16, -87);
  b.anchor(0, 16, -101);
  b.dimPlatform(-3, -120, 3, -107, 8, 0);
  b.platform(-3, -134, 3, -122, 8);
  b.goalPortal(0, 8, -128);
  b.memory(0, 7.5, -94);
  b.hint([-3, -1, -10], [3, 6, 6], 'Tudo o que você aprendeu, entre os dois mundos.');
  b.scenery(0, -65, 130);
  b.motes([-15, -10, -135], [15, 20, 10], 1100, MOTE_VIOLET);
  b.killY = -16;
}

// --------------------------------------------------------------- Coração
export function coracao(b) {
  b.platform(-3, -4, 3, 8, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -20, 3, -4, 0);
  b.lowBar(-3, 3, 0, -12);
  for (let i = 0; i < 4; i++) {
    const z0 = -22 - i * 6.5;
    b.crumble(-1.6 + (i % 2) * 0.8, z0 - 4.5, 1.6 + (i % 2) * 0.8, z0, 0, 0.5);
  }
  b.anchor(0, 8, -55);
  b.platform(-3, -78, 3, -62, 0);
  b.phasePlatform(-2, -86, 2, -81, 0, { period: 1.8, phase: 0, on: 0.6 });
  b.phasePlatform(-2, -94, 2, -89, 0, { period: 1.8, phase: 0.5, on: 0.6 });
  b.platform(-3, -112, 3, -97, 0);
  b.wind([-2.6, -12, -120.5], [2.6, 11.5, -112.6], [0, 50, 0]);
  b.platform(-3, -140, 3, -121, 9);
  b.dimPlatform(-2, -150, 2, -143, 9, 1);
  b.dimPlatform(-2, -158, 2, -153, 9, 0);
  // a arena diante do Colosso: os braços dele esmagam e varrem
  b.platform(-5, -192, 5, -161, 9);
  b.blade(-5, 9, -168.3, 5, 9.8, -167.7, paths.pingPong(0, 4.4, 0, 1.8, 0));
  b.lowBar(-5, 5, 9, -175);
  b.blade(-0.8, 9, -183.4, 0.8, 12, -182.6, paths.swing(3.8, 0, 0, 1.7, 0.25));
  b.goalPortal(0, 9, -188);
  b.colossusAt(0, -22, -222, 1.25);
  b.veilSurge({ minX: -20, maxX: 20, minY: -30, maxY: 34, minZ: 12, maxZ: 13, velocity: [0, 0, -6.4], delay: 3 });
  b.memory(4, 12.5, -131);
  b.hint([-3, -1, -4], [3, 6, 8], 'O Véu corrompido desperta. O Colosso espera no fim. <b>Corra!</b>');
  b.hint([-5, 8, -166], [5, 14, -161], 'Os braços do Colosso: passe por baixo quando subirem.');
  b.scenery(0, -100, 180);
  b.motes([-18, -4, -195], [18, 30, 10], 1500, MOTE_ROSE);
  b.motes([-18, -4, -195], [18, 30, 10], 500, MOTE_GOLD);
  b.killY = -16;
}
