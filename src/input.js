// Controles: teclado (por posição física da tecla, funciona em ABNT/QWERTY),
// mouse com Pointer Lock e controle (Gamepad API, layout padrão Xbox/PS).
// O jogo consulta ações ("jump", "veil"...), não teclas.

const BLOCKED_DEFAULTS = new Set(['Space', 'Tab', 'Enter', 'KeyQ', 'KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown']);

// ação → teclas do teclado e botões do controle (índices do layout padrão)
const ACTIONS = {
  up: { keys: ['KeyW', 'ArrowUp'], pad: [] },
  down: { keys: ['KeyS', 'ArrowDown'], pad: [] },
  left: { keys: ['KeyA', 'ArrowLeft'], pad: [] },
  right: { keys: ['KeyD', 'ArrowRight'], pad: [] },
  jump: { keys: ['Space'], pad: [0] }, // A / ✕
  veil: { keys: ['KeyQ'], pad: [2, 5] }, // X / □, RB
  grapple: { keys: ['KeyE'], pad: [4, 7] }, // LB, RT
  shift: { keys: ['KeyF'], pad: [3] }, // Y / △
  sneak: { keys: ['KeyC', 'ControlLeft'], pad: [1, 6] }, // B / ○, LT
  walk: { keys: ['ShiftLeft', 'ShiftRight'], pad: [] },
  restart: { keys: ['KeyR'], pad: [8] }, // Back / Share
  pause: { keys: ['Escape', 'KeyP'], pad: [9] }, // Start / Options
  view: { keys: ['KeyV'], pad: [11] }, // R3
  confirm: { keys: ['Enter'], pad: [0] },
};

// ações que o jogador pode trocar de tecla (a primeira tecla de cada uma)
export const REBINDABLE = [
  ['up', 'Frente'], ['down', 'Trás'], ['left', 'Esquerda'], ['right', 'Direita'],
  ['jump', 'Saltar'], ['veil', 'Passo do Véu'], ['grapple', 'Gancho'], ['shift', 'Outro lado'],
  ['sneak', 'Deslizar / esgueirar'], ['walk', 'Andar'], ['restart', 'Reiniciar'], ['view', 'Câmera 1ª/3ª pessoa'],
];
const DEFAULT_KEYS = Object.fromEntries(Object.entries(ACTIONS).map(([k, v]) => [k, v.keys[0]]));

const NAMES = { Space: 'Espaço', ShiftLeft: 'Shift', ShiftRight: 'Shift D', ControlLeft: 'Ctrl', ControlRight: 'Ctrl D', AltLeft: 'Alt',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Escape: 'Esc', Enter: 'Enter', Tab: 'Tab', Backspace: '⌫',
  CapsLock: 'Caps', Backquote: "'", Minus: '-', Equal: '=', BracketLeft: '´', BracketRight: '[', Semicolon: 'Ç', Quote: '~',
  Backslash: ']', Comma: ',', Period: '.', Slash: ';', IntlBackslash: '\\', IntlRo: '/' };

// Nome legível de uma tecla (código físico do layout ABNT/QWERTY).
export function keyName(code) {
  if (!code) return '?';
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  if (code.startsWith('Mouse')) return code;
  return code;
}

const DEADZONE = 0.18;

function dz(v) {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  return Math.sign(v) * ((a - DEADZONE) / (1 - DEADZONE));
}

export class Input {
  constructor(element) {
    this.element = element;
    this.down = new Set();
    this.pressed = new Set();
    this.padDown = new Set();
    this.padPressed = new Set();
    this.padPrev = new Set();
    this.padMove = { x: 0, y: 0 };
    this.padLook = { x: 0, y: 0 };
    this.padConnected = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.locked = false;
    this.onLockChange = null;
    this.onPadChange = null;

    window.addEventListener('keydown', (e) => {
      if (BLOCKED_DEFAULTS.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => this.down.clear());

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      // Ignora saltos absurdos que alguns navegadores emitem ao travar o cursor.
      if (Math.abs(e.movementX) > 400 || Math.abs(e.movementY) > 400) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.element;
      this.onLockChange?.(this.locked);
    });

    window.addEventListener('gamepadconnected', () => this.onPadChange?.(true));
    window.addEventListener('gamepaddisconnected', () => this.onPadChange?.(false));
  }

  // Troca a tecla principal das ações: { jump: 'KeyK', ... }
  setBindings(map) {
    for (const [action, def] of Object.entries(DEFAULT_KEYS)) {
      const code = map[action] ?? def;
      ACTIONS[action].keys[0] = code;
      BLOCKED_DEFAULTS.add(code);
    }
  }

  label(action) {
    return keyName(ACTIONS[action]?.keys[0]);
  }

  // Lê o controle uma vez por quadro (antes de consultar as ações).
  poll() {
    this.padPressed.clear();
    this.padDown.clear();
    this.padMove.x = this.padMove.y = 0;
    this.padLook.x = this.padLook.y = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let pad = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    this.padConnected = !!pad;
    if (!pad) {
      this.padPrev.clear();
      return;
    }
    pad.buttons.forEach((b, i) => {
      if (b.pressed || b.value > 0.5) this.padDown.add(i);
    });
    for (const i of this.padDown) if (!this.padPrev.has(i)) this.padPressed.add(i);
    this.padPrev = new Set(this.padDown);
    this.padMove.x = dz(pad.axes[0] ?? 0);
    this.padMove.y = dz(pad.axes[1] ?? 0);
    this.padLook.x = dz(pad.axes[2] ?? 0);
    this.padLook.y = dz(pad.axes[3] ?? 0);
    // direcional também move
    if (this.padDown.has(12)) this.padMove.y = -1;
    if (this.padDown.has(13)) this.padMove.y = 1;
    if (this.padDown.has(14)) this.padMove.x = -1;
    if (this.padDown.has(15)) this.padMove.x = 1;
  }

  // Algum botão do controle foi apertado neste quadro?
  get anyPadPressed() {
    return this.padPressed.size > 0;
  }

  action(name) {
    const a = ACTIONS[name];
    return a.keys.some((k) => this.down.has(k)) || a.pad.some((b) => this.padDown.has(b));
  }

  actionPressed(name) {
    const a = ACTIONS[name];
    return a.keys.some((k) => this.pressed.has(k)) || a.pad.some((b) => this.padPressed.has(b));
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.element.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch {
      /* alguns navegadores recusam logo após sair do lock; o próximo clique resolve */
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.down.has(code);
  }

  wasPressed(code) {
    return this.pressed.has(code);
  }

  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
