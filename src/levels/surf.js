// Fases de surf (como no surf do CS): rampas íngremes sem atrito. Caia numa
// face, segure a direção CONTRA a rampa e deixe a gravidade acelerar.
// As rampas descem ao longo de -z; alternar de lado entre elas é o jogo.
import * as THREE from 'three';
import { paths } from './builder.js';

const MOTE_TEAL = new THREE.Color(0.4, 1.8, 1.6);
const MOTE_VIOLET = new THREE.Color(1.3, 0.5, 2.2);
const MOTE_GOLD = new THREE.Color(2.0, 1.4, 0.5);

const NEON = [0.3, 1.1, 2.2];
const NEON_PINK = [2.0, 0.4, 1.4];
const NEON_GOLD = [2.2, 1.4, 0.4];

// --------------------------------------------------------------- Surf I
export function surf1(b) {
  const Y = 70;
  b.platform(-3, -4, 3, 6, Y, { bottom: Y - 10 });
  b.startAt(1.2, Y, 3);
  // 1: rampa à direita (caia na face esquerda dela)
  b.surfRamp(4.4, -5, -95, Y - 1, Y - 19, 6.5, 9.5, NEON);
  // 2: rampa à esquerda
  b.surfRamp(-4.4, -103, -195, Y - 23, Y - 41, 6.5, 9.5, NEON);
  // 3: de novo à direita, mais longa
  b.surfRamp(4.4, -203, -320, Y - 45, Y - 68, 6.5, 9.5, NEON);
  b.platform(-5, -365, 7, -330, Y - 76, { bottom: Y - 90 });
  b.goalPortal(1, Y - 76, -355);
  b.memory(-7, Y - 30, -150);
  b.hint([-3, Y - 1, -4], [3, Y + 6, 6], 'SURF: caia na rampa e segure a direção <b>contra</b> ela (<kbd>D</kbd> aqui). Não precisa de <kbd>W</kbd>: a gravidade acelera você.');
  b.hint([-9, Y - 35, -103], [9, Y - 10, -94], 'Troque de rampa: agora segure <kbd>A</kbd>.');
  b.scenery(0, -170, 230);
  b.motes([-20, Y - 90, -360], [20, Y + 10, 10], 1600, MOTE_TEAL);
  b.killY = Y - 100;
}

export { NEON, NEON_PINK, NEON_GOLD, MOTE_VIOLET, MOTE_GOLD, paths };
