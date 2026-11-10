# Khristós

Card game de disputa de influência espiritual. Dois Santos, três zonas, nenhuma carta ataca: a Fé só conta para quem domina a maioria das zonas, e vence quem reunir 100 primeiro.

As regras completas estão em [GDD.md](GDD.md).

## Como jogar

O jogo é HTML e JavaScript puro, sem build e sem dependências. Ele precisa ser servido por HTTP porque carrega `cards.json`.

```bash
npm start
```

Depois abra `http://localhost:5180/`. A porta muda com a variável `PORT`.

Na partida, arraste uma carta até um destino destacado, ou clique nela e depois no destino. Cartas em campo com o sinal dourado têm uma habilidade: clique para usar. O painel à direita mostra quem domina cada zona e quanto de Fé você ganha se encerrar o turno agora.

## Comandos

```bash
npm test
```

Roda os testes do motor de regras e da IA com o test runner do Node.

```bash
npm run sim
```

Joga 400 partidas entre duas IAs e mostra taxa de vitória por baralho e por cadeira, duração, trocas de maioria, Sacramentos, Fervor e Heresias por partida, e quanto cada carta é jogada. `node tools/sim.js 300 feToWin=90` joga 300 partidas com meta de 90 de Fé; qualquer regra de `RULES` aceita o mesmo formato, como `secondSab.bonus=0`.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `cards.json` | Regras numéricas, todas as cartas e as listas dos baralhos |
| `js/engine.js` | Motor de regras puro, sem DOM; o estado é um objeto JSON |
| `js/ai.js` | Oponente: avalia cada jogada possível e escolhe a melhor |
| `js/ui.js` | Tabuleiro, mão, arrastar e soltar, e a fila de animações |
| `js/fx.js` | Partículas em canvas |
| `js/audio.js` | Sons sintetizados (órgão, coro, tímpanos, sinos) e a trilha que cresce com a partida |
| `js/cardview.js` | Desenho das cartas e emblemas das cartas sem pintura |
| `js/main.js` | Telas, regras e hierarquia |
| `css/game.css` | Todo o visual |
| `tests/` | Testes do motor e da IA |
| `tools/` | Servidor local, simulador e `audio-check.html`, que mede cada som |
| `view-cards.html` | Galeria de cartas |

## Depuração

Abrir `khristos.html?debug` expõe `window.khristos` no console, com o motor (`E`), o estado (`state()`), `refresh()`, `perform(ação)` e `setPace(n)`.

```js
const G = khristos.state();
khristos.E.toHand(G, 0, 'cardeal');
khristos.refresh();
```
