// Capítulo VII — Os Fios de Lira: os caminhos que a irmã do andarilho
// corria quando criança. Muros rúnicos (corrida na parede) e Fios de Luz
// (tirolesas), depois misturados com o resto.
// Referências: corrida 9,5 m/s · salto com corrida ~6,4 m · corrida na
// parede ~16 m a 11,5 m/s (sobe ~1,9 m e volta) · salto da parede: 8,6 para
// cima e 7,5 para fora · fio de luz até 22 m/s, no fim lança 4,5 para cima.
import * as THREE from 'three';
import { paths } from './builder.js';

const MOTE_GOLD = new THREE.Color(2.0, 1.4, 0.5);
const MOTE_AMBER = new THREE.Color(2.2, 1.1, 0.35);
const MOTE_ROSE = new THREE.Color(2.0, 0.5, 0.9);
const MOTE_VIOLET = new THREE.Color(1.3, 0.5, 2.2);

// muros ao longo de z (x0..x1 é a espessura)
const RIGHT = [3.2, 3.8];
const LEFT = [-3.8, -3.2];
function wall(b, [x0, x1], zFar, zNear, y = 0, h = 6) {
  return b.runWall(x0, y - 6, zFar, x1, y + h, zNear);
}

// --------------------------------------------------------------- 1. Muros de Lira
export function muros(b) {
  b.platform(-3, -14, 3, 6, 0);
  b.startAt(0, 0, 3);
  // um muro à direita sobre o primeiro vão
  wall(b, RIGHT, -32, -9);
  b.platform(-3, -46, 3, -28, 0);
  // muro à esquerda, vão maior
  wall(b, LEFT, -66, -42);
  b.platform(-3, -84, 3, -62, 0);
  b.checkpoint(0, 0, -74, 2.2, -79);
  // zigue-zague: direita e depois esquerda
  wall(b, RIGHT, -104, -82);
  wall(b, LEFT, -124, -98);
  b.platform(-3, -142, 3, -120, 0);
  // subida: salte do muro para a plataforma mais alta
  wall(b, RIGHT, -160, -138);
  b.platform(-3, -178, 3, -158, 2.5, { bottom: -8 });
  b.checkpoint(0, 2.5, -168, -2.2, -172);
  // final: quatro muros seguidos
  wall(b, LEFT, -198, -176, 2.5);
  wall(b, RIGHT, -214, -194, 2.5);
  wall(b, LEFT, -230, -210, 2.5);
  wall(b, RIGHT, -246, -226, 2.5);
  b.platform(-3, -276, 3, -244, 2.5, { bottom: -8 });
  b.goalPortal(0, 2.5, -268);
  // fragmento no alto do primeiro zigue-zague: corra o muro direito até o
  // fim antes de saltar
  b.memory(0, 5.6, -104.2);
  b.hint([-3, -1, -4], [3, 6, 6], '<b>Muros de Lira</b>: no ar, encoste de lado num muro dourado e segure para frente — você <b>corre na parede</b>.');
  b.hint([-3, -1, -46], [3, 6, -36], 'Muro à esquerda: chegue perto dele antes de saltar.');
  b.hint([-3, -1, -84], [3, 6, -76], 'Na parede, aperte <kbd>Espaço</kbd>: o salto lança você para o muro da frente. Cada salto <b>acelera</b>.');
  b.hint([-3, -1, -142], [3, 6, -132], 'Para subir, salte do muro perto do fim da corrida.');
  b.scenery(0, -130, 200);
  b.motes([-16, -8, -270], [16, 14, 10], 1600, MOTE_GOLD);
  b.killY = -14;
}

// --------------------------------------------------------------- 2. Fios de Luz
export function fios(b) {
  const Y = 14;
  b.platform(-3, -8, 3, 6, Y, { bottom: Y - 12 });
  b.startAt(0, Y, 3);
  // primeiro fio: desce da torre até a ilha
  b.zipline(0, Y + 3, -5, 0, Y - 4, -40, { postA: 3 });
  b.platform(-3, -64, 3, -42, Y - 7, { bottom: Y - 18 });
  // dois fios seguidos: segure E no ar e agarre o segundo sozinho
  b.zipline(0, Y - 4, -60, 0, Y - 9, -86, { postA: 3 });
  b.zipline(0, Y - 10.5, -92, 0, Y - 14, -122);
  b.platform(-3, -148, 3, -124, Y - 17, { bottom: Y - 28 });
  b.checkpoint(0, Y - 17, -136, 2.2, -140);
  // fio que sobe: o embalo acaba; salte antes de parar
  b.zipline(0, Y - 14, -145, 0, Y - 11, -168, { postA: 3 });
  b.platform(-3, -186, 3, -170, Y - 12, { bottom: Y - 24 });
  // fio em diagonal, curto: termine com o Passo do Véu
  b.zipline(0, Y - 9, -183, 9, Y - 13, -206, { postA: 3 });
  b.platform(10, -236, 16, -214, Y - 15, { bottom: Y - 26 });
  b.goalPortal(13, Y - 15, -228);
  // fragmento logo acima do primeiro fio: salte dele e agarre de novo
  b.memory(0, Y + 0.6, -24);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 6], '<b>Fios de Luz</b>: perto do fio, segure <kbd>E</kbd> para deslizar. No fim, o fio <b>lança</b> você.');
  b.hint([-3, Y - 8, -64], [3, Y, -52], 'Mantenha <kbd>E</kbd> apertado no ar: você agarra o próximo fio sozinho — até o mesmo fio, depois de saltar dele.');
  b.hint([-3, Y - 18, -148], [3, Y - 10, -140], 'Este fio sobe: o embalo acaba. Salte (<kbd>Espaço</kbd>) antes de parar.');
  b.hint([-3, Y - 13, -186], [3, Y - 5, -178], 'O último fio acaba no vazio: salte e use <kbd>Q</kbd>.');
  b.scenery(4, -120, 190);
  b.motes([-16, Y - 30, -240], [22, Y + 10, 10], 1600, MOTE_AMBER);
  b.killY = Y - 34;
}

// --------------------------------------------------------------- 3. Zigue-Zague
export function ziguezague(b) {
  b.platform(-3, -10, 3, 6, 0);
  b.startAt(0, 0, 3);
  // corredor de muros alternados sobre o abismo
  wall(b, RIGHT, -30, -6);
  wall(b, LEFT, -46, -24);
  wall(b, RIGHT, -62, -40);
  wall(b, LEFT, -78, -56);
  b.platform(-3, -100, 3, -76, 0);
  // barra baixa no meio da plataforma: deslize sem perder o embalo
  b.lowBar(-3, 3, 0, -88);
  b.checkpoint(0, 0, -94, 2.2, -97);
  // muros com lâminas: salte antes delas
  wall(b, RIGHT, -122, -98);
  b.blade(2.2, -0.5, -116.4, 3.2, 4.5, -115.6);
  wall(b, LEFT, -140, -114);
  b.blade(-3.2, -0.5, -134.4, -2.2, 4.5, -133.6);
  b.platform(-3, -160, 3, -136, 0);
  // barreira do Véu entre os muros: Passo do Véu no meio do zigue-zague
  wall(b, RIGHT, -182, -156);
  b.veilWall(-3.2, -2, -175, 3.2, 6, false);
  wall(b, LEFT, -198, -172);
  b.platform(-3, -222, 3, -196, 0);
  b.checkpoint(0, 0, -206, -2.2, -210);
  // sprint final: seis muros (altos: o zigue-zague longo ganha altura)
  wall(b, RIGHT, -240, -218, 0, 10);
  wall(b, LEFT, -256, -234, 0, 10);
  wall(b, RIGHT, -272, -250, 0, 10);
  wall(b, LEFT, -288, -266, 0, 10);
  wall(b, RIGHT, -304, -282, 0, 10);
  wall(b, LEFT, -320, -298, 0, 10);
  b.platform(-3, -352, 3, -318, 0);
  b.goalPortal(0, 0, -344);
  b.memory(0, 5.6, -264);
  b.hint([-3, -1, -4], [3, 6, 6], 'Zigue-zague: de muro em muro com <kbd>Espaço</kbd>. Quanto mais saltos emendados, maior o <b>Fluxo</b>.');
  b.hint([-3, -1, -100], [3, 6, -92], 'Lâminas nos muros: salte para o muro da frente antes de chegar nelas.');
  b.hint([-3, -1, -160], [3, 6, -150], 'Uma barreira do Véu entre os muros: atravesse com <kbd>Q</kbd>.');
  b.scenery(0, -170, 230);
  b.motes([-16, -8, -350], [16, 14, 10], 1800, MOTE_GOLD);
  b.killY = -14;
}

// --------------------------------------------------------------- 4. O Tear do Céu
export function tear(b) {
  const Y = 10;
  b.platform(-3, -10, 3, 6, Y, { bottom: Y - 12 });
  b.startAt(0, Y, 3);
  // fio até a primeira âncora
  b.zipline(0, Y + 3, -7, 0, Y - 1, -34, { postA: 3 });
  b.anchor(0, Y + 4, -46);
  b.platform(-3, -72, 3, -56, Y - 6, { bottom: Y - 16 });
  // corrente para cima até o muro, depois o muro
  b.wind([-2.6, Y - 30, -88], [2.6, Y + 3, -74], [0, 46, 0]);
  b.platform(-3, -82, 3, -76, Y - 8, { bottom: Y - 16 });
  wall(b, RIGHT, -108, -86, Y, 10);
  b.platform(-3, -132, 3, -104, Y, { bottom: Y - 12 });
  b.checkpoint(0, Y, -120, -2.2, -126);
  // âncora → fio (agarre o fio no ar)
  b.anchor(0, Y + 7, -140);
  b.zipline(0, Y + 2, -152, 0, Y - 6, -186);
  b.platform(-3, -208, 3, -188, Y - 9, { bottom: Y - 20 });
  // dois muros e um trampolim no fim
  wall(b, LEFT, -228, -206, Y - 9);
  wall(b, RIGHT, -244, -222, Y - 9);
  b.platform(-3, -262, 3, -244, Y - 9, { bottom: Y - 20 });
  b.pad(0, Y - 9, -256, 20, [0, -10]);
  b.platform(-3, -292, 3, -268, Y - 4, { bottom: Y - 16 });
  b.goalPortal(0, Y - 4, -284);
  // fragmento no topo da corrente de vento: pare dentro dela e suba
  b.memory(0, Y + 6, -80);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 6], 'O Tear do Céu: fios, âncoras, vento e muros, tudo emendado.');
  b.hint([-3, Y - 1, -132], [3, Y + 5, -126], 'Da âncora para o fio: segure <kbd>E</kbd> o tempo todo e o andarilho troca sozinho.');
  b.scenery(0, -150, 210);
  b.motes([-16, Y - 20, -300], [16, Y + 16, 10], 1600, MOTE_AMBER);
  b.killY = Y - 30;
}

// --------------------------------------------------------------- 5. Pega-Pega
export function pegapega(b) {
  b.platform(-3, -12, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.shadowChaser(2.6);
  wall(b, RIGHT, -32, -10);
  b.platform(-3, -58, 3, -28, 0);
  b.lowBar(-3, 3, 0, -46);
  b.zipline(0, 3, -55, 0, -3, -80, { postA: 3 });
  b.platform(-3, -100, 3, -82, -6, { bottom: -16 });
  wall(b, LEFT, -122, -98, -6);
  wall(b, RIGHT, -138, -116, -6);
  b.platform(-3, -160, 3, -136, -6, { bottom: -16 });
  b.blade(-3, -6, -150.4, 3, -4.6, -149.6, paths.pingPong(0, 2.6, 0, 1.4, 0));
  b.zipline(0, -3, -158, 0, -9, -190, { postA: 3 });
  b.platform(-3, -212, 3, -192, -12, { bottom: -22 });
  b.goalPortal(0, -12, -204);
  b.memory(0, -4.4, -172);
  b.hint([-3, -1, -4], [3, 6, 6], 'Lira e eu brincávamos de pega-pega nos muros. Agora quem corre atrás é a <b>Sombra</b>. Não pare.');
  b.scenery(0, -100, 180);
  b.motes([-16, -20, -215], [16, 12, 10], 1400, MOTE_ROSE);
  b.killY = -24;
}

// --------------------------------------------------------------- 6. O Último Fio
export function ultimofio(b) {
  const Y = 20;
  b.platform(-3, -10, 3, 6, Y, { bottom: Y - 12 });
  b.startAt(0, Y, 3);
  // A: fio longo descendo para os muros
  b.zipline(0, Y + 3, -7, 0, Y - 5, -40, { postA: 3 });
  b.platform(-3, -58, 3, -44, Y - 8, { bottom: Y - 20 });
  wall(b, RIGHT, -78, -56, Y - 8);
  wall(b, LEFT, -94, -72, Y - 8);
  b.platform(-3, -116, 3, -92, Y - 8, { bottom: Y - 20 });
  b.checkpoint(0, Y - 8, -104, 2.2, -108);
  // B: os dois mundos entre muros
  b.dimPlatform(-2, -124, 2, -118, Y - 8, 1);
  b.dimPlatform(-2, -132, 2, -126, Y - 8, 0);
  b.dimPlatform(-2, -140, 2, -134, Y - 8, 1);
  b.platform(-3, -160, 3, -142, Y - 8, { bottom: Y - 20 });
  // C: âncora, fio e Passo do Véu
  b.anchor(0, Y - 2, -168);
  b.zipline(0, Y - 4, -180, 0, Y - 12, -212);
  b.platform(-3, -238, 3, -216, Y - 15, { bottom: Y - 26 });
  b.checkpoint(0, Y - 15, -226, -2.2, -230);
  // D: zigue-zague final com trampolim e anel
  wall(b, LEFT, -258, -236, Y - 15);
  wall(b, RIGHT, -274, -252, Y - 15);
  wall(b, LEFT, -290, -268, Y - 15);
  b.platform(-3, -310, 3, -288, Y - 15, { bottom: Y - 26 });
  b.pad(0, Y - 15, -304, 22, [0, -6]);
  b.boostRing(0, Y - 6, -318);
  b.platform(-4, -360, 4, -336, Y - 10, { bottom: Y - 22 });
  b.goalPortal(0, Y - 10, -352);
  b.memory(0, Y - 5.6, -129);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 6], 'O Último Fio: tudo o que Lira ensinou. Fios, muros, os dois mundos — e não olhe para baixo.');
  b.hint([-3, Y - 9, -116], [3, Y - 2, -110], 'Pontes dos dois mundos: <kbd>F</kbd> no ar, a cada salto.');
  b.scenery(0, -180, 240);
  b.motes([-18, Y - 30, -365], [18, Y + 10, 10], 1800, MOTE_VIOLET);
  b.killY = Y - 34;
}
