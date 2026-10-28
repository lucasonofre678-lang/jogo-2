// Lista das fases, em ordem, divididas em capítulos (ver lore.js).
// medals = tempos (s) para ouro, prata e bronze.
import { despertar, comboio, saltos, laminas, desabamento, engrenagens, travessia, corredor, torre, tempestade, ceu, fuga } from './runs.js';
import { fendas, gancho, ventos, ritmo, espelho, sombra, abismo, coracao } from './mechanics.js';
import { buildAbbey } from './abbey.js';
import { surf1 } from './surf.js';
import { surf2, labirinto, ancoras, prova, colosso } from './trials.js';
import { muros, fios, ziguezague, tear, pegapega, ultimofio } from './lira.js';

export const LEVELS = [
  // I — O Despertar
  { id: 'despertar', chapter: 0, name: 'Despertar', subtitle: 'Correr, saltar, atravessar o Véu', env: 'noite', medals: [11, 15, 22], build: despertar },
  { id: 'saltos', chapter: 0, name: 'Saltos de Fé', subtitle: 'Trampolins, anéis e cristais', env: 'aurora', medals: [13, 17, 24], build: saltos },
  { id: 'laminas', chapter: 0, name: 'Lâminas do Véu', subtitle: 'Ritmo ou morte', env: 'furia', medals: [17, 23, 32], build: laminas },
  { id: 'corredor', chapter: 0, name: 'Corredor do Véu', subtitle: 'Paredes viram degraus', env: 'crepusculo', medals: [11, 15, 22], build: corredor },
  { id: 'desabamento', chapter: 0, name: 'Desabamento', subtitle: 'O Véu corrompido vem atrás', env: 'furia', medals: [20, 24, 28], build: desabamento },
  // II — A Ferrovia dos Mortos
  { id: 'comboio', chapter: 1, name: 'Comboio Espectral', subtitle: 'Carruagens que nunca param — até baterem', env: 'crepusculo', medals: [23, 28, 38], build: comboio },
  { id: 'travessia', chapter: 1, name: 'Travessia', subtitle: 'Rios de carruagens', env: 'aurora', medals: [15, 22, 32], build: travessia },
  { id: 'tempestade', chapter: 1, name: 'Tempestade', subtitle: 'Faixas que serpenteiam', env: 'tempestade', medals: [25, 31, 40], build: tempestade },
  { id: 'fuga', chapter: 1, name: 'Fuga', subtitle: 'O Véu é mais rápido que você', env: 'furia', medals: [24, 29, 36], build: fuga },
  // III — Céu Partido
  { id: 'engrenagens', chapter: 2, name: 'Engrenagens', subtitle: 'Plataformas que não esperam', env: 'tempestade', medals: [20, 27, 38], build: engrenagens },
  { id: 'torre', chapter: 2, name: 'Torre da Maré', subtitle: 'Suba antes que a maré suba', env: 'tempestade', medals: [16, 20, 26], build: torre },
  { id: 'ceu', chapter: 2, name: 'Céu Partido', subtitle: 'Ilhas suspensas sobre o nada', env: 'aurora', medals: [12, 16, 24], build: ceu },
  { id: 'fendas', chapter: 2, name: 'Fendas', subtitle: 'Deslize por baixo da morte', env: 'crepusculo', medals: [14, 18, 26], build: fendas },
  { id: 'gancho', chapter: 2, name: 'Âncoras de Luz', subtitle: 'O Gancho do Véu', env: 'aurora', medals: [17, 22, 32], build: gancho },
  { id: 'ventos', chapter: 2, name: 'Ventos Uivantes', subtitle: 'Correntes que levantam e empurram', env: 'tempestade', medals: [17, 22, 32], build: ventos },
  { id: 'surf1', chapter: 2, name: 'Ondas de Luz', subtitle: 'Surf: deslize nas rampas', env: 'aurora', medals: [26, 32, 45], build: surf1, isNew: true },
  // IV — O Outro Lado
  { id: 'ritmo', chapter: 3, name: 'Respiração', subtitle: 'Pontes que pulsam', env: 'aurora', medals: [17, 22, 32], build: ritmo },
  { id: 'espelho', chapter: 3, name: 'O Outro Lado', subtitle: 'Dois mundos, uma tecla', env: 'noite', medals: [16, 21, 30], build: espelho },
  { id: 'sombra', chapter: 3, name: 'A Sombra', subtitle: 'Não pare', env: 'furia', medals: [17, 21, 28], build: sombra },
  { id: 'abismo', chapter: 3, name: 'Fundo do Mundo', subtitle: 'Gancho, vento e os dois lados', env: 'crepusculo', medals: [21, 27, 38], build: abismo },
  { id: 'labirinto', chapter: 3, name: 'Labirinto de Runas', subtitle: 'Portões, runas e os dois mundos', env: 'noite', medals: [24, 30, 42], build: labirinto, isNew: true },
  // V — O Coração do Véu
  {
    id: 'abadia', chapter: 4, name: 'Abadia Submersa', subtitle: 'Furtividade e o Artefato do Véu', env: 'noite', type: 'stealth', music: 'calm',
    medals: [70, 110, 180], build: buildAbbey,
  },
  { id: 'coracao', chapter: 4, name: 'Coração do Véu', subtitle: 'A corrida até o Colosso', env: 'furia', medals: [32, 40, 52], build: coracao },
  { id: 'colosso', chapter: 4, name: 'O Colosso', subtitle: 'Acenda as três runas', env: 'furia', medals: [50, 70, 100], build: colosso, final: true, boss: true, music: 'final', isNew: true },
  // VI — Além do Véu (provas difíceis)
  { id: 'surf2', chapter: 5, name: 'Crista Partida', subtitle: 'Surf difícil: barras e os dois mundos', env: 'crepusculo', medals: [30, 36, 50], build: surf2, isNew: true },
  { id: 'ancoras', chapter: 5, name: 'Tempestade de Âncoras', subtitle: 'Gancho, vento e a Sombra', env: 'tempestade', medals: [22, 28, 40], build: ancoras, isNew: true },
  { id: 'prova', chapter: 5, name: 'Prova do Tecelão', subtitle: 'Todas as mecânicas, uma fase', env: 'aurora', medals: [48, 60, 80], build: prova, isNew: true },
  // VII — Os Fios de Lira (corrida na parede e Fios de Luz)
  { id: 'muros', chapter: 6, name: 'Muros de Lira', subtitle: 'Corra pelas paredes', env: 'poente', medals: [28, 36, 50], build: muros, isNew: true, unlockAfter: 'colosso' },
  { id: 'fios', chapter: 6, name: 'Fios de Luz', subtitle: 'Deslize entre as torres', env: 'aurora', medals: [19, 24, 33], build: fios, isNew: true },
  { id: 'ziguezague', chapter: 6, name: 'Zigue-Zague', subtitle: 'De muro em muro, sem tocar o chão', env: 'poente', medals: [36, 47, 64], build: ziguezague, isNew: true },
  { id: 'tear', chapter: 6, name: 'O Tear do Céu', subtitle: 'Fios, âncoras, vento e muros', env: 'crepusculo', medals: [24, 31, 43], build: tear, isNew: true },
  { id: 'pegapega', chapter: 6, name: 'Pega-Pega', subtitle: 'A Sombra corre nos muros', env: 'furia', medals: [19, 24, 33], build: pegapega, isNew: true },
  { id: 'ultimofio', chapter: 6, name: 'O Último Fio', subtitle: 'Tudo o que Lira ensinou', env: 'poente', medals: [33, 42, 58], build: ultimofio, isNew: true },
];
