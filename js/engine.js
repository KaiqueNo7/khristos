export const ZONES = [];
export const ZONE_NAMES = ['Zona 1', 'Zona Central', 'Zona 3'];
const ROWS = 2;
const ZONE_LIST = [0, 1, 2];

let CARDS = {};
let DECKS = {};
let RULES = {};
let GRID = [];
let CLERGY = [];
let TEMPLES = [];

function buildGrid(zoneCols) {
  GRID = [];
  ZONES.length = 0;
  zoneCols.forEach((cols, zone) => {
    const slots = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < cols; col++) {
        slots.push(GRID.length);
        GRID.push({ zone, row, col });
      }
    }
    ZONES.push(slots);
  });
  for (const here of GRID) {
    here.neighbors = ZONES[here.zone].filter(slot => Math.abs(GRID[slot].row - here.row) + Math.abs(GRID[slot].col - here.col) === 1);
  }
}

export function loadCards(json) {
  CARDS = structuredClone(json.CARD_DEFS);
  DECKS = json.DECK_LISTS;
  RULES = json.RULES;
  for (const d of Object.values(CARDS)) if (d.evolvesTo) CARDS[d.evolvesTo].evolvesFrom = d.id;
  buildGrid(RULES.zoneCols);
  CLERGY = lineOf('acolito');
  TEMPLES = lineOf('capela');
}

export const slotCount = () => GRID.length;
export const zoneOf = slot => GRID[slot].zone;
export const rowOf = slot => GRID[slot].row;
export const colOf = slot => GRID[slot].col;
export const neighbors = slot => [...GRID[slot].neighbors];
export const wildZone = () => RULES.wildZone;

export const card = id => CARDS[id];
export const allCards = () => Object.values(CARDS);
export const deckList = id => DECKS[id];
export const isTop = id => Boolean(CARDS[id].evolvesFrom) && !CARDS[id].evolvesTo;

export function lineOf(id) {
  let first = id;
  while (CARDS[first].evolvesFrom) first = CARDS[first].evolvesFrom;
  const line = [first];
  while (CARDS[line[line.length - 1]].evolvesTo) line.push(CARDS[line[line.length - 1]].evolvesTo);
  return line;
}

const RELIC_FE = { calice: 2, relicario: 2, livro: 1, armadura: 2, icone: 1 };
const NEEDS_UNITS = new Set(['louvor', 'crisma', 'te_deum']);

const count = (list, f) => list.filter(f).length;
const isId = (...idList) => c => idList.includes(c.id);
const isType = (...types) => c => types.includes(CARDS[c.id].type);
const hasRelic = (c, id) => c.relics.some(r => r.id === id);
const cardsIn = (s, p, z) => ZONES[z].map(slot => s.board[p][slot]).filter(Boolean);
const unitsIn = (s, p, z) => cardsIn(s, p, z).filter(isType('Unidade'));
const adjacent = (s, p, slot) => neighbors(slot).map(x => s.board[p][x]).filter(Boolean);
const slotsWithCards = (s, p, z) => ZONES[z].filter(slot => s.board[p][slot]);
export const hasHeresy = c => Boolean(c.hFe || c.hFraq || c.silenced || c.noFe || c.drain);

function saintReaches(s, p, id, z) {
  const slot = s.board[p].findIndex(c => c && c.id === id);
  return slot >= 0 && (zoneOf(slot) === z || zoneOf(slot) === RULES.wildZone);
}

const OFFICES = {
  padre: [
    { name: 'Vigário Paroquial' },
    { name: 'Pároco', fe: 0, hint: 'fique ao lado de um Monumento seu', test: x => x.adj.some(isType('Monumento')) },
    { name: 'Decano', fe: 1, hint: 'tenha 3 unidades suas na zona', test: x => count(x.mine, isType('Unidade')) >= 3 },
    { name: 'Vigário Episcopal', fe: 2, hint: 'tenha um Bispo ou Cardeal em campo', test: x => x.all.some(isId('bispo', 'cardeal')) },
    { name: 'Vigário Geral', fe: 3, hint: 'domine a zona', test: x => x.dom() }
  ],
  bispo: [
    { name: 'Bispo Auxiliar' },
    { name: 'Bispo Diocesano', fe: 1, hint: 'domine a zona', test: x => x.dom() },
    { name: 'Arcebispo Metropolitano', fe: 2, hint: 'domine 2 zonas', test: x => x.zonesDom() >= 2 }
  ]
};

export const officeTrack = id => (OFFICES[id] || []).map(o => ({ name: o.name, fe: o.fe || 0, hint: o.hint || '' }));

function rand(s) {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(s.rng ^ (s.rng >>> 15), 1 | s.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function shuffle(s, a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createInstance(s, id, uid = s.nextUid++) {
  return { uid, id, under: [], relics: [], turn: s.turnNo, feMod: 0, fraqMod: 0, hFe: 0, hFraq: 0, tempFe: 0, silenced: 0, noFe: 0, drain: 0, moves: 0, trig: 0, grown: 0, uses: 0 };
}

export function toHand(s, p, id) {
  const c = { uid: s.nextUid++, id };
  s.players[p].hand.push(c);
  return c;
}

export function newGame({ decks, seed = Date.now(), first = 0 }) {
  const s = {
    rng: seed | 0,
    nextUid: 1,
    phase: 'mulligan',
    round: 1,
    turn: first,
    first,
    turnNo: 0,
    winner: null,
    rules: structuredClone(RULES),
    forced: ZONE_LIST.map(() => null),
    schism: ZONE_LIST.map(() => [false, false]),
    players: decks.map(deckId => ({ deckId, fe: 0, sab: 0, sabMax: 0, deck: [], hand: [], retiro: [], used: [], discount: 0, doctrine: [], played: 0, ready: false })),
    board: [Array(slotCount()).fill(null), Array(slotCount()).fill(null)]
  };
  s.players.forEach((pl, p) => {
    pl.deck = shuffle(s, [...DECKS[pl.deckId]]);
    for (let i = 0; i < s.rules.handStart; i++) toHand(s, p, pl.deck.pop());
  });
  return s;
}

export function mulligan(s, p, uids) {
  const pl = s.players[p];
  if (s.phase !== 'mulligan' || pl.ready) throw new Error('A troca inicial já foi feita');
  const out = pl.hand.filter(c => uids.includes(c.uid));
  pl.hand = pl.hand.filter(c => !uids.includes(c.uid));
  const replacements = out.map(() => pl.deck.pop());
  pl.deck.push(...out.map(c => c.id));
  shuffle(s, pl.deck);
  const cards = replacements.map(id => toHand(s, p, id));
  pl.ready = true;
  const ev = [{ t: 'mulligan', p, cards }];
  if (s.players.every(x => x.ready)) {
    s.phase = 'main';
    beginTurn(s, s.first, ev);
  }
  return ev;
}

function draw(s, p, n, ev) {
  const pl = s.players[p];
  const cards = [];
  const burned = [];
  for (let i = 0; i < n && pl.deck.length; i++) {
    const id = pl.deck.pop();
    if (pl.hand.length >= s.rules.handMax) {
      pl.retiro.push(id);
      burned.push(id);
    } else {
      cards.push(toHand(s, p, id));
    }
  }
  if (cards.length || burned.length) ev.push({ t: 'draw', p, cards, burned });
}

function fetchFromDeck(s, p, pick, ev) {
  const pl = s.players[p];
  const options = pl.deck.map((id, i) => i).filter(i => pick(pl.deck[i]));
  if (!options.length || pl.hand.length >= s.rules.handMax) return false;
  const [id] = pl.deck.splice(options[Math.floor(rand(s) * options.length)], 1);
  shuffle(s, pl.deck);
  ev.push({ t: 'draw', p, cards: [toHand(s, p, id)], burned: [], fetched: true });
  return true;
}

function triggered(s, p, slot, ev, effect) {
  const mark = ev.length;
  effect();
  if (ev.length > mark) ev.splice(mark, 0, { t: 'trigger', p, slot, id: s.board[p][slot].id });
}

function baseFe(s, p, slot) {
  const c = s.board[p][slot];
  const d = CARDS[c.id];
  const mine = cardsIn(s, p, zoneOf(slot));
  const adj = adjacent(s, p, slot);
  let f = d.fe + c.feMod + c.hFe + c.tempFe;
  for (const r of c.relics) f += RELIC_FE[r.id] || 0;
  f += count(adj, x => hasRelic(x, 'icone'));
  if (hasRelic(c, 'cruz_joana')) f += count(s.board[p].filter(Boolean), isType('Unidade'));
  if (d.type === 'Unidade') f += count(mine, isId('basilica')) + 2 * count(mine, isId('catedral')) + 2 * count(adj, x => x.id === 'cardeal' && !x.silenced);
  if (d.type === 'Monumento') f += 2 * count(mine, x => x.id === 'cardeal' && !x.silenced);
  if (c.id === 'igreja') f += count(mine, x => x.id === 'bispo' && !x.silenced);
  if (c.drain) f -= 3;
  return f;
}

function baseFraq(s, p, slot) {
  const c = s.board[p][slot];
  const d = CARDS[c.id];
  if (d.type === 'Monumento') return 0;
  const z = zoneOf(slot);
  let f = d.fraq + c.fraqMod + c.hFraq;
  if (hasRelic(c, 'livro')) f -= 3;
  if (d.type === 'Unidade') {
    if (s.players[p].doctrine.includes(z)) f -= 3;
    f -= 2 * count(cardsIn(s, p, z), isId('mosteiro_beneditino'));
    if (!hasRelic(c, 'armadura') && saintReaches(s, 1 - p, 'jo_santo', z)) f += 2;
  }
  return f;
}

function baseZoneFe(s, p, z) {
  return slotsWithCards(s, p, z).reduce((n, slot) => n + (s.board[p][slot].noFe ? 0 : Math.max(0, baseFe(s, p, slot))), 0);
}

const inspired = (s, p, z) => baseZoneFe(s, p, z) >= 10 || saintReaches(s, p, 'jo_santo', z);
const alone = (s, p, z) => unitsIn(s, p, z).length === 1;

function fraqPassive(s, p, slot) {
  const c = s.board[p][slot];
  if (c.silenced) return 0;
  const z = zoneOf(slot);
  const adj = adjacent(s, p, slot);
  switch (c.id) {
    case 'padre': return adj.some(isType('Monumento')) ? -3 : 0;
    case 'eremita': return alone(s, p, z) ? -5 : 0;
    case 'devoto': return adj.some(isType('Santo')) ? -3 : 0;
    case 'jovem_de_fe': return inspired(s, p, z) ? -2 : 0;
    default: return 0;
  }
}

export function fraqOf(s, p, slot) {
  const c = s.board[p][slot];
  if (!c || CARDS[c.id].type === 'Monumento') return 0;
  return Math.max(0, baseFraq(s, p, slot) + fraqPassive(s, p, slot));
}

export function zoneFraq(s, p, z) {
  const total = ZONES[z].reduce((n, slot) => n + fraqOf(s, p, slot), 0);
  return Math.max(0, total - 2 * count(cardsIn(s, p, z), isId('igreja')));
}

function tiebreak(s, z, fe) {
  if (s.forced[z] !== null && !s.schism[z][s.forced[z]]) return s.forced[z];
  const a = fe(0, z);
  const b = fe(1, z);
  let dom = a > b ? 0 : b > a ? 1 : null;
  const wild = RULES.wildZone;
  if (dom === null && a > 0 && wild !== null && wild !== undefined && z !== wild) dom = tiebreak(s, wild, fe);
  return dom !== null && s.schism[z][dom] ? null : dom;
}

const baseDominator = (s, z) => tiebreak(s, z, (p, zone) => baseZoneFe(s, p, zone));

export function officeOf(s, p, slot) {
  const c = s.board[p][slot];
  const track = c && OFFICES[c.id];
  if (!track) return null;
  let level = 0;
  if (!c.silenced) {
    const z = zoneOf(slot);
    const ctx = {
      adj: adjacent(s, p, slot),
      mine: cardsIn(s, p, z),
      all: s.board[p].filter(Boolean),
      dom: () => baseDominator(s, z) === p,
      zonesDom: () => count(ZONE_LIST, x => baseDominator(s, x) === p)
    };
    while (level + 1 < track.length && track[level + 1].test(ctx)) level++;
  }
  const next = track[level + 1];
  return { level, name: track[level].name, fe: track[level].fe || 0, next: next ? { name: next.name, hint: next.hint } : null };
}

function fePassive(s, p, slot) {
  const c = s.board[p][slot];
  if (c.silenced) return 0;
  const z = zoneOf(slot);
  const adj = adjacent(s, p, slot);
  switch (c.id) {
    case 'seminarista': return adj.some(isType('Santo', 'Monumento')) ? 1 : 0;
    case 'padre':
    case 'bispo': return officeOf(s, p, slot).fe;
    case 'eremita': return alone(s, p, z) ? 3 : 0;
    case 'devoto': return adj.some(isType('Santo')) ? 1 : 0;
    case 'cavaleiro_templario': return zoneFraq(s, p, z) < 7 ? 3 : 0;
    case 'jovem_de_fe': return inspired(s, p, z) ? 2 : 0;
    case 'pregador': return Math.min(4, Math.floor(zoneFraq(s, 1 - p, z) / 4));
    default: return 0;
  }
}

export function exposed(s, p, slot) {
  const c = s.board[p][slot];
  return Boolean(c) && CARDS[c.id].type === 'Unidade' && fraqOf(s, p, slot) >= 8 && cardsIn(s, 1 - p, zoneOf(slot)).some(x => x.id === 'inquisidor' && !x.silenced);
}

export function feOf(s, p, slot) {
  const c = s.board[p][slot];
  if (!c || c.noFe) return 0;
  let f = Math.max(0, baseFe(s, p, slot) + fePassive(s, p, slot));
  if (hasRelic(c, 'estandarte')) f *= 2;
  if (exposed(s, p, slot)) f -= 2;
  return Math.max(0, f);
}

export function zoneFe(s, p, z) {
  return ZONES[z].reduce((n, slot) => n + feOf(s, p, slot), 0);
}

export const dominator = (s, z) => tiebreak(s, z, (p, zone) => zoneFe(s, p, zone));

const totalFraq = (s, p) => ZONE_LIST.reduce((n, z) => n + zoneFraq(s, p, z), 0);

export function projected(s) {
  const zones = ZONE_LIST.map(z => {
    const fe = [zoneFe(s, 0, z), zoneFe(s, 1, z)];
    const dom = dominator(s, z);
    return { z, fe, dom, gain: [0, 1].map(p => (dom === p ? Math.max(0, fe[p] - fe[1 - p]) : 0)) };
  });
  const held = [0, 1].map(p => count(zones, x => x.dom === p));
  const counts = held.map(n => n >= s.rules.majority);
  const bonus = held.map((n, p) => (counts[p] && n === zones.length ? s.rules.hegemony : 0));
  const gain = [0, 1].map(p => (counts[p] ? zones.reduce((sum, x) => sum + x.gain[p], 0) + bonus[p] : 0));
  const holder = counts.indexOf(true);
  return { zones, held, gain, bonus, majority: holder < 0 ? null : holder };
}

export const fervorReady = (s, p) => s.players[p].played > 0;

export function costOf(s, p, id) {
  const d = CARDS[id];
  const printed = d.evolvesFrom ? d.cost - CARDS[d.evolvesFrom].cost : d.cost;
  return Math.max(0, printed - (d.sacramento ? s.players[p].discount : 0));
}

function evolveBlock(s, p, z, def) {
  const req = def.evolveReq || {};
  if (req.zoneFe && zoneFe(s, p, z) < req.zoneFe) return `Requer ${req.zoneFe} de Fé na zona`;
  if (req.dominio && dominator(s, z) !== p) return 'Requer dominar a zona';
  return null;
}

function monumentRoom(s, p, z, def, replaced) {
  if (def.type !== 'Monumento') return true;
  const mine = cardsIn(s, p, z);
  const used = count(mine, isType('Monumento')) - (replaced && CARDS[replaced.id].type === 'Monumento' ? 1 : 0);
  return used < s.rules.monumentLimit + count(mine, isId('bispo', 'cardeal'));
}

function entryOptions(s, p, def) {
  const out = [];
  const b = s.board[p];
  for (let slot = 0; slot < slotCount(); slot++) {
    const at = { p, slot };
    const c = b[slot];
    const z = zoneOf(slot);
    if (def.evolvesFrom) {
      if (c && c.id === def.evolvesFrom && c.turn !== s.turnNo && !evolveBlock(s, p, z, def)) out.push({ kind: 'evolve', at });
    } else if (!c) {
      if (monumentRoom(s, p, z, def)) out.push({ kind: 'play', at });
    } else if (ZONES[z].every(x => b[x]) && monumentRoom(s, p, z, def, c)) {
      out.push({ kind: 'replace', at });
    }
  }
  return out;
}

function equipOptions(s, p, def) {
  const out = [];
  s.board[p].forEach((c, slot) => {
    if (!c) return;
    const d = CARDS[c.id];
    if (c.relics.length < d.slots && (def.equipTarget.includes(d.type) || def.equipTarget.includes(d.id))) out.push({ kind: 'equip', at: { p, slot } });
  });
  return out;
}

export function sacramentStatus(s, p, id, at = {}) {
  const need = CARDS[id].sacramento;
  if (!need) return null;
  const zone = at.zone ?? (at.slot === undefined ? null : zoneOf(at.slot));
  const target = at.p === p ? at.slot : undefined;
  const piece = (line, min, skip) => {
    const rank = line.indexOf(min);
    const slots = s.board[p].map((c, slot) => (c && slot !== skip && line.indexOf(c.id) >= rank ? slot : -1)).filter(slot => slot >= 0);
    slots.sort((a, b) => Number(zoneOf(a) !== zone) - Number(zoneOf(b) !== zone) || a - b);
    return { need: min, ok: slots.length > 0, slot: slots.length ? slots[0] : null };
  };
  return { minister: piece(CLERGY, need.minister, target), place: need.place ? piece(TEMPLES, need.place) : null };
}

function sacramentBlock(s, p, def, at) {
  const status = sacramentStatus(s, p, def.id, at);
  if (!status) return null;
  if (!status.minister.ok) return `Falta o ministro: outro ${CARDS[status.minister.need].name} ou superior em campo`;
  if (status.place && !status.place.ok) return `Falta o lugar: ${CARDS[status.place.need].name} ou templo superior em campo`;
  return null;
}

const chaliceSlot = (s, p, z) => ZONES[z].find(slot => s.board[p][slot] && CARDS[s.board[p][slot].id].type === 'Monumento' && hasRelic(s.board[p][slot], 'calice'));

export function shielded(s, p, slot) {
  const c = s.board[p][slot];
  if (!c) return false;
  if (hasRelic(c, 'manto') || c.id === 'jo_santo') return true;
  return CARDS[c.id].type === 'Unidade' && adjacent(s, p, slot).some(x => x.id === 'martir' && !x.silenced);
}

function globalBlock(s, p, def) {
  const r = def.req || {};
  if (r.centralDominio && dominator(s, 1) !== p) return 'Requer dominar a Zona Central';
  if (r.enemyTotalFraq && totalFraq(s, 1 - p) < r.enemyTotalFraq) return `Requer ${r.enemyTotalFraq} de Fraqueza inimiga em campo`;
  if (def.id === 'cruzada' && !s.board[p].some(c => c && CARDS[c.id].type === 'Unidade')) return 'Você não tem unidades em campo';
  return null;
}

function zoneBlock(s, p, def, z) {
  const r = def.req || {};
  const e = 1 - p;
  if (r.dominio && dominator(s, z) !== p) return 'Requer dominar a zona';
  if (r.zoneFe && zoneFe(s, p, z) < r.zoneFe) return `Requer ${r.zoneFe} de Fé sua na zona`;
  if (r.enemyZoneFraq && zoneFraq(s, e, z) < r.enemyZoneFraq) return `Requer ${r.enemyZoneFraq} de Fraqueza inimiga na zona`;
  if (r.lessZoneFraq && zoneFraq(s, p, z) >= zoneFraq(s, e, z)) return 'Requer menos Fraqueza que o oponente na zona';
  if (r.unitsInZone && count([...cardsIn(s, p, z), ...cardsIn(s, e, z)], isType('Unidade')) < r.unitsInZone) return `Requer ${r.unitsInZone} unidades na zona`;
  if (def.id === 'eucaristia' && chaliceSlot(s, p, z) === undefined) return 'Requer um Monumento seu com o Cálice Sagrado na zona';
  if (def.target === 'zone' && NEEDS_UNITS.has(def.id) && !unitsIn(s, p, z).length) return 'Você não tem unidades nesta zona';
  return null;
}

function targetBlock(s, p, def, side, slot) {
  const c = s.board[side][slot];
  const d = CARDS[c.id];
  const pl = s.players[p];
  const r = def.req || {};
  if (def.target.endsWith('Unit') && d.type !== 'Unidade') return 'Alvo precisa ser uma unidade';
  if (def.target.endsWith('Monument') && d.type !== 'Monumento') return 'Alvo precisa ser um Monumento';
  if (def.target === 'enemyRelic' && !c.relics.length) return 'Alvo sem relíquia';
  if (def.type === 'Heresia' && shielded(s, side, slot)) return 'Alvo protegido de Heresias';
  if (r.targetFraq && fraqOf(s, side, slot) < r.targetFraq) return `Alvo precisa de ${r.targetFraq} de Fraqueza`;
  if ((def.id === 'inquisicao' || def.id === 'profanacao') && isTop(c.id)) return 'Carta no topo da linha não pode ser destruída';
  if (def.id === 'consagracao' && !(d.evolvesTo && (pl.deck.includes(d.evolvesTo) || pl.hand.some(h => h.id === d.evolvesTo)))) return 'Sem o próximo templo no baralho ou na mão';
  if (def.id === 'ordenacao' && !(d.evolvesTo && pl.deck.includes(d.evolvesTo))) return 'Sem a evolução no baralho';
  return null;
}

function spellOptions(s, p, def, reasons) {
  const note = r => { if (r && reasons) reasons.push(r); return r; };
  if (note(globalBlock(s, p, def)) || note(sacramentBlock(s, p, def, {}))) return [];
  if (def.target === 'none') return [{ kind: 'spell', at: {} }];
  const out = [];
  if (def.target === 'zone') {
    for (const z of ZONE_LIST) {
      const at = { zone: z };
      if (!note(zoneBlock(s, p, def, z)) && !note(sacramentBlock(s, p, def, at))) out.push({ kind: 'spell', at });
    }
    return out;
  }
  const side = def.target.startsWith('ally') ? p : 1 - p;
  for (let slot = 0; slot < slotCount(); slot++) {
    if (!s.board[side][slot]) continue;
    const at = { p: side, slot };
    if (note(targetBlock(s, p, def, side, slot)) || note(zoneBlock(s, p, def, zoneOf(slot))) || note(sacramentBlock(s, p, def, at))) continue;
    out.push({ kind: 'spell', at });
  }
  return out;
}

function playOptions(s, p, def, reasons) {
  if (def.type === 'Relíquia') return equipOptions(s, p, def);
  if (def.type === 'Bencao' || def.type === 'Heresia') return spellOptions(s, p, def, reasons);
  return entryOptions(s, p, def);
}

export function legalPlays(s, p, uid) {
  const pl = s.players[p];
  const hc = pl.hand.find(c => c.uid === uid);
  if (!hc || s.phase !== 'main' || s.turn !== p) return [];
  if (costOf(s, p, hc.id) > pl.sab) return [];
  return playOptions(s, p, CARDS[hc.id]);
}

export function whyNot(s, p, uid) {
  const pl = s.players[p];
  const hc = pl.hand.find(c => c.uid === uid);
  if (!hc) return null;
  if (s.phase !== 'main' || s.turn !== p) return 'Espere o seu turno';
  const def = CARDS[hc.id];
  const cost = costOf(s, p, hc.id);
  if (cost > pl.sab) return `Custa ${cost} de Sabedoria e você tem ${pl.sab}`;
  const reasons = [];
  if (playOptions(s, p, def, reasons).length) return null;
  if (def.type === 'Relíquia') return 'Nenhuma carta sua pode receber esta relíquia';
  if (def.evolvesFrom) {
    const from = CARDS[def.evolvesFrom].name;
    const slots = s.board[p].map((c, slot) => (c && c.id === def.evolvesFrom ? slot : -1)).filter(slot => slot >= 0);
    if (!slots.length) return `Só entra por cima de ${from}`;
    const ready = slots.filter(slot => s.board[p][slot].turn !== s.turnNo);
    if (!ready.length) return `${from} entrou neste turno; evolua no próximo`;
    return evolveBlock(s, p, zoneOf(ready[0]), def);
  }
  if (def.type === 'Monumento' && s.board[p].some(c => !c)) return 'A zona já tem o limite de Monumentos';
  return reasons[0] || 'Sem alvo válido';
}

export function activeOptions(s, p, slot) {
  const pl = s.players[p];
  const c = s.board[p][slot];
  const a = c && CARDS[c.id].active;
  if (!a || s.phase !== 'main' || s.turn !== p || pl.used.includes(c.uid) || a.cost > pl.sab) return [];
  const z = zoneOf(slot);
  const e = 1 - p;
  const room = pl.hand.length < s.rules.handMax;
  const here = [{ type: 'active', slot }];
  const aimed = (side, slots) => slots.map(t => ({ type: 'active', slot, at: { p: side, slot: t } }));
  switch (a.key) {
    case 'sta_doutrina': return here;
    case 'jo_dominio': return s.forced[z] === p || s.schism[z][p] ? [] : here;
    case 'diacono_bencao': return room && pl.deck.some(id => CARDS[id].type === 'Bencao') ? here : [];
    case 'devoto_santo': return room && pl.deck.some(id => CARDS[id].type === 'Santo') ? here : [];
    case 'inquisidor_interrogar':
      if (c.uses >= 3) return [];
      return aimed(e, ZONES[z].filter(t => s.board[e][t] && CARDS[s.board[e][t].id].type === 'Unidade' && !shielded(s, e, t) && !hasRelic(s.board[e][t], 'armadura')));
    case 'frei_mover': return aimed(p, s.board[p].map((x, t) => (!x && Math.abs(zoneOf(t) - z) === 1 ? t : -1)).filter(t => t >= 0));
    default: return [];
  }
}

export function legalActions(s) {
  if (s.phase !== 'main') return [];
  const p = s.turn;
  const out = [];
  for (const hc of s.players[p].hand) {
    for (const o of legalPlays(s, p, hc.uid)) out.push({ type: 'play', uid: hc.uid, at: o.at, kind: o.kind });
  }
  for (let slot = 0; slot < slotCount(); slot++) out.push(...activeOptions(s, p, slot));
  out.push({ type: 'end' });
  return out;
}

const sameAt = (x, y) => ['p', 'slot', 'zone'].every(k => (x?.[k] ?? null) === (y?.[k] ?? null));

function addFraq(c, n) {
  if (n > 0 && hasRelic(c, 'armadura')) return;
  c.fraqMod += n;
}

function addHeresyFraq(c, n) {
  if (!hasRelic(c, 'armadura')) c.hFraq += n;
}

function cleanse(c) {
  Object.assign(c, { hFe: 0, hFraq: 0, silenced: 0, noFe: 0, drain: 0 });
}

function loseFe(s, p, n, ev) {
  const pl = s.players[p];
  const amount = Math.min(pl.fe, n);
  pl.fe -= amount;
  ev.push({ t: 'fe', p, amount: -amount });
}

function leaveBoard(s, p, slot) {
  const old = s.board[p][slot];
  s.players[p].retiro.push(old.id, ...old.under, ...old.relics.map(r => r.id));
  s.board[p][slot] = null;
  return old;
}

function dropRelic(s, p, slot, index, ev, expired = false) {
  const [r] = s.board[p][slot].relics.splice(index, 1);
  s.players[p].retiro.push(r.id);
  ev.push({ t: 'unequip', p, slot, id: r.id, expired });
}

function onEnter(s, p, slot, ev, played) {
  const c = s.board[p][slot];
  const d = CARDS[c.id];
  if (d.type !== 'Unidade') return;
  const z = zoneOf(slot);
  const e = 1 - p;
  const pl = s.players[p];
  if (played) {
    if (s.board[p].some(x => x && x.id === 'sta_santo')) addFraq(c, -2);
    if (played.fervor && c.id === 'cavaleiro_templario') addFraq(c, -2);
  }
  if (d.vocacao) fetchFromDeck(s, p, id => id === d.evolvesTo, ev);
  if (c.id === 'pregador' && played) draw(s, p, 1, ev);
  if (c.id === 'monge' && !fetchFromDeck(s, p, id => id === 'acolito', ev)) draw(s, p, 1, ev);
  for (const t of ZONES[z]) {
    const m = s.board[p][t];
    if (m && m.id === 'scriptorium') triggered(s, p, t, ev, () => draw(s, p, 1, ev));
  }
  for (const t of ZONES[z]) {
    const m = s.board[e][t];
    if (m && m.id === 'missionario' && !m.silenced && m.trig !== s.turnNo) {
      m.trig = s.turnNo;
      triggered(s, e, t, ev, () => draw(s, e, 1, ev));
    }
  }
}

function evolveInto(s, p, slot, id, uid, ev, tags) {
  const old = s.board[p][slot];
  const c = createInstance(s, id, uid);
  Object.assign(c, {
    under: [...old.under, old.id],
    relics: old.relics,
    feMod: old.feMod,
    fraqMod: Math.max(old.fraqMod, -CARDS[id].fraq),
    hFe: old.hFe,
    hFraq: old.hFraq,
    tempFe: old.tempFe,
    silenced: old.silenced,
    noFe: old.noFe,
    drain: old.drain
  });
  s.board[p][slot] = c;
  ev.push({ t: 'evolve', p, slot, from: old.id, id, uid: c.uid, ...tags });
  onEnter(s, p, slot, ev, null);
}

function enter(s, p, hc, option, ev, tags) {
  const slot = option.at.slot;
  if (option.kind === 'evolve') {
    evolveInto(s, p, slot, hc.id, hc.uid, ev, tags);
    return;
  }
  if (option.kind === 'replace') ev.push({ t: 'retire', p, slot, id: leaveBoard(s, p, slot).id });
  s.board[p][slot] = createInstance(s, hc.id, hc.uid);
  ev.push({ t: 'play', p, slot, id: hc.id, uid: hc.uid, ...tags });
  onEnter(s, p, slot, ev, { fervor: Boolean(tags.fervor) });
}

function equip(s, p, hc, slot, ev, tags) {
  const r = { id: hc.id };
  if (CARDS[hc.id].rounds) r.rounds = CARDS[hc.id].rounds;
  s.board[p][slot].relics.push(r);
  ev.push({ t: 'equip', p, slot, id: hc.id, uid: hc.uid, ...tags });
}

const SPELLS = {
  vesperas(s, p, at, ev) {
    unitsIn(s, p, at.zone).forEach(c => addFraq(c, -2));
    draw(s, p, 1, ev);
  },
  eucaristia(s, p, at) {
    s.board[p][chaliceSlot(s, p, at.zone)].tempFe += 10;
  },
  revelacao(s, p, at, ev) {
    draw(s, p, 3, ev);
  },
  batismo(s, p, at) {
    const c = s.board[at.p][at.slot];
    c.feMod += 1;
    addFraq(c, -3);
  },
  confissao(s, p, at) {
    const c = s.board[at.p][at.slot];
    cleanse(c);
    c.feMod += 2;
  },
  crisma(s, p, at) {
    unitsIn(s, p, at.zone).forEach(c => {
      c.feMod += 2;
      addFraq(c, -2);
    });
  },
  uncao(s, p, at) {
    const c = s.board[at.p][at.slot];
    const removed = fraqOf(s, at.p, at.slot);
    c.fraqMod -= removed;
    c.feMod += Math.floor(removed / 3);
  },
  graca(s, p, at) {
    s.board[at.p][at.slot].tempFe += Math.floor(fraqOf(s, at.p, at.slot) / 2);
  },
  pentecoste(s, p) {
    for (const c of s.board[p]) {
      if (c && CARDS[c.id].type === 'Unidade') {
        c.feMod += 2;
        addFraq(c, -2);
      }
    }
  },
  consagracao(s, p, at, ev, cast) {
    const pl = s.players[p];
    const next = CARDS[s.board[p][at.slot].id].evolvesTo;
    const i = pl.deck.indexOf(next);
    let uid;
    if (i >= 0) {
      pl.deck.splice(i, 1);
      shuffle(s, pl.deck);
    } else {
      const h = pl.hand.findIndex(c => c.id === next);
      uid = pl.hand[h].uid;
      pl.hand.splice(h, 1);
    }
    evolveInto(s, p, at.slot, next, uid, ev, { chain: cast.before + 1 });
  },
  ordenacao(s, p, at, ev) {
    const next = CARDS[s.board[p][at.slot].id].evolvesTo;
    fetchFromDeck(s, p, id => id === next, ev);
  },
  louvor(s, p, at, ev, cast) {
    unitsIn(s, p, at.zone).forEach(c => { c.tempFe += cast.fervor ? 3 : 2; });
  },
  te_deum(s, p, at, ev, cast) {
    unitsIn(s, p, at.zone).forEach(c => { c.tempFe += 1 + cast.before; });
  },
  cruzada(s, p, at, ev, cast) {
    for (const c of s.board[p]) {
      if (c && CARDS[c.id].type === 'Unidade') {
        c.tempFe += cast.fervor ? 3 : 2;
        addFraq(c, 1);
      }
    }
  },
  inquisicao(s, p, at, ev) {
    ev.push({ t: 'destroy', p: at.p, slot: at.slot, id: leaveBoard(s, at.p, at.slot).id });
  },
  debate(s, p, at) {
    const c = s.board[at.p][at.slot];
    c.hFe -= 1;
    c.silenced = 2;
  },
  exposicao_aq(s, p, at) {
    addHeresyFraq(s.board[at.p][at.slot], 3);
  },
  tentacao(s, p, at, ev, cast) {
    addHeresyFraq(s.board[at.p][at.slot], cast.fervor ? 5 : 3);
    if (cast.fervor) draw(s, p, 1, ev);
  },
  escandalo(s, p, at) {
    for (const c of adjacent(s, at.p, at.slot)) if (CARDS[c.id].type === 'Unidade') addHeresyFraq(c, 3);
  },
  cisma(s, p, at) {
    s.schism[at.zone][1 - p] = true;
  },
  simonia(s, p, at) {
    s.board[at.p][at.slot].hFe -= 2;
  },
  heresia_alb(s, p, at) {
    s.board[at.p][at.slot].drain = 3;
  },
  exposicao_jo(s, p, at, ev) {
    loseFe(s, at.p, Math.min(10, fraqOf(s, at.p, at.slot)), ev);
  },
  iconoclastia(s, p, at, ev) {
    dropRelic(s, at.p, at.slot, s.board[at.p][at.slot].relics.length - 1, ev);
  },
  acusacao(s, p, at) {
    s.board[at.p][at.slot].noFe = 2;
  },
  propaganda(s, p, at, ev) {
    unitsIn(s, 1 - p, at.zone).forEach(c => addHeresyFraq(c, 1));
    loseFe(s, 1 - p, Math.floor(zoneFraq(s, 1 - p, at.zone) / 4), ev);
  },
  profanacao(s, p, at, ev) {
    ev.push({ t: 'destroy', p: at.p, slot: at.slot, id: leaveBoard(s, at.p, at.slot).id });
  }
};

function castSpell(s, p, hc, at, ev, tags, cast) {
  const def = CARDS[hc.id];
  const event = { t: 'spell', p, id: hc.id, uid: hc.uid, at, ...tags };
  const status = sacramentStatus(s, p, hc.id, at);
  if (status) Object.assign(event, { sacramento: true, minister: status.minister.slot, place: status.place ? status.place.slot : null });
  if (hc.id === 'eucaristia') event.target = chaliceSlot(s, p, at.zone);
  if (hc.id === 'te_deum' && cast.fervor) event.level = cast.before;
  ev.push(event);
  const victim = def.type === 'Heresia' && at.slot !== undefined ? s.board[at.p][at.slot] : null;
  if (victim && victim.id === 'martir' && !victim.silenced && victim.grown < 3) {
    victim.grown += 1;
    victim.feMod += 2;
    ev.push({ t: 'trigger', p: at.p, slot: at.slot, id: 'martir' });
  }
  SPELLS[hc.id](s, p, at, ev, cast);
  if (status) {
    const zone = at.zone ?? zoneOf(at.slot);
    for (const slot of ZONES[zone]) {
      const c = s.board[p][slot];
      if (c && c.id === 'catecumeno' && !c.silenced) {
        c.feMod += 2;
        ev.push({ t: 'trigger', p, slot, id: 'catecumeno' });
      }
    }
  }
  s.players[p].retiro.push(hc.id);
}

function playCard(s, a, ev) {
  const p = s.turn;
  const pl = s.players[p];
  const hc = pl.hand.find(c => c.uid === a.uid);
  if (!hc) throw new Error('Essa carta não está na mão de quem joga');
  const option = legalPlays(s, p, a.uid).find(o => sameAt(o.at, a.at));
  if (!option) throw new Error('Jogada inválida');
  const before = pl.played;
  const fervor = Boolean(CARDS[hc.id].fervor) && before > 0;
  const tags = fervor ? { chain: before + 1, fervor: true } : { chain: before + 1 };
  pl.sab -= costOf(s, p, hc.id);
  pl.hand.splice(pl.hand.indexOf(hc), 1);
  pl.played = before + 1;
  if (option.kind === 'equip') equip(s, p, hc, option.at.slot, ev, tags);
  else if (option.kind === 'spell') castSpell(s, p, hc, option.at, ev, tags, { fervor, before });
  else enter(s, p, hc, option, ev, tags);
}

function useActive(s, a, ev) {
  const p = s.turn;
  const pl = s.players[p];
  const option = activeOptions(s, p, a.slot).find(o => sameAt(o.at, a.at));
  if (!option) throw new Error('Habilidade indisponível');
  const c = s.board[p][a.slot];
  const active = CARDS[c.id].active;
  const z = zoneOf(a.slot);
  pl.sab -= active.cost;
  pl.used.push(c.uid);
  ev.push({ t: 'active', p, slot: a.slot, id: c.id, key: active.key, at: a.at });
  switch (active.key) {
    case 'sta_doutrina':
      pl.doctrine = z === RULES.wildZone ? [...ZONE_LIST] : [z];
      pl.discount = 1;
      break;
    case 'jo_dominio':
      s.forced[z] = p;
      break;
    case 'diacono_bencao':
      fetchFromDeck(s, p, id => CARDS[id].type === 'Bencao', ev);
      break;
    case 'devoto_santo':
      fetchFromDeck(s, p, id => CARDS[id].type === 'Santo', ev);
      break;
    case 'inquisidor_interrogar':
      c.uses += 1;
      addHeresyFraq(s.board[a.at.p][a.at.slot], 2);
      break;
    case 'frei_mover':
      s.board[p][a.at.slot] = c;
      s.board[p][a.slot] = null;
      if (c.moves < 8) {
        c.feMod += 1;
        c.fraqMod -= 1;
      }
      c.moves += 1;
      ev.push({ t: 'move', p, from: a.slot, to: a.at.slot });
      break;
  }
}

function beginTurn(s, p, ev) {
  const pl = s.players[p];
  s.turn = p;
  s.turnNo++;
  pl.used = [];
  pl.played = 0;
  pl.discount = 0;
  pl.doctrine = [];
  for (const c of s.board[p]) if (c) c.tempFe = 0;
  for (const z of ZONE_LIST) s.schism[z][1 - p] = false;
  const seat = s.rules.secondSab;
  const convents = ZONE_LIST.filter(z => ZONES[z].every(slot => s.board[p][slot])).flatMap(z => ZONES[z].filter(slot => s.board[p][slot].id === 'convento'));
  pl.sabMax = Math.min(s.rules.sabMax, s.round);
  pl.sab = pl.sabMax + convents.length + (p !== s.first && s.round <= seat.untilRound ? seat.bonus : 0);
  ev.push({ t: 'turn', p, round: s.round, sab: pl.sab });
  for (const slot of convents) ev.push({ t: 'trigger', p, slot, id: 'convento' });
  s.board[p].forEach((c, slot) => {
    if (!c) return;
    for (let i = c.relics.length - 1; i >= 0; i--) {
      const r = c.relics[i];
      if (CARDS[r.id].untilNextTurn || (r.rounds && --r.rounds === 0)) dropRelic(s, p, slot, i, ev, true);
    }
  });
  draw(s, p, 1, ev);
}

function countFaith(s, p, ev) {
  const now = projected(s);
  const majority = now.majority === p;
  s.players[p].fe += now.gain[p];
  ev.push({
    t: 'resolve',
    p,
    round: s.round,
    zones: now.zones.map(x => ({ z: x.z, fe: x.fe, dom: x.dom, gain: majority ? x.gain[p] : 0 })),
    held: now.held[p],
    majority,
    gain: now.gain[p],
    bonus: now.bonus[p],
    fe: s.players.map(pl => pl.fe)
  });
}

function settle(s, ev) {
  const [a, b] = s.players.map(pl => pl.fe);
  const goal = s.rules.feToWin;
  let winner;
  if ((a >= goal || b >= goal) && a !== b) {
    winner = a > b ? 0 : 1;
  } else if (s.round >= s.rules.lastRound) {
    const [x, y] = projected(s).held;
    if (a !== b) winner = a > b ? 0 : 1;
    else if (x !== y) winner = x > y ? 0 : 1;
    else if (s.round >= s.rules.lastRound + 3) winner = null;
  }
  if (winner === undefined) return false;
  s.winner = winner;
  s.phase = 'over';
  ev.push({ t: 'win', p: winner });
  return true;
}

function endTurn(s, ev) {
  const p = s.turn;
  ev.push({ t: 'endTurn', p });
  countFaith(s, p, ev);
  for (const z of ZONE_LIST) if (s.forced[z] === p) s.forced[z] = null;
  for (const c of s.board[p]) {
    if (!c) continue;
    c.silenced = Math.max(0, c.silenced - 1);
    c.noFe = Math.max(0, c.noFe - 1);
    c.drain = Math.max(0, c.drain - 1);
  }
  if (p === s.first) {
    beginTurn(s, 1 - p, ev);
    return;
  }
  if (settle(s, ev)) return;
  s.round++;
  ev.push({ t: 'round', round: s.round });
  beginTurn(s, s.first, ev);
}

function officeLevels(s) {
  const levels = new Map();
  for (const p of [0, 1]) {
    s.board[p].forEach((c, slot) => {
      const office = c && officeOf(s, p, slot);
      if (office) levels.set(c.uid, { p, slot, level: office.level, name: office.name });
    });
  }
  return levels;
}

export function act(s, a) {
  if (s.phase !== 'main') throw new Error('A partida não está em andamento');
  const ev = [];
  const before = officeLevels(s);
  const was = projected(s).majority;
  if (a.type === 'end') endTurn(s, ev);
  else if (a.type === 'play') playCard(s, a, ev);
  else if (a.type === 'active') useActive(s, a, ev);
  else throw new Error('Ação desconhecida');
  for (const [uid, now] of officeLevels(s)) {
    const prior = before.get(uid)?.level ?? 0;
    if (now.level !== prior) ev.push({ t: 'office', p: now.p, slot: now.slot, name: now.name, up: now.level > prior });
  }
  const holder = projected(s).majority;
  if (holder !== was && s.phase === 'main') ev.push({ t: 'majority', holder, was });
  return ev;
}
