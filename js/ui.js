import * as E from './engine.js';
import { chooseAction, chooseMulligan } from './ai.js';
import { fx, sleep, setUnit, getPace, setPace, reduced, GOLD, RED, WHITE, PURPLE } from './fx.js';
import { sfx, music } from './audio.js';
import { cardNode, boardCardNode, backNode } from './cardview.js';

const ME = 0;
const AI = 1;
const $ = sel => document.querySelector(sel);
const stage = $('#stage');

let G = null;
let scale = 1;
let press = null;
let previewTimer = 0;
let toastTimer = 0;
const slotEl = [[], []];
const zoneEl = [];
const seatEl = [null, null];
const handEl = new Map();
const ui = { busy: false, sel: null, targeting: null, options: [], drag: null, ghost: null, confirm: null, justPlayed: null, shown: { fe: [0, 0] }, arriving: new Set() };

function el(tag, cls = '', html = '') {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html) node.innerHTML = html;
  return node;
}

export function fit() {
  scale = Math.min(innerWidth / 1600, innerHeight / 900);
  stage.style.setProperty('--scale', scale);
  setUnit(scale);
}

const vrect = node => node.getBoundingClientRect();
const vcenter = node => {
  const r = vrect(node);
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

function srect(node) {
  const r = vrect(node);
  const s = vrect(stage);
  return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale };
}

function spoint(x, y) {
  const s = vrect(stage);
  return { x: (x - s.left) / scale, y: (y - s.top) / scale };
}

const shortName = p => (G.players[p].deckId === 'aq' ? 'São Tomás' : 'Joana');
const saintOf = p => E.card(G.players[p].deckId === 'aq' ? 'sta_santo' : 'jo_santo');
const who = p => (p === ME ? 'Você' : shortName(AI));
const side = p => (p === ME ? 'mine' : 'theirs');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const canAct = () => Boolean(G) && G.phase === 'main' && G.turn === ME && !ui.busy;
const haloOf = p => seatEl[p].querySelector('.halo');

function log(text, cls = '') {
  const host = $('#log');
  host.append(el('p', cls, text));
  while (host.children.length > 18) host.firstChild.remove();
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

function hint(text = '', warn = false) {
  const h = $('#hint');
  h.textContent = text;
  h.classList.toggle('warn', warn);
}

function idleHint() {
  if (!G || G.phase !== 'main') {
    hint();
  } else if (G.turn !== ME) {
    hint(`${shortName(AI)} está jogando.`);
  } else if (ui.busy) {
    hint();
  } else if (E.legalActions(G).length === 1) {
    hint('Nada mais a jogar neste turno. Encerre o turno.');
  } else if (G.round <= 2) {
    hint('Arraste uma carta até um espaço destacado, ou clique nela e depois no destino.');
  } else {
    hint();
  }
}

function float(host, text, cls = '') {
  const f = el('div', `float ${cls}`, text);
  host.append(f);
  setTimeout(() => f.remove(), 1500);
}

function quake() {
  if (reduced) return;
  stage.classList.remove('quake');
  void stage.offsetWidth;
  stage.classList.add('quake');
  setTimeout(() => stage.classList.remove('quake'), 480);
}

async function banner(title, sub = '', cls = '') {
  const b = $('#banner');
  b.className = cls;
  b.querySelector('b').textContent = title;
  b.querySelector('span').textContent = sub;
  b.hidden = true;
  void b.offsetWidth;
  b.hidden = false;
  const total = cls.includes('small') ? 1200 : 1700;
  await sleep(total * 0.6);
  setTimeout(() => { b.hidden = true; }, total * 0.42);
}

async function cinema(def, { cls = '', title = def.name, sub = def.epithet || '', hold = 1500 } = {}) {
  const c = $('#cinema');
  c.className = cls;
  c.querySelector('.cinema__card').replaceChildren(cardNode(def));
  c.querySelector('.cinema__title b').textContent = title;
  c.querySelector('.cinema__title span').textContent = sub;
  c.hidden = false;
  await sleep(hold);
  c.classList.add('out');
  await sleep(360);
  c.hidden = true;
  c.classList.remove('out');
}

function buildBoard() {
  const board = $('#board');
  board.innerHTML = '';
  E.ZONES.forEach((slots, z) => {
    const zone = el('div', 'zone', `<div class="zone__crown"></div><div class="zone__state"></div><div class="side" data-p="${AI}"></div><div class="predella"><span class="pred__me">0</span><div class="pred__bar empty"><i></i></div><span class="pred__op">0</span><div class="pred__note"></div></div><div class="side" data-p="${ME}"></div>`);
    zone.dataset.zone = z;
    zone.classList.toggle('zone--wild', z === E.wildZone());
    zone.querySelector('.zone__crown').textContent = E.ZONE_NAMES[z];
    zone.style.setProperty('--cols', slots.length / 2);
    for (const p of [AI, ME]) {
      const near = p === ME ? 1 : -1;
      const order = [...slots].sort((a, b) => (E.rowOf(a) - E.rowOf(b)) * near || E.colOf(a) - E.colOf(b));
      for (const slot of order) {
        const s = el('div', 'slot');
        s.dataset.p = p;
        s.dataset.slot = slot;
        zone.querySelector(`.side[data-p="${p}"]`).append(s);
        slotEl[p][slot] = s;
      }
    }
    board.append(zone);
    zoneEl[z] = zone;
  });
}

function buildSeats() {
  for (const p of [ME, AI]) {
    const saint = saintOf(p);
    const seat = $(`#seat-${p}`);
    seat.innerHTML = `
      <div class="halo"><svg viewBox="0 0 120 120"><circle class="halo__track" cx="60" cy="60" r="55"/><circle class="halo__fill" cx="60" cy="60" r="55" pathLength="100"/></svg><div class="halo__face" style="background-image:url('${saint.backgroundImage}')"></div></div>
      <div class="seat__name">${saint.name}</div>
      <div class="seat__fe"><b>0</b>de ${G.rules.feToWin} de Fé</div>
      <div class="candles">${Array.from({ length: 10 }, (_, i) => `<i class="candle" style="--i:${i}"></i>`).join('')}</div>
      <div class="seat__counts"></div>
      <div class="seat__chain"></div>`;
    seatEl[p] = seat;
  }
}

function setStat(node, value, printed) {
  const text = String(value);
  if (node.textContent !== text) {
    if (node.textContent !== '') {
      node.classList.remove('pop');
      void node.offsetWidth;
      node.classList.add('pop');
    }
    node.textContent = text;
  }
  node.classList.toggle('up', value > printed);
  node.classList.toggle('down', value < printed);
}

function setHtml(node, html) {
  if (node.dataset.html !== html) {
    node.dataset.html = html;
    node.innerHTML = html;
  }
}

function updateBoardCard(node, p, slot, c) {
  const def = E.card(c.id);
  setStat(node.querySelector('.stat--fe'), E.feOf(G, p, slot), def.fe);
  const fraq = node.querySelector('.stat--fraq');
  if (fraq) setStat(fraq, E.fraqOf(G, p, slot), def.fraq);
  node.classList.toggle('stack', c.under.length > 0);
  node.classList.toggle('heresy', E.hasHeresy(c));
  node.classList.toggle('silenced', c.silenced > 0);
  node.classList.toggle('nofe', c.noFe > 0);
  node.classList.toggle('exposed', def.type === 'Unidade' && E.fraqOf(G, p, slot) >= 8);
  node.classList.toggle('guarded', def.type === 'Unidade' && E.shielded(G, p, slot));
  const office = E.officeOf(G, p, slot);
  node.querySelector('.bcard__office').textContent = office ? office.name : '';
  const marks = [];
  if (c.under.length) marks.push(`<span class="mark">${c.under.length + 1}</span>`);
  if (c.silenced) marks.push(`<span class="mark mark--bad">∅${c.silenced}</span>`);
  if (c.noFe) marks.push(`<span class="mark mark--bad">✕${c.noFe}</span>`);
  if (c.drain) marks.push('<span class="mark mark--bad">−3</span>');
  setHtml(node.querySelector('.bcard__marks'), marks.join(''));
  setHtml(node.querySelector('.bcard__pips'), c.relics.map(r => `<span class="pip${r.rounds ? ' temp' : ''}">${r.rounds || E.card(r.id).name[0]}</span>`).join(''));
  node.classList.toggle('has-active', p === ME && canAct() && E.activeOptions(G, ME, slot).length > 0);
}

function syncSlot(p, slot) {
  const host = slotEl[p][slot];
  const c = G.board[p][slot];
  let node = host.querySelector('.bcard:not(.dying)');
  if (!c) {
    if (node) node.remove();
    return null;
  }
  if (!node || Number(node.dataset.uid) !== c.uid) {
    if (node) node.remove();
    node = boardCardNode(c);
    host.append(node);
  }
  node.style.visibility = ui.arriving.has(c.uid) ? 'hidden' : '';
  updateBoardCard(node, p, slot, c);
  return node;
}

function syncBoard() {
  for (const p of [ME, AI]) for (let slot = 0; slot < E.slotCount(); slot++) syncSlot(p, slot);
}

function deckOrigin() {
  const d = srect($('#pile-deck'));
  const h = srect($('#hand'));
  return { x: d.x - h.x - 39, y: d.y - h.y - 91 };
}

function syncHand() {
  const hand = G.players[ME].hand;
  const host = $('#hand');
  const live = new Set(hand.map(c => c.uid));
  for (const [uid, node] of handEl) {
    if (!live.has(uid)) {
      node.remove();
      handEl.delete(uid);
    }
  }
  const n = hand.length;
  const step = n > 1 ? Math.min(132, 900 / (n - 1)) : 0;
  const x0 = (1100 - (step * (n - 1) + 160)) / 2;
  const mid = (n - 1) / 2;
  const tilt = Math.min(3, 20 / Math.max(1, n));
  hand.forEach((hc, i) => {
    const def = E.card(hc.id);
    const cost = E.costOf(G, ME, hc.id);
    let node = handEl.get(hc.uid);
    if (!node) {
      node = el('div', 'hcard new');
      node.dataset.uid = hc.uid;
      node.append(cardNode(def, { cost }));
      const from = deckOrigin();
      node.style.setProperty('--x', `${from.x}px`);
      node.style.setProperty('--y', `${from.y}px`);
      node.style.setProperty('--r', '0deg');
      host.append(node);
      handEl.set(hc.uid, node);
      void node.offsetWidth;
      node.classList.remove('new');
    }
    node.style.setProperty('--x', `${x0 + i * step}px`);
    node.style.setProperty('--y', `${(i - mid) ** 2 * 2.2}px`);
    node.style.setProperty('--r', `${(i - mid) * tilt}deg`);
    node.style.zIndex = i + 1;
    const playable = canAct() && E.legalPlays(G, ME, hc.uid).length > 0;
    node.classList.toggle('ok', playable);
    node.classList.toggle('off', !playable);
    node.classList.toggle('sel', ui.sel === hc.uid);
    node.classList.toggle('fervent', playable && Boolean(def.fervor) && E.fervorReady(G, ME));
    const badge = node.querySelector('.card__cost');
    badge.textContent = cost;
    badge.classList.toggle('cheap', cost < def.cost);
  });
}

function syncEnemyHand() {
  const host = $('#enemy-hand');
  const n = G.players[AI].hand.length;
  while (host.children.length < n) host.append(backNode());
  while (host.children.length > n) host.lastChild.remove();
  const step = n > 1 ? Math.min(56, 480 / (n - 1)) : 0;
  const x0 = (600 - (step * (n - 1) + 72)) / 2;
  const mid = (n - 1) / 2;
  [...host.children].forEach((node, i) => {
    node.style.setProperty('--x', `${x0 + i * step}px`);
    node.style.setProperty('--y', `${-((i - mid) ** 2) * 1.4}px`);
    node.style.setProperty('--r', `${(mid - i) * 2.2}deg`);
  });
}

function renderHud() {
  const goal = G.rules.feToWin;
  for (const p of [ME, AI]) {
    const seat = seatEl[p];
    const pl = G.players[p];
    const sab = G.turn === p && G.phase === 'main' ? pl.sab : 0;
    seat.querySelector('.halo').style.setProperty('--p', Math.min(100, (ui.shown.fe[p] / goal) * 100));
    seat.querySelector('.seat__fe b').textContent = ui.shown.fe[p];
    seat.querySelectorAll('.candle').forEach((c, i) => {
      c.classList.toggle('max', i < pl.sabMax);
      c.classList.toggle('lit', i < sab);
    });
    seat.querySelector('.seat__counts').textContent = p === ME ? `Sabedoria ${sab} de ${pl.sabMax}` : `Sabedoria ${sab} de ${pl.sabMax}, mão ${pl.hand.length}, baralho ${pl.deck.length}`;
    const lit = G.turn === p && G.phase === 'main' && pl.played > 0 && E.deckList(pl.deckId).some(id => E.card(id).fervor);
    seat.querySelector('.seat__chain').textContent = lit ? `Fervor aceso: ${plural(pl.played, 'carta')} no turno` : '';
  }
  $('#round-no').textContent = G.round;
  const pr = E.projected(G);
  const seal = z => `<i class="seal ${z.dom === null ? '' : side(z.dom)}" title="${E.ZONE_NAMES[z.z]}"></i>`;
  const line = p => {
    const name = p === ME ? 'Você' : shortName(AI);
    if (pr.majority === p) return `<p class="${side(p)}"><span>${name}</span><b>+${pr.gain[p]}</b></p>`;
    return `<p class="${side(p)} none"><span>${name}</span><em>${pr.held[p]} de ${G.rules.majority} zonas</em></p>`;
  };
  const crown = p => `A maioria é ${p === ME ? 'sua' : `de ${shortName(AI)}`}${pr.bonus[p] ? `, com Hegemonia (+${pr.bonus[p]})` : ''}.`;
  setHtml($('#forecast'), `<h3>Contagem ao encerrar o turno</h3><div class="seals">${pr.zones.map(seal).join('')}</div>${line(ME)}${line(AI)}<small>${pr.majority === null ? 'Ninguém tem a maioria: a Fé não conta.' : crown(pr.majority)}</small>`);
  stage.dataset.majority = pr.majority === null ? '' : pr.majority;
  for (const z of pr.zones) {
    const zone = zoneEl[z.z];
    const [a, b] = z.fe;
    const d = a - b;
    zone.dataset.dom = z.dom === null ? '' : z.dom;
    zone.querySelector('.pred__me').textContent = a;
    zone.querySelector('.pred__op').textContent = b;
    const bar = zone.querySelector('.pred__bar');
    bar.classList.toggle('empty', a + b === 0);
    bar.style.setProperty('--share', `${a + b ? (a / (a + b)) * 100 : 50}%`);
    const tied = a === 0 ? 'vazia' : z.dom === null ? 'empate' : `empate: ${z.dom === ME ? 'você' : shortName(AI)}`;
    const lead = d > 0 ? `+${d} você` : d < 0 ? `+${-d} ${shortName(AI)}` : tied;
    zone.querySelector('.pred__note').innerHTML = `<span>Fraq. ${E.zoneFraq(G, ME, z.z)}</span><b class="${z.dom === AI ? 'theirs' : ''}">${lead}</b><span>Fraq. ${E.zoneFraq(G, AI, z.z)}</span>`;
    zone.querySelector('.zone__state').textContent = G.schism[z.z].some(Boolean) ? 'em Cisma' : G.forced[z.z] !== null ? 'domínio tomado' : '';
  }
  $('#pile-deck b').textContent = G.players[ME].deck.length;
  $('#pile-retiro b').textContent = G.players[ME].retiro.length;
  const end = $('#btn-end');
  end.disabled = !canAct();
  end.textContent = G.turn === ME || G.phase !== 'main' ? 'Encerrar turno' : 'Turno do oponente';
  end.classList.toggle('ready', canAct() && E.legalActions(G).length === 1);
}

function refresh() {
  ui.shown.fe = G.players.map(pl => pl.fe);
  music.setIntensity(Math.max(...ui.shown.fe) / G.rules.feToWin);
  stage.dataset.turn = G.turn;
  syncBoard();
  syncHand();
  syncEnemyHand();
  renderHud();
}

function clearTargets() {
  ui.options = [];
  document.querySelectorAll('.can, .hot').forEach(node => {
    node.classList.remove('can', 'hot');
    delete node.dataset.can;
  });
  document.querySelectorAll('.slot .tag').forEach(node => node.remove());
}

function showTargets(options) {
  clearTargets();
  ui.options = options;
  const labels = { evolve: 'evoluir', replace: 'substituir', equip: 'equipar', 'spell-ally': 'alvo', 'spell-enemy': 'alvo', 'active-card': 'alvo' };
  for (const o of options) {
    if (o.at.slot !== undefined) {
      const s = slotEl[o.at.p][o.at.slot];
      const occupied = Boolean(G.board[o.at.p][o.at.slot]);
      const variant = o.kind === 'spell' ? (o.at.p === ME ? 'spell-ally' : 'spell-enemy') : o.kind === 'active' ? (occupied ? 'active-card' : 'play') : o.kind;
      s.classList.add('can');
      s.dataset.can = variant;
      if (labels[variant]) s.append(el('span', 'tag', labels[variant]));
    } else if (o.at.zone !== undefined) {
      zoneEl[o.at.zone].classList.add('can');
    } else {
      zoneEl.forEach(z => z.classList.add('can'));
    }
  }
}

function setHot(o) {
  document.querySelectorAll('.hot').forEach(node => node.classList.remove('hot'));
  if (!o) return;
  if (o.at.slot !== undefined) slotEl[o.at.p][o.at.slot].classList.add('hot');
  else if (o.at.zone !== undefined) zoneEl[o.at.zone].classList.add('hot');
  else zoneEl.forEach(z => z.classList.add('hot'));
}

function optionAt(x, y, options) {
  const stack = document.elementsFromPoint(x, y);
  const slot = stack.find(node => node.classList && node.classList.contains('slot'));
  const zone = stack.find(node => node.classList && node.classList.contains('zone'));
  for (const o of options) {
    if (o.at.slot !== undefined) {
      if (slot && Number(slot.dataset.p) === o.at.p && Number(slot.dataset.slot) === o.at.slot) return o;
    } else if (o.at.zone !== undefined) {
      if (zone && Number(zone.dataset.zone) === o.at.zone) return o;
    } else if (zone) {
      return o;
    }
  }
  return null;
}

function actionLabel(def, o) {
  const target = o.at.slot !== undefined ? G.board[o.at.p][o.at.slot] : null;
  const name = target ? E.card(target.id).name : '';
  if (o.kind === 'play') return 'Soltar aqui';
  if (o.kind === 'evolve') return `Evoluir ${name}`;
  if (o.kind === 'replace') return `Substituir ${name}`;
  if (o.kind === 'equip') return `Equipar em ${name}`;
  if (o.kind === 'active') return target ? `Usar em ${name}` : 'Mover para cá';
  if (target) return `Lançar em ${name}`;
  if (o.at.zone !== undefined) return `Lançar na ${E.ZONE_NAMES[o.at.zone]}`;
  return 'Lançar';
}

function makeGhost(def, cost) {
  const g = el('div', 'ghost');
  g.append(cardNode(def, { cost }), el('div', 'ghost__label'));
  $('#ghosts').append(g);
  return g;
}

const rectT = r => `translate(${r.x + r.w / 2 - 80}px, ${r.y + r.h / 2 - 112}px) scale(${r.w / 160})`;

function flight(g, from, to, { duration = 400, via = null, hold = 0.4 } = {}) {
  const frames = via
    ? [{ transform: rectT(from) }, { transform: rectT(via), offset: 0.28 }, { transform: rectT(via), offset: 0.28 + hold }, { transform: rectT(to) }]
    : [{ transform: rectT(from) }, { transform: rectT(to) }];
  g.style.transform = rectT(to);
  return settle(g.animate(frames, { duration: reduced ? 1 : duration / getPace(), easing: 'cubic-bezier(.3,.7,.2,1)' }), duration);
}

function settle(animation, duration) {
  return Promise.race([animation.finished.catch(() => {}), sleep(duration + 120)]);
}

function hideActionbar() {
  $('#actionbar').hidden = true;
  if (ui.confirm) {
    const answer = ui.confirm;
    ui.confirm = null;
    answer(false);
  }
}

function openBar(slot, buttons) {
  const bar = $('#actionbar');
  hidePreview();
  const r = srect(slotEl[ME][slot]);
  bar.replaceChildren(...buttons);
  bar.style.left = `${r.x + r.w / 2}px`;
  bar.style.top = `${r.y}px`;
  bar.hidden = false;
}

function confirmReplace(option) {
  return new Promise(resolve => {
    const old = E.card(G.board[ME][option.at.slot].id);
    const yes = el('button', '', `Substituir ${old.name}<small>vai para o Retiro</small>`);
    const no = el('button', '', 'Cancelar');
    yes.onclick = e => {
      e.stopPropagation();
      ui.confirm = null;
      $('#actionbar').hidden = true;
      resolve(true);
    };
    no.onclick = e => {
      e.stopPropagation();
      hideActionbar();
    };
    openBar(option.at.slot, [yes, no]);
    ui.confirm = resolve;
  });
}

function openActions(slot) {
  const options = E.activeOptions(G, ME, slot);
  if (!options.length) {
    hideActionbar();
    return;
  }
  const def = E.card(G.board[ME][slot].id);
  const button = el('button', '', `${def.active.label}<small>${def.active.cost ? `${def.active.cost} de Sabedoria` : 'sem custo'}</small>`);
  button.onclick = e => {
    e.stopPropagation();
    hideActionbar();
    if (options[0].at === undefined) {
      perform({ type: 'active', slot });
      return;
    }
    ui.targeting = { slot };
    showTargets(options.map(o => ({ kind: 'active', at: o.at })));
    hint(`Escolha o alvo de ${def.name}.`);
  };
  openBar(slot, [button]);
}

function deselect() {
  if (ui.sel !== null && handEl.has(ui.sel)) handEl.get(ui.sel).classList.remove('sel');
  ui.sel = null;
  ui.targeting = null;
  clearTargets();
  hideActionbar();
  idleHint();
}

function deny(node, reason) {
  sfx.nope();
  node.classList.remove('nope');
  void node.offsetWidth;
  node.classList.add('nope');
  if (reason) toast(reason);
}

function clickHand(uid) {
  if (!canAct()) return;
  if (ui.sel === uid) {
    deselect();
    return;
  }
  const node = handEl.get(uid);
  const options = E.legalPlays(G, ME, uid);
  if (!options.length) {
    deny(node, E.whyNot(G, ME, uid));
    return;
  }
  deselect();
  ui.sel = uid;
  node.classList.add('sel');
  showTargets(options);
  hint(`Escolha onde jogar ${E.card(G.players[ME].hand.find(c => c.uid === uid).id).name}.`);
}

function cancelDrag(d) {
  clearTargets();
  idleHint();
  const back = srect(d.node);
  d.ghost.style.transition = 'transform .2s ease';
  d.ghost.style.transform = rectT(back);
  setTimeout(() => {
    d.ghost.remove();
    d.node.classList.remove('dragging');
  }, 210);
}

async function commit(src, option) {
  clearTargets();
  hint();
  if (option.kind === 'replace' && !(await confirmReplace(option))) {
    if (src.ghost) cancelDrag(src);
    else deselect();
    return;
  }
  if (!canAct()) {
    if (src.ghost) cancelDrag(src);
    return;
  }
  if (ui.sel !== null && handEl.has(ui.sel)) handEl.get(ui.sel).classList.remove('sel');
  ui.sel = null;
  ui.targeting = null;
  ui.ghost = src.ghost || null;
  await perform(src.kind === 'hand' ? { type: 'play', uid: src.uid, at: option.at } : { type: 'active', slot: src.slot, at: option.at });
}

function beginDrag(e) {
  const fromHand = press.kind === 'hand';
  const options = fromHand ? E.legalPlays(G, ME, press.uid) : E.activeOptions(G, ME, press.slot).map(o => ({ kind: 'active', at: o.at }));
  if (!options.length) {
    if (fromHand) deny(press.node, E.whyNot(G, ME, press.uid));
    return false;
  }
  deselect();
  hidePreview();
  const def = fromHand ? E.card(G.players[ME].hand.find(c => c.uid === press.uid).id) : E.card(G.board[ME][press.slot].id);
  const ghost = makeGhost(def, fromHand ? E.costOf(G, ME, def.id) : def.cost);
  ui.drag = { ...press, options, ghost, def, hot: null, tilt: 0, lastX: e.clientX };
  press.node.classList.add('dragging');
  stage.classList.add('dragging');
  showTargets(options);
  hint(fromHand ? 'Solte a carta num destino destacado.' : 'Solte o Frei num espaço livre de uma zona vizinha.');
  return true;
}

function moveDrag(e) {
  const d = ui.drag;
  const pt = spoint(e.clientX, e.clientY);
  d.tilt = d.tilt * 0.7 + Math.max(-16, Math.min(16, (e.clientX - d.lastX) * 0.9)) * 0.3;
  d.lastX = e.clientX;
  d.ghost.style.transform = `translate(${pt.x - 80}px, ${pt.y - 112}px) rotate(${d.tilt}deg) scale(.8)`;
  const hot = optionAt(e.clientX, e.clientY, d.options);
  if (hot !== d.hot) {
    d.hot = hot;
    setHot(hot);
    d.ghost.querySelector('.ghost__label').textContent = hot ? actionLabel(d.def, hot) : '';
  }
}

function onPointerDown(e) {
  if (e.button !== undefined && e.button !== 0) return;
  if (!canAct()) return;
  const hc = e.target.closest('.hcard');
  if (hc) {
    press = { kind: 'hand', uid: Number(hc.dataset.uid), node: hc, x: e.clientX, y: e.clientY, moved: false };
  } else {
    const bc = e.target.closest('.bcard');
    const host = bc && bc.parentElement;
    if (!host || Number(host.dataset.p) !== ME || ui.sel !== null || ui.targeting) return;
    const slot = Number(host.dataset.slot);
    const options = E.activeOptions(G, ME, slot);
    if (!options.length || options[0].at === undefined || G.board[ME][slot].id !== 'frei') return;
    press = { kind: 'board', slot, node: bc, x: e.clientX, y: e.clientY, moved: false };
  }
  try {
    press.node.setPointerCapture(e.pointerId);
  } catch {
    press.captured = false;
  }
}

function onPointerMove(e) {
  if (!press) return;
  if (!press.moved) {
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) < 8) return;
    if (!beginDrag(e)) {
      press = null;
      return;
    }
    press.moved = true;
  }
  moveDrag(e);
}

function onPointerUp() {
  if (!press) return;
  const p = press;
  press = null;
  if (!p.moved) {
    if (p.kind === 'hand') clickHand(p.uid);
    return;
  }
  const d = ui.drag;
  ui.drag = null;
  stage.classList.remove('dragging');
  d.ghost.querySelector('.ghost__label').textContent = '';
  if (d.hot) commit(d, d.hot);
  else cancelDrag(d);
}

function onBoardClick(e) {
  if (ui.drag || !G) return;
  if (ui.sel !== null || ui.targeting) {
    const o = optionAt(e.clientX, e.clientY, ui.options);
    if (!o) {
      deselect();
      return;
    }
    if (ui.sel !== null) commit({ kind: 'hand', uid: ui.sel, node: handEl.get(ui.sel) }, o);
    else commit({ kind: 'board', slot: ui.targeting.slot }, o);
    return;
  }
  const bc = e.target.closest('.bcard');
  if (!bc) {
    hideActionbar();
    return;
  }
  const host = bc.parentElement;
  const p = Number(host.dataset.p);
  const slot = Number(host.dataset.slot);
  showBoardPreview(p, slot);
  if (p === ME && canAct()) openActions(slot);
  else hideActionbar();
}

function hidePreview() {
  clearTimeout(previewTimer);
  $('#preview').hidden = true;
}

const reqText = r => (r ? `Requer ${[r.zoneFe ? `${r.zoneFe} de Fé sua na zona` : '', r.dominio ? 'dominar a zona' : ''].filter(Boolean).join(' e ')}.` : '');
const lineHtml = (line, id) => `<p class="dim">Linha: ${line.map(x => (x === id ? `<b class="good">${E.card(x).name}</b>` : E.card(x).name)).join(', ')}.</p>`;

function handInfo(hc) {
  const def = E.card(hc.id);
  const cost = E.costOf(G, ME, hc.id);
  const parts = [`<h4>${def.name}</h4>`];
  if (def.evolvesFrom) {
    parts.push(`<p>Entra por cima de ${E.card(def.evolvesFrom).name}. Você paga só a diferença de custo: ${cost} de Sabedoria.</p>`);
    if (def.evolveReq) parts.push(`<p>${reqText(def.evolveReq)}</p>`);
  } else if (cost <= G.players[ME].sab || G.turn !== ME) {
    parts.push(`<p>Custa ${cost} de Sabedoria.</p>`);
  }
  const rite = E.sacramentStatus(G, ME, hc.id);
  if (rite) {
    const chip = (label, piece) => `<span class="chip ${piece.ok ? 'ok' : 'no'}">${label}: ${E.card(piece.need).name}${piece.ok ? '' : ', falta'}</span>`;
    parts.push(`<p class="chips">${chip('Ministro', rite.minister)}${rite.place ? chip('Lugar', rite.place) : ''}</p><p class="dim">Sacramento: ministro e lugar podem estar em qualquer zona sua, ou ser de grau superior. O ministro não pode ser o próprio alvo.</p>`);
  }
  if (def.fervor) parts.push(G.turn === ME && E.fervorReady(G, ME) ? '<p class="good">Fervor aceso: esta carta entra com o bônus.</p>' : '<p class="dim">Fervor: jogue outra carta antes desta, no mesmo turno, para ganhar o bônus.</p>');
  if (def.type === 'Relíquia') parts.push('<p class="dim">Fica presa à carta que a receber e acompanha a evolução dela.</p>');
  if (def.type === 'Bencao' || def.type === 'Heresia') parts.push('<p class="dim">Efeito imediato. Depois vai para o Retiro.</p>');
  const line = E.lineOf(def.id);
  if (line.length > 1) parts.push(lineHtml(line, def.id));
  const why = G.phase === 'main' && G.turn === ME ? E.whyNot(G, ME, hc.uid) : null;
  if (why) parts.push(`<p class="warn">${why}.</p>`);
  return parts.join('');
}

function boardInfo(p, slot) {
  const c = G.board[p][slot];
  const def = E.card(c.id);
  const office = E.officeOf(G, p, slot);
  const fe = E.feOf(G, p, slot);
  const fraq = E.fraqOf(G, p, slot);
  const parts = [`<h4>${office && office.level ? `${office.name} (${def.name})` : def.name}</h4>`];
  const feText = `Fé ${fe}${fe !== def.fe ? ` <span class="dim">(impressa ${def.fe})</span>` : ''}`;
  const fraqText = def.type === 'Monumento' ? '' : `, Fraqueza ${fraq}${fraq !== def.fraq ? ` <span class="dim">(impressa ${def.fraq})</span>` : ''}`;
  parts.push(`<p>${feText}${fraqText}</p>`);
  if (c.relics.length) parts.push(`<p>Relíquias: ${c.relics.map(r => E.card(r.id).name + (r.rounds ? ` (${plural(r.rounds, 'rodada')})` : '')).join(', ')}.</p>`);
  if (c.under.length) parts.push(`<p class="dim">Por baixo: ${c.under.map(id => E.card(id).name).join(', ')}.</p>`);
  const bad = [];
  if (c.silenced) bad.push(`sem passiva por ${plural(c.silenced, 'rodada')}`);
  if (c.noFe) bad.push(`sem gerar Fé por ${plural(c.noFe, 'rodada')}`);
  if (c.drain) bad.push(`−3 de Fé por ${plural(c.drain, 'rodada')}`);
  if (c.hFe) bad.push(`${c.hFe} de Fé`);
  if (c.hFraq) bad.push(`+${c.hFraq} de Fraqueza`);
  if (bad.length) parts.push(`<p class="warn">Heresias: ${bad.join(', ')}.</p>`);
  const notes = [];
  if (def.type === 'Unidade' && fraq >= 8) notes.push(E.exposed(G, p, slot) ? 'Exposta: o Inquisidor tira 2 de Fé dela' : 'Exposta: 8 ou mais de Fraqueza');
  if (def.type === 'Unidade' && E.shielded(G, p, slot)) notes.push('Protegida de Heresias');
  if (def.type === 'Santo' && E.zoneOf(slot) === E.wildZone()) notes.push('Na Zona Central, alcança as três zonas');
  if (c.id === 'martir') notes.push(`Cresceu ${c.grown} de 3 vezes`);
  if (c.id === 'inquisidor') notes.push(`Interrogatórios restantes: ${3 - c.uses}`);
  if (notes.length) parts.push(`<p>${notes.join('. ')}.</p>`);
  if (office) {
    const track = E.officeTrack(c.id);
    parts.push(`<ol>${track.map((o, i) => `<li class="${i < office.level ? 'done' : i === office.level ? 'now' : ''}">${o.name}${i === office.level + 1 ? ` <span class="dim">(${o.hint})</span>` : ''}</li>`).join('')}</ol>`);
  }
  if (def.evolvesTo) {
    const next = E.card(def.evolvesTo);
    parts.push(`<p class="dim">Evolui para ${next.name}. ${reqText(next.evolveReq)}</p>`);
  } else if (E.isTop(c.id)) {
    parts.push('<p class="good">Topo da linha: não pode ser destruída.</p>');
  }
  if (p === ME && canAct() && E.activeOptions(G, ME, slot).length) parts.push(`<p class="good">Clique para usar: ${def.active.label}.</p>`);
  return parts.join('');
}

function showHandPreview(uid) {
  const node = handEl.get(uid);
  const hc = G.players[ME].hand.find(c => c.uid === uid);
  if (!node || !hc || ui.drag) return;
  const box = $('#preview');
  box.replaceChildren(el('div', 'info', handInfo(hc)));
  const cx = 250 + parseFloat(node.style.getPropertyValue('--x')) + 80;
  box.style.left = `${cx < 800 ? cx + 152 : cx - 152 - 250}px`;
  box.style.top = '524px';
  box.hidden = false;
}

function showBoardPreview(p, slot) {
  const c = G.board[p][slot];
  if (!c || ui.drag) return;
  const box = $('#preview');
  box.replaceChildren(cardNode(E.card(c.id)), el('div', 'info', boardInfo(p, slot)));
  const r = srect(slotEl[p][slot]);
  const width = 290 + 12 + 250;
  box.style.left = `${r.x + r.w + 16 + width < 1590 ? r.x + r.w + 16 : r.x - 16 - width}px`;
  box.style.top = `${Math.max(14, Math.min(900 - 420, r.y + r.h / 2 - 203))}px`;
  box.hidden = false;
}

function onHandMove(e) {
  if (press || ui.drag) return;
  const hc = e.target.closest('.hcard');
  if (!hc) return;
  const r = vrect(hc);
  const px = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  const py = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
  const face = hc.firstElementChild;
  face.style.setProperty('--mx', `${px * 100}%`);
  face.style.setProperty('--my', `${py * 100}%`);
  face.style.setProperty('--ry', `${(px - 0.5) * 12}deg`);
  face.style.setProperty('--rx', `${(0.5 - py) * 9}deg`);
}

function onHover(e) {
  if (!G || ui.drag || press) return;
  const hc = e.target.closest('.hcard');
  const bc = !hc && e.target.closest('.bcard');
  clearTimeout(previewTimer);
  if (hc) {
    const uid = Number(hc.dataset.uid);
    previewTimer = setTimeout(() => showHandPreview(uid), 140);
  } else if (bc && !bc.classList.contains('dying')) {
    const host = bc.parentElement;
    $('#preview').hidden = true;
    if (Number(bc.dataset.uid) === ui.justPlayed) return;
    ui.justPlayed = null;
    previewTimer = setTimeout(() => showBoardPreview(Number(host.dataset.p), Number(host.dataset.slot)), 380);
  } else {
    ui.justPlayed = null;
    $('#preview').hidden = true;
  }
}

async function arrive(e, def, to) {
  let g = ui.ghost;
  ui.ghost = null;
  if (e.p === AI) {
    const from = srect($('#enemy-hand'));
    g = makeGhost(def, def.cost);
    syncEnemyHand();
    const start = { x: from.x + from.w / 2 - 36, y: from.y + 30, w: 72, h: 101 };
    if (def.type === 'Santo') await flight(g, start, to, { duration: 520 });
    else await flight(g, start, to, { duration: 1350, via: { x: 1010, y: 120, w: 250, h: 350 }, hold: 0.42 });
  } else if (g) {
    await flight(g, srect(g.querySelector('.card')), to, { duration: 170 });
  } else {
    const src = handEl.get(e.uid);
    g = makeGhost(def, def.cost);
    const from = src ? srect(src.querySelector('.card')) : srect($('#pile-deck'));
    if (src) src.classList.add('dragging');
    await flight(g, from, to, { duration: 380 });
  }
  g.remove();
}

function rowsFor(e, def) {
  const heresy = def.type === 'Heresia';
  if (e.at.slot !== undefined) return [slotEl[e.at.p][e.at.slot]];
  const target = heresy ? 1 - e.p : e.p;
  const zones = e.at.zone !== undefined ? [e.at.zone] : [0, 1, 2];
  return zones.map(z => zoneEl[z].querySelector(`.side[data-p="${target}"]`));
}

function pulse(host) {
  const node = host.querySelector('.bcard');
  if (!node) return;
  node.classList.remove('pulse');
  void node.offsetWidth;
  node.classList.add('pulse');
}

function fervorFlare(host, e) {
  const c = vcenter(host);
  sfx.fervor(e.level || e.chain - 1);
  float(host, e.level ? `Fervor +${e.level}` : 'Fervor', 'fervor');
  fx.burst(c.x, c.y, { color: RED, n: 20, speed: 240, grav: -180 });
  log(`Fervor: ${E.card(e.id).name} ganha o bônus.`, side(e.p));
}

async function rite(e, host) {
  const pieces = [e.minister, e.place].filter(slot => slot !== null && slot !== undefined).map(slot => slotEl[e.p][slot]);
  pieces.forEach(pulse);
  await Promise.all(pieces.map(piece => fx.stream(vcenter(piece), vcenter(host), { color: WHITE, n: 9, life: 0.5 })));
}

function celebrate() {
  let n = 0;
  const timer = setInterval(() => {
    fx.burst(innerWidth * (0.15 + Math.random() * 0.7), innerHeight * (0.15 + Math.random() * 0.5), { n: 44, speed: 380, life: 1.2, color: n % 2 ? GOLD : WHITE });
    if (++n > 9) clearInterval(timer);
  }, 260);
}

const handlers = {
  async play(e) {
    const def = E.card(e.id);
    const host = slotEl[e.p][e.slot];
    log(`${who(e.p)} jogou ${def.name} na ${E.ZONE_NAMES[E.zoneOf(e.slot)]}.`, side(e.p));
    ui.arriving.add(e.uid);
    if (def.type === 'Santo') {
      sfx.saint(e.p === AI);
      const mid = vcenter(stage);
      fx.pillar({ left: mid.x - 260 * scale, right: mid.x + 260 * scale, top: mid.y - 200 * scale, bottom: mid.y + 320 * scale, height: 520 * scale }, { n: 90, life: 1.8, color: e.p === ME ? GOLD : RED });
      await cinema(def, { cls: e.p === AI ? 'enemy' : '', hold: 1900 });
    }
    await arrive(e, def, srect(host));
    ui.arriving.delete(e.uid);
    if (e.p === ME) ui.justPlayed = e.uid;
    const node = syncSlot(e.p, e.slot);
    node.classList.add('enter');
    sfx.card({ cost: def.cost, chain: e.chain, enemy: e.p === AI });
    if (e.fervor) fervorFlare(host, e);
    const c = vcenter(host);
    fx.burst(c.x, c.y, { color: e.p === ME ? GOLD : RED, n: def.type === 'Santo' ? 70 : 22, speed: def.type === 'Santo' ? 420 : 260 });
    if (def.type === 'Santo') {
      fx.ring(c.x, c.y, { size: 420, life: 0.8 });
      quake();
    }
    syncBoard();
    syncHand();
    syncEnemyHand();
    renderHud();
    await sleep(330);
  },

  async evolve(e) {
    const def = E.card(e.id);
    const host = slotEl[e.p][e.slot];
    log(`${who(e.p)} evoluiu ${E.card(e.from).name} para ${def.name}.`, side(e.p));
    if (ui.ghost || e.p === AI || handEl.has(e.uid)) {
      ui.arriving.add(e.uid);
      await arrive(e, def, srect(host));
      ui.arriving.delete(e.uid);
    }
    if (e.p === ME) ui.justPlayed = e.uid;
    const node = syncSlot(e.p, e.slot);
    node.classList.add('evolved');
    sfx.evolve({ top: E.isTop(e.id) });
    fx.pillar(vrect(host), { color: e.p === ME ? GOLD : RED });
    float(host, def.name);
    syncBoard();
    syncHand();
    syncEnemyHand();
    renderHud();
    await sleep(560);
  },

  async retire(e) {
    const node = slotEl[e.p][e.slot].querySelector('.bcard');
    log(`${E.card(e.id).name} foi para o Retiro.`, side(e.p));
    if (!node) return;
    node.classList.add('dying');
    await sleep(430);
    node.remove();
  },

  async equip(e) {
    const def = E.card(e.id);
    const host = slotEl[e.p][e.slot];
    const r = srect(host);
    log(`${who(e.p)} equipou ${def.name} em ${E.card(G.board[e.p][e.slot].id).name}.`, side(e.p));
    await arrive(e, def, { x: r.x + r.w / 2 - 22, y: r.y + r.h / 2 - 31, w: 44, h: 62 });
    const node = syncSlot(e.p, e.slot);
    node.classList.remove('blessed');
    void node.offsetWidth;
    node.classList.add('blessed');
    sfx.relic();
    const c = vcenter(host);
    fx.burst(c.x, c.y, { color: PURPLE, n: 26, speed: 200 });
    float(host, def.name);
    syncBoard();
    syncHand();
    syncEnemyHand();
    renderHud();
    await sleep(380);
  },

  async spell(e) {
    const def = E.card(e.id);
    const heresy = def.type === 'Heresia';
    log(`${who(e.p)} ${e.sacramento ? 'celebrou' : 'lançou'} ${def.name}.`, side(e.p));
    if (ui.ghost) {
      ui.ghost.remove();
      ui.ghost = null;
    }
    const src = handEl.get(e.uid);
    if (src) src.classList.add('dragging');
    syncEnemyHand();
    if (heresy) sfx.heresy({ power: def.cost >= 5 ? 3 : def.cost >= 3 ? 2 : 1 });
    else if (e.sacramento) sfx.sacrament();
    else sfx.bless();
    const sub = e.sacramento ? 'Sacramento' : e.p === ME ? 'Você lança' : `${shortName(AI)} lança`;
    await cinema(def, { cls: `spell${heresy ? ' heresy' : ''}`, sub, hold: e.p === AI ? 1300 : e.chain > 1 ? 420 : 760 });
    const hosts = e.target === undefined ? rowsFor(e, def) : [slotEl[e.p][e.target]];
    if (e.sacramento) await rite(e, hosts[0]);
    for (const host of hosts) {
      if (heresy) fx.smoke(vrect(host));
      else fx.pillar(vrect(host), { color: e.p === ME ? GOLD : WHITE });
      host.querySelectorAll('.bcard').forEach(node => {
        node.classList.remove('hit', 'blessed');
        void node.offsetWidth;
        node.classList.add(heresy ? 'hit' : 'blessed');
      });
    }
    if (e.fervor) fervorFlare(hosts[0], e);
    syncBoard();
    syncHand();
    renderHud();
    await sleep(480);
  },

  async trigger(e) {
    const host = slotEl[e.p][e.slot];
    const c = vcenter(host);
    sfx.trigger();
    pulse(host);
    fx.ring(c.x, c.y, { color: e.p === ME ? GOLD : RED, size: 150, life: 0.45 });
    syncBoard();
    renderHud();
    await sleep(220);
  },

  async draw(e) {
    if (e.p === ME) {
      syncHand();
      e.cards.forEach((_, i) => setTimeout(() => sfx.draw(), i * 110));
      if (e.fetched) log(`Você buscou ${E.card(e.cards[0].id).name} no baralho.`, 'mine');
      for (const id of e.burned) toast(`Mão cheia: ${E.card(id).name} foi para o Retiro`);
    } else {
      syncEnemyHand();
      if (e.fetched) log(`${shortName(AI)} buscou uma carta no baralho.`, 'theirs');
    }
    renderHud();
    await sleep(e.cards.length ? 240 + 90 * e.cards.length : 40);
  },

  async fe(e) {
    ui.shown.fe[e.p] += e.amount;
    renderHud();
    if (!e.amount) return;
    float(haloOf(e.p), `${e.amount} de Fé`, 'bad');
    sfx.loss();
    log(`${who(e.p)} perdeu ${-e.amount} de Fé.`, side(1 - e.p));
    await sleep(520);
  },

  async destroy(e) {
    const host = slotEl[e.p][e.slot];
    const node = host.querySelector('.bcard');
    log(`${E.card(e.id).name} deixou o campo.`, side(1 - e.p));
    sfx.destroy();
    const c = vcenter(host);
    fx.burst(c.x, c.y, { color: RED, n: 46, speed: 340 });
    fx.smoke(vrect(host));
    quake();
    if (node) {
      node.classList.add('dying');
      await sleep(640);
      node.remove();
    }
    syncBoard();
    renderHud();
  },

  async unequip(e) {
    const host = slotEl[e.p][e.slot];
    const name = E.card(e.id).name;
    float(host, e.expired ? `${name} expirou` : `${name} perdida`, 'bad');
    log(e.expired ? `${name} expirou e foi para o Retiro.` : `${name} foi para o Retiro.`, side(e.p));
    syncSlot(e.p, e.slot);
    renderHud();
    await sleep(380);
  },

  async active(e) {
    const def = E.card(e.id);
    const host = slotEl[e.p][e.slot];
    log(`${who(e.p)} ativou ${def.name}: ${def.active.label.toLowerCase()}.`, side(e.p));
    if (e.key === 'frei_mover') return;
    sfx.active();
    const c = vcenter(host);
    fx.ring(c.x, c.y, { color: e.p === ME ? GOLD : RED, size: 240 });
    pulse(host);
    if (e.key === 'sta_doutrina') {
      for (const z of G.players[e.p].doctrine) fx.pillar(vrect(zoneEl[z].querySelector(`.side[data-p="${e.p}"]`)), { color: WHITE, n: 24 });
      float(haloOf(e.p), '−3 de Fraqueza');
    }
    if (e.key === 'jo_dominio') {
      const zone = zoneEl[E.zoneOf(e.slot)];
      zone.classList.add('scoring');
      float(zone, 'Domínio tomado', 'big');
      setTimeout(() => zone.classList.remove('scoring'), 720);
    }
    if (e.key === 'inquisidor_interrogar') {
      const target = slotEl[e.at.p][e.at.slot];
      fx.smoke(vrect(target), { n: 14 });
      float(target, '+2 de Fraqueza', 'bad');
    }
    syncBoard();
    renderHud();
    await sleep(540);
  },

  async move(e) {
    const fromHost = slotEl[e.p][e.from];
    const toHost = slotEl[e.p][e.to];
    const a = srect(fromHost);
    const old = fromHost.querySelector('.bcard');
    if (old) old.remove();
    if (ui.ghost) {
      ui.ghost.remove();
      ui.ghost = null;
    }
    const node = syncSlot(e.p, e.to);
    const b = srect(toHost);
    log(`${who(e.p)} levou o Frei para a ${E.ZONE_NAMES[E.zoneOf(e.to)]}.`, side(e.p));
    await settle(node.animate([{ transform: `translate(${a.x - b.x}px, ${a.y - b.y}px)` }, { transform: 'none' }], { duration: reduced ? 1 : 420 / getPace(), easing: 'cubic-bezier(.3,.7,.2,1)' }), 420);
    sfx.card();
    float(toHost, 'Peregrino');
    syncBoard();
    renderHud();
    await sleep(260);
  },

  async office(e) {
    const host = slotEl[e.p][e.slot];
    syncSlot(e.p, e.slot);
    if (!e.up) {
      float(host, e.name, 'bad');
      return;
    }
    float(host, e.name);
    sfx.office();
    const c = vcenter(host);
    fx.burst(c.x, c.y, { n: 14, speed: 150, color: GOLD });
    log(`${E.card(G.board[e.p][e.slot].id).name} ${e.p === ME ? 'seu' : `de ${shortName(AI)}`} agora é ${e.name}.`, side(e.p));
    await sleep(430);
  },

  async endTurn() {
    hint();
  },

  async round(e) {
    log(`Rodada ${e.round}`, 'round');
    renderHud();
  },

  async turn(e) {
    stage.dataset.turn = e.p;
    music.setTurn(e.p === ME);
    syncBoard();
    syncHand();
    renderHud();
    sfx.bell(e.p === AI);
    await banner(e.p === ME ? 'Seu turno' : `Turno de ${shortName(AI)}`, `Rodada ${e.round}`, e.p === AI ? 'enemy' : '');
  },

  async resolve(e) {
    const mine = e.p === ME;
    const name = mine ? 'Você' : shortName(AI);
    if (!e.majority) {
      sfx.nofaith();
      log(`${name} domina ${plural(e.held, 'zona')}: sem maioria, a Fé não conta.`, side(e.p));
      float(haloOf(e.p), 'Sem maioria', 'bad');
      await sleep(620);
      return;
    }
    if (mine) await banner('Contagem', `Você domina ${e.held} zonas`, 'small');
    else log(`${name} domina ${e.held} zonas e conta a Fé.`, 'theirs');
    const halo = haloOf(e.p);
    const color = mine ? GOLD : RED;
    let step = 0;
    for (const z of e.zones) {
      if (z.dom !== e.p || !z.gain) continue;
      const zone = zoneEl[z.z];
      const from = zone.querySelector('.predella');
      zone.classList.add('scoring');
      sfx.count(step);
      float(from, `+${z.gain}`, mine ? 'big' : 'big bad');
      log(`${E.ZONE_NAMES[z.z]}: ${z.fe[e.p]} a ${z.fe[1 - e.p]}, +${z.gain} para ${mine ? 'você' : name}.`, side(e.p));
      await Promise.all([fx.stream(vcenter(from), vcenter(halo), { color, n: Math.min(26, 8 + z.gain) }), sleep(400)]);
      ui.shown.fe[e.p] += z.gain;
      renderHud();
      sfx.fe(step++);
      halo.classList.remove('bump');
      void halo.offsetWidth;
      halo.classList.add('bump');
      zone.classList.remove('scoring');
      await sleep(200);
    }
    if (e.bonus) {
      sfx.hegemony();
      quake();
      log(`Hegemonia: ${mine ? 'você domina' : `${name} domina`} as três zonas, +${e.bonus}.`, side(e.p));
      await banner('Hegemonia', `${mine ? 'Você domina' : `${name} domina`} as três zonas: +${e.bonus} de Fé`, `small${mine ? '' : ' enemy'}`);
      await Promise.all(zoneEl.map(zone => fx.stream(vcenter(zone.querySelector('.zone__crown')), vcenter(halo), { color, n: 10 })));
    }
    ui.shown.fe = [...e.fe];
    music.setIntensity(Math.max(...e.fe) / G.rules.feToWin);
    syncBoard();
    renderHud();
    await sleep(280);
  },

  async majority(e) {
    renderHud();
    if (e.holder === null) {
      log('Ninguém tem mais a maioria das zonas.', 'round');
      return;
    }
    const mine = e.holder === ME;
    sfx.majority(mine);
    stage.classList.remove('sway');
    void stage.offsetWidth;
    stage.classList.add('sway');
    setTimeout(() => stage.classList.remove('sway'), 900);
    log(mine ? 'A maioria das zonas é sua.' : `${shortName(AI)} tomou a maioria das zonas.`, side(e.holder));
    await banner(mine ? 'A maioria é sua' : `${shortName(AI)} tomou a maioria`, mine ? 'Sua Fé conta ao encerrar o turno' : 'A Fé dele conta ao encerrar o turno', `small${mine ? '' : ' enemy'}`);
  },

  async win(e) {
    await sleep(500);
    music.stop();
    const end = $('#endgame');
    const mine = G.players[ME].fe;
    const theirs = G.players[AI].fe;
    const won = e.p === ME;
    end.className = won ? '' : 'lost';
    end.querySelector('h2').textContent = e.p === null ? 'Empate' : won ? 'Vitória' : 'Derrota';
    end.querySelector('p').textContent = e.p === null
      ? `Depois de ${G.round} rodadas, as duas Igrejas terminaram com ${mine} de Fé.`
      : won
        ? `Sua Igreja reuniu ${mine} de Fé em ${G.round} rodadas. ${saintOf(AI).name} ficou com ${theirs}.`
        : `${saintOf(AI).name} reuniu ${theirs} de Fé em ${G.round} rodadas. Você ficou com ${mine}.`;
    end.hidden = false;
    if (won) {
      sfx.win();
      celebrate();
    } else {
      sfx.lose();
    }
  }
};

async function run(events) {
  for (const e of events) {
    const handler = handlers[e.t];
    if (handler) await handler(e);
  }
  ui.arriving.clear();
}

function setBusy(on) {
  ui.busy = on;
  stage.classList.toggle('busy', on);
  if (on) hidePreview();
}

async function aiTurn() {
  setBusy(true);
  seatEl[AI].classList.add('thinking');
  refresh();
  idleHint();
  await sleep(450);
  while (G.phase === 'main' && G.turn === AI) {
    const action = chooseAction(G, () => (Math.random() - 0.5) * 1.2);
    await sleep(action.type === 'end' ? 380 : 420);
    await run(E.act(G, action));
  }
  seatEl[AI].classList.remove('thinking');
  setBusy(false);
  refresh();
  idleHint();
}

async function perform(action) {
  setBusy(true);
  hidePreview();
  $('#actionbar').hidden = true;
  let events = [];
  try {
    events = E.act(G, action);
  } catch (err) {
    toast(err.message);
  }
  await run(events);
  if (ui.ghost) {
    ui.ghost.remove();
    ui.ghost = null;
  }
  for (const node of handEl.values()) node.classList.remove('dragging');
  setBusy(false);
  refresh();
  if (G.phase === 'main' && G.turn === AI) await aiTurn();
  else idleHint();
}

function openMulligan() {
  const box = $('#mulligan');
  const host = box.querySelector('.mulligan__cards');
  const button = $('#btn-mulligan');
  const out = new Set();
  host.replaceChildren(...G.players[ME].hand.map(hc => {
    const node = el('button', 'mcard');
    node.append(cardNode(E.card(hc.id), { cost: E.costOf(G, ME, hc.id) }));
    node.onclick = () => {
      if (out.has(hc.uid)) out.delete(hc.uid);
      else out.add(hc.uid);
      node.classList.toggle('out', out.has(hc.uid));
      button.textContent = out.size ? `Trocar ${plural(out.size, 'carta')}` : 'Manter esta mão';
    };
    return node;
  }));
  button.textContent = 'Manter esta mão';
  button.onclick = async () => {
    box.hidden = true;
    setBusy(true);
    E.mulligan(G, ME, [...out]);
    const events = E.mulligan(G, AI, chooseMulligan(G, AI));
    syncHand();
    syncEnemyHand();
    await sleep(out.size ? 700 : 200);
    log('Rodada 1', 'round');
    log(`${G.first === ME ? 'Você começa' : `${shortName(AI)} começa`}. Quem joga depois tem ${G.rules.secondSab.bonus} de Sabedoria a mais nas ${G.rules.secondSab.untilRound} primeiras rodadas.`, 'round');
    await run(events);
    setBusy(false);
    refresh();
    if (G.turn === AI) await aiTurn();
    else idleHint();
  };
  box.hidden = false;
}

export function startGame(deckId) {
  G = E.newGame({ decks: [deckId, deckId === 'aq' ? 'jo' : 'aq'], seed: (Math.random() * 2 ** 31) | 0, first: Math.random() < 0.5 ? ME : AI });
  Object.assign(ui, { busy: false, sel: null, targeting: null, options: [], drag: null, ghost: null, confirm: null, justPlayed: null, shown: { fe: [0, 0] } });
  ui.arriving.clear();
  press = null;
  for (const node of handEl.values()) node.remove();
  handEl.clear();
  $('#log').innerHTML = '';
  $('#ghosts').innerHTML = '';
  $('#endgame').hidden = true;
  $('#preview').hidden = true;
  $('#actionbar').hidden = true;
  stage.dataset.screen = 'game';
  stage.classList.remove('busy', 'dragging');
  buildBoard();
  buildSeats();
  refresh();
  hint();
  music.setTurn(true);
  music.start();
  openMulligan();
}

export function currentDeck() {
  return G ? G.players[ME].deckId : null;
}

export function debugHandle() {
  return { E, state: () => G, refresh, run, perform, chooseAction, setPace };
}

export function retiroHtml() {
  if (!G) return '';
  const list = p => (G.players[p].retiro.length ? `<div class="cardlist">${G.players[p].retiro.map(id => `<span>${E.card(id).name}</span>`).join('')}</div>` : '<p>Nenhuma carta ainda.</p>');
  return `<h2>Retiro</h2><p class="lead">Cartas usadas, substituídas ou destruídas descansam aqui.</p><h3>Seu Retiro</h3>${list(ME)}<h3>Retiro de ${saintOf(AI).name}</h3>${list(AI)}`;
}

export function initGame() {
  fit();
  addEventListener('resize', fit);
  const hand = $('#hand');
  const board = $('#board');
  hand.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointerdown', onPointerDown);
  addEventListener('pointermove', onPointerMove);
  addEventListener('pointerup', onPointerUp);
  addEventListener('pointercancel', onPointerUp);
  board.addEventListener('click', onBoardClick);
  hand.addEventListener('pointerover', onHover);
  hand.addEventListener('pointermove', onHandMove);
  board.addEventListener('pointerover', onHover);
  hand.addEventListener('pointerleave', hidePreview);
  board.addEventListener('pointerleave', hidePreview);
  $('#btn-end').addEventListener('click', () => {
    if (!canAct()) return;
    deselect();
    perform({ type: 'end' });
  });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && G && !ui.busy) deselect();
  });
  stage.addEventListener('click', e => {
    if (!e.target.closest('#actionbar') && !e.target.closest('.bcard') && !$('#actionbar').hidden) hideActionbar();
    if (ui.sel !== null && !e.target.closest('#board') && !e.target.closest('#hand')) deselect();
  });
  setInterval(() => {
    if (stage.dataset.screen === 'game' && !document.hidden) fx.dust(innerWidth, innerHeight);
  }, 900);
}
