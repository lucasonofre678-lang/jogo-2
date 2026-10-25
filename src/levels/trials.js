// Fases que misturam várias mecânicas, as provas difíceis do capítulo VI e
// a luta contra o Colosso.
import * as THREE from 'three';
import { paths } from './builder.js';

const MOTE_TEAL = new THREE.Color(0.4, 1.8, 1.6);
const MOTE_VIOLET = new THREE.Color(1.3, 0.5, 2.2);
const MOTE_ROSE = new THREE.Color(2.0, 0.5, 0.9);
const MOTE_GOLD = new THREE.Color(2.0, 1.4, 0.5);
const NEON = [0.3, 1.1, 2.2];
const NEON_PINK = [2.0, 0.4, 1.4];

// altura da crista de uma rampa em z (para posicionar barras e fragmentos)
function ridge(z0, z1, h0, h1, z) {
  return h0 + ((h1 - h0) * (z - z0)) / (z1 - z0);
}

// barra sobre a parte de cima da face de uma rampa: surfe mais embaixo
function rampBar(b, x0, side, z, ridgeY, depth = 2.8) {
  const xa = side < 0 ? x0 - depth : x0;
  const xb = side < 0 ? x0 : x0 + depth;
  b.blade(xa - (side < 0 ? 0 : 0.4), ridgeY - 4.2, z - 0.25, xb + (side < 0 ? 0.4 : 0), ridgeY + 1.5, z + 0.25);
}

// --------------------------------------------------------------- Crista Partida (surf difícil)
export function surf2(b) {
  const Y = 110;
  b.platform(-3, -4, 3, 6, Y, { bottom: Y - 10 });
  b.startAt(1.5, Y, 3);
  b.surfRamp(4.4, -5, -85, Y - 1, Y - 17, 6.5, 9.5, NEON);
  // rampa à esquerda, mais longe: mude de lado no ar
  const R2 = [-6.5, -95, -170, Y - 21, Y - 36];
  b.surfRamp(R2[0], R2[1], R2[2], R2[3], R2[4], 6.5, 9.5, NEON_PINK);
  for (const z of [-118, -145]) rampBar(b, R2[0], 1, z, ridge(R2[1], R2[2], R2[3], R2[4], z));
  // rampa que só existe do outro lado do Véu
  b.dimRamp(4.4, -180, -255, Y - 40, Y - 55, 6.5, 9.5, 1);
  b.surfRamp(-4.4, -265, -350, Y - 59, Y - 76, 6.5, 9.5, NEON);
  b.platform(-6, -410, 6, -362, Y - 84, { bottom: Y - 96 });
  b.goalPortal(0, Y - 84, -400);
  b.memory(R2[0], ridge(R2[1], R2[2], R2[3], R2[4], -105) + 1.4, -105);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 6], 'Crista Partida: mude de lado no ar, fuja das barras e lembre do <kbd>F</kbd>.');
  b.hint([-10, Y - 34, -112], [2, Y - 15, -100], 'Barras na crista: surfe na parte de baixo da rampa.');
  b.hint([-8, Y - 45, -178], [10, Y - 30, -168], 'A próxima rampa só existe do outro lado: <kbd>F</kbd> antes de cair!');
  b.scenery(0, -200, 260);
  b.motes([-20, Y - 100, -410], [20, Y + 10, 10], 1800, MOTE_VIOLET);
  b.killY = Y - 112;
}

// --------------------------------------------------------------- Labirinto de Runas
export function labirinto(b) {
  const M = b.M;
  b.platform(-3, -4, 3, 6, 0);
  b.startAt(0, 0, 3);
  b.platform(-3, -60, 3, -4, 0);
  b.block(-3.6, 0, -60, -3, 4.5, -4, M.wall);
  b.block(3, 0, -60, 3.6, 4.5, -4, M.wall);
  // 1: a runa abre o portão
  b.rune(1.8, 1.3, -8, 'g1');
  b.gate(-3, 0, -14.4, 3, 4.5, -13.6, 'g1');
  // 2: portão com tempo, barra no meio
  b.rune(-1.8, 1.3, -20, 'g2', 4);
  b.lowBar(-3, 3, 0, -27);
  b.gate(-3, 0, -34.4, 3, 4.5, -33.6, 'g2');
  b.checkpoint(0, 0, -38, 2.2, -36.5);
  // 3: a runa está do outro lado do Véu
  b.dimPlatform(-1.5, -44, 1.5, -40.5, 1.2, 1);
  b.rune(0, 2.9, -42.2, 'g3', 6);
  b.gate(-3, 0, -50.4, 3, 4.5, -49.6, 'g3');
  b.dimPlatform(-1.5, -48.5, 1.5, -46.5, 2.5, 1);
  b.memory(0, 4.1, -47.5);
  // pontes que respiram sobre o vão
  b.phasePlatform(-2, -67, 2, -63, 0, { period: 2, phase: 0, on: 0.62 });
  b.phasePlatform(-2, -75, 2, -71, 0, { period: 2, phase: 0.45, on: 0.62 });
  b.platform(-3, -112, 3, -79, 0);
  b.block(-3.6, 0, -112, -3, 4.5, -79, M.wall);
  b.block(3, 0, -112, 3.6, 4.5, -79, M.wall);
  // 4: corrida contra o portão
  b.rune(0, 1.3, -84, 'g4', 3.4);
  b.lowBar(-3, 3, 0, -93);
  b.blade(-0.9, 0, -97.2, 0.9, 2.4, -96.8, paths.swing(2, 0, 0, 1.4, 0));
  b.gate(-3, 0, -102.4, 3, 4.5, -101.6, 'g4');
  b.goalPortal(0, 0, -107);
  b.hint([-3, -1, -10], [3, 6, 6], 'Runas abrem portões. Algumas só por alguns segundos — <b>corra</b>.');
  b.hint([-3, -1, -45], [3, 6, -39], 'Esta runa está do outro lado do Véu (<kbd>F</kbd>).');
  b.hint([-3, -1, -84], [3, 6, -80], 'Última runa: o portão fecha rápido. Deslize por baixo da barra sem parar.');
  b.scenery(0, -55, 130);
  b.motes([-14, -4, -112], [14, 12, 10], 900, MOTE_GOLD);
  b.killY = -14;
}

// --------------------------------------------------------------- Tempestade de Âncoras
export function ancoras(b) {
  const Y = 20;
  b.platform(-3, -4, 3, 8, Y, { bottom: Y - 12 });
  b.startAt(0, Y, 3);
  b.shadowChaser(3.2);
  b.platform(-3, -14, 3, -4, Y, { bottom: Y - 12 });
  // corrente de âncoras sobre o abismo; a coluna de vento salva quem cair
  b.anchor(0, Y + 8, -21);
  b.anchor(0, Y + 9, -35);
  b.anchor(1.5, Y + 9, -49);
  b.wind([-3, Y - 32, -42], [3, Y + 2, -30], [0, 46, 0]);
  b.platform(-3, -74, 3, -57, Y, { bottom: Y - 12 });
  b.checkpoint(0, Y, -66, 2.2, -68);
  // vento lateral sobre pedras pequenas
  b.platform(-1.6, -83, 1.6, -79, Y, { bottom: Y - 8 });
  b.platform(-1.6, -92, 1.6, -88, Y, { bottom: Y - 8 });
  b.platform(-1.6, -101, 1.6, -97, Y, { bottom: Y - 8 });
  b.wind([-14, Y - 2, -104], [14, Y + 14, -74.5], [16, 0, 0]);
  b.anchor(-4, Y + 8, -95);
  b.platform(-3, -128, 3, -105, Y, { bottom: Y - 12 });
  b.lowBar(-3, 3, Y, -113);
  b.veilWall(-3, Y, -119, 3, Y + 3.8);
  b.goalPortal(0, Y, -125);
  b.memory(0, Y - 3.5, -35);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 8], 'Tempestade de Âncoras: a Sombra vem logo atrás. Se cair, a coluna de vento devolve você.');
  b.scenery(0, -65, 140);
  b.motes([-16, Y - 30, -130], [16, Y + 16, 10], 1200, MOTE_TEAL);
  b.killY = Y - 40;
}

// --------------------------------------------------------------- Prova do Tecelão (tudo junto)
export function prova(b) {
  const Y = 60;
  const M = b.M;
  b.platform(-3, -4, 3, 6, Y, { bottom: Y - 10 });
  b.startAt(1.5, Y, 3);
  // A: surf
  b.surfRamp(4.4, -5, -70, Y - 1, Y - 14, 6.5, 9.5, NEON);
  b.surfRamp(-4.4, -78, -140, Y - 18, Y - 30, 6.5, 9.5, NEON_PINK);
  // B: pouso, deslize
  b.platform(-4, -190, 4, -150, Y - 38, { bottom: Y - 50 });
  b.checkpoint(0, Y - 38, -176, 2.8, -178);
  b.lowBar(-4, 4, Y - 38, -183);
  // C: âncoras
  b.anchor(0, Y - 30, -198);
  b.anchor(0, Y - 29, -212);
  b.platform(-3, -236, 3, -221, Y - 38, { bottom: Y - 50 });
  // D: os dois mundos e o ritmo
  b.dimPlatform(-2, -243, 2, -239, Y - 38, 1);
  b.phasePlatform(-2, -251, 2, -247, Y - 38, { period: 1.6, phase: 0, on: 0.6 });
  b.dimPlatform(-2, -259, 2, -255, Y - 38, 0);
  b.platform(-3, -282, 3, -263, Y - 38, { bottom: Y - 50 });
  b.checkpoint(0, Y - 38, -270, 2.2, -268);
  // E: vento para cima e a chaminé
  b.wind([-2.6, Y - 70, -291], [2.6, Y - 25.5, -283], [0, 50, 0]);
  b.platform(-3, -306, 3, -292, Y - 28, { bottom: Y - 40 });
  b.block(-2.7, Y - 28, -316, -1.7, Y - 14, -306, M.wall);
  b.block(1.7, Y - 28, -316, 2.7, Y - 14, -306, M.wall);
  b.platform(-3, -332, 3, -316, Y - 16.5, { bottom: Y - 28 });
  b.blade(-0.9, Y - 16.5, -322.2, 0.9, Y - 14, -321.8, paths.swing(2.2, 0, 0, 1.5, 0));
  b.goalPortal(0, Y - 16.5, -328);
  b.memory(-2.2, Y - 13, -311);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 6], 'A Prova do Tecelão: surf, deslize, gancho, os dois mundos, ritmo e vento. Sem pressa — tem pontos de controle.');
  b.scenery(0, -165, 220);
  b.motes([-18, Y - 60, -335], [18, Y + 10, 10], 1800, MOTE_GOLD);
  b.killY = Y - 80;
}

// --------------------------------------------------------------- O Colosso (chefe)
export function colosso(b) {
  const M = b.M;
  b.platform(-16, -14, 16, 16, 0);
  b.startAt(0, 0, 12);
  b.checkpoint(0, 0, 11, 3.4, 13);
  // runa 1: no alto do pilar
  b.block(-12.5, 0, -6.5, -10.5, 3, -4.5, M.wall);
  // runa 3: só do outro lado do Véu
  b.dimPlatform(-1.5, -9.5, 1.5, -7.5, 1.2, 1);
  b.dimPlatform(-1.5, -12, 1.5, -10, 2.4, 1);
  b.dimPlatform(-1.5, -14, 1.5, -12.3, 3.6, 1);
  // runa 2: numa ilha flutuante; o trampolim leva até ela
  b.platform(9.5, -7.5, 12.5, -4.5, 5.5, { bottom: 3.6 });
  b.pad(11, 0, -0.5, 18, [0, -3]);
  b.anchor(6, 12.5, -2.5);
  b.colossusBoss({ runes: [[-11.5, 4.3, -5.5], [11, 6.9, -6], [0, 4.9, -13.1]], arena: [-16, -14, 16, 16] });
  b.goalPortal(0, 0, 2);
  b.memory(2.5, 9.5, -3);
  b.hint([-16, -1, 6], [16, 6, 16], 'Acenda as <b>três runas</b>. O círculo vermelho marca onde o punho cai.');
  b.hint([-16, -1, -2], [16, 6, 5], 'Braço baixo: <b>pule</b>. Braço alto: <b>deslize</b> (<kbd>C</kbd>).');
  b.scenery(0, -20, 140);
  b.motes([-20, -4, -20], [20, 25, 18], 1500, MOTE_ROSE);
  b.killY = -16;
}
