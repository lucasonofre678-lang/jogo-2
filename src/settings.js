// Opções do jogador, salvas no navegador.
const KEY = 'veil.settings.v1';

export const DEFAULTS = {
  sensitivity: 1, // multiplicador do mouse
  padSensitivity: 1,
  invertY: false,
  fov: 68,
  volume: 0.75,
  music: 0.8,
  quality: 'alta', // alta | media | baixa
  gameSpeed: 1, // assistência: 1, 0.9, 0.8
  ghost: true, // fantasma do recorde
  shake: true,
  hints: true,
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (s && typeof s === 'object') return { ...DEFAULTS, ...s };
  } catch {
    /* armazenamento indisponível */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* armazenamento indisponível */
  }
}
