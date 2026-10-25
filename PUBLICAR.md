# Como publicar o VEIL

## 1. Gerar o pacote

```bash
npm run build
```

O zip pronto para upload é `VEIL-v1.0-web.zip` (o `index.html` fica na raiz do zip,
como o itch.io exige). Para gerar de novo depois de mudar algo, no PowerShell:

```powershell
cd dist; tar -a -cf ..\VEIL-v1.0-web.zip index.html assets; cd ..
```

> Não use "Enviar para → Pasta compactada" nem `Compress-Archive`: eles gravam os
> caminhos com `\` e o jogo pode não abrir no itch.io.

## 2. itch.io (recomendado)

1. Entre em <https://itch.io> → **Upload new project**.
2. **Kind of project**: `HTML`.
3. **Uploads**: envie `VEIL-v1.0-web.zip` e marque **This file will be played in the browser**.
4. **Embed options**:
   - Viewport: `1280 × 720`
   - Marque **Fullscreen button** e **Automatically start on page load** (opcional)
   - Deixe **Mobile friendly** desmarcado (o jogo precisa de teclado/mouse ou controle)
5. **Cover image**: `press/capa-630x500.png`.
6. **Screenshots**: as imagens de `press/` (01 a 07).
7. **Genre**: Platformer · **Tags**: `parkour`, `3D`, `surf`, `atmospheric`, `singleplayer`, `speedrun`, `browser`, `threejs`.
8. **Visibility**: comece como *Draft* (rascunho), teste o link e depois mude para *Public*.

## 3. GitHub Pages (alternativa)

Envie o conteúdo de `dist/` para um repositório (branch `gh-pages` ou pasta `docs/`) e
ative o Pages nas configurações. Os caminhos já são relativos, então funciona em qualquer
subpasta.

---

## Texto para a página

**Título:** VEIL

**Frase curta:** Parkour místico em 3D no navegador: corra, surfe e costure o Véu.

**Descrição:**

> Entre o mundo dos vivos e o dos mortos existe o Véu — um tecido de luz. Numa noite de
> lua nova, ele se rasgou. Você acorda nas ruínas da Abadia Submersa, sem nome e sem
> memória, com uma runa pulsando na mão.
>
> **VEIL** é um jogo de parkour veloz em terceira pessoa, feito para rodar direto no
> navegador.
>
> - **27 fases em 6 capítulos**, de ruínas flutuantes a um comboio de almas
> - **Surf como no CS**: rampas de luz sem atrito, *air strafe* e mais de 40 m/s
> - **Passo do Véu**, pulo na parede, deslize, **Gancho do Véu**, correntes de vento
> - **Dois mundos**: aperte F para atravessar para o outro lado no meio do salto
> - **A Sombra**, que refaz cada passo seu, e uma **luta contra o Colosso**
> - Uma fase de **furtividade** com guardiões que veem e ouvem
> - **27 fragmentos de memória** contam o que você fez naquela noite
> - Medalhas, fantasma do seu recorde, **modo speedrun** e 12 mantos para desbloquear
> - Funciona com **teclado e mouse ou controle**; teclas remapeáveis
>
> Tudo no jogo — modelos, texturas, música e sons — é gerado por código.
>
> **Controles:** WASD + mouse · Espaço saltar · Q Passo do Véu · C deslizar · E gancho ·
> F outro lado · R reiniciar · Esc pausa

**English (short):**

> A fast, mystical third-person parkour game that runs in your browser. Run, wall-jump,
> grapple, CS-style surf and shift between two worlds across 27 levels to stitch back the
> Veil you tore. Fight a Colossus, outrun your own Shadow, chase medals and your ghost.
> Keyboard + mouse or gamepad. (Text in Brazilian Portuguese.)

## Antes de postar: checklist

- [ ] Abrir o link do itch.io num navegador limpo (aba anônima) e jogar a primeira fase
- [ ] Testar o botão de tela cheia do itch e o Esc/pausa
- [ ] Testar com controle, se tiver um
- [ ] Jogar pelo menos o Colosso e uma fase de surf do começo ao fim
- [ ] Em Créditos, conferir o nome do autor (fica em `src/ui.js`, constante `AUTHOR`)
