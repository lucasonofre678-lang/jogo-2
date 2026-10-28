// Mantos do Andarilho. Cada um muda cores e também a forma: capuz (ponta,
// redondo, chifres, coroa), máscara, ombreiras, armadura, estampa e tamanho
// da capa. Desbloqueados por feitos (ver skinUnlocked).
// Cores de brilho (trim/eye) passam de 1.0 de propósito: alimentam o bloom.
export const SKINS = [
  {
    id: 'andarilho', name: 'Andarilho', desc: 'O manto com que você acordou.',
    cloak: 0x262b3a, inner: 0x14161e, leather: 0x3a3430, trim: [0.3, 0.8, 2.4], eye: [1.6, 2.8, 4.2],
    hood: 'ponta', pattern: 'runas', pauldrons: 1, unlock: null,
  },
  {
    id: 'peregrino', name: 'Peregrino Cinzento', desc: 'Conclua 5 travessias.',
    cloak: 0x55575f, inner: 0x1e1f24, leather: 0x2c2a28, trim: [1.5, 1.6, 1.9], eye: [2.2, 2.4, 2.8],
    hood: 'redondo', pattern: 'vazio', pauldrons: 0, capeLen: 1.15, scarf: 0x7a5a3a,
    unlock: { kind: 'done', n: 5 },
  },
  {
    id: 'aurora', name: 'Aurora', desc: 'Ganhe 5 medalhas de ouro.',
    cloak: 0x123a34, inner: 0x081a17, leather: 0x2c3a30, trim: [0.3, 2.2, 1.5], eye: [0.8, 3.2, 2.4],
    hood: 'ponta', pattern: 'listras', pauldrons: 1, capeWidth: 1.1,
    unlock: { kind: 'gold', n: 5 },
  },
  {
    id: 'corvo', name: 'Corvo', desc: 'Termine Ondas de Luz (surf).',
    cloak: 0x14101c, inner: 0x08060c, leather: 0x1c1822, trim: [1.2, 0.6, 2.6], eye: [2.4, 1.4, 4.0],
    hood: 'ponta', pattern: 'penas', pauldrons: 2, capeLen: 1.3, capeWidth: 1.25, scarf: 0x2a1640,
    unlock: { kind: 'level', id: 'surf1' },
  },
  {
    id: 'rubro', name: 'Eco Rubro', desc: 'Sobreviva à Fuga.',
    cloak: 0x3a1420, inner: 0x1a080d, leather: 0x3a2020, trim: [2.4, 0.3, 0.8], eye: [3.6, 0.6, 1.4],
    hood: 'chifres', pattern: 'runas', pauldrons: 1, metal: 0x3a2228,
    unlock: { kind: 'level', id: 'fuga' },
  },
  {
    id: 'monge', name: 'Monge da Abadia', desc: 'Recupere o Artefato na Abadia Submersa.',
    cloak: 0x5b4a33, inner: 0x2a2116, leather: 0x4a3420, trim: [2.2, 1.5, 0.5], eye: [3.2, 2.4, 1.0],
    hood: 'redondo', pattern: 'listras', pauldrons: 0, capeLen: 0.85, scarf: 0x8a3a20,
    unlock: { kind: 'level', id: 'abadia' },
  },
  {
    id: 'sentinela', name: 'Sentinela', desc: 'Conclua a Abadia Submersa sem morrer.',
    cloak: 0x3a404c, inner: 0x1a1c22, leather: 0x2a2c32, metal: 0xb8c0d0, trim: [0.6, 1.8, 2.6], eye: [2.0, 3.0, 4.0],
    hood: 'chifres', mask: true, armor: true, pattern: 'vazio', pauldrons: 2, capeLen: 0.95,
    unlock: { kind: 'feat', id: 'abadia', feat: 'noDeath' },
  },
  {
    id: 'sombra', name: 'Sombra', desc: 'Encontre 10 fragmentos de memória.',
    cloak: 0x08080c, inner: 0x020203, leather: 0x101014, trim: [1.3, 0.4, 2.6], eye: [2.6, 1.2, 4.0],
    hood: 'ponta', mask: true, pattern: 'chamas', pauldrons: 0, capeLen: 1.2,
    unlock: { kind: 'fragments', n: 10 },
  },
  {
    id: 'estelar', name: 'Estelar', desc: 'Encontre 20 fragmentos de memória.',
    cloak: 0x10183a, inner: 0x060a1c, leather: 0x1a2040, trim: [1.4, 1.6, 2.8], eye: [2.8, 3.0, 4.4],
    hood: 'coroa', pattern: 'estrelas', pauldrons: 1, capeLen: 1.25, capeWidth: 1.2, scarf: 0x2a3a80,
    unlock: { kind: 'fragments', n: 20 },
  },
  {
    id: 'dourado', name: 'Guardião Dourado', desc: 'Ganhe 15 medalhas de ouro.',
    cloak: 0x6b5420, inner: 0x2a1f0a, leather: 0x4a3418, metal: 0xd8b060, trim: [2.6, 1.9, 0.6], eye: [3.6, 3.0, 1.4],
    hood: 'coroa', armor: true, pattern: 'runas', pauldrons: 2, capeWidth: 1.15,
    unlock: { kind: 'gold', n: 15 },
  },
  {
    id: 'brasa', name: 'Brasa', desc: 'Vença a Prova do Tecelão.',
    cloak: 0x2a0e08, inner: 0x140604, leather: 0x2a160e, metal: 0x4a2a1a, trim: [2.8, 0.9, 0.2], eye: [4.0, 1.8, 0.6],
    hood: 'chifres', pattern: 'chamas', pauldrons: 2, armor: true, capeLen: 1.15,
    unlock: { kind: 'level', id: 'prova' },
  },
  {
    id: 'correnteza', name: 'Correnteza', desc: 'Emende um Fluxo de ×12.',
    cloak: 0x0e2a3a, inner: 0x061820, leather: 0x1a3038, metal: 0x7ad0e0, trim: [0.3, 2.0, 2.6], eye: [1.4, 3.6, 4.2],
    hood: 'redondo', pattern: 'listras', pauldrons: 1, capeLen: 1.3, capeWidth: 1.15, scarf: 0x1a6a8a,
    unlock: { kind: 'flow', n: 12 },
  },
  {
    id: 'lira', name: 'Lira', desc: 'Chegue ao fim de O Último Fio.',
    cloak: 0xe8d4a8, inner: 0x6a5030, leather: 0x8a6a40, metal: 0xffe0a0, trim: [2.6, 1.8, 0.6], eye: [3.6, 3.0, 1.6],
    hood: 'redondo', pattern: 'estrelas', pauldrons: 0, capeLen: 1.2, capeWidth: 1.1, scarf: 0xd08a30,
    unlock: { kind: 'level', id: 'ultimofio' },
  },
  {
    id: 'tecelao', name: 'Tecelão do Véu', desc: 'Derrote o Colosso e costure o Véu.',
    cloak: 0xc8d4ec, inner: 0x56607a, leather: 0x8a90a0, metal: 0xe0e8ff, trim: [0.5, 1.4, 3.2], eye: [2.6, 3.4, 4.4],
    hood: 'coroa', pattern: 'estrelas', pauldrons: 1, capeLen: 1.35, capeWidth: 1.3, scarf: 0x8ab0ff,
    unlock: { kind: 'level', id: 'colosso' },
  },
];

// progress: { best: {id: tempo}, fragments: {id: true}, feats }, levels: lista de fases
export function skinUnlocked(skin, progress, levels) {
  const u = skin.unlock;
  if (!u) return true;
  if (progress.unlockAll) return true;
  const best = progress.best ?? {};
  if (u.kind === 'done') return Object.keys(best).length >= u.n;
  if (u.kind === 'level') return best[u.id] !== undefined;
  if (u.kind === 'fragments') return Object.keys(progress.fragments ?? {}).length >= u.n;
  if (u.kind === 'feat') return !!progress.feats?.[u.id]?.[u.feat];
  if (u.kind === 'flow') return (progress.flowBest ?? 0) >= u.n;
  if (u.kind === 'gold') {
    let n = 0;
    for (const def of levels) if (best[def.id] !== undefined && best[def.id] <= def.medals[0]) n++;
    return n >= u.n;
  }
  return false;
}

export function skinById(id) {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
