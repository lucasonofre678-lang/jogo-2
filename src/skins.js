// Visuais do Andarilho. Cada skin é desbloqueada por um feito (ver unlocked).
// Cores do brilho (trim/eye) passam de 1.0 de propósito: alimentam o bloom.
export const SKINS = [
  {
    id: 'andarilho', name: 'Andarilho', desc: 'O manto com que você acordou.',
    cloak: 0x262b3a, inner: 0x14161e, leather: 0x3a3430, trim: [0.3, 0.8, 2.4], eye: [1.6, 2.8, 4.2],
    unlock: null,
  },
  {
    id: 'peregrino', name: 'Peregrino Cinzento', desc: 'Conclua 5 travessias.',
    cloak: 0x55575f, inner: 0x1e1f24, leather: 0x2c2a28, trim: [1.5, 1.6, 1.9], eye: [2.2, 2.4, 2.8],
    unlock: { kind: 'done', n: 5 },
  },
  {
    id: 'aurora', name: 'Aurora', desc: 'Ganhe 5 medalhas de ouro.',
    cloak: 0x123a34, inner: 0x081a17, leather: 0x2c3a30, trim: [0.3, 2.2, 1.5], eye: [0.8, 3.2, 2.4],
    unlock: { kind: 'gold', n: 5 },
  },
  {
    id: 'rubro', name: 'Eco Rubro', desc: 'Sobreviva à Fuga Final.',
    cloak: 0x3a1420, inner: 0x1a080d, leather: 0x3a2020, trim: [2.4, 0.3, 0.8], eye: [3.6, 0.6, 1.4],
    unlock: { kind: 'level', id: 'fuga' },
  },
  {
    id: 'monge', name: 'Monge da Abadia', desc: 'Recupere o Artefato na Abadia Submersa.',
    cloak: 0x5b4a33, inner: 0x2a2116, leather: 0x4a3420, trim: [2.2, 1.5, 0.5], eye: [3.2, 2.4, 1.0],
    unlock: { kind: 'level', id: 'abadia' },
  },
  {
    id: 'sombra', name: 'Sombra', desc: 'Encontre 10 fragmentos de memória.',
    cloak: 0x08080c, inner: 0x020203, leather: 0x101014, trim: [1.3, 0.4, 2.6], eye: [2.6, 1.2, 4.0],
    unlock: { kind: 'fragments', n: 10 },
  },
  {
    id: 'dourado', name: 'Guardião Dourado', desc: 'Ganhe 15 medalhas de ouro.',
    cloak: 0x6b5420, inner: 0x2a1f0a, leather: 0x4a3418, trim: [2.6, 1.9, 0.6], eye: [3.6, 3.0, 1.4],
    unlock: { kind: 'gold', n: 15 },
  },
  {
    id: 'tecelao', name: 'Tecelão do Véu', desc: 'Costure o Véu no Coração do Véu.',
    cloak: 0xc8d4ec, inner: 0x56607a, leather: 0x8a90a0, trim: [0.5, 1.4, 3.2], eye: [2.6, 3.4, 4.4],
    unlock: { kind: 'level', id: 'coracao' },
  },
];

// progress: { best: {id: tempo}, fragments: {id: true} }, levels: lista de fases
export function skinUnlocked(skin, progress, levels) {
  const u = skin.unlock;
  if (!u) return true;
  if (progress.unlockAll) return true;
  const best = progress.best ?? {};
  if (u.kind === 'done') return Object.keys(best).length >= u.n;
  if (u.kind === 'level') return best[u.id] !== undefined;
  if (u.kind === 'fragments') return Object.keys(progress.fragments ?? {}).length >= u.n;
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
