// A história do VEIL, contada em pedaços: um interlúdio ao abrir cada
// capítulo, uma frase ao entrar em cada fase, vozes que falam no meio delas
// (sussurros), um fragmento de memória escondido em cada uma e o epílogo.

export const PROLOGUE = `Entre o mundo dos vivos e o dos mortos existe o Véu — um tecido de luz
  que os monges da Abadia guardavam. Numa noite de lua nova, ele se rasgou.
  Você acorda nas ruínas, sem nome e sem memória, com uma runa pulsando na mão.`;

// a abertura mostra o prólogo em linhas
export const PROLOGUE_LINES = [
  'Entre o mundo dos vivos e o dos mortos existe o Véu — um tecido de luz.',
  'Os monges da Abadia o guardavam. Numa noite de lua nova, ele se rasgou.',
  'Você acorda nas ruínas, sem nome e sem memória.',
  'Na sua mão, uma runa ainda pulsa.',
];

// lines: o interlúdio que abre o capítulo (o do I é o próprio prólogo)
export const CHAPTERS = [
  { num: 'I', name: 'O Despertar', text: 'Um andarilho acorda nas ruínas da Abadia Submersa, sem nome e sem memória.', lines: PROLOGUE_LINES },
  {
    num: 'II', name: 'A Ferrovia dos Mortos', text: 'O Comboio Espectral, que levava as almas para o outro lado, enlouqueceu.',
    lines: [
      'O Comboio Espectral levava as almas até o outro lado, sem pressa e sem volta.',
      'Depois do rasgo, os trilhos se soltaram do céu. As carruagens correm sem destino.',
      'Em algum vagão, você lembra, ia uma menina de lenço amarelo.',
    ],
  },
  {
    num: 'III', name: 'Céu Partido', text: 'O rasgo arrancou pedaços do mundo e os deixou flutuando sobre a névoa.',
    lines: [
      'O rasgo arrancou pedaços do mundo e os deixou flutuando sobre a névoa.',
      'Torres, engrenagens, jardins inteiros — tudo à deriva.',
      'Quanto mais alto você sobe, mais claro fica o que você fez.',
    ],
  },
  {
    num: 'IV', name: 'O Outro Lado', text: 'Atrás do Véu existe um reflexo do mundo — e algo que conhece você.',
    lines: [
      'Atrás do Véu existe um reflexo deste mundo: igual, só que vazio.',
      'Você atravessou para procurá-la. Encontrou outra coisa.',
      'Algo que anda nos seus passos — e tem o seu rosto.',
    ],
  },
  {
    num: 'V', name: 'O Coração do Véu', text: 'Tudo começou no santuário. Tudo termina no rasgo.',
    lines: [
      'A Abadia afundou na névoa com tudo o que guardava.',
      'Os monges viraram Guardiões. O Abade, que abraçou o rasgo, virou o Colosso.',
      'Tudo começou no santuário. Tudo termina no rasgo.',
    ],
  },
  {
    num: 'VI', name: 'Além do Véu', text: 'Depois da costura, fios soltos. Provas para quem quer ir além.',
    lines: [
      'O Véu foi costurado. Mas todo tecido costurado guarda a marca.',
      'Fios soltos balançam onde antes havia o rasgo.',
      'E a Sombra não foi embora. Ela só aprendeu a correr.',
    ],
  },
  {
    num: 'VII', name: 'Os Fios de Lira', text: 'Lira corria pelos muros e deslizava nos fios de luz entre as torres. Os caminhos dela ainda brilham.',
    lines: [
      'Quando eram crianças, Lira corria pelos muros e escorregava pelos fios de luz entre as torres.',
      'Ela deixou os caminhos acesos, como quem deixa uma vela na janela.',
      'Agora é a sua vez de correr atrás dela.',
    ],
  },
];

// Quem fala nos sussurros (nome e cor).
export const VOICES = {
  voce: { name: 'Você', color: '#bcd6ff' },
  lira: { name: 'Lira', color: '#ffcf7a' },
  abade: { name: 'O Abade', color: '#c9b8ff' },
  sombra: { name: 'A Sombra', color: '#ff6f9c' },
  almas: { name: 'As almas', color: '#8fe3d6' },
};

// Sussurros: [quando, quem, fala]. "Quando" até 1 é a fração do caminho
// entre a largada e o portal; acima de 1, os segundos de fase (Abadia e
// Colosso, onde o caminho não é uma linha). Cada um aparece uma vez por visita.
export const WHISPERS = {
  despertar: [[0.35, 'voce', 'Minhas mãos sabem o caminho. Minha cabeça, não.'], [0.75, 'lira', 'Mais rápido, irmão! Você sempre fica pra trás.']],
  saltos: [[0.4, 'abade', 'O Véu sustenta quem confia nele, aprendiz.'], [0.8, 'voce', 'Essa voz... eu conheço essa voz.']],
  laminas: [[0.35, 'voce', 'A luz rosa corta. Ela não estava aqui antes.'], [0.75, 'abade', 'O que foi rasgado sangra, aprendiz. Cuidado onde pisa.']],
  corredor: [[0.3, 'lira', 'Quem chegar por último arruma a biblioteca!'], [0.7, 'voce', 'Lira. O nome dela era Lira.']],
  desabamento: [[0.4, 'almas', 'Corre... o chão está indo embora...'], [0.8, 'voce', 'Tudo desmorona atrás de mim. Como se o mundo quisesse me esquecer.']],
  comboio: [[0.35, 'almas', 'Para onde vamos? Ninguém sabe mais para onde vamos.'], [0.75, 'voce', 'Um lenço amarelo numa janela. Eu já vi isso.']],
  travessia: [[0.4, 'lira', 'Não pula, irmão! Eu volto, eu prometo.'], [0.8, 'voce', 'Ela me pediu para não pular. Eu pulei mesmo assim.']],
  tempestade: [[0.35, 'abade', 'Você estudava o Véu com fome. Eu devia ter percebido.'], [0.75, 'voce', 'Aprendi a tecer. Aprendi a desfazer.']],
  fuga: [[0.35, 'sombra', 'Corre. Eu gosto quando você corre.'], [0.75, 'voce', 'Tem alguma coisa no Véu corrompido. Alguma coisa que me conhece.']],
  engrenagens: [[0.4, 'abade', 'As máquinas ainda obedecem. Ao contrário de você.'], [0.8, 'voce', 'A chave do santuário pesava na minha mão. Eu lembro do peso.']],
  torre: [[0.35, 'voce', 'Do alto, a costura do Véu parecia tão fina.'], [0.75, 'lira', 'Lá de cima dá pra ver o mundo inteiro, né?']],
  ceu: [[0.4, 'voce', 'Só uma fresta. Só o bastante para ver o rosto dela.'], [0.8, 'abade', 'Não existe fresta no Véu, aprendiz. Ou ele inteiro, ou nada.']],
  fendas: [[0.4, 'voce', 'Mil sinos se quebrando. Foi esse o som.'], [0.8, 'almas', 'Ele rasgou... ele rasgou...']],
  gancho: [[0.35, 'abade', 'As âncoras eram dos monges. Você nunca pediu permissão.'], [0.75, 'voce', 'A Abadia caiu porque eu não soube esperar.']],
  ventos: [[0.35, 'voce', 'Os monges tentaram fechar o rasgo com o próprio corpo.'], [0.75, 'almas', 'Frio... está tão frio do lado de lá...']],
  surf1: [[0.35, 'lira', 'Mais rápido! Mais rápido!'], [0.75, 'voce', 'Eu ria. Faz tanto tempo que não rio.']],
  ritmo: [[0.35, 'abade', 'Eu segurei o rasgo, aprendiz. Ele me segurou de volta.'], [0.75, 'voce', 'O Véu respira. Como alguém que dorme mal.']],
  espelho: [[0.35, 'voce', 'Do outro lado é tudo igual. Só que vazio.'], [0.75, 'sombra', 'Procurando por ela? Aqui só tem eu.']],
  sombra: [[0.3, 'sombra', 'Eu sou cada passo que você deu naquela noite.'], [0.7, 'sombra', 'Para. Só um segundo. Eu deixo.']],
  abismo: [[0.4, 'voce', 'Esqueci de propósito. Era mais fácil.'], [0.8, 'sombra', 'Você não esqueceu. Você me deixou carregando.']],
  labirinto: [[0.35, 'abade', 'Você decorou todas as runas. Sempre foi o melhor de nós.'], [0.75, 'voce', 'O melhor aprendiz. O pior irmão.']],
  abadia: [[8, 'abade', 'Você voltou ao santuário. Os Guardiões ainda lembram de você.'], [45, 'voce', 'O Artefato não abre o Véu. Ele costura.']],
  coracao: [[0.3, 'abade', 'Aprendiz! Você me ouve? Eu ainda estou aqui dentro.'], [0.75, 'voce', 'Ele disse o meu nome. Faz anos que ninguém diz.']],
  colosso: [[3, 'abade', 'Costure, aprendiz. Mesmo que doa.'], [30, 'lira', 'Pode me deixar ir, irmão. Tá tudo bem.']],
  surf2: [[0.4, 'voce', 'O Véu está inteiro. Por que ainda dói?'], [0.8, 'lira', 'Ainda tem fio solto por aí, sabia?']],
  ancoras: [[0.35, 'sombra', 'Achou que eu ia sumir com a costura?'], [0.75, 'voce', 'A Sombra não vai embora. Então eu corro mais.']],
  prova: [[0.35, 'abade', 'O Tecelão não é quem nunca rasga. É quem costura de volta.'], [0.8, 'voce', 'Tecelão. É isso que eu sou agora.']],
  sineiro: [[6, 'abade', 'O sino chama os mortos, aprendiz. E eles respondem.'], [40, 'voce', 'Cada badalada é uma noite que eu não dormi.']],
  locomotiva: [[6, 'almas', 'Embarque... embarque... ainda há lugar...'], [40, 'lira', 'Desce do trem, irmão! Esse não é o seu.']],
  vendaval: [[6, 'voce', 'O vento quer me levar para longe. Para longe de tudo.'], [40, 'abade', 'Até o vento guarda rancor, aprendiz.']],
  reflexo: [[5, 'sombra', 'Olha bem. Esse aí é você.'], [35, 'sombra', 'Toda vez que você troca de lado, eu chego mais perto.']],
  eclipse: [[6, 'voce', 'Sem luz eu esqueço de novo. Não posso esquecer.'], [40, 'lira', 'Fica perto do fogo, irmão. Sempre perto do fogo.']],
  traca: [[6, 'lira', 'Ela está comendo os meus caminhos! Corre!'], [45, 'voce', 'Enquanto eu correr por eles, eles existem.']],
  muros: [[0.35, 'lira', 'Chão é pra quem é devagar!'], [0.75, 'voce', 'Ela corria pelas paredes. Eu caía. Ela ria.']],
  fios: [[0.35, 'lira', 'Não solta, hein! Nunca solta.'], [0.75, 'voce', 'Ela teceu esses fios numa primavera. Eu nunca perguntei por quê.']],
  ziguezague: [[0.35, 'lira', 'Conta comigo! Um, dois, três...'], [0.8, 'voce', 'Vinte e sete saltos. Eu nunca passei de nove.']],
  tear: [[0.35, 'lira', 'Esse é o meu lugar preferido do mundo inteiro.'], [0.75, 'voce', 'Os monges chamavam de Tear. Ela chamava de casa.']],
  pegapega: [[0.3, 'sombra', 'Pega-pega! Agora é a minha vez.'], [0.7, 'lira', 'Corre, irmão! Não deixa ela te pegar!']],
  ultimofio: [[0.35, 'lira', 'Eu deixei os caminhos acesos pra você.'], [0.8, 'lira', 'Tá quase, irmão. Não para agora.']],
};

// intro: frase ao começar a fase · memory: o fragmento escondido nela
export const LORE = {
  despertar: {
    intro: 'Você acorda sobre pedras frias. Uma runa pulsa na sua mão.',
    memory: 'Eu já estive aqui. A runa na minha mão era um presente — ou uma promessa.',
  },
  saltos: {
    intro: 'As torres da Abadia flutuam sobre a névoa. Elas lembram de você.',
    memory: '"O Véu sustenta quem confia nele", dizia o Abade enquanto eu saltava entre as torres.',
  },
  laminas: {
    intro: 'O Véu rasgado sangra luz rosa. Ela corta como vidro.',
    memory: 'A energia rosa não existia antes. Ela tem cheiro de ferro — e de algo que eu fiz.',
  },
  corredor: {
    intro: 'Corredores estreitos, onde duas crianças apostavam corrida.',
    memory: 'Eu tinha uma irmã. Lira. Ela corria por estes corredores mais rápido do que eu.',
  },
  desabamento: {
    intro: 'A ruptura se espalha. O chão que você pisa já é passado.',
    memory: 'No inverno em que Lira adoeceu, a Abadia inteira rezou por ela. Não foi o bastante.',
  },
  comboio: {
    intro: 'O Comboio Espectral levava as almas. Agora corre sem rumo.',
    memory: 'As carruagens levavam as almas para o outro lado. Eu vi Lira embarcar em uma delas.',
  },
  travessia: {
    intro: 'Rios de carruagens cruzam o abismo, sem cocheiro e sem fim.',
    memory: 'Eu pulei atrás dela. Os monges me puxaram de volta. Nunca os perdoei.',
  },
  tempestade: {
    intro: 'A tempestade do Véu entorta os trilhos do céu.',
    memory: 'Passei anos estudando o Véu. Aprendi a tecê-lo. Aprendi a desfazê-lo.',
  },
  fuga: {
    intro: 'O Véu corrompido sentiu o seu cheiro. Ele vem.',
    memory: 'O Artefato do Véu ficava no santuário. Só o Abade podia tocá-lo.',
  },
  engrenagens: {
    intro: 'As máquinas da Abadia ainda giram, obedecendo a ordens esquecidas.',
    memory: 'Roubei a chave do santuário durante a vigília da lua nova.',
  },
  torre: {
    intro: 'A maré do Véu sobe. Só existe o alto.',
    memory: 'Do alto da torre se via a costura do Véu brilhando no céu. Eu a achei frágil.',
  },
  ceu: {
    intro: 'Ilhas arrancadas da terra pelo rasgo. Não olhe para baixo.',
    memory: 'Eu disse a mim mesmo que só abriria uma fresta. Só o bastante para ver o rosto dela.',
  },
  fendas: {
    intro: 'Lâminas na altura do peito. Abaixe-se — e deslize.',
    memory: 'O Véu não abriu. Ele rasgou. O som foi o de mil sinos se quebrando.',
  },
  gancho: {
    intro: 'Os monges cruzavam o abismo por âncoras de luz. A sua runa ainda as chama.',
    memory: 'As carruagens enlouqueceram. As torres afundaram. A Abadia caiu no mar de névoa.',
  },
  ventos: {
    intro: 'Onde o Véu rasgou, o vento sopra para cima.',
    memory: 'Os monges tentaram fechar o rasgo com o próprio corpo. Viraram os Guardiões.',
  },
  surf1: {
    intro: 'As rampas de luz levavam os monges até o santuário. Deslize.',
    memory: 'Lira ria quando descíamos as rampas da Abadia. Nunca mais ri tão alto.',
  },
  ritmo: {
    intro: 'Estas pontes só existem enquanto o Véu respira.',
    memory: 'O Abade abraçou o Véu corrompido para contê-lo. Cresceu até virar o Colosso.',
  },
  espelho: {
    intro: 'Há um outro mundo atrás deste. Aperte F e atravesse.',
    memory: 'Do outro lado do Véu tudo é igual — só que vazio. Lira não estava lá.',
  },
  sombra: {
    intro: 'Algo anda nos seus passos. Não pare.',
    memory: 'A Sombra que me persegue tem o meu rosto. É tudo o que eu fui naquela noite.',
  },
  abismo: {
    intro: 'O fundo do mundo. Os dois lados do Véu se misturam aqui.',
    memory: 'Eu esqueci de propósito. Era mais fácil acordar inocente.',
  },
  labirinto: {
    intro: 'Portões que só se abrem para quem corre mais que o tempo.',
    memory: 'O Abade guardava as runas dos portões. Eu decorei todas, uma por uma.',
  },
  abadia: {
    intro: 'O santuário, os Guardiões e o Artefato. Você conhece este lugar.',
    memory: 'O Artefato não abre o Véu. Ele costura. Eu sempre soube.',
  },
  coracao: {
    intro: 'O Colosso desperta. Chegue até ele antes do Véu corrompido.',
    memory: 'O Colosso me reconheceu. Ele disse o meu nome.',
  },
  colosso: {
    intro: 'O Abade virou o Colosso. Acenda as três runas e costure o Véu.',
    memory: 'Lira, eu deixo você ir.',
  },
  surf2: {
    intro: 'Além do Véu, a luz corre mais rápido que o pensamento.',
    memory: 'Depois da costura, o Véu ficou mais forte. Mas ainda há fios soltos.',
  },
  ancoras: {
    intro: 'Âncoras sobre a tempestade, e a Sombra no seu encalço.',
    memory: 'A Sombra não foi embora. Ela só aprendeu a correr.',
  },
  prova: {
    intro: 'A prova do Tecelão: tudo, ao mesmo tempo.',
    memory: 'Eu sou o Tecelão agora. E o Véu nunca mais vai rasgar.',
  },
  sineiro: {
    intro: 'O sino da Abadia toca sozinho. Quem puxa a corda não está vivo.',
    memory: 'O Sineiro tocava o sino ao amanhecer. Na noite do rasgo, ele tocou até a corda partir.',
  },
  locomotiva: {
    intro: 'A locomotiva que puxava o Comboio ainda ronda o abismo, sem trilhos e sem fim.',
    memory: 'O maquinista apitou três vezes quando o vagão de Lira partiu. Eu ouço até hoje.',
  },
  vendaval: {
    intro: 'No olho da tempestade, o vento aprendeu a odiar.',
    memory: 'O vento nasceu do rasgo. Ele sopra para longe tudo o que lembra aquela noite.',
  },
  reflexo: {
    intro: 'Do outro lado, um gigante com o seu rosto copia cada passo seu.',
    memory: 'O Reflexo não mente: ele só repete o que eu fiz.',
  },
  eclipse: {
    intro: 'Um sol negro engole a luz. Fique perto das chamas.',
    memory: 'Depois da costura, a escuridão ficou com fome. Ela come o que sobra de luz.',
  },
  traca: {
    intro: 'Uma traça enorme come os caminhos dourados de Lira, um por um.',
    memory: 'Esquecer é isso: uma traça comendo os fios, devagar, até não sobrar caminho.',
  },
  muros: {
    intro: 'Os muros dourados por onde Lira corria. Ela nunca usava o chão.',
    memory: 'Lira corria pelas paredes da Abadia como se a gravidade fosse só uma sugestão. Eu tentava acompanhar e caía.',
  },
  fios: {
    intro: 'Fios de luz entre as torres. Lira os teceu numa primavera, para chegar mais rápido ao alto.',
    memory: 'Ela dizia que o Véu era só um fio muito comprido. Que bastava não soltar.',
  },
  ziguezague: {
    intro: 'De muro em muro, sem tocar o chão: o jogo favorito dela.',
    memory: 'Contávamos os saltos sem pisar no chão. O recorde dela era vinte e sete. O meu, nove.',
  },
  tear: {
    intro: 'O Tear do Céu: todos os fios de Lira se cruzam aqui.',
    memory: 'Os monges chamavam este lugar de Tear. Lira chamava de casa.',
  },
  pegapega: {
    intro: 'Pega-pega nos muros. Desta vez, quem corre atrás é a Sombra.',
    memory: 'Ela sempre me deixava ganhar no final. Só agora eu percebi.',
  },
  ultimofio: {
    intro: 'O último fio que Lira deixou. Ele leva para onde ela queria ir.',
    memory: 'No fim do fio, um bilhete na letra dela: "Corre, que eu te espero do outro lado." Eu corro.',
  },
};

// Com todos os fragmentos, o epílogo ganha o reencontro.
export const EPILOGUE_SECRET = [
  'Antes que o Véu se feche de vez, a silhueta pequena corre até a borda.',
  'É Lira. Ela segura o seu rosto com as duas mãos, como fazia quando você chorava.',
  '"Você lembrou de tudo", ela diz. "Agora pode esquecer o que dói. Eu fico com o resto."',
  'Ela atravessa de volta, rindo. E, desta vez, você ri junto.',
];

export const EPILOGUE = [
  'O Artefato toca o rasgo, e a luz rosa se desfaz em fios azuis.',
  'O Colosso fecha os olhos. Os Guardiões, um a um, voltam a ser monges — e depois, só névoa.',
  'Do outro lado, por um instante, uma silhueta pequena acena. Você acena de volta.',
  'O Véu se fecha. E, pela primeira vez desde aquela noite, amanhece.',
];
