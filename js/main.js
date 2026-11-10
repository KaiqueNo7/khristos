import * as E from './engine.js';
import { initFx, setPace } from './fx.js';
import { sfx, soundMode, cycleSoundMode } from './audio.js';
import { initGame, startGame, currentDeck, retiroHtml, debugHandle } from './ui.js';

const $ = sel => document.querySelector(sel);
const stage = $('#stage');

const DECKS = [
  {
    id: 'aq',
    saint: 'sta_santo',
    desc: 'Sobe a escada do clero, do Acólito ao Cardeal, e celebra Sacramentos quando o ministro e o templo estão em campo. Começa devagar e termina dominante.',
    traits: ['Escada completa do clero', 'Sacramentos: combos de ministro e lugar', 'Mártir e Inquisidor contra as Heresias']
  },
  {
    id: 'jo',
    saint: 'jo_santo',
    desc: 'Toma as zonas cedo com leigos e cavaleiros, encadeia cartas no mesmo turno pelo Fervor e explora a Fraqueza do adversário com Heresias.',
    traits: ['Fervor: a segunda carta do turno vem mais forte', 'Relíquias de batalha', 'Sete Heresias que cobram a Fraqueza']
  }
];

const SOUND_LABEL = { tudo: 'Som e música', efeitos: 'Só efeitos', mudo: 'Sem som' };

function rulesHtml(goal) {
  return `
    <h2>Como se joga</h2>
    <p class="lead">Ninguém ataca ninguém. Ganha quem reunir ${goal} de Fé primeiro.</p>
    <div class="cols">
      <div>
        <h3>A maioria das zonas</h3>
        <p>São três zonas. Domina a zona quem tem mais Fé nela. Ao encerrar o seu turno, se você domina duas ou mais, ganha a diferença de Fé de cada zona dominada. Com as três, é Hegemonia: mais 6. Sem a maioria, a sua Fé não conta.</p>
        <h3>Zona Central, a coringa</h3>
        <p>Uma zona lateral empatada fica com quem domina a Central. E um Santo na Central alcança as três zonas.</p>
        <h3>Sabedoria</h3>
        <p>No seu turno você tem Sabedoria igual ao número da rodada, até 10. Ela paga as cartas e o que sobra não fica para depois. Quem joga em segundo tem 1 a mais nas 5 primeiras rodadas.</p>
        <h3>Cartas em campo</h3>
        <p>Cada zona tem 4 espaços por jogador: 2 na frente e 2 no fundo. São vizinhas as cartas lado a lado e as que estão uma atrás da outra. As cartas ficam em campo até o fim; em zona cheia, uma carta nova pode substituir uma sua, que vai para o Retiro.</p>
        <h3>Evolução e ofícios</h3>
        <p>Uma carta de degrau superior só entra por cima da anterior, pagando a diferença de custo, um degrau por turno. Padres e Bispos sobem de ofício sozinhos conforme a zona cresce.</p>
      </div>
      <div>
        <h3>Fraqueza</h3>
        <p>Cada unidade tem Fraqueza, e as Heresias cobram por ela: algumas só alcançam quem tem 6 ou mais, outras tiram Fé na medida da Fraqueza. Com 8 ou mais a unidade está exposta. Há cartas que aumentam a Fraqueza do oponente e cartas que transformam a sua em Fé.</p>
        <h3>Sacramentos</h3>
        <p>Bênçãos que pedem um ministro e, às vezes, um lugar: a Confissão precisa de um Padre e de uma Igreja seus em campo. Graus superiores também servem, e o ministro não pode ser o próprio alvo.</p>
        <h3>Fervor</h3>
        <p>Cartas com Fervor ganham um bônus quando não são a primeira carta que você joga no turno. Encadeie: uma carta barata primeiro, a de Fervor depois.</p>
        <h3>Durações</h3>
        <p>Um efeito "até o seu próximo turno" vale na sua Contagem e na do oponente. Uma Heresia "por 2 rodadas" pesa em duas Contagens de quem a sofreu.</p>
        <h3>Como jogar uma carta</h3>
        <p>Arraste a carta até um destino destacado, ou clique nela e depois no destino. Cartas em campo com o sinal dourado têm uma habilidade: clique nelas para usar.</p>
      </div>
    </div>`;
}

function ladderHtml() {
  const padre = E.officeTrack('padre');
  const bispo = E.officeTrack('bispo');
  const steps = [
    ['Acólito', 'carta', 'Formação', true],
    ['Seminarista', 'carta', 'Formação', true],
    ['Diácono', 'carta', 'Diaconato', true],
    [padre[0].name, 'carta Padre', 'Presbitério', true],
    ...padre.slice(1).map(o => [o.name, 'ofício', 'Presbitério', false]),
    [bispo[0].name, 'carta Bispo', 'Episcopado', true],
    ...bispo.slice(1).map(o => [o.name, 'ofício', 'Episcopado', false]),
    ['Cardeal', 'carta', 'Episcopado', true],
    ['Papa', 'em breve', '', false]
  ];
  const soft = name => name.replace('Metropolitano', 'Metro&shy;politano').replace('Episcopal', 'Epis&shy;copal').replace('Seminarista', 'Semina&shy;rista').replace('Paroquial', 'Paro&shy;quial');
  const rows = track => track.map((o, i) => `<tr><td>${o.name}</td><td>${i ? o.hint : 'ao entrar em campo'}</td><td>${o.name === 'Pároco' ? '−3 Fraqueza' : o.fe ? `+${o.fe} Fé` : ''}</td></tr>`).join('');
  return `
    <h2>A hierarquia</h2>
    <p class="lead">Subir de ordem pede uma carta nova por cima da anterior. Dentro da mesma ordem, o ofício vem do que acontece na zona.</p>
    <div class="stairs">${steps.map(([name, note, order, isCard], i) => `<div class="step${isCard ? ' card-step' : ''}${name === 'Papa' ? ' soon' : ''}" style="--i:${i}" data-order="${order}">${soft(name)}<small>${note}</small></div>`).join('')}</div>
    <div class="legend"><span><i class="a"></i>Degrau que é uma carta</span><span><i class="b"></i>Ofício conquistado em campo</span></div>
    <div class="offices">
      <div><h3>Ofícios do Padre</h3><table>${rows(padre)}</table></div>
      <div><h3>Ofícios do Bispo</h3><table>${rows(bispo)}</table></div>
    </div>
    <p style="margin-top:14px">Cada ofício exige o anterior. O bônus de Fé mostrado é o total daquele ofício. Acólito, Seminarista e Diácono têm Vocação: ao entrar em campo, buscam no baralho a carta do degrau seguinte.</p>`;
}

function openModal(html) {
  $('#modal .modal__body').innerHTML = html;
  $('#modal').hidden = false;
}

function closeModal() {
  $('#modal').hidden = true;
}

function buildDecks() {
  $('#decks').replaceChildren(...DECKS.map(d => {
    const saint = E.card(d.saint);
    const node = document.createElement('button');
    node.className = 'deck';
    node.innerHTML = `
      <div class="deck__art" style="background-image:url('${saint.backgroundImage}')"></div>
      <div class="deck__body">
        <div class="deck__name">${saint.name}</div>
        <div class="deck__epithet">${saint.epithet}</div>
        <p class="deck__desc">${d.desc}</p>
        <ul class="deck__traits">${d.traits.map(t => `<li>${t}</li>`).join('')}</ul>
      </div>`;
    node.onclick = () => {
      sfx.bell();
      startGame(d.id);
    };
    return node;
  }));
}

async function boot() {
  let json;
  try {
    json = await (await fetch('cards.json')).json();
  } catch {
    $('#title-lede').textContent = 'Não foi possível carregar as cartas. Abra o jogo por um servidor local, com npm start.';
    $('#btn-play').disabled = true;
    return;
  }
  E.loadCards(json);
  const goal = json.RULES.feToWin;
  $('#title-lede').textContent = `Erga templos, ordene o clero e tome a maioria das três zonas do retábulo. Vence quem reunir ${goal} de Fé primeiro.`;
  initFx($('#fx'));
  initGame();
  buildDecks();
  if (new URLSearchParams(location.search).has('debug')) window.khristos = debugHandle();

  $('#btn-play').onclick = () => {
    sfx.card();
    stage.dataset.screen = 'decks';
  };
  $('#btn-back').onclick = () => { stage.dataset.screen = 'title'; };
  $('#btn-again').onclick = () => startGame(currentDeck());
  $('#btn-switch').onclick = () => {
    $('#endgame').hidden = true;
    stage.dataset.screen = 'decks';
  };
  $('#pile-retiro').onclick = () => openModal(retiroHtml());
  document.querySelectorAll('[data-open]').forEach(button => {
    button.onclick = () => openModal(button.dataset.open === 'rules' ? rulesHtml(goal) : ladderHtml());
  });
  $('#modal .modal__close').onclick = closeModal;
  $('#modal').addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
  const sound = $('#btn-sound');
  const paint = () => {
    sound.textContent = SOUND_LABEL[soundMode()];
  };
  sound.onclick = () => {
    cycleSoundMode();
    paint();
  };
  paint();
  const paceButton = $('#btn-pace');
  let fast = recall('khristos-ritmo') === '1';
  const paintPace = () => {
    setPace(fast ? 2.2 : 1);
    paceButton.textContent = fast ? 'Ritmo rápido' : 'Ritmo calmo';
  };
  paceButton.onclick = () => {
    fast = !fast;
    remember('khristos-ritmo', fast ? '1' : '0');
    paintPace();
  };
  paintPace();
}

function recall(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function remember(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    return false;
  }
  return true;
}

boot();
