// Áudio 100% sintetizado com WebAudio: ambiente (vento + drone), passos,
// saltos, aterrissagens, Passo do Véu com eco, alertas e o Artefato.
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.volume = 0.75;
    this.musicVolume = 0.8;
  }

  // Volumes 0..1 (geral e da trilha).
  setVolumes(volume, music) {
    this.volume = volume;
    this.musicVolume = music;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(volume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(music, t, 0.05);
  }

  // Precisa ser chamado a partir de um gesto do usuário (clique).
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    // Buffer de ruído reutilizado
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Eco (delay com realimentação) para sons mágicos
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = 0.19;
    const fb = ctx.createGain();
    fb.gain.value = 0.42;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 2400;
    this.echo.connect(echoFilter).connect(fb).connect(this.echo);
    echoFilter.connect(this.master);
    this.echoIn = ctx.createGain();
    this.echoIn.gain.value = 0.6;
    this.echoIn.connect(this.echo);

    this.startAmbience();
  }

  noise(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = loop;
    return src;
  }

  startAmbience() {
    const ctx = this.ctx;
    // vento
    const wind = this.noise(true);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 380;
    lp.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(wg.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.11;
    const lfo2Gain = ctx.createGain();
    lfo2Gain.gain.value = 180;
    lfo2.connect(lfo2Gain).connect(lp.frequency);
    wind.connect(lp).connect(wg).connect(this.master);
    wind.start();

    // vento da velocidade (sobe quando o andarilho voa rápido)
    const rush = this.noise(true);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.5;
    this.rushGain = ctx.createGain();
    this.rushGain.gain.value = 0;
    rush.connect(bp).connect(this.rushGain).connect(this.master);
    rush.start();
    lfo.start();
    lfo2.start();

    // drone grave místico
    const drone = ctx.createGain();
    drone.gain.value = 0.025;
    drone.connect(this.master);
    for (const [f, det] of [[55, 0], [82.4, 4], [110.3, -6]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.detune.value = det;
      const g = ctx.createGain();
      g.gain.value = 0.6;
      const vib = ctx.createOscillator();
      vib.frequency.value = 0.2 + Math.random() * 0.2;
      const vg = ctx.createGain();
      vg.gain.value = 3;
      vib.connect(vg).connect(o.detune);
      o.connect(g).connect(drone);
      o.start();
      vib.start();
    }
  }

  // Ambiente de cada capítulo: sons esparsos e distantes sobre o vento
  // (sinos, apito de trem, rajadas, sussurros, coração, cristais, carrilhão).
  setAmbience(style) {
    this.ambStyle = style;
    this.ambBeat = 0;
    if (!this.ambTimer) this.ambTimer = setInterval(() => this.ambienceTick(), 600);
  }

  ambienceTick() {
    const s = this.ambStyle;
    if (!s || !this.ctx || this.ctx.state !== 'running') return;
    const r = Math.random();
    const t = this.ctx.currentTime;
    if (s === 'sinos' && r < 0.07) {
      // sino de bronze longe: parciais inarmônicas e cauda longa
      const f = [196, 220, 247, 165][Math.floor(Math.random() * 4)];
      for (const [k, p] of [[1, 0.028], [2.76, 0.012], [5.4, 0.006]]) {
        this.tone({ type: 'sine', freq: f * k, peak: p, attack: 0.005, decay: 4.5 / k, dest: this.echoIn });
      }
    } else if (s === 'trilhos' && r < 0.05) {
      // apito do comboio e o ronco dos trilhos
      this.tone({ type: 'triangle', freq: 523, peak: 0.012, attack: 0.35, decay: 1.6, dest: this.echoIn });
      this.tone({ type: 'triangle', freq: 659, peak: 0.01, attack: 0.35, decay: 1.6, dest: this.echoIn });
      this.burst({ type: 'lowpass', freq: 140, q: 0.6, peak: 0.06, attack: 0.6, decay: 2.2 });
    } else if (s === 'vento' && r < 0.12) {
      this.burst({ type: 'bandpass', freq: 260, sweepTo: 900 + Math.random() * 600, q: 0.6, peak: 0.07, attack: 0.7, decay: 1.8 });
    } else if (s === 'sussurros' && r < 0.08) {
      // vozes sem palavras: rajadas curtas de formantes
      for (let i = 0; i < 6; i++) {
        this.burst({ type: 'bandpass', freq: 600 + Math.random() * 2200, q: 9, peak: 0.022, attack: 0.02, decay: 0.12, at: t + i * 0.09, dest: this.echoIn });
      }
    } else if (s === 'coracao') {
      // batimento grave, devagar
      this.ambBeat = (this.ambBeat + 1) % 2;
      if (this.ambBeat === 0) {
        this.tone({ type: 'sine', freq: 62, to: 38, peak: 0.09, attack: 0.01, decay: 0.28, at: t });
        this.tone({ type: 'sine', freq: 58, to: 36, peak: 0.06, attack: 0.01, decay: 0.3, at: t + 0.26 });
      }
    } else if (s === 'cristal' && r < 0.1) {
      const f = [1568, 1760, 2093, 2349, 2637][Math.floor(Math.random() * 5)];
      this.tone({ type: 'sine', freq: f, peak: 0.014, attack: 0.004, decay: 2.2, dest: this.echoIn });
    } else if (s === 'carrilhao' && r < 0.1) {
      // carrilhão de vento em ré pentatônica
      const notes = [1175, 1319, 1480, 1760, 1976, 2349];
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const f = notes[Math.floor(Math.random() * notes.length)];
        this.tone({ type: 'sine', freq: f, peak: 0.012, attack: 0.003, decay: 1.6, at: t + i * (0.12 + Math.random() * 0.15), dest: this.echoIn });
      }
    }
  }

  // ------------------------------------------------------------ chefes
  // badalada do grande sino (o Sineiro)
  bell() {
    if (!this.ctx) return;
    for (const [k, p] of [[1, 0.16], [2.0, 0.06], [2.76, 0.07], [5.4, 0.03]]) {
      this.tone({ type: 'sine', freq: 98 * k, peak: p, attack: 0.004, decay: 3.2 / Math.sqrt(k) });
      this.tone({ type: 'sine', freq: 98 * k * 1.003, peak: p * 0.5, attack: 0.004, decay: 2.6, dest: this.echoIn });
    }
    this.burst({ type: 'bandpass', freq: 1800, q: 1.5, peak: 0.08, decay: 0.15 });
  }

  // apito da Locomotiva
  whistle() {
    for (const f of [466, 554, 698]) this.tone({ type: 'sawtooth', freq: f, to: f * 0.97, peak: 0.025, attack: 0.08, decay: 1.1, dest: this.echoIn });
    this.burst({ type: 'highpass', freq: 2500, q: 0.6, peak: 0.06, attack: 0.05, decay: 0.9 });
  }

  // o Vendaval puxa o ar e depois sopra
  inhale() {
    this.burst({ type: 'bandpass', freq: 1600, sweepTo: 300, q: 0.8, peak: 0.12, attack: 0.9, decay: 0.3 });
  }

  gust() {
    this.burst({ type: 'lowpass', freq: 700, sweepTo: 2200, q: 0.5, peak: 0.28, attack: 0.08, decay: 1.6 });
    this.burst({ type: 'bandpass', freq: 400, q: 0.7, peak: 0.12, attack: 0.1, decay: 1.4 });
  }

  // o Eclipse apaga um braseiro; ele acende de novo
  extinguish() {
    this.tone({ type: 'sine', freq: 330, to: 55, peak: 0.12, attack: 0.02, decay: 1.2 });
    this.burst({ type: 'lowpass', freq: 1400, sweepTo: 120, q: 0.7, peak: 0.12, attack: 0.02, decay: 0.8 });
  }

  relight() {
    this.burst({ type: 'bandpass', freq: 300, sweepTo: 2400, q: 0.8, peak: 0.1, attack: 0.05, decay: 0.5 });
    this.tone({ type: 'triangle', freq: 523, to: 784, peak: 0.04, decay: 0.5, dest: this.echoIn });
  }

  // a Traça come um muro
  chomp() {
    this.burst({ type: 'bandpass', freq: 900, sweepTo: 200, q: 2, peak: 0.16, attack: 0.01, decay: 0.35 });
    this.burst({ type: 'highpass', freq: 3000, q: 1, peak: 0.06, attack: 0.01, decay: 0.5 });
  }

  // trovão depois do relâmpago (delay em segundos: a luz chega antes)
  thunder(delay = 0.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    this.burst({ type: 'lowpass', freq: 260, sweepTo: 60, q: 0.7, peak: 0.22, attack: 0.04, decay: 2.6, at: t });
    this.burst({ type: 'lowpass', freq: 120, q: 0.5, peak: 0.16, attack: 0.3, decay: 3.2, at: t + 0.35 });
  }

  env(gainNode, t, attack, peak, decay) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  burst({ type = 'bandpass', freq = 600, q = 1, peak = 0.1, attack = 0.005, decay = 0.1, sweepTo = null, dest = null, at = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = at ?? ctx.currentTime;
    const src = this.noise(attack + decay > 0.4); // o buffer tem 2 s: ruídos longos repetem
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, attack, peak, decay);
    src.connect(f).connect(g).connect(dest ?? this.master);
    src.start(t, Math.random() * 1.5);
    src.stop(t + attack + decay + 0.05);
  }

  tone({ type = 'sine', freq = 440, to = null, peak = 0.1, attack = 0.01, decay = 0.3, delay = 0, dest = null, at = null }) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = (at ?? ctx.currentTime) + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    this.env(g, t, attack, peak, decay);
    o.connect(g).connect(dest ?? this.master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  // surface: pedra (padrão), runa (muro dourado), madeira (vagões), cristal (outro mundo)
  step(kind, surface = 'stone') {
    const peak = kind === 'run' ? 0.09 : kind === 'sneak' ? 0.018 : 0.045;
    if (surface === 'wood') {
      this.burst({ type: 'bandpass', freq: 220 + Math.random() * 90, q: 3, peak: peak * 1.2, decay: 0.11 });
      this.tone({ type: 'triangle', freq: 140 + Math.random() * 30, to: 110, peak: peak * 0.5, decay: 0.08 });
    } else if (surface === 'rune') {
      this.burst({ type: 'bandpass', freq: 900 + Math.random() * 300, q: 2, peak: peak * 0.8, decay: 0.06 });
      this.tone({ type: 'sine', freq: [1175, 1319, 1480, 1760][Math.floor(Math.random() * 4)], peak: peak * 0.18, decay: 0.25, dest: this.echoIn });
    } else if (surface === 'crystal') {
      this.burst({ type: 'highpass', freq: 2200, q: 1, peak: peak * 0.6, decay: 0.05 });
      this.tone({ type: 'sine', freq: 2093 + Math.random() * 400, peak: peak * 0.22, decay: 0.3, dest: this.echoIn });
    } else {
      this.burst({ type: 'bandpass', freq: 380 + Math.random() * 250, q: 1.4, peak, decay: 0.07 + Math.random() * 0.03 });
    }
  }

  jump() {
    this.burst({ type: 'bandpass', freq: 500, sweepTo: 1400, q: 0.8, peak: 0.05, attack: 0.02, decay: 0.16 });
  }

  land(intensity) {
    const k = Math.min(1, intensity);
    this.tone({ type: 'sine', freq: 110, to: 40, peak: 0.12 + k * 0.25, attack: 0.005, decay: 0.18 + k * 0.2 });
    this.burst({ type: 'lowpass', freq: 900, q: 0.5, peak: 0.06 + k * 0.12, decay: 0.12 + k * 0.15 });
  }

  grab() {
    this.burst({ type: 'bandpass', freq: 1200, q: 2, peak: 0.05, decay: 0.06 });
    this.tone({ type: 'triangle', freq: 190, to: 150, peak: 0.05, decay: 0.08 });
  }

  climb() {
    this.burst({ type: 'bandpass', freq: 700, sweepTo: 400, q: 1, peak: 0.05, attack: 0.03, decay: 0.25 });
  }

  veil() {
    if (!this.ctx) return;
    this.burst({ type: 'bandpass', freq: 300, sweepTo: 4200, q: 1.2, peak: 0.22, attack: 0.02, decay: 0.28 });
    for (const [f, d] of [[659, 0], [988, 0.02], [1319, 0.04], [1976, 0.06]]) {
      this.tone({ type: 'sine', freq: f, peak: 0.07, attack: 0.01, decay: 1.1, delay: d });
      this.tone({ type: 'sine', freq: f * 1.005, peak: 0.05, attack: 0.01, decay: 0.9, delay: d, dest: this.echoIn });
    }
    this.tone({ type: 'sine', freq: 140, to: 70, peak: 0.18, attack: 0.01, decay: 0.5 });
  }

  veilPass() {
    this.tone({ type: 'triangle', freq: 1760, to: 880, peak: 0.08, decay: 0.4, dest: this.echoIn });
    this.burst({ type: 'highpass', freq: 3000, q: 0.7, peak: 0.08, decay: 0.3 });
  }

  denied() {
    this.tone({ type: 'square', freq: 140, to: 110, peak: 0.035, decay: 0.12 });
  }

  checkpoint() {
    for (const [f, d] of [[523, 0], [784, 0.12], [1047, 0.24]]) {
      this.tone({ type: 'sine', freq: f, peak: 0.08, attack: 0.02, decay: 1.4, delay: d, dest: this.echoIn });
      this.tone({ type: 'sine', freq: f, peak: 0.06, attack: 0.02, decay: 1.4, delay: d });
    }
  }

  alert(level) {
    if (level === 'chase') {
      this.tone({ type: 'sawtooth', freq: 98, peak: 0.12, attack: 0.02, decay: 0.7 });
      this.tone({ type: 'sawtooth', freq: 104, peak: 0.1, attack: 0.02, decay: 0.7 });
      this.tone({ type: 'sine', freq: 392, to: 370, peak: 0.08, attack: 0.01, decay: 0.5, dest: this.echoIn });
    } else if (level === 'suspicious') {
      this.tone({ type: 'sine', freq: 330, to: 415, peak: 0.07, attack: 0.03, decay: 0.45, dest: this.echoIn });
      this.tone({ type: 'triangle', freq: 165, peak: 0.05, attack: 0.03, decay: 0.4 });
    } else {
      this.tone({ type: 'sine', freq: 330, to: 262, peak: 0.04, attack: 0.03, decay: 0.5 });
    }
  }

  capture() {
    this.tone({ type: 'sawtooth', freq: 220, to: 40, peak: 0.16, attack: 0.02, decay: 1.4 });
    this.tone({ type: 'sine', freq: 66, to: 30, peak: 0.25, attack: 0.02, decay: 1.6 });
    this.burst({ type: 'lowpass', freq: 1800, sweepTo: 120, q: 0.6, peak: 0.15, attack: 0.05, decay: 1.2 });
  }

  fall() {
    this.burst({ type: 'bandpass', freq: 1400, sweepTo: 200, q: 0.8, peak: 0.12, attack: 0.05, decay: 1.0 });
  }

  // k: 0 (parado) .. 1 (muito rápido)
  setSpeed(k) {
    if (!this.rushGain) return;
    this.rushGain.gain.setTargetAtTime(0.14 * k * k, this.ctx.currentTime, 0.12);
  }

  // ------------------------------------------------------------ efeitos novos
  bounce() {
    this.tone({ type: 'sine', freq: 180, to: 720, peak: 0.16, attack: 0.005, decay: 0.28 });
    this.tone({ type: 'triangle', freq: 360, to: 1440, peak: 0.06, attack: 0.005, decay: 0.25, dest: this.echoIn });
  }

  ring() {
    this.burst({ type: 'bandpass', freq: 400, sweepTo: 5000, q: 0.9, peak: 0.2, attack: 0.01, decay: 0.35 });
    for (const [f, d] of [[880, 0], [1320, 0.05], [1760, 0.1]]) this.tone({ type: 'sine', freq: f, peak: 0.06, decay: 0.5, delay: d, dest: this.echoIn });
  }

  orb() {
    this.tone({ type: 'sine', freq: 1568, peak: 0.1, attack: 0.003, decay: 0.5, dest: this.echoIn });
    this.tone({ type: 'sine', freq: 2349, peak: 0.06, attack: 0.003, decay: 0.4, delay: 0.04 });
  }

  // corrida na parede: sopro subindo e um toque de runa
  wallRun() {
    this.burst({ type: 'bandpass', freq: 500, sweepTo: 1900, q: 0.9, peak: 0.09, attack: 0.02, decay: 0.3 });
    this.tone({ type: 'triangle', freq: 392, to: 523, peak: 0.05, attack: 0.01, decay: 0.25, dest: this.echoIn });
  }

  // agarrar um Fio de Luz: zunido metálico
  zip() {
    this.tone({ type: 'triangle', freq: 880, to: 1760, peak: 0.07, attack: 0.005, decay: 0.18 });
    this.tone({ type: 'sine', freq: 2349, peak: 0.04, attack: 0.005, decay: 0.7, dest: this.echoIn });
    this.burst({ type: 'highpass', freq: 2500, q: 0.8, peak: 0.05, decay: 0.25 });
  }

  // Fluxo: um sino que sobe na escala pentatônica a cada movimento emendado
  flow(n) {
    const scale = [0, 2, 4, 7, 9];
    const step = Math.min(n - 2, 14);
    const semis = scale[step % 5] + 12 * Math.floor(step / 5);
    const f = 523.25 * Math.pow(2, semis / 12);
    this.tone({ type: 'sine', freq: f, peak: 0.045, attack: 0.004, decay: 0.45, dest: this.echoIn });
    this.tone({ type: 'triangle', freq: f * 2, peak: 0.018, attack: 0.004, decay: 0.22 });
  }

  wallJump() {
    this.burst({ type: 'bandpass', freq: 900, sweepTo: 2200, q: 1, peak: 0.08, attack: 0.005, decay: 0.12 });
    this.tone({ type: 'triangle', freq: 220, to: 330, peak: 0.06, decay: 0.1 });
  }

  crash() {
    this.tone({ type: 'sine', freq: 90, to: 30, peak: 0.3, attack: 0.005, decay: 0.5 });
    this.burst({ type: 'lowpass', freq: 1200, sweepTo: 150, q: 0.6, peak: 0.22, attack: 0.005, decay: 0.45 });
  }

  crumble() {
    this.burst({ type: 'lowpass', freq: 500, q: 0.7, peak: 0.08, attack: 0.02, decay: 0.4 });
  }

  death() {
    this.tone({ type: 'sawtooth', freq: 300, to: 50, peak: 0.12, attack: 0.005, decay: 0.45 });
    this.burst({ type: 'bandpass', freq: 2500, sweepTo: 300, q: 0.8, peak: 0.18, attack: 0.005, decay: 0.35 });
  }

  countdown(final = false) {
    this.tone({ type: 'square', freq: final ? 1046 : 523, peak: 0.05, attack: 0.003, decay: final ? 0.35 : 0.12 });
  }

  finish() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((f, i) => {
      this.tone({ type: 'triangle', freq: f, peak: 0.08, attack: 0.01, decay: 0.6, delay: i * 0.07 });
      this.tone({ type: 'sine', freq: f * 2, peak: 0.03, attack: 0.01, decay: 0.6, delay: i * 0.07, dest: this.echoIn });
    });
  }

  // ------------------------------------------------------------ trilha
  // Sequenciador simples: agenda as notas um pouco à frente do relógio do
  // áudio. 'run' = eletrônica sombria a 142 BPM; 'calm' = ambiente da Abadia.
  startMusic(style = 'run') {
    if (!this.ctx) return;
    if (this.mus && this.mus.style === style) return;
    this.stopMusic();
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.exponentialRampToValueAtTime(style === 'calm' ? 0.35 : 0.5, ctx.currentTime + 1.2);
    out.connect(this.musicBus);
    const duck = ctx.createGain();
    duck.connect(out);
    this.mus = { style, step: 0, next: ctx.currentTime + 0.1, bpm: { calm: 80, veu: 128, final: 150, lira: 136 }[style] ?? 142, out, duck };
    this.musTimer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (!this.mus) return;
    clearInterval(this.musTimer);
    const { out } = this.mus;
    const t = this.ctx.currentTime;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0, t + 0.4);
    setTimeout(() => out.disconnect(), 600);
    this.mus = null;
  }

  schedule() {
    const m = this.mus;
    if (!m) return;
    const sixteenth = 60 / m.bpm / 4;
    while (m.next < this.ctx.currentTime + 0.15) {
      this.playStep(m, m.step, m.next, sixteenth);
      m.next += sixteenth;
      m.step++;
    }
  }

  synth({ type, freq, at, dur, peak, cutoff, q = 4, dest, attack = 0.005 }) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = q;
    f.frequency.setValueAtTime(cutoff * 2.5, at);
    f.frequency.exponentialRampToValueAtTime(cutoff, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(f).connect(g).connect(dest);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  playStep(m, step, t, sx) {
    const s16 = step % 16;
    const bar = Math.floor(step / 16);
    // i - VI - III - VII em lá menor
    // lá menor (padrão); ré menor no outro lado do Véu; mi menor no final
    // Lira (capítulo VII): ré maior, I - V - vi - IV
    const PROG = m.style === 'veu' ? [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 48, 52]]
      : m.style === 'final' ? [[52, 55, 59], [48, 52, 55], [50, 53, 57], [47, 50, 54]]
        : m.style === 'lira' ? [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62]]
          : [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const chord = PROG[bar % 4];
    const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
    const { out, duck } = m;

    if (m.style === 'calm') {
      if (s16 === 0) {
        for (const n of chord) this.synth({ type: 'sawtooth', freq: hz(n), at: t, dur: sx * 16, peak: 0.025, cutoff: 700, q: 1, dest: out, attack: 0.6 });
        this.synth({ type: 'sine', freq: hz(chord[0] - 24), at: t, dur: sx * 14, peak: 0.08, cutoff: 300, q: 1, dest: out, attack: 0.3 });
      }
      if (s16 % 4 === 2) {
        const n = chord[(step / 4) % 3 | 0] + 12;
        this.synth({ type: 'triangle', freq: hz(n), at: t, dur: sx * 6, peak: 0.03, cutoff: 2000, q: 1, dest: this.echoIn, attack: 0.02 });
      }
      return;
    }

    // 16 compassos: entrada, groove, ponte, clímax (o final começa no clímax)
    const section = m.style === 'final' ? 8 + (bar % 8) : bar % 16;
    const full = section >= 4;
    // bumbo e "sidechain" no baixo
    if (s16 % 4 === 0) {
      this.tone({ type: 'sine', freq: 155, to: 42, peak: 0.55, attack: 0.002, decay: 0.24, at: t, dest: out });
      duck.gain.cancelScheduledValues(t);
      duck.gain.setValueAtTime(0.3, t);
      duck.gain.linearRampToValueAtTime(1, t + sx * 3);
    }
    if (full && (s16 === 4 || s16 === 12)) {
      this.burst({ type: 'bandpass', freq: 1900, q: 0.8, peak: 0.2, decay: 0.15, at: t, dest: out });
      this.tone({ type: 'triangle', freq: 210, to: 150, peak: 0.08, decay: 0.08, at: t, dest: out });
    }
    if (s16 % 2 === 1 || (full && s16 % 4 === 2)) {
      this.burst({ type: 'highpass', freq: 7500, q: 0.7, peak: s16 === 14 ? 0.06 : 0.035, decay: s16 === 14 ? 0.12 : 0.03, at: t, dest: out });
    }
    // baixo pulsante em colcheias deslocadas
    const BASS = [0, 0, 12, 0, 0, 10, 0, 7];
    if (s16 % 2 === 0) {
      const n = chord[0] - 24 + BASS[(s16 / 2) % 8];
      this.synth({ type: 'sawtooth', freq: hz(n), at: t, dur: sx * 1.8, peak: 0.12, cutoff: full ? 520 : 320, q: 6, dest: duck });
    }
    // arpejo nas seções altas
    if (section >= 8) {
      const ARP = [0, 1, 2, 1, 2, 0, 1, 2];
      const n = chord[ARP[s16 % 8]] + (s16 >= 8 ? 24 : 12);
      this.synth({ type: 'square', freq: hz(n), at: t, dur: sx * 0.9, peak: 0.028, cutoff: 2400, q: 2, dest: duck });
    }
    // tema de Lira: uma caixinha de música em colcheias (pentatônica de ré)
    if (m.style === 'lira' && full && s16 % 2 === 0) {
      const MEL = [
        [81, 78, 76, 74, 76, 78, 81, 0],
        [83, 81, 78, 76, 78, 76, 74, 0],
        [81, 78, 76, 74, 71, 74, 76, 0],
        [78, 76, 74, 71, 74, 0, 74, 0],
      ];
      const n = MEL[bar % 4][s16 / 2];
      if (n) {
        this.synth({ type: 'triangle', freq: hz(n), at: t, dur: sx * 3, peak: 0.03, cutoff: 3200, q: 1, dest: this.echoIn, attack: 0.004 });
        this.synth({ type: 'sine', freq: hz(n + 12), at: t, dur: sx * 1.5, peak: 0.012, cutoff: 5000, q: 1, dest: out, attack: 0.002 });
      }
    }
    // acorde longo no início de cada compasso
    if (s16 === 0 && full) {
      for (const n of chord) this.synth({ type: 'sawtooth', freq: hz(n + 12), at: t, dur: sx * 15, peak: 0.016, cutoff: 1100, q: 1, dest: duck, attack: 0.15 });
    }
  }

  // ------------------------------------------------------------ mecânicas novas
  slide() {
    this.burst({ type: 'lowpass', freq: 900, sweepTo: 300, q: 0.7, peak: 0.12, attack: 0.01, decay: 0.45 });
  }

  roll() {
    this.burst({ type: 'lowpass', freq: 600, q: 0.6, peak: 0.1, attack: 0.01, decay: 0.3 });
  }

  grapple() {
    this.tone({ type: 'triangle', freq: 600, to: 1500, peak: 0.07, attack: 0.005, decay: 0.15 });
    this.tone({ type: 'sine', freq: 1200, peak: 0.05, decay: 0.4, dest: this.echoIn });
  }

  release(jump) {
    this.tone({ type: 'sine', freq: jump ? 700 : 500, to: jump ? 1400 : 300, peak: 0.05, decay: 0.2 });
  }

  shift(toVeil) {
    if (!this.ctx) return;
    this.burst({ type: 'bandpass', freq: toVeil ? 3000 : 400, sweepTo: toVeil ? 300 : 3000, q: 1, peak: 0.18, attack: 0.01, decay: 0.35 });
    this.tone({ type: 'sine', freq: toVeil ? 220 : 330, to: toVeil ? 165 : 440, peak: 0.12, decay: 0.6, dest: this.echoIn });
  }

  fragment() {
    const notes = [784, 988, 1175, 1568];
    notes.forEach((f, i) => this.tone({ type: 'sine', freq: f, peak: 0.07, attack: 0.02, decay: 1.6, delay: i * 0.11, dest: this.echoIn }));
  }

  rune() {
    this.tone({ type: 'triangle', freq: 392, to: 784, peak: 0.1, attack: 0.01, decay: 0.5 });
    this.burst({ type: 'lowpass', freq: 300, q: 0.5, peak: 0.12, attack: 0.05, decay: 0.8 });
  }

  tick() {
    this.tone({ type: 'square', freq: 1800, peak: 0.02, attack: 0.001, decay: 0.03 });
  }

  menu() {
    this.tone({ type: 'sine', freq: 880, peak: 0.03, attack: 0.002, decay: 0.08 });
  }

  artifact() {
    const notes = [262, 330, 392, 494, 523, 659, 784];
    notes.forEach((f, i) => {
      this.tone({ type: 'sine', freq: f, peak: 0.07, attack: 0.3, decay: 3.5, delay: i * 0.09 });
      this.tone({ type: 'triangle', freq: f * 2, peak: 0.025, attack: 0.3, decay: 2.5, delay: i * 0.09, dest: this.echoIn });
    });
    this.burst({ type: 'bandpass', freq: 200, sweepTo: 6000, q: 0.7, peak: 0.2, attack: 0.6, decay: 1.6 });
    this.tone({ type: 'sine', freq: 65, peak: 0.3, attack: 0.1, decay: 3 });
  }
}
