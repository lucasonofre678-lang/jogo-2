# Histórico de versões

## v1.1 — Os Fios de Lira

**Conteúdo**
- Capítulo VII, **Os Fios de Lira**: 6 fases novas (33 no total), com fragmentos
  de memória, frases de abertura e um tema musical próprio (ré maior, com uma
  caixinha de música por cima)
- **Corrida na parede** nos muros dourados: encostando de lado no ar, o
  andarilho corre pela parede; saltar dela lança para o muro da frente e cada
  salto emendado acelera
- **Fios de Luz** (tirolesas): segure `E` perto do fio para deslizar; a descida
  acelera, o fim do fio lança você e, segurando `E` no ar, você agarra o
  próximo fio sozinho (ou o mesmo, depois de saltar dele)
- **Fluxo**: emendar movimentos sem parar no chão (paredes, fios, gancho,
  trampolins, anéis, surf, barreiras, troca de mundo no ar) monta uma
  sequência com contador no HUD e um sino que sobe de tom; o maior Fluxo
  aparece no fim da fase
- 2 mantos novos: **Correnteza** (Fluxo ×12) e **Lira** (termine O Último Fio)
- O capítulo VII abre ao derrotar o Colosso (não exige as provas do VI)
- Ambiente de pôr do sol, lanternas e fitas douradas no cenário do capítulo

**Desempenho**
- Fim das travadas ao entrar nas fases: os shaders de todas as fases são
  compilados em segundo plano nos menus e ficam no cache (antes, até 1,6 s
  congelado no primeiro quadro da Abadia)
- Fim da travada do primeiro Passo do Véu (cerca de 4,5 s): o rastro levava
  uma cópia da luz do personagem em cada imagem, mudando a quantidade de
  luzes e recompilando todos os shaders. Agora as luzes pontuais ocupam um
  número fixo de vagas (as mais próximas acendem)
- Rastro do Passo do Véu com uma chamada de desenho por peça do corpo (antes,
  uma por peça de cada cópia: de ~340 para ~210 chamadas no pico)
- Enfeites rígidos do cenário juntados numa malha por material, carruagens
  com 2 materiais em vez de 6 e só as ativas enviadas à GPU, brilhos de dois
  lados desenhados numa passada só: −21% de chamadas de desenho em média
  (Travessia: de 356 para 180)
- Partículas e linhas de velocidade não trabalham quando não há nada a mostrar
- Antisserrilhado de verdade na qualidade alta (MSAA no alvo da cena; antes o
  canvas pagava o MSAA sem efeito); bloom em meia resolução na qualidade média
- Texturas das fases agora são liberadas ao sair (antes algumas ficavam na memória)

## v1.0 — primeira versão pública

**Conteúdo**
- 27 fases em 6 capítulos, com lore, 27 fragmentos de memória e epílogo
- Abertura cinematográfica (o andarilho acorda), cartões de capítulo e créditos
- Luta contra o Colosso: braços articulados que esmagam e varrem a arena,
  rachaduras e olhos que apagam a cada runa acesa
- Surf com *air strafe* (girar o mouse segurando A/D ganha velocidade)
- Cenário próprio em cada capítulo (ruínas, trilhos, ilhas, cristais, correntes, anéis)

**Personagem**
- Esqueleto completo, capa e cachecol de tecido com colisão contra o corpo
- Marcha, corrida, curvas, cambalhotas, rolamento, surf, gancho, deslize, esgueirar
- 12 mantos que mudam cor e forma; prévia de animações no guarda-roupa
- Fantasma do recorde e a Sombra agora usam o modelo e as animações completos

**Técnico**
- Tela de carregamento, aviso amigável de erro e de navegador sem WebGL
- Pausa automática ao trocar de aba; qualidade automática em PCs lentos
- Build com caminhos relativos (itch.io / GitHub Pages) e Three.js em arquivo separado
- Rampas de surf sólidas por todos os lados; câmera não atravessa rampas
- Botão "Continuar" leva à próxima fase não concluída
