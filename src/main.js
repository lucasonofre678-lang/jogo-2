// Ponto de entrada: confere o WebGL, mostra a tela de carregamento enquanto o
// mundo é montado e troca erros fatais por uma mensagem legível.
import { Game } from './game.js';

export const VERSION = '1.0';

const boot = document.getElementById('boot');
const msg = document.getElementById('boot-msg');
const errEl = document.getElementById('boot-err');

function fail(text) {
  msg.textContent = 'algo deu errado';
  errEl.style.display = 'block';
  errEl.textContent = text;
  boot.classList.remove('done');
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

window.addEventListener('error', (e) => {
  if (!window.__veilReady) fail(`Não foi possível iniciar o jogo: ${e.message}. Tente atualizar a página ou usar outro navegador (Chrome, Edge ou Firefox).`);
});

if (!hasWebGL()) {
  fail('Seu navegador ou placa de vídeo não tem WebGL ativado. Tente o Chrome, o Edge ou o Firefox atualizados, com a aceleração de hardware ligada.');
} else {
  // deixa a tela de carregamento aparecer antes do trabalho pesado
  requestAnimationFrame(() => setTimeout(() => {
    try {
      new Game(document.getElementById('app'), VERSION);
      window.__veilReady = true;
      boot.classList.add('done');
      setTimeout(() => boot.remove(), 1000);
    } catch (e) {
      console.error(e);
      fail(`Não foi possível iniciar o jogo: ${e.message}`);
    }
  }, 30));
}
