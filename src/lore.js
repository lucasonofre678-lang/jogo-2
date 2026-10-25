// A história do VEIL, contada em pedaços: uma frase ao entrar em cada fase,
// um fragmento de memória escondido em cada uma e o epílogo.

export const PROLOGUE = `Entre o mundo dos vivos e o dos mortos existe o Véu — um tecido de luz
  que os monges da Abadia guardavam. Numa noite de lua nova, ele se rasgou.
  Você acorda nas ruínas, sem nome e sem memória, com uma runa pulsando na mão.`;

export const CHAPTERS = [
  { num: 'I', name: 'O Despertar', text: 'Um andarilho acorda nas ruínas da Abadia Submersa, sem nome e sem memória.' },
  { num: 'II', name: 'A Ferrovia dos Mortos', text: 'O Comboio Espectral, que levava as almas para o outro lado, enlouqueceu.' },
  { num: 'III', name: 'Céu Partido', text: 'O rasgo arrancou pedaços do mundo e os deixou flutuando sobre a névoa.' },
  { num: 'IV', name: 'O Outro Lado', text: 'Atrás do Véu existe um reflexo do mundo — e algo que conhece você.' },
  { num: 'V', name: 'O Coração do Véu', text: 'Tudo começou no santuário. Tudo termina no rasgo.' },
  { num: 'VI', name: 'Além do Véu', text: 'Depois da costura, fios soltos. Provas para quem quer ir além.' },
];

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
};

export const EPILOGUE = [
  'O Artefato toca o rasgo, e a luz rosa se desfaz em fios azuis.',
  'O Colosso fecha os olhos. Os Guardiões, um a um, voltam a ser monges — e depois, só névoa.',
  'Do outro lado, por um instante, uma silhueta pequena acena. Você acena de volta.',
  'O Véu se fecha. E, pela primeira vez desde aquela noite, amanhece.',
];
