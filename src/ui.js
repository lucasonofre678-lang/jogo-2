// Interface em DOM: cronômetro e medalhas, poder do Véu, alerta dos
// guardiões, dicas, linhas de velocidade, seleção de fases por capítulos,
// pausa, conclusão, opções, guarda-roupa (skins), memórias e epílogo.
// Navegável por mouse, teclado (setas + Enter) e controle.
import './style.css';
import { CHAPTERS, LORE, PROLOGUE, EPILOGUE } from './lore.js';
import { SKINS, skinUnlocked } from './skins.js';
import { REBINDABLE, keyName } from './input.js';

const RING_LEN = 2 * Math.PI * 30;
const MEDALS = ['ouro', 'prata', 'bronze'];
const SCREENS = ['title', 'select', 'pause', 'finish', 'options', 'wardrobe', 'memories', 'epilogue', 'credits'];
export const AUTHOR = 'owrayte';

const CONTROLS = `
  <div class="controls">
    <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> correr · <kbd>Mouse</kbd> câmera</span>
    <span><kbd>Espaço</kbd> saltar · na parede: pulo na parede</span>
    <span><kbd>Q</kbd> Passo do Véu (no ar também)</span>
    <span><kbd>C</kbd> correndo: deslizar · parado: esgueirar</span>
    <span><kbd>E</kbd> segurar: Gancho do Véu</span>
    <span><kbd>F</kbd> atravessar para o outro lado</span>
    <span><kbd>Shift</kbd> andar · <kbd>V</kbd> 1ª/3ª pessoa</span>
    <span><kbd>R</kbd> reiniciar · <kbd>Esc</kbd> pausa</span>
  </div>
  <p class="small pad-hint">Controle: <b>A</b> saltar · <b>X</b>/<b>RB</b> Véu · <b>LB</b>/<b>RT</b> gancho · <b>Y</b> outro lado · <b>B</b>/<b>LT</b> deslizar · <b>Start</b> pausa</p>`;

export function formatTime(t) {
  if (t === null || t === undefined || !isFinite(t)) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, '0');
  const c = Math.floor((t * 100) % 100).toString().padStart(2, '0');
  return `${m}:${s}.${c}`;
}

function medalFor(time, medals) {
  if (time === null || time === undefined) return -1;
  for (let i = 0; i < 3; i++) if (time <= medals[i]) return i;
  return 3;
}

function medalIcon(i, small = false) {
  if (i < 0) return `<span class="medal none${small ? ' small' : ''}"></span>`;
  if (i >= 3) return `<span class="medal done${small ? ' small' : ''}" title="concluída"></span>`;
  return `<span class="medal ${MEDALS[i]}${small ? ' small' : ''}" title="${MEDALS[i]}"></span>`;
}

function hex(c) {
  return '#' + c.toString(16).padStart(6, '0');
}

function rgb(arr, k = 1) {
  const m = Math.max(...arr, 1);
  return `rgb(${arr.map((v) => Math.round(Math.min(255, (v / m) * 255 * k))).join(',')})`;
}

export class UI {
  constructor() {
    const root = document.createElement('div');
    root.id = 'ui';
    root.innerHTML = `
      <canvas id="speedlines"></canvas>
      <div id="vignette"></div>
      <div id="alert-vignette"></div>
      <div id="danger-vignette"></div>
      <div id="veil-tint"></div>
      <div id="hud" class="hidden">
        <div id="run-info">
          <div id="level-label"></div>
          <div id="timer">0:00.00</div>
          <div id="target"></div>
          <div id="total-timer"></div>
        </div>
        <div id="alert">
          <svg viewBox="0 0 64 32" class="eye">
            <path d="M2 16 Q32 -6 62 16 Q32 38 2 16 Z" class="eye-outline"/>
            <clipPath id="eye-clip"><path d="M2 16 Q32 -6 62 16 Q32 38 2 16 Z"/></clipPath>
            <rect id="eye-fill" x="0" y="32" width="64" height="32" clip-path="url(#eye-clip)"/>
            <circle cx="32" cy="16" r="6" class="eye-pupil"/>
          </svg>
          <div id="alert-label">Oculto</div>
        </div>
        <div id="veil">
          <svg viewBox="0 0 72 72">
            <circle cx="36" cy="36" r="30" class="ring-bg"/>
            <circle cx="36" cy="36" r="30" id="veil-ring" class="ring-fg"
              stroke-dasharray="${RING_LEN}" stroke-dashoffset="0" transform="rotate(-90 36 36)"/>
            <path d="M36 18 L44 36 L36 54 L28 36 Z M36 26 L40 36 L36 46 L32 36 Z" class="rune"/>
          </svg>
          <div class="veil-text"><kbd>Q</kbd><span>Passo do Véu</span></div>
        </div>
        <div id="speed"><span id="speed-value">0</span><small>m/s</small></div>
        <div id="boss" class="hidden"><div class="boss-name">O Colosso</div><div id="boss-runes"></div></div>
        <div id="dim" class="hidden"><kbd>F</kbd><span id="dim-label">Mundo real</span></div>
        <div id="frag-ind" title="fragmento de memória desta fase">◆</div>
        <div id="prompt"></div>
        <div id="hint"></div>
        <div id="toast"></div>
        <div id="memory-pop"><div class="mp-label">Fragmento de memória</div><div class="mp-text"></div></div>
        <div id="dot"></div>
        <div id="restart-tip"><kbd>R</kbd> reinicia</div>
      </div>

      <div id="fade"></div>
      <div id="flash"></div>
      <div id="death-flash"></div>
      <div id="message"><div class="msg-title"></div><div class="msg-sub"></div></div>
      <div id="splash"><div class="splash-num"></div><div class="splash-name"></div><div class="splash-sub"></div><div class="splash-lore"></div></div>

      <div id="title" class="screen">
        <div class="screen-inner">
          <h1>VEIL</h1>
          <p class="tagline">Corra. Salte. Costure o Véu.</p>
          <p class="story">${PROLOGUE}</p>
          <div class="title-btns">
            <button class="cta" id="continue-btn">Continuar</button>
            <button class="cta" id="start-btn">Começar a jornada</button>
            <div class="row-btns">
              <button class="ghost-btn" id="title-select-btn">Escolher fase</button>
              <button class="ghost-btn" id="title-options-btn">Opções</button>
              <button class="ghost-btn" id="credits-btn">Créditos</button>
            </div>
          </div>
          <details class="title-controls"><summary>Controles</summary>${CONTROLS}</details>
          <p class="small" id="mobile-note">VEIL é feito para teclado e mouse (ou controle). No celular ele não é jogável.</p>
          <p class="small">O mouse fica preso à janela durante o jogo · Esc libera · funciona com controle</p>
        </div>
        <div id="version"></div>
      </div>

      <div id="credits" class="screen hidden">
        <div class="screen-inner">
          <h2>VEIL</h2>
          <div class="credits-roll">
            <p class="cr-head">Criado por</p><p class="cr-name" id="credits-author"></p>
            <p class="cr-head">Feito com</p><p>Three.js · Vite · WebAudio</p>
            <p class="cr-head">Arte, música e sons</p><p>Gerados por código: nenhum modelo, textura ou áudio externo</p>
            <p class="cr-head">Obrigado por jogar</p><p>e por costurar o Véu.</p>
          </div>
          <button class="cta" id="credits-back">Voltar</button>
        </div>
      </div>

      <div id="chapter-card"><div class="cc-num"></div><div class="cc-name"></div><div class="cc-text"></div></div>
      <div id="intro">
        <div class="bar top"></div><div class="bar bottom"></div>
        <div id="intro-text"></div>
        <div id="intro-skip">Espaço / Enter / A — pular</div>
      </div>

      <div id="select" class="screen hidden">
        <div class="screen-inner wide">
          <h2>Travessias</h2>
          <p class="small" id="select-summary"></p>
          <div class="menu-row">
            <button class="pill" id="speedrun-btn">⏱ Modo Speedrun</button>
            <button class="pill" id="wardrobe-btn">◈ Andarilho</button>
            <button class="pill" id="memories-btn">◆ Memórias</button>
            <button class="pill" id="options-btn">⚙ Opções</button>
          </div>
          <div id="chapters"></div>
          <button class="ghost-btn" id="select-back">Voltar</button>
        </div>
      </div>

      <div id="pause" class="screen hidden">
        <div class="screen-inner">
          <p class="small" id="pause-chapter"></p>
          <h2>Pausado</h2>
          <p class="lore-line" id="pause-lore"></p>
          ${CONTROLS}
          <button class="cta" id="resume-btn">Continuar</button>
          <div class="row-btns">
            <button class="ghost-btn" id="restart-btn">Reiniciar fase</button>
            <button class="ghost-btn" id="pause-options-btn">Opções</button>
            <button class="ghost-btn" id="menu-btn">Escolher fase</button>
          </div>
        </div>
      </div>

      <div id="finish" class="screen hidden">
        <div class="screen-inner">
          <p class="small" id="finish-level"></p>
          <h2 id="finish-title">Travessia concluída</h2>
          <div id="finish-medal"></div>
          <div id="finish-time"></div>
          <div id="finish-best"></div>
          <div class="medal-row" id="finish-medals"></div>
          <div class="feats" id="finish-feats"></div>
          <div class="stats" id="stats"></div>
          <p class="small" id="finish-unlock"></p>
          <button class="cta" id="next-btn">Próxima fase</button>
          <div class="row-btns">
            <button class="ghost-btn" id="again-btn">Repetir <kbd>R</kbd></button>
            <button class="ghost-btn" id="finish-menu-btn">Escolher fase</button>
          </div>
          <p class="small">Enter: próxima · R: repetir</p>
        </div>
      </div>

      <div id="options" class="screen hidden">
        <div class="screen-inner">
          <h2>Opções</h2>
          <div id="options-list"></div>
          <button class="cta" id="options-back">Voltar</button>
        </div>
      </div>

      <div id="wardrobe" class="screen side hidden">
        <div class="screen-inner panel">
          <h2>Andarilho</h2>
          <p class="small">Mantos desbloqueados por feitos. Clique para vestir.</p>
          <div id="pose-row"></div>
          <div id="skin-list"></div>
          <button class="cta" id="wardrobe-back">Voltar</button>
        </div>
      </div>

      <div id="memories" class="screen hidden">
        <div class="screen-inner wide">
          <h2>Memórias</h2>
          <p class="small" id="memories-summary"></p>
          <div id="memory-list"></div>
          <button class="cta" id="memories-back">Voltar</button>
        </div>
      </div>

      <div id="epilogue" class="screen hidden">
        <div class="screen-inner">
          <h2>Epílogo</h2>
          <div id="epilogue-text"></div>
          <button class="cta" id="epilogue-btn">Continuar</button>
        </div>
      </div>
    `;
    document.body.appendChild(root);

    this.$ = (id) => root.querySelector('#' + id);
    this.hud = this.$('hud');
    this.veilRing = this.$('veil-ring');
    this.veilEl = this.$('veil');
    this.alertEl = this.$('alert');
    this.alertLabel = this.$('alert-label');
    this.eyeFill = this.$('eye-fill');
    this.hintEl = this.$('hint');
    this.toastEl = this.$('toast');
    this.promptEl = this.$('prompt');
    this.memoryEl = this.$('memory-pop');
    this.fadeEl = this.$('fade');
    this.flashEl = this.$('flash');
    this.deathEl = this.$('death-flash');
    this.alertVignette = this.$('alert-vignette');
    this.dangerVignette = this.$('danger-vignette');
    this.veilTint = this.$('veil-tint');
    this.messageEl = this.$('message');
    this.titleEl = this.$('title');
    this.pauseEl = this.$('pause');
    this.timerEl = this.$('timer');
    this.totalEl = this.$('total-timer');
    this.targetEl = this.$('target');
    this.levelLabel = this.$('level-label');
    this.speedEl = this.$('speed-value');
    this.splashEl = this.$('splash');
    this.dimEl = this.$('dim');
    this.fragEl = this.$('frag-ind');
    this.speedCanvas = this.$('speedlines');
    this.speedCtx = this.speedCanvas.getContext('2d');
    this.screens = Object.fromEntries(SCREENS.map((n) => [n, this.$(n)]));
    this.current = 'title';

    this.hintTimer = 0;
    this.toastTimer = 0;
    this.splashTimer = 0;
    this.memoryTimer = 0;
    this.lastAlert = '';
    this.lastVeilState = '';
    this.lastTimer = '';
    this.lastPrompt = '';
    this.focusIndex = 0;
    this.lines = Array.from({ length: 70 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), s: 0.5 + Math.random() }));
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    this.speedCanvas.width = Math.floor(window.innerWidth / 2);
    this.speedCanvas.height = Math.floor(window.innerHeight / 2);
  }

  on(id, fn) {
    this.$(id).addEventListener('click', (e) => {
      e.stopPropagation();
      fn();
    });
  }

  showScreen(name) {
    for (const n of SCREENS) this.screens[n].classList.toggle('hidden', n !== name);
    this.hud.classList.toggle('hidden', name !== null);
    this.current = name;
    this.focusIndex = 0;
    this.updateFocus(false);
  }

  // Título: botão Continuar (próxima fase), versão e aviso no celular.
  setupTitle(version, nextName, hasProgress) {
    this.$('version').textContent = 'v' + version;
    this.$('credits-author').textContent = AUTHOR;
    const cont = this.$('continue-btn');
    cont.style.display = hasProgress ? '' : 'none';
    cont.textContent = nextName ? `Continuar — ${nextName}` : 'Continuar';
    this.$('start-btn').textContent = hasProgress ? 'Rever a abertura' : 'Começar a jornada';
    this.$('start-btn').classList.toggle('secondary', hasProgress);
    const touchOnly = 'ontouchstart' in window && !window.matchMedia('(pointer: fine)').matches;
    this.$('mobile-note').style.display = touchOnly ? '' : 'none';
  }

  // Cartão grande de capítulo.
  chapterCard(ch) {
    const el = this.$('chapter-card');
    el.querySelector('.cc-num').textContent = `Capítulo ${ch.num}`;
    el.querySelector('.cc-name').textContent = ch.name;
    el.querySelector('.cc-text').textContent = ch.text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  // Abertura: barras de cinema e o prólogo linha a linha.
  showIntro(lines) {
    const el = this.$('intro');
    this.$('intro-text').innerHTML = lines.map((t, i) => `<p style="animation-delay:${0.8 + i * 2.6}s">${t}</p>`).join('');
    el.classList.add('show');
  }

  hideIntro() {
    this.$('intro').classList.remove('show');
  }

  // ------------------------------------------------------------ navegação
  focusables() {
    if (!this.current) return [];
    return [...this.screens[this.current].querySelectorAll('button:not([disabled]), input')].filter((b) => b.offsetParent !== null);
  }

  updateFocus(show = true) {
    const list = this.focusables();
    for (const b of list) b.classList.remove('focus');
    if (!show || !list.length) return;
    this.focusIndex = (this.focusIndex + list.length) % list.length;
    const el = list[this.focusIndex];
    el.classList.add('focus');
    el.scrollIntoView({ block: 'nearest' });
  }

  // dir: -1 / +1 (cima/baixo); h: -1 / +1 em controles deslizantes
  navigate(dir) {
    const list = this.focusables();
    if (!list.length) return;
    const had = list.some((b) => b.classList.contains('focus'));
    if (had) this.focusIndex += dir;
    this.updateFocus(true);
  }

  adjust(dir) {
    const list = this.focusables();
    const el = list.find((b) => b.classList.contains('focus'));
    if (el && el.tagName === 'INPUT' && el.type === 'range') {
      const step = parseFloat(el.step) || 0.05;
      el.value = String(Math.min(parseFloat(el.max), Math.max(parseFloat(el.min), parseFloat(el.value) + step * dir * 2)));
      el.dispatchEvent(new Event('input'));
      return true;
    }
    if (el && el.dataset.cycle) {
      el.click();
      return true;
    }
    this.navigate(dir);
    return false;
  }

  activate() {
    const el = this.focusables().find((b) => b.classList.contains('focus'));
    if (el && el.tagName === 'BUTTON') {
      el.click();
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------ HUD
  setStealth(on) {
    this.alertEl.style.display = on ? '' : 'none';
    if (!on) this.alertVignette.style.opacity = '0';
  }

  setLevel(index, total, def, best) {
    const ch = CHAPTERS[def.chapter ?? 0];
    this.levelLabel.textContent = `${ch ? ch.num + ' · ' : ''}${index + 1}/${total} · ${def.name}`;
    const m = def.medals;
    this.targetEl.innerHTML = `${medalIcon(0, true)} ${formatTime(m[0])}${best !== null && best !== undefined ? ` · recorde ${formatTime(best)}` : ''}`;
  }

  setFragment(hasFragment, taken) {
    this.fragEl.style.display = hasFragment ? '' : 'none';
    this.fragEl.classList.toggle('taken', !!taken);
  }

  setTotal(t) {
    this.totalEl.textContent = t === null ? '' : `speedrun ${formatTime(t)}`;
  }

  setTimer(t) {
    const s = formatTime(t);
    if (s !== this.lastTimer) {
      this.timerEl.textContent = s;
      this.lastTimer = s;
    }
  }

  setSpeed(v) {
    const s = String(Math.round(v));
    if (this.speedEl.textContent !== s) this.speedEl.textContent = s;
  }

  setVeil(fraction, ready, denied) {
    this.veilRing.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - Math.max(0, Math.min(1, fraction)))));
    const state = denied > 0 ? 'denied' : ready ? 'ready' : 'charging';
    if (state !== this.lastVeilState) {
      this.veilEl.className = state;
      this.lastVeilState = state;
    }
  }

  // Indicador do mundo atual (null = a fase não tem dois mundos).
  setDimension(d) {
    this.dimEl.classList.toggle('hidden', d === null);
    this.dimEl.classList.toggle('veil', d === 1);
    this.$('dim-label').textContent = d === 1 ? 'Outro lado' : 'Mundo real';
    this.veilTint.style.opacity = d === 1 ? '1' : '0';
  }

  // Runas acesas no Colosso (null esconde a barra).
  setBoss(lit, total) {
    const el = this.$('boss');
    el.classList.toggle('hidden', lit === null);
    if (lit === null) return;
    this.$('boss-runes').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < lit ? 'on' : ''}">◆</i>`).join('');
  }

  // Mostra as teclas atuais no HUD.
  setKeyLabels(input) {
    this.hud.querySelector('.veil-text kbd').textContent = input.label('veil');
    this.$('restart-tip').querySelector('kbd').textContent = input.label('restart');
    this.dimEl.querySelector('kbd').textContent = input.label('shift');
  }

  setPrompt(html) {
    if (html === this.lastPrompt) return;
    this.lastPrompt = html;
    this.promptEl.innerHTML = html ?? '';
    this.promptEl.classList.toggle('show', !!html);
  }

  // Aviso de perigo (a Sombra chegando): 0..1
  setDanger(k) {
    this.dangerVignette.style.opacity = Math.max(0, Math.min(1, k)).toFixed(3);
  }

  // level: 0..1 (suspeita máxima), state: patrol | suspicious | chase
  setAlert(level, state) {
    let label = 'Oculto';
    let cls = 'hidden-state';
    if (state === 'chase') { label = 'Perseguição'; cls = 'chase'; }
    else if (state === 'suspicious') { label = 'Suspeita'; cls = 'suspicious'; }
    else if (level > 0.05) { label = 'Observado'; cls = 'watched'; }
    const key = cls + label;
    if (key !== this.lastAlert) {
      this.alertEl.className = cls;
      this.alertLabel.textContent = label;
      this.lastAlert = key;
    }
    const fill = state === 'chase' ? 1 : level;
    this.eyeFill.setAttribute('y', String(32 - 32 * fill));
    const v = state === 'chase' ? 0.55 : state === 'suspicious' ? 0.25 + level * 0.25 : level * 0.3;
    this.alertVignette.style.opacity = v.toFixed(3);
    this.alertVignette.className = state === 'chase' ? 'red' : 'amber';
  }

  showHint(text, duration = 8) {
    this.hintEl.innerHTML = text;
    this.hintEl.classList.add('show');
    this.hintTimer = duration;
  }

  hideHint() {
    this.hintEl.classList.remove('show');
    this.hintTimer = 0;
  }

  toast(text, duration = 2.6) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('show');
    this.toastTimer = duration;
  }

  showMemory(text, repeat) {
    this.memoryEl.querySelector('.mp-label').textContent = repeat ? 'Memória já recordada' : 'Fragmento de memória';
    this.memoryEl.querySelector('.mp-text').textContent = `“${text}”`;
    this.memoryEl.classList.add('show');
    this.memoryTimer = repeat ? 3 : 6.5;
  }

  splash(num, name, sub, lore) {
    this.splashEl.querySelector('.splash-num').textContent = num;
    this.splashEl.querySelector('.splash-name').textContent = name;
    this.splashEl.querySelector('.splash-sub').textContent = sub ?? '';
    this.splashEl.querySelector('.splash-lore').textContent = lore ?? '';
    this.splashEl.classList.remove('show', 'long');
    void this.splashEl.offsetWidth;
    this.splashEl.classList.add('show');
    if (lore) this.splashEl.classList.add('long');
    this.splashTimer = lore ? 3.6 : 1.8;
  }

  fade(opacity, seconds = 0.6) {
    this.fadeEl.style.transition = `opacity ${seconds}s ease`;
    this.fadeEl.style.opacity = String(opacity);
  }

  flash(seconds = 1.2, color = null) {
    this.flashEl.style.transition = 'none';
    this.flashEl.classList.toggle('violet', color === 'violet');
    this.flashEl.style.opacity = '1';
    void this.flashEl.offsetWidth;
    this.flashEl.style.transition = `opacity ${seconds}s ease-out`;
    this.flashEl.style.opacity = '0';
  }

  deathFlash() {
    this.deathEl.style.transition = 'none';
    this.deathEl.style.opacity = '1';
    void this.deathEl.offsetWidth;
    this.deathEl.style.transition = 'opacity 0.5s ease-out';
    this.deathEl.style.opacity = '0';
  }

  message(title, sub = '') {
    this.messageEl.querySelector('.msg-title').textContent = title;
    this.messageEl.querySelector('.msg-sub').textContent = sub;
    this.messageEl.classList.toggle('show', !!title);
  }

  // ------------------------------------------------------------ telas
  // Seleção por capítulos: onPick(index)
  buildSelect(levels, progress, onPick) {
    const wrap = this.$('chapters');
    wrap.innerHTML = '';
    let gold = 0;
    let done = 0;
    const frags = Object.keys(progress.fragments ?? {}).length;
    const sections = CHAPTERS.map((ch) => {
      const sec = document.createElement('section');
      sec.className = 'chapter';
      sec.innerHTML = `<div class="ch-head"><span class="ch-num">${ch.num}</span><span class="ch-name">${ch.name}</span><span class="ch-text">${ch.text}</span></div><div class="level-grid"></div>`;
      wrap.appendChild(sec);
      return sec.querySelector('.level-grid');
    });
    levels.forEach((def, i) => {
      const best = progress.best[def.id] ?? null;
      const mi = medalFor(best, def.medals);
      if (best !== null) done++;
      if (mi === 0) gold++;
      const unlocked = i === 0 || progress.best[levels[i - 1].id] !== undefined || progress.unlockAll;
      const feats = progress.feats?.[def.id] ?? {};
      const frag = progress.fragments?.[def.id];
      const card = document.createElement('button');
      card.className = 'level-card' + (unlocked ? '' : ' locked') + (def.type === 'stealth' ? ' stealth' : '') + (def.final ? ' final' : '');
      card.innerHTML = `
        <span class="lc-num">${String(i + 1).padStart(2, '0')}${def.isNew && best === null && unlocked ? ' <em class="new">nova</em>' : ''}</span>
        <span class="lc-name">${def.name}</span>
        <span class="lc-sub">${def.subtitle}</span>
        <span class="lc-best">${medalIcon(mi, true)} ${best !== null ? formatTime(best) : unlocked ? 'nova' : 'bloqueada'}</span>
        <span class="lc-badges">
          <i class="b-frag${frag ? ' on' : ''}" title="fragmento de memória">◆</i>
          <i class="b-feat${feats.noDeath ? ' on' : ''}" title="sem morrer">✝</i>
          <i class="b-feat${feats.noVeil ? ' on' : ''}" title="sem Passo do Véu">◇</i>
        </span>`;
      if (unlocked) {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          onPick(i);
        });
      } else {
        card.disabled = true;
      }
      (sections[def.chapter ?? 0] ?? sections[0]).appendChild(card);
    });
    const sr = progress.speedrunBest;
    this.$('select-summary').textContent = `${done}/${levels.length} concluídas · ${gold} medalhas de ouro · ${frags}/${levels.length} memórias`
      + (sr ? ` · speedrun ${formatTime(sr)}` : '');
    this.$('speedrun-btn').disabled = done < levels.length && !progress.unlockAll;
    this.$('speedrun-btn').title = this.$('speedrun-btn').disabled ? 'Conclua todas as fases para liberar' : 'Todas as fases seguidas, um cronômetro só';
  }

  showFinish(def, index, total, time, best, isRecord, stats, hasNext, extra = {}) {
    const mi = medalFor(time, def.medals);
    this.$('finish-level').textContent = `${index + 1}/${total} · ${def.name}`;
    this.$('finish-title').textContent = def.type === 'stealth' ? 'O Artefato é seu' : def.final ? 'O Véu está costurado' : 'Travessia concluída';
    this.$('finish-medal').innerHTML = mi < 3 ? `${medalIcon(mi)}<span>${MEDALS[mi]}</span>` : `${medalIcon(3)}<span>sem medalha</span>`;
    this.$('finish-time').textContent = formatTime(time);
    let bestTxt = isRecord ? '<b>novo recorde!</b>' : `recorde ${formatTime(best)}`;
    if (extra.prevBest !== undefined && extra.prevBest !== null) {
      const d = time - extra.prevBest;
      bestTxt += ` <span class="delta ${d < 0 ? 'good' : 'bad'}">${d < 0 ? '−' : '+'}${Math.abs(d).toFixed(2)}s</span>`;
    }
    this.$('finish-best').innerHTML = bestTxt;
    this.$('finish-medals').innerHTML = def.medals.map((m, i) => `<span>${medalIcon(i, true)} ${formatTime(m)}</span>`).join('');
    const f = extra.feats ?? {};
    this.$('finish-feats').innerHTML = `
      <span class="${stats.deaths === 0 ? 'on' : ''}">✝ sem morrer</span>
      <span class="${stats.veils === 0 ? 'on' : ''}">◇ sem Passo do Véu</span>
      ${extra.hasFragment ? `<span class="${f.fragment ? 'on' : ''}">◆ memória</span>` : ''}`;
    this.$('stats').innerHTML = `
      <div><span>${stats.deaths}</span>mortes</div>
      <div><span>${stats.veils}</span>Passos do Véu</div>
      <div><span>${Math.round(stats.topSpeed)}</span>m/s máx.</div>`;
    this.$('finish-unlock').innerHTML = extra.unlocks?.length ? `Desbloqueado: <b>${extra.unlocks.join(', ')}</b>` : '';
    const next = this.$('next-btn');
    next.textContent = hasNext ? 'Próxima fase' : 'Escolher fase';
    this.showScreen('finish');
  }

  showPause(def) {
    const ch = CHAPTERS[def.chapter ?? 0];
    this.$('pause-chapter').textContent = ch ? `Capítulo ${ch.num} — ${ch.name}` : '';
    this.$('pause-lore').textContent = LORE[def.id]?.intro ?? '';
    this.showScreen('pause');
  }

  // Opções: cada controle chama onChange(chave, valor).
  buildOptions(settings, onChange, onReset, input) {
    const list = this.$('options-list');
    list.innerHTML = '';
    const row = (label, control) => {
      const r = document.createElement('div');
      r.className = 'opt-row';
      r.innerHTML = `<span class="opt-label">${label}</span>`;
      r.appendChild(control);
      list.appendChild(r);
    };
    const range = (key, min, max, step, fmt) => {
      const wrap = document.createElement('span');
      wrap.className = 'opt-range';
      const input = document.createElement('input');
      Object.assign(input, { type: 'range', min, max, step, value: settings[key] });
      const out = document.createElement('output');
      out.textContent = fmt(settings[key]);
      input.addEventListener('input', () => {
        const v = parseFloat(input.value);
        out.textContent = fmt(v);
        onChange(key, v);
      });
      wrap.append(input, out);
      return wrap;
    };
    const cycle = (key, values, labels) => {
      const b = document.createElement('button');
      b.className = 'opt-btn';
      b.dataset.cycle = '1';
      const show = () => { b.textContent = labels[values.indexOf(settings[key])] ?? String(settings[key]); };
      show();
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = (values.indexOf(settings[key]) + 1) % values.length;
        onChange(key, values[i]);
        show();
      });
      return b;
    };
    const pct = (v) => `${Math.round(v * 100)}%`;
    row('Sensibilidade do mouse', range('sensitivity', 0.3, 2.5, 0.05, (v) => v.toFixed(2)));
    row('Sensibilidade do controle', range('padSensitivity', 0.3, 2.5, 0.05, (v) => v.toFixed(2)));
    row('Inverter eixo vertical', cycle('invertY', [false, true], ['não', 'sim']));
    row('Campo de visão', range('fov', 55, 90, 1, (v) => `${Math.round(v)}°`));
    row('Volume geral', range('volume', 0, 1, 0.05, pct));
    row('Música', range('music', 0, 1, 0.05, pct));
    row('Qualidade gráfica', cycle('quality', ['alta', 'media', 'baixa'], ['alta', 'média', 'baixa (PC fraco)']));
    row('Velocidade do jogo', cycle('gameSpeed', [1, 0.9, 0.8], ['100%', '90% (assistência)', '80% (assistência)']));
    row('Fantasma do recorde', cycle('ghost', [true, false], ['ligado', 'desligado']));
    row('Tremor de câmera', cycle('shake', [true, false], ['ligado', 'desligado']));
    row('Dicas na tela', cycle('hints', [true, false], ['ligadas', 'desligadas']));
    // teclas
    const head = document.createElement('div');
    head.className = 'opt-head';
    head.textContent = 'Teclas (clique e aperte a nova tecla)';
    list.appendChild(head);
    for (const [action, label] of REBINDABLE) {
      const b = document.createElement('button');
      b.className = 'opt-btn key';
      const show = () => { b.textContent = input ? input.label(action) : '?'; };
      show();
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        b.textContent = 'aperte uma tecla…';
        b.classList.add('wait');
        const grab = (ev) => {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          b.classList.remove('wait');
          if (ev.code !== 'Escape') onChange('keys', { ...(settings.keys ?? {}), [action]: ev.code });
          show();
        };
        window.addEventListener('keydown', grab, { capture: true, once: true });
      });
      row(label, b);
    }
    const resetKeys = document.createElement('button');
    resetKeys.className = 'opt-btn';
    resetKeys.textContent = 'Teclas padrão';
    resetKeys.addEventListener('click', (e) => {
      e.stopPropagation();
      onChange('keys', {});
      this.buildOptions(settings, onChange, onReset, input);
    });
    row('Restaurar', resetKeys);

    const reset = document.createElement('button');
    reset.className = 'opt-btn danger';
    reset.textContent = 'Apagar progresso';
    let armed = false;
    reset.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!armed) {
        armed = true;
        reset.textContent = 'Tem certeza? Clique de novo';
        return;
      }
      onReset();
      reset.textContent = 'Progresso apagado';
    });
    row('Recomeçar do zero', reset);
  }

  buildWardrobe(progress, levels, equipped, onPick) {
    const list = this.$('skin-list');
    list.innerHTML = '';
    for (const s of SKINS) {
      const ok = skinUnlocked(s, progress, levels);
      const b = document.createElement('button');
      b.className = 'skin-card' + (ok ? '' : ' locked') + (s.id === equipped ? ' on' : '');
      b.innerHTML = `
        <span class="swatch" style="background:${hex(s.cloak)};box-shadow:inset 0 -6px 0 ${rgb(s.trim)}, 0 0 12px ${rgb(s.trim, 0.6)}"></span>
        <span class="sk-text"><span class="sk-name">${s.name}${s.id === equipped ? ' · vestido' : ''}</span><span class="sk-desc">${ok ? (s.unlock ? 'Desbloqueado' : s.desc) : '🔒 ' + s.desc}</span></span>`;
      if (ok) {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          onPick(s.id);
        });
      } else {
        b.disabled = true;
      }
      list.appendChild(b);
    }
  }

  // Botões de prévia de animação no guarda-roupa.
  buildPoses(onPick) {
    const row = this.$('pose-row');
    row.innerHTML = '';
    for (const [id, label] of [['auto', 'Todas'], ['parado', 'Parado'], ['marcha', 'Marcha'], ['corrida', 'Corrida'], ['salto', 'Salto'],
      ['surf', 'Surf'], ['deslize', 'Deslize'], ['gancho', 'Gancho'], ['esgueirar', 'Esgueirar']]) {
      const b = document.createElement('button');
      b.className = 'pose-btn';
      b.dataset.pose = id;
      b.textContent = label;
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        onPick(id);
      });
      row.appendChild(b);
    }
  }

  setDemoPose(pose, chosen) {
    const key = pose + '|' + chosen;
    if (key === this.lastPose) return;
    this.lastPose = key;
    for (const b of this.$('pose-row').children) {
      b.classList.toggle('on', b.dataset.pose === chosen);
      b.classList.toggle('playing', b.dataset.pose === pose);
    }
  }

  buildMemories(levels, progress) {
    const list = this.$('memory-list');
    list.innerHTML = `<p class="story">${PROLOGUE}</p>`;
    let n = 0;
    CHAPTERS.forEach((ch, ci) => {
      const sec = document.createElement('section');
      sec.className = 'mem-chapter';
      sec.innerHTML = `<div class="ch-head"><span class="ch-num">${ch.num}</span><span class="ch-name">${ch.name}</span></div>`;
      for (const def of levels.filter((d) => (d.chapter ?? 0) === ci)) {
        const got = progress.fragments?.[def.id];
        if (got) n++;
        const p = document.createElement('p');
        p.className = 'mem' + (got ? ' on' : '');
        p.innerHTML = got ? `<b>◆</b> “${LORE[def.id]?.memory ?? ''}”` : `<b>◇</b> <i>fragmento perdido em ${def.name}</i>`;
        sec.appendChild(p);
      }
      list.appendChild(sec);
    });
    this.$('memories-summary').textContent = `${n}/${levels.length} fragmentos recordados`;
  }

  showEpilogue() {
    const el = this.$('epilogue-text');
    el.innerHTML = EPILOGUE.map((t, i) => `<p style="animation-delay:${0.4 + i * 1.6}s">${t}</p>`).join('');
    this.showScreen('epilogue');
  }

  // Linhas de velocidade nas bordas da tela (k: 0..1).
  drawSpeedLines(k, dt) {
    const c = this.speedCtx;
    const w = this.speedCanvas.width;
    const h = this.speedCanvas.height;
    c.clearRect(0, 0, w, h);
    if (k < 0.02) return;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.hypot(cx, cy);
    c.lineCap = 'round';
    for (const l of this.lines) {
      l.r += dt * l.s * (1.5 + k * 3);
      if (l.r > 1) {
        l.r = 0.35 + Math.random() * 0.2;
        l.a = Math.random() * Math.PI * 2;
      }
      const r0 = l.r * maxR;
      const r1 = r0 + maxR * (0.08 + 0.18 * k) * l.s;
      const alpha = k * 0.35 * Math.min(1, (l.r - 0.35) * 4);
      if (alpha <= 0) continue;
      c.strokeStyle = `rgba(190,220,255,${alpha.toFixed(3)})`;
      c.lineWidth = 1 + l.s;
      c.beginPath();
      c.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0);
      c.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1);
      c.stroke();
    }
  }

  update(dt) {
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hintEl.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
    if (this.splashTimer > 0) {
      this.splashTimer -= dt;
      if (this.splashTimer <= 0) this.splashEl.classList.remove('show', 'long');
    }
    if (this.memoryTimer > 0) {
      this.memoryTimer -= dt;
      if (this.memoryTimer <= 0) this.memoryEl.classList.remove('show');
    }
  }
}

export { medalFor };
