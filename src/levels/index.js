// Lista das fases, em ordem, divididas em capítulos (ver lore.js).
// medals = tempos (s) para ouro, prata e bronze.
import { despertar, comboio, saltos, laminas, desabamento, engrenagens, travessia, corredor, torre, tempestade, ceu, fuga } from './runs.js';
import { fendas, gancho, ventos, ritmo, espelho, sombra, abismo, coracao } from './mechanics.js';
import { buildAbbey } from './abbey.js';

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
  { id: 'fendas', chapter: 2, name: 'Fendas', subtitle: 'Deslize por baixo da morte', env: 'crepusculo', medals: [14, 18, 26], build: fendas, isNew: true },
  { id: 'gancho', chapter: 2, name: 'Âncoras de Luz', subtitle: 'O Gancho do Véu', env: 'aurora', medals: [17, 22, 32], build: gancho, isNew: true },
  { id: 'ventos', chapter: 2, name: 'Ventos Uivantes', subtitle: 'Correntes que levantam e empurram', env: 'tempestade', medals: [17, 22, 32], build: ventos, isNew: true },
  // IV — O Outro Lado
  { id: 'ritmo', chapter: 3, name: 'Respiração', subtitle: 'Pontes que pulsam', env: 'aurora', medals: [17, 22, 32], build: ritmo, isNew: true },
  { id: 'espelho', chapter: 3, name: 'O Outro Lado', subtitle: 'Dois mundos, uma tecla', env: 'noite', medals: [16, 21, 30], build: espelho, isNew: true },
  { id: 'sombra', chapter: 3, name: 'A Sombra', subtitle: 'Não pare', env: 'furia', medals: [17, 21, 28], build: sombra, isNew: true },
  { id: 'abismo', chapter: 3, name: 'Fundo do Mundo', subtitle: 'Gancho, vento e os dois lados', env: 'crepusculo', medals: [21, 27, 38], build: abismo, isNew: true },
  // V — O Coração do Véu
  {
    id: 'abadia', chapter: 4, name: 'Abadia Submersa', subtitle: 'Furtividade e o Artefato do Véu', env: 'noite', type: 'stealth', music: 'calm',
    medals: [70, 110, 180], build: buildAbbey,
  },
  { id: 'coracao', chapter: 4, name: 'Coração do Véu', subtitle: 'O Colosso e o rasgo', env: 'furia', medals: [32, 40, 52], build: coracao, final: true, isNew: true },
];
